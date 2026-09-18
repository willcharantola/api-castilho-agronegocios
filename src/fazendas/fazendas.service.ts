import { Injectable, NotFoundException } from '@nestjs/common';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';

@Injectable()
export class FazendasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFazendaDto) {
    try {
      return await this.prisma.fazenda.create({ data: dto });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.fazenda.findMany();
  }

  async findOne(fazendaId: number) {
    const fazenda = await this.prisma.fazenda.findUnique({
      where: { fazenda_id: fazendaId },
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
      return await this.prisma.fazenda.delete({
        where: { fazenda_id: fazendaId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
