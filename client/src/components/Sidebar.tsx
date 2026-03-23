import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Plus,
  Database,
  Compass,
  Settings,
  HelpCircle,
  MessageSquare,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';

import { api } from '../lib/appConfig';

interface SidebarProps {
  user?: { name: string; email: string; role?: string };
}

const Sidebar: React.FC<SidebarProps> = ({ user: initialUser }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState(initialUser);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user) {
          const userRes = await api.get('/auth/me');
          if (userRes.data?.user) {
            setUser({
              name: userRes.data.user.name || 'User',
              email: userRes.data.user.email,
              role: userRes.data.user.role || 'Member',
            });
          }
        }
      } catch (err) {
        console.error('Sidebar fetch error:', err);
      }
    };
    fetchData();
  }, [initialUser, user]);

  const handleLogout = async () => {
    try {
      window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/logout`;
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    { icon: <LayoutDashboard size={18} />, label: 'Dashboards', path: '/dashboards' },
    { icon: <Database size={18} />, label: 'Data Sources', path: '/data-sources' },
    { icon: <Compass size={18} />, label: 'Data Context', path: '/data-context' },
    { icon: <MessageSquare size={18} />, label: 'Chat History', path: '/history' },
    { icon: <Settings size={18} />, label: 'Settings', path: '/settings' },
  ];

  const displayName = user?.name || 'User';
  const displayEmail = user?.email || '';

  const tooltipClasses =
    'absolute left-[72px] ml-2 px-3 py-2 bg-[#1A1A1A] border border-white/10 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-[100] whitespace-nowrap shadow-[0_10px_40px_rgba(0,0,0,0.5)] scale-95 group-hover:scale-100 origin-left';

  return (
    <aside className="sidebar flex h-screen w-18 flex-col border-r border-white/5 text-sm text-[#AAAAAA] bg-[#080808] z-60 relative">
      {/* Velora Branding */}
      <div className="flex h-20 items-center justify-center shrink-0">
        <div className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F06543] text-white shadow-[0_0_20px_rgba(240,101,67,0.3)] cursor-pointer">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>

          <div className={tooltipClasses}>
            velora <span className="text-[#F06543] ml-2 tracking-widest text-[10px]">v1.0</span>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="flex justify-center pb-8 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="group relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#F06543] font-medium text-white transition-all duration-300 hover:bg-[#D45131] hover:scale-105 active:scale-95 shadow-lg shadow-[#F06543]/10"
        >
          <Plus size={22} strokeWidth={3} />
          <div className={tooltipClasses}>New Chat</div>
        </button>
      </div>

      <div className="flex-1 px-3 space-y-3 overflow-visible">
        <ul className="flex flex-col items-center gap-3">
          {navItems.map((item) => (
            <li key={item.path} className="w-full flex justify-center">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `group relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-[#1A1A1A] text-white shadow-inner'
                      : 'hover:bg-[#111] hover:text-[#DDD]'
                  }`
                }
              >
                {item.icon}
                <div className={tooltipClasses}>{item.label}</div>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer Navigation */}
      {user && (
        <div className="mt-auto border-t border-white/5 py-5 px-3 flex flex-col items-center gap-4 justify-center shrink-0">
          <button
            onClick={() => navigate('/help')}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 hover:bg-[#111] hover:text-white"
          >
            <HelpCircle size={18} />
            <div className={tooltipClasses}>Help & Support</div>
          </button>

          <div className="relative group">
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 mb-4 w-40 rounded-2xl border border-white/10 bg-[#141414] p-1.5 shadow-2xl z-200 animate-in fade-in slide-in-from-bottom-2">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-red-400 font-bold text-xs transition-all hover:bg-red-500/10 whitespace-nowrap"
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${userMenuOpen ? 'bg-[#1A1A1A]' : 'hover:bg-[#111]'}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFC2B3] text-[10px] font-black text-[#F06543] shadow-sm">
                {displayName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </div>
              {!userMenuOpen && (
                <div className={tooltipClasses}>
                  <div className="flex flex-col">
                    <span className="text-white text-xs font-bold leading-none mb-1">
                      {displayName}
                    </span>
                    <span className="text-[#666] text-[10px] leading-none font-medium text-opacity-80">
                      {displayEmail}
                    </span>
                  </div>
                </div>
              )}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
