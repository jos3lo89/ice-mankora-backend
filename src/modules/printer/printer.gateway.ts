import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true })
export class PrinterGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger('PrinterGateway');

  // Aquí guardaremos la conexión de tu PC de impresoras
  private printerSocket: Socket | null = null;

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
    // Podrías validar un token aquí para seguridad
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
    if (this.printerSocket?.id === client.id) {
      this.printerSocket = null;
    }
  }

  // Python nos mandará un mensaje "register" para decir "Soy la PC de impresoras"
  @SubscribeMessage('register_printer')
  handleRegister(client: Socket, payload: any) {
    this.printerSocket = client;
    this.logger.log(
      '🖨️ PC de Impresoras registrada y lista para recibir trabajos.',
    );
    return { status: 'registered' };
  }

  // Método público para enviar trabajos a Python
  printJob(data: any) {
    if (!this.printerSocket) {
      this.logger.error('❌ No hay ninguna PC de impresoras conectada.');
      return false;
    }

    // Enviamos el evento 'print_job' a Python
    this.printerSocket.emit('print_job', data);
    return true;
  }
}
