import { Injectable, NotFoundException } from '@nestjs/common';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompradorDto } from './dto/create-comprador.dto';
import { UpdateCompradorDto } from './dto/update-comprador.dto';

@Injectable()
export class CompradoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompradorDto) {
    try {
      return await this.prisma.comprador.create({ data: dto });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.comprador.findMany();
  }

  async findOne(compradorId: number) {
    const comprador = await this.prisma.comprador.findUnique({
      where: { comprador_id: compradorId },
    });
    if (!comprador) {
      throw new NotFoundException(`Comprador ${compradorId} não encontrado`);
    }
    return comprador;
  }

  async update(compradorId: number, dto: UpdateCompradorDto) {
    await this.findOne(compradorId);
    try {
      return await this.prisma.comprador.update({
        where: { comprador_id: compradorId },
        data: dto,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(compradorId: number) {
    await this.findOne(compradorId);
    try {
      return await this.prisma.comprador.delete({
        where: { comprador_id: compradorId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
