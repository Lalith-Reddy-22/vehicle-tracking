/**
 * AppContext: global state shared across the dashboard.
 * Keeps vehicles and geofences cached at the top level to avoid redundant
 * API calls when navigating between pages.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { getVehicles, getGeofences } from '../services/api';
import type { Vehicle, Geofence, WSAlert } from '../types';

interface AppContextValue {
  vehicles: Vehicle[];
  geofences: Geofence[];
  recentAlerts: WSAlert[];
  refreshVehicles: () => Promise<void>;
  refreshGeofences: () => Promise<void>;
  addAlert: (alert: WSAlert) => void;
  clearAlerts: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<WSAlert[]>([]);

  const refreshVehicles = useCallback(async () => {
    try {
      const res = await getVehicles();
      setVehicles(res.data || []);
    } catch (err) {
      console.error('Failed to load vehicles', err);
    }
  }, []);

  const refreshGeofences = useCallback(async () => {
    try {
      const res = await getGeofences();
      setGeofences(res.data || []);
    } catch (err) {
      console.error('Failed to load geofences', err);
    }
  }, []);

  const addAlert = useCallback((alert: WSAlert) => {
    setRecentAlerts(prev => [alert, ...prev].slice(0, 50)); // keep last 50
  }, []);

  const clearAlerts = useCallback(() => {
    setRecentAlerts([]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        vehicles,
        geofences,
        recentAlerts,
        refreshVehicles,
        refreshGeofences,
        addAlert,
        clearAlerts,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
};
