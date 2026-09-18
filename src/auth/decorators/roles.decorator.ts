import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restringe a rota a usuários com o(s) nivel_acesso informado(s), ex: @Roles('Admin'). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
