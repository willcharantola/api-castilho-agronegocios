import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ConfiguracoesService } from './configuracoes.service';
import { UpdateImpostosDto } from './dto/update-impostos.dto';

@ApiTags('configuracoes')
@ApiBearerAuth()
@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(private readonly configuracoesService: ConfiguracoesService) {}

  @ApiOperation({
    summary: 'Alíquotas de Funrural e Senar da empresa',
    description: 'Em pontos percentuais (1.5 = 1,5%). Qualquer usuário logado.',
  })
  @Get('impostos')
  findImpostos(@CurrentUser() user: AuthenticatedUser) {
    return this.configuracoesService.findImpostos(user.empresa_id);
  }

  @ApiOperation({
    summary: 'Alterar alíquotas de Funrural e Senar',
    description:
      'Só Admin. Valem para os negócios criados depois; os existentes mantêm as suas.',
  })
  @Roles('Admin')
  @Patch('impostos')
  updateImpostos(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateImpostosDto,
  ) {
    return this.configuracoesService.updateImpostos(user.empresa_id, dto);
  }
}
