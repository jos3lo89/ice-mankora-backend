import { Injectable } from '@nestjs/common';
import { PrismaService } from './core/prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHello() {
    const result = await this.prisma.$queryRaw`SELECT 11 * 3`;
    return {
      result,
      message: 'Hello World!',
    };
  }
}
