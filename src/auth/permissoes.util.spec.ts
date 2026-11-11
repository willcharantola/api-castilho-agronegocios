import {
  ehAdmin,
  ocultarCamposDeComissao,
  podeAcessarNegocio,
  semCamposDeComissao,
} from './permissoes.util';

const ADMIN = { nivel_acesso: 'Admin' };
const NORMAL = { nivel_acesso: 'Normal' };

const negocio = () => ({
  negocio_id: 1,
  valor_total_bruto: 1000,
  comissao: 50,
  porcentagem_comissao: 5,
});

describe('ehAdmin', () => {
  it('só o perfil Admin é admin', () => {
    expect(ehAdmin(ADMIN)).toBe(true);
    expect(ehAdmin(NORMAL)).toBe(false);
    expect(ehAdmin({ nivel_acesso: 'admin' })).toBe(false);
  });
});

describe('ocultarCamposDeComissao', () => {
  it('Admin recebe a comissão como está', () => {
    expect(ocultarCamposDeComissao(negocio(), ADMIN)).toEqual(negocio());
  });

  it('Normal recebe comissão e percentual null, com os campos presentes', () => {
    const resposta = ocultarCamposDeComissao(negocio(), NORMAL);
    expect(resposta).toEqual({
      negocio_id: 1,
      valor_total_bruto: 1000,
      comissao: null,
      porcentagem_comissao: null,
    });
    expect(resposta).toHaveProperty('comissao');
    expect(resposta).toHaveProperty('porcentagem_comissao');
  });

  it('oculta em todas as linhas de uma lista', () => {
    const lista = ocultarCamposDeComissao([negocio(), negocio()], NORMAL);
    expect(lista).toHaveLength(2);
    for (const item of lista) {
      expect(item.comissao).toBeNull();
      expect(item.porcentagem_comissao).toBeNull();
    }
  });

  it('não altera o objeto original', () => {
    const original = negocio();
    ocultarCamposDeComissao(original, NORMAL);
    expect(original.comissao).toBe(50);
  });
});

describe('semCamposDeComissao', () => {
  const dto = { observacao: 'x', porcentagem_comissao: 5, comissao: 10 };

  it('Admin envia a comissão normalmente', () => {
    expect(semCamposDeComissao(dto, ADMIN)).toEqual(dto);
  });

  it('Normal tem a comissão removida (o valor gravado é preservado)', () => {
    const limpo = semCamposDeComissao(dto, NORMAL);
    expect(limpo).toEqual({ observacao: 'x' });
    expect('porcentagem_comissao' in limpo).toBe(false);
    expect(dto.porcentagem_comissao).toBe(5);
  });
});

describe('podeAcessarNegocio', () => {
  const usuario = (id: number, nivel_acesso: string, empresa_id = 1) => ({
    id,
    empresa_id,
    nivel_acesso,
  });
  const negocioDe = (responsavel_id: number, status_visualizacao: string) => ({
    empresa_id: 1,
    responsavel_id,
    status_visualizacao,
  });

  it('Admin acessa qualquer negócio da empresa, Publico ou Privado', () => {
    const admin = usuario(1, 'Admin');
    expect(podeAcessarNegocio(admin, negocioDe(9, 'Privado'))).toBe(true);
    expect(podeAcessarNegocio(admin, negocioDe(9, 'Publico'))).toBe(true);
  });

  it('ninguém acessa negócio de outra empresa', () => {
    expect(
      podeAcessarNegocio(usuario(1, 'Admin', 2), negocioDe(1, 'Publico')),
    ).toBe(false);
    expect(
      podeAcessarNegocio(usuario(5, 'Normal', 2), negocioDe(5, 'Publico')),
    ).toBe(false);
  });

  it('Normal acessa só o Publico em que é o responsável', () => {
    const normal = usuario(5, 'Normal');
    expect(podeAcessarNegocio(normal, negocioDe(5, 'Publico'))).toBe(true);
    expect(podeAcessarNegocio(normal, negocioDe(5, 'Privado'))).toBe(false);
    expect(podeAcessarNegocio(normal, negocioDe(6, 'Publico'))).toBe(false);
  });
});
