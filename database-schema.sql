-- ============================================================
--   TaxiGo — Supabase (PostgreSQL) Schema
--   قاعدة البيانات الكاملة
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
--   جدول المستخدمين
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL CHECK (role IN ('rider', 'driver')),
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--   جدول السائقين
-- ============================================================
CREATE TABLE IF NOT EXISTS drivers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    car_model       TEXT NOT NULL,
    plate           TEXT NOT NULL UNIQUE,
    car_type        TEXT NOT NULL CHECK (car_type IN ('economy', 'comfort', 'vip')),
    rating          NUMERIC(3,2) DEFAULT 5.00,
    total_trips     INTEGER DEFAULT 0,
    available       BOOLEAN DEFAULT false,
    status          TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
    location_lat    NUMERIC(10,7),
    location_lng    NUMERIC(10,7),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--   جدول الرحلات
-- ============================================================
CREATE TABLE IF NOT EXISTS rides (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id            UUID NOT NULL REFERENCES users(id),
    driver_id           UUID REFERENCES drivers(id),
    pickup_lat          NUMERIC(10,7) NOT NULL,
    pickup_lng          NUMERIC(10,7) NOT NULL,
    pickup_address      TEXT,
    dropoff_lat         NUMERIC(10,7) NOT NULL,
    dropoff_lng         NUMERIC(10,7) NOT NULL,
    dropoff_address     TEXT NOT NULL,
    car_type            TEXT DEFAULT 'economy',
    payment_method      TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card')),
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','in_progress','completed','cancelled')),
    fare                NUMERIC(8,2),
    distance_km         NUMERIC(6,2),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ
);

-- ============================================================
--   جدول التقييمات
-- ============================================================
CREATE TABLE IF NOT EXISTS ratings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id     UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    driver_id   UUID NOT NULL REFERENCES drivers(id),
    rider_id    UUID NOT NULL REFERENCES users(id),
    score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--   جدول أرباح السائق
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_earnings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id   UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    ride_id     UUID REFERENCES rides(id),
    amount      NUMERIC(8,2) NOT NULL,
    earned_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--   Indexes لتحسين الأداء
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(available, status);
CREATE INDEX IF NOT EXISTS idx_rides_rider ON rides(rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_earnings_driver ON driver_earnings(driver_id, earned_at DESC);

-- ============================================================
--   Row Level Security (RLS) - الأمان على مستوى الصف
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;

-- سياسة: المستخدم يرى بياناته فقط
CREATE POLICY "users_own_data" ON users FOR ALL USING (true);
CREATE POLICY "drivers_public_read" ON drivers FOR SELECT USING (true);
CREATE POLICY "drivers_own_write" ON drivers FOR ALL USING (true);
CREATE POLICY "rides_own_data" ON rides FOR ALL USING (true);
CREATE POLICY "ratings_public_read" ON ratings FOR SELECT USING (true);
CREATE POLICY "ratings_own_write" ON ratings FOR INSERT USING (true);
CREATE POLICY "earnings_own_data" ON driver_earnings FOR ALL USING (true);

-- ============================================================
--   بيانات تجريبية لطنجة
-- ============================================================
INSERT INTO users (id, name, phone, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'أحمد الطنجاوي', '+212661234567', 'driver'),
    ('22222222-2222-2222-2222-222222222222', 'محمد البقالي',  '+212662345678', 'driver'),
    ('33333333-3333-3333-3333-333333333333', 'يوسف الريفي',   '+212663456789', 'driver'),
    ('44444444-4444-4444-4444-444444444444', 'كريم الزياني',  '+212664567890', 'driver'),
    ('55555555-5555-5555-5555-555555555555', 'فاطمة الحسني',  '+212665678901', 'rider')
ON CONFLICT DO NOTHING;

INSERT INTO drivers (user_id, car_model, plate, car_type, rating, total_trips, available, status, location_lat, location_lng) VALUES
    ('11111111-1111-1111-1111-111111111111', 'تويوتا كورولا 2023', '1234 أ', 'economy', 4.90, 1240, true,  'online',  35.7767, -5.8037),
    ('22222222-2222-2222-2222-222222222222', 'هيونداي سوناتا 2022','5678 ب', 'comfort', 4.80, 832,  true,  'online',  35.7700, -5.7900),
    ('33333333-3333-3333-3333-333333333333', 'مرسيدس E200 2024',   '9012 ج', 'vip',     5.00, 2100, true,  'online',  35.7850, -5.8150),
    ('44444444-4444-4444-4444-444444444444', 'داسيا لوغان 2022',   '3456 د', 'economy', 4.70, 560,  false, 'offline', 35.7600, -5.8200)
ON CONFLICT DO NOTHING;
