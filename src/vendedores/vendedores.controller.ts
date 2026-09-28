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
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';
import { VendedoresService } from './vendedores.service';

@ApiTags('vendedores')
@ApiBearerAuth()
@Controller('vendedores')
export class VendedoresController {
  constructor(private readonly vendedoresService: VendedoresService) {}

  @Post()
  create(@Body() dto: CreateVendedorDto) {
    return this.vendedoresService.create(dto);
  }

  @Get()
  findAll() {
    return this.vendedoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vendedoresService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVendedorDto,
  ) {
    return this.vendedoresService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vendedoresService.remove(id);
  }

  @Post(':id/fazendas')
  associarFazenda(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssociarFazendaDto,
  ) {
    return this.vendedoresService.associarFazenda(id, dto.fazenda_id);
  }

  @Delete(':id/fazendas/:fazendaId')
  desassociarFazenda(
    @Param('id', ParseIntPipe) id: number,
    @Param('fazendaId', ParseIntPipe) fazendaId: number,
  ) {
    return this.vendedoresService.desassociarFazenda(id, fazendaId);
  }
}
