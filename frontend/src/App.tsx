import React, { useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Radio, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
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

/** Inner app that has access to AppContext */
const AppInner: React.FC = () => {
  const { addAlert } = useAppContext();

  const handleAlert = useCallback(
    (alert: WSAlert) => {
      addAlert(alert);
      const isEnter = alert.event_type === 'enter';

      toast.custom(
        t => (
          <div
            className={`${
              t.visible ? 'animate-fade-in-up' : 'opacity-0'
            } max-w-sm w-full rounded-2xl bg-[#F7F2EB]/95 backdrop-blur-xl border ${
              isEnter
                ? 'border-[#8B9A6E]/55 shadow-warm-card'
                : 'border-rose-700/35 shadow-warm-card'
            } p-4 flex items-start gap-3.5`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                isEnter
                  ? 'bg-[#8B9A6E]/15 border-[#8B9A6E]/40 text-[#596543]'
                  : 'bg-rose-700/10 border-rose-700/25 text-rose-700'
              }`}
            >
              {isEnter ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-[#23281E] tracking-wide">
                  {alert.vehicle_number}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#596543]">
                  <Radio size={10} className="animate-pulse" /> LIVE
                </span>
              </div>
              <p className="text-xs text-[#4B5243] mt-1 leading-relaxed">{alert.message}</p>
              <p className="text-[10px] font-mono text-[#6E7565] mt-1.5">
                {alert.geofence_name} • {new Date(alert.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ),
        { duration: 5000 }
      );
    },
    [addAlert]
  );

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
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#F7F2EB',
            color: '#23281E',
            border: '1px solid #D6CCBE',
            boxShadow: '0 10px 28px rgba(35, 40, 30, 0.14)',
            borderRadius: '14px',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#8B9A6E', secondary: '#F7F2EB' },
          },
          error: {
            iconTheme: { primary: '#be123c', secondary: '#F7F2EB' },
          },
        }}
      />
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
