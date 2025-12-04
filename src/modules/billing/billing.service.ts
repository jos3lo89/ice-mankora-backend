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
      },
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.sale) throw new ConflictException('Este pedido ya fue cobrado.');
    if (order.status === OrderStatus.CANCELADO)
      throw new BadRequestException('El pedido está anulado.');

    // 2. Validaciones SUNAT (Boleta vs Factura)
    if (dto.type === ComprobanteType.FACTURA) {
      if (dto.clientDocType !== '6')
        throw new BadRequestException('Para Factura se requiere RUC (Tipo 6).');
      if (!dto.clientDocNumber || dto.clientDocNumber.length !== 11)
        throw new BadRequestException('RUC inválido.');
    }

    // 3. Cálculos Matemáticos (Totales e Impuestos)
    const { total, baseImponible, igvTotal, itemsSnapshot } =
      this.calculateTotals(order.items);

    // 4. TRANSACCIÓN (Cobro + Correlativo + Cierre Mesa)
    return await this.prisma.$transaction(async (tx) => {
      // A. Generar Correlativo (Serie y Número)
      // Serie sugerida: F001 (Factura), B001 (Boleta) - Esto podrías configurarlo por caja
      const serie = dto.type === ComprobanteType.FACTURA ? 'F001' : 'B001';

      // Buscar el último número usado para esa serie
      const lastSale = await tx.sale.findFirst({
        where: { serie, type: dto.type },
        orderBy: { correlativo: 'desc' },
      });

      const nuevoCorrelativo = (lastSale?.correlativo || 0) + 1;
      const numeroComprobante = `${serie}-${String(nuevoCorrelativo).padStart(8, '0')}`;

      // B. Crear Cliente si no existe (o actualizarlo)
      let clientId: string | null = null;

      if (dto.clientDocNumber) {
        const client = await tx.client.upsert({
          where: { docNumber: dto.clientDocNumber },
          update: {
            name: dto.clientName,
            address: dto.clientAddress,
          },
          create: {
            docType: dto.clientDocType || '1',
            docNumber: dto.clientDocNumber,
            name: dto.clientName || 'CLIENTE GENERICO',
            address: dto.clientAddress,
            email: '',
          },
        });
        clientId = client.id;
      }

      // C. CREAR LA VENTA (El Snapshot Gigante)
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

          // Datos Emisor (TU RESTAURANTE - Esto debería venir de config/env)
          empresaRuc: '20600000001',
          empresaRazonSocial: 'ICE MANKORA S.A.C.',
          empresaDireccion: 'Av. Principal 123, Andahuaylas',
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
          montoLetras: this.numberToLetters(Number(total)), // Helper abajo

          // Items (JSON)
          itemsSnapshot: itemsSnapshot,

          // Estados y Pago
          sunatStatus: SunatStatus.PENDIENTE, // Listo para que el CRON JOB lo envíe
          paymentMethod: dto.paymentMethod,
          formaPago: 'Contado',
        },
      });

      // D. Cerrar Pedido y Liberar Mesa
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.ENTREGADO }, // O FINALIZADO
      });

      await tx.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.LIBRE }, // ¡Mesa libre para nuevos clientes!
      });

      // E. (OPCIONAL) Disparar envío asíncrono a SUNAT aquí
      // this.sunatService.sendToSunat(sale.id);

      return sale;
    });
  }

  /**
   * Helper: Cálculos monetarios precisos
   */
  private calculateTotals(items: any[]) {
    let total = 0;
    const itemsSnapshot = items.map((item) => {
      // El precio en OrderItem ya incluye IGV (Precio Lista)
      const precioUnitarioConIgv = Number(item.price);
      const subtotalItem = precioUnitarioConIgv * item.quantity;

      total += subtotalItem;

      // Desglose Unitario para SUNAT (Valor Unitario sin IGV)
      const valorUnitario = precioUnitarioConIgv / 1.18;
      const igvItem = subtotalItem - valorUnitario * item.quantity;

      return {
        productId: item.productId,
        description: item.product.name, // Snapshot del nombre
        quantity: item.quantity,
        precioUnitario: precioUnitarioConIgv, // Incluye IGV
        valorUnitario: valorUnitario, // Base imponible
        totalItem: subtotalItem,
      };
    });

    // Totales Globales
    const baseImponible = total / 1.18;
    const igvTotal = total - baseImponible;

    return {
      total: total.toFixed(2),
      baseImponible: baseImponible.toFixed(2),
      igvTotal: igvTotal.toFixed(2),
      itemsSnapshot,
    };
  }

  // --- MÉTODOS AUXILIARES ---
  async findOneForPrint(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  /**
   * Helper simple (En producción usar librería 'numeros_a_letras')
   */
  private numberToLetters(amount: number): string {
    return `SON: ${amount.toFixed(2)} SOLES`; // Implementar librería real
  }
}
