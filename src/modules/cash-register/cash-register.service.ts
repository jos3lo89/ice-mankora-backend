import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreateManualMovementDto } from './dto/manual-movement.dto';

@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayOpenCashRegister() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.cashRegister.findFirst({
      where: {
        status: 'ABIERTA',
        openTime: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
  }

  async openCashRegister(userId: string, initialMoney: number) {
    const existingOpen = await this.getTodayOpenCashRegister();

    if (existingOpen) {
      throw new BadRequestException({
        message: 'Ya existe una caja abierta para hoy',
        cashRegister: existingOpen,
      });
    }

    // Crear nueva caja
    const cashRegister = await this.prisma.cashRegister.create({
      data: {
        userId,
        initialMoney: new Decimal(initialMoney),
        status: 'ABIERTA',
        openTime: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    // Registrar movimiento inicial
    // await this.prisma.cashMovement.create({
    //   data: {
    //     cashRegisterId: cashRegister.id,
    //     amount: new Decimal(initialMoney),
    //     type: 'INGRESO',
    //     description: 'Apertura de caja - Saldo inicial',
    //     isAutomatic: true,
    //   },
    // });

    return cashRegister;
  }

  async closeCashRegister(cashRegisterId: string, finalMoney: number) {
    const cashRegister = await this.prisma.cashRegister.findUnique({
      where: {
        id: cashRegisterId,
      },
      include: {
        movements: true,
      },
    });

    if (!cashRegister) {
      throw new NotFoundException('Caja no encontrada');
    }

    if (cashRegister.status === 'CERRADA') {
      throw new BadRequestException('La caja ya está cerrada');
    }

    // Calcular dinero según el sistema
    const systemMoney = await this.calculateSystemMoney(cashRegisterId);
    const difference = finalMoney - systemMoney;

    // cerrrar caja
    const closedCashRegister = await this.prisma.cashRegister.update({
      where: {
        id: cashRegisterId,
      },
      data: {
        status: 'CERRADA',
        closeTime: new Date(),
        finalMoney: new Decimal(finalMoney),
        systemMoney: new Decimal(systemMoney),
        difference: new Decimal(difference),
      },
      include: {
        user: true,
        movements: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return {
      ...closedCashRegister,
      summary: {
        initialMoney: parseFloat(cashRegister.initialMoney.toString()),
        finalMoney,
        systemMoney,
        difference,
        status:
          difference === 0
            ? 'EXACTO'
            : difference > 0
              ? 'SOBRANTE'
              : 'FALTANTE',
      },
    };
  }

  private async calculateSystemMoney(cashRegisterId: string): Promise<number> {
    const cashRegister = await this.prisma.cashRegister.findUnique({
      where: { id: cashRegisterId },
      include: {
        movements: true,
      },
    });

    if (!cashRegister) {
      throw new NotFoundException('caja no encontrada');
    }

    let total = parseFloat(cashRegister.initialMoney.toString());

    for (const movement of cashRegister.movements) {
      if ((movement.metadata as any)?.isOpeningMovement) {
        continue;
      }

      if ((movement.metadata as any)?.type === 'CANCELACION_PEDIDO') {
        continue;
      }

      const amount = parseFloat(movement.amount.toString());

      if (movement.type === 'INGRESO') {
        total += amount;
      } else if (movement.type === 'EGRESO') {
        total -= amount;
      }
    }

    return total;
  }

  async getTodaySales(cashRegisterId: string) {
    const cashRegister = await this.prisma.cashRegister.findUnique({
      where: {
        id: cashRegisterId,
      },
    });

    if (!cashRegister) {
      throw new NotFoundException('Caja no encontrada');
    }

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: cashRegister.openTime,
        },
      },
      include: {
        client: true,
        user: {
          select: {
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalSales = sales.reduce(
      (acc, sale) => acc + parseFloat(sale.precioVentaTotal.toString()),
      0,
    );

    return {
      sales,
      count: sales.length,
      total: totalSales,
    };
  }

  async getDailySummary(cashRegisterId: string) {
    const cashRegister = await this.prisma.cashRegister.findUnique({
      where: { id: cashRegisterId },
      include: {
        user: true,
        movements: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!cashRegister) {
      throw new NotFoundException('Caja no encontrada');
    }

    const sales = await this.getTodaySales(cashRegisterId);

    const movements = {
      ventas: cashRegister.movements
        .filter(
          (m) =>
            m.type === 'INGRESO' &&
            m.isAutomatic &&
            !(m.metadata as any)?.isOpeningMovement &&
            (m.metadata as any)?.type !== 'CANCELACION_PEDIDO',
        )
        .reduce((acc, m) => acc + parseFloat(m.amount.toString()), 0),
      ingresos: cashRegister.movements
        .filter(
          (m) =>
            m.type === 'INGRESO' &&
            !m.isAutomatic &&
            (m.metadata as any)?.type !== 'CANCELACION_PEDIDO',
        )
        .reduce((acc, m) => acc + parseFloat(m.amount.toString()), 0),
      egresos: cashRegister.movements
        .filter(
          (m) =>
            m.type === 'EGRESO' &&
            (m.metadata as any)?.type !== 'CANCELACION_PEDIDO',
        )
        .reduce((acc, m) => acc + parseFloat(m.amount.toString()), 0),
    };

    const systemMoney = await this.calculateSystemMoney(cashRegisterId);

    return {
      cashRegister: {
        ...cashRegister,
        initialMoney: parseFloat(cashRegister.initialMoney.toString()),
        finalMoney: cashRegister.finalMoney
          ? parseFloat(cashRegister.finalMoney.toString())
          : null,
        systemMoney: cashRegister.systemMoney
          ? parseFloat(cashRegister.systemMoney.toString())
          : null,
        difference: cashRegister.difference
          ? parseFloat(cashRegister.difference.toString())
          : null,
      },
      sales,
      movements,
      systemMoney,
      isOpen: cashRegister.status === 'ABIERTA',
      breakdown: {
        inicial: parseFloat(cashRegister.initialMoney.toString()),
        ventas: movements.ventas,
        ingresosExtra: movements.ingresos,
        egresos: movements.egresos,
        esperado: systemMoney,
      },
    };
  }

  async getCashRegisterHistory(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const cashRegisters = await this.prisma.cashRegister.findMany({
      where: {
        openTime: {
          gte: startDate,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            username: true,
          },
        },
        _count: {
          select: {
            movements: true,
          },
        },
      },
      orderBy: {
        openTime: 'desc',
      },
    });

    return cashRegisters.map((cr) => ({
      ...cr,
      initialMoney: parseFloat(cr.initialMoney.toString()),
      finalMoney: cr.finalMoney ? parseFloat(cr.finalMoney.toString()) : null,
      systemMoney: cr.systemMoney
        ? parseFloat(cr.systemMoney.toString())
        : null,
      difference: cr.difference ? parseFloat(cr.difference.toString()) : null,
    }));
  }

  async addManualMovement(
    cashRegisterId: string,
    userId: string,
    dto: CreateManualMovementDto,
  ) {
    // Validar que la caja existe y está abierta
    const cashRegister = await this.prisma.cashRegister.findUnique({
      where: { id: cashRegisterId },
      include: {
        user: {
          select: {
            name: true,
            username: true,
          },
        },
      },
    });

    if (!cashRegister) {
      throw new NotFoundException('Caja no encontrada');
    }

    if (cashRegister.status === 'CERRADA') {
      throw new BadRequestException(
        'No se pueden agregar movimientos a una caja cerrada',
      );
    }

    // Obtener usuario que registra el movimiento
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        username: true,
      },
    });

    if (!user) {
      throw new NotFoundException('usuario no encontrado');
    }

    // Crear el movimiento
    const movement = await this.prisma.cashMovement.create({
      data: {
        cashRegisterId,
        amount: new Decimal(dto.amount),
        type: dto.type,
        description: dto.description,
        isAutomatic: false,
        metadata: {
          registeredBy: {
            id: userId,
            name: user.name,
            username: user.username,
          },
          registeredAt: new Date().toISOString(),
          movementType: 'MANUAL',
        },
      },
    });

    // Calcular nuevo balance
    const systemMoney = await this.calculateSystemMoney(cashRegisterId);

    return {
      movement: {
        ...movement,
        amount: parseFloat(movement.amount.toString()),
      },
      currentBalance: systemMoney,
      cashRegister: {
        id: cashRegister.id,
        initialMoney: parseFloat(cashRegister.initialMoney.toString()),
        currentMoney: systemMoney,
      },
    };
  }
  async getTodayManualMovements(cashRegisterId: string) {
    const movements = await this.prisma.cashMovement.findMany({
      where: {
        cashRegisterId,
        isAutomatic: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totals = {
      ingresos: movements
        .filter((m) => m.type === 'INGRESO')
        .reduce((acc, m) => acc + parseFloat(m.amount.toString()), 0),
      egresos: movements
        .filter((m) => m.type === 'EGRESO')
        .reduce((acc, m) => acc + parseFloat(m.amount.toString()), 0),
    };

    return {
      movements: movements.map((m) => ({
        ...m,
        amount: parseFloat(m.amount.toString()),
      })),
      totals,
      count: movements.length,
    };
  }

  async getCashRegisterDetails(cashRegisterId: string) {
    const cashRegister = await this.prisma.cashRegister.findUnique({
      where: { id: cashRegisterId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
        movements: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!cashRegister) {
      throw new NotFoundException('Caja no encontrada');
    }

    // Obtener todas las ventas del período
    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: cashRegister.openTime,
          ...(cashRegister.closeTime && { lte: cashRegister.closeTime }),
        },
      },
      include: {
        user: {
          select: {
            name: true,
            username: true,
          },
        },
        client: {
          select: {
            name: true,
            docNumber: true,
          },
        },
        order: {
          select: {
            dailyNumber: true,
            table: {
              select: {
                name: true,
                number: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // // Separar movimientos por tipo
    // const ventasAutomaticas = cashRegister.movements.filter(
    //   (m) =>
    //     m.type === 'INGRESO' &&
    //     m.isAutomatic &&
    //     !(m.metadata as any)?.isOpeningMovement,
    // );

    // const ingresosExtras = cashRegister.movements.filter(
    //   (m) => m.type === 'INGRESO' && !m.isAutomatic,
    // );

    // const egresos = cashRegister.movements.filter((m) => m.type === 'EGRESO');

    // Separar movimientos por tipo
    const ventasAutomaticas = cashRegister.movements.filter(
      (m) =>
        m.type === 'INGRESO' &&
        m.isAutomatic &&
        !(m.metadata as any)?.isOpeningMovement &&
        (m.metadata as any)?.type !== 'CANCELACION_PEDIDO',
    );

    const ingresosExtras = cashRegister.movements.filter(
      (m) => m.type === 'INGRESO' && !m.isAutomatic,
    );

    const egresos = cashRegister.movements.filter(
      (m) =>
        m.type === 'EGRESO' &&
        (m.metadata as any)?.type !== 'CANCELACION_PEDIDO',
    );

    const cancelaciones = cashRegister.movements.filter(
      (m) => (m.metadata as any)?.type === 'CANCELACION_PEDIDO',
    );

    // Calcular totales
    const totales = {
      inicial: parseFloat(cashRegister.initialMoney.toString()),
      ventas: ventasAutomaticas.reduce(
        (acc, m) => acc + parseFloat(m.amount.toString()),
        0,
      ),
      ingresosExtras: ingresosExtras.reduce(
        (acc, m) => acc + parseFloat(m.amount.toString()),
        0,
      ),
      egresos: egresos.reduce(
        (acc, m) => acc + parseFloat(m.amount.toString()),
        0,
      ),
    };

    const systemMoney =
      totales.inicial +
      totales.ventas +
      totales.ingresosExtras -
      totales.egresos;

    // Agrupar ventas por método de pago
    const ventasPorMetodo = sales.reduce(
      (acc, sale) => {
        const method = sale.paymentMethod;
        if (!acc[method]) {
          acc[method] = {
            count: 0,
            total: 0,
            sales: [],
          };
        }
        acc[method].count++;
        acc[method].total += parseFloat(sale.precioVentaTotal.toString());
        acc[method].sales.push({
          id: sale.id,
          numeroComprobante: sale.numeroComprobante,
          total: parseFloat(sale.precioVentaTotal.toString()),
          createdAt: sale.createdAt,
        });
        return acc;
      },
      {} as Record<string, any>,
    );

    // Agrupar ventas por tipo de comprobante
    const ventasPorTipo = sales.reduce(
      (acc, sale) => {
        const type = sale.type;
        if (!acc[type]) {
          acc[type] = { count: 0, total: 0 };
        }
        acc[type].count++;
        acc[type].total += parseFloat(sale.precioVentaTotal.toString());
        return acc;
      },
      {} as Record<string, any>,
    );

    // Calcular duración
    const duracion = cashRegister.closeTime
      ? Math.floor(
          (new Date(cashRegister.closeTime).getTime() -
            new Date(cashRegister.openTime).getTime()) /
            (1000 * 60 * 60),
        )
      : Math.floor(
          (new Date().getTime() - new Date(cashRegister.openTime).getTime()) /
            (1000 * 60 * 60),
        );

    return {
      cashRegister: {
        ...cashRegister,
        initialMoney: totales.inicial,
        finalMoney: cashRegister.finalMoney
          ? parseFloat(cashRegister.finalMoney.toString())
          : null,
        systemMoney: cashRegister.systemMoney
          ? parseFloat(cashRegister.systemMoney.toString())
          : systemMoney,
        difference: cashRegister.difference
          ? parseFloat(cashRegister.difference.toString())
          : null,
        duracionHoras: duracion,
      },
      totales: {
        ...totales,
        esperado: systemMoney,
        contado: cashRegister.finalMoney
          ? parseFloat(cashRegister.finalMoney.toString())
          : null,
        diferencia: cashRegister.difference
          ? parseFloat(cashRegister.difference.toString())
          : null,
      },
      ventas: {
        total: sales.length,
        monto: sales.reduce(
          (acc, s) => acc + parseFloat(s.precioVentaTotal.toString()),
          0,
        ),
        porMetodo: ventasPorMetodo,
        porTipo: ventasPorTipo,
        listado: sales.map((s) => ({
          id: s.id,
          numeroComprobante: s.numeroComprobante,
          type: s.type,
          paymentMethod: s.paymentMethod,
          total: parseFloat(s.precioVentaTotal.toString()),
          igv: parseFloat(s.igv.toString()),
          valorVenta: parseFloat(s.valorVenta.toString()),
          cliente: s.client?.name || 'CLIENTE VARIOS',
          clienteDoc: s.client?.docNumber || '-',
          cajero: s.user.name,
          mesa: s.order?.table.name || '-',
          ordenNumero: s.order?.dailyNumber || null,
          createdAt: s.createdAt,
          metadata: s.metadata,
        })),
      },
      movimientos: {
        ventasAutomaticas: ventasAutomaticas.map((m) => ({
          ...m,
          amount: parseFloat(m.amount.toString()),
        })),
        ingresosExtras: ingresosExtras.map((m) => ({
          ...m,
          amount: parseFloat(m.amount.toString()),
        })),
        egresos: egresos.map((m) => ({
          ...m,
          amount: parseFloat(m.amount.toString()),
        })),
        cancelaciones: cancelaciones.map((m) => {
          const metadata = m.metadata as any;
          return {
            id: m.id,
            orderId: metadata.orderId,
            orderNumber: metadata.orderNumber,
            tableName: metadata.tableName,
            tableNumber: metadata.tableNumber,
            reason: metadata.reason,
            authorizedBy: metadata.authorizedByName,
            itemsCount: metadata.itemsCount,
            items: metadata.items,
            totalPedido: metadata.totalPedido,
            cancelledAt: metadata.cancelledAt,
            createdAt: m.createdAt,
          };
        }),
      },
      estadisticas: {
        ventaPromedio:
          sales.length > 0
            ? sales.reduce(
                (acc, s) => acc + parseFloat(s.precioVentaTotal.toString()),
                0,
              ) / sales.length
            : 0,
        ventaMasAlta:
          sales.length > 0
            ? Math.max(
                ...sales.map((s) => parseFloat(s.precioVentaTotal.toString())),
              )
            : 0,
        ventaMasBaja:
          sales.length > 0
            ? Math.min(
                ...sales.map((s) => parseFloat(s.precioVentaTotal.toString())),
              )
            : 0,
        totalCancelaciones: cancelaciones.length,
        montoCancelado: cancelaciones.reduce(
          (acc, m) => acc + parseFloat(m.amount.toString()),
          0,
        ),
      },
    };
  }
}
