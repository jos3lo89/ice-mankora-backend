import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PrinterService } from '../printer/printer.service';
import { PrinterGateway } from '../printer/printer.gateway';

@Module({
  controllers: [BillingController],
  providers: [BillingService, PrinterService, PrinterGateway],
})
export class BillingModule {}
