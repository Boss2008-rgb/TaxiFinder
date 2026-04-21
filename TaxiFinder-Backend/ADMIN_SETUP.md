# ══════════════════════════════════════════════════
#  TaxiGo Admin Dashboard — دليل التثبيت الكامل
# ══════════════════════════════════════════════════

## 📁 الملفات التي تحتاج إضافتها

```
TaxiFinder-Backend/
├── public/
│   ├── admin.html        ← الصفحة الرئيسية للوحة الأدمن
│   └── admin.js          ← منطق JavaScript
├── routes/
│   └── admin.js          ← admin_routes.js (أعد التسمية)
└── server.js             ← أضف سطرين فقط
```

---

## 1️⃣  .env — أضف هذه الأسطر

```env
# Admin Credentials
ADMIN_EMAIL=admin@taxigo.ma
ADMIN_PASSWORD=TaxiGo@Admin2026
ADMIN_SECRET=taxigo-admin-jwt-secret-change-in-production
```

---

## 2️⃣  server.js — أضف سطرين فقط

ابحث عن:
```javascript
const aiRoutes = require('./routes/ai');
```

أضف تحته مباشرة:
```javascript
const adminRoutes = require('./routes/admin');
```

ثم ابحث عن:
```javascript
app.use('/api/ai', aiRoutes);
```

أضف تحته:
```javascript
app.use('/api/admin', adminRoutes);
```

---

## 3️⃣  نسخ الملفات

```bash
# من المجلد الذي حملت فيه الملفات:
cp admin.html    TaxiFinder-Backend/public/admin.html
cp admin.js      TaxiFinder-Backend/public/admin.js
cp admin_routes.js TaxiFinder-Backend/routes/admin.js
```

---

## 4️⃣  تشغيل المشروع

```bash
cd TaxiFinder-Backend
npm run dev
```

---

## 5️⃣  الدخول للوحة الأدمن

افتح المتصفح على:
```
http://localhost:3016/admin.html
```

ثم سجّل دخول بـ:
```
البريد:        admin@taxigo.ma
كلمة المرور:   TaxiGo@Admin2026
```

---

## ✅ الميزات المتوفرة

| الميزة | التفاصيل |
|--------|----------|
| 🔐 تسجيل دخول حقيقي | POST /api/admin/login → JWT 8 ساعات |
| 📊 إحصائيات حية | سائقون، ركاب، رحلات، مداخيل |
| 🗺️ خريطة حية | Leaflet + Socket.IO لتحديث مواقع السائقين |
| 📈 مخططات | Chart.js - رحلات يومية، أسبوعية، مداخيل |
| ✅ موافقة السائقين | قبول/رفض من الجدول أو بزر سريع |
| 🔒 تعطيل حسابات | تعطيل/تفعيل سائقين وركاب |
| 🔍 بحث | بحث في جميع الجداول |
| 📱 Responsive | يعمل على موبايل وتابلت |
| 🔌 Socket.IO | تحديث تلقائي عند تغيير حالة السائق |

---

## 🔒 الأمان

- التوكن يصلح **8 ساعات** ويُحفظ في `localStorage`
- جميع endpoints محمية بـ `requireAdmin` middleware
- كلمة المرور في `.env` فقط (لا تُحفظ في DB)
- JWT مستقل عن tokens المستخدمين العاديين (`ADMIN_SECRET`)
