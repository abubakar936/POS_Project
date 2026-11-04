import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

interface DashboardRange {
  from: Date;
  to: Date;
  timeZone: string;
  bucket: 'hour' | 'day' | 'week' | 'month';
}

function valueAsText(value: unknown, fallback = '0.00'): string {
  return value === null || value === undefined ? fallback : String(value);
}

function valueAsNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async getDashboard(query: DashboardQueryDto) {
    const range = this.resolveRange(query);
    const [summaryRows, paymentRows, receivableRows, trendRows, topProductRows, bestProductRows, lowStockRows, recentRows] =
      await Promise.all([
        this.dataSource.query(
          `WITH selected_orders AS (
            SELECT "id", "customerId", "totalAmount"
            FROM "orders"
            WHERE "deletedAt" IS NULL AND "createdAt" >= $1 AND "createdAt" < $2
          ), sales AS (
            SELECT COALESCE(SUM("totalAmount"), 0) AS total,
              COUNT(*)::int AS orders,
              COUNT(DISTINCT "customerId")::int AS customers
            FROM selected_orders
          ), costs AS (
            SELECT COALESCE(SUM(item."quantity" * item."purchasePrice"), 0) AS cost,
              COUNT(item."id") FILTER (
                WHERE item."id" IS NOT NULL AND item."purchasePrice" IS NULL
              )::int AS unknown_cost_items
            FROM selected_orders AS sale
            LEFT JOIN "order_items" AS item ON item."orderId" = sale."id"
          )
          SELECT sales.total::numeric(14,2)::text AS "totalSales",
            CASE WHEN costs.unknown_cost_items = 0
              THEN (sales.total - costs.cost)::numeric(14,2)::text
              ELSE NULL END AS "totalProfit",
            sales.orders AS "totalOrders",
            sales.customers AS "totalCustomers",
            costs.unknown_cost_items AS "unknownCostItems",
            (SELECT COALESCE(SUM("totalAmount"), 0)::numeric(14,2)::text
              FROM "orders" WHERE "deletedAt" IS NULL) AS "totalSalesToDate"
          FROM sales CROSS JOIN costs`,
          [range.from, range.to],
        ),
        this.dataSource.query(
          `SELECT UPPER(payment."paymentMethod") AS method,
            COALESCE(SUM(payment.amount), 0)::numeric(14,2)::text AS amount
          FROM "invoice_payments" AS payment
          INNER JOIN "invoices" AS invoice
            ON invoice.id = payment."invoiceId" AND invoice."deletedAt" IS NULL
          WHERE payment."deletedAt" IS NULL
            AND payment."createdAt" >= $1 AND payment."createdAt" < $2
          GROUP BY UPPER(payment."paymentMethod")
          ORDER BY UPPER(payment."paymentMethod")`,
          [range.from, range.to],
        ),
        this.dataSource.query(
          `WITH paid AS (
            SELECT payment."invoiceId", SUM(payment.amount) AS amount
            FROM "invoice_payments" AS payment
            WHERE payment."deletedAt" IS NULL
            GROUP BY payment."invoiceId"
          )
          SELECT COALESCE(SUM(GREATEST(invoice."totalAmount" - COALESCE(paid.amount, 0), 0)), 0)
            ::numeric(14,2)::text AS receivables
          FROM "invoices" AS invoice
          LEFT JOIN paid ON paid."invoiceId" = invoice.id
          WHERE invoice."deletedAt" IS NULL
            AND invoice."createdAt" >= $1 AND invoice."createdAt" < $2`,
          [range.from, range.to],
        ),
        this.dataSource.query(
          `SELECT to_char(
              date_trunc($4::text, sale."createdAt" AT TIME ZONE $3),
              CASE $4::text
                WHEN 'hour' THEN 'HH24:00'
                WHEN 'month' THEN 'Mon YYYY'
                ELSE 'YYYY-MM-DD'
              END
            ) AS label,
            COALESCE(SUM(sale."totalAmount"), 0)::numeric(14,2)::text AS sales
          FROM "orders" AS sale
          WHERE sale."deletedAt" IS NULL
            AND sale."createdAt" >= $1 AND sale."createdAt" < $2
          GROUP BY date_trunc($4::text, sale."createdAt" AT TIME ZONE $3)
          ORDER BY date_trunc($4::text, sale."createdAt" AT TIME ZONE $3)`,
          [range.from, range.to, range.timeZone, range.bucket],
        ),
        this.dataSource.query(
          `SELECT product.id AS "productId", product.name,
            category.name AS category,
            SUM(item.quantity)::numeric(14,2)::text AS quantity,
            SUM(
              item."lineTotal" - CASE
                WHEN sale.subtotal - sale."itemDiscountAmount" > 0
                  THEN ROUND(sale."discountAmount" * item."lineTotal" /
                    (sale.subtotal - sale."itemDiscountAmount"), 2)
                ELSE 0
              END
            )::numeric(14,2)::text AS revenue
          FROM "orders" AS sale
          INNER JOIN "order_items" AS item ON item."orderId" = sale.id
          INNER JOIN "products" AS product ON product.id = item."productId"
          LEFT JOIN "categories" AS category ON category.id = product."categoryId"
          WHERE sale."deletedAt" IS NULL
            AND sale."createdAt" >= $1 AND sale."createdAt" < $2
          GROUP BY product.id, product.name, category.name
          ORDER BY SUM(item.quantity) DESC, SUM(
            item."lineTotal" - CASE
              WHEN sale.subtotal - sale."itemDiscountAmount" > 0
                THEN ROUND(sale."discountAmount" * item."lineTotal" /
                  (sale.subtotal - sale."itemDiscountAmount"), 2)
              ELSE 0
            END
          ) DESC
          LIMIT 8`,
          [range.from, range.to],
        ),
        this.dataSource.query(
          `SELECT product.id AS "productId", product.name,
            category.name AS category,
            SUM(
              item."lineTotal" - CASE
                WHEN sale.subtotal - sale."itemDiscountAmount" > 0
                  THEN ROUND(sale."discountAmount" * item."lineTotal" /
                    (sale.subtotal - sale."itemDiscountAmount"), 2)
                ELSE 0
              END - item.quantity * item."purchasePrice"
            )::numeric(14,2)::text AS profit
          FROM "orders" AS sale
          INNER JOIN "order_items" AS item ON item."orderId" = sale.id
          INNER JOIN "products" AS product ON product.id = item."productId"
          LEFT JOIN "categories" AS category ON category.id = product."categoryId"
          WHERE sale."deletedAt" IS NULL AND item."purchasePrice" IS NOT NULL
            AND sale."createdAt" >= $1 AND sale."createdAt" < $2
          GROUP BY product.id, product.name, category.name
          ORDER BY SUM(
            item."lineTotal" - CASE
              WHEN sale.subtotal - sale."itemDiscountAmount" > 0
                THEN ROUND(sale."discountAmount" * item."lineTotal" /
                  (sale.subtotal - sale."itemDiscountAmount"), 2)
              ELSE 0
            END - item.quantity * item."purchasePrice"
          ) DESC
          LIMIT 8`,
          [range.from, range.to],
        ),
        this.dataSource.query(
          `SELECT product.id AS "productId", product.name,
            category.name AS category,
            COALESCE(product."measuringUnit", 'units') AS unit,
            SUM(stock."remainingQuantity")::numeric(14,2)::text AS "remainingQuantity",
            SUM(stock."minimumQuantity")::numeric(14,2)::text AS "minimumQuantity"
          FROM "stocks" AS stock
          INNER JOIN "products" AS product ON product.id = stock."productId"
          LEFT JOIN "categories" AS category ON category.id = product."categoryId"
          WHERE stock."deletedAt" IS NULL AND product."deletedAt" IS NULL
            AND product."isActive" = true
          GROUP BY product.id, product.name, category.name, product."measuringUnit"
          HAVING COUNT(stock."minimumQuantity") > 0
            AND SUM(stock."remainingQuantity") <= SUM(stock."minimumQuantity")
          ORDER BY SUM(stock."remainingQuantity") ASC
          LIMIT 10`,
        ),
        this.dataSource.query(
          `WITH item_counts AS (
            SELECT "orderId", COUNT(*)::int AS count
            FROM "order_items"
            GROUP BY "orderId"
          ), payment_totals AS (
            SELECT payment."invoiceId", SUM(payment.amount) AS amount,
              STRING_AGG(DISTINCT UPPER(payment."paymentMethod"), ', ' ORDER BY UPPER(payment."paymentMethod")) AS methods
            FROM "invoice_payments" AS payment
            WHERE payment."deletedAt" IS NULL
            GROUP BY payment."invoiceId"
          )
          SELECT sale.id, sale."saleNumber", invoice."invoiceNumber",
            COALESCE(sale."customerName", 'Walk-in Customer') AS "customerName",
            sale."totalAmount"::text AS "totalAmount",
            COALESCE(item_counts.count, 0) AS "itemCount",
            COALESCE(payment_totals.amount, 0)::numeric(14,2)::text AS "amountPaid",
            COALESCE(payment_totals.methods, 'Unpaid') AS "paymentMethods",
            CASE WHEN invoice.id IS NULL THEN 'NO INVOICE'
              WHEN invoice."totalAmount" <= COALESCE(payment_totals.amount, 0) THEN 'PAID'
              WHEN COALESCE(payment_totals.amount, 0) = 0 THEN 'UNPAID'
              ELSE 'PARTIALLY PAID' END AS "paymentStatus",
            sale."createdAt"
          FROM "orders" AS sale
          LEFT JOIN "invoices" AS invoice
            ON invoice."orderId" = sale.id AND invoice."deletedAt" IS NULL
          LEFT JOIN item_counts ON item_counts."orderId" = sale.id
          LEFT JOIN payment_totals ON payment_totals."invoiceId" = invoice.id
          WHERE sale."deletedAt" IS NULL
            AND sale."createdAt" >= $1 AND sale."createdAt" < $2
          ORDER BY sale."createdAt" DESC
          LIMIT 8`,
          [range.from, range.to],
        ),
      ]);

    const summary = (summaryRows[0] ?? {}) as Record<string, unknown>;
    const paymentMethods = (paymentRows as Array<Record<string, unknown>>).map((row) => ({
      method: String(row.method),
      amount: valueAsText(row.amount),
    }));
    const paymentAmount = (method: string) =>
      paymentMethods.find((payment) => payment.method === method)?.amount ?? '0.00';

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      bucket: range.bucket,
      summary: {
        totalSales: valueAsText(summary.totalSales),
        totalProfit: summary.totalProfit === null ? null : valueAsText(summary.totalProfit),
        totalOrders: valueAsNumber(summary.totalOrders),
        totalCustomers: valueAsNumber(summary.totalCustomers),
        totalCashPayments: paymentAmount('CASH'),
        totalCardPayments: paymentAmount('CARD'),
        receivables: valueAsText((receivableRows[0] as Record<string, unknown> | undefined)?.receivables),
        totalSalesToDate: valueAsText(summary.totalSalesToDate),
        unknownCostItems: valueAsNumber(summary.unknownCostItems),
      },
      salesTrend: (trendRows as Array<Record<string, unknown>>).map((row) => ({
        label: String(row.label),
        sales: valueAsText(row.sales),
      })),
      paymentMethods,
      topProducts: (topProductRows as Array<Record<string, unknown>>).map((row) => ({
        productId: String(row.productId),
        name: String(row.name),
        category: row.category ? String(row.category) : 'Uncategorized',
        quantity: valueAsText(row.quantity),
        revenue: valueAsText(row.revenue),
      })),
      bestProducts: (bestProductRows as Array<Record<string, unknown>>).map((row) => ({
        productId: String(row.productId),
        name: String(row.name),
        category: row.category ? String(row.category) : 'Uncategorized',
        profit: valueAsText(row.profit),
      })),
      lowStockProducts: (lowStockRows as Array<Record<string, unknown>>).map((row) => ({
        productId: String(row.productId),
        name: String(row.name),
        category: row.category ? String(row.category) : 'Uncategorized',
        unit: String(row.unit),
        remainingQuantity: valueAsText(row.remainingQuantity),
        minimumQuantity: valueAsText(row.minimumQuantity),
      })),
      recentSales: (recentRows as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        saleNumber: String(row.saleNumber),
        invoiceNumber: row.invoiceNumber ? String(row.invoiceNumber) : null,
        customerName: String(row.customerName),
        totalAmount: valueAsText(row.totalAmount),
        itemCount: valueAsNumber(row.itemCount),
        amountPaid: valueAsText(row.amountPaid),
        paymentMethods: String(row.paymentMethods),
        paymentStatus: String(row.paymentStatus),
        createdAt: new Date(String(row.createdAt)).toISOString(),
      })),
    };
  }

  private resolveRange(query: DashboardQueryDto): DashboardRange {
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
      throw new BadRequestException('Dashboard date range is invalid');
    }
    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Dashboard date range cannot exceed 366 days');
    }

    const timeZone = query.timeZone ?? 'UTC';
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format(now);
    } catch {
      throw new BadRequestException('Dashboard time zone is invalid');
    }

    return {
      from,
      to,
      timeZone,
      bucket: query.bucket ?? 'day',
    };
  }
}