import { Injectable, NotFoundException } from '@nestjs/common';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePecuaristaDto } from './dto/create-pecuarista.dto';
import { UpdatePecuaristaDto } from './dto/update-pecuarista.dto';

const INCLUDE_FAZENDAS = {
  pecuarista_fazenda: { include: { fazenda: true } },
} as const;

const paraAssociacoes = (fazendaIds: number[]) =>
  [...new Set(fazendaIds)].map((fazenda_id) => ({ fazenda_id }));

@Injectable()
export class PecuaristasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePecuaristaDto) {
    const { fazenda_ids, ...dados } = dto;
    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.pecuarista.findUnique({
          where: { uuid_origem },
          include: INCLUDE_FAZENDAS,
        }),
      () =>
        this.prisma.pecuarista.create({
          data: {
            ...dados,
            ...(fazenda_ids?.length
              ? { pecuarista_fazenda: { create: paraAssociacoes(fazenda_ids) } }
              : {}),
          },
          include: INCLUDE_FAZENDAS,
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
    const { fazenda_ids, ...dados } = dto;
    try {
      return await this.prisma.pecuarista.update({
        where: { pecuarista_id: pecuaristaId },
        data: {
          ...dados,
          ...(fazenda_ids
            ? {
                pecuarista_fazenda: {
                  deleteMany: {},
                  create: paraAssociacoes(fazenda_ids),
                },
              }
            : {}),
        },
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

  async associarFazenda(pecuaristaId: number, fazendaId: number) {
    await this.findOne(pecuaristaId);
    try {
      await this.prisma.pecuarista_fazenda.create({
        data: { pecuarista_id: pecuaristaId, fazenda_id: fazendaId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
    return this.findOne(pecuaristaId);
  }

  async desassociarFazenda(pecuaristaId: number, fazendaId: number) {
    await this.findOne(pecuaristaId);
    try {
      await this.prisma.pecuarista_fazenda.delete({
        where: {
          fazenda_id_pecuarista_id: {
            fazenda_id: fazendaId,
            pecuarista_id: pecuaristaId,
          },
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
    return this.findOne(pecuaristaId);
  }
}
