import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from '../ui/CommandPalette';
import type { ConnectionStatus } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  wsStatus: ConnectionStatus;
}

export const Layout: React.FC<LayoutProps> = ({ children, wsStatus }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative flex h-screen bg-[#F7F2EB] text-[#23281E] overflow-hidden">
      {/* Subtle Organic Backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-24 w-[520px] h-[520px] rounded-full bg-[#8B9A6E]/15 blur-[120px] animate-aurora-drift" />
        <div className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full bg-[#EAE2D6]/90 blur-[120px] animate-aurora-drift" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-[#8B9A6E]/10 blur-[130px]" />
        <div className="absolute inset-0 bg-cyber-grid opacity-80" />
      </div>

      <div className="relative z-10 flex w-full h-full overflow-hidden">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(v => !v)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header
            wsStatus={wsStatus}
            onOpenMobileNav={() => setMobileOpen(true)}
            onOpenCommand={() => setCommandOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-[1600px] mx-auto">{children}</div>
          </main>
        </div>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
};
