import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FloorsModule } from './modules/floors/floors.module';
import { OrdersModule } from './modules/orders/orders.module';
import { BillingModule } from './modules/billing/billing.module';
import { PrinterModule } from './modules/printer/printer.module';
import { CategoriesModule } from './modules/categories/categories.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),
    AuthModule,
    UsersModule,
    CatalogModule,
    FloorsModule,
    OrdersModule,
    BillingModule,
    PrinterModule,
    CategoriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
