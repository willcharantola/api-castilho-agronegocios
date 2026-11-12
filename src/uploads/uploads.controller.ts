import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateUploadMarcaDto,
  UploadMarcaResponseDto,
} from './dto/create-upload-marca.dto';
import { UploadsService } from './uploads.service';

// Protegido pelo JwtAuthGuard global (não é @Public()).
@ApiTags('uploads')
@ApiBearerAuth()
// Liberado a todos: a marca é enviada ao cadastrar uma fazenda, que o Normal também faz.
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @ApiCreatedResponse({ type: UploadMarcaResponseDto })
  @Post('marca-fazenda')
  gerarUrlMarca(
    @Body() dto: CreateUploadMarcaDto,
  ): Promise<UploadMarcaResponseDto> {
    return this.uploads.gerarUrlUploadMarca(dto.contentType);
  }
}
