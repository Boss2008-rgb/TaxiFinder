'use strict';

const Driver = require('../models/Driver');

// ══════════════════════════════════════════════════════════
//   GET /api/drivers/nearby
//
//   Phase 3: isPremium computed per-document.
//   Premium drivers are sorted to the TOP of the results list
//   so they appear first in both the map markers and sidebar.
// ══════════════════════════════════════════════════════════
async function getNearbyDrivers(req, res) {
    try {
        const lat    = parseFloat(req.query.lat);
        const lng    = parseFloat(req.query.lng);
        const radius = parseFloat(req.query.radius) || 5000;
        const type   = req.query.type || null;

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: '"lat" and "lng" query params are required' });
        }
        if (radius < 100 || radius > 50000) {
            return res.status(400).json({ error: '"radius" must be between 100 and 50,000 metres' });
        }

        const matchStage = {
            isApproved: true,
            isActive:   true,
            status:     'online',
            available:  true,
        };
        if (type) matchStage['vehicle.type'] = type;

        const drivers = await Driver.aggregate([
            {
                $geoNear: {
                    near:          { type: 'Point', coordinates: [lng, lat] },
                    distanceField: 'distanceMetres',
                    maxDistance:   radius,
                    spherical:     true,
                    query:         matchStage,
                },
            },
            {
                $project: {
                    passwordHash:      0,
                    refreshTokenHash:  0,
                    documents:         0,
                    'ratings.history': 0,
                    __v:               0,
                },
            },
            { $limit: 40 }, // fetch more before sorting by premium
        ]);

        const now = new Date();

        // Phase 3: compute isPremium per driver, sort premium first
        const results = drivers
            .map((d) => ({
                id:        d._id,
                fullName:  d.fullName,
                avatarUrl: d.avatarUrl,
                vehicle:   d.vehicle,
                ratings:   { average: d.ratings.average, count: d.ratings.count },
                status:    d.status,
                distanceKm: +(d.distanceMetres / 1000).toFixed(2),
                location: {
                    lat: d.location.coordinates[1],
                    lng: d.location.coordinates[0],
                },
                languagePreference: d.languagePreference,
                premium:   d.premium,
                // Computed field consumed by the frontend
                isPremium: !!(d.premium?.active && (!d.premium?.expiresAt || d.premium.expiresAt > now)),
            }))
            .sort((a, b) => {
                // Primary sort: premium first
                if (a.isPremium && !b.isPremium) return -1;
                if (!a.isPremium && b.isPremium) return  1;
                // Secondary sort: by distance
                return a.distanceKm - b.distanceKm;
            })
            .slice(0, 20);  // cap after sort

        res.json({ count: results.length, drivers: results });

    } catch (err) {
        console.error('[getNearbyDrivers]', err);
        res.status(500).json({ error: 'Failed to fetch nearby drivers' });
    }
}

// ══════════════════════════════════════════════════════════
//   GET /api/drivers/:id  — public driver profile
// ══════════════════════════════════════════════════════════
async function getDriverProfile(req, res) {
    try {
        const driver = await Driver.findById(req.params.id)
            .select('-passwordHash -refreshTokenHash -documents -__v');

        if (!driver || !driver.isApproved || !driver.isActive) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        const obj = driver.toPublicJSON();
        obj.isPremiumActive = driver.isPremiumActive; // virtual

        res.json(obj);

    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch driver profile' });
    }
}

// ══════════════════════════════════════════════════════════
//   PATCH /api/drivers/me/location
// ══════════════════════════════════════════════════════════
async function updateLocation(req, res) {
    try {
        const { lat, lng, bearing } = req.body;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return res.status(400).json({ error: 'lat and lng are required numbers' });
        }

        req.authUser.location = {
            type:        'Point',
            coordinates: [lng, lat],
        };
        req.authUser.locationUpdatedAt = new Date();
        await req.authUser.save();

        if (req.io) {
            req.io.emit('driver:location:update', {
                driverId: req.authUser._id,
                location: { lat, lng },
                bearing:  bearing || 0,
            });
        }

        res.json({ message: 'Location updated' });

    } catch (err) {
        console.error('[updateLocation]', err);
        res.status(500).json({ error: 'Failed to update location' });
    }
}

// ══════════════════════════════════════════════════════════
//   PATCH /api/drivers/me/availability
// ══════════════════════════════════════════════════════════
async function updateAvailability(req, res) {
    try {
        const { available, status } = req.body;

        if (!req.authUser.isApproved) {
            return res.status(403).json({ error: 'Account not yet approved' });
        }

        if (typeof available === 'boolean') req.authUser.available = available;
        if (status && ['offline', 'online', 'on_ride'].includes(status)) {
            req.authUser.status = status;
        }

        await req.authUser.save();

        if (req.io) {
            req.io.emit('driver:availability:update', {
                driverId:  req.authUser._id,
                available: req.authUser.available,
                status:    req.authUser.status,
            });
        }

        res.json({ available: req.authUser.available, status: req.authUser.status });

    } catch (err) {
        res.status(500).json({ error: 'Failed to update availability' });
    }
}

// ══════════════════════════════════════════════════════════
//   POST /api/drivers/me/premium  — Phase 3
//
//   Simulated payment activation.
//   In production you would call your PSP (CMI, PayZone, etc.)
//   here before setting isActive = true.
//
//   Expected body:  { plan: 'monthly' | 'quarterly' | 'annual' }
// ══════════════════════════════════════════════════════════
async function activatePremium(req, res) {
    try {
        const { plan = 'monthly' } = req.body;

        const validPlans = ['monthly', 'quarterly', 'annual'];
        if (!validPlans.includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan. Choose monthly, quarterly, or annual.' });
        }

        const durations = { monthly: 30, quarterly: 90, annual: 365 };
        const daysToAdd = durations[plan];

        const expiresAt = new Date(Date.now() + daysToAdd * 24 * 3600 * 1000);

        req.authUser.premium = {
            active:    true,
            plan,
            expiresAt,
        };
        await req.authUser.save();

        // Emit socket event so the client can update UI immediately
        if (req.io) {
            req.io.to(`user:${req.authUser._id}`).emit('driver:premium:activated', {
                driverId:  req.authUser._id,
                plan,
                expiresAt,
            });
        }

        res.json({
            message:   'Premium activated',
            plan,
            expiresAt,
            isPremium: true,
        });

    } catch (err) {
        console.error('[activatePremium]', err);
        res.status(500).json({ error: 'Failed to activate premium' });
    }
}

// ══════════════════════════════════════════════════════════
//   ADMIN: PATCH /api/drivers/:id/approve
// ══════════════════════════════════════════════════════════
async function approveDriver(req, res) {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        driver.isApproved = true;
        driver.approvedAt = new Date();
        driver.approvedBy = req.authUser._id;
        await driver.save();

        res.json({ message: `Driver ${driver.fullName} approved`, id: driver._id });

    } catch (err) {
        console.error('[approveDriver]', err);
        res.status(500).json({ error: 'Approval failed' });
    }
}

// ══════════════════════════════════════════════════════════
//   ADMIN: GET /api/drivers
// ══════════════════════════════════════════════════════════
async function listDrivers(req, res) {
    try {
        const { approved, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (approved !== undefined) filter.isApproved = approved === 'true';

        const skip    = (parseInt(page) - 1) * parseInt(limit);
        const total   = await Driver.countDocuments(filter);
        const drivers = await Driver.find(filter)
            .select('-passwordHash -refreshTokenHash -__v')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            total,
            page:  parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            drivers,
        });

    } catch (err) {
        res.status(500).json({ error: 'Failed to list drivers' });
    }
}

module.exports = {
    getNearbyDrivers,
    getDriverProfile,
    updateLocation,
    updateAvailability,
    activatePremium,
    approveDriver,
    listDrivers,
};
