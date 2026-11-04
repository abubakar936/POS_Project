import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['hour', 'day', 'week', 'month'])
  bucket?: 'hour' | 'day' | 'week' | 'month';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timeZone?: string;
}