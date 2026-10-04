import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsModule } from './uploads/uploads.module';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { PrimeiroAcessoGuard } from './auth/guards/primeiro-acesso.guard';
import { CompradoresModule } from './compradores/compradores.module';
import { EmpresasModule } from './empresas/empresas.module';
import { FazendasModule } from './fazendas/fazendas.module';
import { GadosModule } from './gados/gados.module';
import { NegociosModule } from './negocios/negocios.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VendedoresModule } from './vendedores/vendedores.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EmpresasModule,
    UsuariosModule,
    FazendasModule,
    VendedoresModule,
    CompradoresModule,
    NegociosModule,
    GadosModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // JwtAuthGuard roda antes de RolesGuard para popular request.user (exceto em rotas @Public()).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Por último: depende de request.user. Bloqueia a API até a troca de senha do primeiro acesso.
    { provide: APP_GUARD, useClass: PrimeiroAcessoGuard },
  ],
})
export class AppModule {}
