import { Module } from '@nestjs/common';
import { TiposGadoController } from './tipos-gado.controller';
import { TiposGadoService } from './tipos-gado.service';

@Module({
  controllers: [TiposGadoController],
  providers: [TiposGadoService],
})
export class TiposGadoModule {}
