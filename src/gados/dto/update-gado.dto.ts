import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateGadoDto } from './create-gado.dto';

// uuid_origem e horario_pesagem só existem na criação (sincronização offline).
export class UpdateGadoDto extends PartialType(
  OmitType(CreateGadoDto, ['uuid_origem', 'horario_pesagem'] as const),
) {}
