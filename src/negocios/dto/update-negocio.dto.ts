import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { CompradorDoNegocioDto } from './comprador-do-negocio.dto';
import { CreateNegocioDto } from './create-negocio.dto';

// PartialType já aplica @IsOptional() a todos os campos herdados. Os horários de
// pesagem não são editáveis por aqui — são registrados pelo servidor. qtd_animais e
// valor_total_bruto também não: na modalidade "cabeca" a quantidade é informada no lote único.
// `comprador` é redeclarado porque o @IsDefined do cadastro valeria mesmo com @IsOptional.
export class UpdateNegocioDto extends PartialType(
  OmitType(CreateNegocioDto, ['uuid_origem', 'comprador'] as const),
) {
  @ApiPropertyOptional({
    type: CompradorDoNegocioDto,
    description: 'Troca o comprador (frigorífico ou pecuarista).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompradorDoNegocioDto)
  comprador?: CompradorDoNegocioDto;
}
