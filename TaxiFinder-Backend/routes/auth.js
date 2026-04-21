'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const User   = require('../models/User');
const Driver = require('../models/Driver');
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
router.post('/login', authController.login);
router.post('/register/rider', authController.registerRider);  // للركاب
router.post('/register/driver', authController.registerDriver); // للسائقين
// جلب بيانات المستخدم الحالي (يجب أن يكون مسار GET)
router.get('/me', requireAuth, authController.getMe);
router.post('/refresh', authController.refreshToken);
/**
 * requireAuth
 * Verifies the Bearer token in Authorization header.
 * Attaches the full DB record to req.authUser.
 */
async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = header.slice(7);
        let payload;
        try {
            payload = verifyAccessToken(token);
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Look up the user in the correct collection
        let authUser = null;
        if (payload.role === 'driver') {
            authUser = await Driver.findById(payload.id).select('+passwordHash');
        } else {
            authUser = await User.findById(payload.id).select('+passwordHash');
        }

        if (!authUser || !authUser.isActive) {
            return res.status(401).json({ error: 'Account not found or deactivated' });
        }

        req.authUser = authUser;
        req.authRole = payload.role;
        next();
    } catch (err) {
        console.error('[Auth Middleware]', err);
        res.status(500).json({ error: 'Authentication error' });
    }
}

/**
 * requireRole(...roles)
 * Must be used after requireAuth.
 * Usage: router.get('/admin', requireAuth, requireRole('admin'), handler)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.authUser) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!roles.includes(req.authRole)) {
            return res.status(403).json({
                error: `Access denied. Required role: ${roles.join(' or ')}`,
            });
        }
        next();
    };
}

/**
 * requireApprovedDriver
 * Must be used after requireAuth.
 * Ensures the authenticated driver has been approved by admin.
 * This is the enforcement gate for the "no dummy / unverified drivers" requirement.
 */
function requireApprovedDriver(req, res, next) {
    if (req.authRole !== 'driver') {
        return res.status(403).json({ error: 'Driver account required' });
    }
    if (!req.authUser.isApproved) {
        return res.status(403).json({
            error: 'Driver account is pending approval. Please wait for admin review.',
        });
    }
    next();
}

/**
 * optionalAuth
 * Like requireAuth but does not fail if no token is present.
 * Useful for endpoints that behave differently for authenticated users.
 */
async function optionalAuth(req, _res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) return next();

        const token   = header.slice(7);
        const payload = verifyAccessToken(token);

        let authUser = payload.role === 'driver'
            ? await Driver.findById(payload.id)
            : await User.findById(payload.id);

        if (authUser && authUser.isActive) {
            req.authUser = authUser;
            req.authRole = payload.role;
        }
    } catch {
        // Token invalid → continue as unauthenticated
    }
    next();
}

// 1. تصدير مسارات الراوتر (Login / Register) لتتصل بـ server.js
module.exports = router;

// 2. إرفاق دوال الحماية بنفس التصدير لكي تستخدمها في باقي ملفات المشروع
module.exports.requireAuth = requireAuth;
module.exports.requireRole = requireRole;
module.exports.requireApprovedDriver = requireApprovedDriver;
module.exports.optionalAuth = optionalAuth;