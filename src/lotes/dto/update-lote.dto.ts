import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLoteDto } from './create-lote.dto';

// uuid_origem só existe na criação (sincronização offline).
export class UpdateLoteDto extends PartialType(
  OmitType(CreateLoteDto, ['uuid_origem'] as const),
) {}
