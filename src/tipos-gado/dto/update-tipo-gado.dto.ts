import { OmitType } from '@nestjs/swagger';
import { CreateTipoGadoDto } from './create-tipo-gado.dto';

/** Renomear: só o nome. */
export class UpdateTipoGadoDto extends OmitType(CreateTipoGadoDto, [
  'uuid_origem',
] as const) {}
