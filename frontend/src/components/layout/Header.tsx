import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Wifi,
  WifiOff,
  Loader,
  Search,
  Bell,
  Menu,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ConnectionStatus } from '../../types';
import { useAppContext } from '../../context/AppContext';

interface HeaderProps {
  wsStatus: ConnectionStatus;
  onOpenMobileNav: () => void;
  onOpenCommand: () => void;
}

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Command Center', subtitle: 'Fleet telemetry & spatial overview' },
  '/map': { title: 'Live Tactical Map', subtitle: 'Real-time GPS tracking & geofence radar' },
  '/geofences': { title: 'Geofence Studio', subtitle: 'Interactive polygon zones & perimeters' },
  '/vehicles': { title: 'Fleet Registry', subtitle: 'Active vehicles & driver assignments' },
  '/rules': { title: 'Alert Engine', subtitle: 'Automated boundary trigger rules' },
  '/history': { title: 'Violation Audit', subtitle: 'Historical boundary crossing ledger' },
};

const statusConfig: Record<
  ConnectionStatus,
  { icon: React.ElementType; label: string; pillClass: string; dotClass: string }
> = {
  connected: {
    icon: Wifi,
    label: 'LIVE TELEMETRY',
    pillClass: 'bg-[#8B9A6E]/20 border-[#8B9A6E]/45 text-[#424C32]',
    dotClass: 'bg-[#596543]',
  },
  connecting: {
    icon: Loader,
    label: 'SYNCING…',
    pillClass: 'bg-amber-700/10 border-amber-700/30 text-amber-900',
    dotClass: 'bg-amber-600',
  },
  disconnected: {
    icon: WifiOff,
    label: 'OFFLINE',
    pillClass: 'bg-rose-700/10 border-rose-700/30 text-rose-800',
    dotClass: 'bg-rose-600',
  },
};

export const Header: React.FC<HeaderProps> = ({
  wsStatus,
  onOpenMobileNav,
  onOpenCommand,
}) => {
  const { pathname } = useLocation();
  const { recentAlerts, clearAlerts } = useAppContext();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const routeInfo = ROUTE_TITLES[pathname] || {
    title: 'Real-Time Vehicle Tracking',
    subtitle: 'Spatial fleet telemetry',
  };

  const { icon: Icon, label, pillClass, dotClass } = statusConfig[wsStatus];

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="relative z-30 h-16 px-4 lg:px-6 bg-[#EAE2D6]/90 backdrop-blur-xl border-b border-[#D6CCBE] flex items-center justify-between gap-4 flex-shrink-0">
      {/* Left: Mobile Menu + Dynamic Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 rounded-xl bg-[#EEEEEE] border border-[#D4CFC7] text-[#4B5243] hover:text-[#23281E]"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#23281E] truncate">
              {routeInfo.title}
            </h2>
            <Sparkles size={14} className="hidden sm:block text-[#8B9A6E] flex-shrink-0" />
          </div>
          <p className="hidden sm:block text-xs text-[#5C6356] truncate">{routeInfo.subtitle}</p>
        </div>
      </div>

      {/* Right: Command Search + Alerts Bell + WS Pill */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommand}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#EEEEEE] hover:bg-[#F7F2EB] border border-[#D4CFC7] hover:border-[#8B9A6E] text-[#5C6356] hover:text-[#23281E] text-xs transition-all"
        >
          <Search size={14} className="text-[#596543]" />
          <span className="hidden md:inline">Quick jump…</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[#F7F2EB] border border-[#D6CCBE] font-mono text-[10px] text-[#5C6356]">
            ⌘K
          </kbd>
        </button>

        {/* Live Alerts Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative p-2 rounded-xl bg-[#EEEEEE] hover:bg-[#F7F2EB] border border-[#D4CFC7] text-[#4B5243] hover:text-[#596543] transition-colors"
            aria-label="Live alerts"
          >
            <Bell size={16} />
            {recentAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center shadow">
                {recentAlerts.length > 9 ? '9+' : recentAlerts.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#F7F2EB] border border-[#D6CCBE] shadow-2xl overflow-hidden z-50 animate-fade-in-up">
              <div className="px-4 py-3 bg-[#EAE2D6] border-b border-[#D6CCBE] flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#23281E]">
                  Live Alert Stream ({recentAlerts.length})
                </span>
                {recentAlerts.length > 0 && (
                  <button
                    onClick={clearAlerts}
                    className="flex items-center gap-1 text-[11px] text-[#5C6356] hover:text-rose-700 transition-colors"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-[#D6CCBE]/60">
                {recentAlerts.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#6E7565]">
                    No live alerts received in this session
                  </p>
                ) : (
                  recentAlerts.slice(0, 12).map((a, idx) => (
                    <div key={`${a.timestamp}-${idx}`} className="px-4 py-3 hover:bg-[#EAE2D6]/60 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-[#424C32]">
                          {a.vehicle_number}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                            a.event_type === 'enter'
                              ? 'bg-[#8B9A6E]/20 text-[#424C32] border-[#8B9A6E]/40'
                              : 'bg-rose-700/10 text-rose-800 border-rose-700/25'
                          }`}
                        >
                          {a.event_type}
                        </span>
                      </div>
                      <p className="text-xs text-[#4B5243] mt-1">{a.message}</p>
                      <p className="text-[10px] font-mono text-[#6E7565] mt-1">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* WebSocket Telemetry Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-mono font-semibold tracking-wide ${pillClass}`}
        >
          <span className="relative flex h-2 w-2">
            {wsStatus === 'connected' && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotClass} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`} />
          </span>
          <Icon size={13} className={wsStatus === 'connecting' ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{label}</span>
        </div>
      </div>
    </header>
  );
};
