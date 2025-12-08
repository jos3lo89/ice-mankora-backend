import { IsNotEmpty, IsString } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty({
    message: 'El motivo es obligatorio para auditar la anulación.',
  })
  reason: string;

  @IsString()
  @IsNotEmpty({ message: 'Se requiere el código de autorización.' })
  authCode: string;
}
