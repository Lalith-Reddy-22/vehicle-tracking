import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Map as MapIcon,
  Hexagon,
  Truck,
  Bell,
  History,
  ArrowRight,
  Command,
  X,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CATEGORY_META } from '../../utils/categoryColors';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const ROUTES = [
  { to: '/', label: 'Command Dashboard', hint: 'Fleet KPIs & live telemetry', icon: LayoutDashboard },
  { to: '/map', label: 'Live Tactical Map', hint: 'Track & move fleet vehicles', icon: MapIcon },
  { to: '/geofences', label: 'Geofence Zones', hint: 'Draw & inspect boundaries', icon: Hexagon },
  { to: '/vehicles', label: 'Fleet Vehicles', hint: 'Manage registered units', icon: Truck },
  { to: '/rules', label: 'Alert Rules', hint: 'Configure boundary triggers', icon: Bell },
  { to: '/history', label: 'Violation History', hint: 'Audit entry/exit events', icon: History },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { vehicles, geofences } = useAppContext();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose();
      } else if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const q = query.trim().toLowerCase();

  const filteredRoutes = useMemo(
    () => ROUTES.filter(r => !q || r.label.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q)),
    [q]
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles
        .filter(
          v =>
            !q ||
            v.vehicle_number.toLowerCase().includes(q) ||
            v.driver_name.toLowerCase().includes(q) ||
            v.vehicle_type.toLowerCase().includes(q)
        )
        .slice(0, 5),
    [vehicles, q]
  );

  const filteredGeofences = useMemo(
    () =>
      geofences
        .filter(g => !q || g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q))
        .slice(0, 5),
    [geofences, q]
  );

  if (!open) return null;

  const go = (path: string) => {
    setQuery('');
    onClose();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#23281E]/45 backdrop-blur-sm pt-[12vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#D6CCBE] bg-[#F7F2EB] shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#EAE2D6]/70 border-b border-[#D6CCBE]">
          <Search size={18} className="text-[#596543] flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to page, vehicle plate, driver, or geofence…"
            className="w-full bg-transparent text-sm text-[#23281E] placeholder-[#6E7565] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#5C6356] hover:text-[#23281E] hover:bg-[#EEEEEE] transition-colors"
            aria-label="Close command palette"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {/* Navigation */}
          {filteredRoutes.length > 0 && (
            <div>
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6E7565]">
                Navigation
              </p>
              <div className="space-y-1">
                {filteredRoutes.map(({ to, label, hint, icon: Icon }) => (
                  <button
                    key={to}
                    onClick={() => go(to)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-[#EAE2D6] hover:border-[#8B9A6E]/40 border border-transparent transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#EEEEEE] border border-[#D4CFC7] flex items-center justify-center text-[#596543] group-hover:bg-[#8B9A6E] group-hover:text-[#F7F2EB] transition-colors">
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#23281E]">{label}</p>
                        <p className="text-xs text-[#5C6356]">{hint}</p>
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-[#6E7565] group-hover:text-[#596543] transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vehicles */}
          {filteredVehicles.length > 0 && (
            <div>
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6E7565]">
                Fleet Units ({filteredVehicles.length})
              </p>
              <div className="space-y-1">
                {filteredVehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => go(`/map?vehicle=${v.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#EAE2D6] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-md bg-[#8B9A6E]/20 border border-[#8B9A6E]/40 font-mono text-xs font-semibold text-[#424C32]">
                        {v.vehicle_number}
                      </span>
                      <span className="text-sm text-[#4B5243]">{v.driver_name}</span>
                    </div>
                    <span className="text-xs text-[#6E7565] group-hover:text-[#596543]">Track on map →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Geofences */}
          {filteredGeofences.length > 0 && (
            <div>
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6E7565]">
                Geofence Zones ({filteredGeofences.length})
              </p>
              <div className="space-y-1">
                {filteredGeofences.map(g => {
                  const meta = CATEGORY_META[g.category];
                  return (
                    <button
                      key={g.id}
                      onClick={() => go('/geofences')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#EAE2D6] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                        <span className="text-sm text-[#23281E]">{g.name}</span>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${meta.badgeClass}`}>
                        {meta.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredRoutes.length === 0 && filteredVehicles.length === 0 && filteredGeofences.length === 0 && (
            <p className="py-8 text-center text-sm text-[#6E7565]">No matches for "{query}"</p>
          )}
        </div>

        <div className="px-4 py-2.5 bg-[#EAE2D6] border-t border-[#D6CCBE] flex items-center justify-between text-[11px] text-[#5C6356]">
          <span className="flex items-center gap-1.5">
            <Command size={12} /> Quick Jump Telemetry Search
          </span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
