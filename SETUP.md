# Vehicle Tracking Platform — Setup Guide

## 1. Project Overview

A production-quality real-time vehicle tracking and geofencing platform built for the MapUp hiring assessment.

The system ingests GPS coordinates, detects geofence boundary crossings (entry and exit), persists violations, evaluates alert rules, and broadcasts WebSocket notifications to all connected dashboard clients in real time.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  Vite · TypeScript · Tailwind · Leaflet · Zustand   │
└───────────────────┬──────────────────────────────────┘
                    │ HTTP REST / WebSocket
┌───────────────────▼──────────────────────────────────┐
│                  Go Backend (Chi)                    │
│                                                      │
│  Handlers → Services → Repositories → PostgreSQL    │
│                    │                                 │
│            WebSocket Hub (single goroutine)          │
└───────────────────┬──────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────┐
│          PostgreSQL 14+ with PostGIS 3.x             │
│   GIST spatial index · ST_Covers · UUID PKs         │
└──────────────────────────────────────────────────────┘
```

**Data flow for a GPS update:**

1. `POST /vehicles/location` → Handler validates request
2. Service begins DB transaction with `SELECT FOR UPDATE` on the vehicle's location row
3. PostGIS `ST_Covers` query finds all geofences containing the new point
4. Set diff against `vehicle_geofence_state` produces entered/exited zones
5. Violations persisted, geofence state replaced atomically
6. Alert rules evaluated; matching alerts queued to WebSocket hub (non-blocking)
7. Transaction commits; HTTP response returned
8. Hub broadcasts alerts to all connected clients

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Backend language | Go 1.23 |
| HTTP router | Chi v5 |
| Database driver | pgx v5 (pgxpool) |
| Geospatial | PostgreSQL 14 + PostGIS 3.x |
| Real-time | Gorilla WebSocket v1.5 |
| Logging | zerolog |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Maps | Leaflet.js + react-leaflet |
| State | React Context |
| HTTP client | Axios |
| Routing | React Router v7 |

---

## 4. Prerequisites

- Go 1.23+
- Node.js 20+
- PostgreSQL 14+ with PostGIS 3.x installed
- Docker + Docker Compose (for containerized setup)
- Git

---

## 5. Local Installation

### Clone

```bash
git clone <your-repo-url>
cd vehicle-tracking
```

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL to point to your PostgreSQL instance
go mod download
go build ./cmd/api
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env — set VITE_API_BASE_URL and VITE_WS_URL
npm install
```

---

## 6. Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `8080` |
| `ENV` | `development` or `production` | `development` |
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `CORS_ALLOWED_ORIGINS` | Space-separated allowed origins | `http://localhost:5173` |
| `DB_MAX_CONNS` | Max pool connections | `20` |
| `WS_CLIENT_BUFFER_SIZE` | Per-client WS send buffer | `256` |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (no trailing slash) |
| `VITE_WS_URL` | WebSocket URL |

---

## 7. Database Initialization

Create the database (if not using Docker):

```bash
psql postgres -c "CREATE USER vtrack WITH PASSWORD 'vtrack_pass';"
psql postgres -c "CREATE DATABASE vehicle_tracking OWNER vtrack;"
psql vehicle_tracking -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Migrations run automatically at server startup. They are stored in `backend/migrations/` as numbered SQL files and tracked in a `schema_migrations` table.

---

## 8. Migration Files

| File | Purpose |
|---|---|
| `001_extensions.sql` | Enable uuid-ossp and PostGIS |
| `002_geofences.sql` | Geofences table + GIST index |
| `003_vehicles.sql` | Vehicles table |
| `004_vehicle_locations.sql` | Latest GPS fix per vehicle |
| `005_vehicle_geofence_state.sql` | Active zone memberships |
| `006_alert_rules.sql` | Alert rule definitions |
| `007_violations.sql` | Entry/exit history |

---

## 9. Docker Setup

```bash
# From project root
docker compose up -d
```

Services:
- `postgres` — PostGIS-enabled PostgreSQL on port 5432
- `backend`  — Go API on port 8080
- `frontend` — Nginx-served React app on port 5173

The backend service waits for the postgres healthcheck before starting.

---

## 10. Backend Startup

```bash
cd backend
go run ./cmd/api
# or
go build -o server ./cmd/api && ./server
```

Expected output:
```
database connected host=localhost database=vehicle_tracking
applied migration 001_extensions.sql
...
server starting addr=:8080 env=development
```

---

## 11. Frontend Startup

```bash
cd frontend
npm run dev
# Open http://localhost:5173
```

---

## 12. API Endpoint Documentation

All responses include `"time_ns": "<nanoseconds>"` as a string.

### POST /geofences

Create a geofence polygon.

**Request:**
```json
{
  "name": "Bangalore Delivery Zone",
  "category": "delivery_zone",
  "coordinates": [
    [12.97, 77.59],
    [12.98, 77.59],
    [12.98, 77.60],
    [12.97, 77.60],
    [12.97, 77.59]
  ]
}
```

Coordinates are `[latitude, longitude]` pairs. The ring must be closed (first == last).

### GET /geofences

List all geofences. Optional `?category=` filter.

### POST /vehicles

Register a vehicle.

**Request:**
```json
{
  "vehicle_number": "KA01AB1234",
  "driver_name": "Ravi Kumar",
  "vehicle_type": "truck",
  "phone": "9876543210"
}
```

Returns HTTP 409 for duplicate `vehicle_number`.

### GET /vehicles

List all vehicles.

### POST /vehicles/location

Update a vehicle's GPS position. This is the core business endpoint — it triggers geofence detection, violation persistence, and WebSocket alerts.

**Request:**
```json
{
  "vehicle_id": "uuid",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "timestamp": "2026-11-12T10:30:00Z"
}
```

**Response:**
```json
{
  "location": { "vehicle_id": "...", "latitude": 12.9716, "longitude": 77.5946, "timestamp": "..." },
  "inside_geofences": [{ "id": "...", "name": "...", "category": "delivery_zone" }],
  "events": [{ "geofence_id": "...", "event_type": "enter", "alert_sent": true }],
  "time_ns": "1234567"
}
```

Returns HTTP 409 when the timestamp is older than the last accepted update.

### GET /vehicles/location/{id}

Get current position and zone membership for a vehicle.

### POST /alert-rules

Create an alert rule.

**Request:**
```json
{
  "vehicle_id": null,
  "geofence_id": "uuid",
  "event_type": "enter",
  "is_active": true
}
```

`vehicle_id: null` applies the rule to all vehicles.
`event_type` is `"enter"`, `"exit"`, or `"both"`.

### GET /alert-rules

List all alert rules.

### GET /violations/history

Paginated violation history.

**Query parameters:**
- `vehicle_id` — filter by vehicle
- `geofence_id` — filter by geofence
- `event_type` — `enter` or `exit`
- `start` / `end` — RFC3339 timestamps
- `limit` — default 50, max 500
- `offset` — default 0

---

## 13. curl Examples

```bash
BASE=http://localhost:8080

# Create a geofence
curl -X POST $BASE/geofences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Koramangala Zone",
    "category": "delivery_zone",
    "coordinates": [
      [12.9270, 77.6270],
      [12.9370, 77.6270],
      [12.9370, 77.6370],
      [12.9270, 77.6370],
      [12.9270, 77.6270]
    ]
  }'

# List geofences
curl $BASE/geofences

# Filter by category
curl "$BASE/geofences?category=restricted_zone"

# Register a vehicle
curl -X POST $BASE/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_number": "KA01AB1234",
    "driver_name": "Ravi Kumar",
    "vehicle_type": "Truck",
    "phone": "9876543210"
  }'

# List vehicles
curl $BASE/vehicles

# Update vehicle location (triggers geofence detection)
curl -X POST $BASE/vehicles/location \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "<vehicle-uuid>",
    "latitude": 12.9316,
    "longitude": 77.6316,
    "timestamp": "2026-11-12T10:30:00Z"
  }'

# Get current location
curl $BASE/vehicles/location/<vehicle-uuid>

# Create alert rule (all vehicles, enter event)
curl -X POST $BASE/alert-rules \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_id": "<geofence-uuid>",
    "event_type": "enter",
    "is_active": true
  }'

# List alert rules
curl $BASE/alert-rules

# Violation history with filters
curl "$BASE/violations/history?limit=20&offset=0"
curl "$BASE/violations/history?vehicle_id=<uuid>&event_type=enter"
curl "$BASE/violations/history?start=2026-11-01T00:00:00Z&end=2026-11-30T23:59:59Z"
```

---

## 14. WebSocket Testing

Connect to the WebSocket endpoint:

```bash
# Using websocat (install: brew install websocat)
websocat ws://localhost:8080/ws/alerts

# Using wscat (install: npm install -g wscat)
wscat -c ws://localhost:8080/ws/alerts
```

Then in another terminal, send a vehicle location update that enters a geofence. You will see an alert arrive on the WebSocket connection immediately:

```json
{
  "event": "geofence_entry",
  "vehicle_id": "...",
  "vehicle_number": "KA01AB1234",
  "geofence_id": "...",
  "geofence_name": "Koramangala Zone",
  "event_type": "enter",
  "timestamp": "2026-11-12T10:30:00Z",
  "message": "Vehicle KA01AB1234 entered Koramangala Zone"
}
```

---

## 15. Deployment

### Backend (Docker Hub + Cloud)

```bash
# Build and tag
docker build -t yourdockerhub/vtrack-backend:latest ./backend

# Push
docker push yourdockerhub/vtrack-backend:latest

# Deploy on any container host (Railway, Render, Fly.io, EC2)
# Set environment variables:
#   DATABASE_URL=postgres://...
#   PORT=8080
#   ENV=production
#   CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### Frontend (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

cd frontend
vercel deploy --prod \
  --env VITE_API_BASE_URL=https://your-backend.example.com \
  --env VITE_WS_URL=wss://your-backend.example.com/ws/alerts
```

Add a `vercel.json` in `frontend/` for SPA routing:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Important:** Use `wss://` (not `ws://`) when the frontend is served over HTTPS.

---

## 16. Known Limitations

1. **Migration runner** is a lightweight custom implementation. For production, use golang-migrate or Flyway.
2. **WebSocket scale-out**: the hub is single-process. Multi-instance deployments need Redis Pub/Sub for cross-instance broadcasting.
3. **No authentication**: the API is open. Add JWT middleware before production use.
4. **Violation table growth**: no automatic pruning. Add PostgreSQL declarative partitioning for large fleets.

---

## 17. Design Decisions

### Coordinate ordering
The API accepts `[latitude, longitude]` to match Leaflet's LatLng convention. PostGIS requires `[longitude, latitude]` (GeoJSON convention). All conversions are centralized in `internal/geospatial/coordinates.go`. No other package touches raw coordinate order.

### First location update
On a vehicle's first GPS fix, we initialize `vehicle_geofence_state` without raising entry events. This prevents false alerts when a vehicle is simply powering on inside a zone it has been in all along.

### Restricted zone default alerts
Entry into a `restricted_zone` always fires an alert, even without a configured alert rule. This is documented here and in the service code. Exit from a restricted zone follows normal rule evaluation.

### ST_Covers vs ST_Contains
We use `ST_Covers` so points exactly on a polygon boundary are treated as inside. `ST_Contains` would exclude boundary points, causing missed events for vehicles driving exactly along a fence edge.

### Transaction isolation
The vehicle location row is locked with `SELECT FOR UPDATE` inside the update transaction. This serializes concurrent GPS updates for the same vehicle, preventing duplicate entry/exit events under high concurrency.

### WebSocket hub design
A single goroutine owns the clients map. All interactions go through channels. This avoids mutex contention and ensures slow clients cannot block message delivery to others via bounded send channels.

### time_ns response field
A middleware intercepts every JSON response, injects `"time_ns"` as a string (nanoseconds), then writes the enriched body. The spec requires this on every response including errors.

---

## 18. Testing Commands

```bash
# Backend unit tests
cd backend
go test ./tests/... -v

# With race detector
go test -race ./tests/... -v

# Full test suite (including integration, requires DB)
go test ./... -v

# Frontend type check + build
cd frontend
npm run build
```

---

## 19. Scalability Notes

The system is designed to scale horizontally with the following additions:

- **Redis Pub/Sub** for WebSocket broadcasting across multiple backend instances
- **Kafka/NATS** for buffering GPS ingestion spikes (decouple HTTP from spatial queries)
- **Spatial bounding-box pre-filter** (`ST_MakeEnvelope`) before `ST_Covers` for regions with thousands of geofences
- **PostgreSQL table partitioning** on `violations.timestamp` for multi-year history
- **Connection pooling via PgBouncer** in front of PostgreSQL
- **Separate read replicas** for violation history queries
