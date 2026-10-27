import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { FazendasService } from '../fazendas/fazendas.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePecuaristaDto } from './dto/create-pecuarista.dto';
import { FazendaDoPecuaristaDto } from './dto/fazenda-do-pecuarista.dto';
import { UpdatePecuaristaDto } from './dto/update-pecuarista.dto';

const INCLUDE_FAZENDAS = {
  pecuarista_fazenda: { include: { fazenda: true } },
} as const;

/** `{ fazenda_id }` não pode vir junto com dados de fazenda nova. */
function validarItemFazenda(item: FazendaDoPecuaristaDto) {
  if (item.fazenda_id === undefined) return;
  const { fazenda_id: _id, ...dadosNova } = item;
  if (Object.values(dadosNova).some((valor) => valor !== undefined)) {
    throw new BadRequestException(
      'Informe fazenda_id (fazenda já cadastrada) ou os dados de uma fazenda nova, não os dois',
    );
  }
}

@Injectable()
export class PecuaristasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fazendas: FazendasService,
  ) {}

  /**
   * Pecuarista + fazendas novas + vínculos numa única transação: ou tudo é gravado, ou
   * nada. Idempotente pelo uuid_origem do pecuarista (e de cada fazenda nova), para o
   * reenvio da fila offline não duplicar o cadastro.
   */
  async create(dto: CreatePecuaristaDto) {
    const { fazendas, ...dados } = dto;
    fazendas.forEach(validarItemFazenda);
    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.pecuarista.findUnique({
          where: { uuid_origem },
          include: INCLUDE_FAZENDAS,
        }),
      () =>
        this.prisma.$transaction(async (tx) => {
          const pecuarista = await tx.pecuarista.create({ data: dados });
          await this.vincularFazendas(tx, pecuarista.pecuarista_id, fazendas);
          return tx.pecuarista.findUniqueOrThrow({
            where: { pecuarista_id: pecuarista.pecuarista_id },
            include: INCLUDE_FAZENDAS,
          });
        }),
    );
    return registro;
  }

  findAll() {
    return this.prisma.pecuarista.findMany({ include: INCLUDE_FAZENDAS });
  }

  async findOne(pecuaristaId: number) {
    const pecuarista = await this.prisma.pecuarista.findUnique({
      where: { pecuarista_id: pecuaristaId },
      include: INCLUDE_FAZENDAS,
    });
    if (!pecuarista) {
      throw new NotFoundException(`Pecuarista ${pecuaristaId} não encontrado`);
    }
    return pecuarista;
  }

  async update(pecuaristaId: number, dto: UpdatePecuaristaDto) {
    await this.findOne(pecuaristaId);
    try {
      return await this.prisma.pecuarista.update({
        where: { pecuarista_id: pecuaristaId },
        data: dto,
        include: INCLUDE_FAZENDAS,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(pecuaristaId: number) {
    await this.findOne(pecuaristaId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.pecuarista_fazenda.deleteMany({
          where: { pecuarista_id: pecuaristaId },
        });
        return tx.pecuarista.delete({ where: { pecuarista_id: pecuaristaId } });
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /** Cria uma fazenda nova e a vincula, ou vincula uma existente (`{ fazenda_id }`). */
  async associarFazenda(pecuaristaId: number, item: FazendaDoPecuaristaDto) {
    validarItemFazenda(item);
    await this.findOne(pecuaristaId);
    try {
      await this.prisma.$transaction((tx) =>
        this.vincularFazendas(tx, pecuaristaId, [item]),
      );
    } catch (error) {
      handlePrismaError(error);
    }
    return this.findOne(pecuaristaId);
  }

  async desassociarFazenda(pecuaristaId: number, fazendaId: number) {
    await this.findOne(pecuaristaId);
    // A FK composta negocio → vendedor_fazenda recusaria a exclusão; a checagem aqui dá
    // uma mensagem clara.
    const negocios = await this.prisma.negocio.count({
      where: { pecuarista_id: pecuaristaId, fazenda_id: fazendaId },
    });
    if (negocios > 0) {
      throw new ConflictException(
        `Não é possível desvincular: há ${negocios} negócio(s) deste pecuarista com esta fazenda`,
      );
    }
    try {
      await this.prisma.pecuarista_fazenda.delete({
        where: {
          pecuarista_id_fazenda_id: {
            pecuarista_id: pecuaristaId,
            fazenda_id: fazendaId,
          },
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
    return this.findOne(pecuaristaId);
  }

  /** Cria as fazendas novas e grava os vínculos; vínculo já existente é ignorado. */
  private async vincularFazendas(
    tx: Prisma.TransactionClient,
    pecuaristaId: number,
    itens: FazendaDoPecuaristaDto[],
  ) {
    const existentes = itens
      .map((item) => item.fazenda_id)
      .filter((id): id is number => id !== undefined);
    if (existentes.length > 0) {
      const encontradas = await tx.fazenda.findMany({
        where: { fazenda_id: { in: existentes } },
        select: { fazenda_id: true },
      });
      const faltando = existentes.filter(
        (id) => !encontradas.some((f) => f.fazenda_id === id),
      );
      if (faltando.length > 0) {
        throw new NotFoundException(
          `Fazenda(s) não encontrada(s): ${faltando.join(', ')}`,
        );
      }
    }

    const fazendaIds: number[] = [];
    for (const item of itens) {
      if (item.fazenda_id !== undefined) {
        fazendaIds.push(item.fazenda_id);
      } else {
        const { fazenda_id: _id, ...dados } = item;
        const fazenda = await this.fazendas.criarNaTransacao(tx, {
          nome_fazenda: dados.nome_fazenda!,
          municipio: dados.municipio!,
          inscricao_estadual: dados.inscricao_estadual!,
          marca_url: dados.marca_url,
          marca_escrita: dados.marca_escrita,
          uuid_origem: dados.uuid_origem,
        });
        fazendaIds.push(fazenda.fazenda_id);
      }
    }

    await tx.pecuarista_fazenda.createMany({
      data: [...new Set(fazendaIds)].map((fazenda_id) => ({
        pecuarista_id: pecuaristaId,
        fazenda_id,
      })),
      skipDuplicates: true,
    });
  }
}
