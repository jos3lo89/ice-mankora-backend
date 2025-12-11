import { Controller, Get, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // se usa
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Get('categories')
  findAllCategories(@ActiveUser() user: UserActiveI) {
    return this.catalogService.getCategories(user);
  }

  // se usa
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Get('products')
  findAllProducts(@ActiveUser() user: UserActiveI) {
    return this.catalogService.getProducts(user);
  }
}
