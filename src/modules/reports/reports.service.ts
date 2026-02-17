import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { GetSalesReportDto } from './dto/get-sales-report.dto';
import { SunatStatus } from 'src/generated/prisma/enums';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // async getSalesReport(dto: GetSalesReportDto) {
  //   // 1. Definir el Rango de Fechas
  //   // Si no envían fechas, tomamos el día de HOY por defecto
  //   const start = dto.startDate
  //     ? new Date(dto.startDate)
  //     : new Date(new Date().setHours(0, 0, 0, 0));

  //   const end = dto.endDate
  //     ? new Date(new Date(dto.endDate).setHours(23, 59, 59, 999))
  //     : new Date(new Date().setHours(23, 59, 59, 999));

  //   // Convertimos a ISO String para asegurar compatibilidad con PostgreSQL
  //   const startIso = start.toISOString();
  //   const endIso = end.toISOString();

  //   // ---------------------------------------------------------
  //   // A. TOTAL GLOBAL (La "Verdad" Financiera)
  //   // ---------------------------------------------------------
  //   // Usamos aggregate de Prisma, es muy seguro para sumas simples.
  //   // FILTRO CLAVE: sunatStatus NOT IN (ANULADO, RECHAZADO)
  //   const globalSummary = await this.prisma.sale.aggregate({
  //     where: {
  //       fechaEmision: { gte: start, lte: end },
  //       sunatStatus: { notIn: [SunatStatus.ANULADO, SunatStatus.RECHAZADO] },
  //     },
  //     _sum: {
  //       precioVentaTotal: true, // Total cobrado
  //     },
  //     _count: {
  //       id: true, // Cantidad de tickets
  //     },
  //   });

  //   // ---------------------------------------------------------
  //   // B. DESGLOSE DIARIO (Para ver la evolución por día)
  //   // ---------------------------------------------------------
  //   // Agrupamos por día (YYYY-MM-DD) para que vean qué día se disparó la venta
  //   const dailySales: any[] = await this.prisma.$queryRaw`
  //     SELECT
  //       TO_CHAR(s."fechaEmision", 'YYYY-MM-DD') as "fecha",
  //       COUNT(s.id) as "transacciones",
  //       SUM(s."precioVentaTotal") as "total_dia"
  //     FROM "sales" s
  //     WHERE s."fechaEmision" >= ${start}::timestamp
  //       AND s."fechaEmision" <= ${end}::timestamp
  //       AND s."sunatStatus" NOT IN ('ANULADO', 'RECHAZADO')
  //     GROUP BY TO_CHAR(s."fechaEmision", 'YYYY-MM-DD')
  //     ORDER BY "fecha" ASC
  //   `;

  //   // ---------------------------------------------------------
  //   // C. DESGLOSE POR PRODUCTOS (Lo que pidió el cliente)
  //   // ---------------------------------------------------------
  //   // Aquí mostramos: Producto | Cantidad | Precio Unitario Promedio | Total Recaudado
  //   const productsRanking: any[] = await this.prisma.$queryRaw`
  //     SELECT
  //       p.name as "producto",
  //       SUM(oi.quantity) as "cantidad",
  //       -- Calculamos un precio unitario promedio referencial (Total / Cantidad)
  //       ROUND(SUM(oi.quantity * oi.price) / SUM(oi.quantity), 2) as "precio_unitario",
  //       SUM(oi.quantity * oi.price) as "total_vendido"
  //     FROM "order_items" oi
  //     JOIN "sales" s ON oi."saleId" = s.id
  //     JOIN "products" p ON oi."productId" = p.id
  //     WHERE s."fechaEmision" >= ${start}::timestamp
  //       AND s."fechaEmision" <= ${end}::timestamp
  //       AND s."sunatStatus" NOT IN ('ANULADO', 'RECHAZADO')
  //     GROUP BY p.name
  //     ORDER BY "total_vendido" DESC
  //   `;

  //   // ---------------------------------------------------------
  //   // D. RESPUESTA FINAL
  //   // ---------------------------------------------------------
  //   return {
  //     rango: {
  //       inicio: startIso,
  //       fin: endIso,
  //     },
  //     resumen_global: {
  //       total_recaudado: Number(globalSummary._sum.precioVentaTotal ?? 0),
  //       tickets_emitidos: globalSummary._count.id ?? 0,
  //     },
  //     reporte_diario: dailySales.map((d) => ({
  //       fecha: d.fecha,
  //       tickets: Number(d.transacciones),
  //       total: Number(d.total_dia),
  //     })),
  //     detalle_productos: productsRanking.map((p) => ({
  //       producto: p.producto,
  //       cantidad: Number(p.cantidad),
  //       precio_unitario: Number(p.precio_unitario), // Precio referencial
  //       total_vendido: Number(p.total_vendido), // EL DATO IMPORTANTE
  //     })),
  //   };
  // }
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
}
