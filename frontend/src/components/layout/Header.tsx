import React from 'react';
import { Wifi, WifiOff, Loader } from 'lucide-react';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface HeaderProps {
  wsStatus: ConnectionStatus;
}

const statusConfig: Record<ConnectionStatus, { icon: React.ElementType; label: string; color: string }> = {
  connected:    { icon: Wifi,     label: 'Live',         color: 'text-green-400' },
  connecting:   { icon: Loader,   label: 'Connecting…',  color: 'text-yellow-400' },
  disconnected: { icon: WifiOff,  label: 'Disconnected', color: 'text-red-400' },
};

export const Header: React.FC<HeaderProps> = ({ wsStatus }) => {
  const { icon: Icon, label, color } = statusConfig[wsStatus];
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <h2 className="text-base font-semibold text-gray-700">Real-Time Vehicle Tracking</h2>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
        <Icon size={14} className={wsStatus === 'connecting' ? 'animate-spin' : ''} />
        {label}
      </div>
    </header>
  );
};
