import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthAndRoleGuard } from 'src/common/decorators/auth.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('signin')
  async signIn(
    @Body() signinDto: SigninDto,
    @Res({
      passthrough: true,
    })
    res: Response,
  ) {
    const { token, userWithoutPassword } =
      await this.authService.signIn(signinDto);

    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    });

    return userWithoutPassword;
  }

  @AuthAndRoleGuard(Role.ADMIN, Role.CAJERO, Role.MOZO)
  @Post('signout')
  signOut(@Res({ passthrough: true }) res: Response) {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
    });

    return { message: 'Sesión cerrada' };
  }
}
