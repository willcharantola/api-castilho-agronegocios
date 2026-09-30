import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { CreateNegocioDto } from './create-negocio.dto';

// PartialType já aplica @IsOptional() a todos os campos herdados — inclusive
// hora_inicio_pesagem/hora_fim_pesagem, opcionais no banco.
export class UpdateNegocioDto extends PartialType(CreateNegocioDto) {
  @ApiPropertyOptional({
    minimum: 1,
    description:
      'Somente para negócios da modalidade "cabeca": quantidade total de cabeças, ' +
      'informada diretamente (sem registros individuais em `gado`). Nas demais ' +
      'modalidades é um agregado calculado a partir dos gados e é rejeitado aqui.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  qtd_animais?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'Aceito apenas por conveniência do front-end e IGNORADO: o valor_total é sempre ' +
      'recalculado no servidor (qtd_animais × valor_unidade na modalidade "cabeca").',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  valor_total?: number;
}
