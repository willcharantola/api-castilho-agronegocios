import { Injectable, NotFoundException } from '@nestjs/common';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';

@Injectable()
export class FazendasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFazendaDto) {
    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.fazenda.findUnique({ where: { uuid_origem } }),
      () => this.prisma.fazenda.create({ data: dto }),
    );
    return registro;
  }

  findAll() {
    return this.prisma.fazenda.findMany();
  }

  async findOne(fazendaId: number) {
    const fazenda = await this.prisma.fazenda.findUnique({
      where: { fazenda_id: fazendaId },
      include: { vendedor_fazenda: { include: { vendedor: true } } },
    });
    if (!fazenda) {
      throw new NotFoundException(`Fazenda ${fazendaId} não encontrada`);
    }
    return fazenda;
  }

  async update(fazendaId: number, dto: UpdateFazendaDto) {
    await this.findOne(fazendaId);
    try {
      return await this.prisma.fazenda.update({
        where: { fazenda_id: fazendaId },
        data: dto,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(fazendaId: number) {
    await this.findOne(fazendaId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.vendedor_fazenda.deleteMany({
          where: { fazenda_id: fazendaId },
        });
        return tx.fazenda.delete({ where: { fazenda_id: fazendaId } });
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
