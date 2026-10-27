import { Module } from '@nestjs/common';
import { FazendasModule } from '../fazendas/fazendas.module';
import { PecuaristasController } from './pecuaristas.controller';
import { PecuaristasService } from './pecuaristas.service';

@Module({
  imports: [FazendasModule],
  controllers: [PecuaristasController],
  providers: [PecuaristasService],
})
export class PecuaristasModule {}
