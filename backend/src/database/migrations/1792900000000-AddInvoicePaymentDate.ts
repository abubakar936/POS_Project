import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoicePaymentDate1792900000000 implements MigrationInterface {
  name = 'AddInvoicePaymentDate1792900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "paymentDate" date',
    );
    await queryRunner.query(
      'UPDATE "invoice_payments" SET "paymentDate" = "createdAt"::date WHERE "paymentDate" IS NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice_payments" ALTER COLUMN "paymentDate" SET DEFAULT CURRENT_DATE',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice_payments" ALTER COLUMN "paymentDate" SET NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_invoice_payments_invoiceId" ON "invoice_payments" ("invoiceId")',
    );
  }

  async down(): Promise<void> {
    throw new Error(
      'This payment-date migration is intentionally irreversible to preserve installment history.',
    );
  }
}
