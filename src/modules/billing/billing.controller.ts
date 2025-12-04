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
  createSale(@ActiveUser() user: UserActiveI, @Body() dto: CreateSaleDto) {
    return this.billingService.createSale(user, dto);
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
        logo: 'https://icemankora.com/logo.png',
      },
      document: {
        type: sale.type, // BOLETA/FACTURA
        number: sale.numeroComprobante,
        date: sale.fechaEmision,
        currency: sale.tipoMoneda,
      },
      client: {
        name: sale.clienteRazonSocial,
        doc: sale.clienteNumDoc,
        address: sale.clienteDireccion,
      },
      items: sale.itemsSnapshot, // El JSON guardado
      totals: {
        subtotal: sale.valorVenta,
        igv: sale.igv,
        total: sale.precioVentaTotal,
        totalLetters: sale.montoLetras,
      },
      sunat: {
        hash: sale.hash, // Firma digital para el QR
        status: sale.sunatStatus,
      },
    };
  }
}
