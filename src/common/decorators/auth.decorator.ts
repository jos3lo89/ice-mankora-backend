import { applyDecorators, UseGuards } from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { Roles } from './role.decorator';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/role.guard';

export function AuthAndRoleGuard(...roles: Role[]) {
  return applyDecorators(Roles(...roles), UseGuards(AuthGuard, RolesGuard));
}

// export function AuthGuardOnly() {
//   return applyDecorators(UseGuards(AuthGuard));
// }

// export function RolesGuardOnly(...roles: Role[]) {
//   return applyDecorators(Roles(...roles), UseGuards(RolesGuard));
// }

// import { applyDecorators, UseGuards } from '@nestjs/common';
// import { AuthGuard } from 'src/common/guards/auth.guard';

// export function Auth() {
//   return applyDecorators(UseGuards(AuthGuard));
// }
