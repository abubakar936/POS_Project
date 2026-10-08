import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
