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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { LotesService } from './lotes.service';

@ApiTags('lotes')
@ApiBearerAuth()
// Admin: lotes de qualquer negócio da empresa. Normal: só dos negócios 'Publico' sob sua
// responsabilidade (ex.: os que ele mesmo cadastrou); os demais respondem 404.
@Controller()
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @ApiOperation({
    summary: 'Cria um lote no negócio',
    description:
      'Nome único no negócio (400 se repetido). Na modalidade "cabeca" o negócio tem um único ' +
      'lote ("Lote único"); um segundo responde 400.',
  })
  @Post('negocios/:negocioId/lotes')
  create(
    @Param('negocioId', ParseIntPipe) negocioId: number,
    @Body() dto: CreateLoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.create(negocioId, dto, user);
  }

  @Get('negocios/:negocioId/lotes')
  findDoNegocio(
    @Param('negocioId', ParseIntPipe) negocioId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.findDoNegocio(negocioId, user);
  }

  @Get('lotes/:id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.findOne(id, user);
  }

  @ApiOperation({
    description:
      'Mudar o rendimento ou o valor da unidade recalcula as cabeças do lote, o lote e o negócio.',
  })
  @Patch('lotes/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.update(id, dto, user);
  }

  @ApiOperation({ description: '409 se o lote tiver cabeças pesadas.' })
  @Delete('lotes/:id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.remove(id, user);
  }
}
