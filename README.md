# Miss Esoo

تطبيق ويب للمعلمة: طلاب، حضور وغياب، سبورة بتسجيل صوت وفيديو، وذكاء اصطناعي.

## الخطوة 1: السيرفر الوسيط (Cloudflare Workers - مجاني)
1. أنشئي حساب على dash.cloudflare.com ثم Workers & Pages ثم Create ثم Worker.
2. سمّيه `miss-esoo-ai` واضغطي Deploy، ثم Edit code.
3. امسحي الكود الموجود والصقي محتوى `worker/worker.js` ثم Deploy.
4. من Settings ثم Variables and Secrets أضيفي:
   - `ANTHROPIC_API_KEY` (نوع Secret): مفتاحك من console.anthropic.com
   - `APP_TOKEN` (نوع Secret): أي كلمة طويلة عشوائية، مثال `me-7f3k9x2q8w`
   - `ALLOWED_ORIGIN` (نوع Text): `https://USERNAME.github.io` (اسم حسابك على GitHub بدون / في الآخر). تطبيق الـ APK مسموح له تلقائياً
   - `MODEL` (اختياري): `claude-sonnet-5-5`
5. انسخي رابط الـ Worker، شكله `https://miss-esoo-ai.xxxx.workers.dev`.

## الخطوة 2: ربط التطبيق
افتحي `config.js` وعدّلي:
```js
window.ME_CONFIG = {
  proxy: "رابط الـ Worker",
  token: "نفس قيمة APP_TOKEN"
};
```

## الخطوة 3: النشر على GitHub Pages
1. أنشئي مستودع جديد على GitHub (Public).
2. ارفعي كل الملفات (Add file ثم Upload files) واعملي Commit.
3. Settings ثم Pages ثم Branch: main ثم Folder: / (root) ثم Save.
4. بعد دقيقة افتحي `https://USERNAME.github.io/REPO/`.
5. من الموبايل (Chrome): القائمة ثم "إضافة إلى الشاشة الرئيسية".
6. للتأكد: الإعدادات ثم الذكاء الاصطناعي ثم "اختبار الاتصال".

## إضافة الذكاء الاصطناعي في أي قسم جديد
استخدمي الدالة الجاهزة في `index.html`:
```js
const r = await aiCall("اكتبي سؤال", { system: "تعليمات اختيارية", max: 1500 });
console.log(r.text);
// أو محادثة كاملة: aiCall([{role:"user",content:"..."},{role:"assistant",content:"..."},{role:"user",content:"..."}])
// ولمعالجة الأخطاء: catch(e){ toast(errMsg(e)) }
```

## أمان وتكلفة (مهم)
- مفتاح Anthropic محفوظ في Cloudflare فقط وليس في الصفحة.
- الـ `token` ظاهر لأي شخص يفتح كود الصفحة، فهو يمنع الاستخدام العابر فقط. الحماية الأساسية هي `ALLOWED_ORIGIN`.
- حدّدي حد إنفاق شهري في console.anthropic.com، وأضيفي Rate Limiting Rule على الـ Worker من Cloudflare (Security ثم WAF ثم Rate limiting rules).
- كل البيانات (طلاب، حضور) محفوظة على جهاز المستخدم فقط، وكلمة المرور والبصمة قفل محلي.

## بناء ملف APK تلقائياً (GitHub Actions)
1. تأكدي إن المجلد المخفي `.github/workflows/build-apk.yml` اترفع. لو مظهرش بعد الرفع، اعملي Add file ثم Create new file واكتبي الاسم `.github/workflows/build-apk.yml` والصقي محتواه.
2. من تبويب Actions اختاري Build APK ثم Run workflow (بيشتغل لوحده كمان مع أي رفع جديد).
3. استني 5 إلى 10 دقايق، افتحي التشغيل الناجح، ومن Artifacts نزّلي `Miss-Esoo-APK` وفكّي الضغط.
4. ثبّتي `app-debug.apk` على الموبايل (اسمحي بالتثبيت من مصدر غير معروف).

ملاحظات الـ APK:
- نسخة debug صالحة للاستخدام الشخصي. النشر على Google Play يحتاج نسخة release موقّعة وحساب مطوّر.
- المشاركة والحفظ بيفتحوا قائمة مشاركة الأندرويد (اختاري واتساب أو ماسنجر أو يوتيوب أو Drive).
- البصمة ممكن متشتغلش داخل الـ APK وكلمة المرور شغالة دايماً.
- الـ APK بيحتاج إنترنت للخطوط والذكاء الاصطناعي.

## تعديل ALLOWED_ORIGIN من الموبايل
1. افتحي Chrome ثم القائمة (⋮) وفعّلي "موقع سطح المكتب" (Desktop site).
2. ادخلي dash.cloudflare.com وسجّلي دخول.
3. Workers & Pages ثم اضغطي على `miss-esoo-ai`.
4. Settings ثم Variables and Secrets ثم Edit على `ALLOWED_ORIGIN`.
5. اكتبي `https://USERNAME.github.io` (اسم حسابك بدل USERNAME) ثم Deploy.
