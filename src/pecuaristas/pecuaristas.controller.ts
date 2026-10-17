import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssociarFazendaDto } from './dto/associar-fazenda.dto';
import { CreatePecuaristaDto } from './dto/create-pecuarista.dto';
import { UpdatePecuaristaDto } from './dto/update-pecuarista.dto';
import { PecuaristasService } from './pecuaristas.service';

@ApiTags('pecuaristas')
@ApiBearerAuth()
@Controller('pecuaristas')
export class PecuaristasController {
  constructor(private readonly pecuaristasService: PecuaristasService) {}

  @Post()
  create(@Body() dto: CreatePecuaristaDto) {
    return this.pecuaristasService.create(dto);
  }

  @Get()
  findAll() {
    return this.pecuaristasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pecuaristasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePecuaristaDto,
  ) {
    return this.pecuaristasService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pecuaristasService.remove(id);
  }

  @Post(':id/fazendas')
  associarFazenda(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssociarFazendaDto,
  ) {
    return this.pecuaristasService.associarFazenda(id, dto.fazenda_id);
  }

  @Delete(':id/fazendas/:fazendaId')
  desassociarFazenda(
    @Param('id', ParseIntPipe) id: number,
    @Param('fazendaId', ParseIntPipe) fazendaId: number,
  ) {
    return this.pecuaristasService.desassociarFazenda(id, fazendaId);
  }
}
