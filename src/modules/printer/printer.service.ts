import { Injectable } from '@nestjs/common';
import { PrinterGateway } from './printer.gateway'; // Importar el gateway

@Injectable()
export class PrinterService {
  constructor(private readonly printerGateway: PrinterGateway) {}

  async printTicket(ticketData: any) {
    // Mandamos el trabajo a través del Gateway
    const sent = this.printerGateway.printJob({
      action: 'print_ticket',
      data: {
        printer: 'caja-pinter',
        ...ticketData,
      },
    });

    if (!sent) throw new Error('Impresora desconectada');
  }

  async printComanda(comandaData: any) {
    const sent = this.printerGateway.printJob({
      action: 'print_comanda',
      data: comandaData,
    });
    if (!sent) throw new Error('Impresora desconectada');
  }
}
