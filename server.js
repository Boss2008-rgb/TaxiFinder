// ============================================================
//   TaxiGo — server.js (Supabase + Express + Socket.IO)
//   Node.js Backend with Full CRUD & Security
// ============================================================

'use strict';

const express      = require('express');
const cors         = require('cors');
const http         = require('http');
const path         = require('path');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const { Server }   = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
//   Bootstrap
// ============================================================
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGIN || '*',
        methods: ['GET', 'POST', 'PATCH', 'DELETE']
    },
    pingTimeout:  30000,
    pingInterval: 10000
});

// ============================================================
//   Supabase Client
// ============================================================
const SUPABASE_URL  = process.env.SUPABASE_URL  || '';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase connected');
} else {
    console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY not set — using in-memory fallback');
}

// ============================================================
//   In-Memory Fallback (Demo Mode)
// ============================================================
const memDB = {
    users:   new Map(),
    drivers: new Map([
        ['drv_001', { id:'drv_001', user_id:'u1', name:'أحمد الطنجاوي', car_model:'تويوتا كورولا 2023', plate:'1234 أ', car_type:'economy', rating:4.9, total_trips:1240, available:true,  status:'online',  location_lat:35.7767, location_lng:-5.8037 }],
        ['drv_002', { id:'drv_002', user_id:'u2', name:'محمد البقالي',   car_model:'هيونداي سوناتا 2022', plate:'5678 ب', car_type:'comfort', rating:4.8, total_trips:832,  available:true,  status:'online',  location_lat:35.7700, location_lng:-5.7900 }],
        ['drv_003', { id:'drv_003', user_id:'u3', name:'يوسف الريفي',    car_model:'مرسيدس E200 2024',   plate:'9012 ج', car_type:'vip',     rating:5.0, total_trips:2100, available:true,  status:'online',  location_lat:35.7850, location_lng:-5.8150 }],
        ['drv_004', { id:'drv_004', user_id:'u4', name:'كريم الزياني',   car_model:'داسيا لوغان 2022',   plate:'3456 د', car_type:'economy', rating:4.7, total_trips:560,  available:false, status:'offline', location_lat:35.7600, location_lng:-5.8200 }],
    ]),
    rides:   new Map(),
    ratings: new Map(),
    sockets: new Map()   // userId → socketId
};

// ============================================================
//   Utility: Haversine Distance (metres)
// ============================================================
function haversine(loc1, loc2) {
    if (!loc1 || !loc2) return Infinity;
    const R  = 6_371_000;
    const φ1 = (loc1.lat * Math.PI) / 180;
    const φ2 = (loc2.lat * Math.PI) / 180;
    const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;
    const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcFare(distKm, carType) {
    const rates = { economy: 4, comfort: 6, vip: 12 };
    const base  = { economy: 8, comfort: 12, vip: 20 };
    const rate  = rates[carType] || 4;
    const b     = base[carType]  || 8;
    return Math.round(b + distKm * rate);
}

// ============================================================
//   Security Middleware
// ============================================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname)));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Request logger
app.use((req, _res, next) => {
    if (req.path !== '/api/health') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
});

// Input sanitizer helper
function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str.trim().replace(/<[^>]*>/g, '').substring(0, 500);
}

// ============================================================
//   DB Helpers (Supabase or Memory fallback)
// ============================================================

async function dbGetDrivers(pickupLat, pickupLng, radiusM = 5000) {
    const loc = { lat: pickupLat, lng: pickupLng };
    if (supabase) {
        const { data, error } = await supabase
            .from('drivers')
            .select(`*, users(name, phone)`)
            .eq('available', true)
            .eq('status', 'online');
        if (error) throw error;
        return (data || []).filter(d =>
            haversine(loc, { lat: d.location_lat, lng: d.location_lng }) <= radiusM
        ).map(d => ({
            ...d,
            name: d.users?.name,
            distanceKm: +(haversine(loc, { lat: d.location_lat, lng: d.location_lng }) / 1000).toFixed(2)
        }));
    }
    return [...memDB.drivers.values()]
        .filter(d => d.available && d.status === 'online')
        .filter(d => haversine(loc, { lat: d.location_lat, lng: d.location_lng }) <= radiusM)
        .map(d => ({ ...d, distanceKm: +(haversine(loc, { lat: d.location_lat, lng: d.location_lng }) / 1000).toFixed(2) }));
}

async function dbCreateUser(name, phone, role) {
    if (supabase) {
        const { data, error } = await supabase
            .from('users')
            .upsert({ name, phone, role }, { onConflict: 'phone', ignoreDuplicates: false })
            .select().single();
        if (error) throw error;
        return data;
    }
    const existing = [...memDB.users.values()].find(u => u.phone === phone);
    if (existing) return { ...existing, name, role };
    const id = `usr_${Date.now()}`;
    const user = { id, name, phone, role, created_at: new Date().toISOString() };
    memDB.users.set(id, user);
    return user;
}

async function dbRegisterDriver(userId, carModel, plate, carType) {
    if (supabase) {
        const { data, error } = await supabase
            .from('drivers')
            .upsert({ user_id: userId, car_model: carModel, plate, car_type: carType, available: false, status: 'offline' }, { onConflict: 'plate' })
            .select().single();
        if (error) throw error;
        return data;
    }
    const existing = [...memDB.drivers.values()].find(d => d.user_id === userId);
    if (existing) return existing;
    const id = `drv_${Date.now()}`;
    const driver = { id, user_id: userId, car_model: carModel, plate, car_type: carType, rating: 5.0, total_trips: 0, available: false, status: 'offline' };
    memDB.drivers.set(id, driver);
    return driver;
}

async function dbCreateRide(rideData) {
    if (supabase) {
        const { data, error } = await supabase.from('rides').insert(rideData).select().single();
        if (error) throw error;
        return data;
    }
    const id = `ride_${Date.now()}`;
    const ride = { id, ...rideData, created_at: new Date().toISOString() };
    memDB.rides.set(id, ride);
    return ride;
}

async function dbGetRide(rideId) {
    if (supabase) {
        const { data, error } = await supabase.from('rides').select('*, users(name,phone)').eq('id', rideId).single();
        if (error) throw error;
        return data;
    }
    return memDB.rides.get(rideId) || null;
}

async function dbUpdateRide(rideId, update) {
    if (supabase) {
        const { data, error } = await supabase.from('rides').update(update).eq('id', rideId).select().single();
        if (error) throw error;
        return data;
    }
    const ride = memDB.rides.get(rideId);
    if (!ride) return null;
    const updated = { ...ride, ...update };
    memDB.rides.set(rideId, updated);
    return updated;
}

async function dbGetUserRides(userId) {
    if (supabase) {
        const { data, error } = await supabase
            .from('rides')
            .select('*')
            .eq('rider_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw error;
        return data || [];
    }
    return [...memDB.rides.values()].filter(r => r.rider_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
}

async function dbGetDriverRides(driverId) {
    if (supabase) {
        const { data, error } = await supabase
            .from('rides')
            .select('*')
            .eq('driver_id', driverId)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw error;
        return data || [];
    }
    return [...memDB.rides.values()].filter(r => r.driver_id === driverId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
}

async function dbCreateRating(ratingData) {
    if (supabase) {
        const { data, error } = await supabase.from('ratings').insert(ratingData).select().single();
        if (error) throw error;
        // Update driver average rating
        const { data: ratings } = await supabase.from('ratings').select('score').eq('driver_id', ratingData.driver_id);
        if (ratings && ratings.length) {
            const avg = ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
            await supabase.from('drivers').update({ rating: avg.toFixed(2) }).eq('id', ratingData.driver_id);
        }
        return data;
    }
    const id = `rat_${Date.now()}`;
    const rating = { id, ...ratingData, created_at: new Date().toISOString() };
    memDB.ratings.set(id, rating);
    return rating;
}

async function dbUpdateDriverStatus(driverId, status, available, lat, lng) {
    const update = { status, available, updated_at: new Date().toISOString() };
    if (lat !== undefined) update.location_lat = lat;
    if (lng !== undefined) update.location_lng = lng;

    if (supabase) {
        const { error } = await supabase.from('drivers').update(update).eq('id', driverId);
        if (error) console.error('[DB] driver status update:', error.message);
    } else {
        const d = memDB.drivers.get(driverId);
        if (d) memDB.drivers.set(driverId, { ...d, ...update });
    }
}

async function dbGetDriverEarnings(driverId) {
    if (supabase) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { data } = await supabase
            .from('driver_earnings')
            .select('amount, earned_at')
            .eq('driver_id', driverId)
            .gte('earned_at', sevenDaysAgo)
            .order('earned_at', { ascending: true });
        return data || [];
    }
    return [];
}

// ============================================================
//   Socket.IO
// ============================================================
io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on('register', ({ userId, role, driverId }) => {
        if (!userId) return;
        memDB.sockets.set(userId, socket.id);
        socket.join(role === 'driver' ? `driver_${driverId || userId}` : `rider_${userId}`);
        console.log(`[Socket] Registered ${role}: ${userId}`);
    });

    socket.on('driver-location-update', async (data) => {
        const { driverId, lat, lng, status = 'online', available = true } = data;
        if (!driverId) return;
        await dbUpdateDriverStatus(driverId, status, available, lat, lng);
        socket.broadcast.emit('driver-moved', { driverId, lat, lng });
    });

    socket.on('driver-status-change', async ({ driverId, status, available }) => {
        await dbUpdateDriverStatus(driverId, status, available);
        io.emit('driver-availability-update', { driverId, status, available });
    });

    socket.on('ride-request', async (rideData) => {
        const { riderId, pickupLat, pickupLng, dropoffAddress, carType } = rideData;
        if (!riderId || !pickupLat) return;
        try {
            const distKm = haversine({ lat: pickupLat, lng: pickupLng }, { lat: rideData.dropoffLat, lng: rideData.dropoffLng }) / 1000;
            const fare = calcFare(distKm, carType);
            const ride = await dbCreateRide({
                rider_id: riderId, status: 'pending',
                pickup_lat: pickupLat, pickup_lng: pickupLng,
                pickup_address: rideData.pickupAddress,
                dropoff_lat: rideData.dropoffLat, dropoff_lng: rideData.dropoffLng,
                dropoff_address: dropoffAddress,
                car_type: carType || 'economy',
                payment_method: rideData.paymentMethod || 'cash',
                fare, distance_km: +distKm.toFixed(2)
            });
            const nearby = await dbGetDrivers(pickupLat, pickupLng);
            nearby.forEach(d => io.to(`driver_${d.id}`).emit('new-ride-request', { rideId: ride.id, ...ride, riderName: rideData.riderName }));
            socket.emit('ride-created', { rideId: ride.id, fare, distanceKm: +distKm.toFixed(2) });
        } catch (err) {
            console.error('[Socket] ride-request error:', err.message);
            socket.emit('error', { message: 'فشل إنشاء الرحلة' });
        }
    });

    socket.on('ride-accepted', async ({ rideId, driverId, driverName }) => {
        const ride = await dbUpdateRide(rideId, { driver_id: driverId, status: 'accepted', accepted_at: new Date().toISOString() });
        if (ride) {
            const riderSock = memDB.sockets.get(ride.rider_id);
            if (riderSock) io.to(riderSock).emit('ride-status-update', { rideId, status: 'accepted', driverId, driverName });
        }
    });

    socket.on('ride-completed', async ({ rideId, driverId, fare }) => {
        await dbUpdateRide(rideId, { status: 'completed', fare, completed_at: new Date().toISOString() });
        if (supabase && driverId) {
            await supabase.from('driver_earnings').insert({ driver_id: driverId, ride_id: rideId, amount: fare });
            const { data: d } = await supabase.from('drivers').select('total_trips').eq('id', driverId).single();
            if (d) await supabase.from('drivers').update({ total_trips: (d.total_trips || 0) + 1 }).eq('id', driverId);
        }
        io.emit('ride-status-update', { rideId, status: 'completed', fare });
    });

    socket.on('disconnect', (reason) => {
        for (const [uid, sid] of memDB.sockets) {
            if (sid === socket.id) { memDB.sockets.delete(uid); break; }
        }
    });
});

// ============================================================
//   REST API
// ============================================================

// ── Health ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: supabase ? 'supabase' : 'memory', uptime: process.uptime() });
});

// ── Auth / Login ─────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
    try {
        const name  = sanitize(req.body.name);
        const phone = sanitize(req.body.phone);
        const role  = req.body.role;

        if (!name || !phone || !['rider','driver'].includes(role)) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }
        if (!/^\+?[\d\s\-]{8,20}$/.test(phone)) {
            return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
        }

        const user = await dbCreateUser(name, phone, role);
        let driver = null;

        if (role === 'driver') {
            const carModel = sanitize(req.body.carModel);
            const plate    = sanitize(req.body.plate);
            const carType  = req.body.carType || 'economy';
            if (!carModel || !plate) return res.status(400).json({ error: 'بيانات السائق ناقصة' });
            driver = await dbRegisterDriver(user.id, carModel, plate, carType);
        }

        res.json({ success: true, user, driver });
    } catch (err) {
        console.error('[POST /auth/login]', err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── Nearby Drivers ───────────────────────────────────────────
app.get('/api/drivers/nearby', async (req, res) => {
    try {
        const lat    = parseFloat(req.query.lat);
        const lng    = parseFloat(req.query.lng);
        const radius = parseFloat(req.query.radius) || 5000;
        if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat و lng مطلوبان' });
        const drivers = await dbGetDrivers(lat, lng, radius);
        res.json({ count: drivers.length, drivers });
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── All Drivers (for admin) ───────────────────────────────────
app.get('/api/drivers', async (req, res) => {
    try {
        if (supabase) {
            const { data, error } = await supabase.from('drivers').select('*, users(name, phone)');
            if (error) throw error;
            return res.json(data || []);
        }
        res.json([...memDB.drivers.values()]);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── Create Ride ───────────────────────────────────────────────
app.post('/api/rides', async (req, res) => {
    try {
        const { riderId, pickupLat, pickupLng, dropoffLat, dropoffLng, dropoffAddress, carType, paymentMethod } = req.body;
        if (!riderId || pickupLat == null || dropoffLat == null || !dropoffAddress) {
            return res.status(400).json({ error: 'بيانات الرحلة ناقصة' });
        }
        const distKm = haversine({ lat: pickupLat, lng: pickupLng }, { lat: dropoffLat, lng: dropoffLng }) / 1000;
        const fare   = calcFare(distKm, carType);
        const ride   = await dbCreateRide({
            rider_id: riderId, status: 'pending',
            pickup_lat: pickupLat, pickup_lng: pickupLng,
            pickup_address: sanitize(req.body.pickupAddress),
            dropoff_lat: dropoffLat, dropoff_lng: dropoffLng,
            dropoff_address: sanitize(dropoffAddress),
            car_type: carType || 'economy',
            payment_method: paymentMethod || 'cash',
            fare, distance_km: +distKm.toFixed(2)
        });
        const nearby = await dbGetDrivers(pickupLat, pickupLng);
        nearby.forEach(d => io.to(`driver_${d.id}`).emit('new-ride-request', { rideId: ride.id, ...ride }));
        res.status(201).json(ride);
    } catch (err) {
        console.error('[POST /rides]', err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── Get Ride ──────────────────────────────────────────────────
app.get('/api/rides/:rideId', async (req, res) => {
    try {
        const ride = await dbGetRide(req.params.rideId);
        if (!ride) return res.status(404).json({ error: 'الرحلة غير موجودة' });
        res.json(ride);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── Update Ride Status ────────────────────────────────────────
app.patch('/api/rides/:rideId/status', async (req, res) => {
    try {
        const { status, driverId, fare } = req.body;
        const allowed = ['pending','accepted','in_progress','completed','cancelled'];
        if (!allowed.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });
        const update = { status, updated_at: new Date().toISOString() };
        if (driverId) update.driver_id = driverId;
        if (fare !== undefined) update.fare = fare;
        if (status === 'completed') update.completed_at = new Date().toISOString();
        const ride = await dbUpdateRide(req.params.rideId, update);
        if (!ride) return res.status(404).json({ error: 'الرحلة غير موجودة' });
        io.emit('ride-status-update', { rideId: req.params.rideId, ...update });
        res.json(ride);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── User Ride History ─────────────────────────────────────────
app.get('/api/users/:userId/rides', async (req, res) => {
    try {
        const rides = await dbGetUserRides(req.params.userId);
        res.json(rides);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── Driver Ride History ───────────────────────────────────────
app.get('/api/drivers/:driverId/rides', async (req, res) => {
    try {
        const rides = await dbGetDriverRides(req.params.driverId);
        res.json(rides);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── Driver Earnings ───────────────────────────────────────────
app.get('/api/drivers/:driverId/earnings', async (req, res) => {
    try {
        const earnings = await dbGetDriverEarnings(req.params.driverId);
        res.json(earnings);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── Submit Rating ─────────────────────────────────────────────
app.post('/api/ratings', async (req, res) => {
    try {
        const { rideId, driverId, riderId, score, comment } = req.body;
        if (!rideId || !driverId || !riderId || !score) return res.status(400).json({ error: 'بيانات التقييم ناقصة' });
        if (score < 1 || score > 5) return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5' });
        const rating = await dbCreateRating({ ride_id: rideId, driver_id: driverId, rider_id: riderId, score, comment: sanitize(comment) });
        res.status(201).json(rating);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ── Fare Estimate ─────────────────────────────────────────────
app.post('/api/fare-estimate', (req, res) => {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, carType } = req.body;
    if (pickupLat == null || dropoffLat == null) return res.status(400).json({ error: 'الإحداثيات مطلوبة' });
    const distKm = haversine({ lat: pickupLat, lng: pickupLng }, { lat: dropoffLat, lng: dropoffLng }) / 1000;
    res.json({
        distanceKm: +distKm.toFixed(2),
        fare: { economy: calcFare(distKm, 'economy'), comfort: calcFare(distKm, 'comfort'), vip: calcFare(distKm, 'vip') }
    });
});

// SPA fallback
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler
app.use((err, _req, res, _next) => {
    console.error('[Unhandled Error]', err);
    res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

// ============================================================
//   Start
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚖 TaxiGo Server  →  http://localhost:${PORT}`);
    console.log(`📦 Database       →  ${supabase ? 'Supabase PostgreSQL' : 'In-Memory (demo)'}`);
    console.log(`🔌 Socket.IO      →  enabled`);
    console.log(`🛡️  Security       →  helmet + rate-limit + CORS\n`);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    server.close(() => process.exit(0));
});
