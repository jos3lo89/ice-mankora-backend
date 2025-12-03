import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      omit: {
        password: true,
      },
      include: {
        floors: true,
      },
    });

    return users;
  }

  async create(createUserDto: CreateUserDto) {
    const { floors, ...userData } = createUserDto;

    try {
      const user = await this.prisma.user.create({
        data: {
          ...userData,
          floors: {
            connect: floors.map((floorId) => ({ id: floorId })),
          },
        },
        include: {
          floors: true,
        },
      });

      const { password, ...userWithoutPassword } = user;

      return userWithoutPassword;
    } catch (error) {
      console.error('Error en create():', error);

      if (error.code === 'P2002') {
        throw new ConflictException(
          `Ya existe un usuario con ese ${error.meta.target}.`,
        );
      }

      if (error.code === 'P2025') {
        throw new BadRequestException(
          `Alguno de los pisos especificados no existe.`,
        );
      }

      throw new InternalServerErrorException(
        'Error inesperado al crear el usuario.',
      );
    }
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
