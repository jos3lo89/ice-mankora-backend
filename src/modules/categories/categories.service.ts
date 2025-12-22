import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    // Validar que el slug sea único
    const existingSlug = await this.prisma.category.findFirst({
      where: { slug: createCategoryDto.slug },
    });

    if (existingSlug) {
      throw new BadRequestException('El slug ya existe');
    }

    // Validar que los pisos existen
    if (createCategoryDto.floorIds.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un piso');
    }

    const floors = await this.prisma.floor.findMany({
      where: { id: { in: createCategoryDto.floorIds } },
    });

    if (floors.length !== createCategoryDto.floorIds.length) {
      throw new BadRequestException('Algunos pisos no existen');
    }

    // Crear categoría
    return this.prisma.category.create({
      data: {
        name: createCategoryDto.name,
        slug: createCategoryDto.slug,
        parentId: createCategoryDto.parentId,
        floors: {
          connect: createCategoryDto.floorIds.map((id) => ({ id })),
        },
      },
      include: {
        floors: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        products: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            categoryId: true,
            isStockManaged: true,
            stockDaily: true,
            stockWarehouse: true,
            taxType: true,
            igvRate: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                orderItems: true,
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
        },
        floors: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        floors: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        products: {
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            categoryId: true,
            isStockManaged: true,
            stockDaily: true,
            stockWarehouse: true,
            taxType: true,
            igvRate: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                orderItems: true,
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
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Validar slug único si se está actualizando
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existingSlug = await this.prisma.category.findFirst({
        where: {
          slug: updateCategoryDto.slug,
          id: { not: id },
        },
      });

      if (existingSlug) {
        throw new BadRequestException('El slug ya existe');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: updateCategoryDto.name,
        slug: updateCategoryDto.slug,
        parentId: updateCategoryDto.parentId,
        ...(updateCategoryDto.floorIds && {
          floors: {
            set: [], // Desconectar todos
            connect: updateCategoryDto.floorIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        products: {
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            categoryId: true,
            isStockManaged: true,
            stockDaily: true,
            stockWarehouse: true,
            taxType: true,
            igvRate: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                orderItems: true,
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
        },
        floors: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (category.products.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoría con productos. Elimine los productos primero.',
      );
    }

    if (category.children.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoría con subcategorías.',
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async getCategories() {
    const categories = await this.prisma.category.findMany();

    if (!categories) {
      throw new NotFoundException('No se econtraron las categorias');
    }

    return categories;
  }
}
