import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import {
  MENSAGEM_FAZENDA_DE_OUTRO_PECUARISTA,
  MENSAGEM_TROCA_PARA_CABECA,
  NegociosService,
} from './negocios.service';

const DTO = {
  empresa_id: 1,
  fazenda_id: 2,
  pecuarista_id: 3,
  comprador_id: 4,
  modalidade: 'arroba',
  tipo_gado: 'Gordo',
  tipo_negocio: 'Funrural',
  data_negocio: '2026-10-26T00:00:00.000Z',
} as CreateNegocioDto;

const dec = (valor: number) => new Prisma.Decimal(valor);

function criarServico(vinculoExiste: boolean) {
  const prisma = {
    pecuarista_fazenda: {
      findUnique: jest.fn().mockResolvedValue(vinculoExiste ? {} : null),
    },
    empresa: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        aliquota_funrural: dec(1.5),
        aliquota_senar: dec(0.2),
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

  it('grava alíquotas da empresa, impostos 0,00 e agregados NOT NULL em 0', async () => {
    const { prisma, servico } = criarServico(true);
    await servico.create(DTO);
    expect(prisma.negocio.create.mock.calls[0][0].data).toMatchObject({
      aliquota_funrural: 1.5,
      aliquota_senar: 0.2,
      funrural: 0,
      senar: 0,
      valor_total: 0,
      qtd_animais: 0,
    });
  });
});

// ---------------------------------------------------------------------------------------
// Recálculo em cascata com um banco em memória: só os métodos do Prisma que o
// NegociosService usa dentro da transação.
// ---------------------------------------------------------------------------------------

type GadoMem = {
  gado_id: number;
  lote_id: number;
  peso_total: Prisma.Decimal;
  peso_calculo: Prisma.Decimal;
  peso_arroba: Prisma.Decimal;
  valor_total: Prisma.Decimal;
};

/** Converte number em Decimal nos campos gravados (exceto inteiros), como o Prisma devolveria. */
const comDecimais = <T extends object>(dados: T) =>
  Object.fromEntries(
    Object.entries(dados).map(([k, v]) => [
      k,
      typeof v === 'number' && k !== 'qtd_animais' ? dec(v) : v,
    ]),
  );

function bancoEmMemoria(modalidade: string) {
  const negocio: Record<string, unknown> = {
    negocio_id: 1,
    empresa_id: 1,
    modalidade,
    tipo_negocio: 'Funrural',
    porcentagem_comissao: dec(2),
    aliquota_funrural: dec(1.5),
    aliquota_senar: dec(0.2),
  };
  const lotes: Record<string, any>[] = [
    { lote_id: 10, negocio_id: 1, rendimento_carcaca: dec(50), valor_unidade: dec(300), qtd_animais: 0 },
    { lote_id: 20, negocio_id: 1, rendimento_carcaca: dec(60), valor_unidade: dec(300), qtd_animais: 0 },
  ];
  const gados: GadoMem[] = [
    // lote 10: 600 kg × 50% = 300 kg → 20 @ × 300 = 6.000,00
    { gado_id: 1, lote_id: 10, peso_total: dec(600), peso_calculo: dec(300), peso_arroba: dec(20), valor_total: dec(6000) },
    // lote 20: 450 kg × 60% = 270 kg → 18 @ × 300 = 5.400,00
    { gado_id: 2, lote_id: 20, peso_total: dec(450), peso_calculo: dec(270), peso_arroba: dec(18), valor_total: dec(5400) },
  ];
  const doLote = (loteId: number) => gados.filter((g) => g.lote_id === loteId);

  const tx = {
    negocio: {
      findUniqueOrThrow: jest.fn(async () => negocio),
      update: jest.fn(async ({ data }) => Object.assign(negocio, comDecimais(data))),
    },
    empresa: { findUniqueOrThrow: jest.fn() },
    lote: {
      findMany: jest.fn(async () => lotes.map((l) => ({ ...l, gados: doLote(l.lote_id) }))),
      findUniqueOrThrow: jest.fn(async ({ where }) => {
        const lote = lotes.find((l) => l.lote_id === where.lote_id)!;
        return { ...lote, negocio: { modalidade: negocio.modalidade }, gados: doLote(lote.lote_id) };
      }),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(lotes.find((l) => l.lote_id === where.lote_id)!, comDecimais(data)),
      ),
    },
    gado: {
      update: jest.fn(async ({ where, data }) =>
        Object.assign(gados.find((g) => g.gado_id === where.gado_id)!, comDecimais(data)),
      ),
    },
  };
  const servico = new NegociosService({} as PrismaService);
  return { servico, tx: tx as unknown as Prisma.TransactionClient, negocio, lotes, gados };
}

const num = (valor: unknown) => (valor as Prisma.Decimal | null)?.toNumber() ?? null;

describe('NegociosService.recalcular', () => {
  it('agrega cada lote e o negócio (rendimento ponderado, impostos e comissão)', async () => {
    const { servico, tx, negocio, lotes } = bancoEmMemoria('arroba');
    await servico.recalcular(tx, 1);

    expect(lotes[0].qtd_animais).toBe(1);
    expect(num(lotes[0].valor_total_lote)).toBe(6000);
    expect(num(lotes[1].valor_total_lote)).toBe(5400);
    expect(num(lotes[1].rendimento_medio)).toBe(60);

    expect(negocio.qtd_animais).toBe(2);
    expect(num(negocio.valor_total)).toBe(11400);
    expect(num(negocio.valor_medio)).toBe(5700);
    expect(num(negocio.mais_pesado_quilos)).toBe(600);
    expect(num(negocio.mais_leve_arroba)).toBe(18);
    // (300 + 270) / 1050 × 100 = 54,2857… (a média dos lotes seria 55)
    expect(num(negocio.rendimento_medio)).toBeCloseTo(54.2857, 4);
    expect(num(negocio.funrural)).toBe(171); // 11.400 × 1,5%
    expect(num(negocio.senar)).toBe(0);
    expect(num(negocio.comissao)).toBe(228); // 2%
  });

  it('editar o rendimento do lote recalcula as cabeças, o lote e o negócio', async () => {
    const { servico, tx, negocio, lotes, gados } = bancoEmMemoria('arroba');
    lotes[0].rendimento_carcaca = dec(55);
    await servico.recalcularGadosDoLote(tx, 10);
    await servico.recalcular(tx, 1);

    // 600 × 55% = 330 kg → 22 @ × 300 = 6.600,00
    expect(num(gados[0].peso_calculo)).toBe(330);
    expect(num(gados[0].valor_total)).toBe(6600);
    // a cabeça do outro lote não muda
    expect(num(gados[1].valor_total)).toBe(5400);
    expect(num(lotes[0].valor_total_lote)).toBe(6600);
    expect(num(negocio.valor_total)).toBe(12000);
    expect(num(negocio.funrural)).toBe(180);
  });

  it('editar o valor da unidade do lote recalcula o valor das cabeças', async () => {
    const { servico, tx, negocio, lotes, gados } = bancoEmMemoria('arroba');
    lotes[1].valor_unidade = dec(310);
    await servico.recalcularGadosDoLote(tx, 20);
    await servico.recalcular(tx, 1);

    expect(num(gados[1].valor_total)).toBe(5580); // 18 @ × 310
    expect(num(negocio.valor_total)).toBe(11580);
  });

  it('mover a cabeça de lote recalcula os dois lotes', async () => {
    const { servico, tx, lotes, gados } = bancoEmMemoria('arroba');
    gados[1].lote_id = 10;
    await servico.recalcular(tx, 1);

    expect(lotes[0].qtd_animais).toBe(2);
    expect(num(lotes[0].valor_total_lote)).toBe(11400);
    expect(lotes[1].qtd_animais).toBe(0);
    expect(num(lotes[1].valor_total_lote)).toBe(0);
    expect(lotes[1].valor_medio_cabeca_lote).toBeNull();
  });
});

describe('NegociosService.update — troca de modalidade', () => {
  function servicoComNegocio(lotes: { gados: unknown[] }[]) {
    const prisma = {
      negocio: {
        findUnique: jest.fn().mockResolvedValue({
          negocio_id: 1,
          modalidade: 'arroba',
          pecuarista_id: 3,
          fazenda_id: 2,
          lotes,
        }),
      },
      $transaction: jest.fn(),
    };
    return { prisma, servico: new NegociosService(prisma as unknown as PrismaService) };
  }

  it('para "cabeca" com mais de um lote → 400', async () => {
    const { prisma, servico } = servicoComNegocio([{ gados: [] }, { gados: [] }]);
    await expect(servico.update(1, { modalidade: 'cabeca' })).rejects.toThrow(
      MENSAGEM_TROCA_PARA_CABECA,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('para "cabeca" com cabeças pesadas → 400', async () => {
    const { servico } = servicoComNegocio([{ gados: [{}] }]);
    await expect(servico.update(1, { modalidade: 'cabeca' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('NegociosService.resumo', () => {
  function servicoComAgregado() {
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 3 },
      _sum: { comissao: dec(1234.5), qtd_animais: 42 },
    });
    const servico = new NegociosService({
      negocio: { aggregate },
    } as unknown as PrismaService);
    return { servico, aggregate };
  }

  it('Admin recebe as três métricas do período', async () => {
    const { servico, aggregate } = servicoComAgregado();
    await expect(
      servico.resumo(true, undefined, '2026-11-01', '2026-11-30'),
    ).resolves.toEqual({
      negocios_realizados: 3,
      comissao_total: 1234.5,
      total_cabecas: 42,
    });
    expect(aggregate.mock.calls[0][0].where).toEqual({
      data_negocio: {
        gte: new Date('2026-11-01'),
        lte: new Date('2026-11-30'),
      },
    });
  });

  it('Normal recebe null nas três, sem consultar o banco', async () => {
    const { servico, aggregate } = servicoComAgregado();
    await expect(servico.resumo(false)).resolves.toEqual({
      negocios_realizados: null,
      comissao_total: null,
      total_cabecas: null,
    });
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('período sem negócios → zeros (não null)', async () => {
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 0 },
      _sum: { comissao: null, qtd_animais: null },
    });
    const servico = new NegociosService({
      negocio: { aggregate },
    } as unknown as PrismaService);
    await expect(servico.resumo(true)).resolves.toEqual({
      negocios_realizados: 0,
      comissao_total: 0,
      total_cabecas: 0,
    });
  });
});
