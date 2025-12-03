import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from 'src/generated/prisma/enums';

export class CreateUserDto {
  @IsString({ message: 'El nombre es obligatorio y debe ser un texto.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  name: string;

  @IsString({ message: 'El DNI es obligatorio y debe ser un texto.' })
  @MinLength(8, { message: 'El DNI debe tener al menos 8 dígitos.' })
  dni: string;

  @IsString({
    message: 'El nombre de usuario es obligatorio y debe ser un texto.',
  })
  @MinLength(3, {
    message: 'El nombre de usuario debe tener al menos 3 caracteres.',
  })
  username: string;

  @IsString({ message: 'La contraseña es obligatoria.' })
  @MinLength(4, { message: 'La contraseña debe tener al menos 4 caracteres.' })
  password: string;

  @IsEnum(UserRole, {
    message:
      'El rol seleccionado no es válido. Debe ser uno de: ADMIN, CAJERO o MOZO.',
  })
  role: UserRole;

  @IsArray({ message: 'La lista de pisos debe ser un arreglo.' })
  @ArrayNotEmpty({ message: 'Debe asignar al menos un piso al usuario.' })
  @IsString({
    each: true,
    message: 'Cada ID de piso debe ser un texto válido.',
  })
  floors: string[];
}
