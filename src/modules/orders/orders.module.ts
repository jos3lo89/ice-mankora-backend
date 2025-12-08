import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrinterModule } from '../printer/printer.module';
import { PrinterService } from '../printer/printer.service';
import { PrinterGateway } from '../printer/printer.gateway';

@Module({
  imports: [PrinterModule],
  controllers: [OrdersController],
  providers: [OrdersService, PrinterService, PrinterGateway],
})
export class OrdersModule {}
