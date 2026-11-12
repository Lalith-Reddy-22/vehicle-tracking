import React, { useEffect, useState } from 'react';
import { getViolationHistory } from '../services/api';
import { useAppContext } from '../context/AppContext';
import type { Violation } from '../types';
import { History } from 'lucide-react';

const PAGE_SIZE = 20;

export const ViolationHistoryPage: React.FC = () => {
  const { vehicles, geofences, refreshVehicles, refreshGeofences } = useAppContext();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [geofenceFilter, setGeofenceFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const load = async (pg: number) => {
    setLoading(true);
    try {
      const res = await getViolationHistory({
        vehicle_id: vehicleFilter || undefined,
        geofence_id: geofenceFilter || undefined,
        event_type: eventTypeFilter || undefined,
        start: startFilter || undefined,
        end: endFilter || undefined,
        limit: PAGE_SIZE,
        offset: pg * PAGE_SIZE,
      });
      setViolations(res.data);
      setTotal(res.total_count);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshVehicles(); refreshGeofences(); }, []);
  useEffect(() => { load(page); }, [page, vehicleFilter, geofenceFilter, eventTypeFilter, startFilter, endFilter]);

  const handleFilterChange = () => { setPage(0); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Violation History</h1>
        <p className="text-sm text-gray-500 mt-1">{total} total records</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <select value={vehicleFilter} onChange={e => { setVehicleFilter(e.target.value); handleFilterChange(); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
        </select>

        <select value={geofenceFilter} onChange={e => { setGeofenceFilter(e.target.value); handleFilterChange(); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Geofences</option>
          {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select value={eventTypeFilter} onChange={e => { setEventTypeFilter(e.target.value); handleFilterChange(); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Events</option>
          <option value="enter">Enter</option>
          <option value="exit">Exit</option>
        </select>

        <input type="datetime-local" value={startFilter}
          onChange={e => { setStartFilter(e.target.value ? new Date(e.target.value).toISOString() : ''); handleFilterChange(); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Start" />

        <input type="datetime-local" value={endFilter}
          onChange={e => { setEndFilter(e.target.value ? new Date(e.target.value).toISOString() : ''); handleFilterChange(); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="End" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">Loading…</div>
      ) : violations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <History size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No violations found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Vehicle', 'Driver', 'Geofence', 'Category', 'Event', 'Time', 'Alert'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {violations.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.vehicle_number}</td>
                  <td className="px-4 py-3 text-gray-600">{v.driver_name}</td>
                  <td className="px-4 py-3 text-gray-600">{v.geofence_name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{v.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      v.event_type === 'enter' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {v.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(v.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {v.alert_triggered && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🔔 Alerted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">←</button>
              <span className="px-3 py-1 text-gray-600">Page {page + 1} / {totalPages || 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">→</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
