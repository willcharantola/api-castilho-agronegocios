import { Prisma } from '@prisma/client';
import { handlePrismaError } from './prisma-error.util';

/**
 * Criação idempotente para a sincronização offline: se o cliente reenviar um cadastro
 * com o mesmo `uuid_origem` (ex.: a resposta se perdeu numa queda de conexão), devolve
 * o registro já criado em vez de duplicá-lo. Sem `uuid_origem` (cadastro online), apenas cria.
 *
 * Retorna `{ registro, existente }` para o chamador pular efeitos colaterais quando o
 * registro já existia.
 */
export async function criarIdempotente<T>(
  uuidOrigem: string | undefined,
  buscarExistente: (uuidOrigem: string) => Promise<T | null>,
  criar: () => Promise<T>,
): Promise<{ registro: T; existente: boolean }> {
  if (uuidOrigem) {
    const existente = await buscarExistente(uuidOrigem);
    if (existente) return { registro: existente, existente: true };
  }
  try {
    return { registro: await criar(), existente: false };
  } catch (error) {
    // Duas requisições com o mesmo uuid_origem em paralelo: a segunda bate na
    // constraint UNIQUE — devolve o registro criado pela primeira.
    if (
      uuidOrigem &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existente = await buscarExistente(uuidOrigem);
      if (existente) return { registro: existente, existente: true };
    }
    handlePrismaError(error);
  }
}
