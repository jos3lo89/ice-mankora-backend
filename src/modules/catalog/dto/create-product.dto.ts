import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductVariantDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  priceExtra: number;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  categoryId: string;

  @IsBoolean()
  @IsOptional()
  isStockManaged?: boolean;

  @IsNumber()
  @IsOptional()
  stockDaily?: number;

  @IsNumber()
  @IsOptional()
  stockWarehouse?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}
