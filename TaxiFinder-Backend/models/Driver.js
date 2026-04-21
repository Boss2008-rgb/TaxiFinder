'use strict';

/**
 * models/Driver.js
 * A Driver is a separate document (not a sub-type of User) so that
 * driver-specific queries (geo-proximity, availability) are isolated
 * and can have their own indexes.
 *
 * A driver MUST be registered and approved before appearing in search results.
 * "No dummy data" is enforced at the application layer — see driverController.js.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Sub-schema: Vehicle ────────────────────────────────────
const vehicleSchema = new mongoose.Schema(
    {
        make:         { type: String, required: true, trim: true, maxlength: 50  },
        model:        { type: String, required: true, trim: true, maxlength: 50  },
        year:         { type: Number, required: true, min: 2000, max: new Date().getFullYear() + 1 },
        color:        { type: String, required: true, trim: true, maxlength: 30  },
        licensePlate: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
        // Grand-taxi seating capacity (Tangier system: typically 4-6)
        capacity:     { type: Number, required: true, min: 1,    max: 9          },
        type:         {
            type:    String,
            enum:    ['economy', 'comfort', 'vip', 'grand_taxi', 'minibus'],
            default: 'economy',
        },
    },
    { _id: false }
);

// ── Sub-schema: Uploaded documents ────────────────────────
const documentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['national_id', 'drivers_license', 'vehicle_registration', 'insurance', 'taxi_permit'],
            required: true,
        },
        url:        { type: String, required: true },
        expiresAt:  { type: Date,   default: null  },
        verified:   { type: Boolean, default: false },
        verifiedAt: { type: Date,    default: null  },
    },
    { _id: true }
);

// ── Sub-schema: Rating entry ───────────────────────────────
const ratingSchema = new mongoose.Schema(
    {
        givenBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        rideId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
        score:     { type: Number, min: 1, max: 5, required: true },
        comment:   { type: String, maxlength: 500, trim: true },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

// ── Sub-schema: SOS emergency contact ─────────────────────
const sosContactSchema = new mongoose.Schema(
    {
        name:         { type: String, required: true, trim: true, maxlength: 100 },
        phone:        { type: String, required: true, trim: true, maxlength: 20  },
        relationship: { type: String, trim: true, maxlength: 50 },
    },
    { _id: true }
);

// ── Main Driver Schema ─────────────────────────────────────
const driverSchema = new mongoose.Schema(
    {
        // ── Identity ────────────────────────────────────
        fullName: {
            type:      String,
            required:  [true, 'Full name is required'],
            trim:      true,
            minlength: [2,   'Full name must be at least 2 characters'],
            maxlength: [100, 'Full name cannot exceed 100 characters'],
        },
        phone: {
            type:     String,
            required: [true, 'Phone number is required'],
            unique:   true,
            trim:     true,
            match:    [/^\+?[0-9]{7,15}$/, 'Invalid phone number format'],
        },
        email: {
            type:      String,
            unique:    true,
            sparse:    true,
            trim:      true,
            lowercase: true,
            match:     [/^\S+@\S+\.\S+$/, 'Invalid email address'],
        },
        passwordHash: { type: String, select: false },
        avatarUrl:    { type: String, default: null  },

        // ── Role (always 'driver') ───────────────────────
        role: { type: String, default: 'driver', immutable: true },

        // ── Account status ───────────────────────────────
        isActive:   { type: Boolean, default: true  },
        isVerified: { type: Boolean, default: false },
        isApproved: {
            type:    Boolean,
            default: false,
            // CRITICAL: Only approved drivers are returned in search results.
            // driverController.getNearbyDrivers() filters on this field.
        },
        approvedAt: { type: Date, default: null },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

        // ── Premium Status ───────────────────────────────
        premium: {
            active:    { type: Boolean, default: false },
            expiresAt: { type: Date,    default: null  },
            plan: {
                type:    String,
                enum:    ['none', 'monthly', 'quarterly', 'annual'],
                default: 'none',
            },
        },

        // ── Vehicle ──────────────────────────────────────
        vehicle: { type: vehicleSchema, required: true },

        // ── Documents ────────────────────────────────────
        documents: { type: [documentSchema], default: [] },

        // ── Live State ───────────────────────────────────
        status: {
            type:    String,
            enum:    ['offline', 'online', 'on_ride'],
            default: 'offline',
        },
        available: { type: Boolean, default: false },

        // GeoJSON Point — enables MongoDB $geoNear / $geoWithin queries
        location: {
            type: {
                type:   String,
                enum:   ['Point'],
                default: 'Point',
            },
            coordinates: {
                type:    [Number],  // [longitude, latitude]
                default: [0, 0],
            },
        },
        locationUpdatedAt: { type: Date, default: null },

        // ── Ratings (as driver) ──────────────────────────
        ratings: {
            average: { type: Number, default: 0, min: 0, max: 5 },
            count:   { type: Number, default: 0, min: 0 },
            history: { type: [ratingSchema], default: [] },
        },

        // ── Localisation ─────────────────────────────────
        languagePreference: {
            type:    String,
            enum:    ['ar', 'fr', 'en', 'es', 'ber'],
            default: 'ar',
        },

        // ── SOS Emergency Contacts (max 3) ───────────────
        sosContacts: {
            type:     [sosContactSchema],
            validate: {
                validator: (arr) => arr.length <= 3,
                message:   'Maximum 3 SOS contacts allowed',
            },
            default: [],
        },

        // ── Statistics ───────────────────────────────────
        stats: {
            totalRides:     { type: Number, default: 0 },
            totalEarnedMAD: { type: Number, default: 0 },
            totalKm:        { type: Number, default: 0 },
            cancellations:  { type: Number, default: 0 },
        },

        // ── Auth tokens ──────────────────────────────────
        refreshTokenHash:    { type: String, select: false, default: null },
        passwordResetToken:  { type: String, select: false, default: null },
        passwordResetExpiry: { type: Date,   select: false, default: null },

        lastActiveAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON:     { virtuals: true },
        toObject:   { virtuals: true },
    }
);

// ── Indexes ────────────────────────────────────────────────
driverSchema.index({ location: '2dsphere' });    // geo-proximity queries

driverSchema.index({ isApproved: 1, available: 1, status: 1 }); // hot query path
driverSchema.index({ 'vehicle.type': 1 });
driverSchema.index({ createdAt: -1 });

// ── Virtual: isPremiumActive ───────────────────────────────
driverSchema.virtual('isPremiumActive').get(function () {
    return this.premium.active && (!this.premium.expiresAt || this.premium.expiresAt > new Date());
});

// ── Virtual: allDocumentsVerified ─────────────────────────
driverSchema.virtual('allDocumentsVerified').get(function () {
    const required = ['national_id', 'drivers_license', 'vehicle_registration', 'taxi_permit'];
    return required.every((type) =>
        this.documents.some((d) => d.type === type && d.verified)
    );
});

// ── Pre-save: hash password ────────────────────────────────
driverSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();
    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, rounds);
    next();
});

// ── Instance method: verify password ─────────────────────
driverSchema.methods.verifyPassword = async function (plainPassword) {
    return bcrypt.compare(plainPassword, this.passwordHash);
};

// ── Instance method: update aggregate rating ─────────────
driverSchema.methods.addRating = async function (score, givenBy, rideId, comment) {
    this.ratings.history.push({ givenBy, rideId, score, comment });
    const total = this.ratings.history.reduce((sum, r) => sum + r.score, 0);
    this.ratings.count   = this.ratings.history.length;
    this.ratings.average = +(total / this.ratings.count).toFixed(2);
    return this.save();
};

// ── Remove sensitive fields from JSON output ──────────────
driverSchema.methods.toPublicJSON = function () {
    const obj = this.toObject({ virtuals: true });
    delete obj.passwordHash;
    delete obj.refreshTokenHash;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpiry;
    delete obj.documents;      // documents contain URLs, hide from public profile
    delete obj.__v;
    return obj;
};

module.exports = mongoose.model('Driver', driverSchema);
