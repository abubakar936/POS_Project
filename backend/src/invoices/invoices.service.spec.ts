import { DataSource } from 'typeorm';
import { Invoice } from './invoice.entity';
import { InvoicePayment } from './invoice-payment.entity';
import { InvoicesService } from './invoices.service';

const INVOICE_ID = '00000000-0000-4000-8000-000000000001';
const PAYMENT_ID = '00000000-0000-4000-8000-000000000002';
const OTHER_PAYMENT_ID = '00000000-0000-4000-8000-000000000003';

function createHarness() {
  const invoice = {
    id: INVOICE_ID,
    totalAmount: '100.00',
    deletedAt: null,
  } as Invoice;
  let payments = [
    {
      id: PAYMENT_ID,
      invoiceId: INVOICE_ID,
      amount: '40.00',
      paymentDate: '2026-11-01',
      paymentMethod: 'CASH',
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
    },
    {
      id: OTHER_PAYMENT_ID,
      invoiceId: INVOICE_ID,
      amount: '20.00',
      paymentDate: '2026-11-02',
      paymentMethod: 'CARD',
      createdAt: new Date('2026-11-02T10:00:00.000Z'),
    },
  ] as InvoicePayment[];
  const paymentRepo = {
    findOne: async ({ where }: { where: { id: string; invoiceId: string } }) =>
      payments.find((payment) => payment.id === where.id && payment.invoiceId === where.invoiceId) ?? null,
    find: async () => payments,
    save: async (payment: InvoicePayment) => {
      payments = payments.map((existing) => existing.id === payment.id ? { ...payment } : existing);
      return payment;
    },
  };
  const query = {
    leftJoinAndSelect: () => query,
    where: () => query,
    getOne: async () => ({ ...invoice, order: { items: [] } }),
  };
  const invoiceRepo = {
    findOne: async () => invoice,
    createQueryBuilder: () => query,
  };
  const manager = {
    getRepository: (entity: unknown) => entity === Invoice ? invoiceRepo : paymentRepo,
  };
  const dataSource = {
    transaction: async (callback: (transactionManager: typeof manager) => unknown) => callback(manager),
  };
  const service = new InvoicesService(
    dataSource as unknown as DataSource,
    invoiceRepo as never,
    paymentRepo as never,
  );
  return { service, getPayments: () => payments };
}

describe('InvoicesService installment updates', () => {
  it('updates one payment and preserves all other installment records', async () => {
    const { service, getPayments } = createHarness();

    const result = await service.updatePayment(INVOICE_ID, PAYMENT_ID, {
      amount: '50.00',
      paymentDate: '2026-11-03',
    });

    expect(getPayments()).toHaveLength(2);
    expect(getPayments()[0]?.amount).toBe('50.00');
    expect(getPayments()[0]?.paymentDate).toBe('2026-11-03');
    expect(getPayments()[1]?.amount).toBe('20.00');
    expect(result.amountPaid).toBe('70.00');
    expect(result.balanceDue).toBe('30.00');
  });

  it('rejects an installment edit that would overpay the invoice', async () => {
    const { service, getPayments } = createHarness();

    await expect(service.updatePayment(INVOICE_ID, PAYMENT_ID, { amount: '81.00' }))
      .rejects.toThrow('Payment exceeds the invoice balance');
    expect(getPayments()[0]?.amount).toBe('40.00');
    expect(getPayments()[1]?.amount).toBe('20.00');
  });
});
