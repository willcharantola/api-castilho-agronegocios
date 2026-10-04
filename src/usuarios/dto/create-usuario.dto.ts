import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizarEmail, SENHA_MAX, SENHA_MIN } from '../usuario.constants';

// empresa_id nunca vem do cliente: é copiado do administrador autenticado.
export class CreateUsuarioDto {
  @ApiProperty({ minLength: 1, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome: string;

  @ApiProperty({ minLength: 1, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sobrenome: string;

  @ApiProperty({
    example: 'usuario@castilhoagro.com.br',
    maxLength: 254,
    description: 'Gravado em minúsculas e sem espaços.',
  })
  @NormalizarEmail()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ enum: ['Admin', 'Normal'] })
  @IsIn(['Admin', 'Normal'])
  nivel_acesso: string;

  @ApiProperty({
    minLength: SENHA_MIN,
    maxLength: SENHA_MAX,
    description:
      'Enviada em texto puro; é hasheada com bcrypt antes de persistir.',
  })
  @IsString()
  @MinLength(SENHA_MIN, {
    message: `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`,
  })
  @MaxLength(SENHA_MAX, {
    message: `A senha deve ter no máximo ${SENHA_MAX} caracteres.`,
  })
  senha: string;

  @ApiProperty({
    description:
      'Se true, o usuário precisa definir uma nova senha no próximo login.',
  })
  @IsBoolean()
  primeiro_acesso: boolean;
}
