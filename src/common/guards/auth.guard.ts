import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = this.extractTokenFromCookie(request);

    if (!token) throw new UnauthorizedException('Token no proporcionado');

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      request['user'] = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  // private extractTokenFromHeader(request: Request): string | undefined {
  //   const [type, token] = request.headers.authorization?.split(' ') ?? [];
  //   return type === 'Bearer' ? token : undefined;
  // }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.access_token;
  }
}
