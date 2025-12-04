import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { UpdateProductStockDailyDto } from './dto/update-product-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';

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
    return this.catalogService.getCategories(user);
  }

  /**
   * GET /catalog/products
   * Roles: ADMIN, CAJERO, MOZO
   * Devuelve productos filtrados por pisos permitidos.
   */
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Get('products')
  findAllProducts(@ActiveUser() user: UserActiveI) {
    return this.catalogService.getProducts(user);
  }

  @Post('products')
  @AuthAndRoleGuard(Role.ADMIN)
  createProduct(@Body() createProductDto: CreateProductDto) {
    return this.catalogService.createProduct(createProductDto);
  }

  /**
   * PATCH /catalog/products/:id/stock
   * Roles: ADMIN, CAJERO
   * Actualiza el stockDaily (mise en place) de un producto.
   */
  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO)
  @Patch('products/:id/stock')
  updateDailyStock(
    @Param('id') id: string,
    @Body() dto: UpdateProductStockDailyDto,
  ) {
    return this.catalogService.updateDailyStock(id, dto);
  }
}
