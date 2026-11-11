import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NegociosService } from '../negocios/negocios.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { GadosService, MENSAGEM_LOTE_DE_OUTRO_NEGOCIO } from './gados.service';

const dec = (valor: number) => new Prisma.Decimal(valor);

const usuario = (id: number, nivel_acesso: string): AuthenticatedUser => ({
  id,
  empresa_id: 1,
  email: 'x@x.com',
  nivel_acesso,
});
const ADMIN = usuario(1, 'Admin');

const lote = (
  loteId: number,
  negocioId: number,
  rendimento: number,
  modalidade = 'arroba',
  tipoGado = 'Gordo',
  acesso: { responsavel_id: number; status_visualizacao: string } = {
    responsavel_id: 5,
    status_visualizacao: 'Privado',
  },
) => ({
  lote_id: loteId,
  negocio_id: negocioId,
  rendimento_carcaca: dec(rendimento),
  valor_unidade: dec(300),
  negocio: { empresa_id: 1, ...acesso, modalidade, tipo_gado: tipoGado },
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
      findUnique: jest.fn(
        async ({ where }) =>
          lotes.find((l) => l.lote_id === where.lote_id) ?? null,
      ),
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
    await servico.create({ lote_id: 10, peso_total: 600 }, ADMIN);
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

  it('kg + Reposição: arroba = peso ÷ 30', async () => {
    const { tx, servico } = criarServico([lote(10, 1, 100, 'kg', 'Reposicao')]);
    await servico.create({ lote_id: 10, peso_total: 600 }, ADMIN);
    expect(tx.gado.create.mock.calls[0][0].data).toMatchObject({
      peso_calculo: 600,
      peso_arroba: 20,
    });
  });

  it('lote de negócio "cabeca" → 400', async () => {
    const { servico } = criarServico([lote(10, 1, 100, 'cabeca')]);
    await expect(
      servico.create({ lote_id: 10, peso_total: 600 }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lote de outra empresa → 404', async () => {
    const base = lote(10, 1, 50);
    const outro = { ...base, negocio: { ...base.negocio, empresa_id: 2 } };
    const { servico } = criarServico([outro]);
    await expect(
      servico.create({ lote_id: 10, peso_total: 600 }, ADMIN),
    ).rejects.toThrow('Lote 10 não encontrado');
  });
});

describe('GadosService.create — usuário Normal (responsável pela pesagem)', () => {
  const NORMAL = usuario(5, 'Normal');
  const negocioDo = (responsavel_id: number, status_visualizacao: string) =>
    lote(10, 1, 50, 'arroba', 'Gordo', { responsavel_id, status_visualizacao });

  it('pesa no negócio Publico em que é o responsável', async () => {
    const { tx, servico } = criarServico([negocioDo(5, 'Publico')]);
    await servico.create({ lote_id: 10, peso_total: 600 }, NORMAL);
    expect(tx.gado.create).toHaveBeenCalled();
  });

  it.each([
    ['Privado, mesmo sendo o responsável', 5, 'Privado'],
    ['Publico de outro responsável', 6, 'Publico'],
  ])('negócio %s → 404, sem gravar', async (_caso, responsavel, status) => {
    const { tx, servico } = criarServico([negocioDo(responsavel, status)]);
    await expect(
      servico.create({ lote_id: 10, peso_total: 600 }, NORMAL),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.gado.create).not.toHaveBeenCalled();
  });
});

describe('GadosService.update', () => {
  it('mover para lote de outro negócio → 400', async () => {
    const { tx, servico } = criarServico([lote(10, 1, 50), lote(30, 2, 50)]);
    await expect(servico.update(1, { lote_id: 30 }, ADMIN)).rejects.toThrow(
      MENSAGEM_LOTE_DE_OUTRO_NEGOCIO,
    );
    expect(tx.gado.update).not.toHaveBeenCalled();
  });

  it('mover para outro lote do mesmo negócio usa o rendimento do lote novo', async () => {
    const { tx, negocios, servico } = criarServico([
      lote(10, 1, 50),
      lote(20, 1, 60),
    ]);
    await servico.update(1, { lote_id: 20 }, ADMIN);
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
