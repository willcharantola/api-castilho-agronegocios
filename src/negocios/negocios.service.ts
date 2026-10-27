import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  COLUNAS_RENDIMENTO,
  RENDIMENTO_NEUTRO,
  type ColunaRendimento,
  type TipoNegocio,
} from '../common/dominio';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { horaAtual, horaParaDate } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  arredondarCentavos,
  calcularComissao,
  calcularImpostos,
  calcularRendimentoMedio,
  calcularValoresGado,
  rendimentoDaRaca,
  ehRacaRendimento,
  type RendimentosNegocio,
} from './calculo.util';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';

/** Alíquotas de Funrural e Senar em pontos percentuais (1.5 = 1,5%). */
type Aliquotas = { aliquota_funrural: number; aliquota_senar: number };

const SELECT_ALIQUOTAS = {
  aliquota_funrural: true,
  aliquota_senar: true,
} as const;

const SELECT_RENDIMENTOS = {
  porcentagem_rendimento_nelore: true,
  porcentagem_rendimento_anelorado: true,
  porcentagem_rendimento_angus: true,
  porcentagem_rendimento_composto: true,
} as const;

/** Tudo o que recalcularAgregados()/recalcularGados() leem do negócio. */
const SELECT_CALCULO = {
  empresa_id: true,
  modalidade: true,
  valor_unidade: true,
  qtd_animais: true,
  tipo_negocio: true,
  porcentagem_comissao: true,
  ...SELECT_ALIQUOTAS,
  ...SELECT_RENDIMENTOS,
} as const;

export const MENSAGEM_FAZENDA_DE_OUTRO_PECUARISTA =
  'A fazenda não pertence ao pecuarista selecionado';

/** Os quatro percentuais do negócio (Decimal do Prisma) como number. */
export function rendimentosDoNegocio(
  negocio: Record<ColunaRendimento, Prisma.Decimal>,
): RendimentosNegocio {
  return Object.fromEntries(
    COLUNAS_RENDIMENTO.map((coluna) => [coluna, negocio[coluna].toNumber()]),
  ) as RendimentosNegocio;
}

/**
 * Acrescenta à resposta o campo derivado `rendimento_carcaca` (percentual da categoria do
 * animal no negócio). Não é coluna nem aceito em escrita — existe só para o front e o
 * romaneio continuarem exibindo o rendimento por cabeça.
 */
export function comRendimentoDerivado<T extends { denominacao: string }>(
  gado: T,
  rendimentos: RendimentosNegocio,
): T & { rendimento_carcaca: number | null } {
  return {
    ...gado,
    rendimento_carcaca: ehRacaRendimento(gado.denominacao)
      ? rendimentoDaRaca(rendimentos, gado.denominacao)
      : null,
  };
}

@Injectable()
export class NegociosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNegocioDto) {
    // Na modalidade "cabeca" não há pesagem física: os agregados de peso ficam NULL
    // e qtd_animais/valor_total são informados depois via PATCH /negocios/:id.
    const porCabeca = dto.modalidade === 'cabeca';
    const rendimentos = this.rendimentosParaGravar(dto.modalidade, dto);
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
            ...rendimentos,
            ...aliquotas,
            data_negocio: new Date(dto.data_negocio),
            // Ainda não há gados (valor_total = 0), então a comissão em R$ começa em 0
            // e é recalculada por recalcularAgregados() conforme o valor total muda.
            comissao: dto.porcentagem_comissao != null ? 0 : null,
            // Preenchidos pelo servidor: hora_inicio_pesagem no primeiro gado cadastrado
            // (GadosService.create) e hora_fim_pesagem ao concluir o cadastro (concluir()).
            hora_inicio_pesagem: null,
            hora_fim_pesagem: null,
            // Agregados sobre os gados do negócio — recalculados por recalcularAgregados()
            // conforme gados são criados/atualizados/removidos. Não existem gados ainda na criação.
            valor_total: 0,
            valor_medio: porCabeca ? null : 0,
            qtd_animais: 0,
            mais_pesado: porCabeca ? null : 0,
            mais_leve: porCabeca ? null : 0,
            // valor_total = 0 → funrural e senar 0,00 (nunca NULL).
            ...calcularImpostos(
              0,
              dto.tipo_negocio as TipoNegocio,
              aliquotas.aliquota_funrural,
              aliquotas.aliquota_senar,
            ),
            // Pesos e rendimento médio ficam NULL até haver gados (recalcularAgregados()).
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
        gados: true,
        comprador: true,
        pecuarista: true,
        fazenda: true,
      },
    });
    if (!negocio) {
      throw new NotFoundException(`Negócio ${negocioId} não encontrado`);
    }
    const rendimentos = rendimentosDoNegocio(negocio);
    return {
      ...negocio,
      gados: negocio.gados.map((gado) =>
        comRendimentoDerivado(gado, rendimentos),
      ),
    };
  }

  async update(negocioId: number, dto: UpdateNegocioDto) {
    const atual = await this.findOne(negocioId);
    // valor_total nunca é aceito do cliente — cálculo autoritativo no servidor.
    const { valor_total: _valorTotalIgnorado, ...campos } = dto;
    const modalidade = campos.modalidade ?? atual.modalidade;

    // qtd_animais só pode ser informado diretamente na modalidade "cabeca"; nas demais
    // é um agregado dos registros de `gado` (ver recalcularAgregados()).
    if (campos.qtd_animais !== undefined && modalidade !== 'cabeca') {
      throw new BadRequestException(
        `qtd_animais só pode ser informado para negócios da modalidade "cabeca" ` +
          `(negócio ${negocioId} é "${modalidade}")`,
      );
    }
    const trocouModalidade = modalidade !== atual.modalidade;
    if (trocouModalidade && atual.gados.length > 0) {
      throw new BadRequestException(
        'Não é possível trocar a modalidade de um negócio que já tem gados cadastrados',
      );
    }

    // Percentuais ausentes no PATCH continuam os gravados (se o negócio já era "arroba").
    const rendimentosAtuais = rendimentosDoNegocio(atual);
    const rendimentos = this.rendimentosParaGravar(
      modalidade,
      Object.fromEntries(
        COLUNAS_RENDIMENTO.map((coluna) => [
          coluna,
          campos[coluna] ??
            (atual.modalidade === 'arroba'
              ? rendimentosAtuais[coluna]
              : undefined),
        ]),
      ),
    );
    const mudouRendimento = COLUNAS_RENDIMENTO.some(
      (coluna) => rendimentos[coluna] !== rendimentosAtuais[coluna],
    );

    const pecuaristaId = campos.pecuarista_id ?? atual.pecuarista_id;
    const fazendaId = campos.fazenda_id ?? atual.fazenda_id;
    if (
      pecuaristaId !== atual.pecuarista_id ||
      fazendaId !== atual.fazenda_id
    ) {
      await this.garantirVinculo(pecuaristaId, fazendaId);
    }

    // Os valores de cada animal dependem do rendimento da raça e do valor por unidade.
    const recalcularAnimais =
      modalidade !== 'cabeca' &&
      (mudouRendimento ||
        trocouModalidade ||
        (campos.valor_unidade !== undefined &&
          campos.valor_unidade !== atual.valor_unidade.toNumber()));

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.negocio.update({
          where: { negocio_id: negocioId },
          data: {
            ...campos,
            ...rendimentos,
            ...(campos.data_negocio
              ? { data_negocio: new Date(campos.data_negocio) }
              : {}),
          },
        });
        if (recalcularAnimais) await this.recalcularGados(tx, negocioId);
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
  async registrarInicioPesagem(negocioId: number, horario: Date) {
    await this.prisma.negocio.updateMany({
      where: { negocio_id: negocioId, hora_inicio_pesagem: null },
      data: { hora_inicio_pesagem: horario },
    });
  }

  async remove(negocioId: number) {
    await this.findOne(negocioId);
    try {
      return await this.prisma.negocio.delete({
        where: { negocio_id: negocioId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Recalcula os agregados do negócio (valor_total, valor_medio, qtd_animais,
   * mais_pesado, mais_leve, comissao) e os campos do romaneio (pesos totais e
   * médios, rendimento médio, funrural, senar), numa única transação e num único UPDATE.
   * Chamado pelo GadosService sempre que um gado é criado, atualizado ou removido.
   */
  async recalcularAgregados(negocioId: number) {
    await this.prisma.$transaction((tx) => this.recalcular(tx, negocioId));
  }

  /** Parâmetros do negócio usados no cálculo de cada animal (GadosService). */
  async parametrosCalculo(negocioId: number) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { negocio_id: negocioId },
      select: SELECT_CALCULO,
    });
    if (!negocio) {
      throw new NotFoundException(`Negócio ${negocioId} não encontrado`);
    }
    return {
      modalidade: negocio.modalidade,
      valorUnidade: negocio.valor_unidade.toNumber(),
      rendimentos: rendimentosDoNegocio(negocio),
    };
  }

  /**
   * Na modalidade "arroba" os quatro percentuais são obrigatórios; em "kg" e "cabeca"
   * a API grava 100 em todos (rendimento neutro: peso_calculo = peso_total), ignorando
   * o que vier do cliente — as colunas são NOT NULL.
   */
  private rendimentosParaGravar(
    modalidade: string,
    valores: Partial<Record<ColunaRendimento, number>>,
  ): RendimentosNegocio {
    if (modalidade !== 'arroba') {
      return Object.fromEntries(
        COLUNAS_RENDIMENTO.map((coluna) => [coluna, RENDIMENTO_NEUTRO]),
      ) as RendimentosNegocio;
    }
    const faltando = COLUNAS_RENDIMENTO.filter(
      (coluna) => valores[coluna] == null,
    );
    if (faltando.length > 0) {
      throw new BadRequestException(
        'Na modalidade "arroba" informe os quatro percentuais de rendimento ' +
          `(faltando: ${faltando.join(', ')})`,
      );
    }
    return Object.fromEntries(
      COLUNAS_RENDIMENTO.map((coluna) => [coluna, valores[coluna]]),
    ) as RendimentosNegocio;
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

  /** Recalcula peso_calculo, peso_arroba e valor_total de todos os animais do negócio. */
  private async recalcularGados(
    tx: Prisma.TransactionClient,
    negocioId: number,
  ) {
    const negocio = await tx.negocio.findUniqueOrThrow({
      where: { negocio_id: negocioId },
      select: SELECT_CALCULO,
    });
    const rendimentos = rendimentosDoNegocio(negocio);
    const gados = await tx.gado.findMany({ where: { negocio_id: negocioId } });
    for (const gado of gados) {
      await tx.gado.update({
        where: { gado_id: gado.gado_id },
        data: calcularValoresGado(
          negocio.modalidade,
          gado.peso_total.toNumber(),
          rendimentoDaRaca(rendimentos, gado.denominacao),
          negocio.valor_unidade.toNumber(),
        ),
      });
    }
  }

  private async recalcular(tx: Prisma.TransactionClient, negocioId: number) {
    const negocio = await tx.negocio.findUniqueOrThrow({
      where: { negocio_id: negocioId },
      select: SELECT_CALCULO,
    });
    const porcentagem = negocio.porcentagem_comissao?.toNumber();
    const aliquotas = await this.aliquotasDoNegocio(tx, negocio);

    // valor_total primeiro: comissão, funrural e senar dependem dele.
    const dependentesDoValor = (valorTotal: number) => ({
      valor_total: valorTotal,
      ...(porcentagem != null
        ? { comissao: calcularComissao(valorTotal, porcentagem) }
        : {}),
      ...aliquotas,
      ...calcularImpostos(
        valorTotal,
        negocio.tipo_negocio as TipoNegocio,
        aliquotas.aliquota_funrural,
        aliquotas.aliquota_senar,
      ),
    });

    // Modalidade "cabeca": valor_total = qtd_animais × valor_unidade. mais_pesado,
    // mais_leve, valor_medio, os horários de pesagem e os campos de peso/rendimento
    // não se aplicam (permanecem NULL).
    if (negocio.modalidade === 'cabeca') {
      await tx.negocio.update({
        where: { negocio_id: negocioId },
        data: dependentesDoValor(
          arredondarCentavos(
            negocio.qtd_animais * negocio.valor_unidade.toNumber(),
          ),
        ),
      });
      return;
    }

    const gados = (
      await tx.gado.findMany({ where: { negocio_id: negocioId } })
    ).map((gado) => ({
      valor_total: gado.valor_total.toNumber(),
      peso_total: gado.peso_total.toNumber(),
      peso_calculo: gado.peso_calculo.toNumber(),
      peso_arroba: gado.peso_arroba.toNumber(),
    }));
    const qtd_animais = gados.length;
    const somar = (valor: (gado: (typeof gados)[number]) => number) =>
      gados.reduce((soma, gado) => soma + valor(gado), 0);

    const valorTotal = arredondarCentavos(somar((gado) => gado.valor_total));
    const pesos = gados.map((gado) => gado.peso_total);

    // Campos do romaneio — sem arredondamento (exceto o da própria coluna). Sem
    // gados, ficam NULL (nunca divide por zero).
    const pesoTotalQuilos = somar((gado) => gado.peso_total);
    const pesoTotalArroba = somar((gado) => gado.peso_arroba);
    const camposRomaneio =
      qtd_animais > 0
        ? {
            peso_total_quilos: pesoTotalQuilos,
            peso_total_arroba: pesoTotalArroba,
            // Ponderado pelo peso: SUM(peso_calculo) / SUM(peso_total) × 100.
            rendimento_medio: calcularRendimentoMedio(gados),
            peso_medio_arroba: pesoTotalArroba / qtd_animais,
            peso_medio_quilos: pesoTotalQuilos / qtd_animais,
          }
        : {
            peso_total_quilos: null,
            peso_total_arroba: null,
            rendimento_medio: null,
            peso_medio_arroba: null,
            peso_medio_quilos: null,
          };

    await tx.negocio.update({
      where: { negocio_id: negocioId },
      data: {
        qtd_animais,
        valor_medio: qtd_animais > 0 ? valorTotal / qtd_animais : 0,
        mais_pesado: pesos.length > 0 ? Math.max(...pesos) : 0,
        mais_leve: pesos.length > 0 ? Math.min(...pesos) : 0,
        ...camposRomaneio,
        ...dependentesDoValor(valorTotal),
      },
    });
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
