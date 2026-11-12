import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Hexagon,
  Truck,
  Bell,
  History,
} from 'lucide-react';

const navItems = [
  { to: '/',          label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/map',       label: 'Live Map',         icon: Map },
  { to: '/geofences', label: 'Geofences',        icon: Hexagon },
  { to: '/vehicles',  label: 'Vehicles',         icon: Truck },
  { to: '/rules',     label: 'Alert Rules',      icon: Bell },
  { to: '/history',   label: 'Violation History',icon: History },
];

export const Sidebar: React.FC = () => (
  <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen flex-shrink-0">
    <div className="px-6 py-5 border-b border-gray-700">
      <h1 className="text-lg font-bold tracking-tight text-white">🚗 VTrack</h1>
      <p className="text-xs text-gray-400 mt-0.5">Fleet Management</p>
    </div>
    <nav className="flex-1 py-4 space-y-1 px-3">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
    <div className="px-6 py-4 border-t border-gray-700">
      <p className="text-xs text-gray-500">MapUp Assessment 2026</p>
    </div>
  </aside>
);
