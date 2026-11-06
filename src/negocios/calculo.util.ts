import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type TipoNegocio } from '../common/dominio';

// Funções puras dos cálculos do gado, do lote e do negócio (sem acesso ao banco), testadas
// em calculo.util.spec.ts. Pesos e arrobas não são arredondados nos passos intermediários;
// valores em R$ só no resultado final.

const KG_POR_ARROBA = 15;

/**
 * Quilos por arroba no cálculo da cabeça: 30 para gado de Reposição na modalidade "kg"
 * (arroba de peso vivo do gado magro); 15 em todos os demais casos.
 */
export function kgPorArroba(modalidade: string, tipoGado: string): number {
  return modalidade === 'kg' && tipoGado === 'Reposicao' ? 30 : KG_POR_ARROBA;
}

/** R$ com 2 casas, ROUND_HALF_UP (Decimal evita o erro de ponto flutuante: 1,005 → 1,01). */
export function arredondarCentavos(valor: number): number {
  return new Prisma.Decimal(valor)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Funrural e Senar (R$) conforme o tipo de negócio, a partir do valor_total e das
 * alíquotas (em %, 1.5 = 1,5%) gravadas no negócio. Nunca devolve null: o tipo que
 * zera o imposto (ou alíquota 0) resulta em 0.
 *
 * | tipo              | funrural                 | senar                 |
 * | Desconto em folha | 0                        | valor × aliq_senar    |
 * | Livre             | 0                        | 0                     |
 * | Funrural          | valor × aliq_funrural    | 0                     |
 */
export function calcularImpostos(
  valorTotal: number,
  tipoNegocio: TipoNegocio,
  aliquotaFunrural: number,
  aliquotaSenar: number,
): { funrural: number; senar: number } {
  const percentual = (aliquota: number) =>
    arredondarCentavos((valorTotal * aliquota) / 100);
  switch (tipoNegocio) {
    case 'Desconto em folha':
      return { funrural: 0, senar: percentual(aliquotaSenar) };
    case 'Livre':
      return { funrural: 0, senar: 0 };
    case 'Funrural':
      return { funrural: percentual(aliquotaFunrural), senar: 0 };
    default:
      throw new BadRequestException(
        `Tipo de negócio inválido: ${String(tipoNegocio)}`,
      );
  }
}

/**
 * Como `porcentagem_comissao` é interpretado (ver calculo-comissao.md):
 * - "por_arroba": gado Gordo em "arroba" ou "kg" — R$ por arroba de peso vivo;
 * - "percentual": demais casos (Gordo por cabeça e Reposição) — % do valor_total.
 */
export type ModoComissao = 'por_arroba' | 'percentual';

export function modoComissao(
  tipoGado: string,
  modalidade: string,
): ModoComissao {
  return tipoGado === 'Gordo' && (modalidade === 'arroba' || modalidade === 'kg')
    ? 'por_arroba'
    : 'percentual';
}

/** Resposta do negócio com o campo derivado `modo_comissao` (calculado, não é coluna). */
export function comModoComissao<
  T extends { tipo_gado: string; modalidade: string },
>(negocio: T): T & { modo_comissao: ModoComissao } {
  return {
    ...negocio,
    modo_comissao: modoComissao(negocio.tipo_gado, negocio.modalidade),
  };
}

/**
 * Comissão em R$. Por arroba usa o peso vivo (peso_total_quilos ÷ 15, não a arroba de
 * carcaça) sem arredondar a arroba: 2,00 × 350 ÷ 15 = 46,666… → 46,67. Sem valor
 * informado → null; sem cabeças pesadas → 0.
 */
export function calcularComissao(p: {
  tipoGado: string;
  modalidade: string;
  valorTotal: number;
  pesoTotalQuilos: number;
  valorInformado: number | null;
}): number | null {
  if (p.valorInformado == null) return null;
  const informado = new Prisma.Decimal(p.valorInformado);
  const bruto =
    modoComissao(p.tipoGado, p.modalidade) === 'por_arroba'
      ? informado.mul(p.pesoTotalQuilos).div(KG_POR_ARROBA)
      : new Prisma.Decimal(p.valorTotal).mul(informado).div(100);
  return bruto.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

export interface ValoresGado {
  peso_calculo: number;
  peso_arroba: number;
  valor_total: number;
}

/**
 * Valores de um animal a partir do peso e dos dados do lote dele.
 * - arroba: peso_calculo = peso × rendimento / 100; valor = arrobas × valor_unidade
 * - kg:     peso_calculo = peso (sem rendimento);   valor = peso × valor_unidade;
 *           peso_arroba = peso ÷ 15 (Gordo) ou ÷ 30 (Reposição), só informativo
 * "cabeca" não tem registros individuais de gado.
 */
export function calcularGado(
  modalidade: string,
  pesoTotal: number,
  rendimento: number,
  valorUnidade: number,
  tipoGado: string,
): ValoresGado {
  switch (modalidade) {
    case 'arroba': {
      const peso_calculo = (pesoTotal * rendimento) / 100;
      const peso_arroba = peso_calculo / KG_POR_ARROBA;
      return {
        peso_calculo,
        peso_arroba,
        valor_total: arredondarCentavos(peso_arroba * valorUnidade),
      };
    }
    case 'kg':
      return {
        peso_calculo: pesoTotal,
        peso_arroba: pesoTotal / kgPorArroba(modalidade, tipoGado),
        valor_total: arredondarCentavos(pesoTotal * valorUnidade),
      };
    default:
      throw new BadRequestException(
        `Modalidade "${modalidade}" não tem cálculo por animal`,
      );
  }
}

/** Gado já gravado, com os Decimal convertidos em number. */
export interface GadoCalculado {
  peso_total: number;
  peso_calculo: number;
  peso_arroba: number;
  valor_total: number;
}

/** Pesos, médias, extremos e rendimento médio de um conjunto de gados (lote ou negócio). */
export interface AgregadosPeso {
  peso_total_quilos: number | null;
  peso_total_arroba: number | null;
  peso_medio_quilos: number | null;
  peso_medio_arroba: number | null;
  mais_pesado_quilos: number | null;
  mais_leve_quilos: number | null;
  mais_pesado_arroba: number | null;
  mais_leve_arroba: number | null;
  rendimento_medio: number | null;
}

const SEM_PESOS: AgregadosPeso = {
  peso_total_quilos: null,
  peso_total_arroba: null,
  peso_medio_quilos: null,
  peso_medio_arroba: null,
  mais_pesado_quilos: null,
  mais_leve_quilos: null,
  mais_pesado_arroba: null,
  mais_leve_arroba: null,
  rendimento_medio: null,
};

const somar = <T>(itens: T[], valor: (item: T) => number) =>
  itens.reduce((soma, item) => soma + valor(item), 0);

/**
 * Rendimento médio ponderado pelo peso: SUM(peso_calculo) / SUM(peso_total) × 100 — não a
 * média dos rendimentos. null sem gados (ou peso total zero): nunca divide por zero.
 */
export function calcularRendimentoMedio(
  gados: { peso_calculo: number; peso_total: number }[],
): number | null {
  const pesoTotal = somar(gados, (g) => g.peso_total);
  if (!(pesoTotal > 0)) return null;
  return (somar(gados, (g) => g.peso_calculo) / pesoTotal) * 100;
}

/** Agregados de peso; tudo null sem gados (modalidade "cabeca" ou lote ainda vazio). */
export function agregarPesos(gados: GadoCalculado[]): AgregadosPeso {
  if (gados.length === 0) return SEM_PESOS;
  const quilos = gados.map((g) => g.peso_total);
  const arrobas = gados.map((g) => g.peso_arroba);
  const pesoTotalQuilos = somar(quilos, (p) => p);
  const pesoTotalArroba = somar(arrobas, (p) => p);
  return {
    peso_total_quilos: pesoTotalQuilos,
    peso_total_arroba: pesoTotalArroba,
    peso_medio_quilos: pesoTotalQuilos / gados.length,
    peso_medio_arroba: pesoTotalArroba / gados.length,
    mais_pesado_quilos: Math.max(...quilos),
    mais_leve_quilos: Math.min(...quilos),
    mais_pesado_arroba: Math.max(...arrobas),
    mais_leve_arroba: Math.min(...arrobas),
    rendimento_medio: calcularRendimentoMedio(gados),
  };
}

export interface AgregadosLote extends AgregadosPeso {
  qtd_animais: number;
  valor_total_lote: number;
  valor_medio_cabeca_lote: number | null;
}

/**
 * Agregados de um lote. Com pesagem (arroba/kg), quantidade e valor vêm dos gados do lote;
 * na modalidade "cabeca" não há gados: a quantidade é a informada e o valor é
 * valor_unidade (do negócio) × qtd_animais.
 */
export function calcularLote(
  modalidade: string,
  lote: { valor_unidade: number; qtd_animais: number },
  gados: GadoCalculado[],
): AgregadosLote {
  if (modalidade === 'cabeca') {
    const valorTotal = arredondarCentavos(
      lote.valor_unidade * lote.qtd_animais,
    );
    return {
      ...SEM_PESOS,
      qtd_animais: lote.qtd_animais,
      valor_total_lote: valorTotal,
      valor_medio_cabeca_lote:
        lote.qtd_animais > 0
          ? arredondarCentavos(valorTotal / lote.qtd_animais)
          : null,
    };
  }
  const valorTotal = arredondarCentavos(somar(gados, (g) => g.valor_total));
  return {
    ...agregarPesos(gados),
    qtd_animais: gados.length,
    valor_total_lote: valorTotal,
    valor_medio_cabeca_lote:
      gados.length > 0 ? arredondarCentavos(valorTotal / gados.length) : null,
  };
}

export interface AgregadosNegocio extends AgregadosPeso {
  qtd_animais: number;
  valor_total: number;
  valor_medio: number | null;
}

/**
 * Agregados do negócio: quantidade e valor somam os lotes; pesos, extremos e rendimento
 * médio são calculados sobre o conjunto de gados de todos os lotes (rendimento ponderado,
 * não a média dos rendimentos dos lotes).
 */
export function calcularNegocio(
  lotes: { qtd_animais: number; valor_total_lote: number }[],
  gados: GadoCalculado[],
): AgregadosNegocio {
  const qtdAnimais = somar(lotes, (l) => l.qtd_animais);
  const valorTotal = arredondarCentavos(
    somar(lotes, (l) => l.valor_total_lote),
  );
  return {
    ...agregarPesos(gados),
    qtd_animais: qtdAnimais,
    valor_total: valorTotal,
    valor_medio:
      qtdAnimais > 0 ? arredondarCentavos(valorTotal / qtdAnimais) : null,
  };
}
