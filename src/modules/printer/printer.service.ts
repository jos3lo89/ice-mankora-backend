import { Injectable, Logger } from '@nestjs/common';
import { PrinterGateway } from './printer.gateway';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { PrintStatus } from 'src/generated/prisma/enums';

@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);

  constructor(
    private prisma: PrismaService,
    private printerGateway: PrinterGateway,
  ) {}

  // ✅ CORRECCIÓN: Imprimir TODO el pedido en la impresora del piso
  async printOrderComanda(orderId: string) {
    // Obtener orden con todos sus detalles
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: {
          include: {
            floor: true,
          },
        },
        user: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    const floor = order.table.floor;

    try {
      // Crear log de impresión para el piso
      const printLog = await this.prisma.printLog.create({
        data: {
          orderId: order.id,
          floorId: floor.id,
          status: PrintStatus.PENDING,
          attemptCount: 1,
          lastAttempt: new Date(),
          printerIp: floor.printerIp,
          sentData: {
            dailyNumber: order.dailyNumber,
            tableNumber: order.table.number,
            floorName: floor.name,
            items: order.items.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              notes: item.notes,
              variantsDetail: item.variantsDetail,
              categoryName: item.product.category.name,
            })),
          },
        },
      });

      // Emitir comando de impresión vía WebSocket
      await this.printerGateway.emitPrintComanda({
        printLogId: printLog.id,
        orderId: order.id,
        dailyNumber: order.dailyNumber,
        tableNumber: order.table.number.toString(),
        floorId: floor.id,
        floorName: floor.name,
        floorLevel: floor.level,
        items: order.items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          notes: item.notes,
          variantsDetail: JSON.stringify(item.variantsDetail),
          categoryName: item.product.category.name,
        })),
        waiter: order.user.name,
        timestamp: order.createdAt,
      });

      this.logger.log(
        `Comanda #${order.dailyNumber} enviada a ${floor.name} (${floor.printerIp})`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar comanda para ${floor.name}: ${error.message}`,
      );
    }
  }

  // Método para reintentar impresión fallida
  async retryPrint(printLogId: string) {
    const printLog = await this.prisma.printLog.findUnique({
      where: { id: printLogId },
      include: {
        order: {
          include: {
            table: {
              include: { floor: true },
            },
            user: true,
          },
        },
        floor: true,
      },
    });

    if (!printLog) {
      throw new Error('Log de impresión no encontrado');
    }

    // Actualizar log
    await this.prisma.printLog.update({
      where: { id: printLogId },
      data: {
        status: PrintStatus.RETRYING,
        attemptCount: { increment: 1 },
        lastAttempt: new Date(),
      },
    });

    // Emitir nuevamente
    const sentData = printLog.sentData as any;
    await this.printerGateway.emitPrintComanda({
      printLogId: printLog.id,
      orderId: printLog.order.id,
      dailyNumber: printLog.order.dailyNumber,
      tableNumber: printLog.order.table.number.toString(),
      floorId: printLog.floor.id,
      floorName: printLog.floor.name,
      floorLevel: printLog.floor.level,
      items: sentData.items,
      waiter: printLog.order.user.name,
      timestamp: printLog.order.createdAt,
    });

    this.logger.log(`Reintento de impresión: ${printLogId}`);
  }

  // Confirmar impresión exitosa (llamar desde el Print Agent)
  async confirmPrint(printLogId: string, success: boolean, error?: string) {
    await this.prisma.printLog.update({
      where: { id: printLogId },
      data: {
        status: success ? PrintStatus.PRINTED : PrintStatus.FAILED,
        errorMessage: error,
        lastAttempt: new Date(),
      },
    });
  }

  // Obtener logs de impresión de una orden
  async getPrintLogs(orderId: string) {
    return this.prisma.printLog.findMany({
      where: { orderId },
      include: {
        floor: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ NUEVO: Imprimir ticket de pre-cuenta
  async printPreCuenta(preCuentaData: {
    orderId: string;
    dailyNumber: number;
    tableNumber: string;
    tableName: string;
    floorId: string;
    floorName: string;
    floorLevel: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      notes: string | null;
      variantsDetail: string | null;
      categoryName: string;
    }>;
    waiter: string;
    total: number;
    subtotal: number;
    igv: number;
    timestamp: Date;
  }) {
    try {
      const floor = await this.prisma.floor.findUnique({
        where: { id: preCuentaData.floorId },
      });

      if (!floor) {
        throw new Error('Piso no encontrado');
      }

      // Crear log de impresión
      const printLog = await this.prisma.printLog.create({
        data: {
          orderId: preCuentaData.orderId,
          floorId: floor.id,
          status: PrintStatus.PENDING,
          attemptCount: 1,
          lastAttempt: new Date(),
          printerIp: floor.printerIp,
          sentData: {
            type: 'PRE_CUENTA',
            ...preCuentaData,
          },
        },
      });

      // Emitir comando de impresión vía WebSocket
      await this.printerGateway.emitPrintPreCuenta({
        printLogId: printLog.id,
        ...preCuentaData,
      });

      this.logger.log(
        `Pre-cuenta impresa: Orden #${preCuentaData.dailyNumber} - ${preCuentaData.floorName}`,
      );
    } catch (error) {
      this.logger.error(`Error al imprimir pre-cuenta: ${error.message}`);
    }
  }
}
