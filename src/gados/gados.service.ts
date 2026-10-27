import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type gado } from '@prisma/client';
import { handlePrismaError } from '../common/prisma-error.util';
import { criarIdempotente } from '../common/idempotencia.util';
import { horaAtual, horaParaDate } from '../common/time.util';
import {
  calcularValoresGado,
  rendimentoDaRaca,
  type ValoresGado,
} from '../negocios/calculo.util';
import {
  comRendimentoDerivado,
  NegociosService,
  rendimentosDoNegocio,
} from '../negocios/negocios.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGadoDto } from './dto/create-gado.dto';
import { UpdateGadoDto } from './dto/update-gado.dto';

@Injectable()
export class GadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  /**
   * Valores do gado a partir do percentual de rendimento da categoria do animal
   * (denominacao) no negócio — ver calcularValoresGado().
   */
  private async calcularValores(
    negocioId: number,
    pesoTotal: number,
    denominacao: string,
  ): Promise<ValoresGado> {
    const negocio = await this.negociosService.parametrosCalculo(negocioId);
    this.garantirModalidadeComGado(negocio.modalidade, negocioId);
    return calcularValoresGado(
      negocio.modalidade,
      pesoTotal,
      rendimentoDaRaca(negocio.rendimentos, denominacao),
      negocio.valorUnidade,
    );
  }

  /** Resposta com o campo derivado rendimento_carcaca (ver comRendimentoDerivado). */
  private async comRendimento<T extends gado>(registro: T) {
    const { rendimentos } = await this.negociosService.parametrosCalculo(
      registro.negocio_id,
    );
    return comRendimentoDerivado(registro, rendimentos);
  }

  /**
   * PROVISÓRIO (ponto em aberto #1, aguardando decisão do responsável pelo projeto):
   * negócios da modalidade "cabeca" não têm registros individuais em `gado` — a
   * quantidade vai direto em negocio.qtd_animais via PATCH /negocios/:id. Bloqueia
   * novos vínculos para não misturar os dois modelos (recalcularAgregados()
   * sobrescreveria o qtd_animais informado).
   */
  private garantirModalidadeComGado(modalidade: string, negocioId: number) {
    if (modalidade === 'cabeca') {
      throw new BadRequestException(
        `Negócio ${negocioId} é da modalidade "cabeca" e não aceita cadastro individual de gado`,
      );
    }
  }

  async create(dto: CreateGadoDto, fuso?: string) {
    const valores = await this.calcularValores(
      dto.negocio_id,
      dto.peso_total,
      dto.denominacao,
    );

    // Online: hora local do cliente no momento do cadastro (instante do servidor, fuso do
    // cliente). Fila offline (uuid_origem): a hora capturada no aparelho na pesagem, já
    // que a sincronização pode acontecer horas depois.
    const { horario_pesagem: horarioInformado, ...dados } = dto;
    const horarioPesagem =
      dto.uuid_origem && horarioInformado
        ? horaParaDate(horarioInformado)
        : horaAtual(fuso);

    const { registro: gado, existente } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) => this.prisma.gado.findUnique({ where: { uuid_origem } }),
      () =>
        this.prisma.gado.create({
          data: {
            ...dados,
            data_pesagem: new Date(dto.data_pesagem),
            horario_pesagem: horarioPesagem,
            ...valores,
          },
        }),
    );
    // Reenvio de um gado já sincronizado: nada mudou no negócio.
    if (existente) return this.comRendimento(gado);

    // Primeiro gado do negócio marca o início da pesagem (no-op nos seguintes).
    await this.negociosService.registrarInicioPesagem(
      dto.negocio_id,
      horarioPesagem,
    );
    await this.negociosService.recalcularAgregados(dto.negocio_id);
    return this.comRendimento(gado);
  }

  async findAll() {
    const gados = await this.prisma.gado.findMany({
      include: {
        negocio: {
          select: {
            porcentagem_rendimento_nelore: true,
            porcentagem_rendimento_anelorado: true,
            porcentagem_rendimento_angus: true,
            porcentagem_rendimento_composto: true,
          },
        },
      },
    });
    return gados.map(({ negocio, ...gado }) =>
      comRendimentoDerivado(gado, rendimentosDoNegocio(negocio)),
    );
  }

  async findOne(gadoId: number) {
    const gado = await this.prisma.gado.findUnique({
      where: { gado_id: gadoId },
    });
    if (!gado) {
      throw new NotFoundException(`Gado ${gadoId} não encontrado`);
    }
    return this.comRendimento(gado);
  }

  async update(gadoId: number, dto: UpdateGadoDto) {
    const atual = await this.findOne(gadoId);

    const negocioDestino = dto.negocio_id ?? atual.negocio_id;
    // Trocar a categoria (denominacao) troca o percentual de rendimento usado.
    const precisaRecalcular =
      dto.peso_total !== undefined ||
      dto.denominacao !== undefined ||
      dto.negocio_id !== undefined;
    const valores: Partial<ValoresGado> = precisaRecalcular
      ? await this.calcularValores(
          negocioDestino,
          dto.peso_total ?? atual.peso_total.toNumber(),
          dto.denominacao ?? atual.denominacao,
        )
      : {};

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
    return this.comRendimento(gado);
  }

  async remove(gadoId: number) {
    const atual = await this.findOne(gadoId);
    try {
      const gado = await this.prisma.gado.delete({
        where: { gado_id: gadoId },
      });
      await this.negociosService.recalcularAgregados(atual.negocio_id);
      return this.comRendimento(gado);
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
