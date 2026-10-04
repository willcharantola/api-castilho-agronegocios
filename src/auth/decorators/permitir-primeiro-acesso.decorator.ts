import { SetMetadata } from '@nestjs/common';

export const PERMITIR_PRIMEIRO_ACESSO_KEY = 'permitirPrimeiroAcesso';

/** Rota liberada mesmo com a troca de senha do primeiro acesso pendente (ver PrimeiroAcessoGuard). */
export const PermitirPrimeiroAcesso = () =>
  SetMetadata(PERMITIR_PRIMEIRO_ACESSO_KEY, true);
