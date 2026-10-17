import { Module } from '@nestjs/common';
import { PecuaristasController } from './pecuaristas.controller';
import { PecuaristasService } from './pecuaristas.service';

@Module({
  controllers: [PecuaristasController],
  providers: [PecuaristasService],
})
export class PecuaristasModule {}
