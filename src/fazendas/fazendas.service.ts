import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { criarIdempotente } from '../common/idempotencia.util';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';

@Injectable()
export class FazendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /** Só aceita marcas enviadas ao nosso bucket (impede gravar URL de outro site). */
  private validarMarcaUrl(marcaUrl: string | null | undefined) {
    if (marcaUrl == null) return;
    if (!marcaUrl.startsWith(this.uploads.prefixoMarcas())) {
      throw new BadRequestException('URL de marca inválida');
    }
  }

  async create(dto: CreateFazendaDto) {
    this.validarMarcaUrl(dto.marca_url);
    const { registro } = await criarIdempotente(
      dto.uuid_origem,
      (uuid_origem) =>
        this.prisma.fazenda.findUnique({ where: { uuid_origem } }),
      () => this.prisma.fazenda.create({ data: dto }),
    );
    return registro;
  }

  /**
   * Cria uma fazenda dentro da transação do cadastro de pecuarista (a fazenda só nasce
   * vinculada a um pecuarista). Com `uuid_origem` de um reenvio da fila offline, devolve
   * a fazenda já criada em vez de duplicá-la.
   */
  async criarNaTransacao(tx: Prisma.TransactionClient, dto: CreateFazendaDto) {
    this.validarMarcaUrl(dto.marca_url);
    if (dto.uuid_origem) {
      const existente = await tx.fazenda.findUnique({
        where: { uuid_origem: dto.uuid_origem },
      });
      if (existente) return existente;
    }
    return tx.fazenda.create({ data: dto });
  }

  findAll() {
    return this.prisma.fazenda.findMany();
  }

  async findOne(fazendaId: number) {
    const fazenda = await this.prisma.fazenda.findUnique({
      where: { fazenda_id: fazendaId },
      include: { pecuarista_fazenda: { include: { pecuarista: true } } },
    });
    if (!fazenda) {
      throw new NotFoundException(`Fazenda ${fazendaId} não encontrada`);
    }
    return fazenda;
  }

  async update(fazendaId: number, dto: UpdateFazendaDto) {
    this.validarMarcaUrl(dto.marca_url);
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
        await tx.pecuarista_fazenda.deleteMany({
          where: { fazenda_id: fazendaId },
        });
        return tx.fazenda.delete({ where: { fazenda_id: fazendaId } });
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
