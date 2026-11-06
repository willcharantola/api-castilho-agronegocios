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
  calcularValorLiquido,
  modoComissao,
  type AgregadosLote,
  type GadoCalculado,
} from './calculo.util';
import { INCLUDE_COMPRADOR } from './comprador.util';
import { CompradorDoNegocioDto } from './dto/comprador-do-negocio.dto';
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
  tipo_gado: true,
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

export const MENSAGEM_COMPRADOR_E_VENDEDOR =
  'O comprador não pode ser o próprio vendedor';

export const MENSAGEM_COMPRADOR_NAO_ENCONTRADO = 'Comprador não encontrado';

/** Colunas do comprador no negócio: exatamente uma preenchida (CHECK no banco). */
type ColunasComprador = {
  comprador_id: number | null;
  comprador_pecuarista_id: number | null;
};

export const MENSAGEM_TROCA_PARA_CABECA =
  'Para mudar para "Por cabeça" o negócio precisa ter no máximo um lote e nenhuma cabeça pesada';

/** Métricas restritas da Home e do Dashboard (`null` para quem não é Admin). */
export type ResumoNegocios = {
  negocios_realizados: number | null;
  comissao_total: number | null;
  total_cabecas: number | null;
};

/** Filtros da listagem de negócios (fazenda e intervalo de data_negocio). */
function filtroDeNegocios(
  fazendaId?: number,
  dataInicio?: string,
  dataFim?: string,
): Prisma.negocioWhereInput {
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
  return where;
}

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
    const { comprador, ...dados } = dto;
    await this.garantirVinculo(dto.pecuarista_id, dto.fazenda_id);

    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.negocio.findUnique({
          where: { uuid_origem },
          include: INCLUDE_COMPRADOR,
        }),
      async () => {
        const colunas = await this.colunasDoComprador(
          comprador,
          dto.pecuarista_id,
        );
        // Alíquotas vigentes na empresa no momento da criação: mudanças posteriores
        // na configuração não alteram os negócios já existentes. Gravadas mesmo quando o
        // tipo de negócio zera o imposto.
        const aliquotas = await this.aliquotasDaEmpresa(
          this.prisma,
          dto.empresa_id,
        );
        return this.prisma.negocio.create({
          include: INCLUDE_COMPRADOR,
          data: {
            ...dados,
            ...colunas,
            ...aliquotas,
            data_negocio: new Date(dto.data_negocio),
            // Ainda não há lotes (bruto = 0), então a comissão em R$ começa em 0
            // e é recalculada por recalcular() conforme o valor total muda.
            comissao: dto.porcentagem_comissao != null ? 0 : null,
            // Preenchidos pelo servidor: hora_inicio_pesagem no primeiro gado cadastrado
            // (GadosService.create) e hora_fim_pesagem ao concluir o cadastro (concluir()).
            hora_inicio_pesagem: null,
            hora_fim_pesagem: null,
            // NOT NULL no banco: começam em 0 e são preenchidos pelo recálculo a partir dos
            // lotes. Pesos, médias, extremos e rendimento médio ficam NULL até haver gados.
            valor_total_bruto: 0,
            valor_total_liquido: 0,
            qtd_animais: 0,
            // bruto = 0 → funrural e senar 0,00 (nunca NULL).
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
    // Mais recente primeiro (ordem de cadastro invertida).
    return this.prisma.negocio.findMany({
      where: filtroDeNegocios(fazendaId, dataInicio, dataFim),
      orderBy: { negocio_id: 'desc' },
      include: INCLUDE_COMPRADOR,
    });
  }

  /**
   * Métricas da Home e do Dashboard no período (mesmos filtros da listagem): quantidade de
   * negócios, soma das comissões em R$ e soma das cabeças. Para quem não é Admin, as três
   * saem `null` — nem são calculadas.
   */
  async resumo(
    podeVer: boolean,
    fazendaId?: number,
    dataInicio?: string,
    dataFim?: string,
  ): Promise<ResumoNegocios> {
    if (!podeVer) {
      return {
        negocios_realizados: null,
        comissao_total: null,
        total_cabecas: null,
      };
    }
    const resultado = await this.prisma.negocio.aggregate({
      where: filtroDeNegocios(fazendaId, dataInicio, dataFim),
      _count: { _all: true },
      _sum: { comissao: true, qtd_animais: true },
    });
    return {
      negocios_realizados: resultado._count._all,
      comissao_total: resultado._sum.comissao?.toNumber() ?? 0,
      total_cabecas: resultado._sum.qtd_animais ?? 0,
    };
  }

  async findOne(negocioId: number) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { negocio_id: negocioId },
      include: {
        ...INCLUDE_LOTES,
        ...INCLUDE_COMPRADOR,
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
    const { comprador, ...dados } = dto;
    const atual = await this.findOne(negocioId);
    const modalidade = dto.modalidade ?? atual.modalidade;
    const trocouModalidade = modalidade !== atual.modalidade;
    // Mudar o tipo de gado ou a modalidade pode mudar o que o valor da comissão significa
    // (R$ por arroba ↔ percentual): o valor antigo é descartado, salvo se vier um novo junto.
    const trocouModoComissao =
      modoComissao(dto.tipo_gado ?? atual.tipo_gado, modalidade) !==
      modoComissao(atual.tipo_gado, atual.modalidade);
    const qtdGados = atual.lotes.reduce((soma, l) => soma + l.gados.length, 0);
    // Em "kg", a arroba da cabeça depende do tipo de gado (÷ 15 ou ÷ 30, ver kgPorArroba).
    const trocouTipoGado =
      dto.tipo_gado !== undefined && dto.tipo_gado !== atual.tipo_gado;

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
    // Novo comprador; sem ele, o pecuarista comprador atual não pode virar o vendedor.
    let colunas: Partial<ColunasComprador> = {};
    if (comprador) {
      colunas = await this.colunasDoComprador(comprador, pecuaristaId);
    } else if (atual.comprador_pecuarista_id === pecuaristaId) {
      throw new BadRequestException(MENSAGEM_COMPRADOR_E_VENDEDOR);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.negocio.update({
          where: { negocio_id: negocioId },
          data: {
            ...dados,
            ...colunas,
            ...(dto.data_negocio
              ? { data_negocio: new Date(dto.data_negocio) }
              : {}),
            ...(trocouModoComissao && dto.porcentagem_comissao === undefined
              ? { porcentagem_comissao: null }
              : {}),
          },
        });
        if (trocouModalidade) {
          await this.ajustarLotesAModalidade(tx, negocioId, modalidade);
        } else if (trocouTipoGado && modalidade === 'kg') {
          for (const { lote_id } of atual.lotes) {
            await this.recalcularGadosDoLote(tx, lote_id);
          }
        }
        // Bruto, líquido, comissão, Funrural e Senar (dependem do tipo_negocio e do valor).
        await this.recalcular(tx, negocioId);
      });
    } catch (error) {
      handlePrismaError(error);
    }
    return this.prisma.negocio.findUniqueOrThrow({
      where: { negocio_id: negocioId },
      include: INCLUDE_COMPRADOR,
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
        include: INCLUDE_COMPRADOR,
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
   * do rendimento e do preço (valor_unidade) do lote e da modalidade e do tipo de gado do negócio.
   */
  async recalcularGadosDoLote(tx: Prisma.TransactionClient, loteId: number) {
    const lote = await tx.lote.findUniqueOrThrow({
      where: { lote_id: loteId },
      include: {
        negocio: {
          select: { modalidade: true, tipo_gado: true },
        },
        gados: true,
      },
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
          lote.negocio.tipo_gado,
        ),
      });
    }
  }

  /**
   * Recalcula os agregados de todos os lotes do negócio e os do próprio negócio
   * (quantidade, valores bruto e líquido, pesos, extremos, rendimento médio, comissão,
   * Funrural e Senar).
   * A comissão depende de tipo_gado e modalidade (ver modoComissao).
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
    const aliquotas = await this.aliquotasDoNegocio(tx, negocio);
    const impostos = calcularImpostos(
      agregados.valor_total_bruto,
      negocio.tipo_negocio as TipoNegocio,
      aliquotas.aliquota_funrural,
      aliquotas.aliquota_senar,
    );
    await tx.negocio.update({
      where: { negocio_id: negocioId },
      data: {
        ...agregados,
        comissao: calcularComissao({
          tipoGado: negocio.tipo_gado,
          modalidade: negocio.modalidade,
          valorTotal: agregados.valor_total_bruto,
          pesoTotalQuilos: agregados.peso_total_quilos ?? 0,
          valorInformado: negocio.porcentagem_comissao?.toNumber() ?? null,
        }),
        ...aliquotas,
        ...impostos,
        valor_total_liquido: calcularValorLiquido(
          agregados.valor_total_bruto,
          impostos.funrural,
          impostos.senar,
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
   * Comprador escolhido → colunas do negócio. O banco recusaria (CHECK/FK) um comprador
   * inexistente ou o próprio vendedor; a checagem aqui devolve 400 com mensagem clara.
   * Frigorífico e pecuarista não têm empresa no banco: basta existirem.
   */
  private async colunasDoComprador(
    comprador: CompradorDoNegocioDto,
    vendedorId: number,
  ): Promise<ColunasComprador> {
    if (comprador.tipo === 'frigorifico') {
      const existe = await this.prisma.comprador.findUnique({
        where: { comprador_id: comprador.id },
        select: { comprador_id: true },
      });
      if (!existe) {
        throw new BadRequestException(MENSAGEM_COMPRADOR_NAO_ENCONTRADO);
      }
      return { comprador_id: comprador.id, comprador_pecuarista_id: null };
    }
    if (comprador.id === vendedorId) {
      throw new BadRequestException(MENSAGEM_COMPRADOR_E_VENDEDOR);
    }
    const existe = await this.prisma.pecuarista.findUnique({
      where: { pecuarista_id: comprador.id },
      select: { pecuarista_id: true },
    });
    if (!existe) {
      throw new BadRequestException(MENSAGEM_COMPRADOR_NAO_ENCONTRADO);
    }
    return { comprador_id: null, comprador_pecuarista_id: comprador.id };
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
