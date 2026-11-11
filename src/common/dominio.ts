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
export type TipoLote = (typeof TIPOS_LOTE)[number];

export const GENEROS = ['Macho', 'Femea'] as const;
export type Genero = (typeof GENEROS)[number];

/** Origem do comprador do negócio: frigorífico (tabela comprador) ou pecuarista (vendedor). */
export const TIPOS_COMPRADOR = ['frigorifico', 'pecuarista'] as const;
export type TipoComprador = (typeof TIPOS_COMPRADOR)[number];

export const TIPOS_NEGOCIO = [
  'Desconto em folha',
  'Livre',
  'Funrural',
] as const;
export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];

/** Rendimento neutro (peso_calculo = peso_total) gravado nos lotes das modalidades "kg" e "cabeca". */
export const RENDIMENTO_NEUTRO = 100;

/** Nome do lote criado automaticamente nos negócios da modalidade "cabeca". */
export const NOME_LOTE_UNICO = 'Lote único';

/** Visualização do negócio: 'Publico' = o responsável enxerga e pesa; 'Privado' = só Admin. */
export const STATUS_VISUALIZACAO = ['Publico', 'Privado'] as const;
export type StatusVisualizacao = (typeof STATUS_VISUALIZACAO)[number];
export const STATUS_PUBLICO: StatusVisualizacao = 'Publico';
export const STATUS_PRIVADO: StatusVisualizacao = 'Privado';
