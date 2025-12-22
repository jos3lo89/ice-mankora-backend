import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorators/activeUser.decorator';
import type { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductState } from './dto/update-product-state.dto';

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

  @AuthAndRoleGuard(Role.ADMIN)
  @Post('products')
  createProducts(@Body() body: CreateProductDto) {
    return this.catalogService.createProduct(body);
  }

  @AuthAndRoleGuard(Role.ADMIN)
  @Put('products/:id')
  updateProducts(@Body() body: CreateProductDto, @Param('id') id: string) {
    return this.catalogService.updateProduct(body, id);
  }

  @AuthAndRoleGuard(Role.ADMIN)
  @Patch('products/:id/status')
  updateProductState(
    @Body() body: UpdateProductState,
    @Param('id') id: string,
  ) {
    return this.catalogService.updateProductStatus(body, id);
  }
}
