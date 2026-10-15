import {
  AlertCircle,
  Barcode,
  Boxes,
  Eye,
  FilePenLine,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { login } from '../../lib/api/auth.api';
import {
  getProductStockRecords,
  getProductStockTotals,
} from '../../lib/api/catalog.api';
import type { StockRecord } from '../../lib/api/catalog.types';
import { formatRupees } from '../../lib/api/money';
import {
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../../lib/api/products.api';
import type { Product } from '../../lib/api/products.types';

const PAGE_SIZE = 20;
type StatusFilter = 'all' | 'true' | 'false';

export function ProductsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [stockTotals, setStockTotals] = useState<Map<string, string>>(new Map());
  const [stockError, setStockError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailStock, setDetailStock] = useState<StockRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailStockError, setDetailStockError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const handledSaveState = useRef<unknown>(null);

  useEffect(() => {
    const state: unknown = location.state;
    if (
      typeof state === 'object' &&
      state !== null &&
      state !== handledSaveState.current &&
      'savedProductName' in state &&
      typeof state.savedProductName === 'string'
    ) {
      handledSaveState.current = state;
      showToast({
        tone: 'success',
        title: 'Product saved',
        description: `${state.savedProductName} is now in your catalog.`,
      });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, showToast]);

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
    setStockError('');
    setAuthError(false);
    setStockTotals(new Map());

    listProducts(
      {
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        isActive: status === 'all' ? undefined : status,
      },
      controller.signal,
    )
      .then((result) => {
        if (!active) return;
        setProducts(result.data);
        setMeta(result.meta);
        void getProductStockTotals(
          result.data.map((product) => product.id),
          controller.signal,
        )
          .then((totals) => {
            if (active) setStockTotals(totals);
          })
          .catch((error: unknown) => {
            if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
            setStockError(error instanceof Error ? error.message : 'Stock totals could not be loaded.');
          });
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load products.');
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

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);
  const countLabel = useMemo(
    () => (loading ? 'Loading products…' : `${meta.total.toLocaleString()} products`),
    [loading, meta.total],
  );

  async function openDetails(product: Product) {
    setSelectedProduct(product);
    setDetailStock([]);
    setDetailError('');
    setDetailStockError('');
    setDetailLoading(true);
    try {
      const freshProduct = await getProduct(product.id);
      setSelectedProduct(freshProduct);
      try {
        setDetailStock(await getProductStockRecords(product.id));
      } catch (error) {
        setDetailStockError(error instanceof Error ? error.message : 'Could not load stock records.');
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Could not load product details.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleActive(product: Product) {
    setActionLoading(true);
    setActionError('');
    try {
      await updateProduct(product.id, { isActive: !product.isActive });
      refresh();
      showToast({
        tone: 'success',
        title: product.isActive ? 'Product deactivated' : 'Product activated',
        description: product.name,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update product status.');
    } finally {
      setActionLoading(false);
    }
  }

  async function removeProduct() {
    if (!pendingDelete) return;
    setActionLoading(true);
    setActionError('');
    try {
      await deleteProduct(pendingDelete.id);
      showToast({
        tone: 'success',
        title: 'Product deleted',
        description: pendingDelete.name,
      });
      setPendingDelete(null);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete product.');
    } finally {
      setActionLoading(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setSignInError('');
    try {
      await login(email.trim(), password);
      setPassword('');
      setSignInOpen(false);
      refresh();
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : 'Sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  }

  const tableBody = loading ? (
    <tr>
      <td colSpan={8}>
        <FeedbackState tone="loading" title="Loading products" description="Fetching your catalog and stock balances." />
      </td>
    </tr>
  ) : loadError ? (
    <tr>
      <td colSpan={8}>
        <FeedbackState
          tone="error"
          title={authError ? 'Sign-in required' : 'Products could not be loaded'}
          description={authError ? 'This endpoint requires a valid account. Sign in to load and manage your product catalog.' : loadError}
          action={authError
            ? <Button variant="secondary" onClick={() => { setSignInError(''); setSignInOpen(true); }}>Sign in</Button>
            : <Button variant="secondary" onClick={refresh}>Retry</Button>}
        />
      </td>
    </tr>
  ) : products.length === 0 ? (
    <tr>
      <td colSpan={8}>
        <FeedbackState
          tone="empty"
          title={search || status !== 'all' ? 'No matching products' : 'Your catalog is empty'}
          description={search || status !== 'all' ? 'Try adjusting the search or status filter.' : 'Add your first product to start building your catalog.'}
          action={!search && status === 'all' ? <Link to="/products/new"><Button><Plus size={16} /> Add product</Button></Link> : undefined}
        />
      </td>
    </tr>
  ) : (
    products.map((product) => (
      <tr key={product.id} className="text-sm text-slate-600">
        <td className="px-4 py-3.5 first:pl-5">
          <div className="flex min-w-44 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Barcode size={17} /></span>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{product.name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{product.measuringUnit || 'Unit not set'}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5">
          <p className="font-mono text-xs text-slate-700">{product.sku || '—'}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">{product.barcode || 'No barcode'}</p>
        </td>
        <td className="px-4 py-3.5">{product.category?.name || '—'}{product.subCategory?.name && <p className="mt-0.5 text-xs text-slate-400">{product.subCategory.name}</p>}</td>
        <td className="px-4 py-3.5 text-right tabular-nums">{formatRupees(product.salePrice)}</td>
        <td className="px-4 py-3.5 text-right tabular-nums">{formatRupees(product.purchasePrice)}</td>
        <td className="px-4 py-3.5 text-right tabular-nums">
          {stockTotals.has(product.id)
            ? `${stockTotals.get(product.id)}${product.measuringUnit ? ` ${product.measuringUnit}` : ''}`
            : '—'}
        </td>
        <td className="px-4 py-3.5"><StatusBadge tone={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'Active' : 'Inactive'}</StatusBadge></td>
        <td className="px-4 py-3.5 last:pr-5">
          <div className="flex items-center justify-end gap-1">
            <button type="button" aria-label={`View ${product.name}`} title="View details" onClick={() => void openDetails(product)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Eye size={16} /></button>
            <Link aria-label={`Edit ${product.name}`} title="Edit product" to={`/products/${encodeURIComponent(product.id)}/edit`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-teal-700"><FilePenLine size={16} /></Link>
            <button type="button" aria-label={product.isActive ? `Deactivate ${product.name}` : `Activate ${product.name}`} title={product.isActive ? 'Deactivate product' : 'Activate product'} onClick={() => void toggleActive(product)} className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-amber-50 hover:text-amber-800">{product.isActive ? 'Disable' : 'Enable'}</button>
            <button type="button" aria-label={`Delete ${product.name}`} title="Delete product" onClick={() => { setActionError(''); setPendingDelete(product); }} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16} /></button>
          </div>
        </td>
      </tr>
    ))
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Catalog</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your items, identifiers, prices and stock availability.</p>
        </div>
        <Link to="/products/new"><Button><Plus size={16} /> Add product</Button></Link>
      </div>

      {actionError && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="flex items-center gap-2"><AlertCircle size={17} />{actionError}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setActionError('')} className="text-rose-700">Dismiss</button>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search products by name" placeholder="Search product names…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Status</span>
          <Select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }} className="min-w-36">
            <option value="all">All products</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </Select>
          <span className="whitespace-nowrap text-xs text-slate-500">{countLabel}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table
          headers={['Product', 'SKU / barcode', 'Category', 'Selling price', 'Buy price', 'Stock', 'Status', 'Actions']}
          caption="Product catalog"
        >
          {tableBody}
        </Table>
        {!loading && !loadError && meta.total > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={page} totalPages={meta.totalPages} totalItems={meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <Boxes size={15} className="mt-0.5 shrink-0" />
        <p>Search matches product names only, as supported by the API. Stock totals are loaded from stock records for the current page; each total can include multiple stock entries.{stockError ? ` Stock totals are unavailable: ${stockError}` : ''}</p>
      </div>

      <Modal
        open={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        title="Product details"
        description={selectedProduct?.name}
      >
        {detailLoading ? (
          <FeedbackState tone="loading" title="Loading details" />
        ) : detailError ? (
          <FeedbackState tone="error" title="Details could not be loaded" description={detailError} />
        ) : selectedProduct ? (
          <div className="space-y-5">
            <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Detail label="SKU" value={selectedProduct.sku} />
              <Detail label="Barcode" value={selectedProduct.barcode} />
              <Detail label="Category" value={selectedProduct.category?.name} />
              <Detail label="Subcategory" value={selectedProduct.subCategory?.name} />
              <Detail label="Measuring unit" value={selectedProduct.measuringUnit} />
              <Detail label="Pack size" value={selectedProduct.packSize} />
              <Detail label="Pieces per carton" value={selectedProduct.pcsPerCarton?.toString()} />
              <Detail label="Selling price" value={formatRupees(selectedProduct.salePrice)} />
              <Detail label="Retail price" value={formatRupees(selectedProduct.retailPrice)} />
              <Detail label="Buy price" value={formatRupees(selectedProduct.purchasePrice)} />
              <Detail label="Printed price" value={formatRupees(selectedProduct.printedPrice)} />
              <Detail label="Status" value={selectedProduct.isActive ? 'Active' : 'Inactive'} />
            </dl>
            {selectedProduct.description && <div><h3 className="text-xs font-medium text-slate-500">Description</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selectedProduct.description}</p></div>}
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Stock records</h3>
              {detailStockError ? (
                <p role="alert" className="mt-2 text-sm text-rose-700">Stock records could not be loaded: {detailStockError}</p>
              ) : detailStock.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No stock records are available for this product.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {detailStock.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-600">{record.locationType}{record.rackLocation ? ` · ${record.rackLocation}` : ''}</span>
                      <span className="font-medium tabular-nums text-slate-800">{record.remainingQuantity}{selectedProduct.measuringUnit ? ` ${selectedProduct.measuringUnit}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setSelectedProduct(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => { if (!actionLoading) setPendingDelete(null); }}
        onConfirm={() => void removeProduct()}
        title="Delete this product?"
        description={actionError || `“${pendingDelete?.name ?? ''}” will be soft-deleted and removed from product lists. This cannot be undone from this screen.`}
        confirmLabel="Delete product"
        isLoading={actionLoading}
      />

      <Modal
        open={signInOpen}
        onClose={() => { if (!signingIn) setSignInOpen(false); }}
        title="Sign in to continue"
        description="Product APIs require a valid POS account."
      >
        <form onSubmit={(event) => void signIn(event)} className="space-y-4">
          {signInError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{signInError}</p>}
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Email
            <Input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Password
            <Input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={signingIn} onClick={() => setSignInOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</Button>
          </div>
        </form>
      </Modal>
    </section>
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
