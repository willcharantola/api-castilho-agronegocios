import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { FazendasController } from './fazendas.controller';
import { FazendasService } from './fazendas.service';

@Module({
  // UploadsService.prefixoMarcas() valida a marca_url gravada na fazenda.
  imports: [UploadsModule],
  controllers: [FazendasController],
  providers: [FazendasService],
})
export class FazendasModule {}
