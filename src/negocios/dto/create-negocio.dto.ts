import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MODALIDADES,
  TIPOS_GADO,
  TIPOS_LOTE,
  TIPOS_NEGOCIO,
} from '../../common/dominio';

/** Percentual de rendimento de uma categoria: 0 a 100, até 2 casas (CHECK no banco). */
function Rendimento(raca: string): PropertyDecorator {
  return (alvo, propriedade) => {
    ApiPropertyOptional({
      minimum: 0,
      maximum: 100,
      description:
        `Rendimento de carcaça (%) da categoria ${raca}. Obrigatório na modalidade "arroba"; ` +
        'nas modalidades "kg" e "cabeca" a API grava 100 (rendimento neutro) e ignora o valor enviado.',
    })(alvo, propriedade);
    IsOptional()(alvo, propriedade);
    IsNumber({ maxDecimalPlaces: 2 })(alvo, propriedade);
    Min(0)(alvo, propriedade);
    Max(100)(alvo, propriedade);
  };
}

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

  @ApiProperty()
  @IsInt()
  comprador_id: number;

  // hora_inicio_pesagem e hora_fim_pesagem não são aceitos do cliente: o servidor os
  // registra no primeiro POST /gados do negócio e em PATCH /negocios/:id/concluir.

  @ApiProperty({ enum: MODALIDADES })
  @IsIn(MODALIDADES)
  modalidade: string;

  @ApiProperty({ enum: TIPOS_GADO })
  @IsIn(TIPOS_GADO)
  tipo_gado: string;

  @ApiProperty({ enum: TIPOS_LOTE })
  @IsIn(TIPOS_LOTE)
  tipo_lote: string;

  @ApiProperty({
    enum: TIPOS_NEGOCIO,
    description:
      'Define o cálculo de Funrural e Senar: "Desconto em folha" só Senar, "Funrural" só ' +
      'Funrural, "Livre" nenhum.',
  })
  @IsIn(TIPOS_NEGOCIO)
  tipo_negocio: string;

  @ApiProperty({
    maxLength: 30,
    example: '8,9 e 10',
    description:
      'Média do carimbo do lote, texto livre. Só o tamanho é limitado, pela coluna VARCHAR(30).',
  })
  @IsString()
  @MaxLength(30)
  media_carimbo: string;

  @Rendimento('Nelore')
  porcentagem_rendimento_nelore?: number;

  @Rendimento('Anelorado')
  porcentagem_rendimento_anelorado?: number;

  @Rendimento('Angus')
  porcentagem_rendimento_angus?: number;

  @Rendimento('Composto')
  porcentagem_rendimento_composto?: number;

  @ApiProperty({ example: '2026-09-09T00:00:00.000Z' })
  @IsDateString()
  data_negocio: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description:
      'Percentual de comissão (0 a 100). Editável depois via PATCH /negocios/:id. ' +
      'O valor em R$ (`comissao`) é calculado pela API: valor_total × percentual / 100.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentagem_comissao?: number;

  @ApiProperty({
    minimum: 0,
    description: 'Valor por arroba, kg ou cabeça, conforme a modalidade.',
  })
  @IsNumber()
  @Min(0)
  valor_unidade: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  observacao?: string;

  // valor_total, valor_medio, qtd_animais, mais_pesado e mais_leve são agregados
  // calculados no backend a partir dos gados do negócio — não fazem parte do DTO.
  // comissao (R$) também é calculada no backend, a partir de porcentagem_comissao.
  // valor_medio, mais_pesado e mais_leve ficam NULL na modalidade "cabeca".
  // Campos do romaneio (peso_total_quilos, peso_total_arroba, rendimento_medio,
  // peso_medio_arroba, peso_medio_quilos, funrural, senar) também são calculados pela
  // API e, fora do DTO, são rejeitados pelo forbidNonWhitelisted. aliquota_funrural e
  // aliquota_senar são copiadas da empresa na criação.

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
