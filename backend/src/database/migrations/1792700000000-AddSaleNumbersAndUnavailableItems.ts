import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleNumbersAndUnavailableItems1792700000000
  implements MigrationInterface
{
  name = 'AddSaleNumbersAndUnavailableItems1792700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SEQUENCE IF NOT EXISTS sale_number_seq');
    await queryRunner.query('CREATE SEQUENCE IF NOT EXISTS invoice_number_seq');
    await queryRunner.query(
      'ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "saleNumber" character varying(20)',
    );
    await queryRunner.query(
      'ALTER TABLE "order_items" ALTER COLUMN "stockId" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "soldUnavailable" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(
      `WITH numbered AS (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS number
        FROM "orders"
        WHERE "saleNumber" IS NULL
      )
      UPDATE "orders" AS target
      SET "saleNumber" = 'SALE-' || TO_CHAR(target."createdAt", 'DDMMYY') || '-' || LPAD(numbered.number::text, 4, '0')
      FROM numbered
      WHERE target."id" = numbered."id"`,
    );
    await queryRunner.query("SELECT setval('sale_number_seq', 1, false)");
    await queryRunner.query(
      'ALTER TABLE "orders" ALTER COLUMN "saleNumber" SET NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_orders_saleNumber" ON "orders" ("saleNumber")',
    );
    await queryRunner.query(
      `WITH numbered AS (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS number
        FROM "invoices"
        WHERE "invoiceNumber" IS NULL OR "invoiceNumber" LIKE 'MIG-%'
      )
      UPDATE "invoices" AS target
      SET "invoiceNumber" = 'INV-' || TO_CHAR(target."createdAt", 'DDMMYY') || '-' || LPAD(numbered.number::text, 4, '0')
      FROM numbered
      WHERE target."id" = numbered."id"`,
    );
    await queryRunner.query("SELECT setval('invoice_number_seq', 1, false)");
  }

  async down(): Promise<void> {
    throw new Error(
      'This sales migration is intentionally irreversible to preserve assigned business numbers and unavailable-sale records.',
    );
  }
}