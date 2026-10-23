import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppDataSource } from '../database/data-source';
import { Category } from '../categories/category.entity';
import { SubCategory } from '../sub-categories/sub-category.entity';
import { Product } from '../products/product.entity';

const DEFAULT_CSV = 'imports/alfatah_lahore_products.csv';
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

interface CliOptions {
  file: string;
  apply: boolean;
  approvedCategoriesFile?: string;
}

interface CsvProductRow {
  rowNumber: number;
  name: string;
  categoryName: string | null;
  subcategoryName: string | null;
  imageUrl: string | null;
  errors: string[];
}

interface ImportSummary {
  mode: 'dry-run' | 'apply';
  rowsRead: number;
  insertedProducts: number;
  wouldInsertProducts: number;
  existingProductsSkipped: number;
  categoriesCreated: number;
  subcategoriesCreated: number;
  invalidRows: number;
  errors: string[];
  categories: Array<{ name: string; rows: number; databaseStatus: string }>;
}

function parseArguments(args: string[]): CliOptions {
  let file = DEFAULT_CSV;
  let apply = false;
  let approvedCategoriesFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--file') {
      const value = args[++index];
      if (!value) throw new Error('--file requires a path');
      file = value;
    } else if (argument === '--apply') {
      apply = true;
    } else if (argument === '--dry-run') {
      apply = false;
    } else if (argument === '--approved-categories-file') {
      const value = args[++index];
      if (!value) throw new Error('--approved-categories-file requires a path');
      approvedCategoriesFile = value;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return { file, apply, approvedCategoriesFile };
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? '';
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (character === '\r' && input[index + 1] === '\n') index += 1;
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function safeImageUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  if (candidate.length > 2048) throw new Error('Image URL is longer than 2048 characters');

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Image URL is not a valid absolute URL');
  }
  const host = url.hostname.toLocaleLowerCase();
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('Image URL must be a public HTTP or HTTPS address');
  }
  return url.toString();
}

function readRows(input: string): CsvProductRow[] {
  const records = parseCsv(input.replace(/^\uFEFF/, ''));
  if (!records.length) throw new Error('CSV is empty');
  const headers = (records[0] ?? []).map((header) => header.trim().toLocaleLowerCase());
  if (new Set(headers).size !== headers.length) {
    throw new Error('CSV contains duplicate column names');
  }
  const requiredHeaders = ['product_name', 'category', 'subcategory', 'image_url'];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`CSV is missing required columns: ${missingHeaders.join(', ')}`);
  }
  const columnIndex = new Map(headers.map((header, index) => [header, index]));
  const valueAt = (record: string[], header: string) =>
    record[columnIndex.get(header) ?? -1] ?? '';

  return records.slice(1).flatMap((record, index) => {
    if (record.every((value) => !value.trim())) return [];
    const rawName = valueAt(record, 'product_name');
    const category = valueAt(record, 'category').trim();
    const subcategory = valueAt(record, 'subcategory').trim();
    const rawImageUrl = valueAt(record, 'image_url');
    const errors: string[] = [];

    if (record.length !== headers.length) {
      errors.push(`Expected ${headers.length} columns but found ${record.length}`);
    }
    if (!rawName.trim()) errors.push('Product name is blank');
    if (rawName.length > 255) errors.push('Product name exceeds 255 characters');
    if (CONTROL_CHARACTERS.test(rawName)) errors.push('Product name contains unsupported control characters');
    if (category.length > 255) errors.push('Category exceeds 255 characters');
    if (subcategory.length > 255) errors.push('Subcategory exceeds 255 characters');
    if (CONTROL_CHARACTERS.test(category) || CONTROL_CHARACTERS.test(subcategory)) {
      errors.push('Category or subcategory contains unsupported control characters');
    }
    let imageUrl: string | null = null;
    try {
      imageUrl = safeImageUrl(rawImageUrl);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Image URL is invalid');
    }

    return [{
      rowNumber: index + 2,
      name: rawName,
      categoryName: category || null,
      subcategoryName: subcategory || null,
      imageUrl,
      errors,
    }];
  });
}

function key(value: string): string {
  return value.toLocaleLowerCase();
}

async function readApprovedCategories(path: string): Promise<Set<string>> {
  const contents = await readFile(resolve(path), 'utf8');
  const names = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (names.some((name) => name.length > 255 || CONTROL_CHARACTERS.test(name))) {
    throw new Error('Approved category names must be at most 255 characters and contain no control characters');
  }
  return new Set(names.map(key));
}

function productKey(name: string): string {
  return key(name);
}

async function run(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const csvPath = resolve(options.file);
  const csvText = await readFile(csvPath, 'utf8');
  const rows = readRows(csvText);
  const summary: ImportSummary = {
    mode: options.apply ? 'apply' : 'dry-run',
    rowsRead: rows.length,
    insertedProducts: 0,
    wouldInsertProducts: 0,
    existingProductsSkipped: 0,
    categoriesCreated: 0,
    subcategoriesCreated: 0,
    invalidRows: 0,
    errors: [],
    categories: [],
  };

  await AppDataSource.initialize();
  try {
    const categoryRepo = AppDataSource.getRepository(Category);
    const subcategoryRepo = AppDataSource.getRepository(SubCategory);
    const productRepo = AppDataSource.getRepository(Product);
    const [categories, subcategories, products] = await Promise.all([
      categoryRepo.find({ withDeleted: true }),
      subcategoryRepo.find({ withDeleted: true }),
      productRepo.find({
        withDeleted: true,
        select: { id: true, name: true, categoryId: true },
      }),
    ]);
    const categoryByName = new Map(categories.map((category) => [key(category.name), category]));
    const categoryNameById = new Map(categories.map((category) => [category.id, key(category.name)]));
    const categoriesInCsv = new Map<string, { name: string; rows: number }>();
    for (const row of rows) {
      if (!row.categoryName) continue;
      const categoryKey = key(row.categoryName);
      const entry = categoriesInCsv.get(categoryKey);
      categoriesInCsv.set(categoryKey, {
        name: entry?.name ?? row.categoryName,
        rows: (entry?.rows ?? 0) + 1,
      });
    }
    summary.categories = [...categoriesInCsv.entries()].map(([categoryKey, entry]) => {
      const category = categoryByName.get(categoryKey);
      return {
        name: entry.name,
        rows: entry.rows,
        databaseStatus: !category
          ? 'missing; would be created'
          : category.deletedAt || !category.isActive
            ? 'inactive/deleted; rows will be rejected'
            : 'existing; will be reused',
      };
    });

    const approved = options.approvedCategoriesFile
      ? await readApprovedCategories(options.approvedCategoriesFile)
      : null;
    const unapprovedCategories = approved
      ? [...categoriesInCsv.values()]
        .filter((entry) => !approved.has(key(entry.name)))
        .map((entry) => entry.name)
      : [];
    if (options.apply && unapprovedCategories.length) {
      summary.errors.push(
        `No changes made. Review and approve these CSV category values: ${unapprovedCategories.join(', ')}`,
      );
      printSummary(summary);
      throw new Error('One or more CSV categories are not explicitly approved');
    }

    const existingProductKeys = new Set(
      products.map((product) =>
        productKey(product.name),
      ),
    );
    const seenProductKeys = new Set<string>();
    const categoriesToCreate = new Set<string>();
    const subcategoriesToCreate = new Map<string, { name: string; categoryName: string }>();
    const validProducts: CsvProductRow[] = [];

    for (const row of rows) {
      const rowErrors = [...row.errors];
      const category = row.categoryName ? categoryByName.get(key(row.categoryName)) : undefined;
      if (row.categoryName && approved && !approved.has(key(row.categoryName))) {
        rowErrors.push('Category was not approved');
      }
      if (category && (category.deletedAt || !category.isActive)) {
        rowErrors.push('Category is inactive or deleted');
      }
      if (row.subcategoryName && !row.categoryName) {
        rowErrors.push('Subcategory cannot be linked without a category');
      }
      const resolvedCategoryName = category?.name ?? row.categoryName;
      if (row.subcategoryName && resolvedCategoryName) {
        const subcategory = subcategories.find(
          (item) =>
            item.categoryId === category?.id &&
            key(item.name) === key(row.subcategoryName ?? ''),
        );
        if (subcategory && (subcategory.deletedAt || !subcategory.isActive)) {
          rowErrors.push('Subcategory is inactive or deleted');
        }
      }
      if (rowErrors.length) {
        summary.invalidRows += 1;
        summary.errors.push(`CSV row ${row.rowNumber}: ${rowErrors.join('; ')}`);
        continue;
      }

      const candidateKey = productKey(row.name);
      if (existingProductKeys.has(candidateKey) || seenProductKeys.has(candidateKey)) {
        summary.existingProductsSkipped += 1;
        continue;
      }
      seenProductKeys.add(candidateKey);
      validProducts.push(row);

      if (row.categoryName && !category) categoriesToCreate.add(key(row.categoryName));
      if (row.subcategoryName && resolvedCategoryName) {
        const exists = subcategories.some(
          (item) =>
            item.categoryId === category?.id &&
            key(item.name) === key(row.subcategoryName ?? ''),
        );
        if (!exists) {
          const subcategoryKey = `${key(resolvedCategoryName)}\u0000${key(row.subcategoryName)}`;
          subcategoriesToCreate.set(subcategoryKey, {
            name: row.subcategoryName,
            categoryName: resolvedCategoryName,
          });
        }
      }
    }

    summary.wouldInsertProducts = validProducts.length;
    summary.categoriesCreated = categoriesToCreate.size;
    summary.subcategoriesCreated = subcategoriesToCreate.size;
    if (!options.apply) {
      printSummary(summary);
      return;
    }

    await AppDataSource.transaction(async (manager) => {
      const txCategoryRepo = manager.getRepository(Category);
      const txSubcategoryRepo = manager.getRepository(SubCategory);
      const txProductRepo = manager.getRepository(Product);
      const categoryIds = new Map(
        categories.map((category) => [key(category.name), category.id]),
      );
      for (const categoryKey of categoriesToCreate) {
        const name = categoriesInCsv.get(categoryKey)?.name;
        if (!name) throw new Error(`Missing category label for ${categoryKey}`);
        const created = await txCategoryRepo.save(
          txCategoryRepo.create({ name, isActive: true }),
        );
        categoryIds.set(categoryKey, created.id);
      }
      const subcategoryIds = new Map(
        subcategories.map((subcategory) => [
          `${categoryNameById.get(subcategory.categoryId) ?? ''}\u0000${key(subcategory.name)}`,
          subcategory.id,
        ]),
      );
      for (const [subcategoryKey, entry] of subcategoriesToCreate) {
        const categoryId = categoryIds.get(key(entry.categoryName));
        if (!categoryId) throw new Error(`Category "${entry.categoryName}" was not resolved`);
        const created = await txSubcategoryRepo.save(
          txSubcategoryRepo.create({
            name: entry.name,
            categoryId,
            isActive: true,
          }),
        );
        subcategoryIds.set(subcategoryKey, created.id);
      }

      for (const row of validProducts) {
        const categoryId = row.categoryName ? categoryIds.get(key(row.categoryName)) : null;
        const categoryName = row.categoryName
          ? categoriesInCsv.get(key(row.categoryName))?.name ?? row.categoryName
          : null;
        const subcategoryId =
          row.subcategoryName && categoryName
            ? subcategoryIds.get(`${key(categoryName)}\u0000${key(row.subcategoryName)}`) ?? null
            : null;
        await txProductRepo.save(
          txProductRepo.create({
            name: row.name,
            categoryId: categoryId ?? null,
            subCategoryId: subcategoryId,
            imageUrl: row.imageUrl,
          }),
        );
        summary.insertedProducts += 1;
      }
    });
    printSummary(summary);
  } finally {
    await AppDataSource.destroy();
  }
}

function printSummary(summary: ImportSummary): void {
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Catalog import failed');
  process.exitCode = 1;
});
