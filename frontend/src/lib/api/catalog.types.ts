export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export interface CategoryOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface SubcategoryOption {
  id: string;
  name: string;
  categoryId: string;
  category?: CategoryOption | null;
  isActive: boolean;
}

export interface CompanyOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface VendorOption {
  id: string;
  name: string;
  companyName?: string | null;
  isActive: boolean;
}

export interface StockRecord {
  id: string;
  productId: string;
  quantity: string;
  remainingQuantity: string;
  minimumQuantity?: string | null;
  locationType: string;
  rackLocation?: string | null;
  purchasePrice: string;
  salePrice: string;
  printedPrice?: string | null;
  vendorId?: string | null;
  vendor?: VendorOption | null;
  companyId?: string | null;
  company?: CompanyOption | null;
}
