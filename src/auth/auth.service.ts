import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SALT_ROUNDS, USUARIO_PUBLICO } from '../usuarios/usuario.constants';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = {
      sub: usuario.usuario_id,
      email: usuario.email,
      nivel_acesso: usuario.nivel_acesso,
    };

    // Inclui nivel_acesso e primeiro_acesso para o front decidir o redirecionamento.
    const { senha: _senha, ...usuarioPublico } = usuario;
    return {
      access_token: this.jwtService.sign(payload),
      usuario: usuarioPublico,
    };
  }

  /** Dados atuais do usuário logado (sem senha). */
  me(usuarioId: number) {
    return this.prisma.usuario.findUniqueOrThrow({
      where: { usuario_id: usuarioId },
      select: USUARIO_PUBLICO,
    });
  }

  async definirSenhaPrimeiroAcesso(usuarioId: number, novaSenha: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { usuario_id: usuarioId },
    });

    if (!usuario.primeiro_acesso) {
      throw new BadRequestException('O primeiro acesso já foi concluído.');
    }
    if (await bcrypt.compare(novaSenha, usuario.senha)) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    return this.prisma.usuario.update({
      where: { usuario_id: usuarioId },
      data: {
        senha: await bcrypt.hash(novaSenha, SALT_ROUNDS),
        primeiro_acesso: false,
      },
      select: USUARIO_PUBLICO,
    });
  }
}
