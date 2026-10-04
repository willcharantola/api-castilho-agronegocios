import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';

/** Política de senha: mínimo atual (fácil de alterar aqui) e limite prático do bcrypt. */
export const SENHA_MIN = 6;
export const SENHA_MAX = 72;
export const SALT_ROUNDS = 10;

/** Campos de usuário que podem sair da API — nunca a senha nem o hash. */
export const USUARIO_PUBLICO = {
  usuario_id: true,
  empresa_id: true,
  nome: true,
  sobrenome: true,
  email: true,
  nivel_acesso: true,
  primeiro_acesso: true,
} satisfies Prisma.usuarioSelect;

/** E-mail sempre em minúsculas e sem espaços (cadastro, edição e login). */
export const NormalizarEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
