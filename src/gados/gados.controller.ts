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
import { CreateGadoDto } from './dto/create-gado.dto';
import { UpdateGadoDto } from './dto/update-gado.dto';
import { GadosService } from './gados.service';

@ApiTags('gados')
@ApiBearerAuth()
@Controller('gados')
export class GadosController {
  constructor(private readonly gadosService: GadosService) {}

  @Post()
  create(@Body() dto: CreateGadoDto) {
    return this.gadosService.create(dto);
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
