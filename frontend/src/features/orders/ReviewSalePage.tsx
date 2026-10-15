import { AlertCircle, ArrowLeft, CheckCircle2, Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { listCustomers, type CustomerRecord } from '../../lib/api/customers.api';
import { ApiError } from '../../lib/api/client';
import { formatRupees } from '../../lib/api/money';
import { createSale } from '../../lib/api/orders.api';
import { isWholeQuantityUnit } from '../../lib/api/measurement-units';
import {
  canAdjustSalePrice,
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

function customerName(customer: CustomerRecord): string {
  return customer.full_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
    'Unnamed customer';
}

function safeMoney(value: string): bigint | null {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) return null;
  try {
    return parseMoney(value);
  } catch {
    return null;
  }
}

export function ReviewSalePage() {
  const navigate = useNavigate();
  const [initialDraftState] = useState(readDraftState);
  const [draft, setDraft] = useState<SaleDraft | null>(initialDraftState.draft);
  const [draftError, setDraftError] = useState(initialDraftState.error);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState('');
  const [finalizeError, setFinalizeError] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const canEditPrice = canAdjustSalePrice();

  useEffect(() => {
    if (!draft || draft.lines.length) return;
    navigate('/pos', { replace: true });
  }, [draft, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCustomersLoading(true);
    setCustomerError('');
    const timer = window.setTimeout(() => {
      listCustomers(
        { page: 1, limit: 20, search: customerSearch.trim() || undefined },
        controller.signal,
      )
        .then((result) => {
          if (active) setCustomers(result.data);
        })
        .catch((error: unknown) => {
          if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
          setCustomerError(error instanceof Error ? error.message : 'Could not search customers.');
        })
        .finally(() => {
          if (active) setCustomersLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [customerSearch]);

  const totals = useMemo(() => {
    const subtotal = (draft?.lines ?? []).reduce(
      (sum, line) => sum + lineTotalCents(line.quantity, line.salePrice),
      0n,
    );
    const discount = draft ? safeMoney(draft.discountAmount) : 0n;
    const total = discount === null || discount > subtotal ? 0n : subtotal - discount;
    return { subtotal, discount, total };
  }, [draft]);
  const discountInput = draft ? safeMoney(draft.discountAmount) : null;
  const paymentInput = draft ? safeMoney(draft.paymentAmount) : null;

  function persist(next: SaleDraft) {
    setDraft(next);
    try {
      saveSaleDraft(next);
      setDraftError('');
    } catch {
      setDraftError('The draft could not be saved. Keep this page open until the sale is finalized.');
    }
  }

  function updateLine(lineId: string, changes: Partial<SaleCartLine>) {
    if (!draft) return;
    persist({
      ...draft,
      lines: draft.lines.map((line) => line.id === lineId ? { ...line, ...changes } : line),
    });
  }

  function updateQuantity(line: SaleCartLine, value: string) {
    if (!draft) return;
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) {
      setQuantityErrors((current) => ({ ...current, [line.id]: 'Enter a positive quantity with up to 2 decimal places.' }));
      return;
    }
    const quantity = parseQuantity(value);
    if (quantity <= 0n) {
      setQuantityErrors((current) => ({ ...current, [line.id]: 'Quantity must be greater than zero.' }));
      return;
    }
    if (isWholeQuantityUnit(line.measuringUnit) && quantity % 100n !== 0n) {
      setQuantityErrors((current) => ({ ...current, [line.id]: 'This unit only allows whole quantities.' }));
      return;
    }
    const usedOnLot = draft.lines
      .filter((item) => item.stockId === line.stockId && item.id !== line.id)
      .reduce((sum, item) => sum + parseQuantity(item.quantity), 0n);
    if (quantity + usedOnLot > parseQuantity(line.availableQuantity)) {
      setQuantityErrors((current) => ({ ...current, [line.id]: 'Quantity exceeds the available stock for this lot.' }));
      return;
    }
    setQuantityErrors((current) => {
      const next = { ...current };
      delete next[line.id];
      return next;
    });
    updateLine(line.id, { quantity: value });
  }

  function updatePrice(line: SaleCartLine, value: string) {
    if (!canEditPrice) return;
    if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) {
      setPriceErrors((current) => ({ ...current, [line.id]: 'Enter a non-negative price with up to 2 decimal places.' }));
      return;
    }
    setPriceErrors((current) => {
      const next = { ...current };
      delete next[line.id];
      return next;
    });
    updateLine(line.id, { salePrice: value });
  }

  function selectCustomer(customer: CustomerRecord) {
    if (!draft) return;
    persist({ ...draft, customerMode: 'existing', customerId: customer.id });
  }

  function setWalkIn() {
    if (!draft) return;
    persist({ ...draft, customerMode: 'walk-in', customerId: null });
  }

  async function finalize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setValidationError('');
    setFinalizeError('');
    if (!draft.lines.length) {
      setValidationError('Add at least one available product to the sale.');
      return;
    }
    if (
      draft.customerMode === null ||
      (draft.customerMode === 'existing' && !draft.customerId)
    ) {
      setValidationError('Select an existing customer or explicitly choose Walk-in Customer.');
      return;
    }
    const discount = safeMoney(draft.discountAmount);
    if (discount === null || discount > totals.subtotal) {
      setValidationError('Enter a valid discount that does not exceed the subtotal.');
      return;
    }
    const paymentAmount = safeMoney(draft.paymentAmount);
    if (paymentAmount === null || paymentAmount > totals.total) {
      setValidationError('Enter a valid payment amount no greater than the sale total.');
      return;
    }
    if (Object.keys(quantityErrors).length || Object.keys(priceErrors).length) {
      setValidationError('Correct the highlighted quantity or price values before finalizing.');
      return;
    }
    const submittedDraft = { ...draft, requestPending: true };
    try {
      saveSaleDraft(submittedDraft);
      setDraft(submittedDraft);
      setDraftError('');
    } catch {
      setDraftError('The retry-safe sale request could not be saved. The sale was not sent.');
      return;
    }
    setFinalizing(true);
    try {
      const completed = await createSale({
        clientRequestId: draft.clientRequestId,
        createInvoice: true,
        walkInCustomer: draft.customerMode === 'walk-in',
        ...(draft.customerMode === 'existing' && draft.customerId
          ? { customerId: draft.customerId }
          : {}),
        discountAmount: draft.discountAmount,
        ...(paymentAmount > 0n
          ? {
              payment: {
                amount: draft.paymentAmount,
                paymentMethod: draft.paymentMethod,
              },
            }
          : {}),
        items: draft.lines.map((line) => ({
          productId: line.productId,
          stockId: line.stockId,
          quantity: line.quantity,
          ...(canEditPrice && line.salePrice !== line.defaultSalePrice
            ? { salePrice: line.salePrice }
            : {}),
        })),
      });
      try {
        clearSaleDraft();
      } catch {
        // The server has committed the sale; the idempotency key prevents a repeated sale.
      }
      navigate('/pos/success', { replace: true, state: { sale: completed } });
    } catch (error) {
      const rejectedWithoutCommit =
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 409;
      if (rejectedWithoutCommit) {
        persist({
          ...draft,
          requestPending: false,
          clientRequestId: crypto.randomUUID(),
        });
      }
      setFinalizeError(
        rejectedWithoutCommit
          ? `${error instanceof Error ? error.message : 'The sale was rejected.'} Your cart is preserved. Correct the issue and submit again.`
          : `${error instanceof Error ? error.message : 'Could not confirm the sale.'} Your cart is locked; retrying uses the same request ID to avoid creating another sale.`,
      );
    } finally {
      setFinalizing(false);
    }
  }

  if (draftError && !draft) {
    return <FeedbackState tone="error" title="Sale draft could not be loaded" description={draftError} action={<Link to="/pos"><Button variant="secondary">Back to sale</Button></Link>} />;
  }
  if (!draft) {
    return <FeedbackState tone="empty" title="No sale to review" description="Start a new sale and add products first." action={<Link to="/pos"><Button>New Sale</Button></Link>} />;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Point of sale / Review</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Review Sale</h1>
          <p className="mt-1 text-sm text-slate-500">Confirm item quantities, prices, customer and payment before finalizing.</p>
        </div>
        <Link
          to="/pos"
          aria-disabled={draft.requestPending || finalizing}
          className={draft.requestPending || finalizing ? 'pointer-events-none opacity-50' : ''}
        ><Button type="button" variant="secondary" disabled={draft.requestPending || finalizing}><ArrowLeft size={15} />Back to Sale</Button></Link>
      </header>

      {draft.requestPending && (
        <p role="alert" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertCircle size={17} className="shrink-0" />
          A previous submission did not receive a confirmation. The sale is locked and retrying will use the same request ID to check for its saved result.
        </p>
      )}
      {draftError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{draftError}</p>}
      {finalizeError && <p role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0" />{finalizeError}</p>}
      {validationError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{validationError}</p>}

      <form onSubmit={(event) => void finalize(event)} className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3"><h2 className="font-semibold text-slate-900">Sale items</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-3 py-3">Available</th>
                  <th className="px-3 py-3">Quantity</th>
                  <th className="px-3 py-3">Sale price</th>
                  <th className="px-4 py-3 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draft.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{line.productName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{line.sku || 'No SKU'} · {line.measuringUnit || 'unit'}</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">{line.availableQuantity} {line.measuringUnit}</td>
                    <td className="px-3 py-3">
                      <Input
                        type="number"
                        min={isWholeQuantityUnit(line.measuringUnit) ? '1' : '0.01'}
                        step={isWholeQuantityUnit(line.measuringUnit) ? '1' : '0.01'}
                        value={line.quantity}
                        aria-label={`Quantity for ${line.productName}`}
                        aria-invalid={Boolean(quantityErrors[line.id])}
                        onChange={(event) => updateQuantity(line, event.target.value)}
                        className="w-28"
                        disabled={draft.requestPending || finalizing}
                      />
                      {quantityErrors[line.id] && <p role="alert" className="mt-1 max-w-36 text-xs text-rose-700">{quantityErrors[line.id]}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {canEditPrice ? (
                        <>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.salePrice}
                            aria-label={`Sale price for ${line.productName}`}
                            aria-invalid={Boolean(priceErrors[line.id])}
                            onChange={(event) => updatePrice(line, event.target.value)}
                            className="w-32"
                            disabled={draft.requestPending || finalizing}
                          />
                          {priceErrors[line.id] && <p role="alert" className="mt-1 max-w-40 text-xs text-rose-700">{priceErrors[line.id]}</p>}
                          {line.salePrice !== line.defaultSalePrice && <p className="mt-1 text-[10px] text-amber-700">Sale-only price; stock price unchanged.</p>}
                        </>
                      ) : (
                        <span className="tabular-nums text-slate-700">{formatRupees(line.salePrice)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{formatRupees(formatCents(lineTotalCents(line.quantity, line.salePrice)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900"><UserRound size={17} />Customer</h2>
              <Button type="button" variant={draft.customerMode === 'walk-in' ? 'primary' : 'secondary'} onClick={setWalkIn} disabled={draft.requestPending || finalizing}>Walk-in Customer</Button>
            </div>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input aria-label="Search existing customers" placeholder="Search customer name, phone, or email…" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} className="pl-9" disabled={draft.requestPending || finalizing} />
            </div>
            {customerError && <p role="alert" className="text-sm text-rose-700">{customerError}</p>}
            {customersLoading ? <p className="text-xs text-slate-500">Searching customers…</p> : customers.length > 0 ? (
              <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    disabled={draft.requestPending || finalizing}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-teal-50 ${draft.customerId === customer.id ? 'bg-teal-50' : ''}`}
                  >
                    <span><span className="block text-sm font-medium text-slate-800">{customerName(customer)}</span><span className="text-xs text-slate-500">{customer.phone || customer.email || 'No contact details'}</span></span>
                    {draft.customerId === customer.id && <CheckCircle2 size={16} className="text-teal-700" />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{customerSearch ? 'No matching customers.' : 'Search to choose an existing customer or select Walk-in Customer.'}</p>
            )}
            <p className="text-xs text-slate-500">
              Selected: {draft.customerMode === 'walk-in'
                ? 'Walk-in Customer'
                : draft.customerMode === 'existing'
                    ? (() => {
                        const customer = customers.find((record) => record.id === draft.customerId);
                        return customer ? customerName(customer) : 'Existing customer';
                      })()
                    : 'Choose a customer or walk-in'}
            </p>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">Discount and payment</h2>
            <label className="block text-xs font-medium text-slate-600">
              Sale discount
              <Input
                className="mt-1.5"
                type="number"
                min="0"
                step="0.01"
                value={draft.discountAmount}
                aria-label="Sale discount amount"
                aria-invalid={discountInput === null || discountInput > totals.subtotal}
                onChange={(event) => persist({ ...draft, discountAmount: event.target.value })}
                disabled={draft.requestPending || finalizing}
              />
              {(discountInput === null || discountInput > totals.subtotal) && <span role="alert" className="mt-1 block text-xs text-rose-700">Discount must be valid and cannot exceed the subtotal.</span>}
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Payment method
              <Select
                className="mt-1.5"
                value={draft.paymentMethod}
                onChange={(event) => persist({ ...draft, paymentMethod: event.target.value as SaleDraft['paymentMethod'] })}
                disabled={draft.requestPending || finalizing}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="OTHER">Other</option>
              </Select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Amount received <span className="font-normal text-slate-400">(leave 0.00 for unpaid)</span>
              <Input
                className="mt-1.5"
                type="number"
                min="0"
                step="0.01"
                value={draft.paymentAmount}
                aria-label="Payment amount received"
                aria-invalid={paymentInput === null || paymentInput > totals.total}
                onChange={(event) => persist({ ...draft, paymentAmount: event.target.value })}
                disabled={draft.requestPending || finalizing}
              />
              {(paymentInput === null || paymentInput > totals.total) && <span role="alert" className="mt-1 block text-xs text-rose-700">Payment cannot exceed the grand total.</span>}
            </label>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <TotalRow label="Subtotal" value={formatRupees(formatCents(totals.subtotal))} />
              <TotalRow label="Discount" value={`−${formatRupees(formatCents(totals.discount ?? 0n))}`} />
              <TotalRow label="Tax" value="Not supported" muted />
              <TotalRow label="Grand total" value={formatRupees(formatCents(totals.total))} strong />
              <TotalRow
                label="Payment status"
                value={
                  (safeMoney(draft.paymentAmount) ?? 0n) === totals.total
                    ? totals.total === 0n ? 'UNPAID' : 'PAID'
                    : (safeMoney(draft.paymentAmount) ?? 0n) > 0n
                      ? 'PARTIALLY PAID'
                      : 'UNPAID'
                }
              />
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">Finalizing creates the order, invoice and optional payment atomically and deducts stock once.</p>
          <Button type="submit" disabled={finalizing || Boolean(draftError)} className="h-11 min-w-48 text-base">
            {finalizing ? 'Finalizing…' : draft.requestPending ? 'Retry Finalize Sale' : 'Finalize Sale'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function TotalRow({ label, value, muted = false, strong = false }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'text-base font-bold text-slate-900' : `text-sm ${muted ? 'text-slate-400' : 'text-slate-600'}`}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

function readDraftState(): { draft: SaleDraft | null; error: string } {
  try {
    return { draft: readSaleDraft(), error: '' };
  } catch (error) {
    return {
      draft: null,
      error: error instanceof Error ? error.message : 'Saved sale data could not be read.',
    };
  }
}
