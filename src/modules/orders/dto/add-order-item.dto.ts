import { Transform } from 'class-transformer';
import {
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class AddOrderItemDto {
  @IsUUID()
  @IsNotEmpty({ message: 'El producto es obligatorio.' })
  productId: string;

  @Transform(({ value }) => parseInt(value))
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad mínima es 1.' })
  quantity: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto.' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'Los detalles de variantes deben ser un texto.' })
  variantsDetail?: string;
}
