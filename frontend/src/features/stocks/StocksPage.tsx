import {
  AlertCircle,
  Boxes,
  MapPin,
  PackagePlus,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
import { getCategories, getCompanies, getVendors } from '../../lib/api/catalog.api';
import type {
  CategoryOption,
  CompanyOption,
  VendorOption,
} from '../../lib/api/catalog.types';
import { formatRupees } from '../../lib/api/money';
import {
  createStock,
  listInventoryProducts,
  listInventoryStocks,
  type CreateStockPayload,
  type InventoryStockRecord,
} from '../../lib/api/stocks.api';
import type { Product } from '../../lib/api/products.types';

const PAGE_SIZE = 20;

interface InventoryProduct {
  product: Product;
  records: InventoryStockRecord[];
  quantity: number;
  minimumQuantity: number;
  hasMinimum: boolean;
}

interface StockFormValues {
  productId: string;
  quantity: string;
  minimumQuantity: string;
  locationType: string;
  rackLocation: string;
  purchasePrice: string;
  salePrice: string;
  printedPrice: string;
  totalPurchaseValue: string;
  purchaseDate: string;
  vendorId: string;
  companyId: string;
}

const emptyForm: StockFormValues = {
  productId: '',
  quantity: '',
  minimumQuantity: '',
  locationType: '',
  rackLocation: '',
  purchasePrice: '',
  salePrice: '',
  printedPrice: '',
  totalPurchaseValue: '',
  purchaseDate: '',
  vendorId: '',
  companyId: '',
};

function parseQuantity(value: string | null | undefined): number {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : 0;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function isNonNegativeDecimal(value: string, integerDigits = 10): boolean {
  return new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,2})?$`).test(value);
}

function getInventoryStatus(item: InventoryProduct) {
  if (item.quantity < 0) {
    return { label: 'Negative stock', tone: 'danger' as const };
  }
  if (item.records.length === 0 || item.quantity === 0) {
    return { label: 'Out of stock', tone: 'danger' as const };
  }
  if (item.hasMinimum && item.quantity <= item.minimumQuantity) {
    return { label: 'Low stock', tone: 'warning' as const };
  }
  return { label: 'In stock', tone: 'success' as const };
}

function validateStockForm(values: StockFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.productId) errors.productId = 'Select a product.';
  if (!isNonNegativeDecimal(values.quantity) || Number(values.quantity) <= 0) {
    errors.quantity = 'Quantity must be greater than zero.';
  }
  if (!values.locationType.trim()) errors.locationType = 'Enter a location type.';
  if (!isNonNegativeDecimal(values.purchasePrice)) {
    errors.purchasePrice = 'Enter a valid non-negative purchase price.';
  }
  if (!isNonNegativeDecimal(values.salePrice)) {
    errors.salePrice = 'Enter a valid non-negative selling price.';
  }
  if (values.minimumQuantity && !isNonNegativeDecimal(values.minimumQuantity)) {
    errors.minimumQuantity = 'Enter a valid non-negative threshold.';
  }
  if (values.printedPrice && !isNonNegativeDecimal(values.printedPrice)) {
    errors.printedPrice = 'Enter a valid non-negative printed price.';
  }
  if (values.totalPurchaseValue && !isNonNegativeDecimal(values.totalPurchaseValue, 12)) {
    errors.totalPurchaseValue = 'Enter a valid non-negative total value.';
  }
  if (!values.vendorId && !values.companyId) {
    errors.supplier = 'Select a vendor or a company.';
  }
  return errors;
}

function stockFormToPayload(values: StockFormValues): CreateStockPayload {
  return {
    productId: values.productId,
    quantity: values.quantity,
    ...(values.minimumQuantity ? { minimumQuantity: values.minimumQuantity } : {}),
    locationType: values.locationType.trim(),
    ...(values.rackLocation.trim() ? { rackLocation: values.rackLocation.trim() } : {}),
    purchasePrice: values.purchasePrice,
    salePrice: values.salePrice,
    ...(values.printedPrice ? { printedPrice: values.printedPrice } : {}),
    ...(values.totalPurchaseValue ? { totalPurchaseValue: values.totalPurchaseValue } : {}),
    ...(values.purchaseDate ? { purchaseDate: values.purchaseDate } : {}),
    ...(values.vendorId ? { vendorId: values.vendorId } : {}),
    ...(values.companyId ? { companyId: values.companyId } : {}),
  };
}

function FieldError({ children }: { children?: string }) {
  return children ? <span className="text-xs text-rose-700">{children}</span> : null;
}

export function StocksPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<InventoryStockRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState<StockFormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError('');
    setAuthError(false);
    Promise.all([
      listInventoryStocks(controller.signal),
      listInventoryProducts(controller.signal),
      getCategories(controller.signal),
      getVendors(controller.signal),
      getCompanies(controller.signal),
    ])
      .then(([stockRows, productRows, categoryRows, vendorRows, companyRows]) => {
        if (!active) return;
        setStocks(stockRows);
        setProducts(productRows);
        setCategories(categoryRows);
        setVendors(vendorRows);
        setCompanies(companyRows);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load inventory.');
        if (error instanceof ApiError && error.status === 401) setAuthError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const inventory = useMemo(() => {
    const recordsByProduct = new Map<string, InventoryStockRecord[]>();
    for (const stock of stocks) {
      const group = recordsByProduct.get(stock.productId) ?? [];
      group.push(stock);
      recordsByProduct.set(stock.productId, group);
    }
    return products.map((product) => {
      const records = recordsByProduct.get(product.id) ?? [];
      return {
        product,
        records,
        quantity: records.reduce(
          (total, record) => total + parseQuantity(record.remainingQuantity),
          0,
        ),
        minimumQuantity: records.reduce(
          (total, record) => total + parseQuantity(record.minimumQuantity),
          0,
        ),
        hasMinimum: records.some(
          (record) => record.minimumQuantity !== null && record.minimumQuantity !== undefined,
        ),
      };
    });
  }, [products, stocks]);

  const lowStockCount = inventory.filter(
    (item) => getInventoryStatus(item).label === 'Low stock',
  ).length;
  const outOfStockCount = inventory.filter(
    (item) => getInventoryStatus(item).label === 'Out of stock',
  ).length;
  const negativeStockCount = inventory.filter(
    (item) => getInventoryStatus(item).label === 'Negative stock',
  ).length;

  const filteredInventory = useMemo(() => {
    const query = searchInput.trim().toLocaleLowerCase();
    return inventory.filter((item) => {
      const matchesSearch =
        !query ||
        item.product.name.toLocaleLowerCase().includes(query) ||
        (item.product.sku ?? '').toLocaleLowerCase().includes(query) ||
        (item.product.barcode ?? '').toLocaleLowerCase().includes(query);
      const matchesCategory =
        !categoryFilter || item.product.categoryId === categoryFilter;
      const status = getInventoryStatus(item).label;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'low' && status === 'Low stock') ||
        (statusFilter === 'out' && status === 'Out of stock') ||
        (statusFilter === 'in' && status === 'In stock');
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, inventory, searchInput, statusFilter]);

  useEffect(() => setPage(1), [categoryFilter, searchInput, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredInventory.length / PAGE_SIZE));
  const visibleInventory = filteredInventory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeVendors = vendors.filter((vendor) => vendor.isActive);
  const activeCompanies = companies.filter((company) => company.isActive);

  function setField<K extends keyof StockFormValues>(field: K, value: StockFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === 'vendorId' || field === 'companyId') delete next.supplier;
      return next;
    });
  }

  function beginAddStock() {
    setValues(emptyForm);
    setFieldErrors({});
    setSubmitError('');
    setFormOpen(true);
  }

  function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateStockForm(values);
    setFieldErrors(errors);
    setSubmitError('');
    if (Object.keys(errors).length) return;
    setConfirmOpen(true);
  }

  async function submitStock() {
    setSaving(true);
    setSubmitError('');
    try {
      const result = await createStock(stockFormToPayload(values));
      setConfirmOpen(false);
      setFormOpen(false);
      setValues(emptyForm);
      showToast({
        tone: 'success',
        title: 'Stock added',
        description: `${result.product?.name ?? products.find((product) => product.id === result.productId)?.name ?? 'Product'} · ${formatQuantity(parseQuantity(result.quantity))} units received.`,
      });
      setReloadToken((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add stock.';
      setSubmitError(message);
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const selectedProduct = products.find((product) => product.id === values.productId);

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Catalog</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Stock / Inventory</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Receive stock into a product-specific stock lot, with supplier,
            pricing, and location details.
          </p>
        </div>
        <Button onClick={beginAddStock} disabled={loading || products.length === 0}>
          <PackagePlus size={16} /> Add Stock
        </Button>
      </div>

      {loadError ? (
        <FeedbackState
          tone="error"
          title={authError ? 'Sign-in required' : 'Inventory could not be loaded'}
          description={authError ? 'Sign in with a valid POS account to view inventory.' : loadError}
          action={
            authError ? (
              <Link to="/login" state={{ from: location }}>
                <Button variant="secondary">Sign in</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => setReloadToken((value) => value + 1)}>Retry</Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Products" value={loading ? '—' : products.length.toLocaleString()} icon={<Boxes size={18} />} />
            <SummaryCard label="Low stock" value={loading ? '—' : lowStockCount.toLocaleString()} icon={<TriangleAlert size={18} />} tone="warning" />
            <SummaryCard label="Out of stock" value={loading ? '—' : outOfStockCount.toLocaleString()} icon={<AlertCircle size={18} />} tone="danger" />
            <SummaryCard label="Negative stock" value={loading ? '—' : negativeStockCount.toLocaleString()} icon={<AlertCircle size={18} />} tone="danger" />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Search inventory by product"
                placeholder="Search product name, SKU, or barcode…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-w-40">
                <option value="">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
              <Select aria-label="Filter by stock status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-40">
                <option value="all">All stock statuses</option>
                <option value="in">In stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </Select>
            </div>
            <span className="whitespace-nowrap text-xs text-slate-500">
              {loading ? 'Loading inventory…' : `${filteredInventory.length.toLocaleString()} products`}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Table headers={['Product', 'Category', 'Current quantity', 'Stock status', 'Location', 'Actions']} caption="Stock inventory">
              {loading ? (
                <tr><td colSpan={6}><FeedbackState tone="loading" title="Loading inventory" description="Fetching products and stock records." /></td></tr>
              ) : visibleInventory.length === 0 ? (
                <tr><td colSpan={6}><FeedbackState tone="empty" title={filteredInventory.length ? 'No inventory on this page' : 'No matching inventory'} description={products.length === 0 ? 'Create products before receiving stock.' : 'Try changing the search or filters, or receive stock for a product.'} action={products.length > 0 && !filteredInventory.length ? <Button onClick={beginAddStock}><PackagePlus size={15} /> Add Stock</Button> : undefined} /></td></tr>
              ) : visibleInventory.map((item) => {
                const status = getInventoryStatus(item);
                const locations = [...new Set(item.records.map((record) => `${record.locationType}${record.rackLocation ? ` · ${record.rackLocation}` : ''}`))];
                return (
                  <tr key={item.product.id} className="text-sm text-slate-600">
                    <td className="px-4 py-3.5 first:pl-5">
                      <p className="font-medium text-slate-800">{item.product.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{item.product.sku || item.product.barcode || 'No SKU / barcode'}</p>
                    </td>
                    <td className="px-4 py-3.5">{item.product.category?.name || '—'}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium text-slate-800">{formatQuantity(item.quantity)}{item.product.measuringUnit ? ` ${item.product.measuringUnit}` : ''}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      {item.hasMinimum && <p className="mt-1 text-[10px] text-slate-400">Threshold {formatQuantity(item.minimumQuantity)}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      {locations.length ? <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><MapPin size={13} />{locations.join(', ')}</span> : '—'}
                    </td>
                    <td className="px-4 py-3.5 last:pr-5 text-right">
                      <Button size="sm" variant="secondary" onClick={() => { setValues({ ...emptyForm, productId: item.product.id }); setFieldErrors({}); setSubmitError(''); setFormOpen(true); }}>
                        Add stock
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Table>
            {!loading && filteredInventory.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-3">
                <Pagination page={page} totalPages={pageCount} totalItems={filteredInventory.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <p>
              Low stock is determined from the product’s total remaining quantity
              compared with the sum of configured minimum quantities. Products
              without stock records, or with no remaining quantity, are out of
              stock. The backend has no stock movement/history, adjustment,
              reason, or notes API; this screen only receives stock using
              <code className="mx-1">POST /stocks</code>.
            </p>
          </div>
        </>
      )}

      <Modal open={formOpen} onClose={() => { if (!saving) setFormOpen(false); }} title="Add stock" description="Create a new stock receipt for a product. Existing stock lots and sales quantities are not edited.">
        <form onSubmit={requestConfirmation} className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          {submitError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{submitError}</p>}
          <FormField label="Product" error={fieldErrors.productId}>
            <Select id="stock-product" required value={values.productId} onChange={(event) => setField('productId', event.target.value)}>
              <option value="">Select a product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}{product.isActive ? '' : ' · Inactive'}</option>)}
            </Select>
          </FormField>
          {selectedProduct && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {selectedProduct.category?.name ?? 'No category'}{selectedProduct.measuringUnit ? ` · Unit: ${selectedProduct.measuringUnit}` : ''}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Received quantity" error={fieldErrors.quantity}>
              <Input id="stock-quantity" type="number" min="0.01" step="0.01" required value={values.quantity} onChange={(event) => setField('quantity', event.target.value)} />
            </FormField>
            <FormField label="Low-stock threshold (optional)" error={fieldErrors.minimumQuantity}>
              <Input id="stock-minimum" type="number" min="0" step="0.01" value={values.minimumQuantity} onChange={(event) => setField('minimumQuantity', event.target.value)} />
            </FormField>
            <FormField label="Purchase price per unit" error={fieldErrors.purchasePrice}>
              <Input id="stock-purchase-price" type="number" min="0" step="0.01" required value={values.purchasePrice} onChange={(event) => setField('purchasePrice', event.target.value)} />
            </FormField>
            <FormField label="Selling price per unit" error={fieldErrors.salePrice}>
              <Input id="stock-sale-price" type="number" min="0" step="0.01" required value={values.salePrice} onChange={(event) => setField('salePrice', event.target.value)} />
            </FormField>
            <FormField label="Printed price (optional)" error={fieldErrors.printedPrice}>
              <Input id="stock-printed-price" type="number" min="0" step="0.01" value={values.printedPrice} onChange={(event) => setField('printedPrice', event.target.value)} />
            </FormField>
            <FormField label="Total purchase value (optional)" error={fieldErrors.totalPurchaseValue}>
              <Input id="stock-total-value" type="number" min="0" step="0.01" value={values.totalPurchaseValue} onChange={(event) => setField('totalPurchaseValue', event.target.value)} />
            </FormField>
            <FormField label="Location type" error={fieldErrors.locationType}>
              <Input id="stock-location-type" required placeholder="For example: Warehouse" value={values.locationType} onChange={(event) => setField('locationType', event.target.value)} />
            </FormField>
            <FormField label="Rack / shelf (optional)">
              <Input id="stock-rack" value={values.rackLocation} onChange={(event) => setField('rackLocation', event.target.value)} />
            </FormField>
            <FormField label="Purchase date (optional)">
              <Input id="stock-purchase-date" type="date" value={values.purchaseDate} onChange={(event) => setField('purchaseDate', event.target.value)} />
            </FormField>
            <FormField label="Vendor (select vendor or company)" error={fieldErrors.supplier}>
              <Select id="stock-vendor" value={values.vendorId} onChange={(event) => setField('vendorId', event.target.value)}>
                <option value="">No vendor selected</option>
                {activeVendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Company (select vendor or company)">
              <Select id="stock-company" value={values.companyId} onChange={(event) => setField('companyId', event.target.value)}>
                <option value="">No company selected</option>
                {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </Select>
            </FormField>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            The backend requires at least one active vendor or company. It sets
            the starting remaining quantity to the received quantity.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}><PackagePlus size={15} />Review receipt</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm stock receipt"
        description={`${selectedProduct?.name ?? 'Selected product'} · ${values.quantity || '0'} units · purchase ${formatRupees(values.purchasePrice)} per unit · selling ${formatRupees(values.salePrice)} per unit. This creates a stock lot using the backend stock API.`}
        confirmLabel="Add stock"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submitStock()}
        isLoading={saving}
      />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  const styles = tone === 'warning'
    ? 'bg-amber-50 text-amber-700'
    : tone === 'danger'
      ? 'bg-rose-50 text-rose-700'
      : 'bg-teal-50 text-teal-700';
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      </div>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles}`}>{icon}</span>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-slate-700">
      {label}
      {children}
      <FieldError>{error}</FieldError>
    </label>
  );
}
