import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ComprobanteType, PaymentMethod } from 'src/generated/prisma/enums';

export class CreateSaleDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string; // ¿Qué pedido estamos cobrando?

  @IsEnum(ComprobanteType)
  type: ComprobanteType; // BOLETA o FACTURA

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod; // Efectivo, Tarjeta, etc.

  // Datos del Cliente (Obligatorio si es Factura, Opcional si es Boleta < S/700)
  @IsString()
  @IsOptional()
  clientDocType?: string; // "1" (DNI) o "6" (RUC)

  @IsString()
  @IsOptional()
  clientDocNumber?: string;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientAddress?: string;
}
