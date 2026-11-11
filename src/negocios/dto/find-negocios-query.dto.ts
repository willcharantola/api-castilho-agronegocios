import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional } from 'class-validator';
import { STATUS_VISUALIZACAO } from '../../common/dominio';

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

  @ApiPropertyOptional({ description: 'Filtra pelo usuário responsável.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  responsavel_id?: number;

  @ApiPropertyOptional({ enum: STATUS_VISUALIZACAO })
  @IsOptional()
  @IsIn(STATUS_VISUALIZACAO)
  status_visualizacao?: string;
}
