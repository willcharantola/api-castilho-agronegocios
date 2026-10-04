import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

interface JwtPayload {
  sub: number;
  email: string;
  nivel_acesso: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  /**
   * Usa sempre o estado atual do banco, não o que foi gravado no token: usuário
   * excluído perde o acesso na hora, mudança de nível vale imediatamente e
   * `primeiro_acesso` reflete a situação real.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { usuario_id: payload.sub },
      select: {
        usuario_id: true,
        empresa_id: true,
        email: true,
        nivel_acesso: true,
        primeiro_acesso: true,
      },
    });
    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return {
      id: usuario.usuario_id,
      empresa_id: usuario.empresa_id,
      email: usuario.email,
      nivel_acesso: usuario.nivel_acesso,
      primeiro_acesso: usuario.primeiro_acesso,
    };
  }
}
