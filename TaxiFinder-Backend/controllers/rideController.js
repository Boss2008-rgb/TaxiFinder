'use strict';

const Ride   = require('../models/Ride');
const Driver = require('../models/Driver');
const { calculatePrivateFare, calculateSharedFare, haversineKm } = require('../utils/fareCalculator');

// ══════════════════════════════════════════════════════════
//   POST /api/rides  — Create a new ride request
// ══════════════════════════════════════════════════════════
async function createRide(req, res) {
    try {
        const {
            pickupLocation,
            dropoffLocation,
            type          = 'private',
            carType       = 'economy',
            paymentMethod = 'cash',
            scheduledAt,
        } = req.body;

        const userId = req.authUser._id;

        // Prevent double-booking: check for active ride
        const activeRide = await Ride.findOne({
            'passengers.userId': userId,
            'passengers.status': { $in: ['pending', 'confirmed', 'picked_up'] },
            status: { $nin: ['completed', 'cancelled'] },
        });
        if (activeRide) {
            return res.status(409).json({
                error: 'You already have an active ride',
                rideId: activeRide._id,
            });
        }

        // ── Estimate fare ────────────────────────────────
        const distKm  = haversineKm(pickupLocation, dropoffLocation);
        const estMin  = distKm * 3;   // rough estimate: 3 min/km in city traffic
        const isShared = type === 'shared';

        const { fareMAD, breakdown } = isShared
            ? calculateSharedFare(distKm, estMin, carType)
            : calculatePrivateFare(distKm, estMin, carType);

        // ── Max passengers from car type ─────────────────
        const capacityMap = { economy: 4, comfort: 4, vip: 4, grand_taxi: 6, minibus: 9 };
        const maxPassengers = isShared ? (capacityMap[carType] || 4) : 1;

        // ── Build origin/destination as GeoJSON ──────────
        const toGeoPoint = (loc) => ({
            type:        'Point',
            coordinates: [loc.lng, loc.lat],
            address:     loc.address || null,
        });

        const ride = await Ride.create({
            type,
            carType,
            maxPassengers,
            originLocation:      toGeoPoint(pickupLocation),
            destinationLocation: toGeoPoint(dropoffLocation),
            estimatedDistanceKm: +distKm.toFixed(2),
            estimatedDurationMin: Math.round(estMin),
            baseFareMAD: fareMAD,
            status: isShared ? 'open' : 'searching',
            scheduledAt: scheduledAt || null,
            passengers: [
                {
                    userId,
                    pickupLocation:  toGeoPoint(pickupLocation),
                    dropoffLocation: toGeoPoint(dropoffLocation),
                    fareMAD,
                    paymentMethod,
                    status: 'pending',
                },
            ],
        });

        ride.recalculateTotalFare();
        await ride.save();

        // Notify nearby available drivers via Socket.IO
        if (req.io) {
            const nearbyDrivers = await Driver.find({
                isApproved: true,
                isActive:   true,
                available:  true,
                status:     'online',
                location: {
                    $geoWithin: {
                        $centerSphere: [[pickupLocation.lng, pickupLocation.lat], 5 / 6371],
                    },
                },
                'vehicle.type': carType,
            }).select('_id');

            nearbyDrivers.forEach((d) => {
                req.io.to(`user:${d._id}`).emit('ride:new_request', {
                    rideId:     ride._id,
                    type:       ride.type,
                    carType:    ride.carType,
                    pickup:     pickupLocation,
                    dropoff:    dropoffLocation,
                    distKm:     ride.estimatedDistanceKm,
                    fareMAD,
                    passengerCount: 1,
                });
            });
        }

        res.status(201).json({
            rideId: ride._id,
            status: ride.status,
            estimatedFareMAD: fareMAD,
            fareBreakdown: breakdown,
            estimatedDistanceKm: ride.estimatedDistanceKm,
            estimatedDurationMin: ride.estimatedDurationMin,
        });

    } catch (err) {
        console.error('[createRide]', err);
        res.status(500).json({ error: 'Failed to create ride' });
    }
}

// ══════════════════════════════════════════════════════════
//   POST /api/rides/:rideId/join  — Join an open shared ride
// ══════════════════════════════════════════════════════════
async function joinSharedRide(req, res) {
    try {
        const { rideId }            = req.params;
        const { pickupLocation, dropoffLocation, paymentMethod = 'cash' } = req.body;
        const userId                = req.authUser._id;

        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });

        // addPassenger() validates type, status, and capacity
        const distKm = haversineKm(pickupLocation, dropoffLocation);
        const estMin = distKm * 3;
        const { fareMAD } = calculateSharedFare(distKm, estMin, ride.carType);

        const toGeoPoint = (loc) => ({
            type: 'Point',
            coordinates: [loc.lng, loc.lat],
            address: loc.address || null,
        });

        await ride.addPassenger({
            userId,
            pickupLocation:  toGeoPoint(pickupLocation),
            dropoffLocation: toGeoPoint(dropoffLocation),
            fareMAD,
            paymentMethod,
            status: 'confirmed',
        });

        ride.recalculateTotalFare();
        await ride.save();

        // Notify driver if already assigned
        if (ride.driverId && req.io) {
            req.io.to(`user:${ride.driverId}`).emit('ride:passenger_joined', {
                rideId:         ride._id,
                passengerId:    userId,
                passengerCount: ride.activePassengerCount,
                availableSeats: ride.availableSeats,
            });
        }

        res.json({
            rideId:         ride._id,
            fareMAD,
            availableSeats: ride.availableSeats,
            status:         'confirmed',
        });

    } catch (err) {
        // Capacity / state errors thrown by addPassenger() come here
        if (['Ride is at full capacity', 'Ride is not open', 'Cannot add a passenger'].some(
            (msg) => err.message.includes(msg)
        )) {
            return res.status(409).json({ error: err.message });
        }
        console.error('[joinSharedRide]', err);
        res.status(500).json({ error: 'Failed to join ride' });
    }
}

// ══════════════════════════════════════════════════════════
//   GET /api/rides/shared/available — List joinable shared rides
// ══════════════════════════════════════════════════════════
async function listAvailableSharedRides(req, res) {
    try {
        const lat     = parseFloat(req.query.lat);
        const lng     = parseFloat(req.query.lng);
        const radius  = parseFloat(req.query.radius) || 3000;
        const carType = req.query.carType;

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: 'lat and lng are required' });
        }

        const match = {
            type:   'shared',
            status: 'open',
        };
        if (carType) match.carType = carType;

        const rides = await Ride.aggregate([
            {
                $geoNear: {
                    near:          { type: 'Point', coordinates: [lng, lat] },
                    distanceField: 'pickupDistanceM',
                    maxDistance:   radius,
                    spherical:     true,
                    query:         match,
                    key:           'originLocation',
                },
            },
            {
                $project: {
                    type: 1, carType: 1, status: 1,
                    maxPassengers: 1,
                    activePassengerCount: { $size: {
                        $filter: {
                            input: '$passengers',
                            as: 'p',
                            cond: { $ne: ['$$p.status', 'cancelled'] },
                        },
                    }},
                    originLocation: 1, destinationLocation: 1,
                    estimatedDistanceKm: 1, estimatedDurationMin: 1,
                    pickupDistanceM: 1,
                    driverId: 1,
                },
            },
            {
                $addFields: {
                    availableSeats: { $subtract: ['$maxPassengers', '$activePassengerCount'] },
                },
            },
            { $match: { availableSeats: { $gt: 0 } } },
            { $sort: { pickupDistanceM: 1 } },
            { $limit: 10 },
        ]);

        res.json({ count: rides.length, rides });

    } catch (err) {
        console.error('[listAvailableSharedRides]', err);
        res.status(500).json({ error: 'Failed to list shared rides' });
    }
}

// ══════════════════════════════════════════════════════════
//   GET /api/rides/:rideId
// ══════════════════════════════════════════════════════════
async function getRide(req, res) {
    try {
        const ride = await Ride.findById(req.params.rideId)
            .populate('driverId', 'fullName vehicle ratings avatarUrl phone')
            .populate('passengers.userId', 'fullName avatarUrl ratings');

        if (!ride) return res.status(404).json({ error: 'Ride not found' });

        // Ensure the requesting user is a participant or admin
        const userId   = String(req.authUser._id);
        const isDriver = String(ride.driverId?._id) === userId;
        const isRider  = ride.passengers.some((p) => String(p.userId?._id || p.userId) === userId);
        const isAdmin  = req.authRole === 'admin';

        if (!isDriver && !isRider && !isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(ride);

    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch ride' });
    }
}

// ══════════════════════════════════════════════════════════
//   PATCH /api/rides/:rideId/accept  — Driver accepts ride
// ══════════════════════════════════════════════════════════
async function acceptRide(req, res) {
    try {
        const { rideId }  = req.params;
        const driverId    = req.authUser._id;

        const ride = await Ride.findOneAndUpdate(
            { _id: rideId, status: { $in: ['searching', 'open'] }, driverId: null },
            { driverId, status: 'driver_found', acceptedAt: new Date() },
            { new: true }
        );

        if (!ride) {
            return res.status(409).json({ error: 'Ride is no longer available' });
        }

        // Mark driver as on a ride
        await Driver.findByIdAndUpdate(driverId, { available: false, status: 'on_ride' });

        // Notify all passengers
        if (req.io) {
            ride.passengers.forEach((p) => {
                req.io.to(`user:${p.userId}`).emit('ride:driver_found', {
                    rideId:   ride._id,
                    driverId: driverId,
                });
            });
            req.io.to(`ride:${rideId}`).emit('ride:status_update', {
                rideId, status: 'driver_found',
            });
        }

        res.json({ rideId: ride._id, status: ride.status });

    } catch (err) {
        console.error('[acceptRide]', err);
        res.status(500).json({ error: 'Failed to accept ride' });
    }
}

// ══════════════════════════════════════════════════════════
//   PATCH /api/rides/:rideId/start  — Driver starts ride
// ══════════════════════════════════════════════════════════
async function startRide(req, res) {
    try {
        const ride = await Ride.findOneAndUpdate(
            { _id: req.params.rideId, driverId: req.authUser._id, status: 'driver_found' },
            { status: 'in_progress', startedAt: new Date() },
            { new: true }
        );

        if (!ride) return res.status(404).json({ error: 'Ride not found or cannot be started' });

        if (req.io) {
            req.io.to(`ride:${ride._id}`).emit('ride:status_update', {
                rideId: ride._id, status: 'in_progress',
            });
        }

        res.json({ rideId: ride._id, status: ride.status });

    } catch (err) {
        res.status(500).json({ error: 'Failed to start ride' });
    }
}

// ══════════════════════════════════════════════════════════
//   PATCH /api/rides/:rideId/complete  — Driver completes ride
// ══════════════════════════════════════════════════════════
async function completeRide(req, res) {
    try {
        const ride = await Ride.findOne({
            _id:      req.params.rideId,
            driverId: req.authUser._id,
            status:   'in_progress',
        });

        if (!ride) return res.status(404).json({ error: 'Ride not found or cannot be completed' });

        const { actualDistanceKm, actualDurationMin } = req.body;

        ride.status       = 'completed';
        ride.completedAt  = new Date();
        if (actualDistanceKm)  ride.actualDistanceKm  = actualDistanceKm;
        if (actualDurationMin) ride.actualDurationMin = actualDurationMin;

        // Mark all non-cancelled passengers as dropped off
        ride.passengers.forEach((p) => {
            if (p.status === 'picked_up' || p.status === 'confirmed') {
                p.status      = 'dropped_off';
                p.droppedOffAt = new Date();
                p.paymentStatus = 'paid';
            }
        });

        ride.recalculateTotalFare();
        await ride.save();

        // Free up the driver
        await Driver.findByIdAndUpdate(req.authUser._id, {
            available: true,
            status:    'online',
            $inc: {
                'stats.totalRides':     1,
                'stats.totalEarnedMAD': ride.totalFareMAD,
                'stats.totalKm':        actualDistanceKm || ride.estimatedDistanceKm,
            },
        });

        // Notify riders
        if (req.io) {
            req.io.to(`ride:${ride._id}`).emit('ride:completed', {
                rideId:       ride._id,
                totalFareMAD: ride.totalFareMAD,
            });
        }

        res.json({ rideId: ride._id, status: 'completed', totalFareMAD: ride.totalFareMAD });

    } catch (err) {
        console.error('[completeRide]', err);
        res.status(500).json({ error: 'Failed to complete ride' });
    }
}

// ══════════════════════════════════════════════════════════
//   PATCH /api/rides/:rideId/cancel  — Cancel ride
// ══════════════════════════════════════════════════════════
async function cancelRide(req, res) {
    try {
        const { rideId } = req.params;
        const { note }   = req.body;
        const userId     = String(req.authUser._id);
        const role       = req.authRole;

        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ error: 'Ride not found' });

        const cancellable = ['searching', 'open', 'driver_found'];
        if (!cancellable.includes(ride.status)) {
            return res.status(409).json({ error: `Cannot cancel a ${ride.status} ride` });
        }

        // Verify the canceller is a participant
        const isDriver = String(ride.driverId) === userId;
        const isRider  = ride.passengers.some((p) => String(p.userId) === userId);
        if (!isDriver && !isRider && role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        ride.status          = 'cancelled';
        ride.cancelledAt     = new Date();
        ride.cancelledBy     = role;
        ride.cancellationNote = note || null;
        ride.passengers.forEach((p) => {
            if (['pending', 'confirmed'].includes(p.status)) {
                p.status      = 'cancelled';
                p.cancelledAt = new Date();
            }
        });
        await ride.save();

        // Free driver if one was assigned
        if (ride.driverId) {
            await Driver.findByIdAndUpdate(ride.driverId, {
                available: true, status: 'online',
                $inc: { 'stats.cancellations': 1 },
            });
        }

        if (req.io) {
            req.io.to(`ride:${rideId}`).emit('ride:cancelled', { rideId, cancelledBy: role });
        }

        res.json({ rideId, status: 'cancelled' });

    } catch (err) {
        console.error('[cancelRide]', err);
        res.status(500).json({ error: 'Failed to cancel ride' });
    }
}

// ══════════════════════════════════════════════════════════
//   POST /api/rides/:rideId/rate  — Rate after ride
// ══════════════════════════════════════════════════════════
async function rateRide(req, res) {
    try {
        const { rideId }           = req.params;
        const { score, comment }   = req.body;
        const userId               = req.authUser._id;
        const role                 = req.authRole;

        const ride = await Ride.findById(rideId);
        if (!ride || ride.status !== 'completed') {
            return res.status(404).json({ error: 'Completed ride not found' });
        }

        if (role === 'rider') {
            const slot = ride.passengers.find((p) => String(p.userId) === String(userId));
            if (!slot) return res.status(403).json({ error: 'Not a passenger on this ride' });
            if (slot.ratingGiven.score) return res.status(409).json({ error: 'Already rated' });

            slot.ratingGiven = { score, comment };
            await ride.save();

            const Driver = require('../models/Driver');
            const driver = await Driver.findById(ride.driverId);
            if (driver) await driver.addRating(score, userId, rideId, comment);

        } else if (role === 'driver') {
            if (String(ride.driverId) !== String(userId)) {
                return res.status(403).json({ error: 'Not the driver of this ride' });
            }
            // Rate the first (or only) non-cancelled passenger
            const slot = ride.passengers.find((p) => p.status !== 'cancelled');
            if (!slot) return res.status(404).json({ error: 'No passenger to rate' });
            if (slot.ratingReceived.score) return res.status(409).json({ error: 'Already rated' });

            slot.ratingReceived = { score, comment };
            await ride.save();

            const User = require('../models/User');
            const user = await User.findById(slot.userId);
            if (user) await user.addRating(score, userId, rideId, comment);
        }

        res.json({ message: 'Rating submitted' });

    } catch (err) {
        console.error('[rateRide]', err);
        res.status(500).json({ error: 'Failed to submit rating' });
    }
}

// ══════════════════════════════════════════════════════════
//   GET /api/rides/history  — Authenticated user's ride history
// ══════════════════════════════════════════════════════════
async function getRideHistory(req, res) {
    try {
        const page    = parseInt(req.query.page)  || 1;
        const limit   = parseInt(req.query.limit) || 10;
        const userId  = req.authUser._id;
        const role    = req.authRole;

        const filter = role === 'driver'
            ? { driverId: userId }
            : { 'passengers.userId': userId };

        const total = await Ride.countDocuments(filter);
        const rides = await Ride.find(filter)
            .populate('driverId', 'fullName vehicle avatarUrl')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ total, page, pages: Math.ceil(total / limit), rides });

    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch ride history' });
    }
}

module.exports = {
    createRide,
    joinSharedRide,
    listAvailableSharedRides,
    getRide,
    acceptRide,
    startRide,
    completeRide,
    cancelRide,
    rateRide,
    getRideHistory,
};
