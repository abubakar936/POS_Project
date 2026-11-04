import {
  AlertCircle,
  Boxes,
  Columns3,
  CopyCheck,
  Eye,
  FilePenLine,
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
import { createCompany } from '../../lib/api/companies.api';
import { listProducts } from '../../lib/api/products.api';
import {
  createStock,
  listStocksForProducts,
  updateStockSalePrice,
  updateStock,
  type CreateStockPayload,
  type InventoryStockRecord,
  type UpdateStockPayload,
} from '../../lib/api/stocks.api';
import type { Product } from '../../lib/api/products.types';
import { isWholeQuantityUnit } from '../../lib/api/measurement-units';
import { createVendor } from '../../lib/api/vendors.api';

const INVENTORY_PAGE_SIZE = 50;
const PRODUCT_OPTIONS_PAGE_SIZE = 50;

interface InventoryProduct {
  product: Product;
  records: InventoryStockRecord[];
  hasMinimum: boolean;
  quantityHundredths: bigint;
  minimumQuantityHundredths: bigint;
  stockValueCents: bigint;
  duplicatePriceDifferences: DuplicatePriceDifferences | null;
}

interface DuplicatePriceDifferences {
  buyPrice: boolean;
  salePrice: boolean;
  printedPrice: boolean;
}

type StockColumnKey =
  | 'product'
  | 'marketName'
  | 'category'
  | 'sku'
  | 'barcode'
  | 'location'
  | 'supplier'
  | 'quantity'
  | 'buyPrice'
  | 'salePrice'
  | 'printedPrice'
  | 'status'
  | 'purchaseDate'
  | 'stockValue'
  | 'actions';

const STOCK_COLUMNS: Array<{ key: StockColumnKey; label: string; required?: boolean }> = [
  { key: 'product', label: 'Product Name', required: true },
  { key: 'marketName', label: 'Product Market Name' },
  { key: 'category', label: 'Category' },
  { key: 'sku', label: 'SKU' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'location', label: 'Location' },
  { key: 'supplier', label: 'Vendor / Company' },
  { key: 'quantity', label: 'Available Quantity' },
  { key: 'buyPrice', label: 'Buy Price' },
  { key: 'salePrice', label: 'Sale Price' },
  { key: 'printedPrice', label: 'Printed Price' },
  { key: 'status', label: 'Stock Status' },
  { key: 'purchaseDate', label: 'Received Date' },
  { key: 'stockValue', label: 'On-hand Buy Value' },
  { key: 'actions', label: 'Actions', required: true },
];

const STOCK_COLUMNS_STORAGE_KEY = 'pos.stock-list-columns.v1';
const DEFAULT_VISIBLE_COLUMNS: StockColumnKey[] = [
  'product',
  'marketName',
  'category',
  'quantity',
  'buyPrice',
  'salePrice',
  'printedPrice',
  'status',
  'actions',
];

function loadVisibleColumns(): StockColumnKey[] {
  try {
    const saved = window.localStorage.getItem(STOCK_COLUMNS_STORAGE_KEY);
    if (!saved) return DEFAULT_VISIBLE_COLUMNS;
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMNS;
    const valid = parsed.filter(
      (key): key is StockColumnKey =>
        typeof key === 'string' &&
        STOCK_COLUMNS.some((column) => column.key === key),
    );
    for (const required of STOCK_COLUMNS.filter((column) => column.required)) {
      if (!valid.includes(required.key)) valid.push(required.key);
    }
    return valid;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof DOMException) {
      return DEFAULT_VISIBLE_COLUMNS;
    }
    throw error;
  }
}

function normalizedText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function matchesProductSearch(product: Product, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return !normalizedQuery ||
    product.name.toLocaleLowerCase().includes(normalizedQuery) ||
    (product.marketName ?? product.nickname ?? '').toLocaleLowerCase().includes(normalizedQuery) ||
    (product.category?.name ?? '').toLocaleLowerCase().includes(normalizedQuery) ||
    (product.sku ?? '').toLocaleLowerCase().includes(normalizedQuery) ||
    (product.barcode ?? '').toLocaleLowerCase().includes(normalizedQuery);
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

interface StockEditValues {
  minimumQuantity: string;
  locationType: string;
  rackLocation: string;
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

function getInventoryStatus(item: InventoryProduct, record?: InventoryStockRecord | null) {
  if (
    record
      ? parseHundredths(record.remainingQuantity) < 0n
      : item.quantityHundredths < 0n
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
  if (!/^[1-9]\d{0,9}$/.test(values.quantity)) {
    errors.quantity = 'Quantity must be a positive whole number.';
  }
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
  return errors;
}

function stockFormToPayload(values: StockFormValues): CreateStockPayload {
  return {
    productId: values.productId,
    quantity: values.quantity,
    ...(values.minimumQuantity ? { minimumQuantity: values.minimumQuantity } : {}),
    ...(values.locationType.trim() ? { locationType: values.locationType.trim() } : {}),
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
  const [productOptions, setProductOptions] = useState<Product[]>([]);
  const [productOptionsPage, setProductOptionsPage] = useState(1);
  const [productOptionsSearch, setProductOptionsSearch] = useState('');
  const [productOptionsQuery, setProductOptionsQuery] = useState('');
  const [productOptionsReload, setProductOptionsReload] = useState(0);
  const [productOptionsMeta, setProductOptionsMeta] = useState({ page: 1, limit: PRODUCT_OPTIONS_PAGE_SIZE, total: 0, totalPages: 1 });
  const [stocks, setStocks] = useState<InventoryStockRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'negative' | 'in' | 'duplicate'>('all');
  const [page, setPage] = useState(1);
  const [productMeta, setProductMeta] = useState({ page: 1, limit: INVENTORY_PAGE_SIZE, total: 0, totalPages: 1 });
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [productOptionsLoading, setProductOptionsLoading] = useState(false);
  const [productOptionsError, setProductOptionsError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState<StockFormValues>(emptyForm);
  const [vendorName, setVendorName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [supplierError, setSupplierError] = useState('');
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priceEditStock, setPriceEditStock] = useState<InventoryStockRecord | null>(null);
  const [priceEditValue, setPriceEditValue] = useState('');
  const [priceEditError, setPriceEditError] = useState('');
  const [priceConfirmOpen, setPriceConfirmOpen] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [viewStock, setViewStock] = useState<InventoryStockRecord | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [editStock, setEditStock] = useState<InventoryStockRecord | null>(null);
  const [editValues, setEditValues] = useState<StockEditValues | null>(null);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    window.localStorage.setItem(STOCK_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    if (!formOpen) return;
    const controller = new AbortController();
    setProductOptionsLoading(true);
    setProductOptionsError('');
    listProducts({
      page: productOptionsPage,
      limit: PRODUCT_OPTIONS_PAGE_SIZE,
      search: productOptionsQuery || undefined,
    }, controller.signal)
      .then((result) => {
        setProductOptions(result.data);
        setProductOptionsMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setProductOptionsError(error instanceof Error ? error.message : 'Could not load products.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setProductOptionsLoading(false);
      });
    return () => controller.abort();
  }, [formOpen, productOptionsPage, productOptionsQuery, productOptionsReload]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProductOptionsQuery(productOptionsSearch.trim());
      setProductOptionsPage(1);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [productOptionsSearch]);

  const serverSearch = statusFilter === 'duplicate' ? '' : search;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getCategories(controller.signal),
      getVendors(controller.signal),
      getCompanies(controller.signal),
    ])
      .then(([categoryRows, vendorRows, companyRows]) => {
        if (!active) return;
        setCategories(categoryRows);
        setVendors(vendorRows);
        setCompanies(companyRows);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load inventory options.');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError('');
    setAuthError(false);
    Promise.all([
      listProducts({
        page,
        limit: INVENTORY_PAGE_SIZE,
        search: serverSearch || undefined,
        categoryId: categoryFilter || undefined,
      }, controller.signal),
    ])
      .then(async ([productResult]) => {
        const stockRows = await listStocksForProducts(
          productResult.data.map((product) => product.id),
          controller.signal,
        );
        if (!active) return;
        setStocks(stockRows);
        setProducts(productResult.data);
        setProductMeta(productResult.meta);
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
  }, [categoryFilter, page, reloadToken, serverSearch]);

  const inventory = useMemo(() => {
    const recordsByProduct = new Map<string, InventoryStockRecord[]>();
    for (const stock of stocks) {
      const group = recordsByProduct.get(stock.productId) ?? [];
      group.push(stock);
      recordsByProduct.set(stock.productId, group);
    }
    const inventoryItems = products.map((product) => {
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
        duplicatePriceDifferences: null,
      };
    });
    const duplicateGroups = new Map<string, InventoryProduct[]>();
    for (const item of inventoryItems) {
      const groupKey = `${normalizedText(item.product.name)}\u0000${normalizedText(item.product.category?.name)}`;
      const group = duplicateGroups.get(groupKey) ?? [];
      group.push(item);
      duplicateGroups.set(groupKey, group);
    }
    const differencesByProduct = new Map<string, DuplicatePriceDifferences>();
    for (const group of duplicateGroups.values()) {
      if (group.length < 2) continue;
      const getSignatures = (field: 'purchasePrice' | 'salePrice' | 'printedPrice') =>
        group.map((item) => {
          const values = item.records.length
            ? item.records.map((record) =>
                field === 'printedPrice'
                  ? record.printedPrice ?? item.product.retailPrice ?? null
                  : record[field],
              )
            : [item.product[field] ?? null];
          return [...new Set(values.map((value) =>
            value === null || value === undefined ? '<missing>' : parseHundredths(value).toString(),
          ))].sort().join('\u001f');
        });
      const differences: DuplicatePriceDifferences = {
        buyPrice: new Set(getSignatures('purchasePrice')).size > 1,
        salePrice: new Set(getSignatures('salePrice')).size > 1,
        printedPrice: new Set(getSignatures('printedPrice')).size > 1,
      };
      if (!differences.buyPrice && !differences.salePrice && !differences.printedPrice) continue;
      for (const item of group) differencesByProduct.set(item.product.id, differences);
    }
    return inventoryItems.map((item) => ({
      ...item,
      duplicatePriceDifferences: differencesByProduct.get(item.product.id) ?? null,
    }));
  }, [products, stocks]);

  const summaryInventory = inventory.filter(
    (item) => matchesProductSearch(item.product, searchInput),
  );
  const lowStockCount = summaryInventory.filter(
    (item) => getInventoryStatus(item).label === 'Low stock',
  ).length;
  const outOfStockCount = summaryInventory.filter(
    (item) => getInventoryStatus(item).label === 'Out of stock',
  ).length;
  const negativeStockCount = summaryInventory.reduce(
    (count, item) => count + item.records.filter(
      (record) => parseHundredths(record.remainingQuantity) < 0n,
    ).length,
    0,
  );
  const duplicateProductCount = new Set(
    summaryInventory
      .filter((item) => item.duplicatePriceDifferences)
      .map((item) => `${normalizedText(item.product.name)}\u0000${normalizedText(item.product.category?.name)}`),
  ).size;
  const totalStockValueCents = summaryInventory.reduce(
    (total, item) => total + item.stockValueCents,
    0n,
  );

  const filteredInventory = useMemo(() => {
    const query = searchInput.trim().toLocaleLowerCase();
    return inventory.filter((item) => {
    const matchesSearch = matchesProductSearch(item.product, query);
      const matchesCategory =
        !categoryFilter || item.product.categoryId === categoryFilter;
      const status = getInventoryStatus(item).label;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'low' && status === 'Low stock') ||
        (statusFilter === 'out' && status === 'Out of stock') ||
        (statusFilter === 'negative' && item.records.some((record) => parseHundredths(record.remainingQuantity) < 0n)) ||
        (statusFilter === 'duplicate' && Boolean(item.duplicatePriceDifferences)) ||
        (statusFilter === 'in' && status === 'In stock');
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, inventory, searchInput, statusFilter]);

  useEffect(() => setPage(1), [categoryFilter, searchInput, statusFilter]);

  const inventoryRows: InventoryRow[] = filteredInventory.flatMap<InventoryRow>(
    (item) =>
      item.records.length
        ? item.records
            .filter((record) =>
              statusFilter !== 'negative' ||
              parseHundredths(record.remainingQuantity) < 0n,
            )
            .map((record) => ({ item, record }))
        : [{ item, record: null }],
  );
  const visibleInventory = [...inventoryRows].sort((left, right) => {
    const quantityGroup = (row: InventoryRow) => {
      const quantity = row.item.quantityHundredths;
      return quantity > 0n ? 0 : quantity === 0n ? 1 : 2;
    };
    const groupDifference = quantityGroup(left) - quantityGroup(right);
    if (groupDifference) return groupDifference;
    const nameDifference = left.item.product.name.localeCompare(right.item.product.name, 'en', { sensitivity: 'base' });
    if (nameDifference) return nameDifference;
    return (left.record?.id ?? '').localeCompare(right.record?.id ?? '');
  });
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

  function beginAddStock(productId = '') {
    setValues({ ...emptyForm, productId });
    setVendorName('');
    setCompanyName('');
    setFieldErrors({});
    setSubmitError('');
    setSupplierError('');
    setFormOpen(true);
    setProductOptionsError('');
    setProductOptionsPage(1);
    setProductOptionsSearch('');
    setProductOptions([]);
    setProductOptionsMeta({ page: 1, limit: PRODUCT_OPTIONS_PAGE_SIZE, total: 0, totalPages: 1 });
  }

  function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateStockForm(values, productOptions.find((product) => product.id === values.productId)?.measuringUnit);
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
      const product = result.product ?? productOptions.find((item) => item.id === result.productId);
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
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Product not found')) {
        setSubmitError('That product is no longer available. Select a product and try again.');
      } else if (message.includes('Vendor not found or inactive')) {
        setSubmitError('The selected vendor is inactive or unavailable. Choose another vendor or leave it blank.');
      } else if (message.includes('Company not found or inactive')) {
        setSubmitError('The selected company is inactive or unavailable. Choose another company or leave it blank.');
      } else {
        setSubmitError(message
          ? `We couldn’t add this stock receipt. ${message}`
          : 'We couldn’t add this stock receipt. Check the details and try again.');
      }
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function resolveVendorName() {
    const name = vendorName.trim();
    if (!name || supplierSaving) return;
    setSupplierSaving(true);
    setSupplierError('');
    try {
      const latestVendors = await getVendors();
      const existing = latestVendors.find(
        (vendor) => vendor.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (existing) {
        if (!existing.isActive) {
          setSupplierError('A vendor with this name already exists but is inactive. Activate it before selecting it.');
          return;
        }
        setVendors(latestVendors);
        setVendorName(existing.name);
        setField('vendorId', existing.id);
        return;
      }
      const created = await createVendor({ name });
      setVendors((current) => [created, ...current.filter((vendor) => vendor.id !== created.id)]);
      setVendorName(created.name);
      setField('vendorId', created.id);
    } catch (error) {
      setSupplierError(error instanceof Error
        ? `We couldn’t find or add this vendor. ${error.message}`
        : 'We couldn’t find or add this vendor. Please try again.');
    } finally {
      setSupplierSaving(false);
    }
  }

  async function resolveCompanyName() {
    const name = companyName.trim();
    if (!name || supplierSaving) return;
    setSupplierSaving(true);
    setSupplierError('');
    try {
      const latestCompanies = await getCompanies();
      const existing = latestCompanies.find(
        (company) => company.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (existing) {
        if (!existing.isActive) {
          setSupplierError('A company with this name already exists but is inactive. Activate it before selecting it.');
          return;
        }
        setCompanies(latestCompanies);
        setCompanyName(existing.name);
        setField('companyId', existing.id);
        return;
      }
      const created = await createCompany({ name });
      setCompanies((current) => [created, ...current.filter((company) => company.id !== created.id)]);
      setCompanyName(created.name);
      setField('companyId', created.id);
    } catch (error) {
      setSupplierError(error instanceof Error
        ? `We couldn’t find or add this company. ${error.message}`
        : 'We couldn’t find or add this company. Please try again.');
    } finally {
      setSupplierSaving(false);
    }
  }

  function selectVendorName(name: string) {
    setVendorName(name);
    const existing = activeVendors.find(
      (vendor) => vendor.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    );
    setField('vendorId', existing?.id ?? '');
    setSupplierError('');
  }

  function selectCompanyName(name: string) {
    setCompanyName(name);
    const existing = activeCompanies.find(
      (company) => company.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    );
    setField('companyId', existing?.id ?? '');
    setSupplierError('');
  }

  function beginEditStock(record: InventoryStockRecord) {
    setEditStock(record);
    setEditValues({
      minimumQuantity: record.minimumQuantity ?? '',
      locationType: record.locationType ?? '',
      rackLocation: record.rackLocation ?? '',
      printedPrice: record.printedPrice ?? '',
      totalPurchaseValue: record.totalPurchaseValue ?? '',
      purchaseDate: record.purchaseDate?.slice(0, 10) ?? '',
      vendorId: record.vendorId ?? '',
      companyId: record.companyId ?? '',
    });
    setEditError('');
  }

  function updateEditField<K extends keyof StockEditValues>(
    field: K,
    value: StockEditValues[K],
  ) {
    setEditValues((current) => current ? { ...current, [field]: value } : current);
    setEditError('');
  }

  async function saveStockEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editStock || !editValues) return;
    if (editValues.minimumQuantity && !isNonNegativeDecimal(editValues.minimumQuantity)) {
      setEditError('Enter a valid non-negative low-stock threshold.');
      return;
    }
    if (
      editValues.minimumQuantity &&
      isWholeQuantityUnit(editStock.product?.measuringUnit) &&
      !/^\d+(?:\.0+)?$/.test(editValues.minimumQuantity)
    ) {
      setEditError('The low-stock threshold must be a whole number for this measuring unit.');
      return;
    }
    if (editValues.printedPrice && !isNonNegativeDecimal(editValues.printedPrice)) {
      setEditError('Enter a valid printed price.');
      return;
    }
    if (editValues.totalPurchaseValue && !isNonNegativeDecimal(editValues.totalPurchaseValue, 12)) {
      setEditError('Enter a valid total purchase value.');
      return;
    }

    setEditSaving(true);
    setEditError('');
    const payload: UpdateStockPayload = {
      minimumQuantity: editValues.minimumQuantity || null,
      locationType: editValues.locationType.trim() || 'Unspecified',
      rackLocation: editValues.rackLocation.trim() || null,
      printedPrice: editValues.printedPrice || null,
      totalPurchaseValue: editValues.totalPurchaseValue || null,
      purchaseDate: editValues.purchaseDate || null,
      vendorId: editValues.vendorId || null,
      companyId: editValues.companyId || null,
    };
    try {
      await updateStock(editStock.id, payload);
      setEditStock(null);
      setEditValues(null);
      setReloadToken((current) => current + 1);
      showToast({
        tone: 'success',
        title: 'Stock entry updated',
        description: editStock.product?.name ?? 'Stock details saved.',
      });
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Could not update this stock entry.');
    } finally {
      setEditSaving(false);
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

  const selectedProduct =
    productOptions.find((product) => product.id === values.productId) ??
    products.find((product) => product.id === values.productId);
  const shownColumns = STOCK_COLUMNS.filter((column) => visibleColumns.includes(column.key));

  function toggleStatusFilter(next: 'low' | 'negative' | 'duplicate') {
    setStatusFilter((current) => current === next ? 'all' : next);
    setPage(1);
  }

  function toggleColumn(key: StockColumnKey) {
    const column = STOCK_COLUMNS.find((item) => item.key === key);
    if (column?.required) return;
    setVisibleColumns((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : STOCK_COLUMNS.filter((item) => item.key === key || current.includes(item.key)).map((item) => item.key));
  }

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
        <Button onClick={() => beginAddStock()} disabled={loading}>
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="Products" value={loading ? '—' : summaryInventory.length.toLocaleString()} icon={<Boxes size={18} />} />
            <SummaryCard label="Low stock" value={loading ? '—' : lowStockCount.toLocaleString()} icon={<TriangleAlert size={18} />} tone="warning" active={statusFilter === 'low'} onClick={() => toggleStatusFilter('low')} />
            <SummaryCard label="Out of stock" value={loading ? '—' : outOfStockCount.toLocaleString()} icon={<AlertCircle size={18} />} tone="danger" />
            <SummaryCard label="Negative stock" value={loading ? '—' : negativeStockCount.toLocaleString()} icon={<AlertCircle size={18} />} tone="danger" active={statusFilter === 'negative'} onClick={() => toggleStatusFilter('negative')} />
            <SummaryCard label="Duplicate products" value={loading ? '—' : duplicateProductCount.toLocaleString()} icon={<CopyCheck size={18} />} tone="warning" active={statusFilter === 'duplicate'} onClick={() => toggleStatusFilter('duplicate')} />
            <SummaryCard label="On-hand buy value" value={loading ? '—' : formatRupeesFromCents(totalStockValueCents)} icon={<Boxes size={18} />} />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Search inventory by product, market name, category, SKU, or barcode"
                placeholder="Search name, market name, category, SKU, or barcode…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select aria-label="Filter by category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} className="min-w-40">
                <option value="">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
              <Select aria-label="Filter by stock status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="min-w-40">
                <option value="all">All Stock</option>
                <option value="in">In stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
                <option value="negative">Negative stock</option>
                <option value="duplicate">Duplicate products</option>
              </Select>
            </div>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-teal-700 via-cyan-700 to-sky-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:from-teal-800 hover:via-cyan-800 hover:to-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                <Columns3 size={15} /> Columns
              </summary>
              <fieldset className="absolute right-0 z-20 mt-2 max-h-80 w-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <legend className="px-1 text-xs font-semibold text-slate-600">Visible stock columns</legend>
                {STOCK_COLUMNS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column.key)}
                      disabled={column.required}
                      onChange={() => toggleColumn(column.key)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    {column.label}
                  </label>
                ))}
              </fieldset>
            </details>
            <span className="whitespace-nowrap text-xs text-slate-500">
              {loading ? 'Loading inventory…' : `${products.length.toLocaleString()} products on this page`}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Table
              headers={shownColumns.map((column) => column.label)}
              caption="Stock inventory by receipt lot"
              containerClassName="max-h-[62vh] overflow-y-auto"
              headerClassName="bg-gradient-to-r from-teal-700 via-cyan-700 to-sky-700"
              headerCellClassName="sticky top-0 bg-teal-700 text-white shadow-sm"
              stickyLastColumn
            >
              {loading ? (
                <tr><td colSpan={shownColumns.length}><FeedbackState tone="loading" title="Loading inventory" description="Fetching products and stock records." /></td></tr>
              ) : visibleInventory.length === 0 ? (
                <tr><td colSpan={shownColumns.length}><FeedbackState tone="empty" title={inventoryRows.length ? 'No inventory on this page' : 'No matching inventory'} description={products.length === 0 ? 'Create products before receiving stock.' : 'Try changing the search or filters, or receive stock for a product.'} /></td></tr>
              ) : visibleInventory.map(({ item, record }) => {
                const status = getInventoryStatus(item, record);
                const location = record
                  ? `${record.locationType}${record.rackLocation ? ` · ${record.rackLocation}` : ''}`
                  : '—';
                return (
                  <tr key={record?.id ?? item.product.id} className="text-sm text-slate-600">
                    {visibleColumns.includes('product') && <td className="px-4 py-3.5 first:pl-5 font-medium text-slate-800">{item.product.name}</td>}
                    {visibleColumns.includes('marketName') && <td className="px-4 py-3.5">{item.product.marketName ?? item.product.nickname ?? '—'}</td>}
                    {visibleColumns.includes('category') && <td className="px-4 py-3.5">{item.product.category?.name || '—'}</td>}
                    {visibleColumns.includes('sku') && <td className="px-4 py-3.5 font-mono text-xs">{item.product.sku || '—'}</td>}
                    {visibleColumns.includes('barcode') && <td className="px-4 py-3.5 font-mono text-xs">{item.product.barcode || '—'}</td>}
                    {visibleColumns.includes('location') && <td className="px-4 py-3.5">{record ? <span className="inline-flex items-center gap-1.5 text-xs"><MapPin size={13} />{location}</span> : '—'}</td>}
                    {visibleColumns.includes('supplier') && <td className="px-4 py-3.5">{record?.vendor?.name ?? record?.company?.name ?? '—'}</td>}
                    {visibleColumns.includes('quantity') && <td className="px-4 py-3.5 tabular-nums font-medium text-slate-800">{record ? `${formatQuantityHundredths(parseHundredths(record.remainingQuantity))}${item.product.measuringUnit ? ` ${item.product.measuringUnit}` : ''}` : `0${item.product.measuringUnit ? ` ${item.product.measuringUnit}` : ''}`}</td>}
                    {visibleColumns.includes('buyPrice') && <td className="px-4 py-3.5 tabular-nums">{record ? formatRupees(record.purchasePrice) : formatRupees(item.product.purchasePrice)}</td>}
                    {visibleColumns.includes('salePrice') && <td className="px-4 py-3.5 tabular-nums">{record ? formatRupees(record.salePrice) : formatRupees(item.product.salePrice)}</td>}
                    {visibleColumns.includes('printedPrice') && <td className="px-4 py-3.5 tabular-nums">{formatRupees(record?.printedPrice ?? item.product.retailPrice)}</td>}
                    {visibleColumns.includes('status') && <td className="px-4 py-3.5"><StatusBadge tone={status.tone}>{status.label}</StatusBadge>{item.duplicatePriceDifferences && <p className="mt-1 text-[10px] text-amber-700">Prices differ: {[item.duplicatePriceDifferences.buyPrice && 'buy', item.duplicatePriceDifferences.salePrice && 'sale', item.duplicatePriceDifferences.printedPrice && 'printed/retail'].filter(Boolean).join(', ')}</p>}</td>}
                    {visibleColumns.includes('purchaseDate') && <td className="px-4 py-3.5">{record ? new Date(record.purchaseDate ?? record.createdAt).toLocaleDateString() : '—'}</td>}
                    {visibleColumns.includes('stockValue') && <td className="px-4 py-3.5 tabular-nums">{record ? formatRupeesFromCents(lotValueCents(record)) : '—'}</td>}
                    {visibleColumns.includes('actions') && <td className="px-3 py-3.5 last:pr-5 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" aria-label={`View ${record ? 'stock' : 'product'} for ${item.product.name}`} onClick={() => record ? setViewStock({ ...record, product: item.product }) : setViewProduct(item.product)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"><Eye size={14} />View</button>
                        {record ? <>
                          <button type="button" aria-label={`Edit stock for ${item.product.name}`} onClick={() => beginEditStock({ ...record, product: item.product })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-teal-700"><FilePenLine size={14} />Edit</button>
                          <button type="button" aria-label={`Edit sale price for ${item.product.name}`} title="Edit sale price" onClick={() => { setPriceEditStock(record); setPriceEditValue(record.salePrice); setPriceEditError(''); }} className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">Sale</button>
                        </> : <>
                          <Link aria-label={`Edit product ${item.product.name}`} to={`/products/${encodeURIComponent(item.product.id)}/edit`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-teal-700"><FilePenLine size={14} />Edit</Link>
                          <button type="button" aria-label={`Add stock for ${item.product.name}`} onClick={() => beginAddStock(item.product.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"><PackagePlus size={14} />Add</button>
                        </>}
                      </div>
                    </td>}
                  </tr>
                );
              })}
            </Table>
            {!loading && productMeta.total > 0 && (
              <div className="border-t border-slate-100 px-4 py-3">
                <Pagination page={page} totalPages={productMeta.totalPages} totalItems={productMeta.total} pageSize={INVENTORY_PAGE_SIZE} onPageChange={setPage} />
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <p>
              Summary counts follow the current search and category filters.
              Low stock is determined from the product’s total remaining quantity
              compared with the largest configured product threshold across its
              lots. Negative stock counts only stock lots whose remaining quantity
              is below zero. Duplicate products are matched by normalized name
              and category and compared across distinct product records. On-hand
              buy value is the sum of each lot’s remaining quantity multiplied by
              its recorded buy price. Editing a lot’s sale price does not change
              its buy price. The backend has no stock movement/history,
              adjustment, reason, or notes API.
            </p>
          </div>
        </>
      )}

      <Modal open={formOpen} onClose={() => { if (!saving) setFormOpen(false); }} title="Add stock" description="Create a new stock receipt for a product. Existing stock lots and sales quantities are not edited.">
        <form onSubmit={requestConfirmation} className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          <FormField label="Find product">
            <Input
              type="search"
              placeholder="Search product name, SKU, or barcode…"
              value={productOptionsSearch}
              onChange={(event) => setProductOptionsSearch(event.target.value)}
            />
          </FormField>
          <FormField label="Product" error={fieldErrors.productId}>
            <Select id="stock-product" required disabled={productOptionsLoading || Boolean(productOptionsError)} value={values.productId} onChange={(event) => setField('productId', event.target.value)}>
              <option value="">Select a product</option>
              {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}{product.isActive ? '' : ' · Inactive'}</option>)}
            </Select>
          </FormField>
          {productOptionsLoading && <p className="text-xs text-slate-500">Loading products…</p>}
          {productOptionsError && <div role="alert" className="flex items-center justify-between gap-3 text-xs text-rose-700"><span>{productOptionsError}</span><Button type="button" size="sm" variant="secondary" onClick={() => setProductOptionsReload((current) => current + 1)}>Retry</Button></div>}
          {!productOptionsLoading && !productOptionsError && productOptionsMeta.total > 0 && (
            <Pagination
              page={productOptionsPage}
              totalPages={productOptionsMeta.totalPages}
              totalItems={productOptionsMeta.total}
              pageSize={PRODUCT_OPTIONS_PAGE_SIZE}
              onPageChange={setProductOptionsPage}
            />
          )}
          {selectedProduct && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {selectedProduct.category?.name ?? 'No category'}{selectedProduct.measuringUnit ? ` · Unit: ${selectedProduct.measuringUnit}` : ''}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={`Received quantity${selectedProduct?.measuringUnit ? ` (${selectedProduct.measuringUnit})` : ''}`} error={fieldErrors.quantity}>
              <Input id="stock-quantity" type="number" min="1" step="1" required value={values.quantity} onChange={(event) => setField('quantity', event.target.value)} />
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
            <FormField label="Location type (optional)" error={fieldErrors.locationType}>
              <Input id="stock-location-type" placeholder="For example: Warehouse" value={values.locationType} onChange={(event) => setField('locationType', event.target.value)} />
            </FormField>
            <FormField label="Rack / shelf (optional)">
              <Input id="stock-rack" value={values.rackLocation} onChange={(event) => setField('rackLocation', event.target.value)} />
            </FormField>
            <FormField label="Purchase date (optional)">
              <Input id="stock-purchase-date" type="date" value={values.purchaseDate} onChange={(event) => setField('purchaseDate', event.target.value)} />
            </FormField>
            <FormField label="Vendor (optional)">
              <Input
                id="stock-vendor"
                list="stock-vendor-options"
                placeholder="Choose or type a vendor"
                value={vendorName}
                disabled={supplierSaving}
                onChange={(event) => selectVendorName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void resolveVendorName();
                  }
                }}
              />
              <datalist id="stock-vendor-options">
                {activeVendors.map((vendor) => <option key={vendor.id} value={vendor.name} />)}
              </datalist>
            </FormField>
            <FormField label="Company (optional)">
              <Input
                id="stock-company"
                list="stock-company-options"
                placeholder="Choose or type a company"
                value={companyName}
                disabled={supplierSaving}
                onChange={(event) => selectCompanyName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void resolveCompanyName();
                  }
                }}
              />
              <datalist id="stock-company-options">
                {activeCompanies.map((company) => <option key={company.id} value={company.name} />)}
              </datalist>
            </FormField>
          </div>
          {supplierError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{supplierError}</p>}
          <p className="text-xs text-slate-500">Choose an existing name or type a new one and press Enter. You can leave both blank.</p>
          {submitError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{submitError}</p>}
          <p className="text-xs leading-5 text-slate-500">
            Product, received quantity, buy price, and selling price are
            required. Other receipt details are optional. The starting
            remaining quantity is set to the received quantity.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}><PackagePlus size={15} />Review receipt</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={viewStock !== null}
        onClose={() => setViewStock(null)}
        title="Stock entry details"
        description={viewStock?.product?.name ?? 'Selected stock entry'}
      >
        {viewStock && (
          <div className="space-y-4">
            <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Detail label="Product Name" value={viewStock.product?.name} />
              <Detail label="Product Market Name" value={viewStock.product?.marketName ?? viewStock.product?.nickname} />
              <Detail label="Category" value={viewStock.product?.category?.name} />
              <Detail label="SKU" value={viewStock.product?.sku} />
              <Detail label="Barcode" value={viewStock.product?.barcode} />
              <Detail label="Received Quantity" value={`${viewStock.quantity}${viewStock.product?.measuringUnit ? ` ${viewStock.product.measuringUnit}` : ''}`} />
              <Detail label="Available Quantity" value={`${viewStock.remainingQuantity}${viewStock.product?.measuringUnit ? ` ${viewStock.product.measuringUnit}` : ''}`} />
              <Detail label="Low-stock Threshold" value={viewStock.minimumQuantity} />
              <Detail label="Buy Price" value={formatRupees(viewStock.purchasePrice)} />
              <Detail label="Sale Price" value={formatRupees(viewStock.salePrice)} />
              <Detail label="Printed / Retail Price" value={formatRupees(viewStock.printedPrice ?? viewStock.product?.retailPrice)} />
              <Detail label="Location" value={`${viewStock.locationType}${viewStock.rackLocation ? ` · ${viewStock.rackLocation}` : ''}`} />
              <Detail label="Vendor" value={viewStock.vendor?.name} />
              <Detail label="Company" value={viewStock.company?.name} />
              <Detail label="Purchase Date" value={viewStock.purchaseDate ? new Date(viewStock.purchaseDate).toLocaleDateString() : '—'} />
              <Detail label="Total Purchase Value" value={formatRupees(viewStock.totalPurchaseValue)} />
            </dl>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setViewStock(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={viewProduct !== null}
        onClose={() => setViewProduct(null)}
        title="Product details"
        description={viewProduct?.name}
      >
        {viewProduct && (
          <div className="space-y-5">
            <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Detail label="Product Market Name" value={viewProduct.marketName ?? viewProduct.nickname} />
              <Detail label="Category" value={viewProduct.category?.name} />
              <Detail label="SKU" value={viewProduct.sku} />
              <Detail label="Barcode" value={viewProduct.barcode} />
              <Detail label="Measuring unit" value={viewProduct.measuringUnit} />
              <Detail label="Status" value={viewProduct.isActive ? 'Active' : 'Inactive'} />
            </dl>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setViewProduct(null)}>Close</Button>
              <Button onClick={() => { const productId = viewProduct.id; setViewProduct(null); beginAddStock(productId); }}><PackagePlus size={14} />Add stock</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={editStock !== null}
        onClose={() => { if (!editSaving) { setEditStock(null); setEditValues(null); } }}
        title="Edit stock entry"
        description={editStock?.product?.name ?? 'Update receipt details'}
      >
        {editValues && editStock && (
          <form onSubmit={(event) => void saveStockEdit(event)} className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
            {editError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{editError}</p>}
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
              Edit receipt details here. Quantity and buy price remain unchanged; use the Sale action to update this lot’s selling price.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={`Low-stock threshold${editStock.product?.measuringUnit ? ` (${editStock.product.measuringUnit})` : ''}`}>
                <Input type="number" min="0" step="0.01" value={editValues.minimumQuantity} onChange={(event) => updateEditField('minimumQuantity', event.target.value)} />
              </FormField>
              <FormField label="Location type">
                <Input value={editValues.locationType} onChange={(event) => updateEditField('locationType', event.target.value)} />
              </FormField>
              <FormField label="Rack / shelf">
                <Input value={editValues.rackLocation} onChange={(event) => updateEditField('rackLocation', event.target.value)} />
              </FormField>
              <FormField label="Printed price">
                <Input type="number" min="0" step="0.01" value={editValues.printedPrice} onChange={(event) => updateEditField('printedPrice', event.target.value)} />
              </FormField>
              <FormField label="Total purchase value">
                <Input type="number" min="0" step="0.01" value={editValues.totalPurchaseValue} onChange={(event) => updateEditField('totalPurchaseValue', event.target.value)} />
              </FormField>
              <FormField label="Purchase date">
                <Input type="date" value={editValues.purchaseDate} onChange={(event) => updateEditField('purchaseDate', event.target.value)} />
              </FormField>
              <FormField label="Vendor">
                <Select value={editValues.vendorId} onChange={(event) => updateEditField('vendorId', event.target.value)}>
                  <option value="">No vendor</option>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.isActive ? '' : ' (Inactive)'}</option>)}
                </Select>
              </FormField>
              <FormField label="Company">
                <Select value={editValues.companyId} onChange={(event) => updateEditField('companyId', event.target.value)}>
                  <option value="">No company</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}{company.isActive ? '' : ' (Inactive)'}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" disabled={editSaving} onClick={() => { setEditStock(null); setEditValues(null); }}>Cancel</Button>
              <Button type="submit" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save stock entry'}</Button>
            </div>
          </form>
        )}
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
  active = false,
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'neutral' | 'warning' | 'danger';
  active?: boolean;
  onClick?: () => void;
}) {
  const styles = tone === 'warning'
    ? 'bg-amber-50 text-amber-700'
    : tone === 'danger'
      ? 'bg-rose-50 text-rose-700'
      : 'bg-teal-50 text-teal-700';
  const content = (
    <>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      </div>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles}`}>{icon}</span>
    </>
  );
  const className = `flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left ${
    active ? 'border-teal-500 ring-2 ring-teal-100' : 'border-slate-200'
  } ${onClick ? 'cursor-pointer hover:border-teal-300 hover:bg-slate-50' : ''}`;

  return onClick ? (
    <button type="button" aria-pressed={active} onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value || '—'}</dd>
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
