import type { Product, ProductPayload } from '../../lib/api/products.types';
import { isKnownMeasuringUnit } from '../../lib/api/measurement-units';

export interface ProductFormValues {
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  subCategoryId: string;
  companyId: string;
  vendorId: string;
  measuringUnit: string;
  measuringUnitCustom: boolean;
  packSize: string;
  pcsPerCarton: string;
  retailPrice: string;
  salePrice: string;
  purchasePrice: string;
  isPricePrinted: boolean;
  printedPrice: string;
  hasVariants: boolean;
  description: string;
  isActive: boolean;
}

export const emptyProductFormValues: ProductFormValues = {
  name: '',
  sku: '',
  barcode: '',
  categoryId: '',
  subCategoryId: '',
  companyId: '',
  vendorId: '',
  measuringUnit: '',
  measuringUnitCustom: false,
  packSize: '',
  pcsPerCarton: '',
  retailPrice: '',
  salePrice: '',
  purchasePrice: '',
  isPricePrinted: false,
  printedPrice: '',
  hasVariants: false,
  description: '',
  isActive: true,
};

export function productToFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    categoryId: product.categoryId ?? '',
    subCategoryId: product.subCategoryId ?? '',
    companyId: product.companyId ?? '',
    vendorId: product.vendorId ?? '',
    measuringUnit: product.measuringUnit ?? '',
    measuringUnitCustom:
      Boolean(product.measuringUnit) && !isKnownMeasuringUnit(product.measuringUnit ?? ''),
    packSize: product.packSize ?? '',
    pcsPerCarton: product.pcsPerCarton?.toString() ?? '',
    retailPrice: product.retailPrice ?? '',
    salePrice: product.salePrice ?? '',
    purchasePrice: product.purchasePrice ?? '',
    isPricePrinted: product.isPricePrinted,
    printedPrice: product.printedPrice ?? '',
    hasVariants: product.hasVariants,
    description: product.description ?? '',
    isActive: product.isActive,
  };
}

export function validateProductForm(
  values: ProductFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Product name is required.';
  if (values.name.trim().length > 255) {
    errors.name = 'Product name must be 255 characters or fewer.';
  }
  if (values.sku.trim().length > 100) errors.sku = 'SKU must be 100 characters or fewer.';
  if (values.barcode.trim().length > 100) {
    errors.barcode = 'Barcode must be 100 characters or fewer.';
  }
  if (values.measuringUnitCustom && !values.measuringUnit.trim()) {
    errors.measuringUnit = 'Enter a custom measuring unit.';
  } else if (values.measuringUnit.trim().length > 50) {
    errors.measuringUnit = 'Measuring unit must be 50 characters or fewer.';
  }
  if (values.packSize.trim().length > 100) {
    errors.packSize = 'Pack size must be 100 characters or fewer.';
  }

  for (const field of ['retailPrice', 'salePrice', 'purchasePrice', 'printedPrice'] as const) {
    const value = values[field].trim();
    if (value && !/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) {
      errors[field] = 'Enter an amount with up to 10 whole digits and 2 decimal places.';
    }
  }
  if (values.pcsPerCarton && (
    !/^\d+$/.test(values.pcsPerCarton) ||
    Number(values.pcsPerCarton) < 1 ||
    Number(values.pcsPerCarton) > 2147483647
  )) {
    errors.pcsPerCarton = 'Enter a whole number from 1 to 2,147,483,647.';
  }
  if (values.isPricePrinted && !values.printedPrice.trim()) {
    errors.printedPrice = 'Enter the printed price for this product.';
  }
  if (values.subCategoryId && !values.categoryId) {
    errors.subCategoryId = 'Select a category before selecting a subcategory.';
  }
  return errors;
}

export function productFormToPayload(
  values: ProductFormValues,
): ProductPayload {
  const payload: ProductPayload = { name: values.name.trim() };
  setOptional(payload, 'sku', values.sku.trim());
  setOptional(payload, 'barcode', values.barcode.trim());
  setOptional(payload, 'measuringUnit', values.measuringUnit.trim());
  setOptional(payload, 'packSize', values.packSize.trim());
  setOptional(payload, 'description', values.description.trim());
  payload.categoryId = values.categoryId || null;
  payload.subCategoryId = values.subCategoryId || null;
  payload.companyId = values.companyId || null;
  payload.vendorId = values.vendorId || null;
  payload.isPricePrinted = values.isPricePrinted;
  payload.hasVariants = values.hasVariants;
  payload.isActive = values.isActive;

  for (const field of ['retailPrice', 'salePrice', 'purchasePrice', 'printedPrice'] as const) {
    const amount = values[field].trim();
    if (amount) payload[field] = amount;
  }
  if (values.pcsPerCarton) {
    payload.pcsPerCarton = Number(values.pcsPerCarton);
  }
  return payload;
}

function setOptional<K extends 'sku' | 'barcode' | 'measuringUnit' | 'packSize' | 'description'>(
  payload: ProductPayload,
  field: K,
  value: string,
) {
  if (value) payload[field] = value;
}
