import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateNegocioDto } from './create-negocio.dto';

// PartialType já aplica @IsOptional() a todos os campos herdados. Os horários de
// pesagem não são editáveis por aqui — são registrados pelo servidor. qtd_animais e
// valor_total também não: na modalidade "cabeca" a quantidade é informada no lote único.
export class UpdateNegocioDto extends PartialType(
  OmitType(CreateNegocioDto, ['uuid_origem'] as const),
) {}
