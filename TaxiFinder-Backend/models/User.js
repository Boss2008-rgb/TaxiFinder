'use strict';

/**
 * models/User.js
 * Passenger (rider) account.
 *
 * Fields included per spec:
 *  - premiumStatus   : boolean + expiry
 *  - ratings         : average + count
 *  - languagePreference : one of the supported locales
 *  - sosContacts     : up to 3 emergency contacts
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Sub-schema: SOS emergency contact ─────────────────────
const sosContactSchema = new mongoose.Schema(
    {
        name:         { type: String, required: true, trim: true, maxlength: 100 },
        phone:        { type: String, required: true, trim: true, maxlength: 20  },
        relationship: { type: String, trim: true, maxlength: 50 },
    },
    { _id: true }
);

// ── Sub-schema: Rating entry ───────────────────────────────
const ratingSchema = new mongoose.Schema(
    {
        givenBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
        rideId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Ride',   required: true },
        score:     { type: Number, min: 1, max: 5,  required: true },
        comment:   { type: String, maxlength: 500, trim: true },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

// ── Main User Schema ───────────────────────────────────────
const userSchema = new mongoose.Schema(
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
            type:     String,
            unique:   true,
            sparse:   true,           // allows multiple null values
            trim:     true,
            lowercase: true,
            match:    [/^\S+@\S+\.\S+$/, 'Invalid email address'],
        },
        passwordHash: {
            type:   String,
            select: false,            // never returned in queries by default
        },
        avatarUrl: { type: String, default: null },

        // ── Role & Status ────────────────────────────────
        role: {
            type:    String,
            enum:    ['rider', 'admin'],
            default: 'rider',
        },
        isActive: { type: Boolean, default: true },
        isVerified: { type: Boolean, default: false },

        // ── Premium Status ───────────────────────────────
        premium: {
            active:    { type: Boolean, default: false },
            expiresAt: { type: Date,    default: null  },
            plan:      {
                type:    String,
                enum:    ['none', 'monthly', 'quarterly', 'annual'],
                default: 'none',
            },
        },

        // ── Ratings (as passenger) ───────────────────────
        ratings: {
            average: { type: Number, default: 0, min: 0, max: 5 },
            count:   { type: Number, default: 0, min: 0 },
            history: { type: [ratingSchema], default: [] },
        },

        // ── Localisation ─────────────────────────────────
        languagePreference: {
            type:    String,
            enum:    ['ar', 'fr', 'en', 'es', 'ber'],   // Arabic, French, English, Spanish, Tamazight
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

        // ── Ride statistics ──────────────────────────────
        stats: {
            totalRides:    { type: Number, default: 0 },
            totalSpentMAD: { type: Number, default: 0 },
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


userSchema.index({ createdAt: -1 });

// ── Virtual: isPremiumActive ───────────────────────────────
userSchema.virtual('isPremiumActive').get(function () {
    return this.premium.active && (!this.premium.expiresAt || this.premium.expiresAt > new Date());
});

// ── Pre-save: hash password ────────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();
    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, rounds);
    next();
});

// ── Instance method: verify password ─────────────────────
userSchema.methods.verifyPassword = async function (plainPassword) {
    return bcrypt.compare(plainPassword, this.passwordHash);
};

// ── Instance method: update aggregate rating ─────────────
userSchema.methods.addRating = async function (score, givenBy, rideId, comment) {
    this.ratings.history.push({ givenBy, rideId, score, comment });
    const total = this.ratings.history.reduce((sum, r) => sum + r.score, 0);
    this.ratings.count   = this.ratings.history.length;
    this.ratings.average = +(total / this.ratings.count).toFixed(2);
    return this.save();
};

// ── Remove sensitive fields from JSON output ──────────────
userSchema.methods.toPublicJSON = function () {
    const obj = this.toObject({ virtuals: true });
    delete obj.passwordHash;
    delete obj.refreshTokenHash;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpiry;
    delete obj.__v;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
