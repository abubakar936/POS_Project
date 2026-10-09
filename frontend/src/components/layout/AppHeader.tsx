import {
  Bell,
  CalendarDays,
  ChevronDown,
  Search,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { navigationItems } from './navigation';
import { Input } from '../ui/Input';

export function AppHeader() {
  const location = useLocation();
  const today = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
  const currentPage =
    navigationItems.find((item) => item.path === location.pathname)?.label ??
    'Dashboard';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex h-[72px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden text-xs text-slate-400 sm:block">
            Workspace <span className="px-1.5 text-slate-300">/</span>
            <span className="font-medium text-slate-700">{currentPage}</span>
          </div>
          <label className="relative hidden w-[min(34vw,360px)] lg:block">
            <span className="sr-only">Search</span>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              className="h-9 bg-slate-50 pl-9 pr-14"
              placeholder="Search products, customers..."
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">
              Ctrl K
            </kbd>
          </label>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-2 text-xs text-slate-500 xl:flex">
            <CalendarDays size={15} className="text-slate-400" />
            <span>{today}</span>
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1.5 text-left hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">
              MA
            </span>
            <span className="hidden sm:block">
              <span className="block text-xs font-semibold text-slate-800">
                Mian Abubakar
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                Administrator
              </span>
            </span>
            <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
