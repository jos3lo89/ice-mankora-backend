import { IsEnum } from 'class-validator';
import { OrderStatus } from 'src/generated/prisma/enums';

export class UpdateOrderItemStatusDto {
  @IsEnum(OrderStatus, {
    message: 'Estado inválido. Debe ser PENDIENTE, PREPARADO o ENTREGADO.',
  })
  status: OrderStatus;
}
