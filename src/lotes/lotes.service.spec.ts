import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NegociosService } from '../negocios/negocios.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import {
  LotesService,
  MENSAGEM_SEGUNDO_LOTE_CABECA,
  mensagemLoteComGados,
} from './lotes.service';

const LOTE = {
  nome_lote: 'Bois Nelore',
  valor_unidade: 310,
  tipo_lote: 'Boi',
  genero: 'Macho',
  rendimento_carcaca: 53.5,
  media_carimbo: '08/23',
  ano_carimbo: '2023',
} as CreateLoteDto;

const dec = (valor: number) => new Prisma.Decimal(valor);

function criarServico(
  modalidade: string,
  opcoes: { repetido?: boolean; lotesExistentes?: number; loteAtual?: object } = {},
) {
  const tx = {
    lote: {
      create: jest.fn(async ({ data }) => ({ lote_id: 7, ...data })),
      update: jest.fn(),
      delete: jest.fn(async () => ({ lote_id: 7 })),
      findUniqueOrThrow: jest.fn(async () => ({ lote_id: 7 })),
    },
  };
  const prisma = {
    lote: {
      findUnique: jest.fn(async () => opcoes.loteAtual ?? null),
      findFirst: jest.fn(async (_args: { where: Record<string, unknown> }) =>
        opcoes.repetido ? { lote_id: 1 } : null,
      ),
      count: jest.fn(async () => opcoes.lotesExistentes ?? 0),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const negocios = {
    negocioDaEmpresa: jest.fn(async () => ({ negocio_id: 1, empresa_id: 1, modalidade })),
    recalcular: jest.fn(),
    recalcularGadosDoLote: jest.fn(),
  };
  return {
    tx,
    prisma,
    negocios,
    servico: new LotesService(
      prisma as unknown as PrismaService,
      negocios as unknown as NegociosService,
    ),
  };
}

const loteGravado = (modalidade: string, gados: unknown[] = []) => ({
  lote_id: 7,
  negocio_id: 1,
  nome_lote: 'Bois Nelore',
  rendimento_carcaca: dec(53.5),
  valor_unidade: dec(310),
  qtd_animais: gados.length,
  gados,
  negocio: { empresa_id: 1, modalidade },
});

describe('LotesService.create', () => {
  it('nome repetido no negócio (ignorando maiúsculas) → 400', async () => {
    const { prisma, tx, servico } = criarServico('arroba', { repetido: true });
    await expect(
      servico.create(1, { ...LOTE, nome_lote: 'BOIS nelore' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lote.findFirst.mock.calls[0][0].where.nome_lote).toEqual({
      equals: 'BOIS nelore',
      mode: 'insensitive',
    });
    expect(tx.lote.create).not.toHaveBeenCalled();
  });

  it('arroba sem rendimento → 400', async () => {
    const { servico } = criarServico('arroba');
    await expect(
      servico.create(1, { ...LOTE, rendimento_carcaca: undefined }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('quantidade de animais fora da modalidade "cabeca" → 400', async () => {
    const { servico } = criarServico('kg');
    await expect(
      servico.create(1, { ...LOTE, qtd_animais: 5 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('kg grava rendimento 100 e recalcula o negócio na mesma transação', async () => {
    const { tx, negocios, servico } = criarServico('kg');
    await servico.create(1, LOTE, 1);
    expect(tx.lote.create.mock.calls[0][0].data).toMatchObject({
      rendimento_carcaca: 100,
      qtd_animais: 0,
      valor_total_lote: 0,
      negocio_id: 1,
    });
    expect(negocios.recalcular).toHaveBeenCalledWith(tx, 1);
  });

  it('cabeca: "Lote único", rendimento 100 e quantidade informada', async () => {
    const { tx, servico } = criarServico('cabeca');
    await servico.create(1, { ...LOTE, nome_lote: undefined, qtd_animais: 30 }, 1);
    expect(tx.lote.create.mock.calls[0][0].data).toMatchObject({
      nome_lote: 'Lote único',
      rendimento_carcaca: 100,
      qtd_animais: 30,
    });
  });

  it('cabeca sem quantidade → 400', async () => {
    const { servico } = criarServico('cabeca');
    await expect(servico.create(1, LOTE, 1)).rejects.toThrow(
      'Informe a quantidade de animais',
    );
  });

  it('cabeca: segundo lote → 400', async () => {
    const { tx, servico } = criarServico('cabeca', { lotesExistentes: 1 });
    await expect(
      servico.create(1, { ...LOTE, qtd_animais: 3 }, 1),
    ).rejects.toThrow(MENSAGEM_SEGUNDO_LOTE_CABECA);
    expect(tx.lote.create).not.toHaveBeenCalled();
  });
});

describe('LotesService.update', () => {
  it('mudar o rendimento recalcula as cabeças do lote e o negócio', async () => {
    const { tx, negocios, servico } = criarServico('arroba', {
      loteAtual: loteGravado('arroba'),
    });
    await servico.update(7, { rendimento_carcaca: 55 }, 1);
    expect(negocios.recalcularGadosDoLote).toHaveBeenCalledWith(tx, 7);
    expect(negocios.recalcular).toHaveBeenCalledWith(tx, 1);
  });

  it('mudar o valor da unidade também recalcula as cabeças', async () => {
    const { negocios, servico } = criarServico('arroba', {
      loteAtual: loteGravado('arroba'),
    });
    await servico.update(7, { valor_unidade: 320 }, 1);
    expect(negocios.recalcularGadosDoLote).toHaveBeenCalled();
  });

  it('mudar só o carimbo não recalcula as cabeças', async () => {
    const { negocios, servico } = criarServico('arroba', {
      loteAtual: loteGravado('arroba'),
    });
    await servico.update(7, { media_carimbo: '9 e 10' }, 1);
    expect(negocios.recalcularGadosDoLote).not.toHaveBeenCalled();
    expect(negocios.recalcular).toHaveBeenCalled();
  });

  it('lote de outra empresa → 404', async () => {
    const { servico } = criarServico('arroba', {
      loteAtual: { ...loteGravado('arroba'), negocio: { empresa_id: 2, modalidade: 'arroba' } },
    });
    await expect(servico.update(7, { valor_unidade: 1 }, 1)).rejects.toThrow(
      'Lote 7 não encontrado',
    );
  });
});

describe('LotesService.remove', () => {
  it('lote com cabeças → 409 com a quantidade', async () => {
    const { tx, servico } = criarServico('arroba', {
      loteAtual: loteGravado('arroba', [{}, {}]),
    });
    const erro = servico.remove(7, 1);
    await expect(erro).rejects.toBeInstanceOf(ConflictException);
    await expect(erro).rejects.toThrow(mensagemLoteComGados(2));
    expect(tx.lote.delete).not.toHaveBeenCalled();
  });

  it('lote sem cabeças é excluído e o negócio recalculado', async () => {
    const { tx, negocios, servico } = criarServico('arroba', {
      loteAtual: loteGravado('arroba'),
    });
    await servico.remove(7, 1);
    expect(tx.lote.delete).toHaveBeenCalled();
    expect(negocios.recalcular).toHaveBeenCalledWith(tx, 1);
  });
});
