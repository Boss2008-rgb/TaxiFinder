'use strict';

/**
 * routes/ai.js  (Phase 4)
 *
 * Mounted at /api/ai in server.js
 *
 * All routes require authentication.
 * Rate limits are inherited from the global apiLimiter in server.js.
 */

const router = require('express').Router();
const ctrl   = require('../controllers/aiController');
const { requireAuth } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { body } = require('express-validator');

// ── Shared location validation helper ────────────────────
const locationBodyRule = (field) =>
    body(field)
        .isObject().withMessage(`${field} must be an object`)
        .custom((v) => {
            if (typeof v.lat !== 'number') throw new Error(`${field}.lat must be a number`);
            if (typeof v.lng !== 'number') throw new Error(`${field}.lng must be a number`);
            if (v.lat < -90  || v.lat > 90)  throw new Error(`${field}.lat out of range`);
            if (v.lng < -180 || v.lng > 180) throw new Error(`${field}.lng out of range`);
            return true;
        });

// ══════════════════════════════════════════════════════════
//   POST /api/ai/route
//   Smart route suggestion (Grok analyses Tangier traffic)
// ══════════════════════════════════════════════════════════
router.post(
    '/route',
    requireAuth,
    [
        locationBodyRule('pickup'),
        locationBodyRule('dropoff'),
    ],
    handleValidation,
    ctrl.getSmartRoute
);

// ══════════════════════════════════════════════════════════
//   POST /api/ai/split
//   Shared ride fare split (AI-assisted proportional calculation)
// ══════════════════════════════════════════════════════════
router.post(
    '/split',
    requireAuth,
    [
        // Either rideId OR passengers array must be provided
        body('rideId')
            .optional()
            .isMongoId().withMessage('rideId must be a valid MongoDB ObjectId'),

        body('passengers')
            .optional()
            .isArray({ min: 2, max: 9 }).withMessage('passengers must be an array of 2–9 entries'),

        body('passengers.*.name')
            .optional()
            .isString().isLength({ max: 100 }),

        body('passengers.*.pickupLat')
            .optional()
            .isFloat({ min: -90, max: 90 }),

        body('passengers.*.pickupLng')
            .optional()
            .isFloat({ min: -180, max: 180 }),

        body('passengers.*.dropoffLat')
            .optional()
            .isFloat({ min: -90, max: 90 }),

        body('passengers.*.dropoffLng')
            .optional()
            .isFloat({ min: -180, max: 180 }),
    ],
    handleValidation,
    ctrl.getFareSplit
);

// ══════════════════════════════════════════════════════════
//   POST /api/ai/chat
//   AI assistant (multi-turn general helper)
// ══════════════════════════════════════════════════════════
router.post(
    '/chat',
    requireAuth,
    [
        body('message')
            .trim()
            .notEmpty().withMessage('message is required')
            .isLength({ max: 500 }).withMessage('Message too long (max 500 characters)'),

        body('history')
            .optional()
            .isArray({ max: 20 }).withMessage('history must be an array of at most 20 messages'),
    ],
    handleValidation,
    ctrl.assistantChat
);

module.exports = router;
