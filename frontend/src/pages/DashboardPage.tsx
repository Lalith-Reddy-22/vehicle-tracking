import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  Hexagon,
  AlertTriangle,
  ShieldCheck,
  Bell,
  Activity,
  MapPin,
  ArrowUpRight,
  ArrowDownLeft,
  Radio,
  Zap,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getViolationHistory, getAlertRules, getStats, getVehicleLocation } from '../services/api';
import type { DashboardStats } from '../services/api';
import type { Violation, AlertRule, GeofenceCategory } from '../types';
import { CATEGORY_META } from '../utils/categoryColors';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  glow: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  glow,
}) => {
  const animated = useAnimatedNumber(value);
  return (
    <div className="glass-card-hover p-5 group">
      {/* Top gradient hairline */}
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${gradient} opacity-85 group-hover:opacity-100 transition-opacity`} />
      {/* Shimmer effect on hover */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-[#F7F2EB]/35 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#5C6356]">{title}</p>
          <p className="font-display text-3xl font-bold text-[#23281E] mt-2 tracking-tight">
            {animated.toLocaleString()}
          </p>
          <p className="text-xs text-[#6E7565] mt-1.5">{subtitle}</p>
        </div>
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} p-[1px] ${glow} flex-shrink-0`}
        >
          <div className="w-full h-full rounded-[11px] bg-[#F7F2EB] flex items-center justify-center">
            <Icon size={20} className="text-[#424C32]" />
          </div>
        </div>
      </div>
    </div>
  );
};

function formatLatency(timeNs?: string): string {
  if (!timeNs) return '—';
  const num = Number(timeNs);
  if (Number.isNaN(num)) return timeNs;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)} ms`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)} µs`;
  return `${num} ns`;
}

export const DashboardPage: React.FC = () => {
  const { vehicles, geofences, recentAlerts, refreshVehicles, refreshGeofences } = useAppContext();
  const [recentViolations, setRecentViolations] = useState<Violation[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [insideCount, setInsideCount] = useState(0);
  const [trackedCount, setTrackedCount] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    refreshVehicles();
    refreshGeofences();
    getViolationHistory({ limit: 12 })
      .then(r => setRecentViolations(r.data || []))
      .catch(() => {});
    getAlertRules()
      .then(r => setAlertRules(r.data || []))
      .catch(() => {});
    getStats()
      .then(s => setStats(s))
      .catch(() => {});
  }, [refreshVehicles, refreshGeofences]);

  // Compute live vehicles currently inside geofences
  useEffect(() => {
    if (vehicles.length === 0) return;
    let cancelled = false;
    Promise.allSettled(vehicles.map(v => getVehicleLocation(v.id))).then(results => {
      if (cancelled) return;
      let inside = 0;
      let tracked = 0;
      results.forEach(res => {
        if (res.status === 'fulfilled' && res.value.location) {
          tracked++;
          if ((res.value.inside_geofences || []).length > 0) {
            inside++;
          }
        }
      });
      setInsideCount(inside);
      setTrackedCount(tracked);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicles]);

  const effectiveInsideCount = vehicles.length === 0 ? 0 : insideCount;
  const effectiveTrackedCount = vehicles.length === 0 ? 0 : trackedCount;

  const activeRules = alertRules.filter(r => r.is_active).length;

  const categoryBreakdown = useMemo(() => {
    const counts: Record<GeofenceCategory, number> = {
      delivery_zone: 0,
      restricted_zone: 0,
      toll_zone: 0,
      customer_area: 0,
    };
    geofences.forEach(g => {
      if (counts[g.category] !== undefined) counts[g.category]++;
    });
    const total = geofences.length || 1;
    return (Object.keys(counts) as GeofenceCategory[]).map(cat => ({
      category: cat,
      count: counts[cat],
      pct: Math.round((counts[cat] / total) * 100),
      meta: CATEGORY_META[cat],
    }));
  }, [geofences]);

  const violationBreakdown = useMemo(() => {
    const enters = recentViolations.filter(v => v.event_type === 'enter').length;
    const exits = recentViolations.filter(v => v.event_type === 'exit').length;
    const alerted = recentViolations.filter(v => v.alert_triggered).length;
    const total = recentViolations.length || 1;
    return {
      enters,
      exits,
      alerted,
      enterPct: Math.round((enters / total) * 100),
      exitPct: Math.round((exits / total) * 100),
      alertPct: Math.round((alerted / total) * 100),
    };
  }, [recentViolations]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Hero Command Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[#D6CCBE] bg-gradient-to-br from-[#EAE2D6] via-[#F7F2EB] to-[#EAE2D6] p-6 shadow-warm-card">
        <div className="pointer-events-none absolute -right-16 -top-16 w-72 h-72 rounded-full bg-[#8B9A6E]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 -bottom-20 w-64 h-64 rounded-full bg-[#8B9A6E]/15 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B9A6E]/20 border border-[#8B9A6E]/40 text-[#424C32] text-xs font-mono mb-3">
              <Zap size={13} className="text-[#596543]" />
              REAL-TIME SPATIAL OPERATIONS
              {stats?.time_ns && (
                <span className="ml-1 pl-2 border-l border-[#8B9A6E]/40 text-[#23281E]">
                  API {formatLatency(stats.time_ns)}
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#23281E]">
              Fleet Command Dashboard
            </h1>
            <p className="text-sm text-[#4B5243] mt-1.5 max-w-2xl">
              Monitor live vehicle coordinates, automated PostGIS geofence crossings, and WebSocket alert rules in one unified telemetry deck.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-[#EEEEEE] border border-[#D4CFC7] flex items-center gap-2.5">
              <Clock size={15} className="text-[#596543]" />
              <div>
                <p className="font-mono text-sm font-semibold text-[#23281E]">
                  {now.toLocaleTimeString([], { hour12: false })}
                </p>
                <p className="text-[10px] font-mono text-[#5C6356]">
                  {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>

            <Link to="/map" className="cyber-btn-primary">
              <MapPin size={16} />
              Launch Live Map
            </Link>
            <Link to="/geofences" className="cyber-btn-secondary">
              <Hexagon size={16} className="text-[#596543]" />
              Draw Zone
            </Link>
          </div>
        </div>
      </div>

      {/* 5 Animated KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          title="Total Fleet"
          value={stats?.total_vehicles ?? vehicles.length}
          subtitle={`${effectiveTrackedCount} with live GPS fix`}
          icon={Truck}
          gradient="from-[#8B9A6E] to-[#596543]"
          glow="shadow-glow-sage"
        />
        <StatCard
          title="Geofence Zones"
          value={stats?.total_geofences ?? geofences.length}
          subtitle="Active spatial polygons"
          icon={Hexagon}
          gradient="from-[#8B9A6E] to-[#728056]"
          glow="shadow-glow-sage"
        />
        <StatCard
          title="Inside Zones"
          value={effectiveInsideCount}
          subtitle="Units currently fenced"
          icon={ShieldCheck}
          gradient="from-emerald-600 to-[#596543]"
          glow="shadow-glow-sage"
        />
        <StatCard
          title="Total Violations"
          value={stats?.total_violations ?? 0}
          subtitle="Boundary crossings logged"
          icon={AlertTriangle}
          gradient="from-rose-600 to-amber-600"
          glow="shadow-warm-card"
        />
        <StatCard
          title="Active Rules"
          value={stats?.active_alert_rules ?? activeRules}
          subtitle={`${alertRules.length} total configured`}
          icon={Bell}
          gradient="from-[#728056] to-[#424C32]"
          glow="shadow-glow-sage"
        />
      </div>

      {/* Visual Telemetry Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Zone Category Distribution */}
        <div className="lg:col-span-7 glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#23281E]">Geofence Topology</h2>
              <p className="text-xs text-[#5C6356]">Zone distribution across operational categories</p>
            </div>
            <Link
              to="/geofences"
              className="text-xs font-medium text-[#596543] hover:text-[#23281E] flex items-center gap-1"
            >
              Manage <ChevronRight size={14} />
            </Link>
          </div>

          {/* Segmented Bar */}
          <div className="h-3 w-full rounded-full bg-[#EEEEEE] border border-[#D4CFC7] overflow-hidden flex p-0.5 gap-0.5">
            {geofences.length === 0 ? (
              <div className="w-full h-full rounded-full bg-[#D6CCBE]/60" />
            ) : (
              categoryBreakdown.map(
                item =>
                  item.count > 0 && (
                    <div
                      key={item.category}
                      style={{ width: `${item.pct}%` }}
                      className={`h-full rounded-full bg-gradient-to-r ${item.meta.barClass} transition-all duration-700`}
                      title={`${item.meta.label}: ${item.count}`}
                    />
                  )
              )
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {categoryBreakdown.map(item => (
              <div
                key={item.category}
                className="rounded-xl bg-[#F7F2EB] border border-[#D6CCBE] p-3 hover:border-[#8B9A6E] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.meta.dotClass}`} />
                  <span className="text-xs font-medium text-[#4B5243] truncate">
                    {item.meta.shortLabel}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-xl font-bold text-[#23281E]">{item.count}</span>
                  <span className="font-mono text-[11px] text-[#6E7565]">
                    {geofences.length ? `${item.pct}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Boundary Crossing Telemetry */}
        <div className="lg:col-span-5 glass-card p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#23281E]">Event Pulse Ratio</h2>
              <p className="text-xs text-[#5C6356]">Latest {recentViolations.length} boundary crossings</p>
            </div>
            <Activity size={18} className="text-[#596543]" />
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#424C32] font-medium flex items-center gap-1.5">
                  <ArrowDownLeft size={13} /> Zone Entries ({violationBreakdown.enters})
                </span>
                <span className="font-mono text-[#5C6356]">{violationBreakdown.enterPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#EEEEEE] overflow-hidden border border-[#D4CFC7]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8B9A6E] to-[#596543] transition-all duration-700"
                  style={{ width: `${violationBreakdown.enterPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-rose-800 font-medium flex items-center gap-1.5">
                  <ArrowUpRight size={13} /> Zone Exits ({violationBreakdown.exits})
                </span>
                <span className="font-mono text-[#5C6356]">{violationBreakdown.exitPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#EEEEEE] overflow-hidden border border-[#D4CFC7]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-700 transition-all duration-700"
                  style={{ width: `${violationBreakdown.exitPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-amber-900 font-medium flex items-center gap-1.5">
                  <Bell size={13} /> Alerts Triggered ({violationBreakdown.alerted})
                </span>
                <span className="font-mono text-[#5C6356]">{violationBreakdown.alertPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#EEEEEE] overflow-hidden border border-[#D4CFC7]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-700 transition-all duration-700"
                  style={{ width: `${violationBreakdown.alertPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Violations */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#23281E]">Recent Violations</h2>
              <p className="text-xs text-[#5C6356]">Latest geofence entry & exit detections</p>
            </div>
            <Link
              to="/history"
              className="text-xs font-medium text-[#596543] hover:text-[#23281E] flex items-center gap-1"
            >
              Full Audit <ChevronRight size={14} />
            </Link>
          </div>

          {recentViolations.length === 0 ? (
            <div className="py-12 text-center">
              <AlertTriangle size={28} className="mx-auto text-[#8B9A6E] mb-2" />
              <p className="text-sm text-[#4B5243]">No boundary violations logged yet</p>
              <p className="text-xs text-[#6E7565] mt-1">
                Move a vehicle inside or outside a zone on the Live Map
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {recentViolations.slice(0, 8).map(v => {
                const isEnter = v.event_type === 'enter';
                const catMeta = CATEGORY_META[v.category];
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F7F2EB] border border-[#D6CCBE] hover:border-[#8B9A6E] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isEnter
                            ? 'bg-[#8B9A6E]/20 text-[#424C32] border border-[#8B9A6E]/40'
                            : 'bg-rose-700/10 text-rose-800 border border-rose-700/25'
                        }`}
                      >
                        {isEnter ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-[#23281E]">
                            {v.vehicle_number}
                          </span>
                          <span className="text-[#6E7565] text-xs">→</span>
                          <span className="text-xs font-medium text-[#4B5243] truncate">
                            {v.geofence_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {catMeta && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catMeta.badgeClass}`}>
                              {catMeta.shortLabel}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-[#6E7565]">
                            {new Date(v.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded-full border flex-shrink-0 ${
                        isEnter
                          ? 'bg-[#8B9A6E]/20 text-[#424C32] border-[#8B9A6E]/40'
                          : 'bg-rose-700/10 text-rose-800 border-rose-700/25'
                      }`}
                    >
                      {v.event_type}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live WebSocket Alert Feed */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B9A6E] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#596543]" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-[#23281E]">Live Alert Stream</h2>
                <p className="text-xs text-[#5C6356]">Real-time WebSocket rule notifications</p>
              </div>
            </div>
            <Link
              to="/rules"
              className="text-xs font-medium text-[#596543] hover:text-[#23281E] flex items-center gap-1"
            >
              Rules <ChevronRight size={14} />
            </Link>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="relative w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-full bg-[#8B9A6E]/20 border border-[#8B9A6E]/40 text-[#596543]">
                <Radio size={20} className="animate-pulse" />
              </div>
              <p className="text-sm text-[#4B5243]">Listening for live WebSocket alerts…</p>
              <p className="text-xs text-[#6E7565] mt-1">
                Events matching active alert rules appear here instantaneously
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {recentAlerts.slice(0, 10).map((a, i) => {
                const isEnter = a.event_type === 'enter';
                return (
                  <div
                    key={`${a.timestamp}-${i}`}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isEnter
                        ? 'bg-[#8B9A6E]/15 border-[#8B9A6E]/40'
                        : 'bg-rose-700/10 border-rose-700/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#23281E]">
                        {a.vehicle_number}
                      </span>
                      <span className="text-[10px] font-mono text-[#5C6356]">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#4B5243] mt-1">{a.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
