import { IsUUID, IsString, IsOptional, IsNumberString, IsNotEmpty } from 'class-validator';

export class CreateStockDto {
  @IsUUID()
  productId: string;

  @IsNotEmpty()
  @IsNumberString()
  quantity: string;

  @IsOptional()
  @IsNumberString()
  remainingQuantity?: string;

  @IsOptional()
  @IsNumberString()
  minimumQuantity?: string;

  @IsString()
  locationType: string;

  @IsOptional()
  @IsString()
  rackLocation?: string;

  @IsNotEmpty()
  @IsNumberString()
  purchasePrice: string;

  @IsNotEmpty()
  @IsNumberString()
  salePrice: string;

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
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
