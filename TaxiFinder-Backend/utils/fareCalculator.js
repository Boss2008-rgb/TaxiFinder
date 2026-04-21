'use strict';

/**
 * utils/fareCalculator.js
 *
 * CRITICAL — required by controllers/rideController.js.
 * Without this file, every POST /api/rides request throws a 500.
 *
 * Fare model (Tangier grand-taxi pricing, MAD):
 *   fare = BASE_FARE + (distKm × PER_KM) + (estMin × PER_MIN)
 *   result is clamped to the minimum fare for each car type.
 *
 * Shared rides receive a per-seat discount because the driver
 * earns from multiple passengers at once.
 */

// ── Fare table (per car type) ─────────────────────────────
//
//  base    — flag-fall fare (MAD)
//  perKm   — per kilometre rate (MAD)
//  perMin  — per minute rate  (MAD)
//  minimum — minimum charge regardless of distance
//
const FARE_TABLE = {
    economy:    { base: 8,  perKm: 3.5,  perMin: 0.50, minimum: 10 },
    comfort:    { base: 12, perKm: 5.5,  perMin: 0.80, minimum: 15 },
    vip:        { base: 25, perKm: 10.0, perMin: 1.50, minimum: 30 },
    grand_taxi: { base: 6,  perKm: 2.0,  perMin: 0.30, minimum: 8  },
    minibus:    { base: 50, perKm: 1.5,  perMin: 0.20, minimum: 50 },
};

// Shared-ride per-passenger multiplier (60 % of private fare)
// Each passenger pays 60 % but the driver collects from N passengers.
const SHARED_MULTIPLIER = 0.60;

// ── Haversine distance ────────────────────────────────────

/**
 * Calculates great-circle distance between two GeoJSON-style
 * coordinate objects using the Haversine formula.
 *
 * Accepts both:
 *   • { lat, lng }   — used by the REST request body
 *   • { coordinates: [lng, lat] } — GeoJSON format from DB
 *
 * @param  {{ lat?: number, lng?: number, coordinates?: number[] }} from
 * @param  {{ lat?: number, lng?: number, coordinates?: number[] }} to
 * @returns {number}  distance in kilometres
 */
function haversineKm(from, to) {
    // Normalise both input shapes
    const lat1 = from.lat ?? from.coordinates?.[1] ?? 0;
    const lng1 = from.lng ?? from.coordinates?.[0] ?? 0;
    const lat2 = to.lat   ?? to.coordinates?.[1]   ?? 0;
    const lng2 = to.lng   ?? to.coordinates?.[0]   ?? 0;

    const R    = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Private fare ──────────────────────────────────────────

/**
 * Calculates the full fare for a private ride.
 *
 * @param  {number} distKm   — estimated trip distance in km
 * @param  {number} estMin   — estimated trip duration in minutes
 * @param  {string} carType  — one of the FARE_TABLE keys
 * @returns {{ fareMAD: number, breakdown: object }}
 */
function calculatePrivateFare(distKm, estMin, carType = 'economy') {
    const t = FARE_TABLE[carType] || FARE_TABLE.economy;

    const distCharge = +(distKm * t.perKm).toFixed(2);
    const timeCharge = +(estMin  * t.perMin).toFixed(2);
    const raw        = t.base + distCharge + timeCharge;
    const fareMAD    = Math.max(Math.round(raw), t.minimum);

    return {
        fareMAD,
        breakdown: {
            base:     t.base,
            distance: distCharge,
            time:     timeCharge,
            subtotal: +raw.toFixed(2),
            minimum:  t.minimum,
            total:    fareMAD,
            carType,
            type:     'private',
        },
    };
}

// ── Shared fare (per passenger) ───────────────────────────

/**
 * Calculates the per-seat fare for a shared ride.
 * Passengers pay less; the driver earns from multiple slots.
 *
 * @param  {number} distKm   — passenger's own route distance in km
 * @param  {number} estMin   — estimated duration for their segment
 * @param  {string} carType  — defaults to 'grand_taxi' for shared rides
 * @returns {{ fareMAD: number, breakdown: object }}
 */
function calculateSharedFare(distKm, estMin, carType = 'grand_taxi') {
    const t = FARE_TABLE[carType] || FARE_TABLE.grand_taxi;

    const distCharge = +(distKm * t.perKm).toFixed(2);
    const timeCharge = +(estMin  * t.perMin).toFixed(2);
    const raw        = (t.base + distCharge + timeCharge) * SHARED_MULTIPLIER;
    const minShared  = Math.round(t.minimum * SHARED_MULTIPLIER);
    const fareMAD    = Math.max(Math.round(raw), minShared);

    return {
        fareMAD,
        breakdown: {
            base:           t.base,
            distance:       distCharge,
            time:           timeCharge,
            subtotal:       +((t.base + distCharge + timeCharge)).toFixed(2),
            sharedDiscount: `${Math.round((1 - SHARED_MULTIPLIER) * 100)}%`,
            total:          fareMAD,
            carType,
            type:           'shared',
        },
    };
}

// ── AI-assisted fair split (used by Phase 4 Grok endpoint) ──

/**
 * Calculates a proportional fare split for a set of passengers
 * on a shared ride, weighted by each passenger's segment distance.
 *
 * Returns an array of { userId, distKm, fareMAD, proportion }
 * that the AI endpoint can use as its ground-truth base.
 *
 * @param {Array<{userId: string, distKm: number}>} segments
 * @param {string} carType
 * @returns {Array<{userId: string, distKm: number, fareMAD: number, proportion: number}>}
 */
function splitSharedFare(segments, carType = 'grand_taxi') {
    const totalDist = segments.reduce((s, p) => s + p.distKm, 0) || 1;

    return segments.map((p) => {
        const proportion = p.distKm / totalDist;
        const { fareMAD } = calculateSharedFare(p.distKm, p.distKm * 3, carType);
        return {
            userId:     p.userId,
            distKm:     +p.distKm.toFixed(2),
            fareMAD,
            proportion: +proportion.toFixed(4),
        };
    });
}

module.exports = {
    haversineKm,
    calculatePrivateFare,
    calculateSharedFare,
    splitSharedFare,
};
