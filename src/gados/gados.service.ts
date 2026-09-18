import { Injectable, NotFoundException } from '@nestjs/common';
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
   * Replica a lógica de cálculo já usada na demonstração do front-end.
   * TODO: a fórmula de valor_total (peso_calculo * peso_arroba) multiplica duas
   * grandezas de peso entre si e foge do cálculo usual do setor (peso da arroba ×
   * valor pago por arroba, que é monetário). Era um placeholder de demonstração
   * visual — confirmar com o responsável pelo projeto antes de tratar como regra
   * de negócio definitiva.
   */
  private calcularValores(
    pesoTotal: number,
    rendimentoCarcaca: number,
  ): ValoresCalculados {
    const peso_calculo = pesoTotal * (rendimentoCarcaca / 100);
    const peso_arroba = peso_calculo / 15;
    const valor_total = peso_calculo * peso_arroba;
    return { peso_calculo, peso_arroba, valor_total };
  }

  private async buscarRendimentoCarcaca(negocioId: number): Promise<number> {
    const negocio = await this.prisma.negocio.findUnique({
      where: { negocio_id: negocioId },
      select: { rendimento_carcaca: true },
    });
    if (!negocio) {
      throw new NotFoundException(`Negócio ${negocioId} não encontrado`);
    }
    return negocio.rendimento_carcaca.toNumber();
  }

  async create(dto: CreateGadoDto) {
    const rendimentoCarcaca = await this.buscarRendimentoCarcaca(
      dto.negocio_id,
    );
    const valores = this.calcularValores(dto.peso_total, rendimentoCarcaca);

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
      const rendimentoCarcaca =
        await this.buscarRendimentoCarcaca(negocioDestino);
      valores = this.calcularValores(
        dto.peso_total ?? atual.peso_total.toNumber(),
        rendimentoCarcaca,
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
