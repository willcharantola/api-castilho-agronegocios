import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class FindNegociosQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fazenda_id?: number;

  @ApiPropertyOptional({
    description: 'Filtra negócios com data_negocio >= este valor.',
  })
  @IsOptional()
  @IsDateString()
  data_inicio?: string;

  @ApiPropertyOptional({
    description: 'Filtra negócios com data_negocio <= este valor.',
  })
  @IsOptional()
  @IsDateString()
  data_fim?: string;
}
