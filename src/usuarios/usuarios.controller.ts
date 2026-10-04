import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

// Gerenciamento de usuários é uma ação sensível: todas as rotas exigem nivel_acesso
// "Admin" e operam só sobre usuários da empresa do admin autenticado (outra empresa
// responde 404). Nenhuma resposta inclui a senha.
@ApiTags('usuarios')
@ApiBearerAuth()
@Roles('Admin')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @ApiOperation({
    summary: 'Cadastrar usuário',
    description:
      'empresa_id é o do admin autenticado. E-mail duplicado responde 409 "E-mail já cadastrado."',
  })
  @Post()
  create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateUsuarioDto,
  ) {
    return this.usuariosService.create(admin, dto);
  }

  @ApiOperation({ summary: 'Listar usuários da empresa (ordenados por nome)' })
  @Get()
  findAll(@CurrentUser() admin: AuthenticatedUser) {
    return this.usuariosService.findAll(admin);
  }

  @ApiOperation({ summary: 'Dados de um usuário da empresa' })
  @Get(':id')
  findOne(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuariosService.findOne(admin, id);
  }

  @ApiOperation({
    summary: 'Atualizar usuário',
    description:
      'Campos opcionais; `senha` preenchida redefine a senha. Não permite rebaixar o último administrador.',
  })
  @Patch(':id')
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(admin, id, dto);
  }

  @ApiOperation({
    summary: 'Excluir usuário (definitivo)',
    description:
      'Não permite excluir a própria conta nem o último administrador da empresa.',
  })
  @Delete(':id')
  remove(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuariosService.remove(admin, id);
  }
}
