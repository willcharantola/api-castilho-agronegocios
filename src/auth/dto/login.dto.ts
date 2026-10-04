import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { NormalizarEmail } from '../../usuarios/usuario.constants';

export class LoginDto {
  @ApiProperty({ example: 'usuario@castilhoagro.com.br' })
  @NormalizarEmail()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senha: string;
}
