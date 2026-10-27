import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const fazendaNova = (o: FazendaDoPecuaristaDto) => o.fazenda_id === undefined;

/**
 * Item de `fazendas` em POST /pecuaristas e corpo de POST /pecuaristas/:id/fazendas:
 * ou `{ fazenda_id }` (vincula uma fazenda já cadastrada), ou os dados de uma fazenda
 * nova (mesmas regras de CreateFazendaDto), que é criada e vinculada.
 */
export class FazendaDoPecuaristaDto {
  @ApiPropertyOptional({
    description:
      'Vincula uma fazenda já cadastrada (relação N:N). Não envie os dados de fazenda junto.',
  })
  @IsOptional()
  @IsInt()
  fazenda_id?: number;

  @ApiPropertyOptional({ maxLength: 50, description: 'Fazenda nova.' })
  @ValidateIf(fazendaNova)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome_fazenda?: string;

  @ApiPropertyOptional({ maxLength: 20, description: 'Fazenda nova.' })
  @ValidateIf(fazendaNova)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  municipio?: string;

  @ApiPropertyOptional({ maxLength: 12, description: 'Fazenda nova.' })
  @ValidateIf(fazendaNova)
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  inscricao_estadual?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    nullable: true,
    description:
      'Fazenda nova: URL da marca obtida em POST /uploads/marca-fazenda (finalUrl). No ' +
      'cadastro offline a imagem é enviada depois, via PATCH /fazendas/:id.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  marca_url?: string | null;

  @ApiPropertyOptional({ maxLength: 10, description: 'Fazenda nova.' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  marca_escrita?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Fazenda nova cadastrada offline: reenvios com o mesmo valor reaproveitam a fazenda ' +
      'já criada (idempotência da sincronização).',
  })
  @IsOptional()
  @IsUUID()
  uuid_origem?: string;
}
