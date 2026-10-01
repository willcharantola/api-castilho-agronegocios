import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '../common/prisma-error.util';
import { horaAtual } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';

@Injectable()
export class NegociosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNegocioDto) {
    // Na modalidade "cabeca" não há pesagem física: os agregados de peso ficam NULL
    // e qtd_animais/valor_total são informados depois via PATCH /negocios/:id.
    const porCabeca = dto.modalidade === 'cabeca';
    try {
      return await this.prisma.negocio.create({
        data: {
          ...dto,
          data_negocio: new Date(dto.data_negocio),
          // TODO: remover esta coluna via migration (DROP COLUMN tipo_precificacao) assim que houver acesso ao banco; até lá, mantém-se este valor fixo apenas para satisfazer a restrição NOT NULL
          tipo_precificacao: 'N/A',
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
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
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
      include: { gados: true, comprador: true, vendedor: true, fazenda: true },
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
    // sempre que um dos dois muda. mais_pesado, mais_leve, valor_medio e os horários
    // de pesagem não são tocados aqui (permanecem NULL).
    let valorTotalPorCabeca: { valor_total: number } | undefined;
    if (
      atual.modalidade === 'cabeca' &&
      (campos.qtd_animais !== undefined || campos.valor_unidade !== undefined)
    ) {
      const qtd = campos.qtd_animais ?? atual.qtd_animais;
      const valorUnidade =
        campos.valor_unidade ?? atual.valor_unidade.toNumber();
      valorTotalPorCabeca = { valor_total: qtd * valorUnidade };
    }

    try {
      return await this.prisma.negocio.update({
        where: { negocio_id: negocioId },
        data: {
          ...campos,
          ...valorTotalPorCabeca,
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
   * registra hora_fim_pesagem com a hora local do cliente (ver horaAtual).
   */
  async concluir(negocioId: number, fuso?: string) {
    await this.findOne(negocioId);
    try {
      return await this.prisma.negocio.update({
        where: { negocio_id: negocioId },
        data: { hora_fim_pesagem: horaAtual(fuso) },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Registra hora_inicio_pesagem apenas se ainda estiver NULL — ou seja, só no
   * primeiro gado cadastrado no negócio. O filtro no próprio UPDATE torna a
   * operação atômica: cadastros simultâneos não sobrescrevem o valor.
   */
  async registrarInicioPesagem(negocioId: number, fuso?: string) {
    await this.prisma.negocio.updateMany({
      where: { negocio_id: negocioId, hora_inicio_pesagem: null },
      data: { hora_inicio_pesagem: horaAtual(fuso) },
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
   * mais_pesado, mais_leve) a partir dos gados atualmente vinculados a ele.
   * Chamado pelo GadosService sempre que um gado é criado, atualizado ou removido.
   */
  async recalcularAgregados(negocioId: number) {
    const gados = await this.prisma.gado.findMany({
      where: { negocio_id: negocioId },
    });

    const qtd_animais = gados.length;
    const valorTotal = gados.reduce(
      (soma, gado) => soma + gado.valor_total.toNumber(),
      0,
    );
    const valorMedio = qtd_animais > 0 ? valorTotal / qtd_animais : 0;
    const pesos = gados.map((gado) => gado.peso_total.toNumber());
    const maisPesado = pesos.length > 0 ? Math.max(...pesos) : 0;
    const maisLeve = pesos.length > 0 ? Math.min(...pesos) : 0;

    await this.prisma.negocio.update({
      where: { negocio_id: negocioId },
      data: {
        qtd_animais,
        valor_total: valorTotal,
        valor_medio: valorMedio,
        mais_pesado: maisPesado,
        mais_leve: maisLeve,
      },
    });
  }
}
