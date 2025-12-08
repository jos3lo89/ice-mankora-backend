import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderStatus, TableStatus } from 'src/generated/prisma/enums';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Decimal } from 'src/generated/prisma/internal/prismaNamespace';
import { PrinterService } from '../printer/printer.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private printerService: PrinterService,
  ) {}

  async create(createOrderDto: CreateOrderDto, user: UserActiveI) {
    const table = await this.prisma.table.findUnique({
      where: {
        id: createOrderDto.tableId,
      },
    });

    if (!table) {
      throw new NotFoundException('Mesa no encontrada');
    }

    if (table.status === TableStatus.OCUPADA) {
      throw new BadRequestException('Mesa ocupada');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const dailyNumber = await this.getNextDailyOrderNumber(
          tx,
          table.floorId,
        );

        const orderItemsData: {
          productId: string;
          quantity: number;
          price: Decimal;
          notes?: string;
          variantsDetail?: string;
        }[] = [];

        for (const item of createOrderDto.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product || !product.isActive) {
            throw new BadRequestException(`Producto inválido`);
          }

          let finalPrice = Number(product.price);
          let variantsDescriptionArray: string[] = [];

          if (item.variantIds && item.variantIds.length > 0) {
            const variants = await tx.productVariant.findMany({
              where: {
                id: { in: item.variantIds },
                productId: product.id,
              },
            });

            for (const v of variants) {
              finalPrice += Number(v.priceExtra);
              variantsDescriptionArray.push(v.name);
            }
          }

          if (product.isStockManaged) {
            if (product.stockDaily < item.quantity) {
              throw new BadRequestException(
                `Stock insuficiente: ${product.name}`,
              );
            }
            await tx.product.update({
              where: { id: product.id },
              data: { stockDaily: { decrement: item.quantity } },
            });
          }

          orderItemsData.push({
            productId: product.id,
            quantity: item.quantity,
            price: new Decimal(finalPrice),
            notes: item.notes,
            variantsDetail: variantsDescriptionArray.join(', '),
          });
        }

        // const startOfToday = new Date();
        // startOfToday.setHours(0, 0, 0, 0);

        // const endOfToday = new Date();
        // endOfToday.setHours(23, 59, 59, 999);

        // const lastOrderToday = await tx.order.findFirst({
        //   where: {
        //     orderDate: {
        //       gte: startOfToday,
        //       lte: endOfToday,
        //     },
        //     table: {
        //       floorId: table.floorId,
        //     },
        //   },
        //   orderBy: {
        //     dailyNumber: 'desc',
        //   },
        //   select: {
        //     dailyNumber: true,
        //   },
        // });

        // const nextDailyNumber = (lastOrderToday?.dailyNumber ?? 0) + 1;

        // ✅ NUEVO: Crear orden con número del día
        const orderDate = new Date();
        orderDate.setHours(0, 0, 0, 0); // Solo fecha, sin hora

        const newOrder = await tx.order.create({
          data: {
            tableId: createOrderDto.tableId,
            userId: user.userId,
            status: OrderStatus.PENDIENTE,
            dailyNumber,
            orderDate,
            items: {
              create: orderItemsData,
            },
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    variants: true,
                  },
                },
              },
            },
            table: {
              include: {
                floor: true,
              },
            },
            user: true,
          },
        });

        await tx.table.update({
          where: { id: createOrderDto.tableId },
          data: { status: TableStatus.OCUPADA },
        });

        return newOrder;
      });

      // ✅ NUEVO: Imprimir comanda automáticamente después de crear la orden
      await this.printerService.printOrderComanda(result.id);

      console.log(JSON.stringify(result));

      return result;
    } catch (error) {
      console.log('Error al crear el pedido', error);
      throw new InternalServerErrorException('Error al crear el pedido');
    }
  }

  // ✅ NUEVO: Obtener el próximo número de orden del día para el piso
  private async getNextDailyOrderNumber(
    tx: any,
    floorId: string,
  ): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Obtener la última orden del día en ese piso
    const lastOrder = await tx.order.findFirst({
      where: {
        table: {
          floorId,
        },
        orderDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: {
        dailyNumber: 'desc',
      },
    });

    return lastOrder ? lastOrder.dailyNumber + 1 : 1;
  }

  // ✅ NUEVO: Endpoint para obtener logs de impresión
  async getOrderPrintLogs(orderId: string) {
    return this.printerService.getPrintLogs(orderId);
  }

  // ✅ NUEVO: Endpoint para reintentar impresión
  async retryPrint(printLogId: string) {
    return this.printerService.retryPrint(printLogId);
  }

  async addItems(orderId: string, addItemsDto: AddItemsDto, user: UserActiveI) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('El pedido está cancelado');
    }

    if (!user.allowedFloorIds.includes(order.table.floorId)) {
      throw new ForbiddenException('No tienes acceso');
    }

    return await this.prisma.$transaction(async (tx) => {
      for (const item of addItemsDto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || !product.isActive) {
          throw new BadRequestException('Producto inválido');
        }

        let finalPrice = Number(product.price);
        let variantsDescriptionArray: string[] = [];

        if (item.variantIds && item.variantIds.length > 0) {
          const variants = await tx.productVariant.findMany({
            where: {
              id: { in: item.variantIds },
              productId: product.id,
            },
          });

          for (const v of variants) {
            finalPrice += Number(v.priceExtra);
            variantsDescriptionArray.push(v.name);
          }
        }

        if (product.isStockManaged) {
          if (product.stockDaily < item.quantity) {
            throw new BadRequestException(
              `Stock insuficiente para ${product.name}`,
            );
          }

          await tx.product.update({
            where: { id: product.id },
            data: { stockDaily: { decrement: item.quantity } },
          });
        }

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: item.quantity,
            price: new Decimal(finalPrice),
            notes: item.notes,
            variantsDetail: variantsDescriptionArray.join(', '),
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PENDIENTE },
      });

      return await this.findOne(order.id);
    });
  }

  /**
   * Cancelar un pedido completo
   */
  async cancelOrderFirst(
    orderId: string,
    user: UserActiveI,
    dto: CancelOrderDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado.');

    if (!user.allowedFloorIds.includes(order.table.floorId))
      throw new ForbiddenException('No tienes acceso.');

    if (order.status === 'CANCELADO')
      throw new ConflictException('El pedido ya estaba cancelado.');

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELADO',
      },
    });

    // Mesa vuelve a libre
    await this.prisma.table.update({
      where: { id: order.tableId },
      data: {
        status: 'LIBRE',
      },
    });

    return { message: 'Pedido cancelado' };
  }

  /**
   * AGREGAR ITEMS A MESA YA ABIERTA
   * (Ej: "Tráeme dos cervezas más")
   */

  /**
   * LISTAR PEDIDOS PENDIENTES (VISTA COCINA/BARRA)
   * Filtra pedidos que no han sido entregados aún.
   */
  async findAllPending(user: UserActiveI) {
    // Aquí podrías filtrar por los pisos del usuario si hay cocinas separadas por piso
    return await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDIENTE, OrderStatus.PREPARADO] },
        // Opcional: Filtrar solo mesas de los pisos permitidos del usuario
        table: {
          floorId: { in: user.allowedFloorIds },
        },
      },
      include: {
        table: { select: { name: true, number: true, floor: true } },
        items: { include: { product: { select: { name: true } } } },
        user: { select: { name: true } }, // Quién lo pidió
      },
      orderBy: { createdAt: 'asc' }, // El más antiguo primero (FIFO)
    });
  }

  /**
   * OBTENER DETALLE DE UN PEDIDO
   */
  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        table: { include: { floor: true } },
        user: true,
      },
    });
    if (!order) throw new NotFoundException(`Order #${id} not found`);
    return order;
  }

  /**
   * CAMBIAR ESTADO (Ej: COCINERO MARCA "PREPARADO")
   */
  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    return await this.prisma.order.update({
      where: { id },
      data: { status: updateOrderStatusDto.status },
    });
  }

  /**
   * PRE-CUENTA (SOLICITUD DE CLIENTE)
   * Pone la mesa en amarillo y calcula totales previos.
   */
  async requestPreAccount(orderId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          table: {
            include: {
              floor: true,
            },
          },
          user: true,
        },
      });

      if (!order) throw new NotFoundException('Pedido no encontrado');

      // Cambiar estado de mesa a "PIDIENDO CUENTA" (Amarillo)
      await tx.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.PIDIENDO_CUENTA },
      });

      // Calcular total
      const total = order.items.reduce((acc, item) => {
        return acc + Number(item.price) * item.quantity;
      }, 0);

      // ✅ NUEVO: Imprimir ticket de pre-cuenta
      await this.printerService.printPreCuenta({
        orderId: order.id,
        dailyNumber: order.dailyNumber,
        tableNumber: order.table.number.toString(),
        tableName: order.table.name,
        floorId: order.table.floor.id,
        floorName: order.table.floor.name,
        floorLevel: order.table.floor.level,
        items: order.items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: Number(item.price),
          notes: item.notes,
          variantsDetail: item.variantsDetail as string,
          categoryName: item.product.category.name,
        })),
        waiter: order.user.name,
        total,
        subtotal: total / 1.18,
        igv: total - total / 1.18,
        timestamp: new Date(),
      });

      return {
        ...order,
        calculatedTotal: total,
        message: 'Pre-cuenta generada e impresa. Mesa en estado de pago.',
      };
    });
  }

  /**
   * Obtener órdenes del mozo logueado
   */
  async findMyOrders(user: UserActiveI) {
    return this.prisma.order.findMany({
      where: { userId: user.userId },
      include: {
        items: true,
        table: {
          include: {
            floor: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * BUSCAR ORDEN ACTIVA DE UNA MESA
   * Usado para cargar el detalle de la mesa cuando está Ocupada/Roja.
   */
  async findActiveOrder(tableId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        tableId: tableId,
        // Una orden activa es aquella que NO está cancelada y NO tiene venta asociada (no pagada)
        status: { not: OrderStatus.CANCELADO },
        sale: { is: null },
      },
      include: {
        items: {
          include: {
            product: true, // Necesitamos nombre y precio del producto
          },
          orderBy: { createdAt: 'desc' }, // Lo último pedido sale arriba
        },
        table: {
          include: {
            floor: true,
          },
        },
        user: { select: { name: true } }, // Para saber qué mozo abrió la mesa
      },
    });

    if (!order) {
      // Si la mesa está roja en el mapa pero no devuelve orden aquí,
      // significa que hubo un error de consistencia o ya se pagó.
      // Retornamos null o lanzamos error según prefieras manejarlo en front.
      throw new NotFoundException(
        'No hay ninguna orden activa para esta mesa.',
      );
    }

    // Calculamos el total al vuelo para facilitarle la vida al frontend
    const total = order.items.reduce((acc, item) => {
      return acc + Number(item.price) * item.quantity;
    }, 0);

    return { ...order, total };
  }

  async cancelOrder(orderId: string, user: UserActiveI, dto: CancelOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, sale: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('El pedido ya está cancelado');
    }

    if (order.sale) {
      throw new BadRequestException(
        'El pedido ya tiene una venta asociada, debe anular la venta en Caja.',
      );
    }

    const configPin = await this.prisma.systemConfig.findUnique({
      where: { key: 'ADMIN_PIN' },
    });

    if (!configPin) {
      throw new NotFoundException('Código no encontrado');
    }

    if (dto.authCode !== configPin.value) {
      throw new ForbiddenException('Código de autorización incorrecto');
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.orderCancellation.create({
        data: {
          orderId: orderId,
          reason: dto.reason,
          authorizedById: user.userId,
        },
      });

      const cancelledOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELADO },
      });

      await tx.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.LIBRE },
      });

      return cancelledOrder;
    });
  }
}
