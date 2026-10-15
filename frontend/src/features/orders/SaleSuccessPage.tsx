import { CheckCircle2, ClipboardList, FileText, Printer } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { formatRupees } from '../../lib/api/money';
import type { CompletedSale } from '../../lib/api/orders.api';

export function SaleSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { sale?: CompletedSale } | null;
  const sale = state?.sale;
  if (!sale?.invoice) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center">
        <CheckCircle2 size={28} className="mx-auto text-teal-700" />
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Sale completed</h1>
        <p className="mt-2 text-sm text-slate-500">The saved sale can be found in your sales and invoice lists.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/orders"><Button variant="secondary">View sales</Button></Link>
          <Link to="/pos"><Button>New Sale</Button></Link>
        </div>
      </section>
    );
  }
  const paidStatus = sale.invoice.status.replaceAll('_', ' ');

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <style>{'@media print { body * { visibility: hidden !important; } .print-invoice, .print-invoice * { visibility: visible !important; } .print-invoice { position: absolute; inset: 0; width: 100%; } .no-print { display: none !important; } }'}</style>
      <div className="no-print flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <CheckCircle2 size={22} className="shrink-0" />
        <div><h1 className="font-semibold">Sale completed successfully</h1><p className="mt-0.5 text-sm">Order, invoice and stock updates have been saved.</p></div>
      </div>

      <article className="print-invoice space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">POS Invoice</p>
            <h2 className="mt-1 font-mono text-xl font-semibold text-slate-900">{sale.invoice.invoiceNumber}</h2>
            <p className="mt-1 text-sm text-slate-500">Sale {sale.orderNumber}</p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>{new Date(sale.createdAt).toLocaleString()}</p>
            <p className="mt-1 font-medium">{sale.customerName || 'Walk-in Customer'}</p>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr><th className="py-2">Item</th><th className="py-2 text-right">Quantity</th><th className="py-2 text-right">Unit price</th><th className="py-2 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 font-medium text-slate-800">{item.productName}</td>
                  <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-3 text-right tabular-nums">{formatRupees(item.salePrice)}</td>
                  <td className="py-3 text-right tabular-nums">{formatRupees(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto max-w-sm space-y-2 border-t border-slate-200 pt-4">
          <InvoiceRow label="Subtotal" value={formatRupees(sale.subtotal)} />
          <InvoiceRow label="Discount" value={`−${formatRupees(sale.discountAmount)}`} />
          <InvoiceRow label="Tax" value="Not supported" />
          <InvoiceRow label="Total" value={formatRupees(sale.totalAmount)} strong />
          <InvoiceRow label="Paid" value={formatRupees(sale.invoice.amountPaid)} />
          <InvoiceRow label="Balance due" value={formatRupees(sale.invoice.balanceDue)} />
          <InvoiceRow label="Payment status" value={paidStatus} />
        </div>
      </article>

      <div className="no-print flex flex-wrap justify-between gap-3">
        <Link to="/orders"><Button variant="secondary"><ClipboardList size={15} />Sales</Button></Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}><Printer size={15} />Print invoice</Button>
          <Link to="/invoices"><Button variant="secondary"><FileText size={15} />Invoices</Button></Link>
          <Button onClick={() => navigate('/pos', { replace: true })}>New Sale</Button>
        </div>
      </div>
    </section>
  );
}

function InvoiceRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'border-t border-slate-200 pt-2 text-base font-bold text-slate-900' : 'text-sm text-slate-600'}`}>
      <span>{label}</span><span className="text-right tabular-nums">{value}</span>
    </div>
  );
}
