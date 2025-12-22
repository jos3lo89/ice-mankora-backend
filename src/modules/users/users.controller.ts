import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @AuthAndRoleGuard(Role.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @AuthAndRoleGuard(Role.ADMIN)
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Get('profile')
  profile(@ActiveUser() user: UserActiveI) {
    console.log('user', user);

    return this.usersService.profile(user.userId);
  }

  @Get('search-by-dni/:dni')
  searchByDni(@Param('dni') dni: string) {
    console.log(dni);
  }
}
