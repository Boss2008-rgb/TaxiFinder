# 🚖 TaxiGo طنجة — دليل الإعداد الكامل

## 🔵 قاعدة البيانات المقترحة: Supabase

### لماذا Supabase؟
| الميزة | التفاصيل |
|--------|---------|
| **مجاني** | 500MB قاعدة بيانات، 50,000 مستخدم |
| **PostgreSQL** | قاعدة بيانات احترافية وموثوقة |
| **Real-time** | تحديثات فورية بدون إعداد |
| **REST API** | واجهة برمجية جاهزة تلقائياً |
| **أمان** | Row Level Security مدمج |

---

## 🚀 خطوات الإعداد

### 1. إنشاء مشروع Supabase

```bash
# اذهب إلى https://supabase.com
# اضغط "New Project"
# اختر اسم المشروع: taxigo-tanger
# احفظ كلمة المرور
```

### 2. تشغيل Schema قاعدة البيانات

في Supabase Dashboard → SQL Editor → انسخ محتوى `database-schema.sql` وشغّله

### 3. الحصول على مفاتيح API

```
Project Settings → API:
- SUPABASE_URL: https://xxxxx.supabase.co
- SUPABASE_SERVICE_KEY: eyJhbGci... (Service Role Key - سري!)
```

### 4. إعداد ملف البيئة

```bash
# أنشئ ملف .env في مجلد المشروع
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
PORT=3000
ALLOWED_ORIGIN=http://localhost:3000
```

### 5. تثبيت المكتبات وتشغيل المشروع

```bash
npm install
npm run dev   # وضع التطوير
npm start     # الإنتاج
```

---

## 📁 هيكل الملفات

```
taxigo/
├── index.html              # الواجهة الأمامية
├── style.css               # التصميم (أزرق طنجة)
├── app.js                  # منطق الواجهة الأمامية
├── server.js               # الخادم (Express + Socket.IO + Supabase)
├── package.json            # المكتبات
├── database-schema.sql     # هيكل قاعدة البيانات
├── .env                    # ⚠️ أضفه لـ .gitignore
└── .gitignore
```

## 🔧 ملف .gitignore

```
node_modules/
.env
*.log
.DS_Store
firebase-service-account.json
```

---

## 🗄️ هيكل قاعدة البيانات

### جدول `users` (المستخدمون)
| العمود | النوع | الوصف |
|--------|-------|-------|
| id | UUID | معرف فريد |
| name | TEXT | الاسم |
| phone | TEXT | الهاتف (فريد) |
| role | TEXT | rider / driver |

### جدول `drivers` (السائقون)
| العمود | النوع | الوصف |
|--------|-------|-------|
| car_model | TEXT | نوع السيارة |
| plate | TEXT | رقم اللوحة |
| car_type | TEXT | economy/comfort/vip |
| rating | NUMERIC | التقييم |
| location_lat/lng | NUMERIC | الموقع الجغرافي |
| available | BOOLEAN | متاح؟ |

### جدول `rides` (الرحلات)
| العمود | النوع | الوصف |
|--------|-------|-------|
| rider_id | UUID | معرف الراكب |
| driver_id | UUID | معرف السائق |
| pickup/dropoff | NUMERIC | إحداثيات |
| status | TEXT | pending/accepted/completed |
| fare | NUMERIC | الأجرة بالدرهم |

---

## 🌐 APIs المتاحة

| Method | Endpoint | الوصف |
|--------|---------|-------|
| POST | `/api/auth/login` | تسجيل الدخول/إنشاء مستخدم |
| GET | `/api/drivers/nearby` | السائقون القريبون |
| POST | `/api/rides` | إنشاء رحلة |
| GET | `/api/rides/:id` | تفاصيل رحلة |
| PATCH | `/api/rides/:id/status` | تحديث حالة الرحلة |
| GET | `/api/users/:id/rides` | سجل رحلات الراكب |
| POST | `/api/fare-estimate` | تقدير السعر |
| POST | `/api/ratings` | إرسال تقييم |
| GET | `/api/health` | حالة الخادم |

## 🔌 Socket.IO Events

| Event | الاتجاه | الوصف |
|-------|---------|-------|
| `register` | Client→Server | تسجيل المستخدم |
| `ride-request` | Rider→Server | طلب رحلة |
| `new-ride-request` | Server→Driver | طلب جديد للسائق |
| `ride-accepted` | Driver→Server | قبول الرحلة |
| `ride-status-update` | Server→Rider | تحديث حالة الرحلة |
| `driver-location-update` | Driver→Server | تحديث موقع السائق |

---

## 🛡️ الأمان المطبق

- ✅ **Helmet.js** — حماية HTTP headers
- ✅ **Rate Limiting** — 100 طلب/15 دقيقة
- ✅ **Input Sanitization** — تنظيف المدخلات
- ✅ **CORS** — تقييد النطاقات
- ✅ **Supabase RLS** — أمان على مستوى الصف
- ✅ **Validation** — التحقق من البيانات

---

## 🔵 لون طنجة

التصميم يعكس اللون الأزرق الفاتح المميز لسيارات الأجرة في طنجة:
- اللون الرئيسي: `#4FC3F7` (أزرق سماوي)
- خلفية داكنة: `#060d1a`
- مواقع طنجة الحقيقية في الخريطة

---

## ⚠️ ملاحظة أمنية

**لا تضع SUPABASE_SERVICE_KEY في الكود مباشرة!**
استخدم دائماً متغيرات البيئة (`.env`).
