import {
  AlertCircle,
  CalendarDays,
  Eye,
  FilePlus2,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api/client';
import { formatRupees } from '../../lib/api/money';
import {
  addInvoicePayment,
  createInvoice,
  deleteInvoice,
  deleteInvoicePayment,
  getInvoice,
  listInvoices,
  updateInvoice,
  type CreateInvoicePaymentPayload,
  type InvoicePaymentRecord,
  type InvoicePaymentStatus,
  type InvoiceRecord,
} from '../../lib/api/invoices.api';
import { getInvoiceForOrder, listOrders, type OrderRecord } from '../../lib/api/orders.api';

const PAGE_SIZE = 20;
const ORDER_PAGE_SIZE = 10;

interface InvoiceForm {
  note: string;
  dueDate: string;
}

interface PaymentForm {
  amount: string;
  paymentMethod: CreateInvoicePaymentPayload['paymentMethod'];
  reference: string;
  note: string;
}

type PendingAction =
  | { kind: 'delete-invoice'; invoice: InvoiceRecord }
  | {
      kind: 'delete-payment';
      invoice: InvoiceRecord;
      payment: InvoicePaymentRecord;
    };

const emptyInvoiceForm: InvoiceForm = { note: '', dueDate: '' };
const emptyPaymentForm: PaymentForm = {
  amount: '',
  paymentMethod: 'CASH',
  reference: '',
  note: '',
};

function formatDate(value?: string | null, includeTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}

function dateInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function statusTone(status: InvoicePaymentStatus) {
  if (status === 'PAID') return 'success';
  if (status === 'PARTIALLY_PAID') return 'warning';
  return 'danger';
}

function toCents(value: string): bigint | null {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function printInvoice(invoice: InvoiceRecord): boolean {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.opener = null;

  const items = invoice.order?.items ?? [];
  const itemRows = items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.productName)}${item.productSku ? `<small>${escapeHtml(item.productSku)}</small>` : ''}</td>
        <td class="num">${escapeHtml(item.quantity)}</td>
        <td class="num">${escapeHtml(formatRupees(item.salePrice))}</td>
        <td class="num">${escapeHtml(formatRupees(item.discountAmount))}</td>
        <td class="num">${escapeHtml(formatRupees(item.lineTotal))}</td>
      </tr>`,
    )
    .join('');
  const paymentRows = invoice.payments
    .map(
      (payment) => `<tr>
        <td>${escapeHtml(formatDate(payment.createdAt, true))}</td>
        <td>${escapeHtml(payment.paymentMethod.replaceAll('_', ' '))}${payment.reference ? ` · ${escapeHtml(payment.reference)}` : ''}</td>
        <td class="num">${escapeHtml(formatRupees(payment.amount))}</td>
      </tr>`,
    )
    .join('');

  popup.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(invoice.invoiceNumber)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 32px; color: #172033; font: 13px/1.5 Arial, sans-serif; }
          main { width: 100%; max-width: 800px; margin: 0 auto; }
          .top { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 2px solid #0f766e; }
          h1 { margin: 0; color: #0f766e; font-size: 24px; }
          h2 { margin: 0 0 5px; font-size: 17px; }
          p { margin: 3px 0; color: #526071; }
          .meta { text-align: right; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 22px 0; }
          .label { color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f1f5f9; color: #475569; font-size: 10px; text-align: left; text-transform: uppercase; }
          th, td { padding: 9px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          td small { display: block; color: #64748b; }
          .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
          .totals { width: 320px; margin: 18px 0 0 auto; }
          .totals td { border: 0; padding: 5px 0; }
          .grand td { border-top: 1px solid #cbd5e1; padding-top: 10px; color: #0f172a; font-weight: 700; }
          .section { margin-top: 24px; }
          .notice { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 10px; }
          @page { size: A4; margin: 12mm; }
          @media print { body { padding: 0; } main { max-width: none; } }
        </style>
      </head>
      <body>
        <main>
          <header class="top">
            <div><h1>ShopEase POS</h1><p>Business contact and address are not available in the invoice record.</p></div>
            <div class="meta"><h2>INVOICE</h2><p><strong>${escapeHtml(invoice.invoiceNumber)}</strong></p><p>Issued ${escapeHtml(formatDate(invoice.createdAt))}</p><p>Order ${escapeHtml(invoice.order?.orderNumber ?? '—')}</p></div>
          </header>
          <section class="details">
            <div><div class="label">Bill to</div><h2>${escapeHtml(invoice.customerName || 'Walk-in customer')}</h2><p>${escapeHtml(invoice.customerPhone || '')}</p><p>${escapeHtml(invoice.customerAddress || '')}</p></div>
            <div><div class="label">Payment</div><p><strong>${escapeHtml(invoice.status.replaceAll('_', ' '))}</strong></p><p>Due date: ${escapeHtml(formatDate(invoice.dueDate))}</p><p>Paid: ${escapeHtml(formatRupees(invoice.amountPaid))}</p><p>Balance: ${escapeHtml(formatRupees(invoice.balanceDue))}</p></div>
          </section>
          <table>
            <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Discount</th><th class="num">Line total</th></tr></thead>
            <tbody>${itemRows || '<tr><td colspan="5">Item details were not returned by the API.</td></tr>'}</tbody>
          </table>
          <table class="totals">
            <tr><td>Subtotal</td><td class="num">${escapeHtml(formatRupees(invoice.subtotal))}</td></tr>
            <tr><td>Item discounts</td><td class="num">−${escapeHtml(formatRupees(invoice.itemDiscountAmount))}</td></tr>
            <tr><td>Invoice discount</td><td class="num">−${escapeHtml(formatRupees(invoice.discountAmount))}</td></tr>
            <tr class="grand"><td>Total</td><td class="num">${escapeHtml(formatRupees(invoice.totalAmount))}</td></tr>
          </table>
          ${paymentRows ? `<section class="section"><div class="label">Payment records</div><table><thead><tr><th>Date</th><th>Method / reference</th><th class="num">Amount</th></tr></thead><tbody>${paymentRows}</tbody></table></section>` : ''}
          ${invoice.note ? `<p class="section"><strong>Note:</strong> ${escapeHtml(invoice.note)}</p>` : ''}
          <footer class="notice">Tax is not separately represented in the available order and invoice data. The invoice totals above are the values returned by the POS server.</footer>
        </main>
      </body>
    </html>`);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

export function InvoicesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [orderSearchInput, setOrderSearchInput] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderReloadToken, setOrderReloadToken] = useState(0);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderMeta, setOrderMeta] = useState({ page: 1, limit: ORDER_PAGE_SIZE, total: 0, totalPages: 1 });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [newInvoiceForm, setNewInvoiceForm] = useState<InvoiceForm>(emptyInvoiceForm);
  const [editForm, setEditForm] = useState<InvoiceForm>(emptyInvoiceForm);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [createError, setCreateError] = useState('');
  const [actionError, setActionError] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError('');
    setAuthError(false);
    listInvoices({ page, limit: PAGE_SIZE, search: search || undefined }, controller.signal)
      .then((result) => {
        if (!active) return;
        setInvoices(result.data);
        setMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load invoices.');
        if (error instanceof ApiError && error.status === 401) setAuthError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, reloadToken, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrderPage(1);
      setOrderSearch(orderSearchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [orderSearchInput]);

  useEffect(() => {
    if (!createOpen) return;
    const controller = new AbortController();
    let active = true;
    setOrdersLoading(true);
    setOrdersError('');
    listOrders({ page: orderPage, limit: ORDER_PAGE_SIZE, search: orderSearch || undefined }, controller.signal)
      .then((result) => {
        if (!active) return;
        setOrders(result.data);
        setOrderMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setOrdersError(error instanceof Error ? error.message : 'Could not load orders.');
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [createOpen, orderPage, orderReloadToken, orderSearch]);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);
  const countLabel = useMemo(
    () => (loading ? 'Loading invoices…' : `${meta.total.toLocaleString()} invoices`),
    [loading, meta.total],
  );

  async function openDetails(invoice: InvoiceRecord) {
    setSelectedInvoice(invoice);
    setDetailLoading(true);
    setDetailError('');
    setActionError('');
    try {
      setSelectedInvoice(await getInvoice(invoice.id));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Could not load invoice details.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeCreate(force = false) {
    if (creating && !force) return;
    setCreateOpen(false);
    setSelectedOrder(null);
    setNewInvoiceForm(emptyInvoiceForm);
    setCreateError('');
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder) {
      setCreateError('Select an order before creating an invoice.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const existing = await getInvoiceForOrder(selectedOrder.id, selectedOrder.orderNumber);
      if (existing) {
        throw new Error(`An invoice (${existing.invoiceNumber}) already exists for ${selectedOrder.orderNumber}.`);
      }
      const created = await createInvoice({
        orderId: selectedOrder.id,
        ...(newInvoiceForm.note.trim() ? { note: newInvoiceForm.note.trim() } : {}),
        ...(newInvoiceForm.dueDate ? { dueDate: new Date(`${newInvoiceForm.dueDate}T00:00:00`).toISOString() } : {}),
      });
      closeCreate(true);
      refresh();
      showToast({
        tone: 'success',
        title: 'Invoice created',
        description: `${created.invoiceNumber} was created from ${selectedOrder.orderNumber}. No payment was recorded.`,
      });
      void openDetails(created);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : 'Could not create the invoice. The order may already have an invoice.',
      );
    } finally {
      setCreating(false);
    }
  }

  function openEdit(invoice: InvoiceRecord) {
    setEditForm({ note: invoice.note ?? '', dueDate: dateInputValue(invoice.dueDate) });
    setFormError('');
    setEditOpen(true);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoice) return;
    setSaving(true);
    setFormError('');
    try {
      const updated = await updateInvoice(selectedInvoice.id, {
        note: editForm.note.trim() || null,
        dueDate: editForm.dueDate
          ? new Date(`${editForm.dueDate}T00:00:00`).toISOString()
          : null,
      });
      setSelectedInvoice(updated);
      setEditOpen(false);
      refresh();
      showToast({ tone: 'success', title: 'Invoice details updated', description: 'The note and due date were saved.' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not update invoice details.');
    } finally {
      setSaving(false);
    }
  }

  function openPayment() {
    setPaymentForm(emptyPaymentForm);
    setFormError('');
    setPaymentOpen(true);
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoice) return;
    const amountCents = toCents(paymentForm.amount);
    const balanceCents = toCents(selectedInvoice.balanceDue);
    if (amountCents === null || amountCents <= 0n) {
      setFormError('Enter a positive amount with no more than two decimal places.');
      return;
    }
    if (balanceCents !== null && amountCents > balanceCents) {
      setFormError('Payment cannot exceed the invoice balance due.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const updated = await addInvoicePayment(selectedInvoice.id, {
        amount: paymentForm.amount,
        paymentMethod: paymentForm.paymentMethod,
        ...(paymentForm.reference.trim() ? { reference: paymentForm.reference.trim() } : {}),
        ...(paymentForm.note.trim() ? { note: paymentForm.note.trim() } : {}),
      });
      setSelectedInvoice(updated);
      setPaymentOpen(false);
      refresh();
      showToast({ tone: 'success', title: 'Payment recorded', description: `${formatRupees(paymentForm.amount)} was recorded against ${updated.invoiceNumber}.` });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not record this payment.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    setActionError('');
    try {
      if (pendingAction.kind === 'delete-invoice') {
        await deleteInvoice(pendingAction.invoice.id);
        setPendingAction(null);
        setSelectedInvoice(null);
        showToast({
          tone: 'success',
          title: 'Invoice deleted',
          description: `${pendingAction.invoice.invoiceNumber} was removed from the active invoice list.`,
        });
      } else {
        const updated = await deleteInvoicePayment(
          pendingAction.invoice.id,
          pendingAction.payment.id,
        );
        setSelectedInvoice(updated);
        setPendingAction(null);
        showToast({ tone: 'success', title: 'Payment removed', description: 'The invoice balance was recalculated by the server.' });
      }
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The requested action could not be completed.');
    } finally {
      setActionLoading(false);
    }
  }

  const tableBody = loading ? (
    <tr><td colSpan={7}><FeedbackState tone="loading" title="Loading invoices" description="Fetching invoice records from the POS server." /></td></tr>
  ) : loadError ? (
    <tr><td colSpan={7}><FeedbackState tone="error" title={authError ? 'Sign-in required' : 'Invoices could not be loaded'} description={authError ? 'Sign in with a valid POS account to view invoices.' : loadError} action={authError ? <Link to="/login" state={{ from: location }}><Button variant="secondary">Sign in</Button></Link> : <Button variant="secondary" onClick={refresh}>Retry</Button>} /></td></tr>
  ) : invoices.length === 0 ? (
    <tr><td colSpan={7}><FeedbackState tone="empty" title={search ? 'No matching invoices' : 'No invoices yet'} description={search ? 'Try an invoice number, customer name or phone, or order number.' : 'Invoices created from orders will appear here.'} /></td></tr>
  ) : (
    invoices.map((invoice) => (
      <tr key={invoice.id} className="text-sm text-slate-600">
        <td className="px-4 py-3.5 first:pl-5">
          <p className="font-mono text-xs font-semibold text-slate-800">{invoice.invoiceNumber}</p>
          <p className="mt-1 text-xs text-slate-400">{invoice.order?.orderNumber ?? 'Order unavailable'}</p>
        </td>
        <td className="px-4 py-3.5 whitespace-nowrap">{formatDate(invoice.createdAt)}</td>
        <td className="px-4 py-3.5">
          <p className="font-medium text-slate-700">{invoice.customerName || 'Walk-in customer'}</p>
          {invoice.customerPhone && <p className="mt-0.5 text-xs text-slate-400">{invoice.customerPhone}</p>}
        </td>
        <td className="px-4 py-3.5 text-right tabular-nums font-medium text-slate-800">{formatRupees(invoice.totalAmount)}</td>
        <td className="px-4 py-3.5"><StatusBadge tone={statusTone(invoice.status)}>{invoice.status.replaceAll('_', ' ')}</StatusBadge></td>
        <td className="px-4 py-3.5 whitespace-nowrap">{formatDate(invoice.dueDate)}</td>
        <td className="px-4 py-3.5 last:pr-5">
          <div className="flex justify-end">
            <button type="button" aria-label={`View invoice ${invoice.invoiceNumber}`} title="View invoice" onClick={() => void openDetails(invoice)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Eye size={16} /></button>
          </div>
        </td>
      </tr>
    ))
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Transactions</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Invoices</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Create invoices from completed orders, review payment balances, and print customer copies.</p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setCreateError(''); setSelectedOrder(null); }}><FilePlus2 size={16} />Create from order</Button>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search invoices" placeholder="Invoice no., order no., customer, or phone…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" />
        </div>
        <span className="whitespace-nowrap text-xs text-slate-500">{countLabel}</span>
      </div>

      {actionError && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span className="flex items-center gap-2"><AlertCircle size={17} />{actionError}</span><button type="button" aria-label="Dismiss error" onClick={() => setActionError('')} className="text-rose-700">Dismiss</button></div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table headers={['Invoice / order', 'Issue date', 'Customer', 'Total', 'Payment status', 'Due date', 'Actions']} caption="Invoices">
          {tableBody}
        </Table>
        {!loading && !loadError && meta.total > 0 && <div className="border-t border-slate-100 px-4 py-3"><Pagination page={page} totalPages={meta.totalPages} totalItems={meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} /></div>}
      </div>

      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <CalendarDays size={15} className="mt-0.5 shrink-0" />
        <p>The API supports pagination and search by invoice number, order number, customer name, or phone. Date, customer, and status filters are not supported. Invoice totals and payment balances come from the server; order and invoice records do not expose itemized tax or shop contact details.</p>
      </div>

      <Modal open={createOpen} onClose={closeCreate} title="Create invoice from order" description="An invoice snapshots one existing order. Creating it does not record or charge a payment.">
        <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input aria-label="Search orders to invoice" placeholder="Search order number, customer, or phone…" value={orderSearchInput} onChange={(event) => setOrderSearchInput(event.target.value)} className="pl-9" />
          </div>
          {ordersLoading ? <FeedbackState tone="loading" title="Loading orders" /> : ordersError ? <FeedbackState tone="error" title="Orders could not be loaded" description={ordersError} action={<Button variant="secondary" onClick={() => setOrderReloadToken((value) => value + 1)}>Retry</Button>} /> : orders.length === 0 ? <FeedbackState tone="empty" title="No matching orders" description="Only existing orders can be invoiced." /> : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {orders.map((order) => (
                <button key={order.id} type="button" onClick={() => setSelectedOrder(order)} className={`flex w-full items-start justify-between gap-3 px-3 py-3 text-left ${selectedOrder?.id === order.id ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs font-semibold text-slate-800">{order.orderNumber}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{order.customerName || 'Walk-in customer'} · {formatDate(order.createdAt)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-800">{formatRupees(order.totalAmount)}</span>
                </button>
              ))}
              <div className="px-2 py-1"><Pagination page={orderPage} totalPages={orderMeta.totalPages} totalItems={orderMeta.total} pageSize={ORDER_PAGE_SIZE} onPageChange={setOrderPage} /></div>
            </div>
          )}
          {selectedOrder && (
            <form onSubmit={(event) => void submitCreate(event)} className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold text-slate-800">Selected: {selectedOrder.orderNumber}</p><p className="mt-1 text-xs text-slate-600">{selectedOrder.customerName || 'Walk-in customer'} · {formatRupees(selectedOrder.totalAmount)}</p></div>
                <ReceiptText size={17} className="text-teal-700" />
              </div>
              <label className="block text-xs font-medium text-slate-600">Due date (optional)<Input type="date" value={newInvoiceForm.dueDate} onChange={(event) => setNewInvoiceForm((form) => ({ ...form, dueDate: event.target.value }))} className="mt-1" /></label>
              <label className="block text-xs font-medium text-slate-600">Invoice note (optional)<textarea value={newInvoiceForm.note} onChange={(event) => setNewInvoiceForm((form) => ({ ...form, note: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15" /></label>
              <p className="text-xs leading-5 text-slate-500">The server assigns the invoice number and copies customer and financial values from the order. Existing or previously deleted invoices cannot be duplicated for the same order.</p>
              {createError && <p role="alert" className="text-xs text-rose-700">{createError}</p>}
              <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setSelectedOrder(null)} disabled={creating}>Choose another</Button><Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create invoice'}</Button></div>
            </form>
          )}
          {!selectedOrder && createError && <p role="alert" className="text-xs text-rose-700">{createError}</p>}
        </div>
      </Modal>

      <Modal open={selectedInvoice !== null} onClose={() => setSelectedInvoice(null)} title="Invoice details" description={selectedInvoice?.invoiceNumber}>
        {detailLoading ? <FeedbackState tone="loading" title="Loading invoice details" /> : detailError ? <FeedbackState tone="error" title="Invoice details could not be loaded" description={detailError} /> : selectedInvoice ? (
          <div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={statusTone(selectedInvoice.status)}>{selectedInvoice.status.replaceAll('_', ' ')}</StatusBadge><StatusBadge tone="info">Order {selectedInvoice.order?.orderNumber ?? 'not available'}</StatusBadge></div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => { if (!printInvoice(selectedInvoice)) showToast({ tone: 'error', title: 'Print window blocked', description: 'Allow pop-ups for this POS site, then try printing again.' }); }}><Printer size={14} />Print</Button>
                <Button variant="secondary" size="sm" onClick={() => openEdit(selectedInvoice)}>Edit note/date</Button>
                {selectedInvoice.balanceDue !== '0' && selectedInvoice.status !== 'PAID' && <Button size="sm" onClick={openPayment}><WalletCards size={14} />Record payment</Button>}
              </div>
            </div>

            <dl className="grid gap-x-5 gap-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Customer</dt><dd className="mt-1 font-medium text-slate-800">{selectedInvoice.customerName || 'Walk-in customer'}</dd></div>
              <div><dt className="text-xs text-slate-500">Issued</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(selectedInvoice.createdAt, true)}</dd></div>
              <div><dt className="text-xs text-slate-500">Phone</dt><dd className="mt-1 font-medium text-slate-800">{selectedInvoice.customerPhone || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Due date</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(selectedInvoice.dueDate)}</dd></div>
              {selectedInvoice.customerAddress && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Address</dt><dd className="mt-1 font-medium text-slate-800">{selectedInvoice.customerAddress}</dd></div>}
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Items ({selectedInvoice.order?.items?.length ?? 0})</h3>
              {selectedInvoice.order?.items?.length ? <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Description</th><th className="px-3 py-2.5 text-right">Qty</th><th className="px-3 py-2.5 text-right">Unit price</th><th className="px-3 py-2.5 text-right">Discount</th><th className="px-3 py-2.5 text-right">Line total</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{selectedInvoice.order.items.map((item) => <tr key={item.id} className="text-slate-600"><td className="px-3 py-3"><p className="font-medium text-slate-800">{item.productName}</p>{item.productSku && <p className="mt-0.5 font-mono text-[10px] text-slate-400">{item.productSku}</p>}</td><td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td><td className="px-3 py-3 text-right tabular-nums">{formatRupees(item.salePrice)}</td><td className="px-3 py-3 text-right tabular-nums">{formatRupees(item.discountAmount)}</td><td className="px-3 py-3 text-right tabular-nums font-medium text-slate-800">{formatRupees(item.lineTotal)}</td></tr>)}</tbody>
              </table></div> : <FeedbackState tone="empty" title="Line items unavailable" description="The invoice detail response did not include order items." />}
            </div>

            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between gap-6 text-slate-500"><span>Subtotal</span><span className="tabular-nums">{formatRupees(selectedInvoice.subtotal)}</span></div>
              <div className="flex justify-between gap-6 text-slate-500"><span>Item discounts</span><span className="tabular-nums">−{formatRupees(selectedInvoice.itemDiscountAmount)}</span></div>
              <div className="flex justify-between gap-6 text-slate-500"><span>Invoice discount</span><span className="tabular-nums">−{formatRupees(selectedInvoice.discountAmount)}</span></div>
              <div className="flex justify-between gap-6 border-t border-slate-200 pt-2 font-semibold text-slate-900"><span>Total</span><span className="tabular-nums">{formatRupees(selectedInvoice.totalAmount)}</span></div>
              <div className="flex justify-between gap-6 text-xs text-slate-500"><span>Paid · Balance</span><span className="tabular-nums">{formatRupees(selectedInvoice.amountPaid)} · {formatRupees(selectedInvoice.balanceDue)}</span></div>
            </div>

            <section>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Payments ({selectedInvoice.payments.length})</h3></div>
              {selectedInvoice.payments.length ? <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">{selectedInvoice.payments.map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs"><span className="text-slate-600">{payment.paymentMethod.replaceAll('_', ' ')}{payment.reference ? ` · ${payment.reference}` : ''}<span className="mt-0.5 block text-[10px] text-slate-400">{formatDate(payment.createdAt, true)}{payment.note ? ` · ${payment.note}` : ''}</span></span><span className="flex items-center gap-2"><strong className="font-medium tabular-nums text-slate-800">{formatRupees(payment.amount)}</strong><button type="button" title="Remove payment record" aria-label={`Remove payment ${formatRupees(payment.amount)}`} onClick={() => setPendingAction({ kind: 'delete-payment', invoice: selectedInvoice, payment })} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button></span></li>)}</ul> : <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">No payments have been recorded.</p>}
            </section>

            {selectedInvoice.note && <div className="rounded-lg border border-slate-100 p-3"><p className="text-xs font-medium text-slate-500">Invoice note</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selectedInvoice.note}</p></div>}

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs leading-5 text-slate-500">Invoice number, customer snapshot, line items, discounts, and totals are server-controlled. The API does not provide tax detail or business profile information. Invoice cancellation is not supported.</p>
              {selectedInvoice.payments.length > 0 ? <p className="text-xs text-amber-700">This invoice cannot be deleted while active payments exist. Remove the payment records first if deletion is genuinely required.</p> : <Button variant="danger" size="sm" onClick={() => setPendingAction({ kind: 'delete-invoice', invoice: selectedInvoice })}><Trash2 size={14} />Delete invoice</Button>}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={editOpen} onClose={() => { if (!saving) setEditOpen(false); }} title="Edit invoice note and due date" description="Financial values and invoice numbering cannot be changed.">
        <form onSubmit={(event) => void submitEdit(event)} className="space-y-4">
          <label className="block text-xs font-medium text-slate-600">Due date<Input type="date" value={editForm.dueDate} onChange={(event) => setEditForm((form) => ({ ...form, dueDate: event.target.value }))} className="mt-1" /></label>
          <label className="block text-xs font-medium text-slate-600">Note<textarea value={editForm.note} onChange={(event) => setEditForm((form) => ({ ...form, note: event.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15" /></label>
          {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</Button></div>
        </form>
      </Modal>

      <Modal open={paymentOpen} onClose={() => { if (!saving) setPaymentOpen(false); }} title="Record invoice payment" description={`Outstanding balance: ${formatRupees(selectedInvoice?.balanceDue)}`}>
        <form onSubmit={(event) => void submitPayment(event)} className="space-y-4">
          <label className="block text-xs font-medium text-slate-600">Amount (Rs.)<Input inputMode="decimal" placeholder="0.00" value={paymentForm.amount} onChange={(event) => setPaymentForm((form) => ({ ...form, amount: event.target.value }))} className="mt-1" required /></label>
          <label className="block text-xs font-medium text-slate-600">Payment method<Select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((form) => ({ ...form, paymentMethod: event.target.value as PaymentForm['paymentMethod'] }))} className="mt-1"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></Select></label>
          <label className="block text-xs font-medium text-slate-600">Reference (optional)<Input value={paymentForm.reference} onChange={(event) => setPaymentForm((form) => ({ ...form, reference: event.target.value }))} className="mt-1" /></label>
          <label className="block text-xs font-medium text-slate-600">Note (optional)<textarea value={paymentForm.note} onChange={(event) => setPaymentForm((form) => ({ ...form, note: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15" /></label>
          <p className="text-xs leading-5 text-slate-500">This records a payment entry only. It does not charge a card or contact a bank. The server rejects payments above the remaining balance.</p>
          {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setPaymentOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button></div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.kind === 'delete-payment' ? 'Remove this payment record?' : 'Delete this invoice?'}
        description={pendingAction?.kind === 'delete-payment'
          ? `Remove the ${formatRupees(pendingAction.payment.amount)} ${pendingAction.payment.paymentMethod.replaceAll('_', ' ')} payment from ${pendingAction.invoice.invoiceNumber}? The server will update the outstanding balance.`
          : `Delete ${pendingAction?.kind === 'delete-invoice' ? pendingAction.invoice.invoiceNumber : 'this invoice'}? The server only permits deletion when no active payments remain. Deleted invoices cannot be recreated for the same order, and cancellation is not available.`}
        confirmLabel={pendingAction?.kind === 'delete-payment' ? 'Remove payment' : 'Delete invoice'}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void confirmAction()}
        isLoading={actionLoading}
      />
    </section>
  );
}
