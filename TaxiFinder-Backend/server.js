'use strict';

// Load env vars FIRST
require('dotenv').config();

const express       = require('express');
const app           = express();
const http          = require('http');
const path          = require('path');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const authRoutes    = require('./routes/auth');
const driverRoutes  = require('./routes/drivers');
const rideRoutes    = require('./routes/rides');
const aiRoutes      = require('./routes/ai');          // Phase 4
const adminRoutes = require('./routes/admin_routes'); // ← FIX: was './routes/admin' (stub with only /login)

const { connectDB, closeDB }   = require('./config/database');
const { createSocketServer }   = require('./config/socket');
const apiLimiter               = require('./middleware/rateLimiter');

// ============================================================
//   Bootstrap
// ============================================================
const server = http.createServer(app);
const io     = createSocketServer(server);

// Make io accessible from route handlers via req.io
app.use((req, _res, next) => { req.io = io; next(); });

// ============================================================
//   Security middleware  (ORDER MATTERS)
// ============================================================

// 1. Helmet — secure HTTP headers
//    Phase 4: allow outbound fetch to api.x.ai (Grok) from server side.
//    The CSP connect-src only governs browser fetches, but we whitelist
//    it here so that any future client-side direct calls also work.

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-hashes'",
        "https://unpkg.com",
        "https://cdnjs.cloudflare.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://unpkg.com",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"   // ← FIX: Font Awesome .woff2 files load from here
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "wss:",
        "https://api.x.ai",
        "https://unpkg.com"
      ],
    },
  },
}));

// 2. CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || process.env.NODE_ENV === 'development') return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
}));

// 3. Body parsers
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// 4. Sanitise MongoDB operators — prevents NoSQL injection
app.use(mongoSanitize());

// 5. HTTP logger
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 6. Global API rate limiter
app.use('/api/', apiLimiter);

// ============================================================
//   Static frontend
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
//   API Routes
// ============================================================
app.use('/api/auth',    authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/rides',   rideRoutes);
app.use('/api/ai',      aiRoutes);      // Phase 4 — Grok AI
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status:  'ok',
        db:      'mongodb',
        env:     process.env.NODE_ENV,
        ai:      process.env.GROK_API_KEY ? 'grok-enabled' : 'grok-mock',
        uptime:  +process.uptime().toFixed(2),
        ts:      new Date().toISOString(),
    });
});

// SPA fallback
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
//   Global error handler  (must be last)
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    if (err.message && err.message.startsWith('CORS')) {
        return res.status(403).json({ error: err.message });
    }
    console.error('[Unhandled Error]', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
});

// ============================================================
//   Start
// ============================================================
const PORT = parseInt(process.env.PORT, 10) || 3000;

async function start() {
    try {
        await connectDB();
        server.listen(PORT, () => {
            const aiMode = process.env.GROK_API_KEY ? '🤖 Grok AI LIVE' : '🤖 Grok AI MOCK';
            console.log('\n╔═══════════════════════════════════════════╗');
            console.log(`║  🚖  TaxiGo API  •  port ${PORT}               ║`);
            console.log(`║  ENV  : ${(process.env.NODE_ENV || 'development').padEnd(33)}║`);
            console.log('║  DB   : MongoDB                           ║');
            console.log('║  WS   : Socket.IO (JWT-authenticated)     ║');
            console.log(`║  ${aiMode.padEnd(42)}║`);
            console.log('╚═══════════════════════════════════════════╝\n');
        });
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
}

start();

// ============================================================
//   Graceful shutdown
// ============================================================
async function shutdown(signal) {
    console.log(`\n${signal} received — shutting down…`);
    server.close(async () => {
        await closeDB();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException',  (err) => { console.error('Uncaught:', err);  process.exit(1); });
process.on('unhandledRejection', (err) => { console.error('Unhandled:', err); process.exit(1); });
