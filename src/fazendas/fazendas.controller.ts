import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ehLinkCurto, expandirLinkMapa } from '../common/localizacao.util';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';
import { FazendasService } from './fazendas.service';

@ApiTags('fazendas')
@ApiBearerAuth()
// Cadastros: somente Admin (o usuário Normal só acessa as rotas de pesagem).
@Roles('Admin')
@Controller('fazendas')
export class FazendasController {
  constructor(private readonly fazendasService: FazendasService) {}

  @Post()
  create(@Body() dto: CreateFazendaDto) {
    return this.fazendasService.create(dto);
  }

  @Get()
  findAll() {
    return this.fazendasService.findAll();
  }

  /**
   * Link completo por trás de um link curto do Google Maps (maps.app.goo.gl), usado pelo
   * front na pré-visualização do mapa. Declarado antes de ':id' para não cair no ParseIntPipe.
   */
  @Get('mapa/expandir')
  @ApiQuery({ name: 'link', example: 'https://maps.app.goo.gl/abc123' })
  async expandirMapa(@Query('link') link?: string) {
    if (typeof link !== 'string' || !ehLinkCurto(link)) {
      throw new BadRequestException(
        'link deve ser um link curto do Google Maps (maps.app.goo.gl ou goo.gl/maps)',
      );
    }
    return { link: await expandirLinkMapa(link) };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fazendasService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFazendaDto) {
    return this.fazendasService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.fazendasService.remove(id);
  }
}
