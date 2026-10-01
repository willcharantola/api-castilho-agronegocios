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
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { FUSO_HEADER } from '../common/time.util';
import { CreateGadoDto } from './dto/create-gado.dto';
import { UpdateGadoDto } from './dto/update-gado.dto';
import { GadosService } from './gados.service';

@ApiTags('gados')
@ApiBearerAuth()
@Controller('gados')
export class GadosController {
  constructor(private readonly gadosService: GadosService) {}

  @ApiHeader({
    name: FUSO_HEADER,
    required: false,
    description: 'Fuso IANA do cliente (ex.: America/Cuiaba) para registrar a hora local.',
  })
  @Post()
  create(
    @Body() dto: CreateGadoDto,
    @Headers(FUSO_HEADER) fuso?: string,
  ) {
    return this.gadosService.create(dto, fuso);
  }

  @Get()
  findAll() {
    return this.gadosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gadosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGadoDto) {
    return this.gadosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.gadosService.remove(id);
  }
}
