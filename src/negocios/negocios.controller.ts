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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
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

  // Exclusão de negócios é uma ação sensível: restrita a nivel_acesso "Admin".
  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.remove(id);
  }
}
