import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { horaAtual, horaParaDate } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';

/** Valor da comissão em R$, arredondado a centavos (coluna Decimal(15, 2)). */
function calcularComissao(valorTotal: number, porcentagem: number) {
  return Math.round(valorTotal * porcentagem) / 100;
}

/** Alíquotas de Funrural e Senar em pontos percentuais (1.5 = 1,5%). */
type Aliquotas = { aliquota_funrural: number; aliquota_senar: number };

/** Valor em R$ arredondado a centavos (colunas Decimal(14, 2)). */
function arredondarCentavos(valor: number) {
  return Math.round(valor * 100) / 100;
}

/**
 * Funrural e Senar (R$) a partir do valor_total e das alíquotas gravadas no próprio
 * negócio — calcular sempre DEPOIS do valor_total. Sem valor_total (> 0), ficam NULL.
 */
function calcularContribuicoes(valorTotal: number, aliquotas: Aliquotas) {
  if (!(valorTotal > 0)) return { funrural: null, senar: null };
  return {
    funrural: arredondarCentavos(
      (valorTotal * aliquotas.aliquota_funrural) / 100,
    ),
    senar: arredondarCentavos((valorTotal * aliquotas.aliquota_senar) / 100),
  };
}

const SELECT_ALIQUOTAS = {
  aliquota_funrural: true,
  aliquota_senar: true,
} as const;

@Injectable()
export class NegociosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNegocioDto) {
    // Na modalidade "cabeca" não há pesagem física: os agregados de peso ficam NULL
    // e qtd_animais/valor_total são informados depois via PATCH /negocios/:id.
    const porCabeca = dto.modalidade === 'cabeca';
    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.negocio.findUnique({ where: { uuid_origem } }),
      async () =>
        this.prisma.negocio.create({
          data: {
            ...dto,
            // Alíquotas vigentes na empresa no momento da criação: mudanças posteriores
            // na configuração não alteram os negócios já existentes.
            ...(await this.aliquotasDaEmpresa(this.prisma, dto.empresa_id)),
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
            // Campos do romaneio (pesos, rendimento, funrural, senar) ficam NULL até
            // haver gados / valor_total — preenchidos por recalcularAgregados() e update().
          },
        }),
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

    return this.prisma.negocio.findMany({ where });
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
    return negocio;
  }

  async update(negocioId: number, dto: UpdateNegocioDto) {
    const atual = await this.findOne(negocioId);
    // valor_total nunca é aceito do cliente — cálculo autoritativo no servidor.
    const { valor_total: _valorTotalIgnorado, ...campos } = dto;

    // qtd_animais só pode ser informado diretamente na modalidade "cabeca"; nas demais
    // é um agregado dos registros de `gado` (ver recalcularAgregados()).
    if (campos.qtd_animais !== undefined && atual.modalidade !== 'cabeca') {
      throw new BadRequestException(
        `qtd_animais só pode ser informado para negócios da modalidade "cabeca" ` +
          `(negócio ${negocioId} é "${atual.modalidade}")`,
      );
    }

    // Modalidade "cabeca": valor_total = qtd_animais × valor_unidade, recalculado
    // sempre que um dos dois muda, junto com funrural e senar (dependem dele).
    // mais_pesado, mais_leve, valor_medio, os horários de pesagem e os campos de
    // peso/rendimento não são tocados aqui (permanecem NULL).
    let valorTotalPorCabeca:
      | ({ valor_total: number } & Aliquotas &
          ReturnType<typeof calcularContribuicoes>)
      | undefined;
    if (
      atual.modalidade === 'cabeca' &&
      (campos.qtd_animais !== undefined || campos.valor_unidade !== undefined)
    ) {
      const qtd = campos.qtd_animais ?? atual.qtd_animais;
      const valorUnidade =
        campos.valor_unidade ?? atual.valor_unidade.toNumber();
      const valorTotalCabeca = qtd * valorUnidade;
      const aliquotas = await this.aliquotasDoNegocio(this.prisma, atual);
      valorTotalPorCabeca = {
        valor_total: valorTotalCabeca,
        ...aliquotas,
        ...calcularContribuicoes(valorTotalCabeca, aliquotas),
      };
    }

    // comissao (R$) = valor_total × porcentagem_comissao / 100, recalculada quando o
    // percentual ou o valor total mudam. Sem percentual definido, não é tocada.
    const porcentagem =
      campos.porcentagem_comissao ?? atual.porcentagem_comissao?.toNumber();
    const valorTotal =
      valorTotalPorCabeca?.valor_total ?? atual.valor_total.toNumber();
    const comissao =
      porcentagem != null &&
      (campos.porcentagem_comissao !== undefined || valorTotalPorCabeca)
        ? { comissao: calcularComissao(valorTotal, porcentagem) }
        : {};

    try {
      return await this.prisma.negocio.update({
        where: { negocio_id: negocioId },
        data: {
          ...campos,
          ...valorTotalPorCabeca,
          ...comissao,
          ...(campos.data_negocio
            ? { data_negocio: new Date(campos.data_negocio) }
            : {}),
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
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
   * médios, rendimento médio, funrural, senar) a partir dos gados atualmente
   * vinculados a ele, numa única transação e num único UPDATE.
   * Chamado pelo GadosService sempre que um gado é criado, atualizado ou removido.
   */
  async recalcularAgregados(negocioId: number) {
    await this.prisma.$transaction(async (tx) => {
      const gados = await tx.gado.findMany({
        where: { negocio_id: negocioId },
      });
      const negocio = await tx.negocio.findUniqueOrThrow({
        where: { negocio_id: negocioId },
        select: {
          porcentagem_comissao: true,
          empresa_id: true,
          ...SELECT_ALIQUOTAS,
        },
      });
      const porcentagem = negocio.porcentagem_comissao?.toNumber();
      const aliquotas = await this.aliquotasDoNegocio(tx, negocio);

      const qtd_animais = gados.length;
      const somar = (valor: (gado: (typeof gados)[number]) => number) =>
        gados.reduce((soma, gado) => soma + valor(gado), 0);

      // valor_total primeiro: funrural e senar dependem dele.
      const valorTotal = somar((gado) => gado.valor_total.toNumber());
      const valorMedio = qtd_animais > 0 ? valorTotal / qtd_animais : 0;
      const pesos = gados.map((gado) => gado.peso_total.toNumber());
      const maisPesado = pesos.length > 0 ? Math.max(...pesos) : 0;
      const maisLeve = pesos.length > 0 ? Math.min(...pesos) : 0;

      // Campos do romaneio — sem arredondamento (exceto o da própria coluna). Sem
      // gados, ficam NULL (nunca divide por zero).
      const pesoTotalQuilos = somar((gado) => gado.peso_total.toNumber());
      const pesoTotalArroba = somar((gado) => gado.peso_arroba.toNumber());
      const camposRomaneio =
        qtd_animais > 0
          ? {
              peso_total_quilos: pesoTotalQuilos,
              peso_total_arroba: pesoTotalArroba,
              rendimento_medio:
                somar((gado) => gado.rendimento_carcaca.toNumber()) /
                qtd_animais,
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
          valor_total: valorTotal,
          valor_medio: valorMedio,
          mais_pesado: maisPesado,
          mais_leve: maisLeve,
          ...(porcentagem != null
            ? { comissao: calcularComissao(valorTotal, porcentagem) }
            : {}),
          ...camposRomaneio,
          ...aliquotas,
          ...calcularContribuicoes(valorTotal, aliquotas),
        },
      });
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
   * Alíquotas gravadas no negócio. Negócios antigos sem elas (NULL) passam a usar as
   * da empresa — quem chama grava o resultado junto com funrural/senar.
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
