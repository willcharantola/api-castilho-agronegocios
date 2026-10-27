// Valores de domínio que no banco são CHECK constraints (o Prisma não as modela). Ficam como
// constantes TypeScript — e não enums do Prisma — para os DTOs validarem exatamente as
// mesmas grafias gravadas no banco.

export const MODALIDADES = ['arroba', 'kg', 'cabeca'] as const;
export type Modalidade = (typeof MODALIDADES)[number];

export const TIPOS_GADO = ['Gordo', 'Reposicao'] as const;
export type TipoGado = (typeof TIPOS_GADO)[number];

export const TIPOS_LOTE = [
  'Vaca',
  'Boi',
  'Novilha',
  'Garrote',
  'Bezerro',
  'Variados',
] as const;

export const TIPOS_NEGOCIO = ['Desconto em folha', 'Livre', 'Funrural'] as const;
export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];

/** Categorias de rendimento de carcaça — gravadas em `gado.denominacao`. */
export const RACAS_RENDIMENTO = [
  'Nelore',
  'Anelorado',
  'Angus',
  'Composto',
] as const;
export type RacaRendimento = (typeof RACAS_RENDIMENTO)[number];

/** Coluna de `negocio` com o percentual de rendimento de cada categoria. */
export const COLUNA_RENDIMENTO = {
  Nelore: 'porcentagem_rendimento_nelore',
  Anelorado: 'porcentagem_rendimento_anelorado',
  Angus: 'porcentagem_rendimento_angus',
  Composto: 'porcentagem_rendimento_composto',
} as const satisfies Record<RacaRendimento, string>;

export type ColunaRendimento =
  (typeof COLUNA_RENDIMENTO)[RacaRendimento];

export const COLUNAS_RENDIMENTO = Object.values(COLUNA_RENDIMENTO);

/** Rendimento neutro (peso_calculo = peso_total) gravado nas modalidades "kg" e "cabeca". */
export const RENDIMENTO_NEUTRO = 100;
