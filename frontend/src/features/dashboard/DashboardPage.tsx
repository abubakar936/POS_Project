import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  FileText,
  PackagePlus,
  Plus,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table } from '../../components/ui/Table';
import {
  dashboardMetrics,
  lowStockProducts,
  recentTransactions,
  salesOverview,
  topProducts,
} from './dashboard.data';

const metricIcons = [CircleDollarSign, ShoppingCart, Users, ArrowUpRight];
const metricIconStyles = [
  'bg-teal-50 text-teal-700',
  'bg-blue-50 text-blue-700',
  'bg-violet-50 text-violet-700',
  'bg-orange-50 text-orange-700',
];

function SalesChart() {
  const width = 640;
  const height = 194;
  const left = 42;
  const right = 14;
  const top = 14;
  const bottom = 26;
  const max = 60;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const coordinates = salesOverview.map((point, index) => ({
    x: left + (chartWidth * index) / (salesOverview.length - 1),
    y: top + chartHeight - (point.sales / max) * chartHeight,
  }));
  const line = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const area = `${line} L ${coordinates.at(-1)?.x} ${top + chartHeight} L ${coordinates[0]?.x} ${top + chartHeight} Z`;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sales overview</h2>
          <p className="mt-0.5 text-xs text-slate-500">Sales performance over the last 7 days</p>
        </div>
        <span className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          This week
        </span>
      </div>
      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Sales increased from Rs. 18,000 to Rs. 52,000 over the last seven days"
          className="h-[194px] w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0f9f8f" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#0f9f8f" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0, 20, 40, 60].map((tick) => {
            const y = top + chartHeight - (tick / max) * chartHeight;
            return (
              <g key={tick}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="#e9eef3"
                  strokeDasharray={tick === 0 ? undefined : '3 4'}
                />
                <text
                  x={left - 9}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px]"
                >
                  {tick === 0 ? '0' : `${tick}k`}
                </text>
              </g>
            );
          })}
          <path d={area} fill="url(#sales-area)" />
          <path
            d={line}
            fill="none"
            stroke="#0f9f8f"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
          {coordinates.map((point, index) => (
            <g key={salesOverview[index]?.day}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="white"
                stroke="#0f9f8f"
                strokeWidth="2"
              />
              <text
                x={point.x}
                y={height - 4}
                textAnchor="middle"
                className="fill-slate-400 text-[10px]"
              >
                {salesOverview[index]?.day}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function DashboardPage() {
  return (
    <PageContainer
      title="Good morning, Mian Abubakar"
      description="Here’s what’s happening with your business today."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <FileText size={15} />
            Export report
          </Button>
          <Link
            to="/pos"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
          >
            <Plus size={15} />
            New sale
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric, index) => {
          const Icon = metricIcons[index] ?? CircleDollarSign;
          return (
            <article
              key={metric.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.02]"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-[23px] font-semibold tracking-tight text-slate-900">
                    {metric.value}
                  </p>
                </div>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metricIconStyles[index]}`}
                >
                  <Icon size={18} />
                </span>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px]">
                {metric.direction === 'up' ? (
                  <ArrowUpRight size={14} className="text-emerald-600" />
                ) : (
                  <ArrowDownRight size={14} className="text-rose-600" />
                )}
                <span className="font-semibold text-emerald-700">
                  {metric.change}
                </span>
                <span className="text-slate-400">{metric.comparison}</span>
              </p>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(330px,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Sales overview</h2>
              <p className="mt-1 text-xs text-slate-500">Daily revenue · last 7 days</p>
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
              +12.8%
            </span>
          </div>
          <SalesChart />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
              <p className="mt-1 text-xs text-slate-500">Common tasks, one click away</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              to="/pos"
              className="flex min-h-[76px] items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-teal-200 hover:bg-teal-50/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <ShoppingCart size={17} />
              </span>
              <span className="text-xs font-semibold text-slate-700">New sale</span>
            </Link>
            <Link
              to="/products"
              className="flex min-h-[76px] items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <PackagePlus size={17} />
              </span>
              <span className="text-xs font-semibold text-slate-700">Add product</span>
            </Link>
            <Link
              to="/customers"
              className="flex min-h-[76px] items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-violet-200 hover:bg-violet-50/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                <Users size={17} />
              </span>
              <span className="text-xs font-semibold text-slate-700">Add customer</span>
            </Link>
            <Link
              to="/stocks"
              className="flex min-h-[76px] items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-orange-200 hover:bg-orange-50/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                <Boxes size={17} />
              </span>
              <span className="text-xs font-semibold text-slate-700">Manage stock</span>
            </Link>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(330px,1fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent transactions
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                The latest sales recorded in your store
              </p>
            </div>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <Table
            headers={['Invoice #', 'Customer', 'Items', 'Total amount', 'Payment', 'Time']}
            caption="Recent sales transactions"
          >
            {recentTransactions.map((transaction) => (
              <tr key={transaction.invoice} className="text-xs hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3.5 pl-5 font-medium text-teal-700">
                  {transaction.invoice}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-700">
                  {transaction.customer}
                </td>
                <td className="px-4 py-3.5 text-slate-500">{transaction.items}</td>
                <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-slate-800">
                  {transaction.total}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge
                    tone={transaction.method === 'Cash' ? 'success' : 'info'}
                  >
                    {transaction.method}
                  </StatusBadge>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 pr-5 text-slate-500">
                  {transaction.time}
                </td>
              </tr>
            ))}
          </Table>
        </section>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Top-selling products
                </h2>
                <p className="mt-1 text-xs text-slate-500">By units sold today</p>
              </div>
              <Link
                to="/products"
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100 px-5">
              {topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center gap-3 py-3">
                  <span className="w-4 text-[11px] font-medium text-slate-400">
                    {index + 1}
                  </span>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${product.color}`}
                  >
                    {product.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {product.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-800">
                      {product.units} sold
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {product.revenue}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Low stock alert
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Items that may need restocking
                </p>
              </div>
              <Link
                to="/stocks"
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                View inventory
              </Link>
            </div>
            <div className="divide-y divide-slate-100 px-5">
              {lowStockProducts.map((product) => (
                <div key={product.name} className="flex items-center gap-3 py-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${product.color}`}
                  >
                    {product.initials}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                    {product.name}
                  </p>
                  <StatusBadge tone="danger">
                    {product.remaining} {product.unit}
                  </StatusBadge>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400">
        Dashboard figures are sample data for the visual prototype.
      </p>
    </PageContainer>
  );
}
