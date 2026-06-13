import { IsOptional, IsString, IsNumberString, IsUUID } from 'class-validator';

export class UpdateStockDto {
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsNumberString()
  remainingQuantity?: string;

  @IsOptional()
  @IsNumberString()
  minimumQuantity?: string;

  @IsOptional()
  @IsString()
  locationType?: string;

  @IsOptional()
  @IsString()
  rackLocation?: string;

  @IsOptional()
  @IsNumberString()
  purchasePrice?: string;

  @IsOptional()
  @IsNumberString()
  salePrice?: string;

  @IsOptional()
  @IsNumberString()
  printedPrice?: string;

  @IsOptional()
  @IsNumberString()
  totalPurchaseValue?: string;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
