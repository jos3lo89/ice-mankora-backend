import { Controller, Get } from '@nestjs/common';
import { FloorsService } from './floors.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';

@Controller('floors')
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  /**
   * GET /floors/tables
   * Roles: ADMIN, CAJERO, MOZO
   * Devuelve: Pisos + Mesas (mapa interactivo).
   */
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Get('tables')
  getFloorsWithTables(@ActiveUser() user: UserActiveI) {
    return this.floorsService.findFloorsWithTables(user);
  }
}
