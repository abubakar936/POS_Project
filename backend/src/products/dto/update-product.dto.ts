import { IsOptional, IsString, IsUUID, IsBoolean, IsInt, IsNumberString } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subCategoryId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsString()
  measuringUnit?: string;

  @IsOptional()
  @IsString()
  packSize?: string;

  @IsOptional()
  @IsInt()
  pcsPerCarton?: number;

  @IsOptional()
  @IsNumberString()
  retailPrice?: string;

  @IsOptional()
  @IsNumberString()
  salePrice?: string;

  @IsOptional()
  @IsNumberString()
  purchasePrice?: string;

  @IsOptional()
  @IsBoolean()
  isPricePrinted?: boolean;

  @IsOptional()
  @IsNumberString()
  printedPrice?: string;

  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;


  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
