import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateProductStockDto {
  @Transform(({ value }) => parseInt(value))
  @IsInt({ message: 'El stock diario debe ser un número entero.' })
  @Min(0, { message: 'El stock diario no puede ser negativo.' })
  stockDaily: number;
}
