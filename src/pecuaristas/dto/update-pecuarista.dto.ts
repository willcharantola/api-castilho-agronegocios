import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePecuaristaDto } from './create-pecuarista.dto';

export class UpdatePecuaristaDto extends PartialType(
  OmitType(CreatePecuaristaDto, ['uuid_origem'] as const),
) {}
