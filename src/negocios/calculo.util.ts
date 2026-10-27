import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  COLUNA_RENDIMENTO,
  RACAS_RENDIMENTO,
  type ColunaRendimento,
  type RacaRendimento,
  type TipoNegocio,
} from '../common/dominio';

// Funções puras dos cálculos do negócio e do gado (sem acesso ao banco), testadas em
// calculo.util.spec.ts. Pesos e arrobas não são arredondados nos passos intermediários;
// valores em R$ só no resultado final.

const KG_POR_ARROBA = 15;

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

/** Valor da comissão em R$ (valor_total × porcentagem / 100), em centavos. */
export function calcularComissao(valorTotal: number, porcentagem: number) {
  return arredondarCentavos((valorTotal * porcentagem) / 100);
}

/** Os quatro percentuais de rendimento do negócio, já como number. */
export type RendimentosNegocio = Record<ColunaRendimento, number>;

export function ehRacaRendimento(valor: string): valor is RacaRendimento {
  return (RACAS_RENDIMENTO as readonly string[]).includes(valor);
}

/** Percentual de rendimento da categoria do animal (gado.denominacao) no negócio. */
export function rendimentoDaRaca(
  rendimentos: RendimentosNegocio,
  denominacao: string,
): number {
  if (!ehRacaRendimento(denominacao)) {
    throw new BadRequestException(
      `Categoria de rendimento inválida: ${denominacao}`,
    );
  }
  return rendimentos[COLUNA_RENDIMENTO[denominacao]];
}

export interface ValoresGado {
  peso_calculo: number;
  peso_arroba: number;
  valor_total: number;
}

/**
 * Valores de um animal. `rendimento` é o percentual da categoria do animal no negócio
 * (na modalidade "kg" o negócio grava 100, então peso_calculo = peso_total).
 * - arroba: valor = arrobas × valor_unidade
 * - kg:     valor = peso_total × valor_unidade
 * "cabeca" não tem registros individuais de gado.
 */
export function calcularValoresGado(
  modalidade: string,
  pesoTotal: number,
  rendimento: number,
  valorUnidade: number,
): ValoresGado {
  const peso_calculo = (pesoTotal * rendimento) / 100;
  const peso_arroba = peso_calculo / KG_POR_ARROBA;
  switch (modalidade) {
    case 'arroba':
      return {
        peso_calculo,
        peso_arroba,
        valor_total: arredondarCentavos(peso_arroba * valorUnidade),
      };
    case 'kg':
      return {
        peso_calculo,
        peso_arroba,
        valor_total: arredondarCentavos(pesoTotal * valorUnidade),
      };
    default:
      throw new BadRequestException(
        `Modalidade "${modalidade}" não tem cálculo por animal`,
      );
  }
}

/**
 * Rendimento médio do lote, ponderado pelo peso: SUM(peso_calculo) / SUM(peso_total) × 100.
 * null sem gados (ou peso total zero) — nunca divide por zero.
 */
export function calcularRendimentoMedio(
  gados: { peso_calculo: number; peso_total: number }[],
): number | null {
  const pesoTotal = gados.reduce((soma, g) => soma + g.peso_total, 0);
  if (!(pesoTotal > 0)) return null;
  const pesoCalculo = gados.reduce((soma, g) => soma + g.peso_calculo, 0);
  return (pesoCalculo / pesoTotal) * 100;
}
