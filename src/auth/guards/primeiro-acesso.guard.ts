import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMITIR_PRIMEIRO_ACESSO_KEY } from '../decorators/permitir-primeiro-acesso.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

export const CODIGO_PRIMEIRO_ACESSO_PENDENTE = 'PRIMEIRO_ACESSO_PENDENTE';

/**
 * Enquanto o usuário não definir a própria senha no primeiro acesso, bloqueia toda a
 * API (403 + code PRIMEIRO_ACESSO_PENDENTE), exceto as rotas marcadas com
 * @PermitirPrimeiroAcesso(). Vale mesmo que o front seja contornado.
 */
@Injectable()
export class PrimeiroAcessoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user: AuthenticatedUser | undefined = context
      .switchToHttp()
      .getRequest().user;
    // Rotas públicas (login) não têm usuário: nada a bloquear.
    if (!user?.primeiro_acesso) return true;

    const permitida = this.reflector.getAllAndOverride<boolean>(
      PERMITIR_PRIMEIRO_ACESSO_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permitida) return true;

    throw new ForbiddenException({
      statusCode: 403,
      code: CODIGO_PRIMEIRO_ACESSO_PENDENTE,
      message: 'Defina uma nova senha para continuar.',
    });
  }
}
