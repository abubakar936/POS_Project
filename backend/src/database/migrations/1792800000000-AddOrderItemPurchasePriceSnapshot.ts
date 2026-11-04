import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderItemPurchasePriceSnapshot1792800000000
  implements MigrationInterface
{
  name = 'AddOrderItemPurchasePriceSnapshot1792800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "purchasePrice" numeric(12,2)',
    );
    await queryRunner.query(
      `UPDATE "order_items" AS item
      SET "purchasePrice" = COALESCE(
        (SELECT stock."purchasePrice" FROM "stocks" AS stock WHERE stock."id" = item."stockId"),
        (SELECT product."purchasePrice" FROM "products" AS product WHERE product."id" = item."productId")
      )
      WHERE item."purchasePrice" IS NULL`,
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_orders_active_createdAt" ON "orders" ("createdAt") WHERE "deletedAt" IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_order_items_orderId" ON "order_items" ("orderId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_invoice_payments_active_createdAt" ON "invoice_payments" ("createdAt") WHERE "deletedAt" IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_invoice_payments_invoiceId" ON "invoice_payments" ("invoiceId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_stocks_active_productId" ON "stocks" ("productId") WHERE "deletedAt" IS NULL',
    );
  }

  async down(): Promise<void> {
    throw new Error(
      'This cost snapshot migration is intentionally irreversible because historical purchase prices must be preserved.',
    );
  }
}