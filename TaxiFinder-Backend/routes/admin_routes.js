'use strict';
/**
 * routes/admin.js — TaxiGo Admin API Routes
 *
 * Endpoints:
 *   POST   /api/admin/login
 *   GET    /api/admin/stats
 *   GET    /api/admin/feed
 *   GET    /api/admin/drivers
 *   PATCH  /api/admin/drivers/:id/approve
 *   PATCH  /api/admin/drivers/:id/status
 *   GET    /api/admin/riders
 *   PATCH  /api/admin/riders/:id/status
 *   GET    /api/admin/rides
 *   GET    /api/admin/chart/rides
 *   GET    /api/admin/chart/status
 *   GET    /api/admin/chart/weekly
 */

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const Driver  = require('../models/Driver');
const User    = require('../models/User');
const Ride    = require('../models/Ride');

// ═══════════════════════════════════════════
//  MIDDLEWARE: requireAdmin
// ═══════════════════════════════════════════
function requireAdmin(req, res, next) {
  const auth  = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'توكن مطلوب' });
  try {
    const payload = jwt.verify(token, process.env.ADMIN_SECRET || process.env.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('not admin');
    req.admin = payload;
    next();
  } catch {
    res.status(403).json({ error: 'غير مصرح — Admin only' });
  }
}

// ═══════════════════════════════════════════
//  POST /api/admin/login
// ═══════════════════════════════════════════
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass  = process.env.ADMIN_PASSWORD;
  const secret     = process.env.ADMIN_SECRET || process.env.JWT_SECRET;

  if (!adminEmail || !adminPass) {
    return res.status(500).json({ error: 'Admin credentials not configured in .env' });
  }

  if (email !== adminEmail || password !== adminPass) {
    return res.status(401).json({ error: 'بريد إلكتروني أو كلمة مرور غير صحيحة' });
  }

  const token = jwt.sign(
    { role: 'admin', email },
    secret,
    { expiresIn: '8h' }
  );

  res.json({ token, email });
});

// ═══════════════════════════════════════════
//  GET /api/admin/stats
// ═══════════════════════════════════════════
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [
      totalDrivers,
      approvedDrivers,
      pendingDrivers,
      onlineDrivers,
      totalUsers,
      activeRides,
      todayRides,
      totalEarningsAgg
    ] = await Promise.all([
      Driver.countDocuments(),
      Driver.countDocuments({ isApproved: true, isActive: true }),
      Driver.countDocuments({ isApproved: false, isActive: true }),
      Driver.countDocuments({ status: { $in: ['online', 'on_ride'] }, isActive: true }),
      User.countDocuments({ isActive: true }),
      Ride.countDocuments({ status: { $in: ['searching', 'open', 'driver_found', 'in_progress'] } }),
      Ride.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      Ride.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalFareMAD' } } }
      ])
    ]);

    const totalEarnings = totalEarningsAgg[0]?.total || 0;

    res.json({
      totalDrivers,
      approvedDrivers,
      pendingDrivers,
      onlineDrivers,
      totalUsers,
      activeRides,
      todayRides,
      totalEarnings: Math.round(totalEarnings),
      // Growth indicators (mock — replace with real comparison logic)
      earningsGrowth: 12,
      driversGrowth:  8,
      usersGrowth:    15,
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  GET /api/admin/feed  (recent activity)
// ═══════════════════════════════════════════
router.get('/feed', requireAdmin, async (req, res) => {
  try {
    const [recentRides, recentDrivers] = await Promise.all([
      Ride.find()
          .sort({ createdAt: -1 }).limit(5)
          .populate('driverId', 'fullName')
          .populate('passengers.userId', 'fullName')
          .lean(),
      Driver.find()
          .sort({ createdAt: -1 }).limit(3)
          .select('fullName createdAt isApproved')
          .lean()
    ]);

    const feed = [];

    recentRides.forEach(r => {
      const timeAgo = getTimeAgo(r.createdAt);
      const statusMap = {
        completed:  { color:'green',  icon:'fa-check-circle', label:'رحلة مكتملة' },
        cancelled:  { color:'red',    icon:'fa-times-circle', label:'رحلة ملغاة'  },
        in_progress:{ color:'blue',   icon:'fa-car',           label:'رحلة جارية'  },
        searching:  { color:'yellow', icon:'fa-search',        label:'يبحث عن سائق' },
      };
      const s = statusMap[r.status] || { color:'blue', icon:'fa-route', label:r.status };
      feed.push({
        color: s.color, icon: s.icon,
        text:  `${s.label}: ${r.totalFareMAD || 0} درهم`,
        time:  timeAgo
      });
    });

    recentDrivers.forEach(d => {
      feed.push({
        color: d.isApproved ? 'green' : 'yellow',
        icon:  d.isApproved ? 'fa-user-check' : 'fa-user-clock',
        text:  d.isApproved ? `سائق مفعّل: ${d.fullName}` : `طلب تسجيل جديد: ${d.fullName}`,
        time:  getTimeAgo(d.createdAt)
      });
    });

    // Sort by most recent
    res.json({ feed: feed.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  GET /api/admin/drivers
// ═══════════════════════════════════════════
router.get('/drivers', requireAdmin, async (req, res) => {
  try {
    const drivers = await Driver.find()
      .select('-passwordHash -refreshTokenHash -passwordResetToken -passwordResetExpiry')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ drivers, count: drivers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  PATCH /api/admin/drivers/:id/approve
// ═══════════════════════════════════════════
router.patch('/drivers/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { isApproved, isActive } = req.body;
    const update = { isApproved };
    if (isActive !== undefined) update.isActive = isActive;
    if (isApproved) update.approvedAt = new Date();

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, select: '-passwordHash -refreshTokenHash' }
    );
    if (!driver) return res.status(404).json({ error: 'السائق غير موجود' });
    res.json({ driver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  PATCH /api/admin/drivers/:id/status
// ═══════════════════════════════════════════
router.patch('/drivers/:id/status', requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, select: '-passwordHash -refreshTokenHash' }
    );
    if (!driver) return res.status(404).json({ error: 'السائق غير موجود' });
    res.json({ driver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  GET /api/admin/riders
// ═══════════════════════════════════════════
router.get('/riders', requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-passwordHash -refreshTokenHash -passwordResetToken -passwordResetExpiry')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ users, count: users.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  PATCH /api/admin/riders/:id/status
// ═══════════════════════════════════════════
router.patch('/riders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, select: '-passwordHash -refreshTokenHash' }
    );
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  GET /api/admin/rides
// ═══════════════════════════════════════════
router.get('/rides', requireAdmin, async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    const query = status ? { status } : {};
    const rides = await Ride.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('driverId', 'fullName phone')
      .populate('passengers.userId', 'fullName phone')
      .lean();
    res.json({ rides, count: rides.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  GET /api/admin/chart/rides?period=7d|30d
// ═══════════════════════════════════════════
router.get('/chart/rides', requireAdmin, async (req, res) => {
  try {
    const days   = req.query.period === '30d' ? 30 : 7;
    const since  = new Date();
    since.setDate(since.getDate() - days);

    const data = await Ride.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing days
    const labels = [];
    const values = [];
    const map = {};
    data.forEach(d => { map[d._id] = d.count; });

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key   = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' });
      labels.push(label);
      values.push(map[key] || 0);
    }

    res.json({ labels, values });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  GET /api/admin/chart/status
// ═══════════════════════════════════════════
router.get('/chart/status', requireAdmin, async (req, res) => {
  try {
    const [approved, pending, inactive] = await Promise.all([
      Driver.countDocuments({ isApproved: true, isActive: true }),
      Driver.countDocuments({ isApproved: false, isActive: true }),
      Driver.countDocuments({ isActive: false }),
    ]);
    res.json({ approved, pending, inactive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  GET /api/admin/chart/weekly
// ═══════════════════════════════════════════
router.get('/chart/weekly', requireAdmin, async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const data = await Ride.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dayOfWeek: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const map = {};
    data.forEach(d => { map[d._id] = d.count; });
    const values = [1,2,3,4,5,6,7].map(day => map[day] || 0);
    res.json({ values });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
//  HELPER: Time Ago
// ═══════════════════════════════════════════
function getTimeAgo(date) {
  if (!date) return '—';
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60)   return 'منذ لحظات';
  if (diff < 3600) return `منذ ${Math.floor(diff/60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff/3600)} ساعة`;
  return `منذ ${Math.floor(diff/86400)} يوم`;
}

module.exports = router;
