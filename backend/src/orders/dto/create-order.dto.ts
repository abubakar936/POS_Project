import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateInvoicePaymentDto } from '../../invoices/dto/create-invoice-payment.dto';
import { CreateOrderItemDto } from './create-order-item.dto';

const MONEY_2_PLACES = /^\d{1,12}(?:\.\d{1,2})?$/;

export class CreateOrderDto {
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @IsOptional()
  @IsBoolean()
  createInvoice?: boolean;

  @IsOptional()
  @IsBoolean()
  walkInCustomer?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInvoicePaymentDto)
  payment?: CreateInvoicePaymentDto;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(MONEY_2_PLACES)
  discountAmount?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
