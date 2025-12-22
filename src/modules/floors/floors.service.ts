import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';

@Injectable()
export class FloorsService {
  constructor(private readonly prisma: PrismaService) {}

  // uso fijo
  async getFloorsWithTables() {
    const floorsAndTables = await this.prisma.floor.findMany({
      orderBy: { level: 'asc' },
      select: {
        id: true,
        name: true,
        level: true,
        tables: {
          where: { isActive: true },
          orderBy: { number: 'asc' },
          select: {
            id: true,
            number: true,
            status: true,
          },
        },
      },
    });

    if (!floorsAndTables) {
      throw new NotFoundException('No se encontro las mesas');
    }

    return floorsAndTables;
  }

  /**
   * ADMIN: Crear una mesa nueva manualmente
   */
  // async createTable(createTableDto: CreateTableDto) {
  //   return await this.prisma.table.create({
  //     data: createTableDto,
  //   });
  // }

  // Método útil para el módulo de Orders
  async findTableById(id: string) {
    const table = await this.prisma.table.findUnique({ where: { id } });

    if (!table) {
      throw new NotFoundException('La mesa no existe.');
    }

    return table;
  }

  /**
   * ADMIN: Crear una mesa nueva manualmente
   */
  async createTable(createTableDto: CreateTableDto) {
    const { number, floorId } = createTableDto;

    // 1. Validar que el piso exista
    const floorExists = await this.prisma.floor.findUnique({
      where: { id: floorId },
    });

    if (!floorExists) {
      throw new NotFoundException(
        'El piso especificado no existe. Verifique el ID.',
      );
    }

    // 2. Validar que no exista otra mesa con el mismo número en ese piso
    const existingTable = await this.prisma.table.findFirst({
      where: {
        number,
        floorId,
      },
    });

    if (existingTable) {
      throw new ConflictException(
        `Ya existe una mesa con el número ${number} en este piso.`,
      );
    }

    try {
      // 3. Crear mesa
      const table = await this.prisma.table.create({
        data: createTableDto,
      });

      return table;
    } catch (error) {
      console.error('Error en createTable():', error);

      throw new InternalServerErrorException(
        'Ocurrió un error inesperado al crear la mesa.',
      );
    }
  }

  async getFloorForUserRegister() {
    const floors = await this.prisma.floor.findMany({
      select: {
        id: true,
        name: true,
        level: true,
      },
    });

    if (!floors) {
      throw new NotFoundException('No se encontraron pisos');
    }

    return floors;
  }
}
