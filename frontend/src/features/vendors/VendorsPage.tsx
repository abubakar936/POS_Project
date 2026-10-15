import {
  AlertCircle,
  Eye,
  FilePenLine,
  MapPin,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table } from '../../components/ui/Table';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api/client';
import {
  createVendor,
  deleteVendor,
  getVendor,
  listVendors,
  updateVendor,
  type VendorPayload,
  type VendorRecord,
} from '../../lib/api/vendors.api';
import {
  listVendorStockRecords,
  type InventoryStockRecord,
} from '../../lib/api/stocks.api';
import { formatRupees } from '../../lib/api/money';

const PAGE_SIZE = 20;
const STOCK_PAGE_SIZE = 10;
type StatusFilter = 'all' | 'true' | 'false';
type VendorFormValues = Omit<VendorPayload, 'isActive'>;

const emptyForm: VendorFormValues = {
  name: '',
  companyName: '',
  email: '',
  phone1: '',
  phone2: '',
  address1: '',
  address2: '',
  reference: '',
  description: '',
  note: '',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function optionalValue(
  value: string | null | undefined,
  clearEmpty: boolean,
): string | null | undefined {
  const normalized = value?.trim();
  return normalized || (clearEmpty ? null : undefined);
}

function makePayload(
  values: VendorFormValues,
  clearEmpty: boolean,
): VendorPayload {
  return {
    name: values.name.trim(),
    companyName: optionalValue(values.companyName, clearEmpty),
    email: optionalValue(values.email, clearEmpty),
    phone1: optionalValue(values.phone1, clearEmpty),
    phone2: optionalValue(values.phone2, clearEmpty),
    address1: optionalValue(values.address1, clearEmpty),
    address2: optionalValue(values.address2, clearEmpty),
    reference: optionalValue(values.reference, clearEmpty),
    description: optionalValue(values.description, clearEmpty),
    note: optionalValue(values.note, clearEmpty),
  };
}

function VendorFields({
  values,
  onChange,
  nameError,
  emailError,
}: {
  values: VendorFormValues;
  onChange: <K extends keyof VendorFormValues>(
    field: K,
    value: VendorFormValues[K],
  ) => void;
  nameError: string;
  emailError: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-xs font-medium text-slate-600">
        Vendor name <span className="text-rose-600">*</span>
        <Input
          id="vendor-name"
          required
          maxLength={255}
          value={values.name}
          onChange={(event) => onChange('name', event.target.value)}
          className="mt-1"
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? 'vendor-name-error' : undefined}
        />
        {nameError && <span id="vendor-name-error" className="mt-1 block text-xs text-rose-700">{nameError}</span>}
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Company name
        <Input maxLength={255} value={values.companyName ?? ''} onChange={(event) => onChange('companyName', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Email
        <Input type="email" maxLength={255} value={values.email ?? ''} onChange={(event) => onChange('email', event.target.value)} className="mt-1" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'vendor-email-error' : undefined} />
        {emailError && <span id="vendor-email-error" className="mt-1 block text-xs text-rose-700">{emailError}</span>}
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Phone
        <Input maxLength={50} value={values.phone1 ?? ''} onChange={(event) => onChange('phone1', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Alternate phone
        <Input maxLength={50} value={values.phone2 ?? ''} onChange={(event) => onChange('phone2', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Reference
        <Input maxLength={255} value={values.reference ?? ''} onChange={(event) => onChange('reference', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
        Address
        <Input maxLength={255} value={values.address1 ?? ''} onChange={(event) => onChange('address1', event.target.value)} className="mt-1" placeholder="Address line 1" />
        <Input maxLength={255} value={values.address2 ?? ''} onChange={(event) => onChange('address2', event.target.value)} className="mt-2" placeholder="Address line 2 (optional)" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Description
        <Textarea rows={3} value={values.description ?? ''} onChange={(event) => onChange('description', event.target.value)} className="mt-1" />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Internal note
        <Textarea rows={3} value={values.note ?? ''} onChange={(event) => onChange('note', event.target.value)} className="mt-1" />
      </label>
    </div>
  );
}

export function VendorsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRecord | null>(null);
  const [formValues, setFormValues] = useState<VendorFormValues>(emptyForm);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorRecord | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [stockRecords, setStockRecords] = useState<InventoryStockRecord[]>([]);
  const [stockPage, setStockPage] = useState(1);
  const [stockMeta, setStockMeta] = useState({ page: 1, limit: STOCK_PAGE_SIZE, total: 0, totalPages: 1 });
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<VendorRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VendorRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
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
    listVendors({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      isActive: status === 'all' ? undefined : status,
    }, controller.signal)
      .then((result) => {
        if (!active) return;
        setVendors(result.data);
        setMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load vendors.');
        if (error instanceof ApiError && error.status === 401) setAuthError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, reloadToken, search, status]);

  useEffect(() => {
    if (!selectedVendor) return;
    const controller = new AbortController();
    let active = true;
    setStockLoading(true);
    setStockError('');
    listVendorStockRecords(selectedVendor.id, stockPage, STOCK_PAGE_SIZE, controller.signal)
      .then((result) => {
        if (!active) return;
        setStockRecords(result.data);
        setStockMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setStockRecords([]);
        setStockError(error instanceof Error ? error.message : 'Could not load linked stock receipts.');
      })
      .finally(() => {
        if (active) setStockLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedVendor, stockPage]);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  function openCreate() {
    setEditingVendor(null);
    setFormValues(emptyForm);
    setNameError('');
    setEmailError('');
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(vendor: VendorRecord) {
    setEditingVendor(vendor);
    setFormValues({
      name: vendor.name,
      companyName: vendor.companyName ?? '',
      email: vendor.email ?? '',
      phone1: vendor.phone1 ?? '',
      phone2: vendor.phone2 ?? '',
      address1: vendor.address1 ?? '',
      address2: vendor.address2 ?? '',
      reference: vendor.reference ?? '',
      description: vendor.description ?? '',
      note: vendor.note ?? '',
    });
    setNameError('');
    setEmailError('');
    setFormError('');
    setFormOpen(true);
  }

  async function openDetails(vendor: VendorRecord) {
    setSelectedVendor(vendor);
    setStockPage(1);
    setStockRecords([]);
    setDetailsLoading(true);
    setDetailsError('');
    setStockError('');
    try {
      const current = await getVendor(vendor.id);
      setSelectedVendor(current);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : 'Could not load vendor details.');
    } finally {
      setDetailsLoading(false);
    }
  }

  function updateForm<K extends keyof VendorFormValues>(
    field: K,
    value: VendorFormValues[K],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    if (field === 'name') setNameError('');
    if (field === 'email') setEmailError('');
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = formValues.name.trim();
    if (!name) {
      setNameError('Vendor name is required.');
      document.getElementById('vendor-name')?.focus();
      return;
    }
    if (name.length > 255) {
      setNameError('Vendor name must be 255 characters or fewer.');
      return;
    }
    const email = (formValues.email ?? '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setSaving(true);
    setFormError('');
    setNameError('');
    setEmailError('');
    try {
      const payload = makePayload({ ...formValues, name }, editingVendor !== null);
      const saved = editingVendor
        ? await updateVendor(editingVendor.id, payload)
        : await createVendor(payload);
      setFormOpen(false);
      refresh();
      if (selectedVendor?.id === saved.id) setSelectedVendor(saved);
      showToast({
        tone: 'success',
        title: editingVendor ? 'Vendor updated' : 'Vendor created',
        description: saved.name,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFormError(`The server rejected this vendor as a conflict: ${error.message}`);
      } else if (error instanceof ApiError && error.status === 400) {
        setFormError(error.message || 'Please check the vendor fields.');
      } else {
        setFormError(error instanceof Error ? error.message : 'Could not save vendor.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus() {
    if (!pendingStatusChange) return;
    setActionLoading(true);
    setActionError('');
    try {
      const updated = await updateVendor(pendingStatusChange.id, {
        isActive: !pendingStatusChange.isActive,
      });
      setPendingStatusChange(null);
      if (selectedVendor?.id === updated.id) setSelectedVendor(updated);
      refresh();
      showToast({
        tone: 'success',
        title: updated.isActive ? 'Vendor activated' : 'Vendor deactivated',
        description: updated.name,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update vendor status.');
      setPendingStatusChange(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function removeVendor() {
    if (!pendingDelete) return;
    setActionLoading(true);
    setActionError('');
    try {
      await deleteVendor(pendingDelete.id);
      setPendingDelete(null);
      setSelectedVendor(null);
      refresh();
      showToast({
        tone: 'success',
        title: 'Vendor deleted',
        description: `${pendingDelete.name} was removed from the active vendor list.`,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete this vendor.');
    } finally {
      setActionLoading(false);
    }
  }

  const vendorRows = loading ? (
    <tr><td colSpan={6}><FeedbackState tone="loading" title="Loading vendors" description="Fetching vendor records from the POS server." /></td></tr>
  ) : loadError ? (
    <tr><td colSpan={6}><FeedbackState tone="error" title={authError ? 'Sign-in required' : 'Vendors could not be loaded'} description={authError ? 'Sign in with a valid POS account to view vendors.' : loadError} action={<Button variant="secondary" onClick={refresh}>Retry</Button>} /></td></tr>
  ) : vendors.length === 0 ? (
    <tr><td colSpan={6}><FeedbackState tone="empty" title={search ? 'No matching vendors' : 'No vendors yet'} description={search ? 'Try another vendor name, company, email, or phone.' : 'Add suppliers your shop buys stock from.'} action={!search ? <Button onClick={openCreate}><Plus size={16} />Add vendor</Button> : undefined} /></td></tr>
  ) : (
    vendors.map((vendor) => (
      <tr key={vendor.id} className="text-sm text-slate-600">
        <td className="px-4 py-3.5 first:pl-5">
          <div className="flex min-w-48 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Truck size={17} /></span>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{vendor.name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{vendor.companyName || 'No company name'}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5">
          <p>{vendor.phone1 || '—'}</p>
          {vendor.phone2 && <p className="mt-0.5 text-xs text-slate-400">{vendor.phone2}</p>}
        </td>
        <td className="px-4 py-3.5">{vendor.email || '—'}</td>
        <td className="max-w-56 truncate px-4 py-3.5" title={[vendor.address1, vendor.address2].filter(Boolean).join(', ')}>
          {[vendor.address1, vendor.address2].filter(Boolean).join(', ') || '—'}
        </td>
        <td className="px-4 py-3.5"><StatusBadge tone={vendor.isActive ? 'success' : 'neutral'}>{vendor.isActive ? 'Active' : 'Inactive'}</StatusBadge></td>
        <td className="px-4 py-3.5 last:pr-5">
          <div className="flex items-center justify-end gap-1">
            <button type="button" aria-label={`View ${vendor.name}`} title="View details and stock receipts" onClick={() => void openDetails(vendor)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Eye size={16} /></button>
            <button type="button" aria-label={`Edit ${vendor.name}`} title="Edit vendor" onClick={() => openEdit(vendor)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><FilePenLine size={16} /></button>
            <button type="button" aria-label={`${vendor.isActive ? 'Deactivate' : 'Activate'} ${vendor.name}`} title={vendor.isActive ? 'Deactivate vendor' : 'Activate vendor'} onClick={() => setPendingStatusChange(vendor)} className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">{vendor.isActive ? 'Deactivate' : 'Activate'}</button>
            <button type="button" aria-label={`Delete ${vendor.name}`} title="Soft-delete vendor" onClick={() => setPendingDelete(vendor)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
          </div>
        </td>
      </tr>
    ))
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Suppliers</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Vendors</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Maintain supplier contact details and review stock lots recorded against each vendor.</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} />Add vendor</Button>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search vendors" placeholder="Search name, company, email, or phone…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-3">
          <Select aria-label="Filter vendors by status" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }} className="min-w-36">
            <option value="all">All statuses</option><option value="true">Active</option><option value="false">Inactive</option>
          </Select>
          <span className="whitespace-nowrap text-xs text-slate-500">{loading ? 'Loading…' : `${meta.total.toLocaleString()} vendors`}</span>
        </div>
      </div>

      {actionError && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span className="flex items-center gap-2"><AlertCircle size={17} />{actionError}</span><button type="button" aria-label="Dismiss error" onClick={() => setActionError('')} className="text-rose-700">Dismiss</button></div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table headers={['Vendor', 'Phone', 'Email', 'Address', 'Status', 'Actions']} caption="Vendors">
          {vendorRows}
        </Table>
        {!loading && !loadError && meta.total > 0 && <div className="border-t border-slate-100 px-4 py-3"><Pagination page={page} totalPages={meta.totalPages} totalItems={meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} /></div>}
      </div>

      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <p>The Vendors API supports server-side pagination, search by name/company/email/primary phone, and active-status filtering. The backend does not enforce unique vendor names or emails. Outstanding balances and accounting purchase records are not available; linked stock-lot receipts are shown in vendor details where recorded.</p>
      </div>

      <Modal open={formOpen} onClose={() => { if (!saving) setFormOpen(false); }} title={editingVendor ? 'Edit vendor' : 'Add vendor'} description="Fields and validation follow the existing vendor DTO.">
        <form onSubmit={(event) => void submitForm(event)} className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          <VendorFields values={formValues} onChange={updateForm} nameError={nameError} emailError={emailError} />
          <p className="text-xs leading-5 text-slate-500">The backend does not check vendor name or email uniqueness; it may allow duplicate records.</p>
          {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingVendor ? 'Save changes' : 'Create vendor'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={selectedVendor !== null} onClose={() => setSelectedVendor(null)} title="Vendor details" description={selectedVendor?.name}>
        {detailsLoading ? <FeedbackState tone="loading" title="Loading vendor details" /> : detailsError ? <FeedbackState tone="error" title="Vendor details could not be loaded" description={detailsError} /> : selectedVendor && (
          <div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-base font-semibold text-slate-900">{selectedVendor.name}</h3>{selectedVendor.companyName && <p className="mt-1 text-sm text-slate-500">{selectedVendor.companyName}</p>}</div>
              <StatusBadge tone={selectedVendor.isActive ? 'success' : 'neutral'}>{selectedVendor.isActive ? 'Active' : 'Inactive'}</StatusBadge>
            </div>
            <dl className="grid gap-x-5 gap-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Primary phone</dt><dd className="mt-1 font-medium text-slate-800">{selectedVendor.phone1 || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Alternate phone</dt><dd className="mt-1 font-medium text-slate-800">{selectedVendor.phone2 || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all font-medium text-slate-800">{selectedVendor.email || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Reference</dt><dd className="mt-1 font-medium text-slate-800">{selectedVendor.reference || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />Address</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{[selectedVendor.address1, selectedVendor.address2].filter(Boolean).join('\n') || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Created</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(selectedVendor.createdAt)}</dd></div>
              <div><dt className="text-xs text-slate-500">Last updated</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(selectedVendor.updatedAt)}</dd></div>
              {selectedVendor.description && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Description</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{selectedVendor.description}</dd></div>}
              {selectedVendor.note && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Note</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{selectedVendor.note}</dd></div>}
            </dl>

            <section>
              <div className="mb-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">Linked stock receipts</h3><p className="mt-0.5 text-xs text-slate-500">Stock records referencing this vendor; not an accounting purchase ledger.</p></div><span className="text-xs text-slate-500">{stockLoading ? 'Loading…' : `${stockMeta.total.toLocaleString()} records`}</span></div>
              {stockLoading ? <FeedbackState tone="loading" title="Loading linked stock receipts" /> : stockError ? <FeedbackState tone="error" title="Stock receipts could not be loaded" description={stockError} /> : stockRecords.length === 0 ? <FeedbackState tone="empty" title="No linked stock receipts" description="No active stock lots were returned for this vendor." /> : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table headers={['Product / lot', 'Received', 'Remaining', 'Purchase cost', 'Purchase date']} caption="Vendor-linked stock receipt records">
                    {stockRecords.map((record) => (
                      <tr key={record.id} className="text-xs text-slate-600">
                        <td className="px-3 py-2.5"><p className="font-medium text-slate-800">{record.product?.name || 'Product unavailable'}</p><p className="mt-0.5 font-mono text-[10px] text-slate-400">{record.product?.sku || record.id}</p></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{record.quantity}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{record.remainingQuantity}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatRupees(record.purchasePrice)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(record.purchaseDate ?? record.createdAt)}</td>
                      </tr>
                    ))}
                  </Table>
                  {stockMeta.total > STOCK_PAGE_SIZE && <div className="border-t border-slate-100 px-2 py-1"><Pagination page={stockPage} totalPages={stockMeta.totalPages} totalItems={stockMeta.total} pageSize={STOCK_PAGE_SIZE} onPageChange={setStockPage} /></div>}
                </div>
              )}
            </section>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="secondary" onClick={() => openEdit(selectedVendor)}><FilePenLine size={14} />Edit</Button>
              <Button variant={selectedVendor.isActive ? 'danger' : 'secondary'} onClick={() => setPendingStatusChange(selectedVendor)}>{selectedVendor.isActive ? 'Deactivate' : 'Activate'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingStatusChange !== null}
        title={pendingStatusChange?.isActive ? 'Deactivate this vendor?' : 'Activate this vendor?'}
        description={pendingStatusChange?.isActive
          ? `${pendingStatusChange.name} will no longer be selectable for new stock receipts. Existing stock records remain unchanged.`
          : `${pendingStatusChange?.name ?? 'This vendor'} will be available for new stock receipts again.`}
        confirmLabel={pendingStatusChange?.isActive ? 'Deactivate vendor' : 'Activate vendor'}
        onCancel={() => setPendingStatusChange(null)}
        onConfirm={() => void changeStatus()}
        isLoading={actionLoading}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Soft-delete this vendor?"
        description={`${pendingDelete?.name ?? 'This vendor'} will be removed from the active vendor list. The backend does not check for linked stock records before soft-deleting; linked stock lots are not deleted. Deactivation is safer and reversible.`}
        confirmLabel="Soft-delete vendor"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void removeVendor()}
        isLoading={actionLoading}
      />
    </section>
  );
}
