import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { GetSalesReportDto } from './dto/get-sales-report.dto';
import { SunatStatus } from 'src/generated/prisma/enums';
import { GetProductsReportDto } from './dto/get-products-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(dto: GetSalesReportDto) {
    // 1. CONFIGURACIÓN DE FECHAS PARA PERÚ (UTC-5)
    // Truco: Construimos la fecha forzando la zona horaria de Perú (-05:00)
    // Esto asegura que start sea 00:00:00 en Perú y end sea 23:59:59 en Perú

    const startDateStr = dto.startDate
      ? dto.startDate
      : new Date().toISOString().split('T')[0];

    const endDateStr = dto.endDate ? dto.endDate : startDateStr;

    // Creamos objetos Date que representan el inicio y fin del día EN PERÚ,
    // pero convertidos al instante UTC correcto para que Prisma busque bien.
    // Ej: 16 Feb 00:00 Peru -> 16 Feb 05:00 UTC
    const start = new Date(`${startDateStr}T00:00:00-05:00`);
    const end = new Date(`${endDateStr}T23:59:59.999-05:00`);

    // ---------------------------------------------------------
    // A. TOTAL GLOBAL
    // ---------------------------------------------------------
    // Prisma maneja la conversión automática si le pasamos los objetos Date correctos creados arriba
    const globalSummary = await this.prisma.sale.aggregate({
      where: {
        fechaEmision: { gte: start, lte: end },
        sunatStatus: { notIn: [SunatStatus.ANULADO, SunatStatus.RECHAZADO] },
      },
      _sum: {
        precioVentaTotal: true,
      },
      _count: {
        id: true,
      },
    });

    // ---------------------------------------------------------
    // B. DESGLOSE DIARIO (CON CORRECCIÓN DE ZONA HORARIA)
    // ---------------------------------------------------------
    // AT TIME ZONE 'America/Lima': Convierte la hora UTC de la BD a hora Perú antes de extraer el día.
    const dailySales: any[] = await this.prisma.$queryRaw`
      SELECT 
        TO_CHAR(s."fechaEmision" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima', 'YYYY-MM-DD') as "fecha",
        COUNT(s.id) as "transacciones",
        SUM(s."precioVentaTotal") as "total_dia"
      FROM "sales" s
      WHERE s."fechaEmision" >= ${start}
        AND s."fechaEmision" <= ${end}
        AND s."sunatStatus" NOT IN ('ANULADO', 'RECHAZADO')
      GROUP BY TO_CHAR(s."fechaEmision" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima', 'YYYY-MM-DD')
      ORDER BY "fecha" ASC
    `;

    // ---------------------------------------------------------
    // C. DESGLOSE POR PRODUCTOS
    // ---------------------------------------------------------
    const productsRanking: any[] = await this.prisma.$queryRaw`
      SELECT 
        p.name as "producto",
        SUM(oi.quantity) as "cantidad",
        ROUND(SUM(oi.quantity * oi.price) / SUM(oi.quantity), 2) as "precio_unitario",
        SUM(oi.quantity * oi.price) as "total_vendido"
      FROM "order_items" oi
      JOIN "sales" s ON oi."saleId" = s.id
      JOIN "products" p ON oi."productId" = p.id
      WHERE s."fechaEmision" >= ${start}
        AND s."fechaEmision" <= ${end}
        AND s."sunatStatus" NOT IN ('ANULADO', 'RECHAZADO')
      GROUP BY p.name
      ORDER BY "total_vendido" DESC
    `;

    // ---------------------------------------------------------
    // D. RESPUESTA FINAL
    // ---------------------------------------------------------
    return {
      rango: {
        inicio: start.toISOString(),
        fin: end.toISOString(),
      },
      resumen_global: {
        total_recaudado: Number(globalSummary._sum.precioVentaTotal ?? 0),
        tickets_emitidos: globalSummary._count.id ?? 0,
      },
      reporte_diario: dailySales.map((d) => ({
        fecha: d.fecha,
        tickets: Number(d.transacciones),
        total: Number(d.total_dia),
      })),
      detalle_productos: productsRanking.map((p) => ({
        producto: p.producto,
        cantidad: Number(p.cantidad),
        precio_unitario: Number(p.precio_unitario),
        total_vendido: Number(p.total_vendido),
      })),
    };
  }

  async getProductsReport(dto: GetProductsReportDto) {
    const today = new Date().toISOString().split('T')[0];
    const fecha_inicio = dto.fecha_inicio ?? today;
    const fecha_fin = dto.fecha_fin ?? today;

    // Peru es UTC-5, así que para cubrir el día completo peruano:
    // inicio del día Peru (00:00 PE) = 05:00 UTC
    // fin del día Peru (23:59 PE) = 28:59 UTC del mismo día = 04:59 UTC del día siguiente
    const inicio = new Date(`${fecha_inicio}T05:00:00.000Z`);
    const fin = new Date(`${fecha_fin}T04:59:59.999Z`);
    // Fin: sumamos 1 día y restamos 1ms para cubrir hasta las 23:59:59 PE
    fin.setDate(fin.getDate() + 1);

    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        isActive: true,
        createdAt: {
          gte: inicio,
          lte: fin,
        },
        order: {
          status: {
            not: 'CANCELADO',
          },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
    });

    // Traer nombres de productos
    const productIds = items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: { select: { name: true } } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      fecha_inicio,
      fecha_fin,
      total_productos: items.length,
      productos: items.map((item, index) => ({
        ranking: index + 1,
        productId: item.productId,
        nombre: productMap.get(item.productId)?.name ?? 'Desconocido',
        categoria: productMap.get(item.productId)?.category?.name ?? '-',
        cantidad_vendida: item._sum.quantity ?? 0,
      })),
    };
  }
}
