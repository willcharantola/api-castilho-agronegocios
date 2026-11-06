import { Prisma } from '@prisma/client';
import { type TipoComprador } from '../common/dominio';

/**
 * Relações do comprador do negócio (frigorífico ou pecuarista). Do pecuarista vem também
 * o município da primeira fazenda dele, já que o cadastro do pecuarista não tem município.
 */
export const INCLUDE_COMPRADOR = {
  comprador: true,
  comprador_pecuarista: {
    include: {
      pecuarista_fazenda: {
        take: 1,
        orderBy: { fazenda_id: 'asc' },
        include: { fazenda: { select: { municipio: true } } },
      },
    },
  },
} as const satisfies Prisma.negocioInclude;

/** Comprador do negócio na resposta da API, igual para frigorífico e pecuarista. */
export type CompradorUnificado = {
  tipo: TipoComprador;
  id: number;
  nome: string;
  documento: string;
  municipio: string | null;
  pessoa_contato: string | null;
};

type FrigorificoGravado = {
  comprador_id: number;
  nome_empresa: string;
  cnpj: string;
  municipio: string;
  pessoa_contato: string;
};

type PecuaristaGravado = {
  pecuarista_id: number;
  nome_pecuarista: string;
  cpf_cnpj: string;
  pecuarista_fazenda?: { fazenda: { municipio: string } }[];
};

export function frigorificoUnificado(c: FrigorificoGravado): CompradorUnificado {
  return {
    tipo: 'frigorifico',
    id: c.comprador_id,
    nome: c.nome_empresa,
    documento: c.cnpj,
    municipio: c.municipio,
    pessoa_contato: c.pessoa_contato,
  };
}

export function pecuaristaUnificado(p: PecuaristaGravado): CompradorUnificado {
  return {
    tipo: 'pecuarista',
    id: p.pecuarista_id,
    nome: p.nome_pecuarista,
    documento: p.cpf_cnpj,
    // Município vazio no cadastro da fazenda conta como ausente.
    municipio: p.pecuarista_fazenda?.[0]?.fazenda.municipio || null,
    pessoa_contato: null,
  };
}

/**
 * Troca as duas relações gravadas (`comprador` e `comprador_pecuarista`) por um único
 * `comprador` unificado. As colunas comprador_id e comprador_pecuarista_id continuam na
 * resposta. Sem as relações carregadas, `comprador` sai null.
 */
export function comCompradorUnificado<
  T extends {
    comprador?: FrigorificoGravado | null;
    comprador_pecuarista?: PecuaristaGravado | null;
  },
>(
  negocio: T,
): Omit<T, 'comprador' | 'comprador_pecuarista'> & {
  comprador: CompradorUnificado | null;
} {
  const { comprador, comprador_pecuarista, ...resto } = negocio;
  return {
    ...resto,
    comprador: comprador
      ? frigorificoUnificado(comprador)
      : comprador_pecuarista
        ? pecuaristaUnificado(comprador_pecuarista)
        : null,
  };
}
