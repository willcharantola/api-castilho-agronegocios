import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { SENHA_MAX, SENHA_MIN } from '../../usuarios/usuario.constants';

export class DefinirSenhaPrimeiroAcessoDto {
  @ApiProperty({ minLength: SENHA_MIN, maxLength: SENHA_MAX })
  @IsString()
  @MinLength(SENHA_MIN, {
    message: `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`,
  })
  @MaxLength(SENHA_MAX, {
    message: `A senha deve ter no máximo ${SENHA_MAX} caracteres.`,
  })
  nova_senha: string;
}
