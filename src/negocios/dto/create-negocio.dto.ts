import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
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

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  marchante: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  comprador: string;

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
    maxLength: 20,
    description:
      'TODO: domínio de valores válidos ainda não confirmado com o responsável pelo projeto.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tipo_precificacao: string;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: 'Percentual entre 0 e 100.',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  rendimento_carcaca: number;

  @ApiProperty({ example: '2026-09-09T00:00:00.000Z' })
  @IsDateString()
  data_negocio: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  comissao: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  valor_arroba: number;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  observacao: string;

  // valor_total, valor_medio, qtd_animais, mais_pesado e mais_leve são agregados
  // calculados no backend a partir dos gados do negócio — não fazem parte do DTO.
}
