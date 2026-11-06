import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '../common/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDadosEmpresaDto } from './dto/update-dados-empresa.dto';
import { UpdateImpostosDto } from './dto/update-impostos.dto';

const SELECT_IMPOSTOS = {
  aliquota_funrural: true,
  aliquota_senar: true,
} as const;

const SELECT_DADOS_EMPRESA = {
  nome: true,
  cnpj: true,
  creci: true,
  banco: true,
  agencia: true,
  conta: true,
  chave_pix: true,
} as const;

/** Configurações da empresa do usuário logado (empresa_id sempre vem do JWT). */
@Injectable()
export class ConfiguracoesService {
  constructor(private readonly prisma: PrismaService) {}

  async findImpostos(empresaId: number) {
    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { empresa_id: empresaId },
      select: SELECT_IMPOSTOS,
    });
    return paraNumeros(empresa);
  }

  /** Vale para negócios novos: os existentes guardam as alíquotas com que foram criados. */
  async updateImpostos(empresaId: number, dto: UpdateImpostosDto) {
    try {
      const empresa = await this.prisma.empresa.update({
        where: { empresa_id: empresaId },
        data: {
          aliquota_funrural: dto.aliquota_funrural,
          aliquota_senar: dto.aliquota_senar,
        },
        select: SELECT_IMPOSTOS,
      });
      return paraNumeros(empresa);
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findDadosEmpresa(empresaId: number) {
    return this.prisma.empresa.findUniqueOrThrow({
      where: { empresa_id: empresaId },
      select: SELECT_DADOS_EMPRESA,
    });
  }

  async updateDadosEmpresa(empresaId: number, dto: UpdateDadosEmpresaDto) {
    try {
      return await this.prisma.empresa.update({
        where: { empresa_id: empresaId },
        data: dto,
        select: SELECT_DADOS_EMPRESA,
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}

function paraNumeros(empresa: {
  aliquota_funrural: Prisma.Decimal;
  aliquota_senar: Prisma.Decimal;
}) {
  return {
    aliquota_funrural: empresa.aliquota_funrural.toNumber(),
    aliquota_senar: empresa.aliquota_senar.toNumber(),
  };
}
