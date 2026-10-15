import { ACCESS_TOKEN_STORAGE_KEY } from '../../lib/api/client';

export interface SaleCartLine {
  id: string;
  productId: string;
  stockId: string;
  productName: string;
  sku: string;
  measuringUnit: string;
  quantity: string;
  salePrice: string;
  defaultSalePrice: string;
  availableQuantity: string;
}

export interface SaleDraft {
  clientRequestId: string;
  requestPending: boolean;
  lines: SaleCartLine[];
  discountAmount: string;
  customerId: string | null;
  customerMode: 'walk-in' | 'existing' | null;
  paymentAmount: string;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
}

const STORAGE_KEY = 'pos_sale_draft_v1';

export const emptySaleDraft = (): SaleDraft => ({
  clientRequestId: crypto.randomUUID(),
  requestPending: false,
  lines: [],
  discountAmount: '0.00',
  customerId: null,
  customerMode: null,
  paymentAmount: '0.00',
  paymentMethod: 'CASH',
});

export function readSaleDraft(): SaleDraft | null {
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  const parsed: unknown = JSON.parse(saved);
  if (!isSaleDraft(parsed)) {
    throw new Error('Saved sale data is invalid. Clear the draft to start again.');
  }
  return { ...parsed, requestPending: parsed.requestPending ?? false };
}

export function saveSaleDraft(draft: SaleDraft): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearSaleDraft(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function canAdjustSalePrice(): boolean {
  const token = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (!token) return false;
  const payload = token.split('.')[1];
  if (!payload) return false;
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: unknown;
    };
    return decoded.role === 'admin';
  } catch {
    return false;
  }
}

function isSaleDraft(value: unknown): value is SaleDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<SaleDraft>;
  return (
    typeof draft.clientRequestId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draft.clientRequestId) &&
    Array.isArray(draft.lines) &&
    draft.lines.every((line) =>
      Boolean(line) &&
      typeof line === 'object' &&
      typeof line.id === 'string' &&
      typeof line.productId === 'string' &&
      typeof line.stockId === 'string' &&
      typeof line.productName === 'string' &&
      typeof line.sku === 'string' &&
      typeof line.measuringUnit === 'string' &&
      typeof line.quantity === 'string' &&
      typeof line.salePrice === 'string' &&
      typeof line.defaultSalePrice === 'string' &&
      typeof line.availableQuantity === 'string',
    ) &&
    (draft.requestPending === undefined || typeof draft.requestPending === 'boolean') &&
    typeof draft.discountAmount === 'string' &&
    (draft.customerMode === null ||
      draft.customerMode === 'walk-in' ||
      draft.customerMode === 'existing') &&
    typeof draft.paymentAmount === 'string' &&
    ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'].includes(
      draft.paymentMethod ?? '',
    )
  );
}

export function parseQuantity(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function parseMoney(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function formatCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

export function lineTotalCents(quantity: string, price: string): bigint {
  return (parseQuantity(quantity) * parseMoney(price) + 50n) / 100n;
}
