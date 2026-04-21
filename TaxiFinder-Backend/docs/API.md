# TaxiGo REST API Reference (Phase 1)

Base URL: `http://localhost:3000/api`
Protected routes require: `Authorization: Bearer <accessToken>`

---

## Auth  `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/rider/register` | — | Register a new passenger |
| POST | `/driver/register` | — | Register a new driver (pending approval) |
| POST | `/login` | — | Login (pass `role: "rider"` or `"driver"`) |
| POST | `/refresh` | — | Exchange refresh token for a new access token |
| POST | `/logout` | YES | Invalidate current session |
| GET  | `/me` | YES | Get own full profile |
| PATCH | `/me` | YES | Update name, language, SOS contacts |

### POST /rider/register — body
```json
{
  "fullName": "Fatima Zahra",
  "phone": "+212600000001",
  "email": "fatima@example.com",
  "password": "SecurePass1",
  "languagePreference": "ar"
}
```

### POST /driver/register — body
```json
{
  "fullName": "Hassan Tazi",
  "phone": "+212600000002",
  "password": "SecurePass1",
  "languagePreference": "fr",
  "vehicle": {
    "make": "Toyota", "model": "Corolla",
    "year": 2022, "color": "White",
    "licensePlate": "12345-A-1",
    "capacity": 4,
    "type": "grand_taxi"
  }
}
```
Driver `isApproved` defaults to `false`. An admin must call
`PATCH /api/drivers/:id/approve` before the driver appears in any search result.

---

## Drivers  `/api/drivers`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/nearby` | — | Approved online drivers near a GPS point |
| GET | `/:id` | — | Public driver profile |
| PATCH | `/me/location` | Driver | Push live GPS update |
| PATCH | `/me/availability` | Driver | Toggle online / offline |
| GET | `/` | Admin | List all drivers |
| PATCH | `/:id/approve` | Admin | Approve a pending driver |

`GET /nearby?lat=35.75&lng=-5.83&radius=3000&type=grand_taxi`

**Guarantee:** only returns drivers where `isApproved=true AND isActive=true AND status=online AND available=true`. No hardcoded or dummy data can ever appear.

---

## Rides  `/api/rides`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Rider | Create private or shared ride |
| POST | `/:rideId/join` | Rider | Join an open shared ride |
| GET | `/shared/available` | — | List joinable shared rides near a point |
| GET | `/history` | YES | Ride history |
| GET | `/:rideId` | YES | Single ride detail |
| PATCH | `/:rideId/accept` | Driver | Accept ride |
| PATCH | `/:rideId/start` | Driver | Start ride |
| PATCH | `/:rideId/complete` | Driver | Complete ride |
| PATCH | `/:rideId/cancel` | YES | Cancel ride |
| POST | `/:rideId/rate` | YES | Submit rating |

### Shared ride status flow
```
open  ──(passengers join)──>  open  ──(driver accepts)──>  driver_found
  └──(driver accepts)──────────────────────────────────>  driver_found
                                                              │
                                                       in_progress
                                                              │
                                                          completed
```

---

## Socket.IO

Connect: `io(SERVER_URL, { auth: { token: ACCESS_TOKEN } })`

| Event | Who emits | Payload |
|-------|-----------|---------|
| `driver:location` | Driver client | `{ location:{lat,lng}, bearing }` |
| `driver:location:update` | Server→all | `{ driverId, location, bearing }` |
| `ride:join` | Client | `{ rideId }` — joins socket room |
| `ride:new_request` | Server→Driver | `{ rideId, type, fareMAD, pickup, dropoff }` |
| `ride:driver_found` | Server→Rider | `{ rideId, driverId }` |
| `ride:passenger_joined` | Server→Driver | `{ rideId, availableSeats }` |
| `ride:status_update` | Server→room | `{ rideId, status }` |
| `ride:completed` | Server→room | `{ rideId, totalFareMAD }` |
| `ride:cancelled` | Server→room | `{ rideId, cancelledBy }` |
