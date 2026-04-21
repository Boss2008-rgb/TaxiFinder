// ─────────────────────────────────────────────────────────────────────────────
//  routes/drivers.js   (Phase 3 — adds premium route)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/driverController');
const { requireAuth, requireRole, requireApprovedDriver } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { body, query }      = require('express-validator');

// ── Public: nearby drivers ────────────────────────────
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

// ── Public: single driver profile ─────────────────────
router.get('/:id', ctrl.getDriverProfile);

// ── Driver: update own location ────────────────────────
router.patch(
    '/me/location',
    requireAuth,
    requireApprovedDriver,
    [
        body('lat').isFloat({ min: -90, max: 90 }),
        body('lng').isFloat({ min: -180, max: 180 }),
        body('bearing').optional().isFloat({ min: 0, max: 360 }),
    ],
    handleValidation,
    ctrl.updateLocation
);

// ── Driver: toggle availability ────────────────────────
router.patch(
    '/me/availability',
    requireAuth,
    requireApprovedDriver,
    [
        body('available').optional().isBoolean(),
        body('status').optional().isIn(['offline', 'online', 'on_ride']),
    ],
    handleValidation,
    ctrl.updateAvailability
);

// ── Phase 3: Driver activate premium ──────────────────
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

// ── Admin: list all drivers ────────────────────────────
router.get(
    '/',
    requireAuth,
    requireRole('admin'),
    ctrl.listDrivers
);

// ── Admin: approve driver ──────────────────────────────
router.patch(
    '/:id/approve',
    requireAuth,
    requireRole('admin'),
    ctrl.approveDriver
);

module.exports = router;


// ═════════════════════════════════════════════════════════════════════════════
//
//  config/socket.js  — ADD THESE SECTIONS for Phase 3 real-time chat
//  (paste the chat block into your existing createSocketServer function)
//
// ═════════════════════════════════════════════════════════════════════════════
/*

  // Inside your `io.on('connection', (socket) => { ... })` handler:

  // ── Ride room membership ──────────────────────────────
  socket.on('ride:join', ({ rideId }) => {
    socket.join(`ride:${rideId}`);
    socket.join(`user:${socket.data.userId}`);
  });

  // ── Phase 3: Real-time chat ───────────────────────────
  //
  // When one party sends a message the server:
  //   1. Saves the message to the ride (optional, see Chat schema note below)
  //   2. Broadcasts it to every OTHER socket in the ride room
  //
  socket.on('chat:message', async ({ rideId, text, ts }) => {
    if (!rideId || !text) return;

    const senderId   = socket.data.userId;
    const senderName = socket.data.userName || 'Unknown';

    // Broadcast to everyone else in the ride room
    socket.to(`ride:${rideId}`).emit('chat:message', {
      rideId,
      from: senderName,
      text: text.slice(0, 200),  // truncate server-side too
      ts:   ts || new Date().toISOString(),
    });

    // Optional: persist to DB
    // await Ride.findByIdAndUpdate(rideId, {
    //   $push: { chatLog: { senderId, text, ts } }
    // });
  });

  // ── Chat note ─────────────────────────────────────────
  // If you want persistent chat history, add this sub-schema to Ride.js:
  //
  // const chatMessageSchema = new mongoose.Schema({
  //   senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  //   text:     { type: String, maxlength: 200, required: true },
  //   ts:       { type: Date,   default: Date.now },
  // }, { _id: false });
  //
  // Then add to rideSchema: chatLog: { type: [chatMessageSchema], default: [] }

*/
