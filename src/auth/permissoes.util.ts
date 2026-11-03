import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

/** Perfis do JWT (`nivel_acesso`). */
export const NIVEL_ADMIN = 'Admin';

export function ehAdmin(user: Pick<AuthenticatedUser, 'nivel_acesso'>) {
  return user.nivel_acesso === NIVEL_ADMIN;
}

/** Campos de comissão do negócio, que o usuário Normal não vê nem altera. */
export const CAMPOS_DE_COMISSAO = ['comissao', 'porcentagem_comissao'] as const;

type ComCamposDeComissao = { comissao?: unknown; porcentagem_comissao?: unknown };

/**
 * Resposta para o usuário: para quem não é Admin, a comissão (valor e percentual) sai
 * como `null`. Os campos continuam presentes, para o formato da resposta não mudar entre
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
