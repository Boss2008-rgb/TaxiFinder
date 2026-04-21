'use strict';

/**
 * models/Ride.js
 *
 * ── SHARED RIDE DESIGN (Grand Taxi model) ──────────────────
 *
 * Tangier's grand taxi system allows multiple UNRELATED passengers
 * to share one taxi along a common route direction. Each passenger:
 *   - boards at their own pickup point
 *   - exits at their own dropoff point
 *   - pays a per-seat fare (NOT a full fare)
 *
 * Implementation:
 *   - ride.type = 'shared' | 'private'
 *   - ride.maxPassengers = vehicle.capacity (set at creation)
 *   - ride.passengers[]  = array of passenger sub-documents
 *   - A passenger can JOIN a shared ride that is still 'open'
 *     (not yet at capacity and not yet departed).
 *   - ride.status transitions:
 *       open → in_progress → completed | cancelled
 *
 * For private rides, maxPassengers = 1 and the flow is the same
 * as a traditional hail-a-taxi.
 */

const mongoose = require('mongoose');

// ── Sub-schema: GeoJSON Point ──────────────────────────────
const geoPointSchema = new mongoose.Schema(
    {
        type:        { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },  // [lng, lat]
        address:     { type: String, trim: true, maxlength: 300 },
    },
    { _id: false }
);

// ── Sub-schema: Individual Passenger Slot ─────────────────
//
// Each entry represents one passenger's booking within the ride.
// This is the unit of fare calculation and status tracking.
const passengerSlotSchema = new mongoose.Schema(
    {
        userId: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'User',
            required: true,
        },
        // Passenger-specific pickup & dropoff (may differ from ride's overall route)
        pickupLocation:  { type: geoPointSchema, required: true },
        dropoffLocation: { type: geoPointSchema, required: true },

        // Calculated per-passenger fare in Moroccan Dirhams
        fareMAD: { type: Number, default: 0, min: 0 },

        // Per-passenger status
        status: {
            type:    String,
            enum:    ['pending', 'confirmed', 'picked_up', 'dropped_off', 'cancelled', 'no_show'],
            default: 'pending',
        },

        // Ratings exchanged after ride
        ratingGiven: {
            score:   { type: Number, min: 1, max: 5, default: null },
            comment: { type: String, maxlength: 500, trim: true },
        },
        ratingReceived: {
            score:   { type: Number, min: 1, max: 5, default: null },
            comment: { type: String, maxlength: 500, trim: true },
        },

        paymentMethod: {
            type:    String,
            enum:    ['cash', 'card', 'wallet'],
            default: 'cash',
        },
        paymentStatus: {
            type:    String,
            enum:    ['pending', 'paid', 'refunded', 'failed'],
            default: 'pending',
        },

        // Timestamps for this passenger's journey
        confirmedAt: { type: Date, default: null },
        pickedUpAt:  { type: Date, default: null },
        droppedOffAt:{ type: Date, default: null },
        cancelledAt: { type: Date, default: null },
    },
    { _id: true, timestamps: false }
);

// ── Main Ride Schema ───────────────────────────────────────
const rideSchema = new mongoose.Schema(
    {
        // ── Type ─────────────────────────────────────────
        type: {
            type:    String,
            enum:    ['private', 'shared'],
            default: 'private',
        },

        // ── Driver ────────────────────────────────────────
        driverId: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'Driver',
            default: null,        // null until a driver accepts
        },

        // ── Capacity ──────────────────────────────────────
        // Copied from vehicle at creation so it's immutable for the ride.
        maxPassengers: { type: Number, required: true, min: 1, max: 9 },

        // ── Passengers array (core of shared ride logic) ──
        passengers: {
            type:    [passengerSlotSchema],
            default: [],
            validate: {
                validator: function (arr) {
                    // Active slots must not exceed vehicle capacity
                    const active = arr.filter((p) => p.status !== 'cancelled');
                    return active.length <= this.maxPassengers;
                },
                message: 'Ride is at full capacity',
            },
        },

        // ── Overall Route ─────────────────────────────────
        // For shared rides this is the general direction (e.g. city centre → airport).
        // Individual passengers may board/alight at different points along this corridor.
        originLocation:      { type: geoPointSchema, required: true },
        destinationLocation: { type: geoPointSchema, required: true },
        routePolyline:       { type: String, default: null }, // encoded Google polyline

        // ── Financial ─────────────────────────────────────
        totalFareMAD:   { type: Number, default: 0, min: 0 },
        baseFareMAD:    { type: Number, default: 0, min: 0 },
        currency:       { type: String, default: 'MAD' },

        // ── Car Type (for search filtering) ───────────────
        carType: {
            type:    String,
            enum:    ['economy', 'comfort', 'vip', 'grand_taxi', 'minibus'],
            default: 'economy',
        },

        // ── Ride Status ───────────────────────────────────
        status: {
            type:    String,
            enum:    [
                'searching',    // awaiting driver
                'open',         // shared ride open for more passengers
                'driver_found', // driver accepted, not yet departed
                'in_progress',  // at least one passenger picked up
                'completed',    // all passengers dropped off
                'cancelled',    // entire ride cancelled
            ],
            default: 'searching',
        },

        // ── Distance & Duration ───────────────────────────
        estimatedDistanceKm: { type: Number, default: 0 },
        estimatedDurationMin:{ type: Number, default: 0 },
        actualDistanceKm:    { type: Number, default: null },
        actualDurationMin:   { type: Number, default: null },

        // ── Timestamps ────────────────────────────────────
        acceptedAt:  { type: Date, default: null },
        startedAt:   { type: Date, default: null },
        completedAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },

        // Cancellation metadata
        cancelledBy:     { type: String, enum: ['rider', 'driver', 'system'], default: null },
        cancellationNote:{ type: String, maxlength: 300, default: null },

        // Scheduled (pre-booked) ride
        scheduledAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON:     { virtuals: true },
        toObject:   { virtuals: true },
    }
);

// ── Indexes ────────────────────────────────────────────────
rideSchema.index({ driverId: 1 });
rideSchema.index({ 'passengers.userId': 1 });
rideSchema.index({ status: 1 });
rideSchema.index({ type: 1, status: 1 });
rideSchema.index({ originLocation: '2dsphere' });
rideSchema.index({ createdAt: -1 });

// ── Virtual: activePassengerCount ─────────────────────────
rideSchema.virtual('activePassengerCount').get(function () {
    return this.passengers.filter((p) => p.status !== 'cancelled').length;
});

// ── Virtual: availableSeats ────────────────────────────────
rideSchema.virtual('availableSeats').get(function () {
    return this.maxPassengers - this.activePassengerCount;
});

// ── Virtual: isOpen (shared rides only) ───────────────────
rideSchema.virtual('isOpen').get(function () {
    return (
        this.type === 'shared' &&
        this.status === 'open' &&
        this.availableSeats > 0
    );
});

// ── Instance method: addPassenger ─────────────────────────
/**
 * Adds a new passenger to a shared ride.
 * Validates capacity before modifying the document.
 *
 * @param {Object} slotData  — fields for passengerSlotSchema
 * @returns {mongoose.Document}  — saved ride
 * @throws {Error}  if ride is full or not joinable
 */
rideSchema.methods.addPassenger = async function (slotData) {
    if (this.type !== 'shared') {
        throw new Error('Cannot add a passenger to a private ride');
    }
    if (this.status !== 'open') {
        throw new Error(`Ride is not open for new passengers (status: ${this.status})`);
    }
    if (this.availableSeats <= 0) {
        throw new Error('Ride is at full capacity');
    }
    // Prevent duplicate booking
    const alreadyBooked = this.passengers.some(
        (p) => String(p.userId) === String(slotData.userId) && p.status !== 'cancelled'
    );
    if (alreadyBooked) {
        throw new Error('Passenger already has an active slot on this ride');
    }

    this.passengers.push(slotData);
    return this.save();
};

// ── Instance method: recalculateTotalFare ─────────────────
rideSchema.methods.recalculateTotalFare = function () {
    this.totalFareMAD = this.passengers
        .filter((p) => p.status !== 'cancelled')
        .reduce((sum, p) => sum + (p.fareMAD || 0), 0);
};

module.exports = mongoose.model('Ride', rideSchema);
