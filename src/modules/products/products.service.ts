import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Decimal } from 'src/generated/prisma/internal/prismaNamespace';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}
  async create(createProductDto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: createProductDto.name,
        description: createProductDto.description,
        price: new Decimal(createProductDto.price),
        categoryId: createProductDto.categoryId,
        isStockManaged: createProductDto.isStockManaged ?? true,
        stockDaily: createProductDto.stockDaily ?? 50,
        stockWarehouse: createProductDto.stockWarehouse ?? 100,
        taxType: createProductDto.taxType ?? 'GRAVADO',
        igvRate: createProductDto.igvRate
          ? new Decimal(createProductDto.igvRate)
          : new Decimal(0.18),
        isActive: createProductDto.isActive ?? true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async findAll(categoryId?: string) {
    return this.prisma.product.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            floors: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name: updateProductDto.name,
        description: updateProductDto.description,
        price: updateProductDto.price
          ? new Decimal(updateProductDto.price)
          : undefined,
        categoryId: updateProductDto.categoryId,
        isStockManaged: updateProductDto.isStockManaged,
        stockDaily: updateProductDto.stockDaily,
        stockWarehouse: updateProductDto.stockWarehouse,
        taxType: updateProductDto.taxType,
        igvRate: updateProductDto.igvRate
          ? new Decimal(updateProductDto.igvRate)
          : undefined,
        isActive: updateProductDto.isActive,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        orderItems: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Soft delete en lugar de eliminar
    return this.prisma.product.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
