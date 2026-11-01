import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NegociosService } from '../negocios/negocios.service';
import { PrismaService } from '../prisma/prisma.service';
import { GadosService, MENSAGEM_LOTE_DE_OUTRO_NEGOCIO } from './gados.service';

const dec = (valor: number) => new Prisma.Decimal(valor);

const lote = (loteId: number, negocioId: number, rendimento: number, modalidade = 'arroba') => ({
  lote_id: loteId,
  negocio_id: negocioId,
  rendimento_carcaca: dec(rendimento),
  valor_unidade: dec(300),
  negocio: { empresa_id: 1, modalidade },
});

function criarServico(lotes: ReturnType<typeof lote>[]) {
  const tx = {
    gado: {
      create: jest.fn(async ({ data }) => ({ gado_id: 1, ...data })),
      update: jest.fn(async ({ data }) => ({ gado_id: 1, ...data })),
    },
  };
  const prisma = {
    lote: {
      findUnique: jest.fn(async ({ where }) => lotes.find((l) => l.lote_id === where.lote_id) ?? null),
    },
    gado: {
      findUnique: jest.fn(async () => ({
        gado_id: 1,
        lote_id: lotes[0].lote_id,
        peso_total: dec(600),
        lote: lotes[0],
      })),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const negocios = { recalcular: jest.fn(), registrarInicioPesagem: jest.fn() };
  return {
    tx,
    negocios,
    servico: new GadosService(
      prisma as unknown as PrismaService,
      negocios as unknown as NegociosService,
    ),
  };
}

describe('GadosService.create', () => {
  it('calcula com o rendimento e o valor do lote e recalcula o negócio', async () => {
    const { tx, negocios, servico } = criarServico([lote(10, 1, 50)]);
    await servico.create({ lote_id: 10, peso_total: 600 }, 1);
    // 600 × 50% = 300 kg → 20 @ × 300
    expect(tx.gado.create.mock.calls[0][0].data).toMatchObject({
      lote_id: 10,
      peso_calculo: 300,
      peso_arroba: 20,
      valor_total: 6000,
    });
    expect(negocios.registrarInicioPesagem).toHaveBeenCalled();
    expect(negocios.recalcular).toHaveBeenCalledWith(tx, 1);
  });

  it('lote de negócio "cabeca" → 400', async () => {
    const { servico } = criarServico([lote(10, 1, 100, 'cabeca')]);
    await expect(
      servico.create({ lote_id: 10, peso_total: 600 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lote de outra empresa → 404', async () => {
    const outro = { ...lote(10, 1, 50), negocio: { empresa_id: 2, modalidade: 'arroba' } };
    const { servico } = criarServico([outro]);
    await expect(
      servico.create({ lote_id: 10, peso_total: 600 }, 1),
    ).rejects.toThrow('Lote 10 não encontrado');
  });
});

describe('GadosService.update', () => {
  it('mover para lote de outro negócio → 400', async () => {
    const { tx, servico } = criarServico([lote(10, 1, 50), lote(30, 2, 50)]);
    await expect(servico.update(1, { lote_id: 30 }, 1)).rejects.toThrow(
      MENSAGEM_LOTE_DE_OUTRO_NEGOCIO,
    );
    expect(tx.gado.update).not.toHaveBeenCalled();
  });

  it('mover para outro lote do mesmo negócio usa o rendimento do lote novo', async () => {
    const { tx, negocios, servico } = criarServico([lote(10, 1, 50), lote(20, 1, 60)]);
    await servico.update(1, { lote_id: 20 }, 1);
    // 600 × 60% = 360 kg → 24 @ × 300
    expect(tx.gado.update.mock.calls[0][0].data).toMatchObject({
      lote_id: 20,
      peso_calculo: 360,
      valor_total: 7200,
    });
    // recalcular() refaz todos os lotes do negócio — os dois envolvidos na troca.
    expect(negocios.recalcular).toHaveBeenCalledWith(tx, 1);
  });
});
