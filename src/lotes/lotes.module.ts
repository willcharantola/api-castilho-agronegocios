import { Module } from '@nestjs/common';
import { NegociosModule } from '../negocios/negocios.module';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';

@Module({
  imports: [NegociosModule],
  controllers: [LotesController],
  providers: [LotesService],
})
export class LotesModule {}
