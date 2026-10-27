import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import {
  MENSAGEM_FAZENDA_DE_OUTRO_PECUARISTA,
  NegociosService,
} from './negocios.service';

const DTO = {
  empresa_id: 1,
  fazenda_id: 2,
  pecuarista_id: 3,
  comprador_id: 4,
  modalidade: 'arroba',
  tipo_gado: 'Gordo',
  tipo_lote: 'Boi',
  tipo_negocio: 'Funrural',
  media_carimbo: '08/23',
  data_negocio: '2026-10-26T00:00:00.000Z',
  valor_unidade: 300,
  porcentagem_rendimento_nelore: 52.5,
  porcentagem_rendimento_anelorado: 51,
  porcentagem_rendimento_angus: 55,
  porcentagem_rendimento_composto: 53,
} as CreateNegocioDto;

function criarServico(vinculoExiste: boolean) {
  const prisma = {
    pecuarista_fazenda: {
      findUnique: jest.fn().mockResolvedValue(vinculoExiste ? {} : null),
    },
    empresa: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        aliquota_funrural: { toNumber: () => 1.5 },
        aliquota_senar: { toNumber: () => 0.2 },
      }),
    },
    negocio: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }) => Promise.resolve({ negocio_id: 9, ...data })),
    },
  };
  return {
    prisma,
    servico: new NegociosService(prisma as unknown as PrismaService),
  };
}

describe('NegociosService.create', () => {
  it('fazenda que não pertence ao pecuarista → 400, sem gravar', async () => {
    const { prisma, servico } = criarServico(false);
    const erro = servico.create(DTO);
    await expect(erro).rejects.toBeInstanceOf(BadRequestException);
    await expect(erro).rejects.toThrow(MENSAGEM_FAZENDA_DE_OUTRO_PECUARISTA);
    expect(prisma.negocio.create).not.toHaveBeenCalled();
  });

  it('modalidade arroba sem os quatro percentuais → 400', async () => {
    const { servico } = criarServico(true);
    await expect(
      servico.create({
        ...DTO,
        porcentagem_rendimento_angus: undefined,
      } as CreateNegocioDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grava alíquotas da empresa e impostos 0,00 na criação', async () => {
    const { prisma, servico } = criarServico(true);
    await servico.create(DTO);
    expect(prisma.negocio.create.mock.calls[0][0].data).toMatchObject({
      aliquota_funrural: 1.5,
      aliquota_senar: 0.2,
      funrural: 0,
      senar: 0,
      valor_total: 0,
    });
  });

  it('kg/cabeca: grava 100 nos quatro percentuais, ignorando o enviado', async () => {
    const { prisma, servico } = criarServico(true);
    await servico.create({ ...DTO, modalidade: 'kg' });
    expect(prisma.negocio.create.mock.calls[0][0].data).toMatchObject({
      porcentagem_rendimento_nelore: 100,
      porcentagem_rendimento_anelorado: 100,
      porcentagem_rendimento_angus: 100,
      porcentagem_rendimento_composto: 100,
    });
  });
});
