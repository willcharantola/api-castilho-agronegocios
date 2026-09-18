import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const SALT_ROUNDS = 10;

// Nunca retornar o hash da senha nas respostas da API.
const SEM_SENHA = {
  usuario_id: true,
  empresa_id: true,
  nome: true,
  sobrenome: true,
  email: true,
  nivel_acesso: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUsuarioDto) {
    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
    try {
      return await this.prisma.usuario.create({
        data: { ...dto, senha: senhaHash },
        select: SEM_SENHA,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.usuario.findMany({ select: SEM_SENHA });
  }

  async findOne(usuarioId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { usuario_id: usuarioId },
      select: SEM_SENHA,
    });
    if (!usuario) {
      throw new NotFoundException(`Usuário ${usuarioId} não encontrado`);
    }
    return usuario;
  }

  async update(usuarioId: number, dto: UpdateUsuarioDto) {
    await this.findOne(usuarioId);
    const data = {
      ...dto,
      senha: dto.senha ? await bcrypt.hash(dto.senha, SALT_ROUNDS) : undefined,
    };
    try {
      return await this.prisma.usuario.update({
        where: { usuario_id: usuarioId },
        data,
        select: SEM_SENHA,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(usuarioId: number) {
    await this.findOne(usuarioId);
    try {
      return await this.prisma.usuario.delete({
        where: { usuario_id: usuarioId },
        select: SEM_SENHA,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
