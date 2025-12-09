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
    return this.billingService.createSale2(user, dto);
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
      items: sale.itemsSnapshot, // El JSON guardado
      totals: {
        subtotal: sale.valorVenta,
        igv: sale.igv,
        total: sale.precioVentaTotal,
        totalLetters: sale.montoLetras,
      },
      payment: {
        method: sale.paymentMethod,
        montoPagado: sale.montoPagado,
        vuelto: sale.vuelto,
      },
      sunat: {
        hash: sale.hash, // Firma digital para el QR
        status: sale.sunatStatus,
      },
      // ✅ Metadata adicional
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

// import {
//   Controller,
//   Post,
//   Body,
//   Get,
//   Param,
//   Query,
//   UseGuards,
// } from '@nestjs/common';
// import { BillingService } from './billing.service';
// import { CreateSaleDto } from './dto/create-sale.dto';
// import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
// import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
// import { PrinterService } from '../printer/printer.service';

// @Controller('billing')
// export class BillingController {
//   constructor(
//     private readonly billingService: BillingService,
//     private readonly printerService: PrinterService,
//   ) {}

//   @Post('pay')
//   async createSale(
//     @ActiveUser() user: UserActiveI,
//     @Body() createSaleDto: CreateSaleDto,
//   ) {

//     console.log("pay ->",createSaleDto, user);

//     const sale = await this.billingService.createSale(user, createSaleDto);

//     // ✅ Imprimir ticket automáticamente si es necesario
//     // (Opcional: puedes descomentar esto si quieres impresión automática)
//     // await this.printSaleTicket(sale.id);

//     return sale;
//   }

//   // @Get('print-data/:saleId')
//   // getPrintData(@Param('saleId') saleId: string) {
//   //   return this.billingService.getPrintData(saleId);
//   // }

//   /**
//    * ✅ NUEVO: Endpoint para imprimir ticket en impresora térmica
//    */
//   @Post('print-ticket')
//   async printTicket(@Body() ticketData: any) {
//     try {
//       await this.printerService.printTicket({
//         printer: ticketData.printer || 'caja',
//         company_name: ticketData.company_name,
//         company_ruc: ticketData.company_ruc,
//         company_address: ticketData.company_address,
//         document_type: ticketData.document_type,
//         document_number: ticketData.document_number,
//         date: ticketData.date,
//         table: ticketData.table,
//         order_number: ticketData.order_number,
//         items: ticketData.items,
//         subtotal: ticketData.subtotal,
//         igv: ticketData.igv,
//         total: ticketData.total,
//         payment_method: ticketData.payment_method,
//         cash_received: ticketData.cash_received,
//         change: ticketData.change,
//       });

//       return {
//         message: 'Ticket enviado a impresora correctamente',
//         printer: ticketData.printer || 'caja',
//       };
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * ✅ Reimprimir ticket de una venta existente
//    */
//   // @Post('print-ticket/:saleId')
//   // async reprintTicket(
//   //   @Param('saleId') saleId: string,
//   //   @Query('printer') printer: string = 'caja',
//   // ) {

//   //   const printData = await this.billingService.getPrintData(saleId);

//   //   await this.printerService.printTicket({
//   //     printer,
//   //     company_name: printData.company.businessName,
//   //     company_ruc: printData.company.ruc,
//   //     company_address: printData.company.address,
//   //     document_type: printData.document.type,
//   //     document_number: printData.document.number,
//   //     date: new Date(printData.document.date).toLocaleDateString('es-PE'),
//   //     table: printData.order.tableName || '',
//   //     order_number: printData.order.orderNumber || '',
//   //     items: printData.items.map((item) => ({
//   //       quantity: item.quantity,
//   //       description: item.description,
//   //       total: item.totalItem,
//   //     })),
//   //     subtotal: printData.totals.valorVenta,
//   //     igv: printData.totals.igv,
//   //     total: printData.totals.precioVentaTotal,
//   //     payment_method: printData.payment?.method,
//   //     cash_received: printData.payment?.montoPagado,
//   //     change: printData.payment?.vuelto,
//   //   });

//   //   return {
//   //     message: 'Ticket reimpreso correctamente',
//   //     printer,
//   //   };
//   // }
// }
