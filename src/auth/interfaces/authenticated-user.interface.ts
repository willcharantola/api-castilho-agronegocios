/** Usuário autenticado, lido do banco a cada requisição (ver JwtStrategy.validate). */
export interface AuthenticatedUser {
  id: number;
  empresa_id: number;
  email: string;
  nivel_acesso: string;
}
