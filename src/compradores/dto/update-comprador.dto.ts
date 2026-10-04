import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCompradorDto } from './create-comprador.dto';

export class UpdateCompradorDto extends PartialType(
  OmitType(CreateCompradorDto, ['uuid_origem'] as const),
) {}
