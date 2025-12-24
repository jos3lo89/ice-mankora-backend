import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // se usa
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  @Post()
  async create(@ActiveUser() user: UserActiveI, @Body() dto: CreateOrderDto) {
    return await this.ordersService.create(dto, user);
  }

  // se usa
  @Post(':id/add-items')
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  addItems2(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addItemsDto: AddItemsDto,
    @ActiveUser() user: UserActiveI,
  ) {
    return this.ordersService.addItems(id, addItemsDto, user);
  }

  @Get('active/:tableId')
  @AuthAndRoleGuard(Role.MOZO, Role.CAJERO, Role.ADMIN)
  findActiveByTable(@Param('tableId', ParseUUIDPipe) tableId: string) {
    return this.ordersService.findActiveOrder(tableId);
  }

  @AuthAndRoleGuard(Role.CAJERO, Role.ADMIN)
  @Patch(':orderId/cancel')
  cancelOrder(
    @Param('orderId') orderId: string,
    @ActiveUser() user: UserActiveI,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(orderId, user, dto);
  }

  @Patch(':id/status')
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @Post(':id/pre-count')
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  requestPreAccount(@Param('id', ParseUUIDPipe) id: string) {
    console.log('id de cancelar ornden: ', id);

    return this.ordersService.requestPreAccount(id);
  }
}
