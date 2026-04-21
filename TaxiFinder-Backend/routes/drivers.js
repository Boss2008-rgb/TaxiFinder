'use strict';

/**
 * routes/drivers.js  (Phase 3 — complete)
 *
 * Added vs the Phase 2 version:
 *   POST /me/premium  — driver activates Premium subscription (100 MAD)
 */

const router = require('express').Router();
const ctrl   = require('../controllers/driverController');
const { requireAuth, requireRole, requireApprovedDriver } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { body, query }      = require('express-validator');

// ── Public: nearby drivers ────────────────────────────────
// Phase 3: returns isPremium flag per driver; premium drivers sorted first
router.get(
    '/nearby',
    [
        query('lat').isFloat({ min: -90,  max: 90  }).withMessage('Valid lat required'),
        query('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid lng required'),
        query('radius').optional().isFloat({ min: 100, max: 50000 }),
        query('type').optional().isIn(['economy', 'comfort', 'vip', 'grand_taxi', 'minibus']),
    ],
    handleValidation,
    ctrl.getNearbyDrivers
);

// ── Public: single driver profile ─────────────────────────
router.get('/:id', ctrl.getDriverProfile);

// ── Driver: update own location ───────────────────────────
router.patch(
    '/me/location',
    requireAuth,
    requireApprovedDriver,
    [
        body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid lat required'),
        body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid lng required'),
        body('bearing').optional().isFloat({ min: 0, max: 360 }),
    ],
    handleValidation,
    ctrl.updateLocation
);

// ── Driver: toggle availability ───────────────────────────
router.patch(
    '/me/availability',
    requireAuth,
    requireApprovedDriver,
    [
        body('available').optional().isBoolean().withMessage('available must be boolean'),
        body('status').optional().isIn(['offline', 'online', 'on_ride']),
    ],
    handleValidation,
    ctrl.updateAvailability
);

// ── Phase 3: Driver activate/renew Premium (100 MAD / month) ─
//
// FIX: this route was missing entirely in the Phase 2 drivers.js.
// Without it, POST /api/drivers/me/premium returns 404 even though
// the controller method (activatePremium) already exists.
router.post(
    '/me/premium',
    requireAuth,
    requireApprovedDriver,
    [
        body('plan')
            .optional()
            .isIn(['monthly', 'quarterly', 'annual'])
            .withMessage('Plan must be monthly, quarterly, or annual'),
    ],
    handleValidation,
    ctrl.activatePremium
);

// ── Admin: list all drivers ───────────────────────────────
router.get(
    '/',
    requireAuth,
    requireRole('admin'),
    ctrl.listDrivers
);

// ── Admin: approve driver ─────────────────────────────────
router.patch(
    '/:id/approve',
    requireAuth,
    requireRole('admin'),
    ctrl.approveDriver
);

module.exports = router;
