import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTipoGadoDto } from './dto/create-tipo-gado.dto';
import { UpdateTipoGadoDto } from './dto/update-tipo-gado.dto';

export const mensagemTipoGadoRepetido = (nome: string) =>
  `Já existe um tipo de gado chamado "${nome}"`;

/**
 * Catálogo de nomes sugeridos para os lotes, por empresa. Não há ligação com o lote: o
 * nome escolhido é copiado para lote.nome_lote, então renomear ou excluir um tipo não
 * altera lotes existentes.
 */
@Injectable()
export class TiposGadoService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(empresaId: number) {
    return this.prisma.tipos_gado.findMany({
      where: { empresa_id: empresaId },
      orderBy: { nome_gado: 'asc' },
    });
  }

  async create(dto: CreateTipoGadoDto, empresaId: number) {
    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.tipos_gado.findUnique({ where: { uuid_origem } }),
      async () => {
        await this.garantirNomeUnico(empresaId, dto.nome_gado);
        try {
          return await this.prisma.tipos_gado.create({
            data: { ...dto, empresa_id: empresaId },
          });
        } catch (error) {
          this.traduzirRepetido(error, dto.nome_gado);
        }
      },
    );
    return registro;
  }

  async update(id: number, dto: UpdateTipoGadoDto, empresaId: number) {
    await this.findOne(id, empresaId);
    await this.garantirNomeUnico(empresaId, dto.nome_gado, id);
    try {
      return await this.prisma.tipos_gado.update({
        where: { tipo_gado_id: id },
        data: { nome_gado: dto.nome_gado },
      });
    } catch (error) {
      this.traduzirRepetido(error, dto.nome_gado);
    }
  }

  async remove(id: number, empresaId: number) {
    await this.findOne(id, empresaId);
    try {
      return await this.prisma.tipos_gado.delete({
        where: { tipo_gado_id: id },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /** Tipo de outra empresa responde 404, como se não existisse. */
  private async findOne(id: number, empresaId: number) {
    const tipo = await this.prisma.tipos_gado.findUnique({
      where: { tipo_gado_id: id },
    });
    if (!tipo || tipo.empresa_id !== empresaId) {
      throw new NotFoundException(`Tipo de gado ${id} não encontrado`);
    }
    return tipo;
  }

  /** Nome único na empresa, ignorando maiúsculas/minúsculas (índice único no banco). */
  private async garantirNomeUnico(
    empresaId: number,
    nome: string,
    ignorarId?: number,
  ) {
    const repetido = await this.prisma.tipos_gado.findFirst({
      where: {
        empresa_id: empresaId,
        nome_gado: { equals: nome, mode: 'insensitive' },
        ...(ignorarId ? { NOT: { tipo_gado_id: ignorarId } } : {}),
      },
      select: { tipo_gado_id: true },
    });
    if (repetido) throw new ConflictException(mensagemTipoGadoRepetido(nome));
  }

  /** Cadastro simultâneo do mesmo nome: o índice único do banco responde P2002. */
  private traduzirRepetido(error: unknown, nome: string): never {
    if ((error as { code?: string } | null)?.code === 'P2002') {
      throw new ConflictException(mensagemTipoGadoRepetido(nome));
    }
    handlePrismaError(error);
  }
}
