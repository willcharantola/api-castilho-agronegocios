import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
