import React, { useEffect, useState } from 'react';
import {
  History,
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { getViolationHistory } from '../services/api';
import { useAppContext } from '../context/AppContext';
import type { Violation } from '../types';
import { CATEGORY_META } from '../utils/categoryColors';

const PAGE_SIZE = 20;

export const ViolationHistoryPage: React.FC = () => {
  const { vehicles, geofences, refreshVehicles, refreshGeofences } = useAppContext();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [geofenceFilter, setGeofenceFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [startFilter, setStartFilter] = useState('');
  const [endFilter, setEndFilter] = useState('');
  const [alertedOnly, setAlertedOnly] = useState(false);

  const queryKey = JSON.stringify({
    page,
    vehicleFilter,
    geofenceFilter,
    eventTypeFilter,
    startFilter,
    endFilter,
  });
  const [loadedKey, setLoadedKey] = useState('');
  const loading = loadedKey !== queryKey;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    refreshVehicles();
    refreshGeofences();
  }, [refreshVehicles, refreshGeofences]);

  useEffect(() => {
    let cancelled = false;
    getViolationHistory({
      vehicle_id: vehicleFilter || undefined,
      geofence_id: geofenceFilter || undefined,
      event_type: eventTypeFilter || undefined,
      start: startFilter ? new Date(startFilter).toISOString() : undefined,
      end: endFilter ? new Date(endFilter).toISOString() : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then(res => {
        if (cancelled) return;
        setViolations(res.data || []);
        setTotal(res.total_count || 0);
      })
      .catch(() => {
        if (!cancelled) setViolations([]);
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(queryKey);
      });

    return () => {
      cancelled = true;
    };
  }, [page, vehicleFilter, geofenceFilter, eventTypeFilter, startFilter, endFilter, queryKey]);

  const handleResetFilters = () => {
    setVehicleFilter('');
    setGeofenceFilter('');
    setEventTypeFilter('');
    setStartFilter('');
    setEndFilter('');
    setAlertedOnly(false);
    setPage(0);
  };

  const visibleViolations = alertedOnly
    ? violations.filter(v => v.alert_triggered)
    : violations;

  const handleExportCsv = () => {
    if (visibleViolations.length === 0) return;
    const headers = ['Vehicle', 'Driver', 'Geofence', 'Category', 'Event', 'Timestamp', 'AlertTriggered'];
    const rows = visibleViolations.map(v => [
      v.vehicle_number,
      v.driver_name,
      v.geofence_name,
      v.category,
      v.event_type,
      v.timestamp,
      String(v.alert_triggered),
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vtrack-violations-page-${page + 1}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = Boolean(
    vehicleFilter || geofenceFilter || eventTypeFilter || startFilter || endFilter || alertedOnly
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#23281E]">Violation History</h1>
          <p className="text-sm text-[#5C6356] mt-0.5">
            {total.toLocaleString()} total boundary crossing event{total === 1 ? '' : 's'} recorded
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {hasFilters && (
            <button onClick={handleResetFilters} className="cyber-btn-secondary text-xs">
              <RotateCcw size={14} /> Reset
            </button>
          )}
          <button
            onClick={handleExportCsv}
            disabled={visibleViolations.length === 0}
            className="cyber-btn-secondary text-xs disabled:opacity-40"
          >
            <Download size={14} className="text-[#596543]" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5C6356] flex items-center gap-1.5">
            <Filter size={13} className="text-[#596543]" /> Telemetry Filters
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { label: 'All Events', event: '', alerted: false },
                { label: 'Entries Only', event: 'enter', alerted: false },
                { label: 'Exits Only', event: 'exit', alerted: false },
                { label: 'Alerted Only', event: eventTypeFilter, alerted: true },
              ] as const
            ).map(preset => {
              const active =
                preset.alerted
                  ? alertedOnly
                  : !alertedOnly && eventTypeFilter === preset.event;
              return (
                <button
                  key={preset.label}
                  onClick={() => {
                    if (preset.alerted) {
                      setAlertedOnly(a => !a);
                    } else {
                      setAlertedOnly(false);
                      setEventTypeFilter(preset.event);
                      setPage(0);
                    }
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    active
                      ? 'bg-[#8B9A6E] text-[#F7F2EB] border-[#728056]'
                      : 'bg-[#EEEEEE] border-[#D4CFC7] text-[#4B5243] hover:border-[#8B9A6E]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={vehicleFilter}
            onChange={e => {
              setVehicleFilter(e.target.value);
              setPage(0);
            }}
            className="cyber-input text-xs py-2"
          >
            <option value="">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.vehicle_number}
              </option>
            ))}
          </select>

          <select
            value={geofenceFilter}
            onChange={e => {
              setGeofenceFilter(e.target.value);
              setPage(0);
            }}
            className="cyber-input text-xs py-2"
          >
            <option value="">All Geofences</option>
            {geofences.map(g => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={eventTypeFilter}
            onChange={e => {
              setEventTypeFilter(e.target.value);
              setPage(0);
            }}
            className="cyber-input text-xs py-2"
          >
            <option value="">All Event Types</option>
            <option value="enter">Enter</option>
            <option value="exit">Exit</option>
          </select>

          <input
            type="datetime-local"
            value={startFilter}
            onChange={e => {
              setStartFilter(e.target.value);
              setPage(0);
            }}
            className="cyber-input text-xs py-2 font-mono"
            aria-label="Start time"
          />

          <input
            type="datetime-local"
            value={endFilter}
            onChange={e => {
              setEndFilter(e.target.value);
              setPage(0);
            }}
            className="cyber-input text-xs py-2 font-mono"
            aria-label="End time"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="glass-card p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-11 rounded-xl bg-[#EEEEEE] animate-pulse" />
          ))}
        </div>
      ) : visibleViolations.length === 0 ? (
        <div className="glass-card p-14 text-center">
          <History size={40} className="mx-auto text-[#8B9A6E] mb-3" />
          <p className="text-[#23281E] text-sm font-medium">No violations found</p>
          <p className="text-[#5C6356] text-xs mt-1">
            Adjust your filters or trigger a geofence crossing on the Live Map
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#EEEEEE] border-b border-[#D6CCBE]">
                <tr>
                  {['Vehicle', 'Driver', 'Geofence', 'Category', 'Event', 'Timestamp', 'Alert'].map(
                    h => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#5C6356] uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6CCBE]/70 bg-[#F7F2EB]/60">
                {visibleViolations.map(v => {
                  const isEnter = v.event_type === 'enter';
                  const catMeta = CATEGORY_META[v.category];
                  return (
                    <tr key={v.id} className="hover:bg-[#EAE2D6]/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-bold text-[#424C32] px-2.5 py-1 rounded-lg bg-[#8B9A6E]/20 border border-[#8B9A6E]/40">
                          {v.vehicle_number}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#4B5243]">{v.driver_name}</td>
                      <td className="px-5 py-3.5 font-medium text-[#23281E]">{v.geofence_name}</td>
                      <td className="px-5 py-3.5">
                        {catMeta ? (
                          <span
                            className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${catMeta.badgeClass}`}
                          >
                            {catMeta.shortLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-[#5C6356]">{v.category}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                            isEnter
                              ? 'bg-[#8B9A6E]/20 text-[#424C32] border-[#8B9A6E]/45'
                              : 'bg-rose-700/10 text-rose-800 border-rose-700/25'
                          }`}
                        >
                          {isEnter ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                          {v.event_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[#5C6356]">
                        {new Date(v.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        {v.alert_triggered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-700/10 text-amber-900 border border-amber-700/25 font-medium">
                            <Bell size={11} /> Alerted
                          </span>
                        ) : (
                          <span className="text-xs text-[#7B8273]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3.5 bg-[#EAE2D6] border-t border-[#D6CCBE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="font-mono text-[#5C6356]">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of{' '}
              {total.toLocaleString()} records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="cyber-btn-secondary px-3 py-1.5 text-xs disabled:opacity-35"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="px-3 py-1.5 rounded-lg bg-[#EEEEEE] border border-[#D4CFC7] font-mono text-[#23281E]">
                Page {page + 1} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="cyber-btn-secondary px-3 py-1.5 text-xs disabled:opacity-35"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
