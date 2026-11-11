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
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ehAdmin } from '../auth/permissoes.util';
import { FUSO_HEADER } from '../common/time.util';
import { gadoParaNormal } from '../negocios/pesagem.util';
import { CreateGadoDto } from './dto/create-gado.dto';
import { UpdateGadoDto } from './dto/update-gado.dto';
import { GadosService } from './gados.service';

// Normal só lança pesagem (POST) nos negócios 'Publico' sob sua responsabilidade e recebe a
// cabeça sem valores. Consultar, corrigir e excluir pesagens é do Admin.
@ApiTags('gados')
@ApiBearerAuth()
@Controller('gados')
export class GadosController {
  constructor(private readonly gadosService: GadosService) {}

  @ApiOperation({
    description:
      'Admin: qualquer negócio da empresa. Normal: só negócio "Publico" sob sua ' +
      'responsabilidade (senão 404); a resposta não traz valores.',
  })
  @ApiHeader({
    name: FUSO_HEADER,
    required: false,
    description:
      'Fuso IANA do cliente (ex.: America/Cuiaba) para registrar a hora local.',
  })
  @Post()
  async create(
    @Body() dto: CreateGadoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers(FUSO_HEADER) fuso?: string,
  ) {
    const gado = await this.gadosService.create(dto, user, fuso);
    return ehAdmin(user) ? gado : gadoParaNormal(gado);
  }

  @Roles('Admin')
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.gadosService.findAll(user.empresa_id);
  }

  @Roles('Admin')
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gadosService.findOne(id, user.empresa_id);
  }

  // Trocar lote_id move a cabeça para outro lote do mesmo negócio (recalcula os dois).
  @Roles('Admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGadoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gadosService.update(id, dto, user);
  }

  @Roles('Admin')
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gadosService.remove(id, user.empresa_id);
  }
}
