import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
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

    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.usuario_id,
        nome: usuario.nome,
        sobrenome: usuario.sobrenome,
        email: usuario.email,
        nivel_acesso: usuario.nivel_acesso,
        empresa_id: usuario.empresa_id,
      },
    };
  }
}
