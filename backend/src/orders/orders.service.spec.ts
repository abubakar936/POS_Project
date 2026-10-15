import { DataSource, EntityManager, Repository } from 'typeorm';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Customer } from '../customers/customer.entity';
import { Role } from '../users/enums/role.enum';
import { InvoicePayment } from '../invoices/invoice-payment.entity';
import { Invoice } from '../invoices/invoice.entity';
import { Product } from '../products/product.entity';
import { Stock } from '../stock/stock.entity';
import { OrderItem } from './order-item.entity';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

const PRODUCT_ID = '00000000-0000-4000-8000-000000000001';
const STOCK_ID = '00000000-0000-4000-8000-000000000002';
const REQUEST_ID = '00000000-0000-4000-8000-000000000003';
const ADMIN: JwtPayload = { sub: 'admin', email: 'admin@example.test', role: Role.Admin };
const USER: JwtPayload = { sub: 'user', email: 'user@example.test', role: Role.User };

function createHarness(options: { unit?: string; quantity?: string; price?: string } = {}) {
  const database = {
    orders: [] as Order[],
    items: [] as OrderItem[],
    invoices: [] as Invoice[],
    payments: [] as InvoicePayment[],
    stock: {
      id: STOCK_ID,
      productId: PRODUCT_ID,
      quantity: options.quantity ?? '5.00',
      remainingQuantity: options.quantity ?? '5.00',
      salePrice: options.price ?? '10.00',
      deletedAt: null,
    } as Stock,
    product: {
      id: PRODUCT_ID,
      name: 'Sample',
      sku: 'S-1',
      measuringUnit: options.unit ?? 'pcs',
      salePrice: options.price ?? '10.00',
      isActive: true,
      deletedAt: null,
    } as Product,
  };

  const repos = new Map<unknown, Record<string, (...args: never[]) => unknown>>();
  const orderRepo = {
    findOne: async (options: { where: { orderNumber?: string } }) =>
      database.orders.find((order) => order.orderNumber === options.where.orderNumber) ?? null,
    create: (value: Partial<Order>) => ({ ...value }),
    save: async (value: Partial<Order>) => {
      const saved = { ...value, id: `order-${database.orders.length + 1}` } as Order;
      database.orders.push(saved);
      return saved;
    },
    createQueryBuilder: () => {
      let id = '';
      const query = {
        leftJoinAndSelect: () => query,
        where: (_sql: string, params: { id: string }) => {
          id = params.id;
          return query;
        },
        getOne: async () => {
          const order = database.orders.find((item) => item.id === id);
          return order ? { ...order, items: database.items.filter((item) => item.orderId === id) } : null;
        },
      };
      return query;
    },
  };
  const customerRepo = { findOne: async () => null };
  const productRepo = { find: async () => [database.product] };
  const stockRepo = {
    createQueryBuilder: () => {
      const query = {
        where: () => query,
        orderBy: () => query,
        setLock: () => query,
        withDeleted: () => query,
        getMany: async () => [database.stock],
      };
      return query;
    },
    save: async () => undefined,
  };
  const itemRepo = {
    create: (value: Partial<OrderItem>) => ({ ...value }),
    save: async (values: Partial<OrderItem>[]) => {
      database.items.push(...values.map((value, index) => ({
        ...value,
        id: `item-${database.items.length + index + 1}`,
      }) as OrderItem));
    },
    find: async () => database.items,
  };
  const invoiceRepo = {
    findOne: async (options: { where: { orderId?: string; id?: string } }) =>
      database.invoices.find((invoice) =>
        options.where.orderId
          ? invoice.orderId === options.where.orderId
          : invoice.id === options.where.id,
      ) ?? null,
    create: (value: Partial<Invoice>) => ({ ...value }),
    save: async (value: Partial<Invoice>) => {
      const saved = { ...value, id: `invoice-${database.invoices.length + 1}` } as Invoice;
      database.invoices.push(saved);
      return saved;
    },
    createQueryBuilder: () => {
      let id = '';
      const query = {
        leftJoinAndSelect: () => query,
        where: (_sql: string, params: { id: string }) => {
          id = params.id;
          return query;
        },
        getOne: async () => {
          const invoice = database.invoices.find((item) => item.id === id);
          if (!invoice) return null;
          const order = database.orders.find((item) => item.id === invoice.orderId);
          return {
            ...invoice,
            order: order
              ? { ...order, items: database.items.filter((item) => item.orderId === order.id) }
              : null,
          };
        },
      };
      return query;
    },
  };
  const paymentRepo = {
    create: (value: Partial<InvoicePayment>) => ({ ...value }),
    save: async (value: Partial<InvoicePayment>) => {
      const saved = { ...value, id: `payment-${database.payments.length + 1}` } as InvoicePayment;
      database.payments.push(saved);
      return saved;
    },
    find: async (options: { where: { invoiceId: string } }) =>
      database.payments.filter((payment) => payment.invoiceId === options.where.invoiceId),
  };
  repos.set(Order, orderRepo);
  repos.set(Customer, customerRepo);
  repos.set(Product, productRepo);
  repos.set(Stock, stockRepo);
  repos.set(OrderItem, itemRepo);
  repos.set(Invoice, invoiceRepo);
  repos.set(InvoicePayment, paymentRepo);

  const manager = {
    getRepository: (entity: unknown) => repos.get(entity),
    query: async () => undefined,
  };
  const dataSource = {
    transaction: async <T>(callback: (txManager: EntityManager) => Promise<T>) => {
      const orderCount = database.orders.length;
      const itemCount = database.items.length;
      const invoiceCount = database.invoices.length;
      const paymentCount = database.payments.length;
      const remaining = database.stock.remainingQuantity;
      try {
        return await callback(manager as EntityManager);
      } catch (error) {
        database.orders.length = orderCount;
        database.items.length = itemCount;
        database.invoices.length = invoiceCount;
        database.payments.length = paymentCount;
        database.stock.remainingQuantity = remaining;
        throw error;
      }
    },
  };
  const service = new OrdersService(
    dataSource as unknown as DataSource,
    orderRepo as unknown as Repository<Order>,
  );
  return { service, database };
}

function saleDto(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: REQUEST_ID,
    createInvoice: true,
    walkInCustomer: true,
    items: [{ productId: PRODUCT_ID, stockId: STOCK_ID, quantity: '1' }],
    ...overrides,
  };
}

describe('OrdersService retail sales', () => {
  it('rejects fractional quantities for whole-count units and leaves stock unchanged', async () => {
    const { service, database } = createHarness({ unit: 'pcs' });
    await expect(
      service.create(saleDto({ items: [{ productId: PRODUCT_ID, stockId: STOCK_ID, quantity: '1.5' }] }), USER),
    ).rejects.toThrow('whole number');
    expect(database.stock.remainingQuantity).toBe('5.00');
    expect(database.orders).toHaveLength(0);
  });

  it('allows fractional quantity for weight units and rejects insufficient stock', async () => {
    const fractional = createHarness({ unit: 'kg' });
    await fractional.service.create(
      saleDto({ items: [{ productId: PRODUCT_ID, stockId: STOCK_ID, quantity: '1.25' }] }),
      USER,
    );
    expect(fractional.database.stock.remainingQuantity).toBe('3.75');

    const insufficient = createHarness({ quantity: '0.50' });
    await expect(
      insufficient.service.create(
        saleDto({ items: [{ productId: PRODUCT_ID, stockId: STOCK_ID, quantity: '1' }] }),
        USER,
      ),
    ).rejects.toThrow('Insufficient stock');
    expect(insufficient.database.orders).toHaveLength(0);
  });

  it('allows only administrators to override a sale price without changing the stock price', async () => {
    const regular = createHarness();
    await expect(
      regular.service.create(
        saleDto({ items: [{ productId: PRODUCT_ID, stockId: STOCK_ID, quantity: '1', salePrice: '8.50' }] }),
        USER,
      ),
    ).rejects.toThrow('Only administrators');

    const admin = createHarness();
    await admin.service.create(
      saleDto({ items: [{ productId: PRODUCT_ID, stockId: STOCK_ID, quantity: '1', salePrice: '8.50' }] }),
      ADMIN,
    );
    expect(admin.database.items[0]?.salePrice).toBe('8.50');
    expect(admin.database.stock.salePrice).toBe('10.00');
  });

  it('supports the existing null-customer walk-in model and creates invoice/payment atomically', async () => {
    const { service, database } = createHarness();
    const result = await service.create(
      saleDto({
        payment: { amount: '5.00', paymentMethod: 'CASH' },
      }),
      USER,
    );
    expect(database.orders[0]?.customerId).toBeNull();
    expect(result.invoice.status).toBe('PARTIALLY_PAID');
    expect(result.invoice.amountPaid).toBe('5.00');
    expect(database.invoices).toHaveLength(1);
    expect(database.payments).toHaveLength(1);
  });

  it('requires explicit walk-in selection when no customer ID is provided', async () => {
    const { service, database } = createHarness();
    await expect(
      service.create(saleDto({ walkInCustomer: false }), USER),
    ).rejects.toThrow('explicitly select Walk-in Customer');
    expect(database.orders).toHaveLength(0);
  });

  it('returns an existing result for a repeated request ID without deducting stock twice', async () => {
    const { service, database } = createHarness();
    const first = await service.create(saleDto(), USER);
    const second = await service.create(saleDto(), USER);
    expect(second.id).toBe(first.id);
    expect(database.orders).toHaveLength(1);
    expect(database.invoices).toHaveLength(1);
    expect(database.stock.remainingQuantity).toBe('4.00');
  });

  it('rolls back stock, order, invoice and payment changes when payment validation fails', async () => {
    const { service, database } = createHarness();
    await expect(
      service.create(
        saleDto({ payment: { amount: '11.00', paymentMethod: 'CASH' } }),
        USER,
      ),
    ).rejects.toThrow('cannot exceed the sale total');
    expect(database.stock.remainingQuantity).toBe('5.00');
    expect(database.orders).toHaveLength(0);
    expect(database.invoices).toHaveLength(0);
    expect(database.payments).toHaveLength(0);
  });
});
