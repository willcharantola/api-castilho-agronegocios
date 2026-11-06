import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  municipio: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  pessoa_contato: string;

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
