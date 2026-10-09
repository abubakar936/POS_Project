import type { CategoryOption, SubcategoryOption } from './catalog.types';

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  category?: CategoryOption | null;
  subCategoryId?: string | null;
  subCategory?: SubcategoryOption | null;
  companyId?: string | null;
  vendorId?: string | null;
  measuringUnit?: string | null;
  packSize?: string | null;
  pcsPerCarton?: number | null;
  retailPrice?: string | null;
  salePrice?: string | null;
  purchasePrice?: string | null;
  isPricePrinted: boolean;
  printedPrice?: string | null;
  hasVariants: boolean;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProductPayload {
  name: string;
  sku?: string;
  barcode?: string;
  categoryId?: string | null;
  subCategoryId?: string | null;
  companyId?: string | null;
  vendorId?: string | null;
  measuringUnit?: string;
  packSize?: string;
  pcsPerCarton?: number;
  retailPrice?: string;
  salePrice?: string;
  purchasePrice?: string;
  isPricePrinted?: boolean;
  printedPrice?: string;
  hasVariants?: boolean;
  description?: string;
  isActive?: boolean;
}

export interface ProductListQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: 'true' | 'false';
}
