import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import {
  CloseCashRegisterDto,
  OpenCashRegisterDto,
} from './dto/open-cash-register.dto';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { CreateManualMovementDto } from './dto/manual-movement.dto';

@Controller('cash-register')
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Get('today')
  async getTodayOpenCashRegister() {
    return this.cashRegisterService.getTodayOpenCashRegister();
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Post('open')
  async openCashRegister(
    @ActiveUser() user: UserActiveI,
    @Body() dto: OpenCashRegisterDto,
  ) {
    return this.cashRegisterService.openCashRegister(
      user.userId,
      dto.initialMoney,
    );
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Post(':id/close')
  async closeCashRegister(
    @Param('id') id: string,
    @Body() dto: CloseCashRegisterDto,
  ) {
    return this.cashRegisterService.closeCashRegister(id, dto.finalMoney);
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Get(':id/summary')
  async getDailySummary(@Param('id') id: string) {
    return this.cashRegisterService.getDailySummary(id);
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Get(':id/sales')
  async getTodaySales(@Param('id') id: string) {
    return this.cashRegisterService.getTodaySales(id);
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Post(':id/manual-movement')
  @AuthAndRoleGuard(Role.CAJERO, Role.ADMIN)
  async addManualMovement(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveI,
    @Body() dto: CreateManualMovementDto,
  ) {
    return this.cashRegisterService.addManualMovement(id, user.userId, dto);
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Get(':id/manual-movements')
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  async getTodayManualMovements(@Param('id') id: string) {
    return this.cashRegisterService.getTodayManualMovements(id);
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Get('history')
  async getCashRegisterHistory(@Query('days') days?: string) {
    return this.cashRegisterService.getCashRegisterHistory(
      days ? parseInt(days) : 30,
    );
  }

  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  @Get(':id/details')
  @AuthAndRoleGuard(Role.MOZO, Role.ADMIN, Role.CAJERO)
  async getCashRegisterDetails(@Param('id') id: string) {
    return this.cashRegisterService.getCashRegisterDetails(id);
  }
}
