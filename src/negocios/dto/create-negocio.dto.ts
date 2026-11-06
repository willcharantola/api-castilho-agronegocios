import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MODALIDADES, TIPOS_GADO, TIPOS_NEGOCIO } from '../../common/dominio';
import { CompradorDoNegocioDto } from './comprador-do-negocio.dto';

export class CreateNegocioDto {
  @ApiProperty()
  @IsInt()
  empresa_id: number;

  @ApiProperty()
  @IsInt()
  fazenda_id: number;

  @ApiProperty({ description: 'Pecuarista que efetivamente fechou o negócio.' })
  @IsInt()
  pecuarista_id: number;

  @ApiProperty({
    type: CompradorDoNegocioDto,
    example: { tipo: 'frigorifico', id: 3 },
    description:
      'Frigorífico ou pecuarista. Um pecuarista não pode comprar do próprio negócio ' +
      '(id igual a pecuarista_id → 400).',
  })
  @IsDefined({ message: 'Informe o comprador' })
  @ValidateNested()
  @Type(() => CompradorDoNegocioDto)
  comprador: CompradorDoNegocioDto;

  // hora_inicio_pesagem e hora_fim_pesagem não são aceitos do cliente: o servidor os
  // registra no primeiro POST /gados do negócio e em PATCH /negocios/:id/concluir.

  @ApiProperty({ enum: MODALIDADES })
  @IsIn(MODALIDADES)
  modalidade: string;

  @ApiProperty({ enum: TIPOS_GADO })
  @IsIn(TIPOS_GADO)
  tipo_gado: string;

  @ApiProperty({
    enum: TIPOS_NEGOCIO,
    description:
      'Define o cálculo de Funrural e Senar: "Desconto em folha" só Senar, "Funrural" só ' +
      'Funrural, "Livre" nenhum.',
  })
  @IsIn(TIPOS_NEGOCIO)
  tipo_negocio: string;

  @ApiProperty({
    minimum: 0,
    description:
      'Preço por unidade, o mesmo para todos os lotes: R$ por arroba, por kg ou por ' +
      'cabeça, conforme a modalidade. Alterá-lo recalcula todas as cabeças e lotes.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor_unidade: number;

  @ApiProperty({ example: '2026-09-09T00:00:00.000Z' })
  @IsDateString()
  data_negocio: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description:
      'Valor da comissão (0 a 100, 2 casas). Gado Gordo em "arroba"/"kg": R$ por arroba ' +
      'de peso vivo (`comissao` = valor × peso_total_quilos / 15). Demais casos: percentual ' +
      '(`comissao` = valor_total × valor / 100). Ver `modo_comissao` na resposta. Mudar ' +
      'tipo_gado ou modalidade de forma que o modo mude descarta o valor (fica null).',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  porcentagem_comissao?: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  observacao?: string;

  // Tipo de lote, carimbo e rendimento pertencem ao lote
  // (POST /negocios/:id/lotes): enviados aqui, o forbidNonWhitelisted responde 400.
  // valor_total, valor_medio, qtd_animais, pesos, mais pesado/mais leve, rendimento médio,
  // comissao (R$), funrural e senar são agregados calculados pela API a partir dos lotes e
  // gados — também fora do DTO. aliquota_funrural e aliquota_senar são copiadas da empresa
  // na criação.

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
