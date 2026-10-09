import { IsNumberString, IsOptional, IsUUID, Matches } from 'class-validator';

const QUANTITY_2_PLACES = /^\d{1,10}(?:\.\d{1,2})?$/;
const MONEY_2_PLACES = /^\d{1,12}(?:\.\d{1,2})?$/;

export class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  stockId: string;

  @IsNumberString()
  @Matches(QUANTITY_2_PLACES)
  quantity: string;

  @IsOptional()
  @IsNumberString()
  @Matches(MONEY_2_PLACES)
  discountAmount?: string;
}
