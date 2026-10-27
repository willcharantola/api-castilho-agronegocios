import { ValidationPipe } from '@nestjs/common';
import { CreateGadoDto } from '../gados/dto/create-gado.dto';
import { UpdateGadoDto } from '../gados/dto/update-gado.dto';
import { CreateNegocioDto } from '../negocios/dto/create-negocio.dto';
import { CreatePecuaristaDto } from '../pecuaristas/dto/create-pecuarista.dto';

// Mesma configuração do main.ts: campos fora do DTO geram 400.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const validar = (metatype: new () => object, value: object) =>
  pipe.transform(value, { type: 'body', metatype });

const GADO = {
  negocio_id: 1,
  peso_total: 480,
  data_pesagem: '2026-10-26T00:00:00.000Z',
  genero: 'Macho',
  denominacao: 'Nelore',
  ano_carimbo: '2024',
};

const NEGOCIO = {
  empresa_id: 1,
  fazenda_id: 1,
  pecuarista_id: 1,
  comprador_id: 1,
  modalidade: 'arroba',
  tipo_gado: 'Gordo',
  tipo_lote: 'Boi',
  tipo_negocio: 'Funrural',
  media_carimbo: '08/23',
  data_negocio: '2026-10-26T00:00:00.000Z',
  valor_unidade: 300,
  porcentagem_rendimento_nelore: 52.5,
  porcentagem_rendimento_anelorado: 51,
  porcentagem_rendimento_angus: 55,
  porcentagem_rendimento_composto: 53,
};

const PECUARISTA = {
  nome_pecuarista: 'João',
  fisico_juridico: 'fisico',
  cpf_cnpj: '000.000.000-00',
  banco: 'BB',
  agencia: '1234-5',
  conta: '12345-6',
  chave_pix: 'joao@x.com',
};

describe('DTOs do novo modelo de dados', () => {
  describe('gado', () => {
    it('aceita o formato novo', async () => {
      await expect(validar(CreateGadoDto, GADO)).resolves.toBeDefined();
    });

    it.each([['rendimento_carcaca', 50], ['carimbo', 8]])(
      'recusa o campo antigo %s',
      async (campo, valor) => {
        await expect(
          validar(CreateGadoDto, { ...GADO, [campo]: valor }),
        ).rejects.toThrow();
        await expect(
          validar(UpdateGadoDto, { [campo]: valor }),
        ).rejects.toThrow();
      },
    );

    it('denominacao só aceita as quatro categorias', async () => {
      await expect(
        validar(CreateGadoDto, { ...GADO, denominacao: 'Cruzado' }),
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

    it('exige tipo_negocio e media_carimbo', async () => {
      const { tipo_negocio: _t, ...semTipo } = NEGOCIO;
      const { media_carimbo: _m, ...semCarimbo } = NEGOCIO;
      await expect(validar(CreateNegocioDto, semTipo)).rejects.toThrow();
      await expect(validar(CreateNegocioDto, semCarimbo)).rejects.toThrow();
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, tipo_negocio: 'livre' }),
      ).rejects.toThrow();
    });

    it('media_carimbo é texto livre, limitado ao tamanho da coluna', async () => {
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, media_carimbo: '8,9 e 10' }),
      ).resolves.toBeDefined();
      await expect(
        validar(CreateNegocioDto, { ...NEGOCIO, media_carimbo: 'x'.repeat(31) }),
      ).rejects.toThrow();
    });

    it('percentuais entre 0 e 100 com até 2 casas', async () => {
      await expect(
        validar(CreateNegocioDto, {
          ...NEGOCIO,
          porcentagem_rendimento_angus: 100.5,
        }),
      ).rejects.toThrow();
      await expect(
        validar(CreateNegocioDto, {
          ...NEGOCIO,
          porcentagem_rendimento_angus: 52.555,
        }),
      ).rejects.toThrow();
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
