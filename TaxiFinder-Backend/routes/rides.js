'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/rideController');
const { requireAuth, requireRole, requireApprovedDriver } = require('../middleware/auth');
const {
    handleValidation,
    rideRequestRules,
    joinSharedRideRules,
    ratingRules,
} = require('../middleware/validate');
const { param, query } = require('express-validator');

// ── Rider: create a new ride request ─────────────────────
router.post(
    '/',
    requireAuth,
    requireRole('rider'),
    rideRequestRules,
    handleValidation,
    ctrl.createRide
);

// ── Rider: join an open shared ride ──────────────────────
router.post(
    '/:rideId/join',
    requireAuth,
    requireRole('rider'),
    joinSharedRideRules,
    handleValidation,
    ctrl.joinSharedRide
);

// ── Public: list available shared rides near a location ──
router.get(
    '/shared/available',
    [
        query('lat').isFloat({ min: -90,  max: 90  }).withMessage('Valid lat required'),
        query('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid lng required'),
        query('radius').optional().isFloat({ min: 100, max: 10000 }),
        query('carType').optional().isIn(['grand_taxi', 'minibus']),
    ],
    handleValidation,
    ctrl.listAvailableSharedRides
);

// ── Authenticated: ride history ───────────────────────────
router.get(
    '/history',
    requireAuth,
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 50 }),
    ],
    handleValidation,
    ctrl.getRideHistory
);

// ── Authenticated: get a single ride ─────────────────────
router.get(
    '/:rideId',
    requireAuth,
    [param('rideId').isMongoId().withMessage('Invalid ride ID')],
    handleValidation,
    ctrl.getRide
);

// ── Driver: accept a ride ─────────────────────────────────
router.patch(
    '/:rideId/accept',
    requireAuth,
    requireApprovedDriver,
    [param('rideId').isMongoId()],
    handleValidation,
    ctrl.acceptRide
);

// ── Driver: start a ride ──────────────────────────────────
router.patch(
    '/:rideId/start',
    requireAuth,
    requireApprovedDriver,
    [param('rideId').isMongoId()],
    handleValidation,
    ctrl.startRide
);

// ── Driver: complete a ride ───────────────────────────────
router.patch(
    '/:rideId/complete',
    requireAuth,
    requireApprovedDriver,
    [param('rideId').isMongoId()],
    handleValidation,
    ctrl.completeRide
);

// ── Rider or Driver: cancel a ride ───────────────────────
router.patch(
    '/:rideId/cancel',
    requireAuth,
    [param('rideId').isMongoId()],
    handleValidation,
    ctrl.cancelRide
);

// ── Rider or Driver: rate after ride ─────────────────────
router.post(
    '/:rideId/rate',
    requireAuth,
    [...ratingRules, param('rideId').isMongoId()],
    handleValidation,
    ctrl.rateRide
);

module.exports = router;
