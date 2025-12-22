import { BadRequestException, Injectable } from '@nestjs/common';
import { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Decimal } from 'src/generated/prisma/internal/prismaNamespace';
import { UpdateProductState } from './dto/update-product-state.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // se usa
  async getCategories(user: UserActiveI) {
    if (!user.allowedFloorIds || user.allowedFloorIds.length === 0) {
      throw new BadRequestException(
        'El usuario no tiene pisos asignados. Contacte al administrador.',
      );
    }

    const newCategorias = await this.prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
      },
    });

    return newCategorias;
  }

  // se usa
  async getProducts(user: UserActiveI) {
    if (!user.allowedFloorIds || user.allowedFloorIds.length === 0) {
      throw new BadRequestException(
        'El usuario no tiene pisos asignados. Contacte al administrador.',
      );
    }

    const products = await this.prisma.product.findMany({
      orderBy: {
        name: 'asc',
      },

      include: {
        variants: {
          select: {
            id: true,
            name: true,
            isActive: true,
            priceExtra: true,
            productId: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return products;
  }

  async createProduct(dto: CreateProductDto) {
    const newProduct = await this.prisma.product.create({
      data: {
        name: dto.name,
        description:
          dto.description || `Delicioso ${dto.name} estilo Ice Mankora`,
        price: Decimal(dto.price),
        categoryId: dto.categoryId,
        stockDaily: dto.stockDaily,
        isStockManaged: dto.isStockManaged,
        isActive: dto.isActive,
        stockWarehouse: dto.stockWarehouse,
        taxType: 'GRAVADO',
        igvRate: 0.18,
      },
    });

    if (!newProduct) {
      throw new BadRequestException('No se pudo registrar el producto');
    }

    return newProduct;
  }

  async updateProduct(dto: CreateProductDto, id: string) {
    const newProduct = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description:
          dto.description || `Delicioso ${dto.name} estilo Ice Mankora`,
        price: Decimal(dto.price),
        categoryId: dto.categoryId,
        stockDaily: dto.stockDaily,
        isStockManaged: dto.isStockManaged,
        isActive: dto.isActive,
        stockWarehouse: dto.stockWarehouse,
        taxType: 'GRAVADO',
        igvRate: 0.18,
      },
    });

    if (!newProduct) {
      throw new BadRequestException('No se pudo actualizar el producto');
    }

    return newProduct;
  }

  async updateProductStatus(dto: UpdateProductState, id: string) {
    const newProduct = await this.prisma.product.update({
      where: { id },
      data: {
        isActive: dto.isActive,
      },
    });

    if (!newProduct) {
      throw new BadRequestException('No se pudo actualizar el producto');
    }

    return newProduct;
  }
}
