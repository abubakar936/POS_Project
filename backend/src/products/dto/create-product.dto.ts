import { IsOptional, IsString, IsUUID, IsBoolean, IsInt, IsNumberString, IsUrl, MaxLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  marketName?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

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
  @MaxLength(50)
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
