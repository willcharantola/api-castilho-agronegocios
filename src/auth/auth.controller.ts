import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { PermitirPrimeiroAcesso } from './decorators/permitir-primeiro-acesso.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { DefinirSenhaPrimeiroAcessoDto } from './dto/primeiro-acesso.dto';
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
      'incluindo nivel_acesso e primeiro_acesso. Nunca retorna a senha.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dados do usuário logado',
    description:
      'Estado atual do usuário no banco (sem senha). Disponível com o primeiro acesso pendente.',
  })
  @PermitirPrimeiroAcesso()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Definir nova senha no primeiro acesso',
    description:
      'Só para usuários com primeiro_acesso = true. A nova senha deve ser diferente da atual. ' +
      'Libera o restante da API (o token atual continua válido).',
  })
  @PermitirPrimeiroAcesso()
  @Patch('primeiro-acesso/senha')
  definirSenhaPrimeiroAcesso(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DefinirSenhaPrimeiroAcessoDto,
  ) {
    return this.authService.definirSenhaPrimeiroAcesso(user.id, dto.nova_senha);
  }
}
