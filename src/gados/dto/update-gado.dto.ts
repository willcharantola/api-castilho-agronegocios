import { PartialType } from '@nestjs/swagger';
import { CreateGadoDto } from './create-gado.dto';

export class UpdateGadoDto extends PartialType(CreateGadoDto) {}
