import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Cnpj } from '../../common/documentos.util';

/** Dados cadastrais da empresa (tela Configurações > Dados da empresa). Todos obrigatórios. */
export class UpdateDadosEmpresaDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da empresa.' })
  @MaxLength(50)
  nome: string;

  @ApiProperty({ example: '12.345.678/0001-95', maxLength: 18 })
  @Cnpj()
  cnpj: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty({ message: 'Informe o CRECI.' })
  @MaxLength(20)
  creci: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty({ message: 'Informe o banco.' })
  @MaxLength(20)
  banco: string;

  @ApiProperty({ maxLength: 4 })
  @IsString()
  @IsNotEmpty({ message: 'Informe a agência.' })
  @MaxLength(4)
  agencia: string;

  @ApiProperty({ maxLength: 10 })
  @IsString()
  @IsNotEmpty({ message: 'Informe a conta.' })
  @MaxLength(10)
  conta: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'Informe a chave Pix.' })
  @MaxLength(50)
  chave_pix: string;
}
