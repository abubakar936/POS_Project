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
  updateStockSalePrice,
  type CreateStockPayload,
  type InventoryStockRecord,
} from '../../lib/api/stocks.api';
import type { Product } from '../../lib/api/products.types';
import { isWholeQuantityUnit } from '../../lib/api/measurement-units';

const PAGE_SIZE = 20;

interface InventoryProduct {
  product: Product;
  records: InventoryStockRecord[];
  hasMinimum: boolean;
  quantityHundredths: bigint;
  minimumQuantityHundredths: bigint;
  stockValueCents: bigint;
}

function formatQuantityHundredths(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString();
  const grouped = new Intl.NumberFormat('en-PK').format(whole);
  return `${negative ? '−' : ''}${grouped}${fraction === '0' ? '' : `.${fraction.padStart(2, '0')}`}`;
}

interface InventoryRow {
  item: InventoryProduct;
  record: InventoryStockRecord | null;
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

function parseHundredths(value: string | null | undefined): bigint {
  const normalized = value?.trim() ?? '0';
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return 0n;
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2] ?? '0');
  const fraction = BigInt((match[3] ?? '').padEnd(2, '0'));
  return sign * (whole * 100n + fraction);
}

function lotValueCents(record: InventoryStockRecord): bigint {
  const product =
    parseHundredths(record.remainingQuantity) *
    parseHundredths(record.purchasePrice);
  return product >= 0n
    ? (product + 50n) / 100n
    : (product - 50n) / 100n;
}

function formatRupeesFromCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  const grouped = new Intl.NumberFormat('en-PK').format(absolute / 100n);
  return `${negative ? '−' : ''}Rs. ${grouped}.${fraction}`;
}

function isNonNegativeDecimal(value: string, integerDigits = 10): boolean {
  return new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,2})?$`).test(value);
}

function getInventoryStatus(item: InventoryProduct) {
  if (
    item.quantityHundredths < 0n ||
    item.records.some((record) => parseHundredths(record.remainingQuantity) < 0n)
  ) {
    return { label: 'Negative stock', tone: 'danger' as const };
  }
  if (item.records.length === 0 || item.quantityHundredths === 0n) {
    return { label: 'Out of stock', tone: 'danger' as const };
  }
  if (
    item.hasMinimum &&
    item.quantityHundredths <= item.minimumQuantityHundredths
  ) {
    return { label: 'Low stock', tone: 'warning' as const };
  }
  return { label: 'In stock', tone: 'success' as const };
}

function validateStockForm(
  values: StockFormValues,
  measuringUnit?: string | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.productId) errors.productId = 'Select a product.';
  if (!isNonNegativeDecimal(values.quantity) || Number(values.quantity) <= 0) {
    errors.quantity = 'Quantity must be greater than zero.';
  } else if (
    isWholeQuantityUnit(measuringUnit) &&
    !/^\d+(?:\.0+)?$/.test(values.quantity)
  ) {
    errors.quantity = 'Quantity must be a whole number for this measuring unit.';
  }
  if (!values.locationType.trim()) errors.locationType = 'Enter a location type.';
  if (!isNonNegativeDecimal(values.purchasePrice)) {
    errors.purchasePrice = 'Enter a valid non-negative buy price.';
  }
  if (!isNonNegativeDecimal(values.salePrice)) {
    errors.salePrice = 'Enter a valid non-negative selling price.';
  }
  if (values.minimumQuantity && !isNonNegativeDecimal(values.minimumQuantity)) {
    errors.minimumQuantity = 'Enter a valid non-negative threshold.';
  } else if (
    values.minimumQuantity &&
    isWholeQuantityUnit(measuringUnit) &&
    !/^\d+(?:\.0+)?$/.test(values.minimumQuantity)
  ) {
    errors.minimumQuantity = 'Threshold must be a whole number for this measuring unit.';
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
  const [priceEditStock, setPriceEditStock] = useState<InventoryStockRecord | null>(null);
  const [priceEditValue, setPriceEditValue] = useState('');
  const [priceEditError, setPriceEditError] = useState('');
  const [priceConfirmOpen, setPriceConfirmOpen] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
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
      const quantityHundredths = records.reduce(
        (total, record) => total + parseHundredths(record.remainingQuantity),
        0n,
      );
      const thresholds = records
        .map((record) =>
          record.minimumQuantity === null || record.minimumQuantity === undefined
            ? null
            : parseHundredths(record.minimumQuantity),
        )
        .filter((value): value is bigint => value !== null);
      return {
        product,
        records,
        hasMinimum: thresholds.length > 0,
        quantityHundredths,
        minimumQuantityHundredths: thresholds.length
          ? thresholds.reduce((maximum, value) => value > maximum ? value : maximum, 0n)
          : 0n,
        stockValueCents: records.reduce(
          (total, record) => total + lotValueCents(record),
          0n,
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
  const totalStockValueCents = inventory.reduce(
    (total, item) => total + item.stockValueCents,
    0n,
  );

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
        (statusFilter === 'negative' && status === 'Negative stock') ||
        (statusFilter === 'in' && status === 'In stock');
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, inventory, searchInput, statusFilter]);

  useEffect(() => setPage(1), [categoryFilter, searchInput, statusFilter]);

  const inventoryRows: InventoryRow[] = filteredInventory.flatMap<InventoryRow>(
    (item) =>
      item.records.length
        ? item.records.map((record) => ({ item, record }))
        : [{ item, record: null }],
  );
  const pageCount = Math.max(1, Math.ceil(inventoryRows.length / PAGE_SIZE));
  const visibleInventory = inventoryRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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
    const errors = validateStockForm(values, products.find((product) => product.id === values.productId)?.measuringUnit);
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
      const product = result.product ?? products.find((item) => item.id === result.productId);
      setConfirmOpen(false);
      setFormOpen(false);
      setValues(emptyForm);
      showToast({
        tone: 'success',
        title: 'Stock added',
        description: `${product?.name ?? 'Product'} · ${formatQuantity(parseQuantity(result.quantity))}${product?.measuringUnit ? ` ${product.measuringUnit}` : ' units'} received.`,
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

  function saveSalePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!priceEditStock) return;
    if (!isNonNegativeDecimal(priceEditValue)) {
      setPriceEditError('Enter a valid price with up to 2 decimal places.');
      return;
    }
    setPriceEditError('');
    setPriceConfirmOpen(true);
  }

  async function confirmSalePriceUpdate() {
    if (!priceEditStock) return;
    setPriceSaving(true);
    setPriceEditError('');
    try {
      const updated = await updateStockSalePrice(priceEditStock.id, priceEditValue);
      setStocks((current) =>
        current.map((record) =>
          record.id === updated.id ? { ...record, ...updated } : record,
        ),
      );
      setPriceConfirmOpen(false);
      setPriceEditStock(null);
      showToast({
        tone: 'success',
        title: 'Selling price updated',
        description: `${products.find((product) => product.id === updated.productId)?.name ?? 'Stock lot'} is now ${formatRupees(updated.salePrice)} per unit.`,
      });
    } catch (error) {
      setPriceEditError(
        error instanceof Error
          ? error.message
          : 'Could not update the selling price.',
      );
      setPriceConfirmOpen(false);
    } finally {
      setPriceSaving(false);
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Products" value={loading ? '—' : products.length.toLocaleString()} icon={<Boxes size={18} />} />
            <SummaryCard label="Low stock" value={loading ? '—' : lowStockCount.toLocaleString()} icon={<TriangleAlert size={18} />} tone="warning" />
            <SummaryCard label="Out of stock" value={loading ? '—' : outOfStockCount.toLocaleString()} icon={<AlertCircle size={18} />} tone="danger" />
            <SummaryCard label="Negative stock" value={loading ? '—' : negativeStockCount.toLocaleString()} icon={<AlertCircle size={18} />} tone="danger" />
            <SummaryCard label="On-hand buy value" value={loading ? '—' : formatRupeesFromCents(totalStockValueCents)} icon={<Boxes size={18} />} />
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
                <option value="negative">Negative stock</option>
              </Select>
            </div>
            <span className="whitespace-nowrap text-xs text-slate-500">
              {loading ? 'Loading inventory…' : `${inventoryRows.length.toLocaleString()} stock lots`}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Table headers={['Product / lot', 'Category', 'Available', 'Buy / selling price', 'On-hand buy value', 'Stock status', 'Location / supplier', 'Actions']} caption="Stock inventory by receipt lot">
              {loading ? (
                <tr><td colSpan={8}><FeedbackState tone="loading" title="Loading inventory" description="Fetching products and stock records." /></td></tr>
              ) : visibleInventory.length === 0 ? (
                <tr><td colSpan={8}><FeedbackState tone="empty" title={inventoryRows.length ? 'No inventory on this page' : 'No matching inventory'} description={products.length === 0 ? 'Create products before receiving stock.' : 'Try changing the search or filters, or receive stock for a product.'} action={products.length > 0 && !inventoryRows.length ? <Button onClick={beginAddStock}><PackagePlus size={15} /> Add Stock</Button> : undefined} /></td></tr>
              ) : visibleInventory.map(({ item, record }) => {
                const status = getInventoryStatus(item);
                const location = record
                  ? `${record.locationType}${record.rackLocation ? ` · ${record.rackLocation}` : ''}`
                  : '—';
                const supplier = record?.vendor?.name ?? record?.company?.name;
                return (
                  <tr key={record?.id ?? item.product.id} className="text-sm text-slate-600">
                    <td className="px-4 py-3.5 first:pl-5">
                      <p className="font-medium text-slate-800">{item.product.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {item.product.sku || item.product.barcode || 'No SKU / barcode'}
                        {record ? ` · ${new Date(record.purchaseDate ?? record.createdAt).toLocaleDateString()}` : ' · No stock lot'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">{item.product.category?.name || '—'}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium text-slate-800">
                      {record ? `${formatQuantityHundredths(parseHundredths(record.remainingQuantity))}${item.product.measuringUnit ? ` ${item.product.measuringUnit}` : ''}` : '—'}
                      <p className="mt-0.5 text-[10px] font-normal text-slate-400">Product total: {formatQuantityHundredths(item.quantityHundredths)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {record ? (
                        <>
                          <p>Buy price: <span className="font-medium tabular-nums text-slate-800">{formatRupees(record.purchasePrice)}</span></p>
                          <p className="mt-1">Sell: <span className="font-medium tabular-nums text-slate-800">{formatRupees(record.salePrice)}</span></p>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-medium text-slate-800">
                      {record ? formatRupeesFromCents(lotValueCents(record)) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      {item.hasMinimum && <p className="mt-1 text-[10px] text-slate-400">Product threshold {formatQuantityHundredths(item.minimumQuantityHundredths)}{item.product.measuringUnit ? ` ${item.product.measuringUnit}` : ''}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      {record ? <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><MapPin size={13} />{location}{supplier ? ` · ${supplier}` : ''}</span> : '—'}
                    </td>
                    <td className="px-4 py-3.5 last:pr-5 text-right">
                      <div className="flex justify-end gap-2">
                        {record && <Button size="sm" variant="secondary" onClick={() => { setPriceEditStock(record); setPriceEditValue(record.salePrice); setPriceEditError(''); }}>Edit sale price</Button>}
                        <Button size="sm" variant="secondary" onClick={() => { setValues({ ...emptyForm, productId: item.product.id }); setFieldErrors({}); setSubmitError(''); setFormOpen(true); }}>Add stock</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
            {!loading && inventoryRows.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-3">
                <Pagination page={page} totalPages={pageCount} totalItems={inventoryRows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <p>
              Low stock is determined from the product’s total remaining quantity
              compared with the largest configured product threshold across its
              lots. On-hand buy value is the sum of each lot’s remaining
              quantity multiplied by its recorded buy price. Editing a
              lot’s sale price does not change its buy price. The backend
              has no stock movement/history, adjustment, reason, or notes API.
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
            <FormField label={`Received quantity${selectedProduct?.measuringUnit ? ` (${selectedProduct.measuringUnit})` : ''}`} error={fieldErrors.quantity}>
              <Input id="stock-quantity" type="number" min="0.01" step={selectedProduct && isWholeQuantityUnit(selectedProduct.measuringUnit) ? '1' : '0.01'} required value={values.quantity} onChange={(event) => setField('quantity', event.target.value)} />
            </FormField>
            <FormField label={`Low-stock threshold (optional)${selectedProduct?.measuringUnit ? ` (${selectedProduct.measuringUnit})` : ''}`} error={fieldErrors.minimumQuantity}>
              <Input id="stock-minimum" type="number" min="0" step={selectedProduct && isWholeQuantityUnit(selectedProduct.measuringUnit) ? '1' : '0.01'} value={values.minimumQuantity} onChange={(event) => setField('minimumQuantity', event.target.value)} />
            </FormField>
            <FormField label="Buy price per unit" error={fieldErrors.purchasePrice}>
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

      <Modal
        open={priceEditStock !== null}
        onClose={() => { if (!priceSaving) setPriceEditStock(null); }}
        title="Update lot selling price"
        description="The original buy price for each stock lot is preserved."
      >
        <form onSubmit={saveSalePrice} className="space-y-4">
          {priceEditError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {priceEditError}
            </p>
          )}
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p className="font-medium">
              {products.find((product) => product.id === priceEditStock?.productId)?.name ?? 'Selected product'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Buy price: {formatRupees(priceEditStock?.purchasePrice)} per unit
            </p>
          </div>
          <FormField label="Selling price per unit">
            <Input
              id="stock-updated-sale-price"
              type="number"
              min="0"
              step="0.01"
              required
              value={priceEditValue}
              onChange={(event) => { setPriceEditValue(event.target.value); setPriceEditError(''); }}
            />
          </FormField>
          <p className="text-xs leading-5 text-slate-500">
            New orders using this stock lot will use its updated selling price.
            Previously recorded orders keep their original price.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" disabled={priceSaving} onClick={() => setPriceEditStock(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={priceSaving}>Review price change</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm stock receipt"
        description={`${selectedProduct?.name ?? 'Selected product'} · ${values.quantity || '0'}${selectedProduct?.measuringUnit ? ` ${selectedProduct.measuringUnit}` : ' units'} · buy ${formatRupees(values.purchasePrice)} per unit · selling ${formatRupees(values.salePrice)} per unit. This creates a stock lot using the backend stock API.`}
        confirmLabel="Add stock"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submitStock()}
        isLoading={saving}
      />
      <ConfirmDialog
        open={priceConfirmOpen}
        title="Confirm selling price update"
        description={`Change this lot’s selling price from ${formatRupees(priceEditStock?.salePrice)} to ${formatRupees(priceEditValue)} per unit? Its buy price and stock quantity will not change.`}
        confirmLabel="Update selling price"
        onCancel={() => setPriceConfirmOpen(false)}
        onConfirm={() => void confirmSalePriceUpdate()}
        isLoading={priceSaving}
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
