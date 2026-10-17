import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssociarFazendaDto {
  @ApiProperty()
  @IsInt()
  fazenda_id: number;
}
