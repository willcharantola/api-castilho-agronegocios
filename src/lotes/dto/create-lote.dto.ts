import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GENEROS, TIPOS_LOTE } from '../../common/dominio';

/** Texto vazio (ou só espaços) → null; o resto sem espaços nas pontas. */
function vazioParaNull({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  const texto = value.trim();
  return texto === '' ? null : texto;
}

// As regras que dependem da modalidade do negócio (rendimento obrigatório em "arroba",
// quantidade só em "cabeca", nome automático do lote único) ficam no LotesService.
export class CreateLoteDto {
  @ApiPropertyOptional({
    maxLength: 30,
    description:
      'Obrigatório nas modalidades "arroba" e "kg"; único no negócio (ignorando maiúsculas e ' +
      'minúsculas). Na modalidade "cabeca" é ignorado: a API grava "Lote único".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nome_lote?: string;

  @ApiProperty({ enum: TIPOS_LOTE })
  @IsIn(TIPOS_LOTE)
  tipo_lote: string;

  @ApiProperty({
    minimum: 0,
    description:
      'Preço por unidade deste lote: R$ por arroba, por kg ou por cabeça, conforme a ' +
      'modalidade do negócio. Lotes do mesmo negócio podem ter preços diferentes.',
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'valor_unidade deve ser um número com até 2 casas decimais' },
  )
  @Min(0)
  valor_unidade: number;

  @ApiProperty({ enum: GENEROS })
  @IsIn(GENEROS)
  genero: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description:
      'Rendimento de carcaça (%), até 2 casas. Obrigatório na modalidade "arroba"; nas ' +
      'modalidades "kg" e "cabeca" a API grava 100 e ignora o valor enviado.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rendimento_carcaca?: number;

  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    example: '8,9 e 10',
    description: 'Média do carimbo do lote, texto livre. Opcional: vazio vira null.',
  })
  @Transform(vazioParaNull)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  media_carimbo?: string | null;

  @ApiPropertyOptional({
    maxLength: 4,
    nullable: true,
    example: '2025',
    description: 'Ano do carimbo (4 dígitos). Opcional: vazio vira null.',
  })
  @Transform(vazioParaNull)
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'ano_carimbo deve ter 4 dígitos' })
  ano_carimbo?: string | null;

  @ApiPropertyOptional({
    minimum: 1,
    description:
      'Somente na modalidade "cabeca" (obrigatório): quantidade de animais do lote único. ' +
      'Nas demais é a quantidade de cabeças pesadas, calculada pela API.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  qtd_animais?: number;

  // valor_total_lote, valor_medio_cabeca_lote, pesos, mais pesado/mais leve e
  // rendimento_medio são calculados pela API — enviados, o forbidNonWhitelisted responde 400.

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
