import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateUploadMarcaDto,
  UploadMarcaResponseDto,
} from './dto/create-upload-marca.dto';
import { UploadsService } from './uploads.service';

// Protegido pelo JwtAuthGuard global (não é @Public()).
@ApiTags('uploads')
@ApiBearerAuth()
// Cadastros: somente Admin (o usuário Normal só acessa as rotas de pesagem).
@Roles('Admin')
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
