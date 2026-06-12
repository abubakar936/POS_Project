import { IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

export class UpdateSubCategoryDto {
	@IsOptional()
	@IsString()
	name?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsUUID()
	categoryId?: string;

	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}
