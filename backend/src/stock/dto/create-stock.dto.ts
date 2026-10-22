import {
  IsUUID,
  IsString,
  IsOptional,
  IsNumberString,
  IsNotEmpty,
  Matches,
} from 'class-validator';

const POSITIVE_INTEGER_QUANTITY = /^(?=.*[1-9])\d{1,10}$/;
const STOCK_MONEY_2_PLACES = /^\d{1,10}(?:\.\d{1,2})?$/;
const PURCHASE_VALUE_2_PLACES = /^\d{1,12}(?:\.\d{1,2})?$/;

export class CreateStockDto {
  @IsUUID()
  productId: string;

  @IsNotEmpty()
  @IsNumberString()
  @Matches(POSITIVE_INTEGER_QUANTITY)
  quantity: string;

  @IsOptional()
  @IsNumberString()
  @Matches(STOCK_MONEY_2_PLACES)
  minimumQuantity?: string;

  @IsOptional()
  @IsString()
  locationType?: string;

  @IsOptional()
  @IsString()
  rackLocation?: string;

  @IsNotEmpty()
  @IsNumberString()
  @Matches(STOCK_MONEY_2_PLACES)
  purchasePrice: string;

  @IsNotEmpty()
  @IsNumberString()
  @Matches(STOCK_MONEY_2_PLACES)
  salePrice: string;

  @IsOptional()
  @IsNumberString()
  @Matches(STOCK_MONEY_2_PLACES)
  printedPrice?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(PURCHASE_VALUE_2_PLACES)
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
