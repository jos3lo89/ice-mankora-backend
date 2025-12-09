import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { PrinterService } from './printer.service';

@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post('ticket')
  async printTicket(@Body() body: any) {
    // El frontend envía todo el objeto de venta
    await this.printerService.printTicket({
      printer: 'caja',
      company_name: 'HELADERIA EL GUSTITO',
      company_ruc: '20601234567',
      company_address: 'Av. Los Chancas 123',
      document_type: 'BOLETA',
      document_number: body.numero, // B001-23
      date: new Date().toLocaleString(),
      table: body.mesa,
      order_number: body.orden,
      items: body.productos, // Asegurar que tenga { quantity, description, total }
      subtotal: body.subtotal,
      igv: body.igv,
      total: body.total,
      payment_method: 'EFECTIVO',
      cash_received: body.recibido,
      change: body.vuelto,
    });
    return { success: true };
  }

  @Post('comanda')
  async printComanda(@Body() body: any) {
    // El body debe decir si es 'cocina' o 'bebidas'
    await this.printerService.printComanda({
      printer: body.printer_target, // "cocina" o "bebidas"
      table: body.mesa,
      order_number: body.orden,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      waiter: body.mozo,
      items: body.items, // Array con { quantity, description, notes }
      total_items: body.items.length,
    });
    return { success: true };
  }

  @Get('test')
  async testPrint(@Query('printer') printer: string = 'caja') {
    try {
      await this.printerService.printTicket({
        printer: printer,
        company_name: 'MI RESTAURANTE - TEST',
        company_ruc: '20123456789',
        company_address: 'Av. Principal 123, Lima, Perú',
        document_type: 'TICKET DE PRUEBA',
        document_number: 'TEST-00000001',
        date: new Date().toLocaleDateString('es-PE'),
        table: 'Mesa de Prueba',
        order_number: '999',
        items: [
          {
            quantity: 1,
            description: 'Ceviche de Prueba',
            total: 35.0,
          },
          {
            quantity: 2,
            description: 'Inca Kola 500ml',
            total: 10.0,
          },
          {
            quantity: 1,
            description: 'Arroz con Mariscos',
            total: 45.0,
          },
        ],
        subtotal: 76.27, // Total / 1.18
        igv: 13.73, // Total * 0.18 / 1.18
        total: 90.0,
        payment_method: 'EFECTIVO',
        cash_received: 100.0,
        change: 10.0,
      });
    } catch (error) {
      console.log('error enviar print ->', error);
    }

    return {
      message: `✅ Ticket de prueba enviado a impresora: ${printer}`,
      printer,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-comanda')
  async testComanda(@Query('printer') printer: string = 'cocina') {
    await this.printerService.printComanda({
      printer: printer,
      table: 'Mesa 5',
      order_number: '42',
      date: new Date().toLocaleDateString('es-PE'),
      time: new Date().toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      waiter: 'Juan Pérez - TEST',
      items: [
        {
          quantity: 2,
          description: 'Ceviche Especial',
          variants: 'Con ají amarillo',
          notes: 'Sin cebolla',
        },
        {
          quantity: 1,
          description: 'Lomo Saltado',
          variants: null,
          notes: 'Término medio',
        },
        {
          quantity: 3,
          description: 'Chicha Morada',
          variants: 'Jarra',
          notes: null,
        },
      ],
      total_items: 3,
    });

    return {
      message: `✅ Comanda de prueba enviada a impresora: ${printer}`,
      printer,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }
}
