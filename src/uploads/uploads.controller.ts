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
