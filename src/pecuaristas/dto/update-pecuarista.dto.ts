import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePecuaristaDto } from './create-pecuarista.dto';

// Só os dados do pecuarista: vínculos com fazendas por POST/DELETE /pecuaristas/:id/fazendas.
export class UpdatePecuaristaDto extends PartialType(
  OmitType(CreatePecuaristaDto, ['uuid_origem', 'fazendas'] as const),
) {}
