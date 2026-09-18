import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEmpresaDto {
  @ApiProperty({ example: '12.345.678/0001-90', maxLength: 18 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  cnpj: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  creci: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  banco: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  chave_pix: string;

  @ApiProperty({ maxLength: 4 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  agencia: string;

  @ApiProperty({ maxLength: 10 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  conta: string;
}
