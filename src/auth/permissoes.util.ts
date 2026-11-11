import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { STATUS_PUBLICO } from '../common/dominio';

/** Perfis do JWT (`nivel_acesso`). */
export const NIVEL_ADMIN = 'Admin';

export function ehAdmin(user: Pick<AuthenticatedUser, 'nivel_acesso'>) {
  return user.nivel_acesso === NIVEL_ADMIN;
}

/** Campos de comissão do negócio, que o usuário Normal não vê nem altera. */
export const CAMPOS_DE_COMISSAO = ['comissao', 'porcentagem_comissao'] as const;

type ComCamposDeComissao = {
  comissao?: unknown;
  porcentagem_comissao?: unknown;
  modo_comissao?: unknown;
};

/**
 * Resposta para o usuário: para quem não é Admin, a comissão (valor, valor informado e
 * `modo_comissao`, quando presente) sai como `null`. Os campos continuam presentes, para o formato da resposta não mudar entre
 * perfis. Funciona com um negócio ou com uma lista deles.
 */
export function ocultarCamposDeComissao<T extends ComCamposDeComissao>(
  dados: T,
  user: Pick<AuthenticatedUser, 'nivel_acesso'>,
): T;
export function ocultarCamposDeComissao<T extends ComCamposDeComissao>(
  dados: T[],
  user: Pick<AuthenticatedUser, 'nivel_acesso'>,
): T[];
export function ocultarCamposDeComissao<T extends ComCamposDeComissao>(
  dados: T | T[],
  user: Pick<AuthenticatedUser, 'nivel_acesso'>,
): T | T[] {
  if (ehAdmin(user)) return dados;
  const ocultar = (item: T): T => ({
    ...item,
    comissao: null,
    porcentagem_comissao: null,
    ...('modo_comissao' in item ? { modo_comissao: null } : {}),
  });
  return Array.isArray(dados) ? dados.map(ocultar) : ocultar(dados);
}

/**
 * Entrada do usuário: para quem não é Admin, a comissão enviada é ignorada em silêncio
 * (sem 400 e sem gravar). Na edição, o valor já gravado fica como está.
 */
export function semCamposDeComissao<T extends object>(
  dto: T,
  user: Pick<AuthenticatedUser, 'nivel_acesso'>,
): T {
  if (ehAdmin(user)) return dto;
  const copia = { ...dto } as Record<string, unknown>;
  for (const campo of CAMPOS_DE_COMISSAO) delete copia[campo];
  return copia as T;
}

/** O que a regra de acesso precisa saber do negócio. */
export type NegocioParaAcesso = {
  empresa_id: number;
  responsavel_id: number;
  status_visualizacao: string;
};

/**
 * Regra única de acesso a um negócio (e aos lotes e gados dele):
 * - Admin: qualquer negócio da própria empresa;
 * - Normal: só o negócio da própria empresa em que é o responsável **e** que está 'Publico'.
 * Quem chama responde 404 quando é `false`, para não revelar que o negócio existe.
 */
export function podeAcessarNegocio(
  usuario: Pick<AuthenticatedUser, 'id' | 'empresa_id' | 'nivel_acesso'>,
  negocio: NegocioParaAcesso,
): boolean {
  if (negocio.empresa_id !== usuario.empresa_id) return false;
  if (ehAdmin(usuario)) return true;
  return (
    negocio.responsavel_id === usuario.id &&
    negocio.status_visualizacao === STATUS_PUBLICO
  );
}
