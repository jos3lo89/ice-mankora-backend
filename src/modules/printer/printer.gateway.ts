import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
type PrinterInfo = {
  id: string;
  name: string;
  ip: string;
  floorId: string;
  floorLevel: number;
};

interface PrinterClient {
  socketId: string;
  printers: Array<{
    id: string;
    name: string;
    ip: string;
    floorId: string; // ✅ CORRECCIÓN: Por piso, no por área
    floorLevel: number;
  }>;
  connectedAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*', // En producción especificar dominio
  },
  namespace: '/printer',
})
export class PrinterGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PrinterGateway.name);
  private printerClients: Map<string, PrinterClient> = new Map();

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
    client.emit('connected', {
      message: 'Conectado al servidor de impresión',
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.warn(`Cliente desconectado: ${client.id}`);
    this.printerClients.delete(client.id);
  }

  @SubscribeMessage('register-printers')
  handleRegisterPrinters(client: Socket, printers: PrinterClient['printers']) {
    this.printerClients.set(client.id, {
      socketId: client.id,
      printers,
      connectedAt: new Date(),
    });

    this.logger.log(
      `Impresoras registradas para ${client.id}: ${printers.length}`,
    );

    return {
      success: true,
      message: 'Impresoras registradas exitosamente',
      printers,
    };
  }

  @SubscribeMessage('print-confirmed')
  handlePrintConfirmation(
    client: Socket,
    data: {
      printLogId: string;
      success: boolean;
      error?: string;
    },
  ) {
    this.logger.log(
      `Confirmación de impresión: ${data.printLogId} - ${data.success ? 'Éxito' : 'Error'}`,
    );
    return { received: true };
  }

  // ✅ CORRECCIÓN: Emitir comanda a la impresora del piso
  async emitPrintComanda(comandaData: {
    printLogId: string;
    orderId: string;
    dailyNumber: number;
    tableNumber: string;
    floorId: string;
    floorName: string;
    floorLevel: number;
    items: Array<{
      name: string;
      quantity: number;
      notes: string | null;
      variantsDetail: string | null;
      categoryName: string;
    }>;
    waiter: string;
    timestamp: Date;
  }) {
    this.server.emit('print-comanda', comandaData);

    this.logger.log(
      `Comanda #${comandaData.dailyNumber} enviada a ${comandaData.floorName} - Orden: ${comandaData.orderId}`,
    );
  }

  // Verificar si hay clientes conectados
  hasConnectedClients(): boolean {
    return this.printerClients.size > 0;
  }

  getConnectedPrinters() {
    const allPrinters: PrinterInfo[] = [];
    for (const client of this.printerClients.values()) {
      allPrinters.push(...client.printers);
    }
    return {
      totalClients: this.printerClients.size,
      totalPrinters: allPrinters.length,
      printers: allPrinters,
    };
  }
  // ✅ NUEVO: Emitir ticket de pre-cuenta
  async emitPrintPreCuenta(preCuentaData: {
    printLogId: string;
    orderId: string;
    dailyNumber: number;
    tableNumber: string;
    tableName: string;
    floorId: string;
    floorName: string;
    floorLevel: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      notes: string | null;
      variantsDetail: string | null;
      categoryName: string;
    }>;
    waiter: string;
    total: number;
    subtotal: number;
    igv: number;
    timestamp: Date;
  }) {
    this.server.emit('print-pre-cuenta', preCuentaData);

    this.logger.log(
      `Pre-cuenta #${preCuentaData.dailyNumber} enviada a ${preCuentaData.floorName}`,
    );
  }
}
