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
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderStatus, TableStatus } from 'src/generated/prisma/enums';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Decimal } from 'src/generated/prisma/internal/prismaNamespace';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /*  /**
   * CREAR PEDIDO (ABRIR MESA)
   * 1. Valida que la mesa esté libre (o permita re-apertura).
   * 2. Verifica stock de cada producto.
   * 3. Crea Orden, Detalle, Descuenta Stock y Ocupa Mesa en UNA sola transacción.
   */
  async create(createOrderDto: CreateOrderDto, user: UserActiveI) {
    const table = await this.prisma.table.findUnique({
      where: {
        id: createOrderDto.tableId,
      },
    });

    if (!table) throw new NotFoundException('Mesa no encontrada');

    if (table.status === TableStatus.OCUPADA) {
      throw new BadRequestException(
        'La mesa ya está ocupada. Usa "Agregar Items" en su lugar.',
      );
    }

    // INICIO DE TRANSACCIÓN
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Validar y descontar stock uno por uno
        // Calculamos total solo referencial (el verdadero cálculo es en Caja)

        const orderItemsData: {
          productId: string;
          quantity: number;
          price: Decimal; // 'any' o 'Decimal' para aceptar el tipo de dato de Prisma
          notes?: string;
          variantsDetail?: string;
        }[] = [];

        for (const item of createOrderDto.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product)
            throw new NotFoundException(
              `Producto ${item.productId} no encontrado`,
            );
          if (!product.isActive)
            throw new BadRequestException(
              `El producto ${product.name} no está activo`,
            );

          // Validación de Stock Diario (Mise en place)
          if (product.isStockManaged && product.stockDaily < item.quantity) {
            throw new BadRequestException(
              `Stock insuficiente para ${product.name}. Quedan: ${product.stockDaily}`,
            );
          }

          // Descuento de Stock
          if (product.isStockManaged) {
            await tx.product.update({
              where: { id: product.id },
              data: { stockDaily: { decrement: item.quantity } },
            });
          }

          // Preparamos datos del item (snapshot del precio)
          orderItemsData.push({
            productId: product.id,
            quantity: item.quantity,
            price: product.price, // ¡IMPORTANTE! Precio congelado al momento de pedir
            notes: item.notes,
            variantsDetail: item.variantsDetail,
          });
        }

        // 2. Crear la Orden
        const newOrder = await tx.order.create({
          data: {
            tableId: createOrderDto.tableId,
            userId: user.userId,
            status: OrderStatus.PENDIENTE,
            items: {
              create: orderItemsData,
            },
          },
          include: { items: { include: { product: true } }, table: true },
        });

        // 3. Actualizar estado de la Mesa
        await tx.table.update({
          where: { id: createOrderDto.tableId },
          data: { status: TableStatus.OCUPADA },
        });

        return newOrder;
      });
    } catch (error) {
      console.log('Error al crear el pedido', error);
      throw new InternalServerErrorException('Error al crear el pedido');
    }
  }

  /**
   * Agregar ítems a una orden abierta
   */
  async addItems(orderId: string, user: UserActiveI, items: AddOrderItemDto[]) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado.');

    if (!user.allowedFloorIds.includes(order.table.floorId))
      throw new ForbiddenException('No tienes acceso.');

    if (order.status === OrderStatus.CANCELADO)
      throw new ConflictException('El pedido fue cancelado.');

    // Validar stock
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) throw new NotFoundException('Producto no existe.');

      if (product.isStockManaged && product.stockDaily < item.quantity)
        throw new ConflictException(`No hay stock para ${product.name}.`);
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            notes: i.notes,
            variantsDetail: i.variantsDetail,
            price: 0,
          })),
        },
      },
      include: { items: true },
    });
  }

  /**
   * AGREGAR ITEMS A MESA YA ABIERTA
   * (Ej: "Tráeme dos cervezas más")
   */
  async addItems2(
    orderId: string,
    addItemsDto: AddItemsDto,
    user: UserActiveI,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');

    if (order.status === OrderStatus.CANCELADO)
      throw new BadRequestException('El pedido está cancelado');

    if (!user.allowedFloorIds.includes(order.table.floorId)) {
      throw new ForbiddenException('No tienes acceso.');
    }

    return await this.prisma.$transaction(async (tx) => {
      for (const item of addItemsDto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || !product.isActive) {
          throw new BadRequestException(`Producto inválido: ${item.productId}`);
        }

        if (product.isStockManaged && product.stockDaily < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}`,
          );
        }

        if (product.isStockManaged) {
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
            price: product.price,
            notes: item.notes,
            variantsDetail: item.variantsDetail,
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
  async cancelOrder(orderId: string, user: UserActiveI, dto: CancelOrderDto) {
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
        include: { items: true, table: true },
      });
      if (!order) throw new NotFoundException('Pedido no encontrado');

      // Cambiar estado de mesa a "PIDIENDO CUENTA" (Amarillo)
      await tx.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.PIDIENDO_CUENTA },
      });

      // Calcular total simple
      const total = order.items.reduce((acc, item) => {
        return acc + Number(item.price) * item.quantity;
      }, 0);

      return {
        ...order,
        calculatedTotal: total,
        message: 'Pre-cuenta generada. Mesa en estado de pago.',
      };
    });
  }

  /**
   * Obtener órdenes del mozo logueado
   */
  async findMyOrders(user: UserActiveI) {
    return this.prisma.order.findMany({
      where: { userId: user.userId },
      include: { items: true, table: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
