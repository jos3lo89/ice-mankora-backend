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
              ? SunatStatus.PENDIENTE //arregalr
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
}
