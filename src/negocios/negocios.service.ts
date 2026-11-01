import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NOME_LOTE_UNICO,
  RENDIMENTO_NEUTRO,
  type TipoNegocio,
} from '../common/dominio';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { horaAtual, horaParaDate } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularComissao,
  calcularGado,
  calcularImpostos,
  calcularLote,
  calcularNegocio,
  type AgregadosLote,
  type GadoCalculado,
} from './calculo.util';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';

/** Alíquotas de Funrural e Senar em pontos percentuais (1.5 = 1,5%). */
type Aliquotas = { aliquota_funrural: number; aliquota_senar: number };

const SELECT_ALIQUOTAS = {
  aliquota_funrural: true,
  aliquota_senar: true,
} as const;

/** Tudo o que recalcular() lê do negócio. */
const SELECT_CALCULO = {
  empresa_id: true,
  modalidade: true,
  tipo_negocio: true,
  porcentagem_comissao: true,
  ...SELECT_ALIQUOTAS,
} as const;

/** Lotes em ordem de cadastro, cada um com suas cabeças em ordem de cadastro. */
const INCLUDE_LOTES = {
  lotes: {
    orderBy: { lote_id: 'asc' },
    include: { gados: { orderBy: { gado_id: 'asc' } } },
  },
} as const satisfies Prisma.negocioInclude;

export const MENSAGEM_FAZENDA_DE_OUTRO_PECUARISTA =
  'A fazenda não pertence ao pecuarista selecionado';

export const MENSAGEM_TROCA_PARA_CABECA =
  'Para mudar para "Por cabeça" o negócio precisa ter no máximo um lote e nenhuma cabeça pesada';

/** Gado gravado (Decimal do Prisma) no formato das funções de cálculo. */
export function gadoParaCalculo(gado: {
  peso_total: Prisma.Decimal;
  peso_calculo: Prisma.Decimal;
  peso_arroba: Prisma.Decimal;
  valor_total: Prisma.Decimal;
}): GadoCalculado {
  return {
    peso_total: gado.peso_total.toNumber(),
    peso_calculo: gado.peso_calculo.toNumber(),
    peso_arroba: gado.peso_arroba.toNumber(),
    valor_total: gado.valor_total.toNumber(),
  };
}

@Injectable()
export class NegociosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNegocioDto) {
    await this.garantirVinculo(dto.pecuarista_id, dto.fazenda_id);

    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.negocio.findUnique({ where: { uuid_origem } }),
      async () => {
        // Alíquotas vigentes na empresa no momento da criação: mudanças posteriores
        // na configuração não alteram os negócios já existentes. Gravadas mesmo quando o
        // tipo de negócio zera o imposto.
        const aliquotas = await this.aliquotasDaEmpresa(
          this.prisma,
          dto.empresa_id,
        );
        return this.prisma.negocio.create({
          data: {
            ...dto,
            ...aliquotas,
            data_negocio: new Date(dto.data_negocio),
            // Ainda não há lotes (valor_total = 0), então a comissão em R$ começa em 0
            // e é recalculada por recalcular() conforme o valor total muda.
            comissao: dto.porcentagem_comissao != null ? 0 : null,
            // Preenchidos pelo servidor: hora_inicio_pesagem no primeiro gado cadastrado
            // (GadosService.create) e hora_fim_pesagem ao concluir o cadastro (concluir()).
            hora_inicio_pesagem: null,
            hora_fim_pesagem: null,
            // NOT NULL no banco: começam em 0 e são preenchidos pelo recálculo a partir dos
            // lotes. Pesos, médias, extremos e rendimento médio ficam NULL até haver gados.
            valor_total: 0,
            qtd_animais: 0,
            // valor_total = 0 → funrural e senar 0,00 (nunca NULL).
            ...calcularImpostos(
              0,
              dto.tipo_negocio as TipoNegocio,
              aliquotas.aliquota_funrural,
              aliquotas.aliquota_senar,
            ),
          },
        });
      },
    );
    return registro;
  }

  findAll(fazendaId?: number, dataInicio?: string, dataFim?: string) {
    const where: Prisma.negocioWhereInput = {};

    if (fazendaId !== undefined) {
      where.fazenda_id = fazendaId;
    }

    if (dataInicio || dataFim) {
      where.data_negocio = {
        ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
        ...(dataFim ? { lte: new Date(dataFim) } : {}),
      };
    }

    // Mais recente primeiro (ordem de cadastro invertida).
    return this.prisma.negocio.findMany({
      where,
      orderBy: { negocio_id: 'desc' },
    });
  }

  async findOne(negocioId: number) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { negocio_id: negocioId },
      include: {
        ...INCLUDE_LOTES,
        comprador: true,
        pecuarista: true,
        fazenda: true,
      },
    });
    if (!negocio) {
      throw new NotFoundException(`Negócio ${negocioId} não encontrado`);
    }
    return negocio;
  }

  /**
   * Negócio que o usuário pode alterar: o de outra empresa responde 404 (como se não
   * existisse), para não revelar dados de outras empresas.
   */
  async negocioDaEmpresa(negocioId: number, empresaId: number) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { negocio_id: negocioId },
      select: { negocio_id: true, empresa_id: true, modalidade: true },
    });
    if (!negocio || negocio.empresa_id !== empresaId) {
      throw new NotFoundException(`Negócio ${negocioId} não encontrado`);
    }
    return negocio;
  }

  async update(negocioId: number, dto: UpdateNegocioDto) {
    const atual = await this.findOne(negocioId);
    const modalidade = dto.modalidade ?? atual.modalidade;
    const trocouModalidade = modalidade !== atual.modalidade;
    const qtdGados = atual.lotes.reduce((soma, l) => soma + l.gados.length, 0);

    // "cabeca" tem um único lote e nenhuma pesagem individual.
    if (
      trocouModalidade &&
      modalidade === 'cabeca' &&
      (atual.lotes.length > 1 || qtdGados > 0)
    ) {
      throw new BadRequestException(MENSAGEM_TROCA_PARA_CABECA);
    }

    const pecuaristaId = dto.pecuarista_id ?? atual.pecuarista_id;
    const fazendaId = dto.fazenda_id ?? atual.fazenda_id;
    if (
      pecuaristaId !== atual.pecuarista_id ||
      fazendaId !== atual.fazenda_id
    ) {
      await this.garantirVinculo(pecuaristaId, fazendaId);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.negocio.update({
          where: { negocio_id: negocioId },
          data: {
            ...dto,
            ...(dto.data_negocio
              ? { data_negocio: new Date(dto.data_negocio) }
              : {}),
          },
        });
        if (trocouModalidade) {
          await this.ajustarLotesAModalidade(tx, negocioId, modalidade);
        }
        // valor_total, comissão, Funrural e Senar (dependem do tipo_negocio e do valor).
        await this.recalcular(tx, negocioId);
      });
    } catch (error) {
      handlePrismaError(error);
    }
    return this.prisma.negocio.findUniqueOrThrow({
      where: { negocio_id: negocioId },
    });
  }

  /**
   * Finaliza o cadastro do negócio (botão "Concluir" do fluxo de cadastro de gados):
   * registra hora_fim_pesagem com a hora local do cliente (ver horaAtual), ou com a
   * hora informada pela fila offline (`horaFim`, capturada no aparelho ao concluir).
   */
  async concluir(negocioId: number, fuso?: string, horaFim?: string) {
    await this.findOne(negocioId);
    try {
      return await this.prisma.negocio.update({
        where: { negocio_id: negocioId },
        data: {
          hora_fim_pesagem: horaFim ? horaParaDate(horaFim) : horaAtual(fuso),
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Registra hora_inicio_pesagem apenas se ainda estiver NULL — ou seja, só no
   * primeiro gado cadastrado no negócio. O filtro no próprio UPDATE torna a
   * operação atômica: cadastros simultâneos não sobrescrevem o valor. `horario` é o
   * horario_pesagem do gado (hora do aparelho, quando veio da fila offline).
   */
  async registrarInicioPesagem(
    tx: Prisma.TransactionClient,
    negocioId: number,
    horario: Date,
  ) {
    await tx.negocio.updateMany({
      where: { negocio_id: negocioId, hora_inicio_pesagem: null },
      data: { hora_inicio_pesagem: horario },
    });
  }

  async remove(negocioId: number) {
    await this.findOne(negocioId);
    try {
      // Lotes e gados saem junto (ON DELETE CASCADE).
      return await this.prisma.negocio.delete({
        where: { negocio_id: negocioId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Recalcula peso_calculo, peso_arroba e valor_total de todas as cabeças do lote, a partir
   * do rendimento e do valor da unidade do lote e da modalidade do negócio.
   */
  async recalcularGadosDoLote(tx: Prisma.TransactionClient, loteId: number) {
    const lote = await tx.lote.findUniqueOrThrow({
      where: { lote_id: loteId },
      include: { negocio: { select: { modalidade: true } }, gados: true },
    });
    if (lote.negocio.modalidade === 'cabeca') return;
    for (const gado of lote.gados) {
      await tx.gado.update({
        where: { gado_id: gado.gado_id },
        data: calcularGado(
          lote.negocio.modalidade,
          gado.peso_total.toNumber(),
          lote.rendimento_carcaca.toNumber(),
          lote.valor_unidade.toNumber(),
        ),
      });
    }
  }

  /**
   * Recalcula os agregados de todos os lotes do negócio e os do próprio negócio
   * (quantidade, valores, pesos, extremos, rendimento médio, comissão, Funrural e Senar).
   * Roda na transação de quem chama — criar/editar/excluir lote ou gado, mover gado entre
   * lotes, mudar tipo de negócio, comissão ou modalidade.
   */
  async recalcular(tx: Prisma.TransactionClient, negocioId: number) {
    const negocio = await tx.negocio.findUniqueOrThrow({
      where: { negocio_id: negocioId },
      select: SELECT_CALCULO,
    });
    const lotes = await tx.lote.findMany({
      where: { negocio_id: negocioId },
      include: { gados: true },
      orderBy: { lote_id: 'asc' },
    });

    const todosGados: GadoCalculado[] = [];
    const agregadosLotes: AgregadosLote[] = [];
    for (const lote of lotes) {
      const gados = lote.gados.map(gadoParaCalculo);
      const agregados = calcularLote(
        negocio.modalidade,
        {
          valor_unidade: lote.valor_unidade.toNumber(),
          qtd_animais: lote.qtd_animais,
        },
        gados,
      );
      await tx.lote.update({
        where: { lote_id: lote.lote_id },
        data: agregados,
      });
      todosGados.push(...gados);
      agregadosLotes.push(agregados);
    }

    const agregados = calcularNegocio(agregadosLotes, todosGados);
    const porcentagem = negocio.porcentagem_comissao?.toNumber();
    const aliquotas = await this.aliquotasDoNegocio(tx, negocio);
    await tx.negocio.update({
      where: { negocio_id: negocioId },
      data: {
        ...agregados,
        ...(porcentagem != null
          ? { comissao: calcularComissao(agregados.valor_total, porcentagem) }
          : {}),
        ...aliquotas,
        ...calcularImpostos(
          agregados.valor_total,
          negocio.tipo_negocio as TipoNegocio,
          aliquotas.aliquota_funrural,
          aliquotas.aliquota_senar,
        ),
      },
    });
  }

  /**
   * Depois de trocar a modalidade:
   * - para "cabeca": o único lote vira o "Lote único", com rendimento neutro;
   * - para "kg": os lotes passam a ter rendimento neutro;
   * - para "arroba" (vindo de "kg"/"cabeca"): os lotes mantêm o rendimento (100) até o
   *   usuário editá-los.
   * Nas modalidades com pesagem, recalcula as cabeças com a nova regra.
   */
  private async ajustarLotesAModalidade(
    tx: Prisma.TransactionClient,
    negocioId: number,
    modalidade: string,
  ) {
    if (modalidade === 'cabeca') {
      await tx.lote.updateMany({
        where: { negocio_id: negocioId },
        data: {
          nome_lote: NOME_LOTE_UNICO,
          rendimento_carcaca: RENDIMENTO_NEUTRO,
        },
      });
      return;
    }
    if (modalidade === 'kg') {
      await tx.lote.updateMany({
        where: { negocio_id: negocioId },
        data: { rendimento_carcaca: RENDIMENTO_NEUTRO },
      });
    }
    const lotes = await tx.lote.findMany({
      where: { negocio_id: negocioId },
      select: { lote_id: true },
    });
    for (const { lote_id } of lotes) {
      await this.recalcularGadosDoLote(tx, lote_id);
    }
  }

  /**
   * O banco recusa (FK composta) um negócio cuja fazenda não está vinculada ao
   * pecuarista; a checagem aqui devolve uma mensagem clara antes disso.
   */
  private async garantirVinculo(pecuaristaId: number, fazendaId: number) {
    const vinculo = await this.prisma.pecuarista_fazenda.findUnique({
      where: {
        pecuarista_id_fazenda_id: {
          pecuarista_id: pecuaristaId,
          fazenda_id: fazendaId,
        },
      },
    });
    if (!vinculo) {
      throw new BadRequestException(MENSAGEM_FAZENDA_DE_OUTRO_PECUARISTA);
    }
  }

  private async aliquotasDaEmpresa(
    db: Prisma.TransactionClient,
    empresaId: number,
  ): Promise<Aliquotas> {
    const empresa = await db.empresa.findUniqueOrThrow({
      where: { empresa_id: empresaId },
      select: SELECT_ALIQUOTAS,
    });
    return {
      aliquota_funrural: empresa.aliquota_funrural.toNumber(),
      aliquota_senar: empresa.aliquota_senar.toNumber(),
    };
  }

  /**
   * Alíquotas gravadas no negócio. Negócios sem elas (NULL) passam a usar as da
   * empresa — quem chama grava o resultado junto com funrural/senar.
   */
  private async aliquotasDoNegocio(
    db: Prisma.TransactionClient,
    negocio: {
      empresa_id: number;
      aliquota_funrural: Prisma.Decimal | null;
      aliquota_senar: Prisma.Decimal | null;
    },
  ): Promise<Aliquotas> {
    if (negocio.aliquota_funrural === null || negocio.aliquota_senar === null) {
      return this.aliquotasDaEmpresa(db, negocio.empresa_id);
    }
    return {
      aliquota_funrural: negocio.aliquota_funrural.toNumber(),
      aliquota_senar: negocio.aliquota_senar.toNumber(),
    };
  }
}
