import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BillingService } from './billing.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { CreateSaleDto } from './dto/create-sale.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('pay')
  @AuthAndRoleGuard(Role.CAJERO, Role.ADMIN)
  async createSale(
    @ActiveUser() user: UserActiveI,
    @Body() dto: CreateSaleDto,
  ) {
    const result = await this.billingService.createSale2(user, dto);

    return {
      id: result.sale.id,
      numeroComprobante: result.sale.numeroComprobante,
      type: result.sale.type,
      total: parseFloat(result.sale.precioVentaTotal.toString()),
      cashMovement: result.cashMovement,
      orderStatus: result.orderStatus,
    };
  }

  @Get(':id/print-data')
  @AuthAndRoleGuard(Role.CAJERO, Role.ADMIN, Role.MOZO)
  async getPrintData(@Param('id') id: string) {
    const sale = await this.billingService.findOneForPrint(id);

    return {
      company: {
        ruc: sale.empresaRuc,
        name: sale.empresaRazonSocial,
        address: sale.empresaDireccion,
        logo: 'https://www.evilain.site/logo.webp',
      },
      document: {
        type: sale.type,
        number: sale.numeroComprobante,
        date: sale.fechaEmision,
        currency: sale.tipoMoneda,
      },
      client: {
        name: sale.clienteRazonSocial,
        doc: sale.clienteNumDoc,
        docType: sale.clienteTipoDoc,
        address: sale.clienteDireccion,
      },
      items: sale.itemsSnapshot,
      totals: {
        subtotal: parseFloat(sale.valorVenta.toString()),
        igv: parseFloat(sale.igv.toString()),
        total: parseFloat(sale.precioVentaTotal.toString()),
        totalLetters: sale.montoLetras,
      },
      payment: {
        method: sale.paymentMethod,
        montoPagado: sale.montoPagado
          ? parseFloat(sale.montoPagado.toString())
          : null,
        vuelto: sale.vuelto ? parseFloat(sale.vuelto.toString()) : null,
      },
      sunat: {
        hash: sale.hash,
        status: sale.sunatStatus,
      },
      metadata: sale.metadata || {
        mesa: '-',
        orden: '-',
        cajero: '-',
        fecha: new Date(sale.fechaEmision).toLocaleDateString('es-PE'),
        hora: new Date(sale.fechaEmision).toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    };
  }
}
