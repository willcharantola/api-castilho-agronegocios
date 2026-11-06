import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { handlePrismaError } from '../common/prisma-error.util';
import { criarIdempotente } from '../common/idempotencia.util';
import { horaAtual, horaParaDate } from '../common/time.util';
import { calcularGado, type ValoresGado } from '../negocios/calculo.util';
import { NegociosService } from '../negocios/negocios.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGadoDto } from './dto/create-gado.dto';
import { UpdateGadoDto } from './dto/update-gado.dto';

export const MENSAGEM_LOTE_DE_OUTRO_NEGOCIO =
  'A cabeça só pode ser movida para um lote do mesmo negócio';

const SELECT_LOTE_CALCULO = {
  lote_id: true,
  negocio_id: true,
  rendimento_carcaca: true,
  negocio: {
    select: {
      empresa_id: true,
      modalidade: true,
      tipo_gado: true,
      valor_unidade: true,
    },
  },
} as const;

@Injectable()
export class GadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  /**
   * Lote que recebe a cabeça: precisa existir, ser de um negócio da empresa do usuário e
   * de uma modalidade com pesagem ("cabeca" não tem registros individuais de gado).
   */
  private async loteParaPesagem(loteId: number, empresaId: number) {
    const lote = await this.prisma.lote.findUnique({
      where: { lote_id: loteId },
      select: SELECT_LOTE_CALCULO,
    });
    if (!lote || lote.negocio.empresa_id !== empresaId) {
      throw new NotFoundException(`Lote ${loteId} não encontrado`);
    }
    if (lote.negocio.modalidade === 'cabeca') {
      throw new BadRequestException(
        `O negócio ${lote.negocio_id} é da modalidade "cabeca" e não tem pesagem individual`,
      );
    }
    return lote;
  }

  private valores(
    lote: Awaited<ReturnType<GadosService['loteParaPesagem']>>,
    pesoTotal: number,
  ): ValoresGado {
    return calcularGado(
      lote.negocio.modalidade,
      pesoTotal,
      lote.rendimento_carcaca.toNumber(),
      lote.negocio.valor_unidade.toNumber(),
      lote.negocio.tipo_gado,
    );
  }

  async create(dto: CreateGadoDto, empresaId: number, fuso?: string) {
    const lote = await this.loteParaPesagem(dto.lote_id, empresaId);

    // Online: hora local do cliente no momento do cadastro (instante do servidor, fuso do
    // cliente). Fila offline (uuid_origem): a hora capturada no aparelho na pesagem, já
    // que a sincronização pode acontecer horas depois.
    const { horario_pesagem: horarioInformado, ...dados } = dto;
    const horarioPesagem =
      dto.uuid_origem && horarioInformado
        ? horaParaDate(horarioInformado)
        : horaAtual(fuso);

    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) => this.prisma.gado.findUnique({ where: { uuid_origem } }),
      () =>
        this.prisma.$transaction(async (tx) => {
          const gado = await tx.gado.create({
            data: {
              ...dados,
              data_pesagem: dto.data_pesagem
                ? new Date(dto.data_pesagem)
                : new Date(),
              horario_pesagem: horarioPesagem,
              ...this.valores(lote, dto.peso_total),
            },
          });
          // Primeiro gado do negócio marca o início da pesagem (no-op nos seguintes).
          await this.negociosService.registrarInicioPesagem(
            tx,
            lote.negocio_id,
            horarioPesagem,
          );
          await this.negociosService.recalcular(tx, lote.negocio_id);
          return gado;
        }),
    );
    // Reenvio de um gado já sincronizado devolve o registro sem recalcular nada.
    return registro;
  }

  findAll(empresaId: number) {
    return this.prisma.gado.findMany({
      where: { lote: { negocio: { empresa_id: empresaId } } },
      orderBy: { gado_id: 'asc' },
    });
  }

  async findOne(gadoId: number, empresaId: number) {
    const gado = await this.prisma.gado.findUnique({
      where: { gado_id: gadoId },
      include: { lote: { select: SELECT_LOTE_CALCULO } },
    });
    if (!gado || gado.lote.negocio.empresa_id !== empresaId) {
      throw new NotFoundException(`Gado ${gadoId} não encontrado`);
    }
    return gado;
  }

  async update(gadoId: number, dto: UpdateGadoDto, empresaId: number) {
    const { lote: loteAtual, ...atual } = await this.findOne(
      gadoId,
      empresaId,
    );

    // Trocar de lote troca o rendimento usado no cálculo; o lote
    // novo precisa ser do mesmo negócio.
    const loteDestino =
      dto.lote_id !== undefined && dto.lote_id !== atual.lote_id
        ? await this.loteParaPesagem(dto.lote_id, empresaId)
        : loteAtual;
    if (loteDestino.negocio_id !== loteAtual.negocio_id) {
      throw new BadRequestException(MENSAGEM_LOTE_DE_OUTRO_NEGOCIO);
    }
    const precisaRecalcular =
      dto.peso_total !== undefined || loteDestino !== loteAtual;
    const valores: Partial<ValoresGado> = precisaRecalcular
      ? this.valores(loteDestino, dto.peso_total ?? atual.peso_total.toNumber())
      : {};

    try {
      return await this.prisma.$transaction(async (tx) => {
        const gado = await tx.gado.update({
          where: { gado_id: gadoId },
          data: {
            ...dto,
            ...(dto.data_pesagem
              ? { data_pesagem: new Date(dto.data_pesagem) }
              : {}),
            ...valores,
          },
        });
        // Recalcula todos os lotes do negócio: cobre os dois lotes de uma troca.
        await this.negociosService.recalcular(tx, loteAtual.negocio_id);
        return gado;
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(gadoId: number, empresaId: number) {
    const { lote, ...atual } = await this.findOne(gadoId, empresaId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const gado = await tx.gado.delete({
          where: { gado_id: atual.gado_id },
        });
        await this.negociosService.recalcular(tx, lote.negocio_id);
        return gado;
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
