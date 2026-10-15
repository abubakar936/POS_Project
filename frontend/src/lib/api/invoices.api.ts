import type { OrderItem } from './orders.api';
import type { PageResult } from './catalog.types';
import { apiRequest, encodeQuery } from './client';

export type InvoicePaymentStatus = 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';

export interface InvoicePaymentRecord {
  id: string;
  invoiceId: string;
  amount: string;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER' | string;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface InvoiceOrder {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  items?: OrderItem[];
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  orderId: string;
  order?: InvoiceOrder | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  subtotal: string;
  discountAmount: string;
  itemDiscountAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  status: InvoicePaymentStatus;
  note?: string | null;
  dueDate?: string | null;
  payments: InvoicePaymentRecord[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface InvoiceQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface CreateInvoicePayload {
  orderId: string;
  note?: string;
  dueDate?: string;
}

export interface UpdateInvoicePayload {
  note?: string | null;
  dueDate?: string | null;
}

export interface CreateInvoicePaymentPayload {
  amount: string;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
  reference?: string;
  note?: string;
}

export function listInvoices(query: InvoiceQuery, signal?: AbortSignal) {
  return apiRequest<PageResult<InvoiceRecord>>(
    `/invoices${encodeQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
    })}`,
    { signal },
  );
}

export function getInvoice(id: string, signal?: AbortSignal) {
  return apiRequest<InvoiceRecord>(`/invoices/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function createInvoice(payload: CreateInvoicePayload) {
  return apiRequest<InvoiceRecord>('/invoices', {
    method: 'POST',
    body: payload,
  });
}

export function updateInvoice(id: string, payload: UpdateInvoicePayload) {
  return apiRequest<InvoiceRecord>(`/invoices/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteInvoice(id: string) {
  return apiRequest<{ success: boolean }>(
    `/invoices/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export function addInvoicePayment(
  id: string,
  payload: CreateInvoicePaymentPayload,
) {
  return apiRequest<InvoiceRecord>(
    `/invoices/${encodeURIComponent(id)}/payments`,
    { method: 'POST', body: payload },
  );
}

export function deleteInvoicePayment(id: string, paymentId: string) {
  return apiRequest<InvoiceRecord>(
    `/invoices/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`,
    { method: 'DELETE' },
  );
}
