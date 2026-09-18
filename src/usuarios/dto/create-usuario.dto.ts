import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty()
  @IsInt()
  empresa_id: number;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sobrenome: string;

  @ApiProperty({ example: 'usuario@castilhoagro.com.br', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    minLength: 6,
    description:
      'Enviada em texto puro; é hasheada com bcrypt antes de persistir.',
  })
  @IsString()
  @MinLength(6)
  senha: string;

  @ApiProperty({ enum: ['Admin', 'Normal'] })
  @IsIn(['Admin', 'Normal'])
  nivel_acesso: string;
}
