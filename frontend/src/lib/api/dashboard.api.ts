import { apiRequest, encodeQuery } from './client';

export type DashboardBucket = 'hour' | 'day' | 'week' | 'month';

export interface DashboardQuery {
  from: string;
  to: string;
  bucket: DashboardBucket;
  timeZone: string;
}

export interface DashboardResponse {
  from: string;
  to: string;
  bucket: DashboardBucket;
  summary: {
    totalSales: string;
    totalProfit: string | null;
    totalOrders: number;
    totalCustomers: number;
    totalCashPayments: string;
    totalCardPayments: string;
    receivables: string;
    totalSalesToDate: string;
    unknownCostItems: number;
  };
  salesTrend: Array<{ label: string; sales: string }>;
  paymentMethods: Array<{ method: string; amount: string }>;
  topProducts: Array<{
    productId: string;
    name: string;
    category: string;
    quantity: string;
    revenue: string;
  }>;
  bestProducts: Array<{
    productId: string;
    name: string;
    category: string;
    profit: string;
  }>;
  lowStockProducts: Array<{
    productId: string;
    name: string;
    category: string;
    unit: string;
    remainingQuantity: string;
    minimumQuantity: string;
  }>;
  recentSales: Array<{
    id: string;
    saleNumber: string;
    invoiceNumber: string | null;
    customerName: string;
    totalAmount: string;
    itemCount: number;
    amountPaid: string;
    paymentMethods: string;
    paymentStatus: string;
    createdAt: string;
  }>;
}

export function getDashboard(query: DashboardQuery, signal?: AbortSignal) {
  return apiRequest<DashboardResponse>(
    `/dashboard${encodeQuery({
      from: query.from,
      to: query.to,
      bucket: query.bucket,
      timeZone: query.timeZone,
    })}`,
    { signal },
  );
}
