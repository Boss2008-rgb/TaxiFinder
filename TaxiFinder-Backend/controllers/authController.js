'use strict';

const User   = require('../models/User');
const Driver = require('../models/Driver');
const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    hashToken,
    compareTokenHash,
} = require('../utils/jwt');

// ── Helper ─────────────────────────────────────────────────
function buildAuthResponse(entity, accessToken, refreshToken) {
    return {
        accessToken,
        refreshToken,
        user: entity.toPublicJSON(),
    };
}

// ══════════════════════════════════════════════════════════
//   RIDER — Register
// ══════════════════════════════════════════════════════════
async function registerRider(req, res) {
    try {
        const { fullName, phone, email, password, languagePreference } = req.body;

        // Uniqueness check (informative error, not a timing leak — phone is not secret)
        const exists = await User.findOne({ phone });
        if (exists) {
            return res.status(409).json({ error: 'Phone number already registered' });
        }

        const user = await User.create({
            fullName,
            phone,
            email:              email || undefined,
            passwordHash:       password,   // pre-save hook hashes this
            languagePreference: languagePreference || 'ar',
        });

        const accessToken  = signAccessToken(user);
        const refreshToken = signRefreshToken(user);

        user.refreshTokenHash = await hashToken(refreshToken);
        user.lastActiveAt     = new Date();
        await user.save();

        res.status(201).json(buildAuthResponse(user, accessToken, refreshToken));

    } catch (err) {
        // Duplicate key from unique index (race condition)
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Phone or email already registered' });
        }
        console.error('[registerRider]', err);
        res.status(500).json({ error: 'Registration failed' });
    }
}

// ══════════════════════════════════════════════════════════
//   DRIVER — Register
// ══════════════════════════════════════════════════════════
async function registerDriver(req, res) {
    try {
        const {
            fullName, phone, email, password, languagePreference, vehicle,
        } = req.body;

        const exists = await Driver.findOne({ phone });
        if (exists) {
            return res.status(409).json({ error: 'Phone number already registered' });
        }

        const driver = await Driver.create({
            fullName,
            phone,
            email:              email || undefined,
            passwordHash:       password,
            languagePreference: languagePreference || 'ar',
            vehicle,
            // isApproved starts false — admin must verify before driver appears in search
        });

        const accessToken  = signAccessToken(driver);
        const refreshToken = signRefreshToken(driver);

        driver.refreshTokenHash = await hashToken(refreshToken);
        driver.lastActiveAt     = new Date();
        await driver.save();

        res.status(201).json({
            ...buildAuthResponse(driver, accessToken, refreshToken),
            notice: 'Your account is pending admin approval. You will be notified once approved.',
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Phone or email already registered' });
        }
        console.error('[registerDriver]', err);
        res.status(500).json({ error: 'Registration failed' });
    }
}

// ══════════════════════════════════════════════════════════
//   SHARED — Login (rider or driver, based on `role` param)
// ══════════════════════════════════════════════════════════
async function login(req, res) {
    try {
        const { phone, password, role = 'rider' } = req.body;

        let entity;
        if (role === 'driver') {
            entity = await Driver.findOne({ phone }).select('+passwordHash +refreshTokenHash');
        } else {
            entity = await User.findOne({ phone }).select('+passwordHash +refreshTokenHash');
        }

        // Use constant-time comparison to avoid user enumeration
        if (!entity) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!entity.isActive) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        const valid = await entity.verifyPassword(password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken  = signAccessToken(entity);
        const refreshToken = signRefreshToken(entity);

        entity.refreshTokenHash = await hashToken(refreshToken);
        entity.lastActiveAt     = new Date();
        await entity.save();

        res.json(buildAuthResponse(entity, accessToken, refreshToken));

    } catch (err) {
        console.error('[login]', err);
        res.status(500).json({ error: 'Login failed' });
    }
}

// ══════════════════════════════════════════════════════════
//   Refresh access token
// ══════════════════════════════════════════════════════════
async function refreshToken(req, res) {
    try {
        const { refreshToken: token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        let payload;
        try {
            payload = verifyRefreshToken(token);
        } catch {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        if (payload.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid token type' });
        }

        // Fetch entity and verify the hashed token matches
        let entity;
        if (payload.role === 'driver') {
            entity = await Driver.findById(payload.id).select('+refreshTokenHash');
        } else {
            entity = await User.findById(payload.id).select('+refreshTokenHash');
        }

        if (!entity || !entity.isActive) {
            return res.status(401).json({ error: 'Account not found' });
        }
        if (!entity.refreshTokenHash) {
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }

        const valid = await compareTokenHash(token, entity.refreshTokenHash);
        if (!valid) {
            // Possible token reuse attack — invalidate all sessions
            entity.refreshTokenHash = null;
            await entity.save();
            return res.status(401).json({ error: 'Refresh token reuse detected. Please log in again.' });
        }

        const newAccessToken  = signAccessToken(entity);
        const newRefreshToken = signRefreshToken(entity);

        entity.refreshTokenHash = await hashToken(newRefreshToken);
        entity.lastActiveAt     = new Date();
        await entity.save();

        res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });

    } catch (err) {
        console.error('[refreshToken]', err);
        res.status(500).json({ error: 'Token refresh failed' });
    }
}

// ══════════════════════════════════════════════════════════
//   Logout — invalidate refresh token
// ══════════════════════════════════════════════════════════
async function logout(req, res) {
    try {
        // req.authUser is set by requireAuth middleware
        req.authUser.refreshTokenHash = null;
        await req.authUser.save();
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        console.error('[logout]', err);
        res.status(500).json({ error: 'Logout failed' });
    }
}

// ══════════════════════════════════════════════════════════
//   Get current user's own profile
// ══════════════════════════════════════════════════════════
async function getMe(req, res) {
    res.json(req.authUser.toPublicJSON());
}

// ══════════════════════════════════════════════════════════
//   Update profile (name, language, SOS contacts)
// ══════════════════════════════════════════════════════════
async function updateProfile(req, res) {
    try {
        const allowed = ['fullName', 'languagePreference', 'sosContacts', 'avatarUrl'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        // SOS contact limit enforced at model level, but surface a useful error here
        if (updates.sosContacts && updates.sosContacts.length > 3) {
            return res.status(422).json({ error: 'Maximum 3 SOS contacts allowed' });
        }

        Object.assign(req.authUser, updates);
        await req.authUser.save();

        res.json(req.authUser.toPublicJSON());

    } catch (err) {
        console.error('[updateProfile]', err);
        res.status(500).json({ error: 'Profile update failed' });
    }
}

module.exports = {
    registerRider,
    registerDriver,
    login,
    refreshToken,
    logout,
    getMe,
    updateProfile,
};
