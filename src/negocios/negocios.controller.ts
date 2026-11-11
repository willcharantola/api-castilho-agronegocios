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
import { STATUS_VISUALIZACAO } from '../common/dominio';
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
import { conclusaoParaNormal } from './pesagem.util';

type ResponsavelGravado = {
  usuario_id: number;
  nome: string;
  sobrenome: string;
};

/** Responsável na resposta: id e nome completo. Sem a relação carregada, fica de fora. */
function comResponsavel<T extends { responsavel?: ResponsavelGravado | null }>(
  negocio: T,
) {
  const { responsavel, ...resto } = negocio;
  if (responsavel === undefined) return resto;
  return {
    ...resto,
    responsavel: responsavel && {
      usuario_id: responsavel.usuario_id,
      nome: `${responsavel.nome} ${responsavel.sobrenome}`.trim(),
    },
  };
}

/** Negócio como a API devolve: modo da comissão, comprador unificado e comissão por perfil. */
function apresentar<
  T extends Parameters<typeof comModoComissao>[0] &
    Parameters<typeof comCompradorUnificado>[0] & {
      responsavel?: ResponsavelGravado | null;
    },
>(negocio: T, user: AuthenticatedUser) {
  return ocultarCamposDeComissao(
    comResponsavel(comCompradorUnificado(comModoComissao(negocio))),
    user,
  );
}

// Acesso por perfil (instrucoes-acesso-usuario.md):
// - Admin cadastra, consulta, edita e exclui negócios, e define o responsável e o status
//   de visualização ('Publico' | 'Privado').
// - Normal só enxerga os negócios 'Publico' em que é o responsável, pelas rotas de pesagem
//   (visão reduzida, sem valores nem comprador), e pode concluir a pesagem deles. As demais
//   rotas respondem 403; negócio fora do alcance dele, 404.
// Comissão (valor, valor informado e modo_comissao) continua restrita a Admin.
@ApiTags('negocios')
@ApiBearerAuth()
@Controller('negocios')
export class NegociosController {
  constructor(private readonly negociosService: NegociosService) {}

  @Roles('Admin')
  @ApiOperation({
    description:
      'Sem responsavel_id, o responsável é o Admin autenticado; sem status_visualizacao, ' +
      'o negócio nasce "Privado".',
  })
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNegocioDto,
  ) {
    const negocio = await this.negociosService.create(
      semCamposDeComissao(dto, user),
      user.id,
    );
    return apresentar(negocio, user);
  }

  @Roles('Admin')
  @ApiQuery({ name: 'fazenda_id', required: false, type: Number })
  @ApiQuery({ name: 'data_inicio', required: false, type: String })
  @ApiQuery({ name: 'data_fim', required: false, type: String })
  @ApiQuery({ name: 'responsavel_id', required: false, type: Number })
  @ApiQuery({
    name: 'status_visualizacao',
    required: false,
    enum: STATUS_VISUALIZACAO,
  })
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindNegociosQueryDto,
  ) {
    const negocios = await this.negociosService.findAll(query);
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
    return this.negociosService.resumo(ehAdmin(user), query);
  }

  @ApiOperation({
    summary: 'Minhas pesagens',
    description:
      'Negócios "Publico" em que o usuário autenticado é o responsável (data mais recente ' +
      'primeiro), na visão reduzida: sem comprador, valores nem comissão.',
  })
  @Get('minhas-pesagens')
  minhasPesagens(@CurrentUser() user: AuthenticatedUser) {
    return this.negociosService.minhasPesagens(user);
  }

  @ApiOperation({
    summary: 'Negócio para a pesagem (visão reduzida)',
    description:
      'Lotes (sem preço) e cabeças lançadas (peso e horário). Admin acessa qualquer ' +
      'negócio da empresa; Normal só o "Publico" sob sua responsabilidade (senão 404).',
  })
  @Get(':id/pesagem')
  pesagem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.negociosService.pesagem(id, user);
  }

  @Roles('Admin')
  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return apresentar(await this.negociosService.findOne(id), user);
  }

  @Roles('Admin')
  @ApiOperation({
    description:
      'responsavel_id e status_visualizacao são independentes: trocar um não altera o outro.',
  })
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

  // Chamado pelo botão "Concluir" da pesagem: registra hora_fim_pesagem (hora local do
  // cliente). O Normal conclui os negócios liberados para ele e recebe só os horários.
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
      user,
      fuso,
      dto.hora_fim_pesagem,
    );
    if (!negocio) return negocio;
    return ehAdmin(user)
      ? apresentar(negocio, user)
      : conclusaoParaNormal(negocio);
  }

  // Exclusão de negócios é uma ação sensível: restrita a nivel_acesso "Admin".
  @Roles('Admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.remove(id);
  }
}
