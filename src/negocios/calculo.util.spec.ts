import {
  arredondarCentavos,
  calcularImpostos,
  calcularRendimentoMedio,
  calcularValoresGado,
  rendimentoDaRaca,
  type RendimentosNegocio,
} from './calculo.util';

const RENDIMENTOS: RendimentosNegocio = {
  porcentagem_rendimento_nelore: 52.5,
  porcentagem_rendimento_anelorado: 51,
  porcentagem_rendimento_angus: 55,
  porcentagem_rendimento_composto: 53.25,
};

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

describe('rendimentoDaRaca', () => {
  it('lê a coluna da categoria do animal', () => {
    expect(rendimentoDaRaca(RENDIMENTOS, 'Nelore')).toBe(52.5);
    expect(rendimentoDaRaca(RENDIMENTOS, 'Anelorado')).toBe(51);
    expect(rendimentoDaRaca(RENDIMENTOS, 'Angus')).toBe(55);
    expect(rendimentoDaRaca(RENDIMENTOS, 'Composto')).toBe(53.25);
  });

  it('rejeita categoria fora das quatro', () => {
    expect(() => rendimentoDaRaca(RENDIMENTOS, 'Cruzado')).toThrow();
  });
});

describe('calcularValoresGado', () => {
  it('arroba: peso × rendimento da raça / 15 × valor da arroba', () => {
    // 500 kg × 52,5% = 262,5 kg → 17,5 @ × R$ 300 = R$ 5.250,00
    expect(calcularValoresGado('arroba', 500, 52.5, 300)).toEqual({
      peso_calculo: 262.5,
      peso_arroba: 17.5,
      valor_total: 5250,
    });
  });

  it('arroba: arrobas sem arredondar; valor arredondado só no fim', () => {
    // 431 × 53,25% = 229,5075 kg → 15,3005 @ × 287,5 = 4.398,89375
    const v = calcularValoresGado('arroba', 431, 53.25, 287.5);
    expect(v.peso_calculo).toBeCloseTo(229.5075, 10);
    expect(v.peso_arroba).toBeCloseTo(15.3005, 10);
    expect(v.valor_total).toBe(4398.89);
  });

  it('kg: rendimento neutro (100) e valor por quilo', () => {
    expect(calcularValoresGado('kg', 420, 100, 10.5)).toEqual({
      peso_calculo: 420,
      peso_arroba: 28,
      valor_total: 4410,
    });
  });

  it('cabeca não tem cálculo por animal', () => {
    expect(() => calcularValoresGado('cabeca', 1, 100, 1)).toThrow();
  });
});

describe('calcularRendimentoMedio', () => {
  it('é ponderado pelo peso (não a média simples dos percentuais)', () => {
    const gados = [
      calcularValoresGado('arroba', 600, 55, 300), // Angus
      calcularValoresGado('arroba', 300, 51, 300), // Anelorado
    ].map((v, i) => ({ ...v, peso_total: [600, 300][i] }));
    // (330 + 153) / 900 × 100 = 53,666…
    expect(calcularRendimentoMedio(gados)).toBeCloseTo(53.6667, 4);
  });

  it('null sem gados', () => {
    expect(calcularRendimentoMedio([])).toBeNull();
  });
});
