import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { SALT_ROUNDS, USUARIO_PUBLICO } from './usuario.constants';

/**
 * Gestão de usuários pelo administrador. Tudo é restrito à empresa do admin
 * autenticado; usuários de outra empresa respondem 404 (sem revelar que o id existe).
 */
@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(admin: AuthenticatedUser, dto: CreateUsuarioDto) {
    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
    try {
      return await this.prisma.usuario.create({
        data: { ...dto, senha: senhaHash, empresa_id: admin.empresa_id },
        select: USUARIO_PUBLICO,
      });
    } catch (error) {
      this.tratarErro(error);
    }
  }

  findAll(admin: AuthenticatedUser) {
    return this.prisma.usuario.findMany({
      where: { empresa_id: admin.empresa_id },
      select: USUARIO_PUBLICO,
      orderBy: [{ nome: 'asc' }, { sobrenome: 'asc' }],
    });
  }

  async findOne(admin: AuthenticatedUser, usuarioId: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { usuario_id: usuarioId, empresa_id: admin.empresa_id },
      select: USUARIO_PUBLICO,
    });
    if (!usuario) {
      throw new NotFoundException(`Usuário ${usuarioId} não encontrado`);
    }
    return usuario;
  }

  async update(
    admin: AuthenticatedUser,
    usuarioId: number,
    dto: UpdateUsuarioDto,
  ) {
    const atual = await this.findOne(admin, usuarioId);
    if (atual.nivel_acesso === 'Admin' && dto.nivel_acesso === 'Normal') {
      await this.garantirOutroAdmin(admin.empresa_id, usuarioId);
    }

    const { senha, ...campos } = dto;
    try {
      return await this.prisma.usuario.update({
        where: { usuario_id: usuarioId },
        data: {
          ...campos,
          ...(senha ? { senha: await bcrypt.hash(senha, SALT_ROUNDS) } : {}),
        },
        select: USUARIO_PUBLICO,
      });
    } catch (error) {
      this.tratarErro(error);
    }
  }

  async remove(admin: AuthenticatedUser, usuarioId: number) {
    const alvo = await this.findOne(admin, usuarioId);
    if (alvo.usuario_id === admin.id) {
      throw new BadRequestException(
        'Você não pode excluir a sua própria conta.',
      );
    }
    if (alvo.nivel_acesso === 'Admin') {
      await this.garantirOutroAdmin(admin.empresa_id, usuarioId);
    }
    try {
      return await this.prisma.usuario.delete({
        where: { usuario_id: usuarioId },
        select: USUARIO_PUBLICO,
      });
    } catch (error) {
      this.tratarErro(error);
    }
  }

  /** Impede excluir ou rebaixar o último administrador da empresa. */
  private async garantirOutroAdmin(empresaId: number, usuarioIdAlvo: number) {
    const outros = await this.prisma.usuario.count({
      where: {
        empresa_id: empresaId,
        nivel_acesso: 'Admin',
        NOT: { usuario_id: usuarioIdAlvo },
      },
    });
    if (outros === 0) {
      throw new BadRequestException(
        'A empresa precisa ter pelo menos um administrador.',
      );
    }
  }

  private tratarErro(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('E-mail já cadastrado.');
    }
    handlePrismaError(error);
  }
}
