'use strict';

const mongoose = require('mongoose');

// ── Connection options ────────────────────────────────────
const MONGO_OPTIONS = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
};

// ── Event listeners (defined once) ───────────────────────
mongoose.connection.on('connected', () =>
    console.log('✅ [MongoDB] Connected to', mongoose.connection.name)
);
mongoose.connection.on('error', (err) =>
    console.error('❌ [MongoDB] Error:', err.message)
);
mongoose.connection.on('disconnected', () =>
    console.warn('⚠️  [MongoDB] Disconnected')
);

// ── Connect with exponential back-off ────────────────────
async function connectDB(retries = 5, delay = 2000) {
    const uri = process.env.MONGO_URI;

    if (!uri) {
        throw new Error('MONGO_URI is not defined in environment variables.');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await mongoose.connect(uri, MONGO_OPTIONS);
            return mongoose.connection;
        } catch (err) {
            if (attempt === retries) {
                console.error(`❌ [MongoDB] All ${retries} connection attempts failed.`);
                throw err;
            }
            const wait = delay * 2 ** (attempt - 1);
            console.warn(`⚠️  [MongoDB] Attempt ${attempt}/${retries} failed. Retrying in ${wait}ms…`);
            await new Promise((r) => setTimeout(r, wait));
        }
    }
}

// ── Graceful shutdown ────────────────────────────────────
async function closeDB() {
    await mongoose.connection.close();
    console.log('🛑 [MongoDB] Connection closed.');
}

module.exports = { connectDB, closeDB };
