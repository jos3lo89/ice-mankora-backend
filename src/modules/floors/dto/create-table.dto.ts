import { Transform } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsUUID,
  Min,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreateTableDto {
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'El número de mesa debe ser un número válido.' })
  @Min(1, { message: 'El número de mesa debe ser mínimo 1.' })
  number: number;

  @IsString({ message: 'El nombre de la mesa es obligatorio.' })
  @IsNotEmpty({ message: 'El nombre de la mesa no puede estar vacío.' })
  @MaxLength(50, {
    message: 'El nombre de la mesa no puede exceder 50 caracteres.',
  })
  name: string;

  @IsUUID('4', {
    message: 'El ID del piso debe ser un UUID válido.',
  })
  floorId: string;

  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'La posición X debe ser un número.' })
  posX: number;

  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'La posición Y debe ser un número.' })
  posY: number;
}
