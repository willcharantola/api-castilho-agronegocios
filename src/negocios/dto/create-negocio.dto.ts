import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { HORA_REGEX } from '../../common/time.util';

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

  @ApiProperty({ example: '08:00', description: 'HH:mm ou HH:mm:ss' })
  @Matches(HORA_REGEX)
  hora_inicio_pesagem: string;

  @ApiProperty({ example: '12:30', description: 'HH:mm ou HH:mm:ss' })
  @Matches(HORA_REGEX)
  hora_fim_pesagem: string;

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

  // TODO: confirmar domínio de valores válidos com o responsável pelo projeto
  @ApiProperty({
    maxLength: 10,
    description:
      'TODO: domínio de valores válidos ainda não confirmado com o responsável pelo projeto.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  tipo_precificacao: string;

  @ApiProperty({ example: '2026-09-09T00:00:00.000Z' })
  @IsDateString()
  data_negocio: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  comissao?: number;

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
}
