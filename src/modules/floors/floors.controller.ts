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

  // se usa
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Get('tables')
  getFloorsWithTables() {
    return this.floorsService.getFloorsWithTables();
  }

  @AuthAndRoleGuard(Role.ADMIN)
  @Get('for-user-register')
  getFloorsForUserRegister() {
    return this.floorsService.getFloorForUserRegister();
  }

  @Post('tables')
  @AuthAndRoleGuard(Role.ADMIN)
  createTable(@Body() createTableDto: CreateTableDto) {
    return this.floorsService.createTable(createTableDto);
  }
}
