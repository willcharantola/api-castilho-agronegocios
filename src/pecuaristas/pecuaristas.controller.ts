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
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePecuaristaDto } from './dto/create-pecuarista.dto';
import { FazendaDoPecuaristaDto } from './dto/fazenda-do-pecuarista.dto';
import { UpdatePecuaristaDto } from './dto/update-pecuarista.dto';
import { PecuaristasService } from './pecuaristas.service';

@ApiTags('pecuaristas')
@ApiBearerAuth()
// Consultar e cadastrar: liberado a todos (o Normal escolhe ou cadastra pecuarista, fazenda
// e comprador ao cadastrar um negócio). Alterar e excluir: só Admin (Normal → 403).
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

  @Roles('Admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePecuaristaDto,
  ) {
    return this.pecuaristasService.update(id, dto);
  }

  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pecuaristasService.remove(id);
  }

  // Fazenda nova (criada e vinculada) ou `{ fazenda_id }` de uma existente. Vincular
  // de novo uma fazenda já vinculada não é erro.
  @Post(':id/fazendas')
  associarFazenda(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FazendaDoPecuaristaDto,
  ) {
    return this.pecuaristasService.associarFazenda(id, dto);
  }

  @Roles('Admin')
  @Delete(':id/fazendas/:fazendaId')
  desassociarFazenda(
    @Param('id', ParseIntPipe) id: number,
    @Param('fazendaId', ParseIntPipe) fazendaId: number,
  ) {
    return this.pecuaristasService.desassociarFazenda(id, fazendaId);
  }
}
