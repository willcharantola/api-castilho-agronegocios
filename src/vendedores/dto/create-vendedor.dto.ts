import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateVendedorDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome_vendedor: string;

  @ApiProperty({ enum: ['fisico', 'juridico'] })
  @IsIn(['fisico', 'juridico'])
  fisico_juridico: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  cpf_cnpj: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  banco: string;

  @ApiProperty({ maxLength: 5 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  agencia: string;

  @ApiProperty({ maxLength: 10 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  conta: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  chave_pix: string;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'IDs das fazendas às quais o vendedor será associado (N:N). Em PATCH, substitui as associações existentes.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  fazenda_ids?: number[];

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
