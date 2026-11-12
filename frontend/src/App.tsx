import React, { useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useAppContext } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { useWebSocket } from './hooks/useWebSocket';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { GeofencesPage } from './pages/GeofencesPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { AlertRulesPage } from './pages/AlertRulesPage';
import { ViolationHistoryPage } from './pages/ViolationHistoryPage';
import type { WSAlert } from './types';
import toast from 'react-hot-toast';

/** Inner app that has access to AppContext */
const AppInner: React.FC = () => {
  const { addAlert } = useAppContext();

  const handleAlert = useCallback((alert: WSAlert) => {
    addAlert(alert);
    toast.custom(
      (t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm bg-white shadow-lg rounded-xl border border-gray-200 p-4 flex gap-3`}>
          <div className="text-2xl">{alert.event_type === 'enter' ? '🟢' : '🔴'}</div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{alert.vehicle_number}</p>
            <p className="text-xs text-gray-600">{alert.message}</p>
          </div>
        </div>
      ),
      { duration: 5000 }
    );
  }, [addAlert]);

  const wsStatus = useWebSocket(handleAlert);

  return (
    <BrowserRouter>
      <Layout wsStatus={wsStatus}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/map" element={<LiveMapPage />} />
          <Route path="/geofences" element={<GeofencesPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/rules" element={<AlertRulesPage />} />
          <Route path="/history" element={<ViolationHistoryPage />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
