import {
  agregarPesos,
  arredondarCentavos,
  calcularGado,
  calcularImpostos,
  calcularLote,
  calcularNegocio,
  calcularRendimentoMedio,
  calcularComissao,
  comModoComissao,
  kgPorArroba,
  modoComissao,
  type GadoCalculado,
} from './calculo.util';

/** Gado como gravado: valores do cálculo + o peso informado. */
const gado = (
  modalidade: string,
  peso: number,
  rendimento: number,
  valorUnidade: number,
): GadoCalculado => ({
  peso_total: peso,
  ...calcularGado(modalidade, peso, rendimento, valorUnidade, 'Gordo'),
});

describe('calcularImpostos', () => {
  it('Desconto em folha: só Senar', () => {
    expect(calcularImpostos(100000, 'Desconto em folha', 1.5, 0.2)).toEqual({
      funrural: 0,
      senar: 200,
    });
  });

  it('Livre: nenhum imposto', () => {
    expect(calcularImpostos(100000, 'Livre', 1.5, 0.2)).toEqual({
      funrural: 0,
      senar: 0,
    });
  });

  it('Funrural: só Funrural', () => {
    expect(calcularImpostos(100000, 'Funrural', 1.5, 0.2)).toEqual({
      funrural: 1500,
      senar: 0,
    });
  });

  it('alíquotas 0 resultam em 0 (nunca null)', () => {
    expect(calcularImpostos(100000, 'Funrural', 0, 0)).toEqual({
      funrural: 0,
      senar: 0,
    });
    expect(calcularImpostos(100000, 'Desconto em folha', 0, 0)).toEqual({
      funrural: 0,
      senar: 0,
    });
  });

  it('valor_total 0 resulta em 0', () => {
    expect(calcularImpostos(0, 'Funrural', 1.5, 0.2)).toEqual({
      funrural: 0,
      senar: 0,
    });
  });

  it('arredonda só o resultado final, ROUND_HALF_UP', () => {
    // 1.234,50 × 0,2% = 2,469 → 2,47
    expect(calcularImpostos(1234.5, 'Desconto em folha', 0.2, 0.2).senar).toBe(
      2.47,
    );
    // 33,50 × 1,5% = 0,5025 → 0,50 ; 70,00 × 1,5% = 1,05 (exato)
    expect(calcularImpostos(33.5, 'Funrural', 1.5, 0).funrural).toBe(0.5);
    expect(calcularImpostos(70, 'Funrural', 1.5, 0).funrural).toBe(1.05);
  });

  it('rejeita tipo desconhecido', () => {
    expect(() =>
      calcularImpostos(100, 'Magro' as never, 1.5, 0.2),
    ).toThrow();
  });
});

describe('arredondarCentavos', () => {
  it('meio centavo sobe (sem erro de ponto flutuante)', () => {
    expect(arredondarCentavos(1.005)).toBe(1.01);
    expect(arredondarCentavos(2.675)).toBe(2.68);
    expect(arredondarCentavos(2.674)).toBe(2.67);
  });
});

describe('calcularGado', () => {
  it('arroba: peso × rendimento do lote / 15 × valor da arroba', () => {
    // 500 kg × 52,5% = 262,5 kg → 17,5 @ × R$ 300 = R$ 5.250,00
    expect(calcularGado('arroba', 500, 52.5, 300, 'Gordo')).toEqual({
      peso_calculo: 262.5,
      peso_arroba: 17.5,
      valor_total: 5250,
    });
  });

  it('arroba: arrobas sem arredondar; valor arredondado só no fim', () => {
    // 431 × 53,25% = 229,5075 kg → 15,3005 @ × 287,5 = 4.398,89375
    const v = calcularGado('arroba', 431, 53.25, 287.5, 'Gordo');
    expect(v.peso_calculo).toBeCloseTo(229.5075, 10);
    expect(v.peso_arroba).toBeCloseTo(15.3005, 10);
    expect(v.valor_total).toBe(4398.89);
  });

  it('kg: peso_calculo = peso_total (ignora rendimento) e valor por quilo', () => {
    expect(calcularGado('kg', 420, 52, 10.5, 'Gordo')).toEqual({
      peso_calculo: 420,
      peso_arroba: 28,
      valor_total: 4410,
    });
  });

  it('kg + Reposição: arroba = peso ÷ 30; o valor continua por quilo', () => {
    expect(calcularGado('kg', 420, 52, 10.5, 'Reposicao')).toEqual({
      peso_calculo: 420,
      peso_arroba: 14,
      valor_total: 4410,
    });
  });

  it('arroba + Reposição continua ÷ 15 sobre o peso com rendimento', () => {
    expect(calcularGado('arroba', 500, 52.5, 300, 'Reposicao')).toEqual({
      peso_calculo: 262.5,
      peso_arroba: 17.5,
      valor_total: 5250,
    });
  });

  it('cabeca não tem cálculo por animal', () => {
    expect(() => calcularGado('cabeca', 1, 100, 1, 'Gordo')).toThrow();
  });
});

describe('kgPorArroba', () => {
  it.each([
    ['kg', 'Reposicao', 30],
    ['kg', 'Gordo', 15],
    ['arroba', 'Reposicao', 15],
    ['arroba', 'Gordo', 15],
  ])('%s + %s → %i', (modalidade, tipoGado, esperado) => {
    expect(kgPorArroba(modalidade, tipoGado)).toBe(esperado);
  });
});

describe('calcularRendimentoMedio', () => {
  it('é ponderado pelo peso (não a média simples dos percentuais)', () => {
    const gados = [gado('arroba', 600, 55, 300), gado('arroba', 300, 51, 300)];
    // (330 + 153) / 900 × 100 = 53,666…
    expect(calcularRendimentoMedio(gados)).toBeCloseTo(53.6667, 4);
  });

  it('null sem gados', () => {
    expect(calcularRendimentoMedio([])).toBeNull();
  });
});

describe('agregarPesos', () => {
  it('totais, médias e extremos em quilos e em arrobas', () => {
    const r = agregarPesos([
      gado('arroba', 500, 52.5, 300), // 17,5 @
      gado('arroba', 400, 52.5, 300), // 14 @
    ]);
    expect(r).toMatchObject({
      peso_total_quilos: 900,
      peso_medio_quilos: 450,
      mais_pesado_quilos: 500,
      mais_leve_quilos: 400,
      mais_pesado_arroba: 17.5,
      mais_leve_arroba: 14,
    });
    expect(r.peso_total_arroba).toBeCloseTo(31.5, 10);
    expect(r.peso_medio_arroba).toBeCloseTo(15.75, 10);
    expect(r.rendimento_medio).toBeCloseTo(52.5, 10);
  });

  it('tudo null sem gados', () => {
    expect(Object.values(agregarPesos([])).every((v) => v === null)).toBe(true);
  });
});

describe('calcularLote', () => {
  it('arroba: quantidade e valor vêm das cabeças do lote', () => {
    const gados = [gado('arroba', 500, 52.5, 300), gado('arroba', 400, 52.5, 300)];
    // 5.250,00 + 4.200,00
    expect(
      calcularLote('arroba', { valor_unidade: 300, qtd_animais: 0 }, gados),
    ).toMatchObject({
      qtd_animais: 2,
      valor_total_lote: 9450,
      valor_medio_cabeca_lote: 4725,
      peso_total_quilos: 900,
    });
  });

  it('kg: soma dos valores por quilo', () => {
    const gados = [gado('kg', 250, 100, 14.5), gado('kg', 230, 100, 14.5)];
    expect(
      calcularLote('kg', { valor_unidade: 14.5, qtd_animais: 0 }, gados),
    ).toMatchObject({
      qtd_animais: 2,
      valor_total_lote: 6960,
      valor_medio_cabeca_lote: 3480,
      rendimento_medio: 100,
    });
  });

  it('lote sem cabeças: zero e médias/pesos null', () => {
    expect(
      calcularLote('arroba', { valor_unidade: 300, qtd_animais: 0 }, []),
    ).toMatchObject({
      qtd_animais: 0,
      valor_total_lote: 0,
      valor_medio_cabeca_lote: null,
      peso_total_quilos: null,
      rendimento_medio: null,
    });
  });

  it('cabeca: quantidade informada × valor por cabeça, sem pesos', () => {
    expect(
      calcularLote('cabeca', { valor_unidade: 2500.5, qtd_animais: 30 }, []),
    ).toMatchObject({
      qtd_animais: 30,
      valor_total_lote: 75015,
      valor_medio_cabeca_lote: 2500.5,
      peso_total_quilos: null,
      mais_pesado_quilos: null,
    });
  });
});

describe('calcularNegocio', () => {
  it('soma os lotes e pondera o rendimento por peso entre lotes diferentes', () => {
    const loteA = [gado('arroba', 600, 55, 300)]; // 330 kg de carcaça, R$ 6.600,00
    const loteB = [gado('arroba', 300, 51, 290)]; // 153 kg de carcaça, R$ 2.958,00
    const agA = calcularLote('arroba', { valor_unidade: 300, qtd_animais: 0 }, loteA);
    const agB = calcularLote('arroba', { valor_unidade: 290, qtd_animais: 0 }, loteB);
    const r = calcularNegocio([agA, agB], [...loteA, ...loteB]);

    expect(r.qtd_animais).toBe(2);
    expect(r.valor_total).toBe(9558);
    expect(r.valor_medio).toBe(4779);
    expect(r.peso_total_quilos).toBe(900);
    expect(r.mais_pesado_quilos).toBe(600);
    expect(r.mais_leve_quilos).toBe(300);
    // (330 + 153) / 900 × 100 = 53,67 — não a média dos rendimentos dos lotes (53).
    expect(r.rendimento_medio).toBeCloseTo(53.6667, 4);
  });

  it('sem lotes: zero e médias null', () => {
    expect(calcularNegocio([], [])).toMatchObject({
      qtd_animais: 0,
      valor_total: 0,
      valor_medio: null,
      rendimento_medio: null,
    });
  });

  it('cabeca: valor e quantidade do lote único, sem pesos', () => {
    const lote = calcularLote('cabeca', { valor_unidade: 3000, qtd_animais: 10 }, []);
    expect(calcularNegocio([lote], [])).toMatchObject({
      qtd_animais: 10,
      valor_total: 30000,
      valor_medio: 3000,
      peso_total_quilos: null,
    });
  });
});

describe('modoComissao', () => {
  it.each([
    ['Gordo', 'arroba', 'por_arroba'],
    ['Gordo', 'kg', 'por_arroba'],
    ['Gordo', 'cabeca', 'percentual'],
    ['Reposicao', 'arroba', 'percentual'],
    ['Reposicao', 'kg', 'percentual'],
    ['Reposicao', 'cabeca', 'percentual'],
  ])('%s + %s → %s', (tipoGado, modalidade, modo) => {
    expect(modoComissao(tipoGado, modalidade)).toBe(modo);
  });

  it('comModoComissao acrescenta o campo derivado', () => {
    expect(
      comModoComissao({ negocio_id: 1, tipo_gado: 'Gordo', modalidade: 'kg' }),
    ).toEqual({
      negocio_id: 1,
      tipo_gado: 'Gordo',
      modalidade: 'kg',
      modo_comissao: 'por_arroba',
    });
  });
});

describe('calcularComissao', () => {
  const base = { valorTotal: 10000, pesoTotalQuilos: 0, valorInformado: 2 };

  it('Gordo + arroba: R$ por arroba de peso vivo, sem arredondar a arroba', () => {
    // 2 × 350 ÷ 15 = 46,666… → 46,67 (e não 2 × 23,33 = 46,66)
    expect(
      calcularComissao({
        ...base,
        tipoGado: 'Gordo',
        modalidade: 'arroba',
        pesoTotalQuilos: 350,
      }),
    ).toBe(46.67);
    // 3 animais de 350 kg
    expect(
      calcularComissao({
        ...base,
        tipoGado: 'Gordo',
        modalidade: 'arroba',
        pesoTotalQuilos: 1050,
      }),
    ).toBe(140);
  });

  it('Gordo + kg: mesma regra (peso vivo ÷ 15), ignora o valor total', () => {
    expect(
      calcularComissao({
        ...base,
        tipoGado: 'Gordo',
        modalidade: 'kg',
        pesoTotalQuilos: 350,
      }),
    ).toBe(46.67);
  });

  it('Gordo + cabeca: percentual do valor total', () => {
    expect(
      calcularComissao({
        ...base,
        tipoGado: 'Gordo',
        modalidade: 'cabeca',
        valorInformado: 1.5,
      }),
    ).toBe(150);
  });

  it.each(['arroba', 'kg', 'cabeca'])(
    'Reposicao + %s: percentual do valor total',
    (modalidade) => {
      expect(
        calcularComissao({
          ...base,
          tipoGado: 'Reposicao',
          modalidade,
          pesoTotalQuilos: 350,
          valorInformado: 1.5,
        }),
      ).toBe(150);
    },
  );

  it('sem gados pesados a comissão por arroba é 0', () => {
    expect(
      calcularComissao({ ...base, tipoGado: 'Gordo', modalidade: 'arroba' }),
    ).toBe(0);
  });

  it('sem valor informado → null', () => {
    expect(
      calcularComissao({
        ...base,
        tipoGado: 'Gordo',
        modalidade: 'arroba',
        pesoTotalQuilos: 350,
        valorInformado: null,
      }),
    ).toBeNull();
  });

  it('arredonda só o resultado final (ROUND_HALF_UP)', () => {
    // 1.000,50 × 0,5% = 5,0025 → 5,00; 1.001 × 0,5% = 5,005 → 5,01
    const pct = (valorTotal: number) =>
      calcularComissao({
        tipoGado: 'Reposicao',
        modalidade: 'kg',
        valorTotal,
        pesoTotalQuilos: 0,
        valorInformado: 0.5,
      });
    expect(pct(1000.5)).toBe(5);
    expect(pct(1001)).toBe(5.01);
  });
});
