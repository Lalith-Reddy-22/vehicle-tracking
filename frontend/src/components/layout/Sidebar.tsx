import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Hexagon,
  Truck,
  Bell,
  History,
  ChevronLeft,
  ChevronRight,
  Radio,
  X,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { vehicles, geofences, recentAlerts } = useAppContext();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { to: '/map', label: 'Live Map', icon: Map, badge: 'LIVE' },
    { to: '/geofences', label: 'Geofences', icon: Hexagon, badge: geofences.length || null },
    { to: '/vehicles', label: 'Vehicles', icon: Truck, badge: vehicles.length || null },
    { to: '/rules', label: 'Alert Rules', icon: Bell, badge: null },
    { to: '/history', label: 'Violations', icon: History, badge: recentAlerts.length || null },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#EAE2D6]/95 backdrop-blur-2xl border-r border-[#D6CCBE] relative">
      {/* Subtle top tint */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#8B9A6E]/15 to-transparent" />

      {/* Brand Header */}
      <div className="relative px-4 py-5 border-b border-[#D6CCBE] flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative w-10 h-10 rounded-xl bg-[#8B9A6E] p-[1px] shadow-glow-sage flex-shrink-0">
            <div className="w-full h-full rounded-[11px] bg-[#F7F2EB] flex items-center justify-center">
              <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
                <path
                  d="M6 9L16 25L26 9"
                  stroke="url(#logoStroke)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="10" r="2.5" fill="#8B9A6E" />
                <defs>
                  <linearGradient id="logoStroke" x1="6" y1="9" x2="26" y2="25" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8B9A6E" />
                    <stop offset="1" stopColor="#596543" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-lg font-bold tracking-tight text-[#23281E]">
                  VTrack
                </h1>
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#8B9A6E]/20 text-[#424C32] border border-[#8B9A6E]/40">
                  Pulse
                </span>
              </div>
              <p className="text-[11px] text-[#5C6356] truncate">Spatial Fleet Command</p>
            </div>
          )}
        </div>

        {/* Desktop collapse button */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg bg-[#EEEEEE] border border-[#D4CFC7] text-[#5C6356] hover:text-[#23281E] hover:border-[#8B9A6E] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-[#5C6356] hover:text-[#23281E] hover:bg-[#EEEEEE]"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6E7565]">
            Operations
          </p>
        )}
        {navItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onCloseMobile}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group relative flex items-center ${
                collapsed ? 'justify-center px-2' : 'justify-between px-3.5'
              } py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[#8B9A6E] text-[#F7F2EB] border border-[#728056] shadow-glow-sage'
                  : 'text-[#4B5243] border border-transparent hover:text-[#23281E] hover:bg-[#F7F2EB]/70 hover:border-[#D6CCBE]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[#F7F2EB]" />
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    size={18}
                    className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-[#F7F2EB]' : 'text-[#5C6356] group-hover:text-[#596543]'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                </div>

                {!collapsed && badge !== null && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                      badge === 'LIVE'
                        ? isActive
                          ? 'bg-[#F7F2EB]/20 text-[#F7F2EB] border border-[#F7F2EB]/30 animate-pulse'
                          : 'bg-[#8B9A6E]/20 text-[#424C32] border border-[#8B9A6E]/40 animate-pulse'
                        : isActive
                        ? 'bg-[#F7F2EB]/20 text-[#F7F2EB] border border-[#F7F2EB]/25'
                        : 'bg-[#EEEEEE] text-[#4B5243] border border-[#D4CFC7]'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Telemetry Card */}
      <div className="p-3 border-t border-[#D6CCBE]">
        {collapsed ? (
          <div className="flex justify-center py-2" title="Telemetry Engine Active">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B9A6E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8B9A6E]" />
            </span>
          </div>
        ) : (
          <div className="rounded-xl bg-[#F7F2EB] border border-[#D6CCBE] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#424C32]">
                <Radio size={13} className="text-[#8B9A6E] animate-pulse" />
                PostGIS Engine
              </span>
              <span className="text-[10px] font-mono text-[#424C32] bg-[#8B9A6E]/20 px-1.5 py-0.5 rounded border border-[#8B9A6E]/35">
                ONLINE
              </span>
            </div>
            <p className="text-[11px] text-[#5C6356] leading-relaxed">
              Sub-millisecond spatial fence evaluation & WebSocket alert dispatch.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#23281E]/40 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative w-68 max-w-[80vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}
    </>
  );
};
