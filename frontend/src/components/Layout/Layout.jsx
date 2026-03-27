import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Disclaimer from './Disclaimer';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1200);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1200) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="relative flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {sidebarOpen && window.innerWidth < 1200 && (
        <button
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <Sidebar
        sidebarOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />

      <div className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-200 ${sidebarOpen ? 'lg:pl-60' : ''}`}>
        <div className="h-12 px-4 border-b border-slate-800 flex items-center">
          <button
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white text-sm"
            onClick={() => setSidebarOpen((s) => !s)}
            aria-label="Toggle sidebar"
          >
            <Menu size={16} />
            Menu
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-6 bg-slate-950/40">
          <Outlet />
        </main>

        <Disclaimer />
      </div>
    </div>
  );
}
