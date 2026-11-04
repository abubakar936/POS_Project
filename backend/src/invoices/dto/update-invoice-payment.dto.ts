import {
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'];
const MONEY_2_PLACES = /^\d{1,12}(?:\.\d{1,2})?$/;

export class UpdateInvoicePaymentDto {
  @IsOptional()
  @IsNumberString()
  @Matches(MONEY_2_PLACES)
  amount?: string;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  reference?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}