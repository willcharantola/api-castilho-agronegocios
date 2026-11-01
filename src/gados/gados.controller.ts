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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
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
    @CurrentUser() user: AuthenticatedUser,
    @Headers(FUSO_HEADER) fuso?: string,
  ) {
    return this.gadosService.create(dto, user.empresa_id, fuso);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.gadosService.findAll(user.empresa_id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gadosService.findOne(id, user.empresa_id);
  }

  // Trocar lote_id move a cabeça para outro lote do mesmo negócio (recalcula os dois).
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGadoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gadosService.update(id, dto, user.empresa_id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gadosService.remove(id, user.empresa_id);
  }
}
