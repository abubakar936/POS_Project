import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'];
const MONEY_2_PLACES = /^\d{1,12}(?:\.\d{1,2})?$/;

export class CreateInvoicePaymentDto {
  @IsNumberString()
  @Matches(MONEY_2_PLACES)
  amount: string;

  @IsIn(PAYMENT_METHODS)
  paymentMethod: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
