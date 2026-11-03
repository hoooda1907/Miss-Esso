// Miss Esoo AI proxy — Cloudflare Worker
// Secrets: ANTHROPIC_API_KEY, APP_TOKEN | Vars: ALLOWED_ORIGIN, MODEL (optional)
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = [...(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean), 'https://localhost']; // localhost = تطبيق الـ APK
    const okOrigin = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : (allowed[0] || 'null'),
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Vary': 'Origin'
    };
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(req.url).pathname;
    if (path === '/health') return json({ ok: true });
    if (path !== '/chat' || req.method !== 'POST') return json({ error: 'not_found' }, 404);
    if (!okOrigin) return json({ error: 'forbidden_origin' }, 403);
    if (env.APP_TOKEN && req.headers.get('X-App-Token') !== env.APP_TOKEN) return json({ error: 'unauthorized' }, 401);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'server_not_configured' }, 500);

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

    const payload = {
      model: env.MODEL || 'claude-sonnet-5-5',
      max_tokens: Math.min(Number(body.max_tokens) || 1500, 4000),
      messages: msgs
    };
    if (body.system) payload.system = String(body.system).slice(0, 4000);

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
    const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return json({ text });
  }
};
