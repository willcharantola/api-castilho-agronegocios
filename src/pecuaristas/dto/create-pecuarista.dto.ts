import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
import { CpfCnpj } from '../../common/documentos.util';
import { FazendaDoPecuaristaDto } from './fazenda-do-pecuarista.dto';

/**
 * Dado bancário opcional: espaços nas pontas são removidos e vazio vira null (sem dado).
 * Banco, agência e conta juntos ou nenhum: regra no service (validarDadosBancarios), que
 * na edição também considera o que já está gravado.
 */
function DadoBancarioOpcional(maxLength: number): PropertyDecorator {
  return (alvo, propriedade) => {
    ApiPropertyOptional({ maxLength, nullable: true })(alvo, propriedade);
    Transform(({ value }: { value: unknown }) => {
      if (typeof value !== 'string') return value;
      const texto = value.trim();
      return texto === '' ? null : texto;
    })(alvo, propriedade);
    IsOptional()(alvo, propriedade);
    IsString()(alvo, propriedade);
    MaxLength(maxLength)(alvo, propriedade);
  };
}

export class CreatePecuaristaDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome_pecuarista: string;

  @ApiProperty({ enum: ['fisico', 'juridico'] })
  @IsIn(['fisico', 'juridico'])
  fisico_juridico: string;

  @ApiProperty({
    maxLength: 20,
    example: '123.456.789-09',
    description:
      'CPF (pessoa física) ou CNPJ (jurídica), conforme fisico_juridico, com dígitos ' +
      'verificadores válidos. Aceita sem pontuação; é gravado formatado.',
  })
  @IsString()
  @IsNotEmpty()
  @CpfCnpj()
  @MaxLength(20)
  cpf_cnpj: string;

  @DadoBancarioOpcional(20)
  banco?: string | null;

  @DadoBancarioOpcional(10)
  agencia?: string | null;

  @DadoBancarioOpcional(20)
  conta?: string | null;

  /** Independente de banco/agência/conta. */
  @DadoBancarioOpcional(50)
  chave_pix?: string | null;

  @ApiProperty({
    type: [FazendaDoPecuaristaDto],
    description:
      'Pelo menos uma fazenda: nova (criada junto, na mesma transação) ou `{ fazenda_id }` de ' +
      'uma já cadastrada. Só no POST — depois, use POST /pecuaristas/:id/fazendas.',
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Cadastre pelo menos uma fazenda para o pecuarista',
  })
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
