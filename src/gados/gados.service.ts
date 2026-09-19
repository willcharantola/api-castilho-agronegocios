import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { handlePrismaError } from '../common/prisma-error.util';
import { NegociosService } from '../negocios/negocios.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGadoDto } from './dto/create-gado.dto';
import { UpdateGadoDto } from './dto/update-gado.dto';

interface ValoresCalculados {
  peso_calculo: number;
  peso_arroba: number;
  valor_total: number;
}

@Injectable()
export class GadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  /**
   * Calcula os valores do gado conforme a modalidade do negócio.
   * TODO: confirmar com o responsável pelo projeto se o campo deveria ser renomeado
   * para algo mais genérico como valor_unidade, já que hoje seu nome (valor_arroba)
   * sugere ser exclusivo da modalidade arroba. Aqui ele é lido como "valor por
   * unidade" (arroba, kg ou cabeça, conforme a modalidade).
   * Para "kg" e "cabeca", peso_calculo e peso_arroba não se aplicam e são gravados
   * como 0 (colunas NOT NULL no schema).
   */
  private calcularValores(
    pesoTotal: number,
    rendimentoCarcaca: number,
    modalidade: string,
    valorUnidade: number,
  ): ValoresCalculados {
    switch (modalidade) {
      case 'arroba': {
        const peso_calculo = pesoTotal * (rendimentoCarcaca / 100);
        const peso_arroba = Math.ceil(peso_calculo / 15);
        const valor_total = peso_arroba * valorUnidade;
        return { peso_calculo, peso_arroba, valor_total };
      }
      case 'kg':
        return {
          peso_calculo: 0,
          peso_arroba: 0,
          valor_total: valorUnidade * pesoTotal,
        };
      case 'cabeca':
        return { peso_calculo: 0, peso_arroba: 0, valor_total: valorUnidade };
      default:
        throw new BadRequestException(`Modalidade inválida: ${modalidade}`);
    }
  }

  private async buscarParametrosNegocio(negocioId: number) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { negocio_id: negocioId },
      select: {
        rendimento_carcaca: true,
        modalidade: true,
        valor_arroba: true,
      },
    });
    if (!negocio) {
      throw new NotFoundException(`Negócio ${negocioId} não encontrado`);
    }
    return {
      rendimentoCarcaca: negocio.rendimento_carcaca.toNumber(),
      modalidade: negocio.modalidade,
      valorUnidade: negocio.valor_arroba.toNumber(),
    };
  }

  async create(dto: CreateGadoDto) {
    const negocio = await this.buscarParametrosNegocio(dto.negocio_id);
    const valores = this.calcularValores(
      dto.peso_total,
      negocio.rendimentoCarcaca,
      negocio.modalidade,
      negocio.valorUnidade,
    );

    let gado;
    try {
      gado = await this.prisma.gado.create({
        data: {
          ...dto,
          data_pesagem: new Date(dto.data_pesagem),
          ...valores,
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }

    await this.negociosService.recalcularAgregados(dto.negocio_id);
    return gado;
  }

  findAll() {
    return this.prisma.gado.findMany();
  }

  async findOne(gadoId: number) {
    const gado = await this.prisma.gado.findUnique({
      where: { gado_id: gadoId },
    });
    if (!gado) {
      throw new NotFoundException(`Gado ${gadoId} não encontrado`);
    }
    return gado;
  }

  async update(gadoId: number, dto: UpdateGadoDto) {
    const atual = await this.findOne(gadoId);

    const negocioDestino = dto.negocio_id ?? atual.negocio_id;
    const precisaRecalcular =
      dto.peso_total !== undefined || dto.negocio_id !== undefined;
    let valores: Partial<ValoresCalculados> = {};
    if (precisaRecalcular) {
      const negocio = await this.buscarParametrosNegocio(negocioDestino);
      valores = this.calcularValores(
        dto.peso_total ?? atual.peso_total.toNumber(),
        negocio.rendimentoCarcaca,
        negocio.modalidade,
        negocio.valorUnidade,
      );
    }

    let gado;
    try {
      gado = await this.prisma.gado.update({
        where: { gado_id: gadoId },
        data: {
          ...dto,
          ...(dto.data_pesagem
            ? { data_pesagem: new Date(dto.data_pesagem) }
            : {}),
          ...valores,
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }

    await this.negociosService.recalcularAgregados(atual.negocio_id);
    if (negocioDestino !== atual.negocio_id) {
      await this.negociosService.recalcularAgregados(negocioDestino);
    }
    return gado;
  }

  async remove(gadoId: number) {
    const atual = await this.findOne(gadoId);
    try {
      const gado = await this.prisma.gado.delete({
        where: { gado_id: gadoId },
      });
      await this.negociosService.recalcularAgregados(atual.negocio_id);
      return gado;
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
