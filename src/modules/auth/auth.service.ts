import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { SigninDto } from './dto/signin.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signIn(signinDto: SigninDto) {
    try {
      const userFound = await this.prisma.user.findUnique({
        where: {
          username: signinDto.username,
        },
        include: {
          floors: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!userFound) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const isPasswordValid = await bcrypt.compare(
        signinDto.password,
        userFound.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Contraseña invalida');
      }

      const payload = {
        userId: userFound.id,
        username: userFound.username,
        role: userFound.role,
        allowedFloorIds: userFound.floors.map((floor) => floor.id),
      };

      const token = await this.jwtService.signAsync(payload);

      const { password, floors, ...userWithoutPassword } = userFound;

      return { token, userWithoutPassword };
    } catch (error) {
      console.error('signIn() error:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Error al iniciar sesión');
    }
  }
}
