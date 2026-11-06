import { Injectable, NotFoundException } from '@nestjs/common';
import { impedirExclusaoComNegocios } from '../common/exclusao.util';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import {
  frigorificoUnificado,
  pecuaristaUnificado,
  type CompradorUnificado,
} from '../negocios/comprador.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompradorDto } from './dto/create-comprador.dto';
import { UpdateCompradorDto } from './dto/update-comprador.dto';

@Injectable()
export class CompradoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompradorDto) {
    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.comprador.findUnique({ where: { uuid_origem } }),
      () => this.prisma.comprador.create({ data: dto }),
    );
    return registro;
  }

  findAll() {
    return this.prisma.comprador.findMany();
  }

  /**
   * Frigoríficos e pecuaristas que podem ser o comprador de um negócio, no formato
   * unificado, em ordem alfabética. `busca` procura no nome e no documento.
   */
  async opcoes(
    busca?: string,
    limite = 200,
    pagina = 1,
  ): Promise<{ itens: CompradorUnificado[]; total: number }> {
    const termo = busca?.trim();
    const contem = (campo: string) =>
      termo ? { [campo]: { contains: termo, mode: 'insensitive' as const } } : {};
    const [frigorificos, pecuaristas] = await Promise.all([
      this.prisma.comprador.findMany({
        where: termo ? { OR: [contem('nome_empresa'), contem('cnpj')] } : {},
      }),
      this.prisma.pecuarista.findMany({
        where: termo
          ? { OR: [contem('nome_pecuarista'), contem('cpf_cnpj')] }
          : {},
        include: {
          pecuarista_fazenda: {
            take: 1,
            orderBy: { fazenda_id: 'asc' },
            include: { fazenda: { select: { municipio: true } } },
          },
        },
      }),
    ]);
    const todos = [
      ...frigorificos.map(frigorificoUnificado),
      ...pecuaristas.map(pecuaristaUnificado),
    ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const inicio = (pagina - 1) * limite;
    return { itens: todos.slice(inicio, inicio + limite), total: todos.length };
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
    await impedirExclusaoComNegocios(
      this.prisma,
      { comprador_id: compradorId },
      'este comprador',
    );
    try {
      return await this.prisma.comprador.delete({
        where: { comprador_id: compradorId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
