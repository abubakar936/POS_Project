import { apiRequest, encodeQuery } from './client';
import type { PageResult } from './catalog.types';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  stockId: string;
  productName: string;
  productSku?: string | null;
  quantity: string;
  salePrice: string;
  discountAmount: string;
  lineTotal: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  subtotal: string;
  discountAmount: string;
  itemDiscountAmount: string;
  totalAmount: string;
  note?: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface OrderQuery {
  page: number;
  limit: number;
  search?: string;
  customerId?: string;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: string;
  paymentMethod: string;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface OrderInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  subtotal: string;
  discountAmount: string;
  itemDiscountAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';
  payments: InvoicePayment[];
}

export function listOrders(query: OrderQuery, signal?: AbortSignal) {
  return apiRequest<PageResult<OrderRecord>>(
    `/orders${encodeQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
      customerId: query.customerId,
    })}`,
    { signal },
  );
}

export function getOrder(id: string, signal?: AbortSignal) {
  return apiRequest<OrderRecord>(`/orders/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function deleteOrder(id: string) {
  return apiRequest<{ success: boolean }>(
    `/orders/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function getInvoiceForOrder(
  orderId: string,
  orderNumber: string,
  signal?: AbortSignal,
): Promise<OrderInvoice | null> {
  const result = await apiRequest<PageResult<OrderInvoice>>(
    `/invoices${encodeQuery({ page: 1, limit: 100, search: orderNumber })}`,
    { signal },
  );
  return result.data.find((invoice) => invoice.orderId === orderId) ?? null;
}
