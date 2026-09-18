import { Injectable, NotFoundException } from '@nestjs/common';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmpresaDto) {
    try {
      return await this.prisma.empresa.create({ data: dto });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.empresa.findMany();
  }

  async findOne(empresaId: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { empresa_id: empresaId },
    });
    if (!empresa) {
      throw new NotFoundException(`Empresa ${empresaId} não encontrada`);
    }
    return empresa;
  }

  async update(empresaId: number, dto: UpdateEmpresaDto) {
    await this.findOne(empresaId);
    try {
      return await this.prisma.empresa.update({
        where: { empresa_id: empresaId },
        data: dto,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(empresaId: number) {
    await this.findOne(empresaId);
    try {
      return await this.prisma.empresa.delete({
        where: { empresa_id: empresaId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
