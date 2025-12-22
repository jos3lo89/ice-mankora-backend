import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';

export class CashRegisterGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user.id;

    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);

    tomorrow.setDate(tomorrow.getDate() + 1);

    const openCashRegister = await this.prisma.cashRegister.findFirst({
      where: {
        status: 'ABIERTA',
        openTime: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (!openCashRegister) {
      throw new ForbiddenException({
        message:
          'No hay caja abierta. Debe abrir la caja para realizar operaciones.',
        code: 'CASH_REGISTER_CLOSED',
      });
    }

    request['cashRegister'] = openCashRegister;

    return true;
  }
}
