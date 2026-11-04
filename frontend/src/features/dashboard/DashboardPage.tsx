import {
  Banknote,
  CalendarDays,
  CreditCard,
  CircleDollarSign,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Button } from '../../components/ui/Button';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table } from '../../components/ui/Table';
import { formatRupees } from '../../lib/api/money';
import { getDashboard, type DashboardBucket, type DashboardResponse } from '../../lib/api/dashboard.api';

type Preset = 'today' | 'week' | 'month' | 'custom';

interface DateRange {
  from: Date;
  to: Date;
}

interface MetricCardData {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: string;
}

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateRange(preset: Preset, customFrom: string, customTo: string): DateRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'today') {
    const to = new Date(today);
    to.setDate(to.getDate() + 1);
    return { from: today, to };
  }
  if (preset === 'week') {
    const from = new Date(today);
    const day = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - day);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    return { from, to };
  }
  if (preset === 'month') {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 1),
    };
  }
  if (!customFrom || !customTo || customFrom > customTo) return null;
  const from = new Date(`${customFrom}T00:00:00`);
  const to = new Date(`${customTo}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

function localDateKey(date: Date): string {
  return localDateValue(date);
}

function trendPoints(data: DashboardResponse['salesTrend'], range: DateRange, bucket: DashboardBucket) {
  const values = new Map(data.map((point) => [point.label, Number(point.sales)]));
  const points: Array<{ label: string; value: number }> = [];
  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());

  if (bucket === 'week') cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  if (bucket === 'month') cursor.setDate(1);

  while (cursor < range.to && points.length < 380) {
    let key = localDateKey(cursor);
    let label = new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'short' }).format(cursor);
    if (bucket === 'week') {
      label = `Week of ${label}`;
    } else if (bucket === 'month') {
      key = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(cursor);
      label = key;
    }
    points.push({ label, value: values.get(key) ?? 0 });
    if (bucket === 'week') cursor.setDate(cursor.getDate() + 7);
    else if (bucket === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `Rs. ${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 10_000) return `Rs. ${(value / 1_000).toFixed(0)}k`;
  if (value >= 1_000) return `Rs. ${(value / 1_000).toFixed(1)}k`;
  return formatRupees(value.toFixed(2));
}

function SalesChart({
  data,
  range,
  bucket,
}: {
  data: DashboardResponse['salesTrend'];
  range: DateRange;
  bucket: DashboardBucket;
}) {
  const points = trendPoints(data, range, bucket);
  const width = 720;
  const height = 220;
  const left = 78;
  const right = 18;
  const top = 14;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maximum = Math.max(1, ...points.map((point) => point.value));
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length <= 1 ? left + chartWidth / 2 : left + (chartWidth * index) / (points.length - 1),
    y: top + chartHeight - (point.value / maximum) * chartHeight,
  }));
  const line = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = coordinates.length
    ? `${line} L ${coordinates.at(-1)?.x} ${top + chartHeight} L ${coordinates[0]?.x} ${top + chartHeight} Z`
    : '';
  const ticks = [0, maximum / 3, (maximum * 2) / 3, maximum];
  const labelStep = Math.max(1, Math.ceil(coordinates.length / 7));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Sales trend for the selected date range"
        className="h-[220px] min-w-[560px] w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="dashboard-sales-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f9f8f" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#0f9f8f" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {ticks.map((tick, index) => {
          const y = top + chartHeight - (tick / maximum) * chartHeight;
          return (
            <g key={index}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="#e9eef3" strokeDasharray={index ? '3 4' : undefined} />
              <text x={left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{compactMoney(tick)}</text>
            </g>
          );
        })}
        {coordinates.length > 1 && <path d={area} fill="url(#dashboard-sales-area)" />}
        {coordinates.length > 1 && <path d={line} fill="none" stroke="#0f9f8f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />}
        {coordinates.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="white" stroke="#0f9f8f" strokeWidth="2">
              <title>{point.label}: {formatRupees(point.value.toFixed(2))}</title>
            </circle>
            {(index % labelStep === 0 || index === coordinates.length - 1) && (
              <text x={point.x} y={height - 7} textAnchor="middle" className="fill-slate-400 text-[10px]">{point.label}</text>
            )}
          </g>
        ))}
        {!coordinates.length && <text x={width / 2} y={height / 2} textAnchor="middle" className="fill-slate-400 text-xs">No sales in this period</text>}
      </svg>
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  const Icon = metric.icon;
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{metric.label}</p>
          <p className="mt-2 truncate text-[22px] font-semibold tracking-tight text-slate-900">{metric.value}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.tone}`}><Icon size={18} /></span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-400">{metric.note}</p>
    </article>
  );
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'PAID') return 'success';
  if (status === 'PARTIALLY PAID') return 'warning';
  if (status === 'UNPAID') return 'danger';
  return 'neutral';
}

export function DashboardPage() {
  const now = new Date();
  const [preset, setPreset] = useState<Preset>('today');
  const [customFrom, setCustomFrom] = useState(localDateValue(now));
  const [customTo, setCustomTo] = useState(localDateValue(now));
  const [bucket, setBucket] = useState<DashboardBucket>('day');
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const range = useMemo(() => dateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((key) => key + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!range) {
      setError('Choose a valid custom date range.');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    getDashboard({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      bucket,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }, controller.signal)
      .then((result) => {
        if (!active) return;
        setData(result);
        setLastUpdated(new Date());
      })
      .catch((requestError: unknown) => {
        if (!active || (requestError instanceof DOMException && requestError.name === 'AbortError')) return;
        setData(null);
        setError(requestError instanceof Error ? requestError.message : 'Dashboard data could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [range, bucket, refreshKey]);

  const summary = data?.summary;
  const unknownCostNote = summary?.unknownCostItems
    ? `Cost missing for ${summary.unknownCostItems} sale item${summary.unknownCostItems === 1 ? '' : 's'}`
    : 'Sales less recorded purchase cost';
  const cards: MetricCardData[] = summary ? [
    { label: 'Total sales', value: formatRupees(summary.totalSales), note: 'Completed sales in selected period', icon: TrendingUp, tone: 'bg-teal-50 text-teal-700' },
    { label: 'Total profit', value: summary.totalProfit === null ? 'Unavailable' : formatRupees(summary.totalProfit), note: summary.totalProfit === null ? unknownCostNote : 'Sales less recorded purchase cost', icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total orders', value: summary.totalOrders.toLocaleString(), note: 'Completed orders in selected period', icon: ShoppingCart, tone: 'bg-sky-50 text-sky-700' },
    { label: 'Customers', value: summary.totalCustomers.toLocaleString(), note: 'Distinct customers with a sale', icon: Users, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Cash payments', value: formatRupees(summary.totalCashPayments), note: 'Cash received in selected period', icon: Banknote, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Card payments', value: formatRupees(summary.totalCardPayments), note: 'Card payments received in selected period', icon: CreditCard, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Receivables', value: formatRupees(summary.receivables), note: 'Unpaid balance on period invoices', icon: CalendarDays, tone: 'bg-rose-50 text-rose-700' },
    { label: 'Sales till date', value: formatRupees(summary.totalSalesToDate), note: 'All-time completed sales', icon: CircleDollarSign, tone: 'bg-slate-100 text-slate-700' },
  ] : [];
  const paymentMaximum = Math.max(1, ...(data?.paymentMethods.map((payment) => Number(payment.amount)) ?? []));
  const updatedLabel = lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not refreshed yet';

  return (
    <PageContainer
      title="Business dashboard"
      description="Sales, payments, stock and product performance from your POS data."
      actions={(
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-400 sm:inline">{updatedLabel}</span>
          <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)} aria-label="Refresh dashboard">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh
          </Button>
          <Link to="/pos" className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-700">
            <ShoppingCart size={14} />New sale
          </Link>
        </div>
      )}
    >
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex max-w-full rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Dashboard date range">
            {([
              ['today', 'Today'],
              ['week', 'This week'],
              ['month', 'This month'],
              ['custom', 'Custom'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={preset === value} onClick={() => setPreset(value)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${preset === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-500">From
                <input aria-label="From date" type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700" />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">To
                <input aria-label="To date" type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700" />
              </label>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          {range ? `${range.from.toLocaleDateString()} – ${new Date(range.to.getTime() - 1).toLocaleDateString()}` : 'The start date must be on or before the end date.'}
        </p>
      </section>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {loading && !data ? (
        <FeedbackState tone="loading" title="Loading business data" description="Calculating sales, payments, inventory and product performance." />
      ) : !data && !error ? (
        <FeedbackState tone="empty" title="No dashboard data" description="There is no business activity for this range yet." />
      ) : data && summary && range ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Business statistics">
            {cards.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </section>

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Sales trend</h2>
                  <p className="mt-1 text-xs text-slate-500">Completed sales grouped by period</p>
                </div>
                <div className="inline-flex rounded-md border border-slate-200 p-0.5" role="group" aria-label="Sales trend grouping">
                  {([
                    ['day', 'Daily'],
                    ['week', 'Weekly'],
                    ['month', 'Monthly'],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={bucket === value} onClick={() => setBucket(value)} className={`rounded px-2.5 py-1 text-[11px] font-medium ${bucket === value ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:text-slate-800'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4"><SalesChart data={data.salesTrend} range={range!} bucket={bucket} /></div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.02]">
              <h2 className="text-sm font-semibold text-slate-900">Payment methods</h2>
              <p className="mt-1 text-xs text-slate-500">Payments received in selected period</p>
              <div className="mt-4 space-y-3">
                {data.paymentMethods.length ? data.paymentMethods.map((payment) => {
                  const percentage = Math.min(100, (Number(payment.amount) / paymentMaximum) * 100);
                  return (
                    <div key={payment.method}>
                      <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="text-slate-600">{payment.method.replaceAll('_', ' ')}</span><span className="font-medium tabular-nums text-slate-800">{formatRupees(payment.amount)}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${percentage}%` }} /></div>
                    </div>
                  );
                }) : <p className="py-5 text-center text-xs text-slate-400">No received payments in this period.</p>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                <div><p className="text-slate-400">Cash</p><p className="mt-1 font-semibold tabular-nums text-slate-800">{formatRupees(summary.totalCashPayments)}</p></div>
                <div><p className="text-slate-400">Card</p><p className="mt-1 font-semibold tabular-nums text-slate-800">{formatRupees(summary.totalCardPayments)}</p></div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <ProductList title="Top-selling products" description="Ranked by units sold in this period" empty="No products sold in this period." icon={Package}>
              {data.topProducts.map((product, index) => (
                <div key={product.productId} className="flex items-center gap-3 py-3">
                  <span className="w-5 text-xs font-medium tabular-nums text-slate-400">{index + 1}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{product.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{product.category}</p></div>
                  <div className="text-right"><p className="text-xs font-semibold text-slate-800">{Number(product.quantity).toLocaleString()} sold</p><p className="mt-0.5 text-[10px] tabular-nums text-slate-500">{formatRupees(product.revenue)}</p></div>
                </div>
              ))}
            </ProductList>
            <ProductList title="Best-performing products" description="Ranked by net profit with recorded cost" empty="No product costs are available for this period." icon={TrendingUp}>
              {data.bestProducts.map((product, index) => (
                <div key={product.productId} className="flex items-center gap-3 py-3">
                  <span className="w-5 text-xs font-medium tabular-nums text-slate-400">{index + 1}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{product.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{product.category}</p></div>
                  <p className="text-xs font-semibold tabular-nums text-emerald-700">{formatRupees(product.profit)}</p>
                </div>
              ))}
            </ProductList>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div><h2 className="text-sm font-semibold text-slate-900">Low-stock products</h2><p className="mt-1 text-xs text-slate-500">Current quantities at or below their configured thresholds</p></div>
              <Link to="/stocks" className="text-xs font-medium text-teal-700 hover:text-teal-800">View inventory</Link>
            </div>
            <div className="overflow-x-auto">
              <Table headers={['Product', 'Category', 'Current quantity', 'Low-stock threshold']} caption="Low-stock products">
                {data.lowStockProducts.length ? data.lowStockProducts.map((product) => (
                  <tr key={product.productId} className="text-xs hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 pl-5 font-medium text-slate-800">{product.name}</td>
                    <td className="px-4 py-3.5 text-slate-500">{product.category}</td>
                    <td className="px-4 py-3.5"><StatusBadge tone={Number(product.remainingQuantity) === 0 ? 'danger' : 'warning'}>{Number(product.remainingQuantity).toLocaleString()} {product.unit}</StatusBadge></td>
                    <td className="px-4 py-3.5 pr-5 tabular-nums text-slate-500">{Number(product.minimumQuantity).toLocaleString()} {product.unit}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="px-5 py-8 text-center text-xs text-slate-400">No products are at their low-stock threshold.</td></tr>}
              </Table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div><h2 className="text-sm font-semibold text-slate-900">Recent sales and transactions</h2><p className="mt-1 text-xs text-slate-500">Sales created in the selected period</p></div>
              <Link to="/orders" className="text-xs font-medium text-teal-700 hover:text-teal-800">View sales</Link>
            </div>
            <div className="overflow-x-auto">
              <Table headers={['Invoice / sale', 'Customer', 'Items', 'Total amount', 'Received', 'Method', 'Status', 'Time']} caption="Recent sales and transactions">
                {data.recentSales.length ? data.recentSales.map((sale) => (
                  <tr key={sale.id} className="text-xs hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3.5 pl-5"><span className="block font-semibold text-teal-700">{sale.invoiceNumber ?? sale.saleNumber}</span>{sale.invoiceNumber && <span className="mt-0.5 block text-[10px] text-slate-400">{sale.saleNumber}</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-700">{sale.customerName}</td>
                    <td className="px-4 py-3.5 tabular-nums text-slate-500">{sale.itemCount}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold tabular-nums text-slate-800">{formatRupees(sale.totalAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-600">{formatRupees(sale.amountPaid)}</td>
                    <td className="px-4 py-3.5 text-slate-500">{sale.paymentMethods.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3.5"><StatusBadge tone={statusTone(sale.paymentStatus)}>{sale.paymentStatus}</StatusBadge></td>
                    <td className="whitespace-nowrap px-4 py-3.5 pr-5 text-slate-500">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                )) : <tr><td colSpan={8} className="px-5 py-8 text-center text-xs text-slate-400">No sales in this period.</td></tr>}
              </Table>
            </div>
          </section>
        </>
      ) : null}
    </PageContainer>
  );
}

function ProductList({
  title,
  description,
  empty,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  empty: string;
  icon: LucideIcon;
  children: ReactNode[];
}) {
  const hasChildren = children.length > 0;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Icon size={17} /></span>
        <div><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div>
      </div>
      <div className="divide-y divide-slate-100 px-5">
        {hasChildren ? children : <p className="py-7 text-center text-xs text-slate-400">{empty}</p>}
      </div>
    </section>
  );
}
