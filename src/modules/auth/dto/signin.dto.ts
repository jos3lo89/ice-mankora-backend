import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SigninDto {
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @IsString({ message: 'El nombre de usuario debe ser una cadena' })
  username: string;

  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsString({ message: 'La contraseña debe ser una cadena' })
  @MinLength(4, { message: 'La contraseña debe tener al menos 4 caracteres' })
  password: string;
}
