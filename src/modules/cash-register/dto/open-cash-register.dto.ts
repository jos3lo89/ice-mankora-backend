import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class OpenCashRegisterDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  initialMoney: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseCashRegisterDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  finalMoney: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
