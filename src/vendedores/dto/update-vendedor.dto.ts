import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVendedorDto } from './create-vendedor.dto';

export class UpdateVendedorDto extends PartialType(
  OmitType(CreateVendedorDto, ['uuid_origem'] as const),
) {}
