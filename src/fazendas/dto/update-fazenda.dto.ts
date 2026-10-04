import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFazendaDto } from './create-fazenda.dto';

export class UpdateFazendaDto extends PartialType(
  OmitType(CreateFazendaDto, ['uuid_origem'] as const),
) {}
