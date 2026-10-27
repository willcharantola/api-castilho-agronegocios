import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

/** Alíquotas em pontos percentuais (1.5 = 1,5%), até 2 casas decimais. */
export class UpdateImpostosDto {
  @ApiProperty({ minimum: 0, maximum: 100, example: 1.5 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Funrural deve ser um número com até 2 casas decimais.' },
  )
  @Min(0, { message: 'Funrural não pode ser negativo.' })
  @Max(100, { message: 'Funrural deve ser no máximo 100.' })
  aliquota_funrural: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 0.2 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Senar deve ser um número com até 2 casas decimais.' },
  )
  @Min(0, { message: 'Senar não pode ser negativo.' })
  @Max(100, { message: 'Senar deve ser no máximo 100.' })
  aliquota_senar: number;
}
