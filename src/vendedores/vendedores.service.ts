import { Injectable, NotFoundException } from '@nestjs/common';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';

@Injectable()
export class VendedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVendedorDto) {
    try {
      return await this.prisma.vendedor.create({ data: dto });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.vendedor.findMany();
  }

  async findOne(vendedorId: number) {
    const vendedor = await this.prisma.vendedor.findUnique({
      where: { vendedor_id: vendedorId },
    });
    if (!vendedor) {
      throw new NotFoundException(`Vendedor ${vendedorId} não encontrado`);
    }
    return vendedor;
  }

  async update(vendedorId: number, dto: UpdateVendedorDto) {
    await this.findOne(vendedorId);
    try {
      return await this.prisma.vendedor.update({
        where: { vendedor_id: vendedorId },
        data: dto,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(vendedorId: number) {
    await this.findOne(vendedorId);
    try {
      return await this.prisma.vendedor.delete({
        where: { vendedor_id: vendedorId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
