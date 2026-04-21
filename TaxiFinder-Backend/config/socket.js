'use strict';

/**
 * config/socket.js  (Phase 3 — complete)
 *
 * Changes vs the Phase 2 version:
 *   1. socket.data.userId / socket.data.userName stored at connect time
 *      so downstream handlers can identify the sender without a DB call.
 *   2. chat:message event — broadcasts to everyone else in `ride:{id}` room.
 *   3. ride:join now also stores per-socket metadata for room targeting.
 *   4. driver:location forwarded to the correct ride room (not global broadcast).
 */

const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const User       = require('../models/User');
const Driver     = require('../models/Driver');

/**
 * Attaches a Socket.IO server to the given HTTP server.
 * Returns the io instance for use in route handlers (via req.io).
 */
function createSocketServer(httpServer) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const io = new Server(httpServer, {
        cors: {
            origin:      allowedOrigins.length ? allowedOrigins : '*',
            methods:     ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout:  30000,
        pingInterval: 10000,
    });

    // ── JWT middleware ────────────────────────────────────
    io.use(async (socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication token required'));
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'taxigo_dev_access_secret_change_in_prod');
        } catch {
            return next(new Error('Invalid or expired token'));
        }

        // Attach identity to socket so event handlers know who's talking
        socket.data.userId = decoded.id;
        socket.data.role   = decoded.role;

        // Fetch display name (for chat attribution) — best-effort, non-blocking
        try {
            const Model = decoded.role === 'driver' ? Driver : User;
            const entity = await Model.findById(decoded.id).select('fullName').lean();
            socket.data.userName = entity?.fullName || 'Unknown';
        } catch {
            socket.data.userName = 'Unknown';
        }

        next();
    });

    // ── Connection handler ────────────────────────────────
    io.on('connection', (socket) => {
        const { userId, role, userName } = socket.data;
        console.log(`[Socket] ${role} connected: ${userName} (${userId}) — socket ${socket.id}`);

        // ── Personal room (for targeted server→client events) ──
        socket.join(`user:${userId}`);
        if (role === 'driver') socket.join('drivers');

        // ── Driver: broadcast live location to riders ──────
        socket.on('driver:location', (payload) => {
            if (role !== 'driver') return;
            socket.broadcast.emit('driver:location:update', {
                driverId: userId,
                location: payload.location,
                bearing:  payload.bearing || 0,
            });
        });

        // ── Driver: toggle availability ────────────────────
        socket.on('driver:availability', (payload) => {
            if (role !== 'driver') return;
            socket.broadcast.emit('driver:availability:update', {
                driverId:  userId,
                available: payload.available,
                status:    payload.status,
            });
        });

        // ── Join a ride room (both rider and driver call this) ──
        socket.on('ride:join', ({ rideId }) => {
            if (!rideId) return;
            const room = `ride:${rideId}`;
            socket.join(room);
            socket.data.currentRideId = rideId;
            console.log(`[Socket] ${userName} joined room ${room}`);
        });

        // ── Phase 3: Real-time chat ────────────────────────
        //
        // Flow:
        //   Client emits: { rideId, text, ts }
        //   Server validates → broadcasts to everyone ELSE in ride:rideId
        //   Other party receives: { rideId, from, text, ts }
        //
        // Messages are NOT persisted to DB by default.
        // To enable persistence, uncomment the Ride.findByIdAndUpdate below.
        socket.on('chat:message', async ({ rideId, text, ts }) => {
            // Guard: basic validation
            if (!rideId || typeof text !== 'string' || !text.trim()) return;

            // Guard: sender must be in the ride room
            const rooms = Array.from(socket.rooms);
            if (!rooms.includes(`ride:${rideId}`)) {
                // Auto-join if they forgot (handles reconnects gracefully)
                socket.join(`ride:${rideId}`);
            }

            const sanitisedText = text.trim().slice(0, 200); // hard-cap length
            const timestamp     = ts || new Date().toISOString();

            // Broadcast to everyone else in the ride room
            socket.to(`ride:${rideId}`).emit('chat:message', {
                rideId,
                from: userName,
                text: sanitisedText,
                ts:   timestamp,
            });

            // ── Optional: persist to DB ──────────────────
            // Uncomment once you add chatLog to Ride schema (see notes):
            //
            // try {
            //     const Ride = require('../models/Ride');
            //     await Ride.findByIdAndUpdate(rideId, {
            //         $push: {
            //             chatLog: {
            //                 senderId: userId,
            //                 senderName: userName,
            //                 text: sanitisedText,
            //                 ts: new Date(timestamp),
            //             },
            //         },
            //     });
            // } catch (err) {
            //     console.error('[Socket chat:persist]', err.message);
            // }
        });

        // ── Disconnect ────────────────────────────────────
        socket.on('disconnect', (reason) => {
            console.log(`[Socket] Disconnected: ${userName} (${reason})`);
            if (role === 'driver') {
                io.emit('driver:offline', { driverId: userId });
            }
        });

        // ── Error handler ─────────────────────────────────
        socket.on('error', (err) => {
            console.error(`[Socket error] ${userName}:`, err.message);
        });
    });

    return io;
}

module.exports = { createSocketServer };
