import {
  AlertCircle,
  CalendarDays,
  Eye,
  FileText,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api/client';
import { formatRupees } from '../../lib/api/money';
import {
  deleteOrder,
  getInvoiceForOrder,
  getOrder,
  listOrders,
  type OrderInvoice,
  type OrderRecord,
} from '../../lib/api/orders.api';

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function invoiceStatusTone(status: OrderInvoice['status']) {
  if (status === 'PAID') return 'success';
  if (status === 'PARTIALLY_PAID') return 'warning';
  return 'danger';
}

export function OrdersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<OrderRecord | null>(null);
  const [actionError, setActionError] = useState('');
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

    listOrders(
      { page, limit: PAGE_SIZE, search: search || undefined },
      controller.signal,
    )
      .then((result) => {
        if (!active) return;
        setOrders(result.data);
        setMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load orders.');
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

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);
  const countLabel = useMemo(
    () => (loading ? 'Loading orders…' : `${meta.total.toLocaleString()} orders`),
    [loading, meta.total],
  );

  async function openDetails(order: OrderRecord) {
    setSelectedOrder(order);
    setDetailLoading(true);
    setDetailError('');
    setInvoice(null);
    setInvoiceError('');
    setInvoiceLoading(true);
    const [orderResult, invoiceResult] = await Promise.allSettled([
      getOrder(order.id),
      getInvoiceForOrder(order.id, order.orderNumber),
    ]);
    if (orderResult.status === 'fulfilled') {
      setSelectedOrder(orderResult.value);
    } else {
      setDetailError(
        orderResult.reason instanceof Error
          ? orderResult.reason.message
          : 'Could not load order details.',
      );
    }
    if (invoiceResult.status === 'fulfilled') {
      setInvoice(invoiceResult.value);
    } else {
      setInvoiceError(
        invoiceResult.reason instanceof Error
          ? invoiceResult.reason.message
          : 'Could not load invoice and payment information.',
      );
    }
    setDetailLoading(false);
    setInvoiceLoading(false);
  }

  async function removeOrder() {
    if (!pendingDelete) return;
    setActionLoading(true);
    setActionError('');
    try {
      await deleteOrder(pendingDelete.id);
      setPendingDelete(null);
      setSelectedOrder(null);
      showToast({
        tone: 'success',
        title: 'Order removed',
        description: `${pendingDelete.orderNumber} was removed and its stock was returned.`,
      });
      refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not remove this order.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  const tableBody = loading ? (
    <tr>
      <td colSpan={7}>
        <FeedbackState
          tone="loading"
          title="Loading orders"
          description="Fetching order records from the POS server."
        />
      </td>
    </tr>
  ) : loadError ? (
    <tr>
      <td colSpan={7}>
        <FeedbackState
          tone="error"
          title={authError ? 'Sign-in required' : 'Orders could not be loaded'}
          description={
            authError
              ? 'Sign in with a valid POS account to view orders.'
              : loadError
          }
          action={
            authError ? (
              <Link to="/login" state={{ from: location }}>
                <Button variant="secondary">Sign in</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={refresh}>
                Retry
              </Button>
            )
          }
        />
      </td>
    </tr>
  ) : orders.length === 0 ? (
    <tr>
      <td colSpan={7}>
        <FeedbackState
          tone="empty"
          title={search ? 'No matching orders' : 'No orders yet'}
          description={
            search
              ? 'Try another order number, customer name, or phone number.'
              : 'Orders created through the POS will appear here.'
          }
        />
      </td>
    </tr>
  ) : (
    orders.map((order) => (
      <tr key={order.id} className="text-sm text-slate-600">
        <td className="px-4 py-3.5 first:pl-5">
          <p className="font-mono text-xs font-semibold text-slate-800">
            {order.orderNumber}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {order.items?.length ?? 0} line items
          </p>
        </td>
        <td className="px-4 py-3.5 whitespace-nowrap">
          {formatDate(order.createdAt)}
        </td>
        <td className="px-4 py-3.5">
          <p className="font-medium text-slate-700">{order.customerName || 'Walk-in customer'}</p>
          {order.customerPhone && (
            <p className="mt-0.5 text-xs text-slate-400">{order.customerPhone}</p>
          )}
        </td>
        <td className="px-4 py-3.5 text-right tabular-nums font-medium text-slate-800">
          {formatRupees(order.totalAmount)}
        </td>
        <td className="px-4 py-3.5">
          <StatusBadge>Not tracked</StatusBadge>
        </td>
        <td className="px-4 py-3.5">
          <StatusBadge tone="info">Invoice-based</StatusBadge>
        </td>
        <td className="px-4 py-3.5 last:pr-5">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label={`View order ${order.orderNumber}`}
              title="View order details"
              onClick={() => void openDetails(order)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Eye size={16} />
            </button>
          </div>
        </td>
      </tr>
    ))
  );

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-medium text-slate-400">Transactions</p>
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
          Orders / Sales
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Review order records created by the POS. Orders reserve stock; invoices
          and payments are tracked separately.
        </p>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            aria-label="Search orders"
            placeholder="Search order number, customer, or phone…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="pl-9"
          />
        </div>
        <span className="whitespace-nowrap text-xs text-slate-500">{countLabel}</span>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={17} />
            {actionError}
          </span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setActionError('')}
            className="text-rose-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table
          headers={[
            'Order',
            'Date',
            'Customer',
            'Total',
            'Order status',
            'Payment status',
            'Actions',
          ]}
          caption="Orders and sales records"
        >
          {tableBody}
        </Table>
        {!loading && !loadError && meta.total > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <CalendarDays size={15} className="mt-0.5 shrink-0" />
        <p>
          The Orders API supports pagination and search by order number,
          customer name, or phone. It does not expose date/customer filters,
          order or fulfillment states, or payment status. Payment information
          below comes from the linked invoice when one exists. The order
          contract has no tax fields.
        </p>
      </div>

      <Modal
        open={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        title="Order details"
        description={selectedOrder?.orderNumber}
      >
        {detailLoading ? (
          <FeedbackState tone="loading" title="Loading order details" />
        ) : detailError ? (
          <FeedbackState
            tone="error"
            title="Order details could not be loaded"
            description={detailError}
          />
        ) : selectedOrder ? (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge>Order state not tracked</StatusBadge>
              {invoice ? (
                <StatusBadge tone={invoiceStatusTone(invoice.status)}>
                  {invoice.status.replaceAll('_', ' ')}
                </StatusBadge>
              ) : (
                <StatusBadge tone="info">No active invoice found</StatusBadge>
              )}
            </div>

            <dl className="grid gap-x-5 gap-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Customer</dt>
                <dd className="mt-1 font-medium text-slate-800">
                  {selectedOrder.customerName || 'Walk-in customer'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Order date</dt>
                <dd className="mt-1 font-medium text-slate-800">
                  {formatDate(selectedOrder.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="mt-1 font-medium text-slate-800">
                  {selectedOrder.customerPhone || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Fulfillment</dt>
                <dd className="mt-1 font-medium text-slate-800">Not tracked by API</dd>
              </div>
              {selectedOrder.customerAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Address</dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {selectedOrder.customerAddress}
                  </dd>
                </div>
              )}
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                Items ({selectedOrder.items.length})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[460px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5 text-right">Qty</th>
                      <th className="px-3 py-2.5 text-right">Unit price</th>
                      <th className="px-3 py-2.5 text-right">Discount</th>
                      <th className="px-3 py-2.5 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id} className="text-slate-600">
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-800">{item.productName}</p>
                          {item.productSku && (
                            <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                              {item.productSku}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatRupees(item.salePrice)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatRupees(item.discountAmount)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-800">{formatRupees(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between gap-6 text-slate-500">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatRupees(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-6 text-slate-500">
                <span>Item discounts</span>
                <span className="tabular-nums">−{formatRupees(selectedOrder.itemDiscountAmount)}</span>
              </div>
              <div className="flex justify-between gap-6 text-slate-500">
                <span>Order discount</span>
                <span className="tabular-nums">−{formatRupees(selectedOrder.discountAmount)}</span>
              </div>
              <div className="flex justify-between gap-6 border-t border-slate-200 pt-2 font-semibold text-slate-900">
                <span>Order total</span>
                <span className="tabular-nums">{formatRupees(selectedOrder.totalAmount)}</span>
              </div>
            </div>

            {selectedOrder.note && (
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-medium text-slate-500">Order note</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {selectedOrder.note}
                </p>
              </div>
            )}

            <section className="border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText size={16} className="text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Invoice & payments
                </h3>
              </div>
              {invoiceLoading ? (
                <p className="text-sm text-slate-500">Checking linked invoice…</p>
              ) : invoiceError ? (
                <p role="alert" className="text-sm text-rose-700">{invoiceError}</p>
              ) : invoice ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-800">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Paid {formatRupees(invoice.amountPaid)} · Balance {formatRupees(invoice.balanceDue)}
                      </p>
                    </div>
                    <StatusBadge tone={invoiceStatusTone(invoice.status)}>
                      {invoice.status.replaceAll('_', ' ')}
                    </StatusBadge>
                  </div>
                  {invoice.payments.length ? (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                      {invoice.payments.map((payment) => (
                        <li key={payment.id} className="flex flex-wrap justify-between gap-2 px-3 py-2.5 text-xs">
                          <span className="text-slate-600">
                            {payment.paymentMethod}
                            {payment.reference ? ` · ${payment.reference}` : ''}
                            <span className="mt-0.5 block text-[10px] text-slate-400">
                              {formatDate(payment.createdAt)}
                            </span>
                          </span>
                          <span className="font-medium tabular-nums text-slate-800">
                            {formatRupees(payment.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No payments recorded on this invoice.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No active invoice was returned for this order. Payment status
                  is not stored on the order itself.
                </p>
              )}
            </section>

            {invoice === null && !invoiceLoading && !invoiceError && (
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button
                  variant="danger"
                  onClick={() => {
                    setActionError('');
                    setPendingDelete(selectedOrder);
                  }}
                >
                  <Trash2 size={15} />
                  Remove un-invoiced order
                </Button>
              </div>
            )}
            {invoice && (
              <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
                This order has an invoice. The backend prevents editing or
                removing invoiced orders.
              </p>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this order?"
        description={`This removes ${pendingDelete?.orderNumber ?? 'this order'} from the active order list and restores its reserved quantities to stock. The server will reject the action if an invoice exists.`}
        confirmLabel="Remove order"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void removeOrder()}
        isLoading={actionLoading}
      />
    </section>
  );
}
