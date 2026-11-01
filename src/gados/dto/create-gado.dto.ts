import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { HORA_REGEX } from '../../common/time.util';

export class CreateGadoDto {
  @ApiProperty({
    description:
      'Lote da cabeça. O negócio é o do lote; gênero, rendimento, valor da unidade e carimbo ' +
      'também vêm do lote.',
  })
  @IsInt()
  lote_id: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  peso_total: number;

  @ApiPropertyOptional({
    example: '2026-09-09T00:00:00.000Z',
    description: 'Data da pesagem. Omitida, a API usa a data atual.',
  })
  @IsOptional()
  @IsDateString()
  data_pesagem?: string;

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

  // peso_calculo, peso_arroba e valor_total são calculados no backend a partir de
  // peso_total e do lote. negocio_id, genero, denominacao, ano_carimbo, rendimento_carcaca
  // e carimbo deixaram de existir no gado: se enviados, o forbidNonWhitelisted responde 400.

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
