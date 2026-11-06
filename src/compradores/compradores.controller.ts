import {
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CompradoresService } from './compradores.service';
import { CreateCompradorDto } from './dto/create-comprador.dto';
import { OpcoesCompradorQueryDto } from './dto/opcoes-comprador-query.dto';
import { UpdateCompradorDto } from './dto/update-comprador.dto';

@ApiTags('compradores')
@ApiBearerAuth()
@Controller('compradores')
export class CompradoresController {
  constructor(private readonly compradoresService: CompradoresService) {}

  @Post()
  create(@Body() dto: CreateCompradorDto) {
    return this.compradoresService.create(dto);
  }

  @Get()
  findAll() {
    return this.compradoresService.findAll();
  }

  // Antes de ':id', senão "opcoes" seria lido como id.
  @ApiOperation({
    summary: 'Compradores possíveis de um negócio',
    description:
      'Frigoríficos e pecuaristas juntos, ordenados por nome, cada um com tipo, id, nome, ' +
      'documento e município. `busca` filtra por nome ou documento (sem maiúsculas).',
  })
  @ApiQuery({ name: 'busca', required: false, type: String })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  @ApiQuery({ name: 'pagina', required: false, type: Number })
  @Get('opcoes')
  opcoes(@Query() query: OpcoesCompradorQueryDto) {
    return this.compradoresService.opcoes(
      query.busca,
      query.limite,
      query.pagina,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.compradoresService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompradorDto,
  ) {
    return this.compradoresService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.compradoresService.remove(id);
  }
}
