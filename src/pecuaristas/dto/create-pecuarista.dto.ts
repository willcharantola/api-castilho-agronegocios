import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FazendaDoPecuaristaDto } from './fazenda-do-pecuarista.dto';

export class CreatePecuaristaDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome_pecuarista: string;

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

  @ApiProperty({ maxLength: 10 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  agencia: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  conta: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  chave_pix: string;

  @ApiProperty({
    type: [FazendaDoPecuaristaDto],
    description:
      'Pelo menos uma fazenda: nova (criada junto, na mesma transação) ou `{ fazenda_id }` de ' +
      'uma já cadastrada. Só no POST — depois, use POST /pecuaristas/:id/fazendas.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cadastre pelo menos uma fazenda para o pecuarista' })
  @ValidateNested({ each: true })
  @Type(() => FazendaDoPecuaristaDto)
  fazendas: FazendaDoPecuaristaDto[];

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
