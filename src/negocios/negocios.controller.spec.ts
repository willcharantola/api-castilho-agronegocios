import { comCompradorUnificado } from './comprador.util';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { NegociosController } from './negocios.controller';
import { NegociosService } from './negocios.service';

const usuario = (nivel_acesso: string): AuthenticatedUser => ({
  id: 1,
  empresa_id: 1,
  email: 'x@x.com',
  nivel_acesso,
});
const ADMIN = usuario('Admin');
const NORMAL = usuario('Normal');

const NEGOCIO = {
  negocio_id: 7,
  tipo_gado: 'Gordo',
  modalidade: 'arroba',
  comissao: 50,
  porcentagem_comissao: 5,
};
// Sem as relações do comprador carregadas, `comprador` sai null (ver comCompradorUnificado).
const NEGOCIO_ADMIN = {
  ...NEGOCIO,
  modo_comissao: 'por_arroba',
  comprador: null,
};

function criarController() {
  const service = {
    create: jest.fn().mockResolvedValue({ ...NEGOCIO }),
    findAll: jest.fn().mockResolvedValue([{ ...NEGOCIO }, { ...NEGOCIO }]),
    findOne: jest.fn().mockResolvedValue({ ...NEGOCIO, lotes: [] }),
    update: jest.fn().mockResolvedValue({ ...NEGOCIO }),
    concluir: jest.fn().mockResolvedValue({ ...NEGOCIO }),
    resumo: jest.fn().mockResolvedValue({}),
  };
  return {
    controller: new NegociosController(service as unknown as NegociosService),
    service,
  };
}

describe('NegociosController — comissão por perfil', () => {
  // As rotas de negócio completo são @Roles('Admin'); a filtragem da comissão continua como
  // segunda barreira caso uma delas volte a ser liberada.
  it('sem perfil Admin a comissão sai null na listagem, detalhe, criação e edição', async () => {
    const { controller } = criarController();
    const respostas = [
      ...(await controller.findAll(NORMAL, {})),
      await controller.findOne(NORMAL, 7),
      await controller.create(NORMAL, {} as CreateNegocioDto),
      await controller.update(NORMAL, 7, {}),
    ];
    for (const resposta of respostas) {
      expect(resposta).toMatchObject({
        comissao: null,
        porcentagem_comissao: null,
        modo_comissao: null,
      });
    }
  });

  it('Admin recebe a comissão', async () => {
    const { controller } = criarController();
    expect(await controller.findOne(ADMIN, 7)).toMatchObject({
      comissao: 50,
      porcentagem_comissao: 5,
      modo_comissao: 'por_arroba',
    });
    expect(await controller.findAll(ADMIN, {})).toEqual([
      NEGOCIO_ADMIN,
      NEGOCIO_ADMIN,
    ]);
  });

  it('comissão enviada por Normal é ignorada na criação e na edição', async () => {
    const { controller, service } = criarController();
    await controller.create(NORMAL, {
      observacao: 'a',
      porcentagem_comissao: 5,
    } as CreateNegocioDto);
    await controller.update(NORMAL, 7, { porcentagem_comissao: 9 });
    expect(service.create).toHaveBeenCalledWith({ observacao: 'a' }, NORMAL.id);
    expect(service.update).toHaveBeenCalledWith(7, {});
  });

  it('comissão enviada por Admin é repassada', async () => {
    const { controller, service } = criarController();
    await controller.update(ADMIN, 7, { porcentagem_comissao: 9 });
    expect(service.update).toHaveBeenCalledWith(7, {
      porcentagem_comissao: 9,
    });
  });

  it('resumo informa ao serviço se o usuário pode ver as métricas', async () => {
    const { controller, service } = criarController();
    await controller.resumo(NORMAL, {});
    await controller.resumo(ADMIN, { data_inicio: '2026-11-01' });
    expect(service.resumo).toHaveBeenNthCalledWith(1, false, {});
    expect(service.resumo).toHaveBeenNthCalledWith(2, true, {
      data_inicio: '2026-11-01',
    });
  });

  it('conclusão pelo Normal devolve só os horários da pesagem', async () => {
    const { controller, service } = criarController();
    service.concluir.mockResolvedValueOnce({
      ...NEGOCIO,
      valor_total_bruto: 1000,
      hora_inicio_pesagem: 'inicio',
      hora_fim_pesagem: 'fim',
    });
    await expect(controller.concluir(NORMAL, 7, {})).resolves.toEqual({
      negocio_id: 7,
      hora_inicio_pesagem: 'inicio',
      hora_fim_pesagem: 'fim',
    });
    expect(service.concluir).toHaveBeenCalledWith(
      7,
      NORMAL,
      undefined,
      undefined,
    );
  });

  it('responsável sai com id e nome completo', async () => {
    const { controller, service } = criarController();
    service.findOne.mockResolvedValueOnce({
      ...NEGOCIO,
      responsavel: { usuario_id: 4, nome: 'Juliana', sobrenome: 'Souza' },
    });
    expect(await controller.findOne(ADMIN, 7)).toMatchObject({
      responsavel: { usuario_id: 4, nome: 'Juliana Souza' },
    });
  });
});

describe('comCompradorUnificado', () => {
  it('frigorífico e pecuarista saem no mesmo formato, sem as relações gravadas', () => {
    const frigorifico = comCompradorUnificado({
      negocio_id: 1,
      comprador: {
        comprador_id: 3,
        nome_empresa: 'Frigorífico X',
        cnpj: '11.222.333/0001-81',
        municipio: 'Campo Grande',
        inscricao_estadual: '28.123.456-7',
      },
      comprador_pecuarista: null,
    });
    expect(frigorifico).toEqual({
      negocio_id: 1,
      comprador: {
        tipo: 'frigorifico',
        id: 3,
        nome: 'Frigorífico X',
        documento: '11.222.333/0001-81',
        municipio: 'Campo Grande',
        inscricao_estadual: '28.123.456-7',
      },
    });

    const pecuarista = comCompradorUnificado({
      negocio_id: 2,
      comprador: null,
      comprador_pecuarista: {
        pecuarista_id: 8,
        nome_pecuarista: 'José',
        cpf_cnpj: '000.000.000-00',
        pecuarista_fazenda: [{ fazenda: { municipio: 'Dourados' } }],
      },
    });
    expect(pecuarista.comprador).toEqual({
      tipo: 'pecuarista',
      id: 8,
      nome: 'José',
      documento: '000.000.000-00',
      municipio: 'Dourados',
      inscricao_estadual: null,
    });
    expect(pecuarista).not.toHaveProperty('comprador_pecuarista');
  });
});
