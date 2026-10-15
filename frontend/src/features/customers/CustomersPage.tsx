import {
  AlertCircle,
  Eye,
  FilePenLine,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table } from '../../components/ui/Table';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api/client';
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
  type CustomerPayload,
  type CustomerRecord,
} from '../../lib/api/customers.api';
import { formatRupees } from '../../lib/api/money';
import { listOrders, type OrderRecord } from '../../lib/api/orders.api';

const PAGE_SIZE = 20;
const ORDER_PAGE_SIZE = 10;
type CustomerFormValues = CustomerPayload;

const emptyForm: CustomerFormValues = {
  customer_code: '',
  first_name: '',
  last_name: '',
  full_name: '',
  phone: '',
  alternate_phone: '',
  email: '',
  address: '',
  city: '',
  customer_type: '',
  status: '',
  notes: '',
};

function customerName(customer: CustomerRecord): string {
  const name =
    customer.full_name?.trim() ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unnamed customer';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function payloadFromForm(values: CustomerFormValues): CustomerPayload {
  const normalized = (value?: string | null) => value?.trim() || null;
  return {
    customer_code: normalized(values.customer_code),
    first_name: normalized(values.first_name),
    last_name: normalized(values.last_name),
    full_name: normalized(values.full_name),
    phone: normalized(values.phone),
    alternate_phone: normalized(values.alternate_phone),
    email: normalized(values.email),
    address: normalized(values.address),
    city: normalized(values.city),
    customer_type: normalized(values.customer_type),
    status: normalized(values.status),
    notes: normalized(values.notes),
  };
}

function CustomerFields({
  values,
  onChange,
  emailError,
}: {
  values: CustomerFormValues;
  onChange: <K extends keyof CustomerFormValues>(
    field: K,
    value: NonNullable<CustomerFormValues[K]>,
  ) => void;
  emailError: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-xs font-medium text-slate-600">
        Full name
        <Input maxLength={255} value={values.full_name ?? ''} onChange={(event) => onChange('full_name', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Customer code
        <Input maxLength={100} value={values.customer_code ?? ''} onChange={(event) => onChange('customer_code', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        First name
        <Input maxLength={100} value={values.first_name ?? ''} onChange={(event) => onChange('first_name', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Last name
        <Input maxLength={100} value={values.last_name ?? ''} onChange={(event) => onChange('last_name', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Phone
        <Input maxLength={50} value={values.phone ?? ''} onChange={(event) => onChange('phone', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Alternate phone
        <Input maxLength={50} value={values.alternate_phone ?? ''} onChange={(event) => onChange('alternate_phone', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
        Email
        <Input type="email" maxLength={255} value={values.email ?? ''} onChange={(event) => onChange('email', event.target.value)} className="mt-1" />
        {emailError && <span className="mt-1 block text-xs text-rose-700">{emailError}</span>}
      </label>
      <label className="block text-xs font-medium text-slate-600">
        City
        <Input maxLength={100} value={values.city ?? ''} onChange={(event) => onChange('city', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Customer type
        <Input maxLength={50} value={values.customer_type ?? ''} onChange={(event) => onChange('customer_type', event.target.value)} className="mt-1" placeholder="Optional; free text" />
      </label>
      <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
        Address
        <Textarea rows={2} value={values.address ?? ''} onChange={(event) => onChange('address', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Status
        <Input maxLength={50} value={values.status ?? ''} onChange={(event) => onChange('status', event.target.value)} className="mt-1" placeholder="Optional; backend has no status list" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Notes
        <Textarea rows={2} value={values.notes ?? ''} onChange={(event) => onChange('notes', event.target.value)} className="mt-1" />
      </label>
      <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
        The API does not require a particular field or define customer-type/status options. Enter a name or phone to help identify the record.
      </p>
    </div>
  );
}

export function CustomersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [formValues, setFormValues] = useState<CustomerFormValues>(emptyForm);
  const [formError, setFormError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderMeta, setOrderMeta] = useState({ page: 1, limit: ORDER_PAGE_SIZE, total: 0, totalPages: 1 });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CustomerRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError('');
    setAuthError(false);
    listCustomers({ page, limit: PAGE_SIZE, search: search || undefined }, controller.signal)
      .then((result) => {
        if (!active) return;
        setCustomers(result.data);
        setMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load customers.');
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
    if (!selectedCustomer) return;
    const controller = new AbortController();
    let active = true;
    setOrdersLoading(true);
    setOrdersError('');
    listOrders({
      page: orderPage,
      limit: ORDER_PAGE_SIZE,
      customerId: selectedCustomer.id,
    }, controller.signal)
      .then((result) => {
        if (!active) return;
        setOrders(result.data);
        setOrderMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setOrders([]);
        setOrdersError(error instanceof Error ? error.message : 'Could not load order history.');
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [orderPage, selectedCustomer]);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  function openCreate() {
    setEditingCustomer(null);
    setFormValues(emptyForm);
    setFormError('');
    setEmailError('');
    setFormOpen(true);
  }

  function openEdit(customer: CustomerRecord) {
    setEditingCustomer(customer);
    setFormValues({
      customer_code: customer.customer_code ?? '',
      first_name: customer.first_name ?? '',
      last_name: customer.last_name ?? '',
      full_name: customer.full_name ?? '',
      phone: customer.phone ?? '',
      alternate_phone: customer.alternate_phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      city: customer.city ?? '',
      customer_type: customer.customer_type ?? '',
      status: customer.status ?? '',
      notes: customer.notes ?? '',
    });
    setFormError('');
    setEmailError('');
    setFormOpen(true);
  }

  async function openDetails(customer: CustomerRecord) {
    setSelectedCustomer(customer);
    setOrderPage(1);
    setOrders([]);
    setDetailsLoading(true);
    setDetailsError('');
    setOrdersError('');
    try {
      setSelectedCustomer(await getCustomer(customer.id));
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : 'Could not load customer details.');
    } finally {
      setDetailsLoading(false);
    }
  }

  function updateForm<K extends keyof CustomerFormValues>(
    field: K,
    value: NonNullable<CustomerFormValues[K]>,
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    if (field === 'email') setEmailError('');
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formName = (formValues.full_name ?? '').trim();
    const firstName = (formValues.first_name ?? '').trim();
    const lastName = (formValues.last_name ?? '').trim();
    const phone = (formValues.phone ?? '').trim();
    if (!formName && !firstName && !lastName && !phone) {
      setFormError('Enter a customer name or phone number to identify this record.');
      return;
    }
    setFormError('');
    const email = (formValues.email ?? '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setSaving(true);
    setEmailError('');
    try {
      const payload = payloadFromForm(formValues);
      const saved = editingCustomer
        ? await updateCustomer(editingCustomer.id, payload)
        : await createCustomer(payload);
      setFormOpen(false);
      refresh();
      if (selectedCustomer?.id === saved.id) setSelectedCustomer(saved);
      showToast({
        tone: 'success',
        title: editingCustomer ? 'Customer updated' : 'Customer created',
        description: customerName(saved),
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setFormError(error.message || 'Please check the customer fields.');
      } else {
        setFormError(error instanceof Error ? error.message : 'Could not save customer.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeCustomer() {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    setActionError('');
    try {
      await deleteCustomer(pendingDelete.id);
      setPendingDelete(null);
      setSelectedCustomer(null);
      refresh();
      showToast({
        tone: 'success',
        title: 'Customer deleted',
        description: `${customerName(pendingDelete)} was removed from the active customer list.`,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete this customer.');
    } finally {
      setDeleteLoading(false);
    }
  }

  const customerRows = loading ? (
    <tr><td colSpan={6}><FeedbackState tone="loading" title="Loading customers" description="Fetching customer records from the POS server." /></td></tr>
  ) : loadError ? (
    <tr><td colSpan={6}><FeedbackState tone="error" title={authError ? 'Sign-in required' : 'Customers could not be loaded'} description={authError ? 'Sign in with a valid POS account to view customers.' : loadError} action={<Button variant="secondary" onClick={refresh}>Retry</Button>} /></td></tr>
  ) : customers.length === 0 ? (
    <tr><td colSpan={6}><FeedbackState tone="empty" title={search ? 'No matching customers' : 'No customers yet'} description={search ? 'Try another customer name, email, or phone number.' : 'Add a customer to associate them with POS orders.'} action={!search ? <Button onClick={openCreate}><Plus size={16} />Add customer</Button> : undefined} /></td></tr>
  ) : customers.map((customer) => (
    <tr key={customer.id} className="text-sm text-slate-600">
      <td className="px-4 py-3.5 first:pl-5">
        <p className="font-medium text-slate-800">{customerName(customer)}</p>
        {customer.customer_code && <p className="mt-0.5 font-mono text-xs text-slate-400">{customer.customer_code}</p>}
      </td>
      <td className="px-4 py-3.5">{customer.phone || '—'}{customer.alternate_phone && <p className="mt-0.5 text-xs text-slate-400">{customer.alternate_phone}</p>}</td>
      <td className="px-4 py-3.5">{customer.email || '—'}</td>
      <td className="px-4 py-3.5 text-right tabular-nums">{formatRupees(customer.current_balance)}</td>
      <td className="px-4 py-3.5">{customer.status ? <StatusBadge>{customer.status}</StatusBadge> : <span className="text-slate-400">—</span>}</td>
      <td className="px-4 py-3.5 last:pr-5"><div className="flex justify-end gap-1">
        <button type="button" aria-label={`View ${customerName(customer)}`} title="View details and order history" onClick={() => void openDetails(customer)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Eye size={16} /></button>
        <button type="button" aria-label={`Edit ${customerName(customer)}`} title="Edit customer" onClick={() => openEdit(customer)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><FilePenLine size={16} /></button>
        <button type="button" aria-label={`Delete ${customerName(customer)}`} title="Soft-delete customer" onClick={() => setPendingDelete(customer)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
      </div></td>
    </tr>
  ));

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Relationships</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Customers</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Manage customer contact records and review linked order history.</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} />Add customer</Button>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search customers" placeholder="Search name, phone, or email…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" />
        </div>
        <span className="whitespace-nowrap text-xs text-slate-500">{loading ? 'Loading…' : `${meta.total.toLocaleString()} customers`}</span>
      </div>

      {actionError && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span className="flex items-center gap-2"><AlertCircle size={17} />{actionError}</span><button type="button" aria-label="Dismiss error" onClick={() => setActionError('')} className="text-rose-700">Dismiss</button></div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table headers={['Customer', 'Phone', 'Email', 'Stored balance', 'Status', 'Actions']} caption="Customers">
          {customerRows}
        </Table>
        {!loading && !loadError && meta.total > 0 && <div className="border-t border-slate-100 px-4 py-3"><Pagination page={page} totalPages={meta.totalPages} totalItems={meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} /></div>}
      </div>

      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <p>The customer API supports pagination and search by name, email, and phone. The displayed balance is the customer record’s stored `current_balance`; the backend does not update it from sales or payments. Total purchases and outstanding-balance accounting are not implemented. Order history below contains only orders linked by customer ID.</p>
      </div>

      <Modal open={formOpen} onClose={() => { if (!saving) setFormOpen(false); }} title={editingCustomer ? 'Edit customer' : 'Add customer'} description="Contact fields follow the existing customer DTO. Financial balances and audit IDs are not editable here.">
        <form onSubmit={(event) => void submitForm(event)} className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          <CustomerFields values={formValues} onChange={updateForm} emailError={emailError} />
          {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingCustomer ? 'Save changes' : 'Create customer'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={selectedCustomer !== null} onClose={() => setSelectedCustomer(null)} title="Customer details" description={selectedCustomer ? customerName(selectedCustomer) : undefined}>
        {detailsLoading ? <FeedbackState tone="loading" title="Loading customer details" /> : detailsError ? <FeedbackState tone="error" title="Customer details could not be loaded" description={detailsError} /> : selectedCustomer && (
          <div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><UserRound size={19} /></span><div><h3 className="font-semibold text-slate-900">{customerName(selectedCustomer)}</h3>{selectedCustomer.customer_code && <p className="mt-0.5 font-mono text-xs text-slate-400">{selectedCustomer.customer_code}</p>}</div></div>
              {selectedCustomer.status && <StatusBadge>{selectedCustomer.status}</StatusBadge>}
            </div>
            <dl className="grid gap-x-5 gap-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Phone</dt><dd className="mt-1 font-medium text-slate-800">{selectedCustomer.phone || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Alternate phone</dt><dd className="mt-1 font-medium text-slate-800">{selectedCustomer.alternate_phone || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all font-medium text-slate-800">{selectedCustomer.email || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">City</dt><dd className="mt-1 font-medium text-slate-800">{selectedCustomer.city || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Address</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{selectedCustomer.address || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Customer type</dt><dd className="mt-1 font-medium text-slate-800">{selectedCustomer.customer_type || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Created</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(selectedCustomer.created_at)}</dd></div>
              <div><dt className="text-xs text-slate-500">Opening balance (stored)</dt><dd className="mt-1 font-medium text-slate-800">{formatRupees(selectedCustomer.opening_balance)}</dd></div>
              <div><dt className="text-xs text-slate-500">Current balance (stored)</dt><dd className="mt-1 font-medium text-slate-800">{formatRupees(selectedCustomer.current_balance)}</dd></div>
              {selectedCustomer.notes && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{selectedCustomer.notes}</dd></div>}
            </dl>

            <section>
              <div className="mb-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Order history</h3><p className="mt-0.5 text-xs text-slate-500">Orders explicitly linked to this customer record.</p></div><span className="text-xs text-slate-500">{ordersLoading ? 'Loading…' : `${orderMeta.total.toLocaleString()} orders`}</span></div>
              {ordersLoading ? <FeedbackState tone="loading" title="Loading order history" /> : ordersError ? <FeedbackState tone="error" title="Order history could not be loaded" description={ordersError} /> : orders.length === 0 ? <FeedbackState tone="empty" title="No linked orders" description="No active orders are linked to this customer." /> : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table headers={['Order', 'Date', 'Total']} caption="Customer order history">
                    {orders.map((order) => <tr key={order.id} className="text-xs text-slate-600"><td className="px-3 py-2.5 font-mono font-medium text-slate-800">{order.orderNumber}</td><td className="px-3 py-2.5 whitespace-nowrap">{formatDate(order.createdAt)}</td><td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-800">{formatRupees(order.totalAmount)}</td></tr>)}
                  </Table>
                  {orderMeta.total > ORDER_PAGE_SIZE && <div className="border-t border-slate-100 px-2 py-1"><Pagination page={orderPage} totalPages={orderMeta.totalPages} totalItems={orderMeta.total} pageSize={ORDER_PAGE_SIZE} onPageChange={setOrderPage} /></div>}
                </div>
              )}
            </section>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="secondary" onClick={() => openEdit(selectedCustomer)}><FilePenLine size={14} />Edit</Button>
              <Button variant="danger" onClick={() => setPendingDelete(selectedCustomer)}><Trash2 size={14} />Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this customer?"
        description={`${pendingDelete ? customerName(pendingDelete) : 'This customer'} will be soft-deleted from the active customer list. Existing orders are stored separately; this action does not delete or recalculate order totals or customer balances.`}
        confirmLabel="Delete customer"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void removeCustomer()}
        isLoading={deleteLoading}
      />
    </section>
  );
}
