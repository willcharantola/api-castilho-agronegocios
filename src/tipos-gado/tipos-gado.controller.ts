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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateTipoGadoDto } from './dto/create-tipo-gado.dto';
import { UpdateTipoGadoDto } from './dto/update-tipo-gado.dto';
import { TiposGadoService } from './tipos-gado.service';

// Sempre da empresa do usuário (JWT). Qualquer usuário lê; só Admin cadastra, renomeia
// e exclui (Normal → 403).
@ApiTags('tipos-gado')
@ApiBearerAuth()
@Controller('tipos-gado')
export class TiposGadoController {
  constructor(private readonly tiposGadoService: TiposGadoService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.tiposGadoService.findAll(user.empresa_id);
  }

  @Roles('Admin')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTipoGadoDto,
  ) {
    return this.tiposGadoService.create(dto, user.empresa_id);
  }

  @Roles('Admin')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTipoGadoDto,
  ) {
    return this.tiposGadoService.update(id, dto, user.empresa_id);
  }

  @Roles('Admin')
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tiposGadoService.remove(id, user.empresa_id);
  }
}
