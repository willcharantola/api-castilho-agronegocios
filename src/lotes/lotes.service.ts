import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type lote } from '@prisma/client';
import { NOME_LOTE_UNICO, RENDIMENTO_NEUTRO } from '../common/dominio';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { NegociosService } from '../negocios/negocios.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';

export const MENSAGEM_SEGUNDO_LOTE_CABECA =
  'Negócio "Por cabeça" tem um único lote: edite o lote existente';

export const mensagemLoteComGados = (qtd: number) =>
  `Este lote tem ${qtd} ${qtd === 1 ? 'cabeça pesada' : 'cabeças pesadas'}. ` +
  'Remova ou mova as cabeças antes de excluir';

/** Campos do lote que dependem da modalidade do negócio. */
type CamposDaModalidade = {
  nome_lote: string;
  rendimento_carcaca: number;
  qtd_animais?: number;
};

@Injectable()
export class LotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  async create(negocioId: number, dto: CreateLoteDto, empresaId: number) {
    const negocio = await this.negociosService.negocioDaEmpresa(
      negocioId,
      empresaId,
    );
    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) => this.prisma.lote.findUnique({ where: { uuid_origem } }),
      async () => {
        const campos = this.camposDaModalidade(negocio.modalidade, dto);
        if (negocio.modalidade === 'cabeca') {
          const existentes = await this.prisma.lote.count({
            where: { negocio_id: negocioId },
          });
          if (existentes > 0) {
            throw new BadRequestException(MENSAGEM_SEGUNDO_LOTE_CABECA);
          }
        } else {
          await this.garantirNomeUnico(negocioId, campos.nome_lote);
        }
        return this.prisma.$transaction(async (tx) => {
          const criado = await tx.lote.create({
            data: {
              ...dto,
              ...campos,
              negocio_id: negocioId,
              // NOT NULL no banco: preenchidos pelo recálculo logo abaixo (com pesagem,
              // a quantidade é a de cabeças pesadas).
              qtd_animais: campos.qtd_animais ?? 0,
              valor_total_lote: 0,
            },
          });
          await this.negociosService.recalcular(tx, negocioId);
          return tx.lote.findUniqueOrThrow({
            where: { lote_id: criado.lote_id },
          });
        });
      },
    );
    return registro;
  }

  async findDoNegocio(negocioId: number, empresaId: number) {
    await this.negociosService.negocioDaEmpresa(negocioId, empresaId);
    return this.prisma.lote.findMany({
      where: { negocio_id: negocioId },
      orderBy: { lote_id: 'asc' },
      include: { gados: { orderBy: { gado_id: 'asc' } } },
    });
  }

  async findOne(loteId: number, empresaId: number) {
    const lote = await this.prisma.lote.findUnique({
      where: { lote_id: loteId },
      include: {
        gados: { orderBy: { gado_id: 'asc' } },
        negocio: { select: { empresa_id: true, modalidade: true } },
      },
    });
    if (!lote || lote.negocio.empresa_id !== empresaId) {
      throw new NotFoundException(`Lote ${loteId} não encontrado`);
    }
    return lote;
  }

  async update(loteId: number, dto: UpdateLoteDto, empresaId: number) {
    const atual = await this.findOne(loteId, empresaId);
    const modalidade = atual.negocio.modalidade;
    const campos = this.camposDaModalidade(modalidade, dto, atual);
    if (
      modalidade !== 'cabeca' &&
      campos.nome_lote.toLowerCase() !== atual.nome_lote.toLowerCase()
    ) {
      await this.garantirNomeUnico(atual.negocio_id, campos.nome_lote, loteId);
    }
    // O valor de cada cabeça depende do rendimento e do valor da unidade do lote.
    const recalcularGados =
      campos.rendimento_carcaca !== atual.rendimento_carcaca.toNumber() ||
      (dto.valor_unidade !== undefined &&
        dto.valor_unidade !== atual.valor_unidade.toNumber());

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.lote.update({
          where: { lote_id: loteId },
          data: { ...dto, ...campos },
        });
        if (recalcularGados) {
          await this.negociosService.recalcularGadosDoLote(tx, loteId);
        }
        await this.negociosService.recalcular(tx, atual.negocio_id);
        return tx.lote.findUniqueOrThrow({ where: { lote_id: loteId } });
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(loteId: number, empresaId: number) {
    const atual = await this.findOne(loteId, empresaId);
    if (atual.gados.length > 0) {
      throw new ConflictException(mensagemLoteComGados(atual.gados.length));
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const removido = await tx.lote.delete({ where: { lote_id: loteId } });
        await this.negociosService.recalcular(tx, atual.negocio_id);
        return removido;
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Regras por modalidade (`atual` = lote em edição, para os campos ausentes no PATCH):
   * - arroba: nome e rendimento obrigatórios;
   * - kg: nome obrigatório, rendimento 100 (ignora o enviado);
   * - cabeca: nome "Lote único", rendimento 100 e quantidade de animais obrigatória.
   * Quantidade só é aceita em "cabeca" — nas demais é o número de cabeças pesadas.
   */
  private camposDaModalidade(
    modalidade: string,
    dto: Pick<
      UpdateLoteDto,
      'nome_lote' | 'rendimento_carcaca' | 'qtd_animais'
    >,
    atual?: lote,
  ): CamposDaModalidade {
    if (modalidade === 'cabeca') {
      const qtd = dto.qtd_animais ?? atual?.qtd_animais;
      if (!qtd) {
        throw new BadRequestException('Informe a quantidade de animais');
      }
      return {
        nome_lote: NOME_LOTE_UNICO,
        rendimento_carcaca: RENDIMENTO_NEUTRO,
        qtd_animais: qtd,
      };
    }
    if (dto.qtd_animais !== undefined) {
      throw new BadRequestException(
        'A quantidade de animais só é informada na modalidade "Por cabeça"; nas demais ' +
          'é o número de cabeças pesadas',
      );
    }
    const nome = (dto.nome_lote ?? atual?.nome_lote ?? '').trim();
    if (!nome) throw new BadRequestException('Informe o nome do lote');
    if (modalidade === 'kg') {
      return { nome_lote: nome, rendimento_carcaca: RENDIMENTO_NEUTRO };
    }
    const rendimento =
      dto.rendimento_carcaca ?? atual?.rendimento_carcaca.toNumber();
    if (rendimento === undefined) {
      throw new BadRequestException(
        'Informe o rendimento de carcaça do lote (modalidade "Por @/RC")',
      );
    }
    return { nome_lote: nome, rendimento_carcaca: rendimento };
  }

  /** Nome do lote único dentro do negócio, ignorando maiúsculas/minúsculas. */
  private async garantirNomeUnico(
    negocioId: number,
    nome: string,
    ignorarLoteId?: number,
  ) {
    const repetido = await this.prisma.lote.findFirst({
      where: {
        negocio_id: negocioId,
        nome_lote: { equals: nome, mode: 'insensitive' },
        ...(ignorarLoteId ? { NOT: { lote_id: ignorarLoteId } } : {}),
      },
      select: { lote_id: true },
    });
    if (repetido) {
      throw new BadRequestException(
        `Já existe um lote chamado "${nome}" neste negócio`,
      );
    }
  }
}
