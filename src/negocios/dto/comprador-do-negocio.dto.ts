import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';
import { TIPOS_COMPRADOR, type TipoComprador } from '../../common/dominio';

/**
 * Comprador do negócio na entrada da API: um frigorífico (`/compradores`) ou um pecuarista
 * (`/pecuaristas`). A API grava o id na coluna correspondente (comprador_id ou
 * comprador_pecuarista_id) e deixa a outra null.
 */
export class CompradorDoNegocioDto {
  @ApiProperty({ enum: TIPOS_COMPRADOR })
  @IsIn(TIPOS_COMPRADOR, {
    message: 'comprador.tipo deve ser "frigorifico" ou "pecuarista"',
  })
  tipo: TipoComprador;

  @ApiProperty({
    description: 'comprador_id do frigorífico ou pecuarista_id do pecuarista.',
  })
  @IsInt()
  @Min(1)
  id: number;
}
