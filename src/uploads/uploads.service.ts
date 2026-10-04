import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const PASTA_MARCAS = 'fazendas/marcas/';
const VALIDADE_UPLOAD_SEGUNDOS = 300;

@Injectable()
export class UploadsService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.getOrThrow<string>('AWS_REGION');
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET_NAME');
    // Sem chaves no código: na EC2 o SDK usa a IAM Role da instância; localmente,
    // a cadeia padrão (~/.aws/credentials).
    this.s3 = new S3Client({ region: this.region });
  }

  /**
   * Autoriza o envio de uma marca de fazenda direto ao S3 (o arquivo não passa pela API).
   * Não depende de fazenda_id: no cadastro a fazenda ainda não existe.
   */
  async gerarUrlUploadMarca(contentType: string) {
    const nomeArquivo = `${randomUUID()}.${EXTENSOES[contentType]}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: `${PASTA_MARCAS}${nomeArquivo}`,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: VALIDADE_UPLOAD_SEGUNDOS,
      // Inclui o Content-Type na assinatura: sem isso o S3 aceita o PUT com qualquer
      // tipo (ex.: text/html servido publicamente pelo nosso bucket).
      signableHeaders: new Set(['content-type']),
    });
    return { uploadUrl, finalUrl: `${this.prefixoMarcas()}${nomeArquivo}` };
  }

  /**
   * Prefixo público de todas as marcas (endpoint regional — o global pode redirecionar
   * fora de us-east-1). Também usado para validar `marca_url` nas fazendas.
   */
  prefixoMarcas() {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${PASTA_MARCAS}`;
  }
}
