'use strict';

const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 min
const max      = parseInt(process.env.RATE_LIMIT_MAX, 10)        || 100;
const authMax  = parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10)   || 10;

const defaultOptions = {
    windowMs,
    standardHeaders: true,
    legacyHeaders:   false,
    handler: (_req, res) =>
        res.status(429).json({ error: 'Too many requests. Please try again later.' }),
};

/** General API rate limiter */
const apiLimiter = rateLimit({ ...defaultOptions, max });

/** Stricter limiter for auth endpoints (login, register) */
const authLimiter = rateLimit({
    ...defaultOptions,
    max: authMax,
    message: undefined,
    handler: (_req, res) =>
        res.status(429).json({ error: 'Too many authentication attempts. Try again in 15 minutes.' }),
});

module.exports = apiLimiter;
