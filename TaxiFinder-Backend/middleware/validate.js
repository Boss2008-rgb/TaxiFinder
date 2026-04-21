'use strict';

const { validationResult, body, param, query } = require('express-validator');

// ── Helper: run validation and respond if errors ───────────
function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            error:  'Validation failed',
            fields: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    }
    next();
}

// ── Reusable field rules ────────────────────────────────────

const phoneRule = (field = 'phone') =>
    body(field)
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^\+?[0-9]{7,15}$/).withMessage('Invalid phone number format');

const passwordRule = (field = 'password') =>
    body(field)
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain a number');

const nameRule = (field = 'fullName') =>
    body(field)
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2–100 characters');

const emailRule = (field = 'email', required = false) => {
    const chain = body(field).trim().toLowerCase();
    if (!required) return chain.optional({ checkFalsy: true }).isEmail().withMessage('Invalid email address');
    return chain.notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email address');
};

const locationRule = (field) =>
    body(field)
        .isObject().withMessage(`${field} must be an object`)
        .custom((v) => {
            if (typeof v.lat !== 'number' || typeof v.lng !== 'number') {
                throw new Error(`${field} must have numeric lat and lng`);
            }
            if (v.lat < -90 || v.lat > 90)   throw new Error(`${field}.lat out of range`);
            if (v.lng < -180 || v.lng > 180) throw new Error(`${field}.lng out of range`);
            return true;
        });

// ── Validation rule sets ────────────────────────────────────

const registerRiderRules = [
    nameRule(),
    phoneRule(),
    emailRule('email', false),
    passwordRule(),
    body('languagePreference').optional().isIn(['ar', 'fr', 'en', 'es', 'ber']),
];

const registerDriverRules = [
    nameRule(),
    phoneRule(),
    emailRule('email', false),
    passwordRule(),
    body('languagePreference').optional().isIn(['ar', 'fr', 'en', 'es', 'ber']),
    // Vehicle
    body('vehicle.make').trim().notEmpty().withMessage('Vehicle make is required'),
    body('vehicle.model').trim().notEmpty().withMessage('Vehicle model is required'),
    body('vehicle.year').isInt({ min: 2000 }).withMessage('Invalid vehicle year'),
    body('vehicle.color').trim().notEmpty().withMessage('Vehicle color is required'),
    body('vehicle.licensePlate').trim().notEmpty().withMessage('License plate is required'),
    body('vehicle.capacity').isInt({ min: 1, max: 9 }).withMessage('Capacity must be 1–9'),
    body('vehicle.type').isIn(['economy', 'comfort', 'vip', 'grand_taxi', 'minibus'])
        .withMessage('Invalid vehicle type'),
];

const loginRules = [
    phoneRule(),
    body('password').notEmpty().withMessage('Password is required'),
];

const rideRequestRules = [
    locationRule('pickupLocation'),
    locationRule('dropoffLocation'),
    body('type').optional().isIn(['private', 'shared']).withMessage('Invalid ride type'),
    body('carType').optional().isIn(['economy', 'comfort', 'vip', 'grand_taxi', 'minibus']),
    body('paymentMethod').optional().isIn(['cash', 'card', 'wallet']),
    body('scheduledAt').optional().isISO8601().withMessage('Invalid scheduled time'),
];

const joinSharedRideRules = [
    param('rideId').isMongoId().withMessage('Invalid ride ID'),
    locationRule('pickupLocation'),
    locationRule('dropoffLocation'),
    body('paymentMethod').optional().isIn(['cash', 'card', 'wallet']),
];

const ratingRules = [
    body('score').isFloat({ min: 1, max: 5 }).withMessage('Score must be between 1 and 5'),
    body('comment').optional().isLength({ max: 500 }),
];

const sosContactRules = [
    body('name').trim().notEmpty().withMessage('Contact name is required'),
    body('phone').trim().notEmpty().withMessage('Contact phone is required'),
    body('relationship').optional().trim().isLength({ max: 50 }),
];

module.exports = {
    handleValidation,
    // Field rules (composable)
    phoneRule, passwordRule, nameRule, emailRule, locationRule,
    // Full rule sets
    registerRiderRules,
    registerDriverRules,
    loginRules,
    rideRequestRules,
    joinSharedRideRules,
    ratingRules,
    sosContactRules,
};
