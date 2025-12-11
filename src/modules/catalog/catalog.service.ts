import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { PrismaService } from 'src/core/prisma/prisma.service';

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
      include: {
        products: true,
        floors: true,
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

    const products2 = await this.prisma.product.findMany({
      orderBy: {
        name: 'asc',
      },

      include: {
        variants: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return products2;
  }
}
