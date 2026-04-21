'use strict';

/**
 * utils/jwt.js
 *
 * CRITICAL — this file is required by:
 *   • controllers/authController.js   (sign + hash + compare)
 *   • middleware/auth.js              (verifyAccessToken)
 *   • routes/auth.js                 (verifyAccessToken)
 *
 * Environment variables (with safe dev-only fallbacks):
 *   JWT_SECRET           — signs/verifies access tokens
 *   JWT_REFRESH_SECRET   — signs/verifies refresh tokens
 *   JWT_ACCESS_TTL       — access token lifetime  (default 15m)
 *   JWT_REFRESH_TTL      — refresh token lifetime (default 7d)
 *   BCRYPT_ROUNDS        — bcrypt rounds for token hashing (default 8)
 *
 * ⚠️  In production, always set JWT_SECRET and JWT_REFRESH_SECRET
 *     to long, random values via your .env file.
 */

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ── Secrets & config ──────────────────────────────────────
const ACCESS_SECRET  = process.env.JWT_SECRET          || 'taxigo_dev_access_secret_change_in_prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET  || 'taxigo_dev_refresh_secret_change_in_prod';
const ACCESS_TTL     = process.env.JWT_ACCESS_TTL      || '15m';
const REFRESH_TTL    = process.env.JWT_REFRESH_TTL     || '7d';
const HASH_ROUNDS    = parseInt(process.env.BCRYPT_ROUNDS, 10) || 8;

// Warn loudly if running in production with default secrets
if (process.env.NODE_ENV === 'production') {
    if (ACCESS_SECRET.includes('dev_')) {
        console.error('⛔  SECURITY: JWT_SECRET is using the development fallback in production!');
    }
    if (REFRESH_SECRET.includes('dev_')) {
        console.error('⛔  SECURITY: JWT_REFRESH_SECRET is using the development fallback in production!');
    }
}

// ── Sign tokens ───────────────────────────────────────────

/**
 * Signs a short-lived access token.
 * Payload: { id, role, type: 'access' }
 *
 * @param  {mongoose.Document} entity  User or Driver document
 * @returns {string}
 */
function signAccessToken(entity) {
    return jwt.sign(
        {
            id:   entity._id.toString(),
            role: entity.role,
            type: 'access',
        },
        ACCESS_SECRET,
        { expiresIn: ACCESS_TTL }
    );
}

/**
 * Signs a long-lived refresh token.
 * Payload: { id, role, type: 'refresh' }
 *
 * @param  {mongoose.Document} entity  User or Driver document
 * @returns {string}
 */
function signRefreshToken(entity) {
    return jwt.sign(
        {
            id:   entity._id.toString(),
            role: entity.role,
            type: 'refresh',
        },
        REFRESH_SECRET,
        { expiresIn: REFRESH_TTL }
    );
}

// ── Verify tokens ─────────────────────────────────────────

/**
 * Verifies and decodes an access token.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 *
 * @param  {string} token
 * @returns {{ id: string, role: string, type: 'access', iat: number, exp: number }}
 */
function verifyAccessToken(token) {
    return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verifies and decodes a refresh token.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 *
 * @param  {string} token
 * @returns {{ id: string, role: string, type: 'refresh', iat: number, exp: number }}
 */
function verifyRefreshToken(token) {
    return jwt.verify(token, REFRESH_SECRET);
}

// ── Token hashing (for refresh token storage) ─────────────
//
// We never store refresh tokens in plain text — only a bcrypt hash.
// This prevents a DB breach from immediately compromising all sessions.

/**
 * Bcrypt-hashes a refresh token for secure DB storage.
 * Uses a lower round count than password hashing (8 vs 12)
 * because the token is already a strong random value.
 *
 * @param  {string} token  — plain refresh token
 * @returns {Promise<string>}  — bcrypt hash
 */
async function hashToken(token) {
    return bcrypt.hash(token, HASH_ROUNDS);
}

/**
 * Compares a plain refresh token against its stored bcrypt hash.
 *
 * @param  {string} token   — plain refresh token from client
 * @param  {string} hash    — bcrypt hash from DB
 * @returns {Promise<boolean>}
 */
async function compareTokenHash(token, hash) {
    if (!token || !hash) return false;
    return bcrypt.compare(token, hash);
}

// ── Exports ───────────────────────────────────────────────
module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    hashToken,
    compareTokenHash,
};
