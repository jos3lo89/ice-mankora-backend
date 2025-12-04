import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  @Post()
  create(@ActiveUser() user: UserActiveI, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto, user);
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  @Get('mine')
  findMyOrders(@ActiveUser() user: UserActiveI) {
    return this.ordersService.findMyOrders(user);
  }

  // @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  // @Patch(':orderId/items')
  // addItems(
  //   @Param('orderId') orderId: string,
  //   @ActiveUser() user: UserActiveI,
  //   @Body() items: AddOrderItemDto[],
  // ) {
  //   return this.ordersService.addItems(orderId, user, items);
  // }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  @Patch(':orderId/cancel')
  cancelOrder(
    @Param('orderId') orderId: string,
    @ActiveUser() user: UserActiveI,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(orderId, user, dto);
  }

  @Post(':id/add-items')
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN)
  addItems2(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addItemsDto: AddItemsDto,
    @ActiveUser() user: UserActiveI,
  ) {
    return this.ordersService.addItems2(id, addItemsDto, user);
  }

  @Get('pending')
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO) // Cocina puede usar cuenta de mozo o admin por ahora
  findAllPending(@ActiveUser() user: UserActiveI) {
    return this.ordersService.findAllPending(user);
  }

  @Get(':id')
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
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
    return this.ordersService.requestPreAccount(id);
  }
}
