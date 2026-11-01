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
import { IsLocalizacaoGoogle } from '../../common/localizacao.util';

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
    maxLength: 200,
    nullable: true,
    description: 'Endereço da fazenda, texto livre.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  endereco_fazenda?: string | null;

  @ApiPropertyOptional({
    maxLength: 500,
    nullable: true,
    example: '-20.7123,-51.6543',
    description:
      'Link do Google Maps (https em www.google.com/maps, google.com/maps, maps.google.com, ' +
      'maps.app.goo.gl ou goo.gl/maps) ou coordenadas "latitude,longitude" com ponto decimal.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsLocalizacaoGoogle()
  localizacao_google?: string | null;

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
