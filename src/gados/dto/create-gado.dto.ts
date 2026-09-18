import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGadoDto {
  @ApiProperty()
  @IsInt()
  negocio_id: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  peso_total: number;

  @ApiProperty({ example: '2026-09-09T00:00:00.000Z' })
  @IsDateString()
  data_pesagem: string;

  @ApiProperty({ enum: ['Macho', 'Femea'] })
  @IsIn(['Macho', 'Femea'])
  genero: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  denominacao: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  era: number;

  @ApiProperty()
  @IsInt()
  carimbo: number;

  // peso_calculo, peso_arroba e valor_total são calculados no backend a partir de
  // peso_total e do rendimento_carcaca do negócio — não fazem parte do DTO de entrada.
}
