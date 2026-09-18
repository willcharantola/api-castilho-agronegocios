import { Module } from '@nestjs/common';
import { NegociosController } from './negocios.controller';
import { NegociosService } from './negocios.service';

@Module({
  controllers: [NegociosController],
  providers: [NegociosService],
  exports: [NegociosService],
})
export class NegociosModule {}
