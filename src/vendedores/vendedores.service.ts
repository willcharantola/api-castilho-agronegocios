import { Injectable, NotFoundException } from '@nestjs/common';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';

const INCLUDE_FAZENDAS = {
  vendedor_fazenda: { include: { fazenda: true } },
} as const;

const paraAssociacoes = (fazendaIds: number[]) =>
  [...new Set(fazendaIds)].map((fazenda_id) => ({ fazenda_id }));

@Injectable()
export class VendedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVendedorDto) {
    const { fazenda_ids, ...dados } = dto;
    try {
      return await this.prisma.vendedor.create({
        data: {
          ...dados,
          ...(fazenda_ids?.length
            ? { vendedor_fazenda: { create: paraAssociacoes(fazenda_ids) } }
            : {}),
        },
        include: INCLUDE_FAZENDAS,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.vendedor.findMany({ include: INCLUDE_FAZENDAS });
  }

  async findOne(vendedorId: number) {
    const vendedor = await this.prisma.vendedor.findUnique({
      where: { vendedor_id: vendedorId },
      include: INCLUDE_FAZENDAS,
    });
    if (!vendedor) {
      throw new NotFoundException(`Vendedor ${vendedorId} não encontrado`);
    }
    return vendedor;
  }

  async update(vendedorId: number, dto: UpdateVendedorDto) {
    await this.findOne(vendedorId);
    const { fazenda_ids, ...dados } = dto;
    try {
      return await this.prisma.vendedor.update({
        where: { vendedor_id: vendedorId },
        data: {
          ...dados,
          ...(fazenda_ids
            ? {
                vendedor_fazenda: {
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

  async remove(vendedorId: number) {
    await this.findOne(vendedorId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.vendedor_fazenda.deleteMany({
          where: { vendedor_id: vendedorId },
        });
        return tx.vendedor.delete({ where: { vendedor_id: vendedorId } });
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async associarFazenda(vendedorId: number, fazendaId: number) {
    await this.findOne(vendedorId);
    try {
      await this.prisma.vendedor_fazenda.create({
        data: { vendedor_id: vendedorId, fazenda_id: fazendaId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
    return this.findOne(vendedorId);
  }

  async desassociarFazenda(vendedorId: number, fazendaId: number) {
    await this.findOne(vendedorId);
    try {
      await this.prisma.vendedor_fazenda.delete({
        where: {
          fazenda_id_vendedor_id: {
            fazenda_id: fazendaId,
            vendedor_id: vendedorId,
          },
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
    return this.findOne(vendedorId);
  }
}
