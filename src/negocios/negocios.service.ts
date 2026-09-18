import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';

@Injectable()
export class NegociosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNegocioDto) {
    try {
      return await this.prisma.negocio.create({
        data: {
          ...dto,
          data_negocio: new Date(dto.data_negocio),
          // Agregados sobre os gados do negócio — recalculados por recalcularAgregados()
          // conforme gados são criados/atualizados/removidos. Não existem gados ainda na criação.
          valor_total: 0,
          valor_medio: 0,
          qtd_animais: 0,
          mais_pesado: 0,
          mais_leve: 0,
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
      include: { gados: true },
    });
    if (!negocio) {
      throw new NotFoundException(`Negócio ${negocioId} não encontrado`);
    }
    return negocio;
  }

  async update(negocioId: number, dto: UpdateNegocioDto) {
    await this.findOne(negocioId);
    try {
      return await this.prisma.negocio.update({
        where: { negocio_id: negocioId },
        data: {
          ...dto,
          ...(dto.data_negocio
            ? { data_negocio: new Date(dto.data_negocio) }
            : {}),
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
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
