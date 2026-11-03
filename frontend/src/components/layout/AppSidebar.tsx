import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headset,
  Store,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getCurrentUserProfile } from '../../lib/api/auth.api';
import { navigationItems } from './navigation';

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
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
    <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-slate-950 text-slate-300 transition-[width] md:flex ${collapsed ? 'w-[72px]' : 'w-[248px]'}`}>
      <div className={`flex h-[72px] items-center border-b border-white/10 ${collapsed ? 'justify-center gap-0 px-1' : 'gap-3 px-6'}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-xl bg-teal-500 text-white shadow-sm ${collapsed ? 'h-8 w-8' : 'h-9 w-9'}`}>
          <Store size={collapsed ? 17 : 19} strokeWidth={2.4} />
        </span>
        {!collapsed && <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold leading-tight tracking-tight text-white">
            ShopEase
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Retail management
          </p>
        </div>}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-white ${collapsed ? 'h-7 w-7' : 'h-8 w-8'}`}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <nav aria-label="Main navigation" className={`flex-1 space-y-1 overflow-y-auto py-5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Workspace
        </p>}
        {visibleItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group flex h-10 items-center rounded-lg text-[13px] font-medium transition-colors ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'} ${
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
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                )}
              </>
            )}
          </NavLink>
        ))}
        {!collapsed && roleCheckFailed && (
          <p role="status" className="px-3 pt-2 text-[10px] leading-4 text-slate-500">
            User access could not be verified; the Users menu is hidden.
          </p>
        )}
      </nav>

      {!collapsed && <div className="border-t border-white/10 p-4">
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
      </div>}
    </aside>
  );
}
