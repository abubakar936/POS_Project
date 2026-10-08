import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
