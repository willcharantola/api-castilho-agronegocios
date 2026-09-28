import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCompradorDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome_empresa: string;

  @ApiProperty({ maxLength: 18 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  cnpj: string;

  @ApiProperty({ maxLength: 13 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(13)
  telefone: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  municipio: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  pessoa_contato: string;
}
