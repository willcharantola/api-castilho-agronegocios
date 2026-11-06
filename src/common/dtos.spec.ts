import { ValidationPipe } from '@nestjs/common';
import { CreateGadoDto } from '../gados/dto/create-gado.dto';
import { UpdateGadoDto } from '../gados/dto/update-gado.dto';
import { CreateFazendaDto } from '../fazendas/dto/create-fazenda.dto';
import { CreateLoteDto } from '../lotes/dto/create-lote.dto';
import { UpdateNegocioDto } from '../negocios/dto/update-negocio.dto';
import { CreateNegocioDto } from '../negocios/dto/create-negocio.dto';
import { CreateCompradorDto } from '../compradores/dto/create-comprador.dto';
import { CreatePecuaristaDto } from '../pecuaristas/dto/create-pecuarista.dto';
import { UpdatePecuaristaDto } from '../pecuaristas/dto/update-pecuarista.dto';

// Mesma configuração do main.ts: campos fora do DTO geram 400.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const validar = (metatype: new () => object, value: object) =>
  pipe.transform(value, { type: 'body', metatype });

const GADO = {
  lote_id: 1,
  peso_total: 480,
  data_pesagem: '2026-10-26T00:00:00.000Z',
};

const LOTE = {
  nome_lote: 'Bois Nelore',
  valor_unidade: 310,
  tipo_lote: 'Boi',
  genero: 'Macho',
  rendimento_carcaca: 53.5,
  media_carimbo: '08/23',
  ano_carimbo: '2023',
};

const FAZENDA = {
  nome_fazenda: 'Paturi',
  municipio: 'Jatei/MS',
  inscricao_estadual: '28.766.688-3',
};

const NEGOCIO = {
  empresa_id: 1,
  fazenda_id: 1,
  pecuarista_id: 1,
  comprador: { tipo: 'frigorifico', id: 1 },
  modalidade: 'arroba',
  tipo_gado: 'Gordo',
  tipo_negocio: 'Funrural',
  data_negocio: '2026-10-26T00:00:00.000Z',
};

const PECUARISTA = {
  nome_pecuarista: 'João',
  fisico_juridico: 'fisico',
  cpf_cnpj: '529.982.247-25',
  banco: 'BB',
  agencia: '1234-5',
  conta: '12345-6',
  chave_pix: 'joao@x.com',
};

describe('DTOs do novo modelo de dados', () => {
  describe('gado', () => {
    it('aceita lote + peso', async () => {
      await expect(validar(CreateGadoDto, GADO)).resolves.toBeDefined();
      const { data_pesagem: _d, ...semData } = GADO;
      await expect(validar(CreateGadoDto, semData)).resolves.toBeDefined();
    });

    it.each([
      ['negocio_id', 1],
      ['genero', 'Macho'],
      ['denominacao', 'Nelore'],
      ['ano_carimbo', '2024'],
      ['rendimento_carcaca', 50],
      ['carimbo', 8],
    ])('recusa o campo antigo %s', async (campo, valor) => {
      await expect(
        validar(CreateGadoDto, { ...GADO, [campo]: valor }),
      ).rejects.toThrow();
      await expect(validar(UpdateGadoDto, { [campo]: valor })).rejects.toThrow();
    });

    it('exige o lote', async () => {
      const { lote_id: _l, ...semLote } = GADO;
      await expect(validar(CreateGadoDto, semLote)).rejects.toThrow();
    });
  });

  describe('lote', () => {
    it('aceita o formato completo', async () => {
      await expect(validar(CreateLoteDto, LOTE)).resolves.toBeDefined();
    });

    it.each([
      ['tipo_lote', 'Touro'],
      ['genero', 'Fêmea'],
      ['rendimento_carcaca', 100.5],
      ['rendimento_carcaca', 52.555],
      ['ano_carimbo', '23'],
      ['nome_lote', 'x'.repeat(31)],
      ['media_carimbo', 'x'.repeat(31)],
      ['qtd_animais', 0],
      ['valor_total_lote', 100],
      ['valor_unidade', -1],
      ['valor_unidade', 310.555],
      ['valor_unidade', '310'],
    ])('recusa %s = %p', async (campo, valor) => {
      await expect(
        validar(CreateLoteDto, { ...LOTE, [campo]: valor }),
      ).rejects.toThrow();
    });

    it('carimbo e ano são opcionais; vazio vira null', async () => {
      const { media_carimbo: _m, ano_carimbo: _a, ...semCarimbo } = LOTE;
      await expect(validar(CreateLoteDto, semCarimbo)).resolves.toBeDefined();
      await expect(
        validar(CreateLoteDto, { ...LOTE, media_carimbo: '', ano_carimbo: ' ' }),
      ).resolves.toMatchObject({ media_carimbo: null, ano_carimbo: null });
      await expect(
        validar(CreateLoteDto, { ...LOTE, media_carimbo: null, ano_carimbo: null }),
      ).resolves.toBeDefined();
    });

    it('media_carimbo é texto livre', async () => {
      await expect(
        validar(CreateLoteDto, { ...LOTE, media_carimbo: '8,9 e 10' }),
      ).resolves.toBeDefined();
    });
  });

  describe('documentos: CPF, CNPJ e inscrição estadual', () => {
    it.each([
      ['fisico', '52998224725', '529.982.247-25'],
      ['fisico', '529.982.247-25', '529.982.247-25'],
      ['juridico', '11222333000181', '11.222.333/0001-81'],
    ])('pecuarista %s aceita %s e grava %s', async (fisico_juridico, cpf_cnpj, gravado) => {
      await expect(
        validar(CreatePecuaristaDto, {
          ...PECUARISTA,
          fisico_juridico,
          cpf_cnpj,
          fazendas: [{ fazenda_id: 1 }],
        }),
      ).resolves.toMatchObject({ cpf_cnpj: gravado });
    });

    it.each([
      ['fisico', '529.982.247-26'],
      ['fisico', '111.111.111-11'],
      ['fisico', '11.222.333/0001-81'],
      ['juridico', '529.982.247-25'],
      ['juridico', '61.784.229/004-00'],
      ['fisico', ''],
    ])('pecuarista %s recusa %p', async (fisico_juridico, cpf_cnpj) => {
      await expect(
        validar(CreatePecuaristaDto, {
          ...PECUARISTA,
          fisico_juridico,
          cpf_cnpj,
          fazendas: [{ fazenda_id: 1 }],
        }),
      ).rejects.toThrow();
    });

    it('PATCH só com o documento aceita CPF ou CNPJ válido', async () => {
      await expect(
        validar(UpdatePecuaristaDto, { cpf_cnpj: '11222333000181' }),
      ).resolves.toMatchObject({ cpf_cnpj: '11.222.333/0001-81' });
      await expect(
        validar(UpdatePecuaristaDto, { cpf_cnpj: '123' }),
      ).rejects.toThrow();
    });

    it('frigorífico exige CNPJ válido', async () => {
      const COMPRADOR = {
        nome_empresa: 'Frigorífico X',
        municipio: 'Campo Grande',
        inscricao_estadual: '28.123.456-7',
      };
      await expect(
        validar(CreateCompradorDto, { ...COMPRADOR, cnpj: '11222333000181' }),
      ).resolves.toMatchObject({ cnpj: '11.222.333/0001-81' });
      await expect(
        validar(CreateCompradorDto, { ...COMPRADOR, cnpj: '11.222.333/0001-82' }),
      ).rejects.toThrow();
    });

    it('frigorífico exige inscrição estadual (até 12) e recusa pessoa de contato', async () => {
      const COMPRADOR = {
        nome_empresa: 'Frigorífico X',
        cnpj: '11.222.333/0001-81',
        municipio: 'Campo Grande',
      };
      await expect(
        validar(CreateCompradorDto, { ...COMPRADOR, inscricao_estadual: ' ISENTO ' }),
      ).resolves.toMatchObject({ inscricao_estadual: 'ISENTO' });
      for (const inscricao_estadual of [undefined, '   ', '1234567890123']) {
        await expect(
          validar(CreateCompradorDto, { ...COMPRADOR, inscricao_estadual }),
        ).rejects.toThrow();
      }
      await expect(
        validar(CreateCompradorDto, {
          ...COMPRADOR,
          inscricao_estadual: '28.123.456-7',
          pessoa_contato: 'Fulano',
        }),
      ).rejects.toThrow();
    });

    it.each([
      ['28.766.688-3', '28.766.688-3'],
      ['287666883', '28.766.688-3'],
    ])('inscrição estadual aceita %s e grava %s', async (inscricao_estadual, gravado) => {
      await expect(
        validar(CreateFazendaDto, { ...FAZENDA, inscricao_estadual }),
      ).resolves.toMatchObject({ inscricao_estadual: gravado });
    });

    it.each(['28766688', '28.766.688-34', 'ABC', '28-766-688.3'])(
      'inscrição estadual recusa %s',
      async (inscricao_estadual) => {
        await expect(
          validar(CreateFazendaDto, { ...FAZENDA, inscricao_estadual }),
        ).rejects.toThrow();
      },
    );

    it('fazenda nova dentro do pecuarista aceita CNPJ e valida a inscrição', async () => {
      const fazenda = { nome_fazenda: 'Paturi', municipio: 'Jatei/MS' };
      await expect(
        validar(CreatePecuaristaDto, {
          ...PECUARISTA,
          fazendas: [{ ...fazenda, inscricao_estadual: '287666883', cnpj: '11222333000181' }],
        }),
      ).resolves.toMatchObject({
        fazendas: [{ inscricao_estadual: '28.766.688-3', cnpj: '11.222.333/0001-81' }],
      });
      await expect(
        validar(CreatePecuaristaDto, {
          ...PECUARISTA,
          fazendas: [{ ...fazenda, inscricao_estadual: '123' }],
        }),
      ).rejects.toThrow();
    });
  });

  describe('fazenda: CNPJ', () => {
    it('é opcional; vazio vira null', async () => {
      await expect(validar(CreateFazendaDto, FAZENDA)).resolves.toBeDefined();
      await expect(
        validar(CreateFazendaDto, { ...FAZENDA, cnpj: '' }),
      ).resolves.toMatchObject({ cnpj: null });
    });

    it.each(['11.222.333/0001-81', '11222333000181'])(
      'aceita %s e grava formatado',
      async (cnpj) => {
        await expect(
          validar(CreateFazendaDto, { ...FAZENDA, cnpj }),
        ).resolves.toMatchObject({ cnpj: '11.222.333/0001-81' });
      },
    );

    it.each(['11.222.333/0001-82', '1122233300018', '11.111.111/1111-11', 'abc'])(
      'recusa %s',
      async (cnpj) => {
        await expect(
          validar(CreateFazendaDto, { ...FAZENDA, cnpj }),
        ).rejects.toThrow();
      },
    );
  });

  describe('fazenda: localização', () => {
    it.each([
      '-20.7123,-51.6543',
      '-20.7123, -51.6543',
      'https://www.google.com/maps/place/-20.71,-51.65',
      'https://google.com/maps?q=1,2',
      'https://maps.google.com/?q=-20.7,-51.6',
      'https://maps.app.goo.gl/AbCdEf123',
      'https://goo.gl/maps/AbCdEf123',
    ])('aceita %s', async (localizacao_google) => {
      await expect(
        validar(CreateFazendaDto, { ...FAZENDA, localizacao_google }),
      ).resolves.toBeDefined();
    });

    it.each([
      'javascript:alert(1)',
      'data:text/html,oi',
      'http://www.google.com/maps',
      'https://evil.com/maps',
      'https://www.google.com.evil.com/maps',
      'https://www.google.com/search?q=x',
      'https://goo.gl/xyz',
      '91,10',
      '-20.7,-181',
      'Rua das Flores, 10',
    ])('recusa %s', async (localizacao_google) => {
      await expect(
        validar(CreateFazendaDto, { ...FAZENDA, localizacao_google }),
      ).rejects.toThrow();
    });

    it('endereço até 200 caracteres', async () => {
      await expect(
        validar(CreateFazendaDto, { ...FAZENDA, endereco_fazenda: 'Rod. MS-134, km 20' }),
      ).resolves.toBeDefined();
      await expect(
        validar(CreateFazendaDto, { ...FAZENDA, endereco_fazenda: 'x'.repeat(201) }),
      ).rejects.toThrow();
    });
  });

  describe('negócio', () => {
    it('aceita o formato novo', async () => {
      await expect(validar(CreateNegocioDto, NEGOCIO)).resolves.toBeDefined();
    });

    it("recusa tipo_gado 'Magro'", async () => {
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, tipo_gado: 'Magro' }),
      ).rejects.toThrow();
    });

    it('aceita Reposicao', async () => {
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, tipo_gado: 'Reposicao' }),
      ).resolves.toBeDefined();
    });

    it.each(['Desconto em folha', 'Livre', 'Funrural'])(
      'aceita tipo_negocio %s',
      async (tipo_negocio) => {
        await expect(
          validar(CreateNegocioDto, { ...NEGOCIO, tipo_negocio }),
        ).resolves.toBeDefined();
      },
    );

    it('exige tipo_negocio', async () => {
      const { tipo_negocio: _t, ...semTipo } = NEGOCIO;
      await expect(validar(CreateNegocioDto, semTipo)).rejects.toThrow();
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, tipo_negocio: 'livre' }),
      ).rejects.toThrow();
    });

    it.each([
      ['tipo_lote', 'Boi'],
      ['media_carimbo', '08/23'],
      ['porcentagem_rendimento_nelore', 52],
    ])('recusa o campo que passou para o lote: %s', async (campo, valor) => {
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, [campo]: valor }),
      ).rejects.toThrow();
      await expect(
        validar(UpdateNegocioDto, { [campo]: valor }),
      ).rejects.toThrow();
    });

    it('exige o comprador e recusa o valor da unidade (agora é do lote)', async () => {
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, valor_unidade: 310 }),
      ).rejects.toThrow();
      const { comprador: _c, ...semComprador } = NEGOCIO;
      await expect(validar(CreateNegocioDto, semComprador)).rejects.toThrow();
    });

    it.each([
      [{ tipo: 'cliente', id: 1 }],
      [{ tipo: 'pecuarista', id: 0 }],
      [{ tipo: 'frigorifico' }],
    ])('recusa comprador %p', async (comprador) => {
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, comprador }),
      ).rejects.toThrow();
      await expect(validar(UpdateNegocioDto, { comprador })).rejects.toThrow();
    });

    it('recusa o comprador_id antigo', async () => {
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, comprador_id: 1 }),
      ).rejects.toThrow();
    });

    it('PATCH aceita só o comprador', async () => {
      await expect(
        validar(UpdateNegocioDto, { comprador: { tipo: 'pecuarista', id: 2 } }),
      ).resolves.toBeDefined();
    });

    it('PATCH não aceita valor da unidade, quantidade nem valores calculados', async () => {
      for (const campo of ['valor_unidade', 'qtd_animais', 'valor_total_bruto', 'valor_total_liquido']) {
        await expect(validar(UpdateNegocioDto, { [campo]: 3 })).rejects.toThrow();
      }
    });
  });

  describe('pecuarista', () => {
    it('exige pelo menos uma fazenda', async () => {
      await expect(
        validar(CreatePecuaristaDto, { ...PECUARISTA, fazendas: [] }),
      ).rejects.toThrow();
      await expect(validar(CreatePecuaristaDto, PECUARISTA)).rejects.toThrow();
    });

    it('aceita fazenda nova e fazenda existente', async () => {
      await expect(
        validar(CreatePecuaristaDto, {
          ...PECUARISTA,
          fazendas: [
            {
              nome_fazenda: 'Sonho Meu II',
              municipio: 'Três Lagoas',
              inscricao_estadual: '123456789',
            },
            { fazenda_id: 7 },
          ],
        }),
      ).resolves.toBeDefined();
    });

    it('fazenda nova incompleta é recusada', async () => {
      await expect(
        validar(CreatePecuaristaDto, {
          ...PECUARISTA,
          fazendas: [{ nome_fazenda: 'Sem município' }],
        }),
      ).rejects.toThrow();
    });

    it('recusa o campo antigo fazenda_ids', async () => {
      await expect(
        validar(CreatePecuaristaDto, {
          ...PECUARISTA,
          fazendas: [{ fazenda_id: 1 }],
          fazenda_ids: [1],
        }),
      ).rejects.toThrow();
    });
  });
});
