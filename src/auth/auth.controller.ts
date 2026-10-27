import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiOperation({
    summary: 'Login',
    description:
      'Rota pública. Retorna um JWT (Bearer token das demais rotas) e os dados do usuário, ' +
      'incluindo nivel_acesso. Nunca retorna a senha.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dados do usuário logado',
    description: 'Estado atual do usuário no banco (sem senha).',
  })
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
