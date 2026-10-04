import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateNegocioDto {
  @ApiProperty()
  @IsInt()
  empresa_id: number;

  @ApiProperty()
  @IsInt()
  fazenda_id: number;

  @ApiProperty({ description: 'Vendedor que efetivamente fechou o negócio.' })
  @IsInt()
  vendedor_id: number;

  @ApiProperty()
  @IsInt()
  comprador_id: number;

  // hora_inicio_pesagem e hora_fim_pesagem não são aceitos do cliente: o servidor os
  // registra no primeiro POST /gados do negócio e em PATCH /negocios/:id/concluir.

  @ApiProperty({ enum: ['arroba', 'kg', 'cabeca'] })
  @IsIn(['arroba', 'kg', 'cabeca'])
  modalidade: string;

  @ApiProperty({ enum: ['Gordo', 'Magro'] })
  @IsIn(['Gordo', 'Magro'])
  tipo_gado: string;

  @ApiProperty({
    enum: ['Vaca', 'Boi', 'Novilha', 'Garrote', 'Bezerro', 'Variados'],
  })
  @IsIn(['Vaca', 'Boi', 'Novilha', 'Garrote', 'Bezerro', 'Variados'])
  tipo_lote: string;

  @ApiProperty({ example: '2026-09-09T00:00:00.000Z' })
  @IsDateString()
  data_negocio: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description:
      'Percentual de comissão (0 a 100). Editável depois via PATCH /negocios/:id. ' +
      'O valor em R$ (`comissao`) é calculado pela API: valor_total × percentual / 100.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentagem_comissao?: number;

  @ApiProperty({
    minimum: 0,
    description: 'Valor por arroba, kg ou cabeça, conforme a modalidade.',
  })
  @IsNumber()
  @Min(0)
  valor_unidade: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  observacao?: string;

  // valor_total, valor_medio, qtd_animais, mais_pesado e mais_leve são agregados
  // calculados no backend a partir dos gados do negócio — não fazem parte do DTO.
  // comissao (R$) também é calculada no backend, a partir de porcentagem_comissao.
  // valor_medio, mais_pesado e mais_leve ficam NULL na modalidade "cabeca".

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Identificador gerado no aparelho para cadastros feitos offline. Reenvios com o mesmo ' +
      'valor devolvem o registro já criado (idempotência da sincronização).',
  })
  @IsOptional()
  @IsUUID()
  uuid_origem?: string;
}
