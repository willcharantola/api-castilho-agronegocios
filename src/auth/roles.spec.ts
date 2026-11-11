import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompradoresController } from '../compradores/compradores.controller';
import { ConfiguracoesController } from '../configuracoes/configuracoes.controller';
import { EmpresasController } from '../empresas/empresas.controller';
import { FazendasController } from '../fazendas/fazendas.controller';
import { GadosController } from '../gados/gados.controller';
import { LotesController } from '../lotes/lotes.controller';
import { NegociosController } from '../negocios/negocios.controller';
import { PecuaristasController } from '../pecuaristas/pecuaristas.controller';
import { TiposGadoController } from '../tipos-gado/tipos-gado.controller';
import { UploadsController } from '../uploads/uploads.controller';
import { UsuariosController } from '../usuarios/usuarios.controller';
import { RolesGuard } from './guards/roles.guard';

type Classe = abstract new (...args: never[]) => unknown;

/** Contexto mínimo para o RolesGuard: a rota (classe + método) e o usuário do JWT. */
function contexto(
  classe: Classe,
  metodo: string,
  nivel_acesso: string,
): ExecutionContext {
  return {
    getClass: () => classe,
    getHandler: () => (classe.prototype as Record<string, unknown>)[metodo],
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 1, empresa_id: 1, nivel_acesso } }),
    }),
  } as unknown as ExecutionContext;
}

const guard = new RolesGuard(new Reflector());
const permite = (classe: Classe, metodo: string, nivel: string) =>
  guard.canActivate(contexto(classe, metodo, nivel));

describe('@Roles — usuários', () => {
  const rotas = [
    'create',
    'findAll',
    'responsaveis',
    'findOne',
    'update',
    'remove',
  ];

  it.each(rotas)('%s é recusada (403) para Normal', (rota) => {
    expect(permite(UsuariosController, rota, 'Normal')).toBe(false);
  });

  it.each(rotas)('%s é permitida para Admin', (rota) => {
    expect(permite(UsuariosController, rota, 'Admin')).toBe(true);
  });

  it('cobre todos os métodos do controller', () => {
    const metodos = Object.getOwnPropertyNames(
      UsuariosController.prototype,
    ).filter((m) => m !== 'constructor');
    expect(metodos.sort()).toEqual([...rotas].sort());
  });
});

describe('@Roles — impostos e taxas', () => {
  it('GET é liberado para qualquer perfil', () => {
    expect(permite(ConfiguracoesController, 'findImpostos', 'Normal')).toBe(
      true,
    );
    expect(permite(ConfiguracoesController, 'findImpostos', 'Admin')).toBe(
      true,
    );
  });

  it('PATCH só para Admin', () => {
    expect(permite(ConfiguracoesController, 'updateImpostos', 'Normal')).toBe(
      false,
    );
    expect(permite(ConfiguracoesController, 'updateImpostos', 'Admin')).toBe(
      true,
    );
  });
});

describe('@Roles — dados da empresa', () => {
  it('GET é liberado para qualquer perfil', () => {
    expect(permite(ConfiguracoesController, 'findDadosEmpresa', 'Normal')).toBe(
      true,
    );
    expect(permite(ConfiguracoesController, 'findDadosEmpresa', 'Admin')).toBe(
      true,
    );
  });

  it('PATCH só para Admin', () => {
    expect(
      permite(ConfiguracoesController, 'updateDadosEmpresa', 'Normal'),
    ).toBe(false);
    expect(
      permite(ConfiguracoesController, 'updateDadosEmpresa', 'Admin'),
    ).toBe(true);
  });

  it.each(['create', 'update', 'remove'])(
    '/empresas %s é recusada para Normal',
    (rota) => {
      expect(permite(EmpresasController, rota, 'Normal')).toBe(false);
      expect(permite(EmpresasController, rota, 'Admin')).toBe(true);
    },
  );
});

/** Métodos de rota declarados no controller. */
const metodosDe = (classe: Classe) =>
  Object.getOwnPropertyNames(classe.prototype).filter(
    (m) => m !== 'constructor',
  );

describe('@Roles — negócios', () => {
  const somenteAdmin = ['create', 'findAll', 'findOne', 'update', 'remove'];
  // Rotas de pesagem: a regra por negócio (podeAcessarNegocio) fica no serviço.
  const liberadas = ['resumo', 'minhasPesagens', 'pesagem', 'concluir'];

  it.each(somenteAdmin)('%s é recusada (403) para Normal', (rota) => {
    expect(permite(NegociosController, rota, 'Normal')).toBe(false);
    expect(permite(NegociosController, rota, 'Admin')).toBe(true);
  });

  it.each(liberadas)('%s é liberada para Normal', (rota) => {
    expect(permite(NegociosController, rota, 'Normal')).toBe(true);
  });

  it('cobre todos os métodos do controller', () => {
    expect(metodosDe(NegociosController).sort()).toEqual(
      [...somenteAdmin, ...liberadas].sort(),
    );
  });
});

describe('@Roles — gados', () => {
  it('Normal só lança pesagem (POST)', () => {
    expect(permite(GadosController, 'create', 'Normal')).toBe(true);
    for (const rota of ['findAll', 'findOne', 'update', 'remove']) {
      expect(permite(GadosController, rota, 'Normal')).toBe(false);
      expect(permite(GadosController, rota, 'Admin')).toBe(true);
    }
  });
});

describe('@Roles — cadastros (somente Admin)', () => {
  const controllers: [string, Classe][] = [
    ['lotes', LotesController],
    ['compradores', CompradoresController],
    ['pecuaristas', PecuaristasController],
    ['fazendas', FazendasController],
    ['tipos-gado', TiposGadoController],
    ['uploads', UploadsController],
  ];

  it.each(controllers)(
    '/%s: todas as rotas recusadas (403) para Normal',
    (_nome, classe) => {
      for (const rota of metodosDe(classe)) {
        expect(permite(classe, rota, 'Normal')).toBe(false);
        expect(permite(classe, rota, 'Admin')).toBe(true);
      }
    },
  );
});
