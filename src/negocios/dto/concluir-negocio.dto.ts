import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { HORA_REGEX } from '../../common/time.util';

export class ConcluirNegocioDto {
  // Online o corpo vai vazio e a hora é a do servidor (no fuso do cliente). A fila
  // offline envia a hora local em que o usuário tocou "Concluir" no aparelho.
  @ApiPropertyOptional({
    example: '17:42:10',
    description:
      'Somente para a sincronização offline: hora local da conclusão no aparelho (HH:mm ou HH:mm:ss).',
  })
  @IsOptional()
  @Matches(HORA_REGEX)
  hora_fim_pesagem?: string;
}
