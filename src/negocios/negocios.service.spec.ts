import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import {
  MENSAGEM_COMPRADOR_E_VENDEDOR,
  MENSAGEM_COMPRADOR_NAO_ENCONTRADO,
  MENSAGEM_FAZENDA_DE_OUTRO_PECUARISTA,
  MENSAGEM_TROCA_PARA_CABECA,
  NegociosService,
} from './negocios.service';

const DTO = {
  empresa_id: 1,
  fazenda_id: 2,
  pecuarista_id: 3,
  comprador: { tipo: 'frigorifico', id: 4 },
  modalidade: 'arroba',
  valor_unidade: 300,
  tipo_gado: 'Gordo',
  tipo_negocio: 'Funrural',
  data_negocio: '2026-10-26T00:00:00.000Z',
} as CreateNegocioDto;

const dec = (valor: number) => new Prisma.Decimal(valor);

function criarServico(
  vinculoExiste: boolean,
  { compradorExiste = true }: { compradorExiste?: boolean } = {},
) {
  const prisma = {
    comprador: {
      findUnique: jest.fn().mockResolvedValue(compradorExiste ? {} : null),
    },
    pecuarista: {
      findUnique: jest.fn().mockResolvedValue(compradorExiste ? {} : null),
    },
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
      valor_unidade: 300,
    });
  });

  it('frigorífico como comprador grava só comprador_id', async () => {
    const { prisma, servico } = criarServico(true);
    await servico.create(DTO);
    const data = prisma.negocio.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ comprador_id: 4, comprador_pecuarista_id: null });
    expect(data).not.toHaveProperty('comprador');
  });

  it('pecuarista como comprador grava só comprador_pecuarista_id', async () => {
    const { prisma, servico } = criarServico(true);
    await servico.create({ ...DTO, comprador: { tipo: 'pecuarista', id: 8 } });
    expect(prisma.negocio.create.mock.calls[0][0].data).toMatchObject({
      comprador_id: null,
      comprador_pecuarista_id: 8,
    });
  });

  it('o próprio vendedor como comprador → 400, sem gravar', async () => {
    const { prisma, servico } = criarServico(true);
    await expect(
      servico.create({ ...DTO, comprador: { tipo: 'pecuarista', id: 3 } }),
    ).rejects.toThrow(MENSAGEM_COMPRADOR_E_VENDEDOR);
    expect(prisma.negocio.create).not.toHaveBeenCalled();
  });

  it('comprador inexistente → 400', async () => {
    const { servico } = criarServico(true, { compradorExiste: false });
    await expect(servico.create(DTO)).rejects.toThrow(
      MENSAGEM_COMPRADOR_NAO_ENCONTRADO,
    );
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

function bancoEmMemoria(modalidade: string, tipoGado = 'Reposicao') {
  const negocio: Record<string, unknown> = {
    negocio_id: 1,
    empresa_id: 1,
    modalidade,
    tipo_gado: tipoGado,
    tipo_negocio: 'Funrural',
    valor_unidade: dec(300),
    porcentagem_comissao: dec(2),
    aliquota_funrural: dec(1.5),
    aliquota_senar: dec(0.2),
  };
  const lotes: Record<string, any>[] = [
    { lote_id: 10, negocio_id: 1, rendimento_carcaca: dec(50), qtd_animais: 0 },
    { lote_id: 20, negocio_id: 1, rendimento_carcaca: dec(60), qtd_animais: 0 },
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
        return { ...lote, negocio: {
            modalidade: negocio.modalidade,
            tipo_gado: negocio.tipo_gado,
            valor_unidade: negocio.valor_unidade,
          }, gados: doLote(lote.lote_id) };
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

  it('o valor da unidade do negócio vale para as cabeças de todos os lotes', async () => {
    const { servico, tx, negocio, gados } = bancoEmMemoria('arroba');
    negocio.valor_unidade = dec(310);
    await servico.recalcularGadosDoLote(tx, 10);
    await servico.recalcularGadosDoLote(tx, 20);
    await servico.recalcular(tx, 1);

    expect(num(gados[0].valor_total)).toBe(6200); // 20 @ × 310
    expect(num(gados[1].valor_total)).toBe(5580); // 18 @ × 310
    expect(num(negocio.valor_total)).toBe(11780);
  });

  it('cabeca: valor do lote = valor por cabeça do negócio × quantidade', async () => {
    const { servico, tx, negocio, lotes, gados } = bancoEmMemoria('cabeca');
    gados.length = 0;
    lotes.splice(1, 1);
    lotes[0].qtd_animais = 12;
    negocio.valor_unidade = dec(2500);
    await servico.recalcular(tx, 1);
    expect(num(lotes[0].valor_total_lote)).toBe(30000);
    expect(num(negocio.valor_total)).toBe(30000);
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

describe('NegociosService — arroba na modalidade kg', () => {
  it('Reposição em kg: arroba das cabeças = peso ÷ 30', async () => {
    const { servico, tx, negocio, gados } = bancoEmMemoria('kg', 'Reposicao');
    await servico.recalcularGadosDoLote(tx, 10);
    await servico.recalcularGadosDoLote(tx, 20);
    await servico.recalcular(tx, 1);
    expect(num(gados[0].peso_arroba)).toBe(20); // 600 ÷ 30
    expect(num(gados[1].peso_arroba)).toBe(15); // 450 ÷ 30
    expect(num(negocio.peso_total_arroba)).toBe(35);
  });

  it('Gordo em kg: arroba das cabeças = peso ÷ 15', async () => {
    const { servico, tx, gados } = bancoEmMemoria('kg', 'Gordo');
    await servico.recalcularGadosDoLote(tx, 10);
    expect(num(gados[0].peso_arroba)).toBe(40); // 600 ÷ 15
  });
});

describe('NegociosService.update — troca do tipo de gado', () => {
  function servicoKg(modalidade: string, extras: Record<string, unknown> = {}) {
    const prisma = {
      negocio: {
        findUnique: jest.fn().mockResolvedValue({
          negocio_id: 1,
          modalidade,
          tipo_gado: 'Gordo',
          valor_unidade: dec(300),
          pecuarista_id: 3,
          fazenda_id: 2,
          comprador_pecuarista_id: null,
          lotes: [
            { lote_id: 10, gados: [] },
            { lote_id: 20, gados: [] },
          ],
          ...extras,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({}),
      },
      pecuarista: { findUnique: jest.fn().mockResolvedValue({}) },
      pecuarista_fazenda: { findUnique: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({ negocio: { update: atualizar } }),
      ),
    };
    const atualizar = jest.fn();
    const servico = new NegociosService(prisma as unknown as PrismaService);
    jest.spyOn(servico, 'recalcular').mockResolvedValue();
    const recalcularGados = jest
      .spyOn(servico, 'recalcularGadosDoLote')
      .mockResolvedValue();
    const gravado = () =>
      (atualizar.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    return { servico, recalcularGados, gravado };
  }

  it('em kg, recalcula as cabeças de todos os lotes', async () => {
    const { servico, recalcularGados } = servicoKg('kg');
    await servico.update(1, { tipo_gado: 'Reposicao' });
    expect(recalcularGados.mock.calls.map((c) => c[1])).toEqual([10, 20]);
  });

  it('em arroba, não recalcula as cabeças', async () => {
    const { servico, recalcularGados } = servicoKg('arroba');
    await servico.update(1, { tipo_gado: 'Reposicao' });
    expect(recalcularGados).not.toHaveBeenCalled();
  });

  it('mudar o valor da unidade recalcula as cabeças de todos os lotes', async () => {
    const { servico, recalcularGados } = servicoKg('arroba');
    await servico.update(1, { valor_unidade: 320 });
    expect(recalcularGados.mock.calls.map((c) => c[1])).toEqual([10, 20]);
  });

  it('o mesmo valor da unidade não recalcula as cabeças', async () => {
    const { servico, recalcularGados } = servicoKg('arroba');
    await servico.update(1, { valor_unidade: 300 });
    expect(recalcularGados).not.toHaveBeenCalled();
  });

  it('trocar para pecuarista comprador zera a coluna do frigorífico', async () => {
    const { servico, gravado } = servicoKg('arroba');
    await servico.update(1, { comprador: { tipo: 'pecuarista', id: 8 } });
    expect(gravado()).toMatchObject({
      comprador_id: null,
      comprador_pecuarista_id: 8,
    });
  });

  it('o pecuarista comprador não pode virar o vendedor', async () => {
    const { servico } = servicoKg('arroba', { comprador_pecuarista_id: 5 });
    await expect(servico.update(1, { pecuarista_id: 5 })).rejects.toThrow(
      MENSAGEM_COMPRADOR_E_VENDEDOR,
    );
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

describe('NegociosService.recalcular — comissão por arroba (Gordo)', () => {
  it('Gordo + arroba: R$ por arroba sobre o peso vivo de todos os lotes', async () => {
    const { servico, tx, negocio } = bancoEmMemoria('arroba', 'Gordo');
    await servico.recalcular(tx, 1);
    // R$ 2,00 × (600 + 450) kg ÷ 15 = 140,00 (não usa a arroba de carcaça: 38 @)
    expect(num(negocio.comissao)).toBe(140);
  });

  it('alterar o peso de uma cabeça recalcula a comissão', async () => {
    const { servico, tx, negocio, gados } = bancoEmMemoria('arroba', 'Gordo');
    gados[0].peso_total = dec(750);
    await servico.recalcularGadosDoLote(tx, 10);
    await servico.recalcular(tx, 1);
    // 2 × (750 + 450) ÷ 15 = 160,00
    expect(num(negocio.comissao)).toBe(160);
  });

  it('sem valor informado a comissão fica null', async () => {
    const { servico, tx, negocio } = bancoEmMemoria('arroba', 'Gordo');
    negocio.porcentagem_comissao = null;
    negocio.comissao = dec(99);
    await servico.recalcular(tx, 1);
    expect(negocio.comissao).toBeNull();
  });
});

describe('NegociosService.update — troca do modo da comissão', () => {
  function servicoGordoArroba() {
    const atualizar = jest.fn();
    const prisma = {
      negocio: {
        findUnique: jest.fn().mockResolvedValue({
          negocio_id: 1,
          modalidade: 'arroba',
          tipo_gado: 'Gordo',
          pecuarista_id: 3,
          fazenda_id: 2,
          lotes: [],
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({ negocio: { update: atualizar } }),
      ),
    };
    const servico = new NegociosService(prisma as unknown as PrismaService);
    jest.spyOn(servico, 'recalcular').mockResolvedValue();
    jest
      .spyOn(servico as never, 'ajustarLotesAModalidade')
      .mockResolvedValue(undefined as never);
    const gravado = () =>
      (atualizar.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    return { servico, gravado };
  }

  it('Gordo → Reposicao descarta o valor informado (muda de R$/@ para %)', async () => {
    const { servico, gravado } = servicoGordoArroba();
    await servico.update(1, { tipo_gado: 'Reposicao' });
    expect(gravado()).toMatchObject({ porcentagem_comissao: null });
  });

  it('Gordo arroba → cabeca também descarta', async () => {
    const { servico, gravado } = servicoGordoArroba();
    await servico.update(1, { modalidade: 'cabeca' });
    expect(gravado()).toMatchObject({ porcentagem_comissao: null });
  });

  it('Gordo arroba → kg mantém o valor (o modo não muda)', async () => {
    const { servico, gravado } = servicoGordoArroba();
    await servico.update(1, { modalidade: 'kg' });
    expect(gravado()).not.toHaveProperty('porcentagem_comissao');
  });

  it('um valor novo enviado junto com a troca é gravado', async () => {
    const { servico, gravado } = servicoGordoArroba();
    await servico.update(1, { tipo_gado: 'Reposicao', porcentagem_comissao: 1.5 });
    expect(gravado()).toMatchObject({ porcentagem_comissao: 1.5 });
  });
});
