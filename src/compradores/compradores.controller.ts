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
import { CompradoresService } from './compradores.service';
import { CreateCompradorDto } from './dto/create-comprador.dto';
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
