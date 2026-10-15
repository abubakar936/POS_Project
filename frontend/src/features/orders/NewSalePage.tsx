import {
  AlertCircle,
  Barcode,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { getActiveCategories } from '../../lib/api/catalog.api';
import type { CategoryOption } from '../../lib/api/catalog.types';
import { formatRupees } from '../../lib/api/money';
import { listAllActiveProducts } from '../../lib/api/products.api';
import type { Product } from '../../lib/api/products.types';
import { listInventoryStocks, type InventoryStockRecord } from '../../lib/api/stocks.api';
import { isWholeQuantityUnit as isWholeSaleUnit } from '../../lib/api/measurement-units';
import {
  emptySaleDraft,
  clearSaleDraft,
  formatCents,
  lineTotalCents,
  parseMoney,
  parseQuantity,
  readSaleDraft,
  saveSaleDraft,
  type SaleCartLine,
  type SaleDraft,
} from './sale-draft';

interface SaleProduct {
  product: Product;
  stocks: InventoryStockRecord[];
  availableHundredths: bigint;
}

const PAGE_COLUMNS = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';

function formatQuantity(value: bigint): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return `${whole}${fraction === '00' ? '' : `.${fraction.replace(/0$/, '')}`}`;
}

function parsePositiveQuantity(value: string): bigint | null {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return null;
  try {
    const parsed = parseQuantity(value);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function NewSalePage() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [initialDraftState] = useState(readDraftState);
  const [draft, setDraft] = useState<SaleDraft>(initialDraftState.draft);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [draftError, setDraftError] = useState(initialDraftState.error);
  const [reload, setReload] = useState(0);
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError('');
    Promise.all([
      listAllActiveProducts(controller.signal),
      listInventoryStocks(controller.signal),
      getActiveCategories(controller.signal),
    ])
      .then(([catalog, stockRows, categoryRows]) => {
        if (!active) return;
        const byProduct = new Map<string, InventoryStockRecord[]>();
        for (const stock of stockRows) {
          const group = byProduct.get(stock.productId) ?? [];
          group.push(stock);
          byProduct.set(stock.productId, group);
        }
        setProducts(
          catalog.map((product) => {
            const stocks = (byProduct.get(product.id) ?? []).filter(
              (stock) => parseQuantity(stock.remainingQuantity) > 0n,
            );
            return {
              product,
              stocks,
              availableHundredths: stocks.reduce(
                (sum, stock) => sum + parseQuantity(stock.remainingQuantity),
                0n,
              ),
            };
          }),
        );
        setCategories(categoryRows);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load products and stock.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reload]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return products.filter(({ product }) => {
      const matchesSearch =
        !term ||
        product.name.toLocaleLowerCase().includes(term) ||
        (product.sku ?? '').toLocaleLowerCase().includes(term) ||
        (product.barcode ?? '').toLocaleLowerCase().includes(term);
      return matchesSearch && (!categoryId || product.categoryId === categoryId);
    });
  }, [categoryId, products, search]);

  const lineTotals = useMemo(
    () => draft.lines.map((line) => lineTotalCents(line.quantity, line.salePrice)),
    [draft.lines],
  );
  const subtotalCents = lineTotals.reduce((sum, cents) => sum + cents, 0n);
  const discountCents = safeMoney(draft.discountAmount);
  const totalCents = subtotalCents > discountCents ? subtotalCents - discountCents : 0n;

  function persist(next: SaleDraft) {
    setDraft(next);
    try {
      saveSaleDraft(next);
      setDraftError('');
    } catch {
      setDraftError('Your sale draft could not be saved in this browser session. Keep this page open until the sale is finalized.');
    }
  }

  function addProduct(entry: SaleProduct) {
    if (draft.requestPending || draftError) return;
    const quantityStep = 100n;
    const firstAvailable = entry.stocks.find((stock) => {
      const used = draft.lines
        .filter((line) => line.stockId === stock.id)
        .reduce((sum, line) => sum + parseQuantity(line.quantity), 0n);
      return used < parseQuantity(stock.remainingQuantity);
    });
    if (!firstAvailable) return;

    const used = draft.lines
      .filter((line) => line.stockId === firstAvailable.id)
      .reduce((sum, line) => sum + parseQuantity(line.quantity), 0n);
    const remaining = parseQuantity(firstAvailable.remainingQuantity) - used;
    const increment = quantityStep < remaining ? quantityStep : remaining;
    const current = draft.lines.find((line) => line.stockId === firstAvailable.id);
    const nextLines = current
      ? draft.lines.map((line) =>
          line.id === current.id
            ? { ...line, quantity: formatQuantity(parseQuantity(line.quantity) + increment) }
            : line,
        )
      : [
          ...draft.lines,
          {
            id: crypto.randomUUID(),
            productId: entry.product.id,
            stockId: firstAvailable.id,
            productName: entry.product.name,
            sku: entry.product.sku || entry.product.barcode || '',
            measuringUnit: entry.product.measuringUnit ?? '',
            quantity: formatQuantity(increment),
            salePrice: firstAvailable.salePrice,
            defaultSalePrice: firstAvailable.salePrice,
            availableQuantity: firstAvailable.remainingQuantity,
          },
        ];
    persist({ ...draft, lines: nextLines });
  }

  function updateQuantity(line: SaleCartLine, value: string) {
    if (draft.requestPending) return;
    const valid = parsePositiveQuantity(value);
    if (valid === null) {
      setQuantityErrors((current) => ({ ...current, [line.id]: 'Enter a positive quantity with up to 2 decimal places.' }));
      return;
    }
    if (isWholeSaleUnit(line.measuringUnit) && valid % 100n !== 0n) {
      setQuantityErrors((current) => ({ ...current, [line.id]: 'This unit only allows whole quantities.' }));
      return;
    }
    const sameLotUsed = draft.lines
      .filter((item) => item.stockId === line.stockId && item.id !== line.id)
      .reduce((sum, item) => sum + parseQuantity(item.quantity), 0n);
    if (valid + sameLotUsed > parseQuantity(line.availableQuantity)) {
      setQuantityErrors((current) => ({ ...current, [line.id]: 'Quantity exceeds the available stock for this lot.' }));
      return;
    }
    setQuantityErrors((current) => {
      const next = { ...current };
      delete next[line.id];
      return next;
    });
    persist({
      ...draft,
      lines: draft.lines.map((item) => item.id === line.id ? { ...item, quantity: value } : item),
    });
  }

  function adjustQuantity(line: SaleCartLine, direction: -1 | 1) {
    const current = parseQuantity(line.quantity);
    const step = isWholeSaleUnit(line.measuringUnit) ? 100n : 100n;
    const next = current + BigInt(direction) * step;
    if (next <= 0n) {
      persist({ ...draft, lines: draft.lines.filter((item) => item.id !== line.id) });
      return;
    }
    updateQuantity(line, formatQuantity(next));
  }

  function removeLine(lineId: string) {
    if (draft.requestPending) return;
    persist({ ...draft, lines: draft.lines.filter((line) => line.id !== lineId) });
    setQuantityErrors((current) => {
      const next = { ...current };
      delete next[lineId];
      return next;
    });
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    const matches = filteredProducts.filter(({ stocks }) => stocks.length > 0);
    if (matches.length === 1) {
      event.preventDefault();
      addProduct(matches[0]!);
      setSearch('');
      searchRef.current?.focus();
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Point of sale</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New Sale</h1>
          <p className="mt-1 text-sm text-slate-500">Scan or search products, then review the sale before finalizing.</p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800" aria-live="polite">
          {draft.lines.reduce((sum, line) => sum + Number(line.quantity), 0)} items
        </span>
      </header>

      {draftError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>{draftError}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              try {
                clearSaleDraft();
                const fresh = emptySaleDraft();
                setDraft(fresh);
                saveSaleDraft(fresh);
                setDraftError('');
              } catch {
                setDraftError('The saved sale draft could not be cleared. Please keep this page open and contact support.');
              }
            }}
          >
            Clear saved draft
          </Button>
        </div>
      )}
      {loadError && (
        <FeedbackState
          tone="error"
          title="Products could not be loaded"
          description={loadError}
          action={<Button variant="secondary" onClick={() => setReload((value) => value + 1)}>Retry</Button>}
        />
      )}

      {!loadError && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)]">
          <section className="min-w-0 space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Barcode size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={searchRef}
                  autoFocus
                  aria-label="Search or scan a product"
                  placeholder="Scan barcode or search name, SKU, barcode…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Search size={15} className="text-slate-400" />
                <Select aria-label="Filter products by category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="min-w-44">
                  <option value="">All categories</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </Select>
              </div>
            </div>

            {loading ? (
              <FeedbackState tone="loading" title="Loading products" description="Checking current inventory availability." />
            ) : filteredProducts.length === 0 ? (
              <FeedbackState tone="empty" title="No matching products" description={search ? 'Try a product name, SKU, barcode, or a different category.' : 'No active products are available in this category.'} />
            ) : (
              <div className={`grid ${PAGE_COLUMNS} gap-3`}>
                {filteredProducts.map((entry) => {
                  const available = entry.availableHundredths > 0n;
                  const firstStock = entry.stocks[0];
                  const categoryName = entry.product.category?.name;
                  return (
                    <article key={entry.product.id} className={`flex min-h-36 flex-col justify-between rounded-xl border bg-white p-3 shadow-sm ${available ? 'border-slate-200' : 'border-rose-200 bg-rose-50/50'}`}>
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="line-clamp-2 text-sm font-semibold text-slate-900">{entry.product.name}</h2>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${available ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {available ? `${formatQuantity(entry.availableHundredths)} ${entry.product.measuringUnit ?? 'units'}` : 'Out of stock'}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{entry.product.sku || entry.product.barcode || 'No SKU / barcode'}{categoryName ? ` · ${categoryName}` : ''}</p>
                        <p className="mt-3 text-base font-bold tabular-nums text-slate-900">{firstStock ? formatRupees(firstStock.salePrice) : formatRupees(entry.product.salePrice)}</p>
                        <p className="text-[11px] text-slate-500">{entry.product.measuringUnit || 'Unit not set'} · sale price from available stock lot</p>
                      </div>
                      <Button
                        className="mt-3 w-full"
                        disabled={!available || !firstStock || draft.requestPending || Boolean(draftError)}
                        onClick={() => addProduct(entry)}
                        aria-label={`Add ${entry.product.name} to sale`}
                      >
                        <Plus size={15} /> {available ? 'Add' : 'Unavailable'}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="sticky top-4 min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShoppingCart size={17} /> Current sale</h2>
              <button type="button" className="text-xs font-medium text-rose-700 hover:text-rose-900" disabled={!draft.lines.length || draft.requestPending} onClick={() => persist({ ...draft, lines: [] })}>Clear sale</button>
            </div>
            {draft.lines.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <ShoppingCart size={24} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-700">Cart is empty</p>
                <p className="mt-1 text-xs text-slate-500">Add products or scan a barcode to begin.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {draft.lines.map((line) => {
                  const lineTotal = lineTotalCents(line.quantity, line.salePrice);
                  const error = quantityErrors[line.id];
                  return (
                    <div key={line.id} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{line.productName}</p>
                          <p className="text-[11px] text-slate-500">{line.sku || 'No SKU'} · {line.measuringUnit || 'unit'} · {formatRupees(line.salePrice)}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatRupees(formatCents(lineTotal))}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => adjustQuantity(line, -1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50" aria-label={`Decrease quantity of ${line.productName}`}><Minus size={14} /></button>
                          <Input
                            aria-label={`Quantity of ${line.productName}`}
                            type="number"
                            min={isWholeSaleUnit(line.measuringUnit) ? '1' : '0.01'}
                            step={isWholeSaleUnit(line.measuringUnit) ? '1' : '0.01'}
                            value={line.quantity}
                            onChange={(event) => updateQuantity(line, event.target.value)}
                            className="h-8 w-20 text-center"
                            disabled={draft.requestPending}
                            aria-invalid={Boolean(error)}
                          />
                          <button type="button" onClick={() => adjustQuantity(line, 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50" aria-label={`Increase quantity of ${line.productName}`}><Plus size={14} /></button>
                        </div>
                        <span className="text-[10px] text-slate-400">Available {line.availableQuantity}</span>
                        <button type="button" onClick={() => removeLine(line.id)} disabled={draft.requestPending} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Remove ${line.productName}`}><Trash2 size={15} /></button>
                      </div>
                      {error && <p role="alert" className="flex items-center gap-1 text-[11px] text-rose-700"><AlertCircle size={12} />{error}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-2 border-t border-slate-100 px-4 py-4">
              <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span className="tabular-nums">{formatRupees(formatCents(subtotalCents))}</span></div>
              <div className="flex justify-between text-sm text-slate-600"><span>Discount</span><span className="tabular-nums">−{formatRupees(formatCents(discountCents))}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900"><span>Total</span><span className="tabular-nums">{formatRupees(formatCents(totalCents))}</span></div>
              <p className="text-[11px] leading-4 text-slate-400">Tax is not supported by the current order or invoice API.</p>
              <Button
                className="mt-2 h-11 w-full text-base"
                disabled={draft.lines.length === 0 || Boolean(draftError) || Object.keys(quantityErrors).length > 0}
                onClick={() => {
                  navigate('/pos/review');
                }}
              >
                {draft.requestPending ? 'Retry Sale Review' : 'Review Sale'}
              </Button>
            </div>
          </aside>
        </div>
      )}
      <div className="text-right text-xs text-slate-500">
        <Link to="/orders" className="font-medium text-teal-700 hover:text-teal-800">View past sales</Link>
      </div>
    </section>
  );
}

function readDraftState(): { draft: SaleDraft; error: string } {
  try {
    return { draft: readSaleDraft() ?? emptySaleDraft(), error: '' };
  } catch (error) {
    return {
      draft: emptySaleDraft(),
      error: error instanceof Error ? error.message : 'Saved sale data could not be read.',
    };
  }
}

function safeMoney(value: string): bigint {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) return 0n;
  try {
    return parseMoney(value);
  } catch {
    return 0n;
  }
}
