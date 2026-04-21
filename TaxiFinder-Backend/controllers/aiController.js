'use strict';

/**
 * controllers/aiController.js
 *
 * Three Grok-powered endpoints:
 *
 *   POST /api/ai/route    — smart routing suggestion
 *   POST /api/ai/split    — shared ride fare split
 *   POST /api/ai/chat     — AI assistant conversation
 *
 * All endpoints:
 *   • require authentication (requireAuth)
 *   • sanitise inputs before forwarding to Grok
 *   • return a consistent { success, data } shape on success
 *   • never expose raw Grok error messages to clients
 */

const grok            = require('../utils/grok');
const { splitSharedFare, haversineKm } = require('../utils/fareCalculator');
const Ride            = require('../models/Ride');

// ── Helper: safe user context from req ────────────────────
function userCtx(req) {
    return {
        lang:     req.authUser?.languagePreference || 'ar',
        userName: req.authUser?.fullName           || '',
        role:     req.authRole                     || 'rider',
    };
}

// ══════════════════════════════════════════════════════════
//   POST /api/ai/route
//
//   Body: {
//     pickup:  { lat, lng, address? }
//     dropoff: { lat, lng, address? }
//   }
//
//   Returns: {
//     success: true,
//     data: { route, distanceKm, durationMin, traffic, reason }
//   }
// ══════════════════════════════════════════════════════════
async function getSmartRoute(req, res) {
    try {
        const { pickup, dropoff } = req.body;

        // Basic validation (express-validator handles deeper checks in routes/ai.js)
        if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
            return res.status(400).json({ error: 'pickup and dropoff with lat/lng are required' });
        }

        const ctx   = userCtx(req);
        const result = await grok.suggestRoute(pickup, dropoff, {
            lang:      ctx.lang,
            timeOfDay: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        });

        // Sanity-clamp AI output so the UI never shows absurd numbers
        if (result.distanceKm > 200)  result.distanceKm  = 200;
        if (result.durationMin > 480) result.durationMin = 480;

        res.json({ success: true, data: result });

    } catch (err) {
        console.error('[AI route]', err.message);
        res.status(err.message.includes('API key') ? 503 : 500).json({
            error: err.message || 'AI route suggestion failed',
        });
    }
}

// ══════════════════════════════════════════════════════════
//   POST /api/ai/split
//
//   Body: {
//     rideId: string    (optional — if provided, pulls real passenger data)
//     passengers?: [    (used when rideId is absent / testing)
//       { userId, name, pickupLat, pickupLng, dropoffLat, dropoffLng }
//     ]
//   }
//
//   Returns: {
//     success: true,
//     data: [{ name, fareMAD, proportion, note }]
//   }
// ══════════════════════════════════════════════════════════
async function getFareSplit(req, res) {
    try {
        const { rideId, passengers: inlinePassengers } = req.body;
        const ctx = userCtx(req);

        let segments = [];
        let carType  = 'grand_taxi';

        if (rideId) {
            // Pull real ride data from DB
            const ride = await Ride.findById(rideId)
                .populate('passengers.userId', 'fullName');

            if (!ride) return res.status(404).json({ error: 'Ride not found' });
            if (ride.type !== 'shared') {
                return res.status(400).json({ error: 'Fare split only applies to shared rides' });
            }

            // Verify requester is a participant or admin
            const uid      = String(req.authUser._id);
            const isDriver = String(ride.driverId) === uid;
            const isRider  = ride.passengers.some((p) => String(p.userId?._id || p.userId) === uid);
            if (!isDriver && !isRider && req.authRole !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }

            carType = ride.carType || 'grand_taxi';

            segments = ride.passengers
                .filter((p) => p.status !== 'cancelled')
                .map((p) => ({
                    userId:  String(p.userId?._id || p.userId),
                    name:    p.userId?.fullName || 'Passenger',
                    distKm:  haversineKm(
                        { lat: p.pickupLocation.coordinates[1],  lng: p.pickupLocation.coordinates[0] },
                        { lat: p.dropoffLocation.coordinates[1], lng: p.dropoffLocation.coordinates[0] }
                    ),
                }));

        } else if (Array.isArray(inlinePassengers) && inlinePassengers.length >= 2) {
            segments = inlinePassengers.map((p) => ({
                userId:  p.userId  || 'unknown',
                name:    p.name    || 'Passenger',
                distKm:  haversineKm(
                    { lat: p.pickupLat,  lng: p.pickupLng  },
                    { lat: p.dropoffLat, lng: p.dropoffLng }
                ),
            }));
        } else {
            return res.status(400).json({ error: 'Provide either rideId or at least 2 passengers' });
        }

        // Get base fare calculations first, then let Grok refine them
        const baseSplits = splitSharedFare(segments, carType);
        const enriched   = baseSplits.map((s) => ({
            ...s,
            name: segments.find((p) => p.userId === s.userId)?.name || 'Passenger',
        }));

        const result = await grok.splitFare(enriched, { carType, lang: ctx.lang });

        res.json({ success: true, data: result });

    } catch (err) {
        console.error('[AI split]', err.message);
        res.status(500).json({ error: err.message || 'AI fare split failed' });
    }
}

// ══════════════════════════════════════════════════════════
//   POST /api/ai/chat
//
//   Body: {
//     message:  string           — latest user message
//     history?: [{role, content}] — previous turns (max 10 kept)
//   }
//
//   Returns: {
//     success: true,
//     data: { reply: string }
//   }
// ══════════════════════════════════════════════════════════
async function assistantChat(req, res) {
    try {
        const { message, history = [] } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'message is required' });
        }
        if (message.length > 500) {
            return res.status(400).json({ error: 'Message too long (max 500 characters)' });
        }

        const ctx   = userCtx(req);
        // Sanitise history: only keep valid role/content pairs, cap at 10 turns
        const safeHistory = (Array.isArray(history) ? history : [])
            .filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string')
            .slice(-10);

        const reply = await grok.assistantChat(safeHistory, message.trim(), ctx);

        res.json({ success: true, data: { reply } });

    } catch (err) {
        console.error('[AI chat]', err.message);
        res.status(500).json({ error: err.message || 'AI assistant unavailable' });
    }
}

module.exports = { getSmartRoute, getFareSplit, assistantChat };
