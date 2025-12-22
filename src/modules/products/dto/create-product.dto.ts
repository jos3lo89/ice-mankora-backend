import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  price: number;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsBoolean()
  isStockManaged?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stockDaily?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stockWarehouse?: number;

  @IsOptional()
  @IsString()
  taxType?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  igvRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
