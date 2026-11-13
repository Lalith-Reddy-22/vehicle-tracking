/**
 * Centralized API service layer.
 * All Axios calls go through here — components never import Axios directly.
 * This makes swapping the base URL or adding auth headers a one-line change.
 */
import axios from 'axios';
import type {
  Geofence,
  CreateGeofenceRequest,
  Vehicle,
  CreateVehicleRequest,
  UpdateLocationRequest,
  UpdateLocationResponse,
  CurrentLocationResponse,
  AlertRule,
  CreateAlertRuleRequest,
  ViolationHistoryResponse,
} from '../types';

const getBaseURL = () => {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return '';
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
});

// ── Geofences ─────────────────────────────────────────────────────────────────

export const getGeofences = (category?: string): Promise<{ data: Geofence[] }> =>
  api.get('/geofences', { params: category ? { category } : {} }).then(r => r.data);

export const createGeofence = (req: CreateGeofenceRequest): Promise<Geofence> =>
  api.post('/geofences', req).then(r => r.data);

export const updateGeofence = (id: string, req: { name?: string; category?: string }): Promise<Geofence> =>
  api.patch(`/geofences/${id}`, req).then(r => r.data);

export const deleteGeofence = (id: string): Promise<void> =>
  api.delete(`/geofences/${id}`).then(() => undefined);

// ── Vehicles ──────────────────────────────────────────────────────────────────

export const getVehicles = (): Promise<{ data: Vehicle[] }> =>
  api.get('/vehicles').then(r => r.data);

export const createVehicle = (req: CreateVehicleRequest): Promise<Vehicle> =>
  api.post('/vehicles', req).then(r => r.data);

export const updateVehicle = (id: string, req: { driver_name?: string; vehicle_type?: string; phone?: string }): Promise<Vehicle> =>
  api.patch(`/vehicles/${id}`, req).then(r => r.data);

export const deleteVehicle = (id: string): Promise<void> =>
  api.delete(`/vehicles/${id}`).then(() => undefined);

export const getVehicleLocation = (id: string): Promise<CurrentLocationResponse> =>
  api.get(`/vehicles/location/${id}`).then(r => r.data);

export const updateVehicleLocation = (req: UpdateLocationRequest): Promise<UpdateLocationResponse> =>
  api.post('/vehicles/location', req).then(r => r.data);

// ── Alert Rules ───────────────────────────────────────────────────────────────

export const getAlertRules = (): Promise<{ data: AlertRule[] }> =>
  api.get('/alert-rules').then(r => r.data);

export const createAlertRule = (req: CreateAlertRuleRequest): Promise<AlertRule> =>
  api.post('/alert-rules', req).then(r => r.data);

export const updateAlertRule = (id: string, req: { name?: string; event_type?: string; is_active?: boolean }): Promise<AlertRule> =>
  api.patch(`/alert-rules/${id}`, req).then(r => r.data);

export const deleteAlertRule = (id: string): Promise<void> =>
  api.delete(`/alert-rules/${id}`).then(() => undefined);

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_vehicles: number;
  total_geofences: number;
  total_violations: number;
  active_alert_rules: number;
  time_ns: string;
}

export const getStats = (): Promise<DashboardStats> =>
  api.get('/stats').then(r => r.data);

// ── Violations ────────────────────────────────────────────────────────────────

export interface ViolationFilters {
  vehicle_id?: string;
  geofence_id?: string;
  event_type?: string;
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

export const getViolationHistory = (filters: ViolationFilters = {}): Promise<ViolationHistoryResponse> =>
  api.get('/violations/history', { params: filters }).then(r => r.data);
