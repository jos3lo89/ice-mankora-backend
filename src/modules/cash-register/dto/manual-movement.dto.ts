import {
  IsNumber,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MovementType {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

export class CreateManualMovementDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsEnum(MovementType)
  type: MovementType;

  @IsString()
  @IsNotEmpty()
  description: string;
}
