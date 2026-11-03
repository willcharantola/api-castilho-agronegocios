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
const NEGOCIO_ADMIN = { ...NEGOCIO, modo_comissao: 'por_arroba' };

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
  it('Normal recebe comissão null na listagem, detalhe, criação, edição e conclusão', async () => {
    const { controller } = criarController();
    const respostas = [
      ...(await controller.findAll(NORMAL, {})),
      await controller.findOne(NORMAL, 7),
      await controller.create(NORMAL, {} as CreateNegocioDto),
      await controller.update(NORMAL, 7, {}),
      await controller.concluir(NORMAL, 7, {}),
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
    expect(service.create).toHaveBeenCalledWith({ observacao: 'a' });
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
    expect(service.resumo).toHaveBeenNthCalledWith(
      1,
      false,
      undefined,
      undefined,
      undefined,
    );
    expect(service.resumo).toHaveBeenNthCalledWith(
      2,
      true,
      undefined,
      '2026-11-01',
      undefined,
    );
  });
});
