// Central TypeScript type definitions — mirrors the Go models.
// All API responses are typed here.

export interface Coordinate {
  lat: number;
  lon: number;
}

export type GeofenceCategory =
  | 'delivery_zone'
  | 'restricted_zone'
  | 'toll_zone'
  | 'customer_area';

export interface Geofence {
  id: string;
  name: string;
  category: GeofenceCategory;
  coordinates: Coordinate[];
  created_at: string;
  updated_at: string;
}

export interface CreateGeofenceRequest {
  name: string;
  category: GeofenceCategory;
  /** [[lat, lon], ...] */
  coordinates: number[][];
}

// ── Vehicle ───────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  vehicle_number: string;
  driver_name: string;
  vehicle_type: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface CreateVehicleRequest {
  vehicle_number: string;
  driver_name: string;
  vehicle_type: string;
  phone: string;
}

// ── Location ──────────────────────────────────────────────────────────────────

export interface VehicleLocation {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  updated_at: string;
}

export interface UpdateLocationRequest {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface GeofenceRef {
  id: string;
  name: string;
  category: GeofenceCategory;
}

export interface LocationEvent {
  geofence_id: string;
  geofence_name: string;
  category: GeofenceCategory;
  event_type: 'enter' | 'exit';
  alert_sent: boolean;
}

export interface UpdateLocationResponse {
  location: VehicleLocation;
  inside_geofences: GeofenceRef[];
  events: LocationEvent[];
  time_ns: string;
}

export interface CurrentLocationResponse {
  vehicle: Vehicle;
  location: VehicleLocation | null;
  inside_geofences: GeofenceRef[];
  time_ns: string;
}

// ── Alert Rules ───────────────────────────────────────────────────────────────

export type AlertEventType = 'enter' | 'exit' | 'both';

export interface AlertRule {
  id: string;
  name?: string;
  vehicle_id: string | null;
  geofence_id: string | null;
  event_type: AlertEventType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRuleRequest {
  name?: string;
  vehicle_id?: string | null;
  geofence_id?: string | null;
  event_type: AlertEventType;
  is_active?: boolean;
}

// ── Violations ────────────────────────────────────────────────────────────────

export interface Violation {
  id: string;
  vehicle_id: string;
  vehicle_number: string;
  driver_name: string;
  geofence_id: string;
  geofence_name: string;
  category: GeofenceCategory;
  event_type: 'enter' | 'exit';
  timestamp: string;
  alert_triggered: boolean;
  created_at: string;
}

export interface ViolationHistoryResponse {
  data: Violation[];
  total_count: number;
  limit: number;
  offset: number;
  time_ns: string;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export interface WSAlert {
  event: 'geofence_entry' | 'geofence_exit';
  vehicle_id: string;
  vehicle_number: string;
  geofence_id: string;
  geofence_name: string;
  event_type: 'enter' | 'exit';
  timestamp: string;
  message: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
