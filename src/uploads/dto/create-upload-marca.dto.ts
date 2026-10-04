import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const MARCA_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class CreateUploadMarcaDto {
  @ApiProperty({ enum: MARCA_CONTENT_TYPES, example: 'image/jpeg' })
  @IsIn(MARCA_CONTENT_TYPES)
  contentType: string;
}

export class UploadMarcaResponseDto {
  @ApiProperty({
    description:
      'URL pré-assinada (válida por 5 minutos) para enviar o arquivo direto ao S3 com PUT, ' +
      'usando o mesmo Content-Type informado. Não enviar o header Authorization.',
  })
  uploadUrl: string;

  @ApiProperty({
    example:
      'https://castilho-agronegocios-uploads.s3.us-east-2.amazonaws.com/fazendas/marcas/3f1c….jpg',
    description:
      'URL pública da imagem após o upload — enviar como marca_url da fazenda.',
  })
  finalUrl: string;
}
