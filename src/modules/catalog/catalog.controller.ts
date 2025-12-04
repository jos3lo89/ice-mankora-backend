import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { UpdateProductStockDto } from './dto/update-product-stock.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * GET /catalog/categories
   * Roles: ADMIN, CAJERO, MOZO
   * Devuelve las categorías visibles para los pisos del usuario.
   */
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Get('categories')
  findAllCategories(@ActiveUser() user: UserActiveI) {
    return this.catalogService.findAllCategories(user);
  }

  /**
   * GET /catalog/products
   * Roles: ADMIN, CAJERO, MOZO
   * Devuelve productos filtrados por pisos permitidos.
   */
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Get('products')
  findAllProducts(@ActiveUser() user: UserActiveI) {
    return this.catalogService.findAllProducts(user);
  }

  /**
   * PATCH /catalog/products/:id/stock
   * Roles: ADMIN, CAJERO
   * Actualiza el stockDaily (mise en place) de un producto.
   */
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO)
  @Patch('products/:id/stock')
  updateProductStock(
    @Param('id') id: string,
    @Body() dto: UpdateProductStockDto,
  ) {
    return this.catalogService.updateProductStock(id, dto);
  }
}
