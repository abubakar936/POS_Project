import {
  ChevronDown,
  Headset,
  Store,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getCurrentUserProfile } from '../../lib/api/auth.api';
import { navigationItems } from './navigation';

export function AppSidebar() {
  const [canViewUsers, setCanViewUsers] = useState(false);
  const [roleCheckFailed, setRoleCheckFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getCurrentUserProfile(controller.signal)
      .then((profile) => {
        setCanViewUsers(profile.role === 'admin');
        setRoleCheckFailed(false);
      })
      .catch(() => {
        setCanViewUsers(false);
        setRoleCheckFailed(true);
      });
    return () => controller.abort();
  }, []);

  const visibleItems = navigationItems.filter(
    (item) => item.path !== '/users' || canViewUsers,
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-slate-950 text-slate-300 md:flex">
      <div className="flex h-[72px] items-center gap-3 border-b border-white/10 px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-white shadow-sm">
          <Store size={19} strokeWidth={2.4} />
        </span>
        <div>
          <p className="text-[17px] font-bold leading-tight tracking-tight text-white">
            ShopEase
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Retail management
          </p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Workspace
        </p>
        {visibleItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.1 : 1.8}
                  className={isActive ? 'text-teal-300' : 'text-slate-500 group-hover:text-slate-300'}
                />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                )}
              </>
            )}
          </NavLink>
        ))}
        {roleCheckFailed && (
          <p role="status" className="px-3 pt-2 text-[10px] leading-4 text-slate-500">
            User access could not be verified; the Users menu is hidden.
          </p>
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/[0.05] p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
              <Headset size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200">Need help?</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                We&apos;re here for you
              </p>
            </div>
            <ChevronDown size={14} className="-rotate-90 text-slate-500" />
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] text-slate-600">
          ShopEase POS · Prototype
        </p>
      </div>
    </aside>
  );
}
