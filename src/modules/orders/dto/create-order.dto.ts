// import { IsUUID, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
// import { AddOrderItemDto } from './add-order-item.dto';
// import { Type } from 'class-transformer';

// export class CreateOrderDto {
//   @IsUUID()
//   @IsNotEmpty({ message: 'La mesa es obligatoria.' })
//   tableId: string;

//   @IsArray({ message: 'Debes enviar una lista de items.' })
//   // @ArrayNotEmpty({ message: 'Debe enviar al menos un ítem.' })
//   @ValidateNested({ each: true })
//   @Type(() => AddOrderItemDto) // ¡Vital para que valide cada objeto dentro del array!
//   items: AddOrderItemDto[];
// }

import {
  IsString,
  IsUUID,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string; // "Sin ají", "Bien cocido"

  @IsString()
  @IsOptional()
  variantsDetail?: string; // "Sabor: Fresa, Cono: Waffle"
}

export class CreateOrderDto {
  @IsUUID()
  tableId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
