# Real-Time Vehicle Tracking & Geofencing Platform

**MapUp Hiring Assessment** — Full-stack fleet management system with real-time GPS tracking, geofence boundary detection, and WebSocket alert delivery.

## Quick Start

```bash
# Start everything with Docker
docker compose up -d

# Or run locally (requires PostgreSQL + PostGIS)
cd backend && go run ./cmd/api &
cd frontend && npm run dev
```

Open **http://localhost:5173**

## Features

- 🗺️ **Interactive map** — draw geofences, click to place vehicles
- 📍 **Real-time tracking** — GPS updates trigger instant boundary detection
- 🔔 **Live alerts** — WebSocket notifications to all connected clients
- ⚡ **PostGIS spatial queries** — `ST_Covers` with GIST index for fast lookup
- 🏗️ **Clean architecture** — Handlers → Services → Repositories
- 🧪 **Tested** — 35 unit tests covering all core business logic

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /geofences | Create geofence |
| GET | /geofences | List geofences |
| POST | /vehicles | Register vehicle |
| GET | /vehicles | List vehicles |
| POST | /vehicles/location | Update GPS + detect events |
| GET | /vehicles/location/{id} | Current position |
| POST | /alert-rules | Create alert rule |
| GET | /alert-rules | List rules |
| GET | /violations/history | Paginated history |
| GET | /ws/alerts | WebSocket alert stream |

## Stack

**Backend:** Go · Chi · pgx · PostGIS · Gorilla WebSocket · zerolog  
**Frontend:** React · TypeScript · Vite · Tailwind CSS · Leaflet  
**Infrastructure:** Docker · PostgreSQL 14 + PostGIS 3

See [SETUP.md](./SETUP.md) for full documentation.
