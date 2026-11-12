import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface LayoutProps {
  children: React.ReactNode;
  wsStatus: ConnectionStatus;
}

export const Layout: React.FC<LayoutProps> = ({ children, wsStatus }) => (
  <div className="flex h-screen bg-gray-50 overflow-hidden">
    <Sidebar />
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header wsStatus={wsStatus} />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  </div>
);
