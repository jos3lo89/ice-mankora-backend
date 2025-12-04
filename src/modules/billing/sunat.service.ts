import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { SunatStatus } from 'src/generated/prisma/enums';
export class SunatService {
  constructor(private readonly prisma: PrismaService) {}

  async emitirComprobante(saleId: string) {
    // 1. Obtener venta
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return;

    try {
      // PASO A: GENERAR XML (Usar librería XMLBuilder)
      // const xmlContent = ...

      // PASO B: FIRMAR XML (Usar librería crypto o xml-crypto con tu .pfx)
      // const signedXml = ...

      // PASO C: ENVIAR A SUNAT (Axios POST a servicio SOAP)
      // const response = ...

      // PASO D: GUARDAR CDR Y ACTUALIZAR ESTADO
      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          sunatStatus: SunatStatus.ACEPTADO,
          xmlFileName: `${sale.empresaRuc}-01-${sale.numeroComprobante}.xml`,
          // cdrCode: response.code
        },
      });
    } catch (error) {
      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          sunatStatus: SunatStatus.RECHAZADO,
          errorMensaje: error.message,
        },
      });
    }
  }
}
