import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ComprobanteType, PaymentMethod } from 'src/generated/prisma/enums';

export class CreateSaleDto {
  @IsString()
  orderId: string;

  @IsEnum(ComprobanteType)
  type: ComprobanteType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  // ✅ Nuevo: Datos de pago
  @IsOptional()
  @IsNumber()
  montoPagado?: number;

  @IsOptional()
  @IsNumber()
  vuelto?: number;

  // Cliente (obligatorio para Boleta/Factura)
  @IsOptional()
  @IsString()
  clientDocType?: string; // "1" DNI, "6" RUC

  @IsOptional()
  @IsString()
  clientDocNumber?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientAddress?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  // División de cuenta (opcional)
  @IsOptional()
  @IsArray()
  itemIds?: string[];
}
