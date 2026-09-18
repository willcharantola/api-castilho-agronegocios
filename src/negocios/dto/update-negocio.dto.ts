import { PartialType } from '@nestjs/swagger';
import { CreateNegocioDto } from './create-negocio.dto';

export class UpdateNegocioDto extends PartialType(CreateNegocioDto) {}
