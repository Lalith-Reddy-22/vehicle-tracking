import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { getViolationHistory, getAlertRules, getStats } from '../services/api';
import type { DashboardStats } from '../services/api';
import { Truck, Hexagon, AlertTriangle, Shield, Bell } from 'lucide-react';
import type { Violation, AlertRule } from '../types';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

export const DashboardPage: React.FC = () => {
  const { vehicles, geofences, recentAlerts, refreshVehicles, refreshGeofences } = useAppContext();
  const [recentViolations, setRecentViolations] = useState<Violation[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [insideCount] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    refreshVehicles();
    refreshGeofences();
    getViolationHistory({ limit: 10 }).then(r => setRecentViolations(r.data));
    getAlertRules().then(r => setAlertRules(r.data));
    getStats().then(s => setStats(s)).catch(() => { });
  }, []);

  const activeRules = alertRules.filter(r => r.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Fleet overview and recent activity</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Vehicles" value={stats?.total_vehicles ?? vehicles.length} icon={Truck} color="bg-blue-500" />
        <StatCard title="Geofences" value={stats?.total_geofences ?? geofences.length} icon={Hexagon} color="bg-purple-500" />
        <StatCard title="Inside Geofences" value={insideCount} icon={Shield} color="bg-green-500" />
        <StatCard title="Total Violations" value={stats?.total_violations ?? 0} icon={AlertTriangle} color="bg-orange-500" />
        <StatCard title="Active Rules" value={stats?.active_alert_rules ?? activeRules} icon={Bell} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Violations */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Violations</h2>
          {recentViolations.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No violations yet</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {recentViolations.map(v => (
                <li key={v.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800">{v.vehicle_number}</span>
                    <span className="text-gray-500 mx-1">→</span>
                    <span className="text-gray-600">{v.geofence_name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.event_type === 'enter' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {v.event_type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live Alert Feed */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Live Alert Feed</h2>
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No live alerts yet</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm space-y-0">
              {recentAlerts.slice(0, 10).map((a, i) => (
                <li key={i} className="py-2.5">
                  <p className="text-gray-800">{a.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(a.timestamp).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
