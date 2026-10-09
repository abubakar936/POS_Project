import { IsNumberString, Matches } from 'class-validator';

const STOCK_MONEY_2_PLACES = /^\d{1,10}(?:\.\d{1,2})?$/;

export class UpdateStockSalePriceDto {
  @IsNumberString()
  @Matches(STOCK_MONEY_2_PLACES)
  salePrice: string;
}
