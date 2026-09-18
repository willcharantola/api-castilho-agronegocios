import { Module } from '@nestjs/common';
import { NegociosModule } from '../negocios/negocios.module';
import { GadosController } from './gados.controller';
import { GadosService } from './gados.service';

@Module({
  imports: [NegociosModule],
  controllers: [GadosController],
  providers: [GadosService],
})
export class GadosModule {}
