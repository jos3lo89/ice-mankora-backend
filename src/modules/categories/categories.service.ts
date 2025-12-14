import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) { }


  async getCategories() {
    const categories = await this.prisma.category.findMany()

    if (!categories) {
      throw new NotFoundException("No se econtraron las categorias")
    }

    return categories
  }
}
