import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { createAlertRule, getAlertRules } from '../services/api';
import toast from 'react-hot-toast';
import type { AlertRule, AlertEventType } from '../types';
import { PlusCircle, Bell } from 'lucide-react';

export const AlertRulesPage: React.FC = () => {
  const { vehicles, geofences, refreshVehicles, refreshGeofences } = useAppContext();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [vehicleId, setVehicleId] = useState<string>('');
  const [geofenceId, setGeofenceId] = useState('');
  const [eventType, setEventType] = useState<AlertEventType>('enter');
  const [isActive, setIsActive] = useState(true);

  const refresh = async () => {
    const res = await getAlertRules();
    setRules(res.data);
  };

  useEffect(() => {
    refreshVehicles();
    refreshGeofences();
    refresh();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geofenceId) { toast.error('Select a geofence'); return; }

    setLoading(true);
    try {
      await createAlertRule({
        vehicle_id: vehicleId || null,
        geofence_id: geofenceId,
        event_type: eventType,
        is_active: isActive,
      });
      toast.success('Alert rule created!');
      setVehicleId(''); setGeofenceId('');
      setShowForm(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Rules</h1>
          <p className="text-sm text-gray-500 mt-1">{rules.filter(r => r.is_active).length} active</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <PlusCircle size={16} /> New Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold mb-4">Create Alert Rule</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle (leave blank for all)</label>
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Vehicles</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} — {v.driver_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Geofence *</label>
              <select value={geofenceId} onChange={e => setGeofenceId(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select geofence…</option>
                {geofences.map(g => <option key={g.id} value={g.id}>{g.name} ({g.category})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
              <select value={eventType} onChange={e => setEventType(e.target.value as AlertEventType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="enter">Enter</option>
                <option value="exit">Exit</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="active" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                className="rounded border-gray-300" />
              <label htmlFor="active" className="text-sm text-gray-600">Active</label>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
                {loading ? 'Creating…' : 'Create Rule'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bell size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No alert rules configured</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Vehicle', 'Geofence', 'Event', 'Status', 'Created'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map(rule => {
                const vehicle = vehicles.find(v => v.id === rule.vehicle_id);
                const geofence = geofences.find(g => g.id === rule.geofence_id);
                return (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{vehicle?.vehicle_number || 'All Vehicles'}</td>
                    <td className="px-4 py-3 text-gray-700">{geofence?.name || rule.geofence_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{rule.event_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(rule.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
