import { Body, Controller, Get, Post } from '@nestjs/common';
import { FloorsService } from './floors.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { CreateTableDto } from './dto/create-table.dto';

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
    return this.floorsService.getFloorsWithTables(user);
  }

  @Post('tables')
  @AuthAndRoleGuard(Role.ADMIN)
  createTable(@Body() createTableDto: CreateTableDto) {
    return this.floorsService.createTable(createTableDto);
  }
}
