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
import {
  CashMovementType,
  CashRegisterStatus,
  OrderStatus,
  TableStatus,
} from 'src/generated/prisma/enums';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  Decimal,
  JsonValue,
} from 'src/generated/prisma/internal/prismaNamespace';
import { PrinterService } from '../printer/printer.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly printerService: PrinterService,
  ) {}

  // se usa
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
      const order = await this.prisma.$transaction(async (tx) => {
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

        const orderDate = new Date();
        orderDate.setHours(0, 0, 0, 0);

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

        await tx.table.update({
          where: { id: createOrderDto.tableId },
          data: { status: TableStatus.OCUPADA },
        });

        return newOrder;
      });

      this.printOrderToKitchen(order.id);

      return order;
    } catch (error) {
      console.log('Error al crear el pedido', error);
      throw new InternalServerErrorException('Error al crear el pedido');
    }
  }

  // se usa
  private async prepareComandaData(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: {
                  include: {
                    floors: true,
                  },
                },
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

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    const fecha = new Date(order.createdAt).toLocaleDateString('es-PE');
    const hora = new Date(order.createdAt).toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const items = order.items.map((item) => ({
      productName: item.product.name,
      category: item.product.category.name,
      quantity: item.quantity,
      unitPrice: Number(item.price),
      totalPrice: Number(item.price) * item.quantity,
      variants: item.variantsDetail || null,
      notes: item.notes || null,
      floors: item.product.category.floors.map((f) => ({
        id: f.id,
        level: f.level,
      })),
    }));

    const comandaPayload = {
      order_number: order.dailyNumber.toString(),
      order_id: order.id,
      table_name: order.table.name,
      table_number: order.table.number,
      floor_name: order.table.floor.name,
      floor_level: order.table.floor.level,
      waiter_name: order.user.name,
      waiter_username: order.user.username,
      date: fecha,
      time: hora,
      items: items,
      total_items: items.length,
      total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      total_amount: items.reduce((sum, item) => sum + item.totalPrice, 0),
    };

    return comandaPayload;
  }

  // se usa
  private async printOrderToKitchen(orderId: string) {
    const payload = await this.prepareComandaData(orderId);

    const itemsParaImpresora = payload.items.map((item) => ({
      quantity: item.quantity,
      description: item.productName, // Mapeamos productName a description
      variants: item.variants,
      notes: item.notes,
      floors: item.floors,
    }));

    const itemsCocina = itemsParaImpresora.filter((item) =>
      item.floors.some((f) => f.level === 1 || f.level === 2),
    );

    const itemsBebidas = itemsParaImpresora.filter((item) =>
      item.floors.some((f) => f.level === 3),
    );

    try {
      if (itemsCocina.length > 0) {
        const cocinaNumber = await this.getNextAreaOrderNumber('COCINA');

        await this.printerService.printComanda({
          printer: 'cocina',
          table: payload.table_name,
          order_number: cocinaNumber.toString(),
          date: payload.date,
          time: payload.time,
          waiter: payload.waiter_name,
          items: itemsCocina,
          total_items: itemsCocina.length,
        });

        console.log(
          'cocina nuevo ->',
          JSON.stringify({
            printer: 'cocina',
            table: payload.table_name,
            order_number: cocinaNumber.toString(),
            date: payload.date,
            time: payload.time,
            waiter: payload.waiter_name,
            items: itemsCocina,
            total_items: itemsCocina.length,
          }),
          cocinaNumber,
        );
      }

      if (itemsBebidas.length > 0) {
        const bebidasNumber = await this.getNextAreaOrderNumber('BEBIDAS');

        await this.printerService.printComanda({
          printer: 'bebidas',
          table: payload.table_name,
          order_number: bebidasNumber,
          date: payload.date,
          time: payload.time,
          waiter: payload.waiter_name,
          items: itemsBebidas,
          total_items: itemsBebidas.length,
        });

        console.log(
          'bebidas nuevo ->',
          JSON.stringify({
            printer: 'bebidas',
            table: payload.table_name,
            order_number: bebidasNumber,
            date: payload.date,
            time: payload.time,
            waiter: payload.waiter_name,
            items: itemsBebidas,
            total_items: itemsBebidas.length,
          }),
          bebidasNumber,
        );
      }

      return { success: true, message: 'Comandas enviadas correctamente' };
    } catch (error) {
      console.error('Error imprimiendo comandas:', error);
      return { success: false, message: 'Error enviando comandas' };
    }
  }

  // se usa
  private async printOrderToKitchenPartial(payload: {
    table: string;
    waiter: string;
    date: string;
    time: string;
    items: {
      description: string;
      quantity: number;
      variants: JsonValue;
      notes: string | null;
      floors: number[];
    }[];
  }) {
    const itemsBebidas = payload.items.filter((item) =>
      item.floors.includes(3),
    );

    const itemsCocina = payload.items.filter(
      (item) => item.floors.includes(1) || item.floors.includes(2),
    );

    try {
      if (itemsCocina.length > 0) {
        const cocinaNumber = await this.getNextAreaOrderNumber('COCINA');

        await this.printerService.printComanda({
          printer: 'cocina',
          table: payload.table,
          order_number: cocinaNumber,
          date: payload.date,
          time: payload.time,
          waiter: payload.waiter,
          items: itemsCocina,
          total_items: itemsCocina.length,
        });

        console.log(
          'cocina add items ->',
          JSON.stringify({
            printer: 'cocina',
            table: payload.table,
            order_number: cocinaNumber,
            date: payload.date,
            time: payload.time,
            waiter: payload.waiter,
            items: itemsCocina,
            total_items: itemsCocina.length,
          }),
          cocinaNumber,
        );
      }

      if (itemsBebidas.length > 0) {
        const bebidasNumber = await this.getNextAreaOrderNumber('BEBIDAS');

        await this.printerService.printComanda({
          printer: 'bebidas',
          order_number: bebidasNumber.toString(),
          table: payload.table,
          date: payload.date,
          time: payload.time,
          waiter: payload.waiter,
          items: itemsBebidas,
          total_items: itemsBebidas.length,
        });

        console.log(
          'bebidas add items ->',
          JSON.stringify({
            printer: 'bebidas',
            order_number: bebidasNumber.toString(),
            table: payload.table,
            date: payload.date,
            time: payload.time,
            waiter: payload.waiter,
            items: itemsBebidas,
            total_items: itemsBebidas.length,
          }),
          bebidasNumber,
        );
      }

      return { success: true, message: 'Comandas enviadas correctamente' };
    } catch (error) {
      console.error('Error imprimiendo comandas:', error);
      return { success: false, message: 'Error enviando comandas' };
    }
  }

  // se usa
  private async getNextAreaOrderNumber(area: 'COCINA' | 'BEBIDAS') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sequence = await this.prisma.orderPrintSequence.upsert({
      where: {
        area_date: { area, date: today },
      },
      update: {
        lastNumber: { increment: 1 },
      },
      create: {
        area,
        date: today,
        lastNumber: 1,
      },
    });

    return sequence.lastNumber;
  }

  // se usa
  private async getNextDailyOrderNumber(
    tx: any,
    floorId: string,
  ): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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

  // se usa
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
    } // ojo

    const result = await this.prisma.$transaction(async (tx) => {
      const newItemIds: string[] = [];

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

        // ✅ CORREGIDO: Agregar saleId null explícitamente
        const newItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: item.quantity,
            price: new Decimal(finalPrice),
            notes: item.notes,
            variantsDetail: variantsDescriptionArray.join(', '),
            saleId: null, // ✅ IMPORTANTE: Items nuevos NO están pagados
          },
        });
        newItemIds.push(newItem.id);
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PENDIENTE },
      });

      // return await this.findOne(order.id);
      return {
        order: await tx.order.findUnique({
          where: { id: order.id },
          include: {
            items: true,
            table: true,
          },
        }),
        newItemIds,
      };
    });

    // --- DESPUÉS DE LA TRANSACCIÓN ---
    const payload = await this.prepareAddedItemsComanda(
      orderId,
      result.newItemIds,
    );

    this.printOrderToKitchenPartial(payload);

    return result.order;
  }

  // se usa
  private async prepareAddedItemsComanda(orderId: string, itemIds: string[]) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: { include: { floor: true } },
        user: true,
        items: {
          where: { id: { in: itemIds } },
          include: {
            product: {
              include: {
                category: { include: { floors: true } },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Orden no encontrada');

    const fecha = new Date().toLocaleDateString('es-PE');
    const hora = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const items = order.items.map((item) => ({
      description: item.product.name,
      quantity: item.quantity,
      variants: item.variantsDetail,
      notes: item.notes,
      floors: item.product.category.floors.map((f) => f.level),
    }));

    return {
      table: order.table.name,
      waiter: order.user.name,
      date: fecha,
      time: hora,
      items,
    };
  }

  // se usa
  async findActiveOrder(tableId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        tableId: tableId,
        status: { not: OrderStatus.CANCELADO },
      },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        table: {
          include: {
            floor: true,
          },
        },
        user: { select: { name: true } },
      },
      orderBy: {
        createdAt: 'desc', // La más reciente primero
      },
    });

    if (!orders || orders.length === 0) {
      throw new NotFoundException(
        'No hay ninguna orden activa para esta mesa.',
      );
    }

    // ✅ CRÍTICO: Filtrar órdenes que tengan al menos UN item sin pagar
    const activeOrders = orders.filter((order) => {
      const unpaidItems = order.items.filter((item) => item.saleId === null);
      return unpaidItems.length > 0; // Tiene items pendientes
    });

    if (activeOrders.length === 0) {
      throw new NotFoundException(
        'No hay ninguna orden activa para esta mesa.',
      );
    }

    // ✅ Tomar la orden más reciente con items pendientes
    const order = activeOrders[0];

    // ✅ IMPORTANTE: Calcular total solo con items NO pagados
    const unpaidItems = order.items.filter((item) => item.saleId === null);
    const total = unpaidItems.reduce((acc, item) => {
      return acc + Number(item.price) * item.quantity;
    }, 0);

    // ✅ Devolver TODOS los items (frontend filtrará)
    return { ...order, total };
  }

  // se usa
  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    return await this.prisma.order.update({
      where: { id },
      data: { status: updateOrderStatusDto.status },
    });
  }

  // se usa
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

      await tx.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.PIDIENDO_CUENTA },
      });

      // Filtrar solo items activos
      const activeItems = order.items.filter((item) => item.isActive);

      // Calcular total solo con items activos
      const total = activeItems.reduce((acc, item) => {
        return acc + Number(item.price) * item.quantity;
      }, 0);

      return {
        ...order,
        items: activeItems,
        calculatedTotal: total,
        message: 'Pre-cuenta generada. Mesa en estado de pago.',
      };
    });
  }

  // se usa
  async cancelOrder(orderId: string, user: UserActiveI, dto: CancelOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        sale: true,
        items: { include: { product: true } },
      },
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

    const cajaAbierta = await this.prisma.cashRegister.findFirst({
      where: {
        status: CashRegisterStatus.ABIERTA,
      },
      orderBy: {
        openTime: 'desc',
      },
    });

    const totalPedido = order.items.reduce((sum, item) => {
      return sum + parseFloat(item.price.toString()) * item.quantity;
    }, 0);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Crear registro de cancelación
      await tx.orderCancellation.create({
        data: {
          orderId: orderId,
          reason: dto.reason,
          authorizedById: user.userId,
        },
      });

      // 2. Cancelar el pedido
      const cancelledOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELADO },
      });

      // 3. Liberar la mesa
      await tx.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.LIBRE },
      });

      // 4. Registrar movimiento en la caja abierta
      if (cajaAbierta) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: cajaAbierta.id,
            amount: totalPedido,
            type: CashMovementType.EGRESO,
            description: `Pedido cancelado - ${order.table.name}`,
            isAutomatic: true,
            metadata: {
              type: 'CANCELACION_PEDIDO',
              orderId: order.id,
              orderNumber: order.dailyNumber,
              tableId: order.tableId,
              tableName: order.table.name,
              tableNumber: order.table.number,
              floorId: order.table.floorId,
              reason: dto.reason,
              authorizedBy: user.userId,
              authorizedByName: user.username,
              mozeroId: order.userId,
              itemsCount: order.items.length,
              items: order.items.map((item) => ({
                productId: item.productId,
                productName: item.product.name,
                quantity: item.quantity,
                price: parseFloat(item.price.toString()),
                subtotal: parseFloat(item.price.toString()) * item.quantity,
              })),
              totalPedido: totalPedido,
              cancelledAt: new Date(),
            },
          },
        });
      }

      return cancelledOrder;
    });
  }

  async deactivateOrderItem(id: string) {
    // Verificar que el item existe
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id },
      include: {
        order: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundException('Item de orden no encontrado');
    }

    // Verificar que la orden no esté ya cerrada o cancelada
    if (
      orderItem.order.status === 'CANCELADO' ||
      orderItem.order.status === 'ENTREGADO'
    ) {
      throw new BadRequestException(
        'No se pueden desactivar items de una orden cerrada o cancelada',
      );
    }

    // Verificar que el item no esté ya desactivado
    if (!orderItem.isActive) {
      throw new BadRequestException('El item ya está desactivado');
    }

    // Desactivar el item
    const updatedItem = await this.prisma.orderItem.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: {
        product: true,
      },
    });

    return {
      success: true,
      message: 'Item desactivado correctamente',
      data: updatedItem,
    };
  }
}
