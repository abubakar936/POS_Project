import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCatalogMetadata1792609200000
  implements MigrationInterface
{
  name = 'AddProductCatalogMetadata1792609200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageUrl" character varying(2048)',
    );
    await queryRunner.query(
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imagePath" character varying(1024)',
    );
    await queryRunner.query(
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "nickname" character varying(255)',
    );
    await queryRunner.query(
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "marketName" character varying(255)',
    );
  }

  async down(): Promise<void> {
    throw new Error(
      'This metadata migration is intentionally irreversible to prevent deleting product data.',
    );
  }
}
