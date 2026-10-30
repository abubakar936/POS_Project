import { IsOptional, IsString, IsNumberString, IsUUID } from 'class-validator';

export class UpdateStockDto {
  @IsOptional()
  @IsNumberString()
  minimumQuantity?: string | null;

  @IsOptional()
  @IsString()
  locationType?: string;

  @IsOptional()
  @IsString()
  rackLocation?: string | null;

  @IsOptional()
  @IsNumberString()
  printedPrice?: string | null;

  @IsOptional()
  @IsNumberString()
  totalPurchaseValue?: string | null;

  @IsOptional()
  @IsString()
  purchaseDate?: string | null;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string | null;

  @IsOptional()
  @IsUUID()
  companyId?: string | null;
}
