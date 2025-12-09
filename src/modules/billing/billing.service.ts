import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import {
  ComprobanteType,
  OrderStatus,
  SunatStatus,
  TableStatus,
} from 'src/generated/prisma/enums';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🔥 PROCESO DE COBRO CON DIVISIÓN DE CUENTA
   */
  async createSale2(user: UserActiveI, dto: CreateSaleDto) {
    // 1. Validar Pedido
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: { include: { product: true } },
        table: true,
        sale: true,
        user: true,
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status === OrderStatus.CANCELADO)
      throw new BadRequestException('El pedido está anulado.');

    // ✅ 2. LÓGICA DE DIVISIÓN DE CUENTA
    let itemsToPay = order.items;

    if (dto.itemIds && dto.itemIds.length > 0) {
      // PAGO PARCIAL: Solo los items seleccionados
      itemsToPay = order.items.filter((item) => dto.itemIds!.includes(item.id));

      if (itemsToPay.length === 0) {
        throw new BadRequestException('No se seleccionaron items válidos.');
      }

      // Validar que los items no estén ya pagados
      const itemsYaPagados = itemsToPay.filter((item) => item.saleId !== null);
      if (itemsYaPagados.length > 0) {
        throw new ConflictException(
          `Algunos items ya fueron pagados: ${itemsYaPagados.map((i) => i.product.name).join(', ')}`,
        );
      }
    } else {
      // PAGO COMPLETO: Todos los items
      if (order.sale) {
        throw new ConflictException(
          'Este pedido ya fue cobrado completamente.',
        );
      }

      // Validar que ningún item esté pagado parcialmente
      const itemsPagados = order.items.filter((item) => item.saleId !== null);
      if (itemsPagados.length > 0) {
        throw new ConflictException(
          'Algunos items ya fueron pagados. Use división de cuenta.',
        );
      }
    }

    // 3. Validaciones por tipo de comprobante
    if (dto.type === ComprobanteType.FACTURA) {
      if (!dto.clientDocNumber || dto.clientDocNumber.length !== 11) {
        throw new BadRequestException(
          'Para Factura se requiere RUC de 11 dígitos.',
        );
      }
      if (!dto.clientName) {
        throw new BadRequestException('Falta la Razón Social para Factura.');
      }
    }

    if (dto.type === ComprobanteType.BOLETA && dto.clientDocNumber) {
      if (dto.clientDocNumber.length !== 8) {
        throw new BadRequestException('El DNI debe tener 8 dígitos.');
      }
    }

    // 4. Validar pago si es efectivo
    const { total } = this.calculateTotals(itemsToPay);
    if (dto.montoPagado !== undefined) {
      if (dto.montoPagado < Number(total)) {
        throw new BadRequestException('El monto pagado es insuficiente.');
      }
    }

    // 5. Cálculos Matemáticos
    const { baseImponible, igvTotal, itemsSnapshot } =
      this.calculateTotals(itemsToPay);

    // 6. TRANSACCIÓN
    return await this.prisma.$transaction(async (tx) => {
      // A. Generar Correlativo según tipo
      let serie: string;
      switch (dto.type) {
        case ComprobanteType.FACTURA:
          serie = 'F001';
          break;
        case ComprobanteType.BOLETA:
          serie = 'B001';
          break;
        case ComprobanteType.TICKET:
          serie = 'T001';
          break;
        default:
          serie = 'T001';
      }

      const lastSale = await tx.sale.findFirst({
        where: { serie, type: dto.type },
        orderBy: { correlativo: 'desc' },
      });

      const nuevoCorrelativo = (lastSale?.correlativo || 0) + 1;
      const numeroComprobante = `${serie}-${String(nuevoCorrelativo).padStart(8, '0')}`;

      // B. Crear/Actualizar Cliente (solo si no es Ticket)
      let clientId: string | null = null;

      if (dto.type !== ComprobanteType.TICKET && dto.clientDocNumber) {
        const client = await tx.client.upsert({
          where: { docNumber: dto.clientDocNumber },
          update: {
            name: dto.clientName,
            address: dto.clientAddress,
            email: dto.clientEmail,
          },
          create: {
            docType: dto.clientDocType || '1',
            docNumber: dto.clientDocNumber,
            name: dto.clientName || 'CLIENTE GENERICO',
            address: dto.clientAddress || '',
            email: dto.clientEmail || '',
          },
        });
        clientId = client.id;
      }

      // C. Obtener usuario cajero
      const cajero = await tx.user.findUnique({
        where: { id: user.userId },
      });

      if (!cajero) {
        throw new NotFoundException('Cajero no encontrado');
      }

      // D. CREAR LA VENTA
      const sale = await tx.sale.create({
        data: {
          // ✅ IMPORTANTE: orderId solo si es pago completo
          orderId: dto.itemIds ? null : order.id,
          userId: user.userId,
          clientId: clientId,

          // Cabecera
          type: dto.type,
          serie: serie,
          correlativo: nuevoCorrelativo,
          numeroComprobante: numeroComprobante,
          fechaEmision: new Date(),
          tipoMoneda: 'PEN',

          // Datos Emisor
          empresaRuc: process.env.EMPRESA_RUC || '20615167755',
          empresaRazonSocial:
            process.env.EMPRESA_RAZON_SOCIAL || 'ICE MANKORA S.A.C.',
          empresaDireccion:
            process.env.EMPRESA_DIRECCION ||
            'Jr. Ramón Castilla con Juan Antonio Trelles 2do Piso',
          codigoEstablecimiento: '0000',

          // Datos Cliente (Snapshot)
          clienteTipoDoc: dto.clientDocType || '-',
          clienteNumDoc: dto.clientDocNumber || '-',
          clienteRazonSocial: dto.clientName || 'CLIENTE VARIOS',
          clienteDireccion: dto.clientAddress || '-',

          // Totales
          montoGravado: baseImponible,
          igv: igvTotal,
          totalImpuestos: igvTotal,
          valorVenta: baseImponible,
          precioVentaTotal: total,
          montoLetras: this.numberToLetters(Number(total)),

          // Items (JSON)
          itemsSnapshot: itemsSnapshot,

          // Pago
          paymentMethod: dto.paymentMethod,
          formaPago: 'Contado',
          montoPagado: dto.montoPagado,
          vuelto: dto.vuelto,

          // Metadata
          metadata: {
            mesa: order.table.name,
            orden: order.dailyNumber.toString(),
            cajero: cajero.name,
            mozo: order.user.name,
            esDivision: !!dto.itemIds, // ✅ Indicar si fue división
            itemsPagados: itemsToPay.length,
            totalItems: order.items.length,
          },

          // Estados SUNAT
          sunatStatus:
            dto.type === ComprobanteType.TICKET
              ? SunatStatus.NO_APLICA
              : SunatStatus.PENDIENTE,
        },
      });

      // ✅ E. VINCULAR ITEMS PAGADOS A ESTA VENTA
      await tx.orderItem.updateMany({
        where: {
          id: { in: itemsToPay.map((item) => item.id) },
        },
        data: {
          saleId: sale.id,
        },
      });

      // ✅ F. VERIFICAR SI TODOS LOS ITEMS ESTÁN PAGADOS
      const allItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      });

      const allPaid = allItems.every((item) => item.saleId !== null);

      if (allPaid) {
        // TODOS LOS ITEMS PAGADOS: Cerrar orden y liberar mesa
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ENTREGADO },
        });

        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.LIBRE },
        });
      } else {
        // PAGO PARCIAL: Mantener orden activa
        console.log(
          `✅ Pago parcial: ${itemsToPay.length}/${allItems.length} items pagados`,
        );
      }

      return sale;
    });
  }

  /**
   * PROCESO DE COBRO Y EMISIÓN
   */
  async createSale(user: UserActiveI, dto: CreateSaleDto) {
    // 1. Validar Pedido
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: { include: { product: true } },
        table: true,
        sale: true,
        user: true, // ✅ Para metadata
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.sale) throw new ConflictException('Este pedido ya fue cobrado.');
    if (order.status === OrderStatus.CANCELADO)
      throw new BadRequestException('El pedido está anulado.');

    // 2. Validaciones por tipo de comprobante
    if (dto.type === ComprobanteType.FACTURA) {
      if (!dto.clientDocNumber || dto.clientDocNumber.length !== 11) {
        throw new BadRequestException(
          'Para Factura se requiere RUC de 11 dígitos.',
        );
      }
      if (!dto.clientName) {
        throw new BadRequestException('Falta la Razón Social para Factura.');
      }
    }

    if (dto.type === ComprobanteType.BOLETA && dto.clientDocNumber) {
      if (dto.clientDocNumber.length !== 8) {
        throw new BadRequestException('El DNI debe tener 8 dígitos.');
      }
    }

    // ✅ 3. Validar pago si es efectivo
    if (dto.montoPagado !== undefined) {
      const { total } = this.calculateTotals(order.items);
      if (dto.montoPagado < Number(total)) {
        throw new BadRequestException('El monto pagado es insuficiente.');
      }
    }

    // 4. Cálculos Matemáticos (Totales e Impuestos)
    const { total, baseImponible, igvTotal, itemsSnapshot } =
      this.calculateTotals(order.items);

    // 5. TRANSACCIÓN (Cobro + Correlativo + Cierre Mesa)
    return await this.prisma.$transaction(async (tx) => {
      // A. Generar Correlativo según tipo
      let serie: string;
      switch (dto.type) {
        case ComprobanteType.FACTURA:
          serie = 'F001';
          break;
        case ComprobanteType.BOLETA:
          serie = 'B001';
          break;
        case ComprobanteType.TICKET:
          serie = 'T001';
          break;
        default:
          serie = 'T001';
      }

      const lastSale = await tx.sale.findFirst({
        where: { serie, type: dto.type },
        orderBy: { correlativo: 'desc' },
      });

      const nuevoCorrelativo = (lastSale?.correlativo || 0) + 1;
      const numeroComprobante = `${serie}-${String(nuevoCorrelativo).padStart(8, '0')}`;

      // B. Crear/Actualizar Cliente (solo si no es Ticket)
      let clientId: string | null = null;

      if (dto.type !== ComprobanteType.TICKET && dto.clientDocNumber) {
        const client = await tx.client.upsert({
          where: { docNumber: dto.clientDocNumber },
          update: {
            name: dto.clientName,
            address: dto.clientAddress,
            email: dto.clientEmail,
          },
          create: {
            docType: dto.clientDocType || '1',
            docNumber: dto.clientDocNumber,
            name: dto.clientName || 'CLIENTE GENERICO',
            address: dto.clientAddress || '',
            email: dto.clientEmail || '',
          },
        });
        clientId = client.id;
      }

      // ✅ C. Obtener usuario cajero
      const cajero = await tx.user.findUnique({
        where: { id: user.userId },
      });

      if (!cajero) {
        throw new NotFoundException('cajero no encontrado');
      }

      // D. CREAR LA VENTA
      const sale = await tx.sale.create({
        data: {
          orderId: order.id,
          userId: user.userId,
          clientId: clientId,

          // Cabecera
          type: dto.type,
          serie: serie,
          correlativo: nuevoCorrelativo,
          numeroComprobante: numeroComprobante,
          fechaEmision: new Date(),
          tipoMoneda: 'PEN',

          // Datos Emisor (TODO: Mover a env/config)
          empresaRuc: '20600000001',
          empresaRazonSocial: 'ICE MANKORA S.A.C.',
          empresaDireccion: 'Jr. Principal 123, Máncora, Piura',
          codigoEstablecimiento: '0000',

          // Datos Cliente (Snapshot)
          clienteTipoDoc: dto.clientDocType || '-',
          clienteNumDoc: dto.clientDocNumber || '-',
          clienteRazonSocial: dto.clientName || 'CLIENTE VARIOS',
          clienteDireccion: dto.clientAddress || '-',

          // Totales
          montoGravado: baseImponible,
          igv: igvTotal,
          totalImpuestos: igvTotal,
          valorVenta: baseImponible,
          precioVentaTotal: total,
          montoLetras: this.numberToLetters(Number(total)),

          // Items (JSON)
          itemsSnapshot: itemsSnapshot,

          // ✅ Nuevos campos: Pago
          paymentMethod: dto.paymentMethod,
          formaPago: 'Contado',
          montoPagado: dto.montoPagado,
          vuelto: dto.vuelto,

          // ✅ Metadata
          metadata: {
            mesa: order.table.name,
            orden: order.dailyNumber.toString(),
            cajero: cajero.name,
            mozo: order.user.name,
          },

          // Estados SUNAT
          sunatStatus:
            dto.type === ComprobanteType.TICKET
              ? SunatStatus.NO_APLICA
              : SunatStatus.PENDIENTE,
        },
      });

      // E. Cerrar Pedido y Liberar Mesa
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.ENTREGADO },
      });

      await tx.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.LIBRE },
      });

      return sale;
    });
  }

  /**
   * Helper: Cálculos monetarios precisos
   */
  private calculateTotals(items: any[]) {
    let total = 0;
    const itemsSnapshot = items.map((item) => {
      const precioUnitarioConIgv = Number(item.price);
      const subtotalItem = precioUnitarioConIgv * item.quantity;
      total += subtotalItem;

      const valorUnitario = precioUnitarioConIgv / 1.18;
      const igvItem = subtotalItem - valorUnitario * item.quantity;

      return {
        productId: item.productId,
        description: item.product.name,
        quantity: item.quantity,
        precioUnitario: precioUnitarioConIgv,
        valorUnitario: valorUnitario,
        totalItem: subtotalItem,
      };
    });

    const baseImponible = total / 1.18;
    const igvTotal = total - baseImponible;

    return {
      total: total.toFixed(2),
      baseImponible: baseImponible.toFixed(2),
      igvTotal: igvTotal.toFixed(2),
      itemsSnapshot,
    };
  }

  /**
   * Obtener datos para impresión
   */
  async findOneForPrint(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  /**
   * Helper: Convertir número a letras (implementar librería real en producción)
   */
  private numberToLetters(amount: number): string {
    // TODO: Implementar librería 'numero-a-letras' o similar
    return `SON: ${amount.toFixed(2)} SOLES`;
  }

  // async getPrintData(saleId: string) {
  //   const sale = await this.prisma.sale.findUnique({
  //     where: { id: saleId },
  //     include: {
  //       order: {
  //         include: {
  //           items: {
  //             include: {
  //               product: true,
  //             },
  //           },
  //           table: true,
  //           user: true,
  //         },
  //       },
  //       user: true,
  //     },
  //   });

  //   if (!sale) {
  //     throw new NotFoundException('Venta no encontrada');
  //   }

  //   // Obtener solo los items que pertenecen a esta venta
  //   const saleItems = sale.order.items.filter(
  //     (item) => item.saleId === sale.id,
  //   );

  //   // Formatear datos para impresión
  //   return {
  //     company: {
  //       businessName: sale.businessName,
  //       ruc: sale.ruc,
  //       address: sale.address,
  //     },
  //     document: {
  //       type: sale.type,
  //       number: sale.numeroComprobante,
  //       date: sale.createdAt,
  //     },
  //     order: {
  //       orderId: sale.order.id,
  //       orderNumber: sale.order.dailyNumber,
  //       tableName: sale.order.table.name,
  //       waiter: sale.order.user.name,
  //     },
  //     items: saleItems.map((item) => ({
  //       quantity: item.quantity,
  //       description: item.product.name,
  //       unitPrice: Number(item.price),
  //       totalItem: Number(item.price) * item.quantity,
  //       variants: item.variantsDetail,
  //       notes: item.notes,
  //     })),
  //     client: {
  //       docType: sale.clientDocType,
  //       docNumber: sale.clientDocNumber,
  //       name: sale.clientName,
  //       address: sale.clientAddress,
  //     },
  //     totals: {
  //       subtotal: Number(sale.subtotal),
  //       igv: Number(sale.igv),
  //       valorVenta: Number(sale.subtotal),
  //       precioVentaTotal: Number(sale.precioVentaTotal),
  //     },
  //     payment: {
  //       method: sale.paymentMethod,
  //       montoPagado: sale.montoPagado ? Number(sale.montoPagado) : undefined,
  //       vuelto: sale.vuelto ? Number(sale.vuelto) : undefined,
  //     },
  //     cashier: {
  //       name: sale.user.name,
  //     },
  //   };
  // }
}
