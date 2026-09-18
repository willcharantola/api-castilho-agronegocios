import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateVendedorDto {
  @ApiProperty()
  @IsInt()
  fazenda_id: number;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome_vendedor: string;

  @ApiProperty({ enum: ['fisico', 'juridico'] })
  @IsIn(['fisico', 'juridico'])
  fisico_juridico: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  cpf_cnpj: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  banco: string;

  @ApiProperty({ maxLength: 5 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  agencia: string;

  @ApiProperty({ maxLength: 10 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  conta: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  chave_pix: string;
}
