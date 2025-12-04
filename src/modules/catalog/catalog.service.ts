import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UpdateProductStockDto } from './dto/update-product-stock.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista categorías visibles según los pisos permitidos del usuario.
   * Solo devuelve categorías que estén asociadas al menos a uno de los pisos
   * en user.allowedFloorIds.
   */
  async findAllCategories(user: UserActiveI) {
    if (!user.allowedFloorIds || user.allowedFloorIds.length === 0) {
      throw new BadRequestException(
        'El usuario no tiene pisos asignados. Contacte al administrador.',
      );
    }

    const categories = await this.prisma.category.findMany({
      where: {
        floors: {
          some: {
            id: {
              in: user.allowedFloorIds,
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        floors: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    return categories;
  }

  /**
   * Lista productos visibles según los pisos permitidos del usuario.
   * Filtra por la relación Category -> floors.
   */
  async findAllProducts(user: UserActiveI) {
    if (!user.allowedFloorIds || user.allowedFloorIds.length === 0) {
      throw new BadRequestException(
        'El usuario no tiene pisos asignados. Contacte al administrador.',
      );
    }

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        category: {
          floors: {
            some: {
              id: {
                in: user.allowedFloorIds,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return products;
  }

  /**
   * Actualiza el stockDaily de un producto.
   * Usado por ADMIN/CAJERO cuando “ya no hay X producto”.
   */
  async updateProductStock(id: string, dto: UpdateProductStockDto) {
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          stockDaily: dto.stockDaily,
        },
        select: {
          id: true,
          name: true,
          stockDaily: true,
          isStockManaged: true,
        },
      });

      return product;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Producto no encontrado.');
      }

      throw new BadRequestException(
        'No se pudo actualizar el stock del producto.',
      );
    }
  }
}
