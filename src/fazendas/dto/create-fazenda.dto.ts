import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  CnpjOpcional,
  InscricaoEstadual,
} from '../../common/documentos.util';
import { IsLocalizacaoGoogle } from '../../common/localizacao.util';

export class CreateFazendaDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome_fazenda: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  municipio: string;

  @ApiProperty({
    maxLength: 12,
    example: '28.766.688-3',
    description: 'Inscrição estadual (MS), 00.000.000-0; aceita também só os 9 dígitos.',
  })
  @IsString()
  @IsNotEmpty()
  @InscricaoEstadual()
  @MaxLength(12)
  inscricao_estadual: string;

  @ApiPropertyOptional({
    maxLength: 18,
    nullable: true,
    example: '12.345.678/0001-90',
    description:
      'CNPJ próprio da fazenda, opcional. Aceita com ou sem pontuação (grava no formato ' +
      '00.000.000/0000-00); dígitos verificadores inválidos → 400. Vazio ou null limpa.',
  })
  @IsOptional()
  @CnpjOpcional()
  @MaxLength(18)
  cnpj?: string | null;

  @ApiPropertyOptional({
    maxLength: 500,
    nullable: true,
    description:
      'URL pública da marca (logo), obtida em POST /uploads/marca-fazenda (finalUrl). ' +
      'Só aceita imagens do bucket da Castilho. `null` remove a imagem.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  marca_url?: string | null;

  @ApiPropertyOptional({ maxLength: 10 })
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
      'Identificador gerado no aparelho para cadastros feitos offline. Reenvios com o mesmo ' +
      'valor devolvem o registro já criado (idempotência da sincronização).',
  })
  @IsOptional()
  @IsUUID()
  uuid_origem?: string;
}
