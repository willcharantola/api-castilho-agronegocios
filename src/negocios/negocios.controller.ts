import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FUSO_HEADER } from '../common/time.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { ConcluirNegocioDto } from './dto/concluir-negocio.dto';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { FindNegociosQueryDto } from './dto/find-negocios-query.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';
import { NegociosService } from './negocios.service';

@ApiTags('negocios')
@ApiBearerAuth()
@Controller('negocios')
export class NegociosController {
  constructor(private readonly negociosService: NegociosService) {}

  @Post()
  create(@Body() dto: CreateNegocioDto) {
    return this.negociosService.create(dto);
  }

  @ApiQuery({ name: 'fazenda_id', required: false, type: Number })
  @ApiQuery({ name: 'data_inicio', required: false, type: String })
  @ApiQuery({ name: 'data_fim', required: false, type: String })
  @Get()
  findAll(@Query() query: FindNegociosQueryDto) {
    return this.negociosService.findAll(
      query.fazenda_id,
      query.data_inicio,
      query.data_fim,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNegocioDto) {
    return this.negociosService.update(id, dto);
  }

  // Chamado pelo botão "Concluir" do cadastro: registra hora_fim_pesagem (hora local do cliente).
  @ApiHeader({
    name: FUSO_HEADER,
    required: false,
    description:
      'Fuso IANA do cliente (ex.: America/Cuiaba) para registrar a hora local.',
  })
  @Patch(':id/concluir')
  concluir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConcluirNegocioDto,
    @Headers(FUSO_HEADER) fuso?: string,
  ) {
    return this.negociosService.concluir(id, fuso, dto.hora_fim_pesagem);
  }

  // Exclusão de negócios é uma ação sensível: restrita a nivel_acesso "Admin".
  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.remove(id);
  }
}
