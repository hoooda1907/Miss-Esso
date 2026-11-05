// Miss Esoo AI proxy — Cloudflare Worker (مجاني عبر Workers AI، أو Claude لو ضفتي ANTHROPIC_API_KEY)
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = [...(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean), 'https://localhost'];
    const okOrigin = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : (allowed[0] || 'null'),
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Vary': 'Origin'
    };
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(req.url).pathname.replace(/^\/chat\/chat\/?$/, '/chat');
    if (path === '/health') return json({ ok: true, provider: env.GEMINI_API_KEY ? 'gemini' : env.ANTHROPIC_API_KEY ? 'claude' : env.AI ? 'workers-ai' : 'none' });
    if (path !== '/chat' || req.method !== 'POST') return json({ error: 'not_found' }, 404);
    if (!okOrigin) return json({ error: 'forbidden_origin' }, 403);
    if (env.APP_TOKEN && req.headers.get('X-App-Token') !== env.APP_TOKEN) return json({ error: 'unauthorized' }, 401);
    if (!env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY && !env.AI) return json({ error: 'server_not_configured' }, 500);

    const raw = await req.text();
    if (raw.length > 5_000_000) return json({ error: 'too_large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }

    const msgs = body.messages;
    if (!Array.isArray(msgs) || msgs.length < 1 || msgs.length > 20) return json({ error: 'bad_messages' }, 400);
    for (const m of msgs) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) return json({ error: 'bad_role' }, 400);
      const c = m.content;
      if (typeof c === 'string' ? (!c || c.length > 30000) : !Array.isArray(c)) return json({ error: 'bad_content' }, 400);
    }
    if (msgs[0].role !== 'user' || msgs[msgs.length - 1].role !== 'user') return json({ error: 'bad_order' }, 400);
    const system = body.system ? String(body.system).slice(0, 4000) : '';
    const maxTokens = Math.min(Number(body.max_tokens) || 1500, 4000);

    // ---- المسار 0: Gemini لو فيه GEMINI_API_KEY ----
    if (env.GEMINI_API_KEY) {
      const flatG = c => typeof c === 'string' ? c : c.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
      const payload = {
        contents: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: flatG(m.content) }] })),
        generationConfig: { maxOutputTokens: maxTokens }
      };
      if (system) payload.systemInstruction = { parts: [{ text: system }] };
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch { return json({ error: 'upstream_unreachable' }, 502); }
      if (!r.ok) return json({ error: 'upstream', status: r.status, detail: (await r.text()).slice(0, 300) }, r.status === 429 ? 429 : 502);
      const d = await r.json();
      return json({ text: (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('') });
    }

    // ---- المسار 1: Claude (مدفوع) لو فيه مفتاح ----
    if (env.ANTHROPIC_API_KEY) {
      const payload = { model: env.MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, messages: msgs };
      if (system) payload.system = system;
      let r;
      try {
        r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch { return json({ error: 'upstream_unreachable' }, 502); }
      if (!r.ok) return json({ error: 'upstream', status: r.status }, r.status === 429 ? 429 : 502);
      const d = await r.json();
      return json({ text: (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('') });
    }

    // ---- المسار 2: Workers AI (مجاني) ----
    const flat = c => typeof c === 'string' ? c : c.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    for (const m of msgs) messages.push({ role: m.role, content: flat(m.content) });
    try {
      const out = await env.AI.run(env.MODEL || '@cf/google/gemma-4-26b-a4b-it', { messages, max_tokens: maxTokens });
      let text = out && (out.response ?? out.choices?.[0]?.message?.content ?? out.output_text ?? '');
      if (typeof text !== 'string') text = JSON.stringify(text);
      return json({ text });
    } catch (e) {
      const msg = String((e && e.message) || e);
      return json({ error: 'ai_error', detail: msg.slice(0, 200) }, /limit|quota|neuron/i.test(msg) ? 429 : 502);
    }
  }
};
