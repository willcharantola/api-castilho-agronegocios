import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Cnpj } from '../../common/documentos.util';

export class CreateCompradorDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome_empresa: string;

  @ApiProperty({
    maxLength: 18,
    example: '11.222.333/0001-81',
    description: 'CNPJ válido; aceita sem pontuação e é gravado formatado.',
  })
  @IsString()
  @IsNotEmpty()
  @Cnpj()
  @MaxLength(18)
  cnpj: string;

  @ApiProperty({
    maxLength: 12,
    example: '28.123.456-7',
    description:
      'Inscrição estadual do frigorífico (texto livre até 12 caracteres, ex.: "ISENTO"); ' +
      'formato ainda a confirmar com o cliente.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Informe a inscrição estadual' })
  @MaxLength(12)
  inscricao_estadual: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  municipio: string;

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
