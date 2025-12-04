import { BadRequestException, Injectable } from '@nestjs/common';
import { UserActiveI } from 'src/common/interfaces/userActive.interface';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class FloorsService {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Devuelve los pisos y sus mesas, filtrados por allowedFloorIds
   * del usuario (Mapa interactivo de mesas).
   */
  async findFloorsWithTables(user: UserActiveI) {
    if (!user.allowedFloorIds || user.allowedFloorIds.length === 0) {
      throw new BadRequestException(
        'El usuario no tiene pisos asignados. Contacte al administrador.',
      );
    }

    const floors = await this.prisma.floor.findMany({
      where: {
        id: {
          in: user.allowedFloorIds,
        },
      },
      orderBy: {
        level: 'asc',
      },
      include: {
        tables: {
          where: {
            isActive: true,
          },
          orderBy: {
            number: 'asc',
          },
        },
      },
    });

    return floors;
  }
}
