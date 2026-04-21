# TaxiGo Backend — Folder Structure & Setup Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in your values
cp .env.example .env

# 3. Start MongoDB locally (or use Atlas URI in .env)
# macOS:  brew services start mongodb-community
# Linux:  sudo systemctl start mongod

# 4. Run in development mode (auto-restarts on file change)
npm run dev

# 5. Verify the server is healthy
curl http://localhost:3000/api/health
```

---

## Complete File Map

```
taxigo-backend/
│
├── server.js                   ← Entry point. Boots Express, MongoDB, Socket.IO
│
├── package.json                ← Dependencies & npm scripts
├── .env.example                ← Environment variable template  ← COPY → .env
├── .gitignore                  ← Excludes .env, node_modules, logs
│
├── config/
│   ├── database.js             ← Mongoose connection with exponential back-off retry
│   └── socket.js               ← Socket.IO server factory (JWT middleware on WS)
│
├── models/
│   ├── User.js                 ← Passenger schema
│   │                              Fields: fullName, phone, email, passwordHash,
│   │                                      premium{active,expiresAt,plan},
│   │                                      ratings{average,count,history[]},
│   │                                      languagePreference, sosContacts[],
│   │                                      refreshTokenHash, stats
│   │
│   ├── Driver.js               ← Driver schema (separate collection)
│   │                              Fields: same identity fields as User +
│   │                                      vehicle{make,model,year,color,
│   │                                              licensePlate,capacity,type},
│   │                                      isApproved, status, available,
│   │                                      location{GeoJSON Point},
│   │                                      documents[], premium, ratings,
│   │                                      languagePreference, sosContacts[],
│   │                                      stats{totalRides,totalEarnedMAD,...}
│   │
│   └── Ride.js                 ← Ride schema (supports shared/grand-taxi rides)
│                                  Fields: type{private|shared},
│                                          driverId, maxPassengers,
│                                          passengers[]{userId, pickupLocation,
│                                                       dropoffLocation, fareMAD,
│                                                       status, paymentMethod, ...},
│                                          originLocation, destinationLocation,
│                                          status, carType, totalFareMAD, ...
│
├── middleware/
│   ├── auth.js                 ← requireAuth   – verifies Bearer JWT
│   │                              requireRole   – e.g. requireRole('admin')
│   │                              requireApprovedDriver – isApproved gate
│   │                              optionalAuth  – attaches user if token present
│   │
│   ├── validate.js             ← express-validator rule sets for every route
│   │                              Exports: registerRiderRules, registerDriverRules,
│   │                                       loginRules, rideRequestRules,
│   │                                       joinSharedRideRules, ratingRules,
│   │                                       sosContactRules, handleValidation
│   │
│   └── rateLimiter.js          ← apiLimiter  – 100 req / 15 min (all /api/)
│                                  authLimiter – 10 req / 15 min (auth routes)
│
├── controllers/
│   ├── authController.js       ← registerRider, registerDriver, login,
│   │                              refreshToken, logout, getMe, updateProfile
│   │
│   ├── driverController.js     ← getNearbyDrivers, getDriverProfile,
│   │                              updateLocation, updateAvailability,
│   │                              approveDriver (admin), listDrivers (admin)
│   │
│   └── rideController.js       ← createRide, joinSharedRide,
│                                  listAvailableSharedRides, getRide,
│                                  acceptRide, startRide, completeRide,
│                                  cancelRide, rateRide, getRideHistory
│
├── routes/
│   ├── auth.js                 ← POST /api/auth/rider/register
│   │                              POST /api/auth/driver/register
│   │                              POST /api/auth/login
│   │                              POST /api/auth/refresh
│   │                              POST /api/auth/logout       [auth]
│   │                              GET  /api/auth/me           [auth]
│   │                              PATCH /api/auth/me          [auth]
│   │
│   ├── drivers.js              ← GET   /api/drivers/nearby             [public]
│   │                              GET   /api/drivers/:id               [public]
│   │                              PATCH /api/drivers/me/location       [driver]
│   │                              PATCH /api/drivers/me/availability   [driver]
│   │                              GET   /api/drivers/                  [admin]
│   │                              PATCH /api/drivers/:id/approve       [admin]
│   │
│   └── rides.js                ← POST  /api/rides/                     [rider]
│                                  POST  /api/rides/:id/join             [rider]
│                                  GET   /api/rides/shared/available    [public]
│                                  GET   /api/rides/history             [auth]
│                                  GET   /api/rides/:id                 [auth]
│                                  PATCH /api/rides/:id/accept          [driver]
│                                  PATCH /api/rides/:id/start           [driver]
│                                  PATCH /api/rides/:id/complete        [driver]
│                                  PATCH /api/rides/:id/cancel          [auth]
│                                  POST  /api/rides/:id/rate            [auth]
│
└── utils/
    ├── jwt.js                  ← signAccessToken, signRefreshToken,
    │                              verifyAccessToken, verifyRefreshToken,
    │                              hashToken, compareTokenHash,
    │                              generateRandomToken
    │
    └── fareCalculator.js       ← calculatePrivateFare, calculateSharedFare,
                                   haversineKm, getSurgeMultiplier, FARE_TABLE

```

---

## How the files wire together

```
HTTP Request
     │
     ▼
server.js  ──loads──►  config/database.js   (MongoDB)
           ──loads──►  config/socket.js     (Socket.IO + JWT WS auth)
           ──mounts──► middleware/rateLimiter.js  (global)
           ──mounts──► routes/auth.js
           ──mounts──► routes/drivers.js
           ──mounts──► routes/rides.js
                │
                ▼
           Each route applies:
             middleware/validate.js   (input validation)
             middleware/auth.js       (JWT verification)
                │
                ▼
           controllers/*.js
             ├── uses models/ for DB queries
             ├── uses utils/jwt.js for token ops
             ├── uses utils/fareCalculator.js for pricing
             └── emits via req.io (Socket.IO injected in server.js)
```

---

## Environment Variables Reference

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `NODE_ENV` | Yes | `development` | Controls logging format and CORS |
| `PORT` | No | `3000` | HTTP port (default 3000) |
| `MONGO_URI` | Yes | `mongodb://localhost:27017/taxigo` | MongoDB connection string |
| `JWT_SECRET` | Yes | 64-byte hex string | Signs access tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Access token lifetime |
| `JWT_REFRESH_SECRET` | Yes | 64-byte hex string | Signs refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | No | `30d` | Refresh token lifetime |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing cost (10–14 recommended) |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window (general) |
| `AUTH_RATE_LIMIT_MAX` | No | `10` | Max requests per window (auth endpoints) |
| `ALLOWED_ORIGINS` | Yes | `http://localhost:3000` | Comma-separated CORS whitelist |

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## npm Scripts

| Command | What it does |
|---------|-------------|
| `npm start` | Production start (`node server.js`) |
| `npm run dev` | Development start with nodemon (auto-restart) |

---

## First-time Admin Setup

There is no admin account seeded by default — create one directly in MongoDB:

```js
// mongosh
use taxigo
db.users.insertOne({
  fullName: "Admin",
  phone: "+212600000000",
  passwordHash: "<bcrypt hash>",  // use bcryptjs to pre-hash
  role: "admin",
  isActive: true,
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

Or register a rider and then update their role:
```js
db.users.updateOne({ phone: "+212600000000" }, { $set: { role: "admin" } })
```

---

## Driver Approval Flow

1. Driver registers via `POST /api/auth/driver/register` → `isApproved: false`
2. Admin calls `PATCH /api/drivers/:id/approve` with an admin Bearer token
3. Driver's `isApproved` becomes `true` → they now appear in `GET /api/drivers/nearby`

This is the **only** way drivers enter the system. No seeding, no bypass.
