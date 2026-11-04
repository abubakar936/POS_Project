import { DataSource } from 'typeorm';
import { DashboardService } from './dashboard.service';

function createService() {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('WITH selected_orders')) {
      return [{
        totalSales: '120.00',
        totalProfit: '45.00',
        totalOrders: 2,
        totalCustomers: 1,
        unknownCostItems: 0,
        totalSalesToDate: '950.00',
      }];
    }
    if (sql.includes('UPPER(payment."paymentMethod") AS method')) {
      return [{ method: 'CASH', amount: '70.00' }, { method: 'CARD', amount: '20.00' }];
    }
    if (sql.includes('AS receivables')) return [{ receivables: '30.00' }];
    if (sql.includes('date_trunc')) return [{ label: '2026-11-03', sales: '120.00' }];
    if (sql.includes('AS revenue')) return [{ productId: 'product-1', name: 'Tea', category: 'Drinks', quantity: '3.00', revenue: '120.00' }];
    if (sql.includes('AS profit')) return [{ productId: 'product-1', name: 'Tea', category: 'Drinks', profit: '45.00' }];
    if (sql.includes('FROM "stocks" AS stock')) return [{ productId: 'product-2', name: 'Milk', category: 'Dairy', unit: 'pcs', remainingQuantity: '2.00', minimumQuantity: '5.00' }];
    return [{
      id: 'order-1',
      saleNumber: 'SALE-000001',
      invoiceNumber: 'INV-000001',
      customerName: 'Walk-in Customer',
      totalAmount: '120.00',
      itemCount: 1,
      amountPaid: '90.00',
      paymentMethods: 'CASH, CARD',
      paymentStatus: 'PARTIALLY PAID',
      createdAt: '2026-11-03T08:30:00.000Z',
    }];
  });
  const service = new DashboardService({ query } as unknown as DataSource);
  return { service, query };
}

describe('DashboardService', () => {
  it('returns period sales, received payments, receivables and product insights', async () => {
    const { service, query } = createService();
    const result = await service.getDashboard({
      from: '2026-11-03T00:00:00.000Z',
      to: '2026-11-04T00:00:00.000Z',
      bucket: 'day',
      timeZone: 'UTC',
    });

    expect(result.summary).toMatchObject({
      totalSales: '120.00',
      totalProfit: '45.00',
      totalOrders: 2,
      totalCustomers: 1,
      totalCashPayments: '70.00',
      totalCardPayments: '20.00',
      receivables: '30.00',
      totalSalesToDate: '950.00',
    });
    expect(result.topProducts[0]?.name).toBe('Tea');
    expect(result.bestProducts[0]?.profit).toBe('45.00');
    expect(result.lowStockProducts[0]?.remainingQuantity).toBe('2.00');
    expect(result.recentSales[0]?.invoiceNumber).toBe('INV-000001');
    expect(query).toHaveBeenCalledTimes(8);
  });

  it('rejects invalid date ranges before querying the database', async () => {
    const { service, query } = createService();

    await expect(service.getDashboard({
      from: '2026-11-04T00:00:00.000Z',
      to: '2026-11-03T00:00:00.000Z',
      bucket: 'day',
      timeZone: 'UTC',
    })).rejects.toThrow('Dashboard date range is invalid');
    expect(query).not.toHaveBeenCalled();
  });
});
