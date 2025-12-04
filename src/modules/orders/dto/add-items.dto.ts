import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderItemDto } from './create-order.dto';

export class AddItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
