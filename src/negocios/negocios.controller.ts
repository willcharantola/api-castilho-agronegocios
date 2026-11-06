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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FUSO_HEADER } from '../common/time.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  ehAdmin,
  ocultarCamposDeComissao,
  semCamposDeComissao,
} from '../auth/permissoes.util';
import { comModoComissao } from './calculo.util';
import { comCompradorUnificado } from './comprador.util';
import { ConcluirNegocioDto } from './dto/concluir-negocio.dto';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { FindNegociosQueryDto } from './dto/find-negocios-query.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';
import { NegociosService } from './negocios.service';

/** Negócio como a API devolve: modo da comissão, comprador unificado e comissão por perfil. */
function apresentar<
  T extends Parameters<typeof comModoComissao>[0] &
    Parameters<typeof comCompradorUnificado>[0],
>(negocio: T, user: AuthenticatedUser) {
  return ocultarCamposDeComissao(
    comCompradorUnificado(comModoComissao(negocio)),
    user,
  );
}

// Comissão (valor, valor informado e modo_comissao) é restrita a Admin: para o usuário
// Normal toda resposta de negócio sai com esses campos `null`, e os enviados por ele são
// ignorados. `modo_comissao` diz como ler `porcentagem_comissao` (ver modoComissao).
@ApiTags('negocios')
@ApiBearerAuth()
@Controller('negocios')
export class NegociosController {
  constructor(private readonly negociosService: NegociosService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNegocioDto,
  ) {
    const negocio = await this.negociosService.create(
      semCamposDeComissao(dto, user),
    );
    return apresentar(negocio, user);
  }

  @ApiQuery({ name: 'fazenda_id', required: false, type: Number })
  @ApiQuery({ name: 'data_inicio', required: false, type: String })
  @ApiQuery({ name: 'data_fim', required: false, type: String })
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindNegociosQueryDto,
  ) {
    const negocios = await this.negociosService.findAll(
      query.fazenda_id,
      query.data_inicio,
      query.data_fim,
    );
    return negocios.map((negocio) => apresentar(negocio, user));
  }

  @ApiOperation({
    summary: 'Métricas da Home e do Dashboard',
    description:
      'Negócios realizados, comissão total (R$) e total de cabeças no período, com os ' +
      'mesmos filtros da listagem. Para usuário Normal as três vêm null.',
  })
  @ApiQuery({ name: 'fazenda_id', required: false, type: Number })
  @ApiQuery({ name: 'data_inicio', required: false, type: String })
  @ApiQuery({ name: 'data_fim', required: false, type: String })
  @Get('resumo')
  resumo(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindNegociosQueryDto,
  ) {
    return this.negociosService.resumo(
      ehAdmin(user),
      query.fazenda_id,
      query.data_inicio,
      query.data_fim,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return apresentar(await this.negociosService.findOne(id), user);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNegocioDto,
  ) {
    const negocio = await this.negociosService.update(
      id,
      semCamposDeComissao(dto, user),
    );
    return apresentar(negocio, user);
  }

  // Chamado pelo botão "Concluir" do cadastro: registra hora_fim_pesagem (hora local do cliente).
  @ApiHeader({
    name: FUSO_HEADER,
    required: false,
    description:
      'Fuso IANA do cliente (ex.: America/Cuiaba) para registrar a hora local.',
  })
  @Patch(':id/concluir')
  async concluir(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConcluirNegocioDto,
    @Headers(FUSO_HEADER) fuso?: string,
  ) {
    const negocio = await this.negociosService.concluir(
      id,
      fuso,
      dto.hora_fim_pesagem,
    );
    return negocio && apresentar(negocio, user);
  }

  // Exclusão de negócios é uma ação sensível: restrita a nivel_acesso "Admin".
  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.remove(id);
  }
}
