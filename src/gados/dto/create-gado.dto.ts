import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { RACAS_RENDIMENTO } from '../../common/dominio';
import { HORA_REGEX } from '../../common/time.util';

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

  // Online, horario_pesagem é registrado pelo servidor. Só cadastros vindos da fila
  // offline (com uuid_origem) podem informá-lo: a hora local em que o gado foi pesado
  // no aparelho, já que a sincronização pode acontecer horas depois.
  @ApiPropertyOptional({
    example: '14:05:30',
    description:
      'Somente com uuid_origem (sincronização offline): hora local da pesagem no aparelho, ' +
      'HH:mm ou HH:mm:ss. Ignorado em cadastros online.',
  })
  @ValidateIf((o: CreateGadoDto) => o.horario_pesagem != null)
  @Matches(HORA_REGEX)
  horario_pesagem?: string;

  @ApiProperty({ enum: ['Macho', 'Femea'] })
  @IsIn(['Macho', 'Femea'])
  genero: string;

  @ApiProperty({
    enum: RACAS_RENDIMENTO,
    description:
      'Categoria de rendimento do animal: define qual percentual de rendimento do negócio ' +
      'entra no cálculo (porcentagem_rendimento_nelore, _anelorado, _angus ou _composto).',
  })
  @IsIn(RACAS_RENDIMENTO)
  denominacao: string;

  @ApiProperty({ maxLength: 4, example: '2025' })
  @IsString()
  @Matches(/^\d{4}$/)
  ano_carimbo: string;

  // peso_calculo, peso_arroba e valor_total são calculados no backend a partir de
  // peso_total e do percentual de rendimento da categoria (denominacao) no negócio — não
  // fazem parte do DTO de entrada. rendimento_carcaca e carimbo deixaram de existir: se
  // enviados, o forbidNonWhitelisted responde 400.

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
