'use strict';

const router     = require('express').Router();
const ctrl       = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');
const {
    handleValidation,
    registerRiderRules,
    registerDriverRules,
    loginRules,
    sosContactRules,
} = require('../middleware/validate');
const { body } = require('express-validator');

// ── Rider registration ────────────────────────────────────
router.post(
    '/rider/register',
    authLimiter,
    registerRiderRules,
    handleValidation,
    ctrl.registerRider
);

// ── Driver registration ───────────────────────────────────
router.post(
    '/driver/register',
    authLimiter,
    registerDriverRules,
    handleValidation,
    ctrl.registerDriver
);

// ── Login (role determined by request body) ───────────────
router.post(
    '/login',
    authLimiter,
    [...loginRules, body('role').optional().isIn(['rider', 'driver'])],
    handleValidation,
    ctrl.login
);

// ── Token refresh ─────────────────────────────────────────
router.post(
    '/refresh',
    [body('refreshToken').notEmpty().withMessage('refreshToken is required')],
    handleValidation,
    ctrl.refreshToken
);

// ── Logout ────────────────────────────────────────────────
router.post('/logout', requireAuth, ctrl.logout);

// ── My profile ────────────────────────────────────────────
router.get('/me', requireAuth, ctrl.getMe);

// ── Update profile ────────────────────────────────────────
router.patch(
    '/me',
    requireAuth,
    [
        body('fullName').optional().trim().isLength({ min: 2, max: 100 }),
        body('languagePreference').optional().isIn(['ar', 'fr', 'en', 'es', 'ber']),
        body('sosContacts').optional().isArray({ max: 3 }),
    ],
    handleValidation,
    ctrl.updateProfile
);

module.exports = router;
