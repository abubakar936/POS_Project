import { Outlet, NavLink } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { navigationItems } from './navigation';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <AppSidebar />
      <div className="min-h-screen md:pl-[248px]">
        <AppHeader />
        <nav
          aria-label="Mobile navigation"
          className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden"
        >
          {navigationItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-500 hover:bg-slate-50'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-[1800px] px-5 pb-8 pt-6 sm:px-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
