import { ArrowRight, Layers3 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { navigationItems } from '../../components/layout/navigation';

export function PlaceholderPage() {
  const { pathname } = useLocation();
  const page =
    navigationItems.find((item) => item.path === pathname) ??
    navigationItems[0];

  if (!page) return null;

  return (
    <PageContainer
      title={page.label}
      description="This workspace is ready for its feature implementation."
    >
      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Layers3 size={22} />
        </span>
        <h2 className="mt-4 text-base font-semibold text-slate-900">
          {page.label} workspace
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          The navigation and design system are in place. This screen will be
          connected to the existing POS API as this feature is implemented.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Back to dashboard <ArrowRight size={14} />
        </Link>
      </section>
    </PageContainer>
  );
}
