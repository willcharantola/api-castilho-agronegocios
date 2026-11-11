import {
  conclusaoParaNormal,
  gadoParaNormal,
  itemMinhasPesagens,
  negocioParaPesagem,
} from './pesagem.util';

// Campos que nunca podem chegar ao usuário Normal.
const RESTRITOS = [
  'comprador',
  'comprador_id',
  'comprador_pecuarista_id',
  'valor_total_bruto',
  'valor_total_liquido',
  'valor_medio',
  'valor_unidade',
  'valor_total',
  'valor_total_lote',
  'porcentagem_comissao',
  'comissao',
  'funrural',
  'senar',
  'aliquota_funrural',
  'aliquota_senar',
  'observacao',
  'cpf_cnpj',
  'banco',
  'agencia',
  'conta',
  'chave_pix',
  'responsavel',
  'responsavel_id',
  'status_visualizacao',
];

/** Chaves de um objeto, em qualquer profundidade. */
function chaves(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(chaves);
  if (valor === null || typeof valor !== 'object' || valor instanceof Date) {
    return [];
  }
  return Object.entries(valor).flatMap(([k, v]) => [k, ...chaves(v)]);
}

// Registro "gravado" com tudo o que o banco tem: se a seleção do Prisma vazar um campo a
// mais, a whitelist ainda o descarta.
const GADO = {
  gado_id: 1,
  lote_id: 2,
  peso_total: 500,
  peso_calculo: 265,
  valor_total: 5300,
  data_pesagem: new Date('2026-11-10'),
  horario_pesagem: new Date('1970-01-01T08:00:00Z'),
  uuid_origem: null,
};
const NEGOCIO = {
  negocio_id: 7,
  data_negocio: new Date('2026-11-10'),
  modalidade: 'arroba',
  tipo_gado: 'Gordo',
  qtd_animais: 1,
  hora_inicio_pesagem: null,
  hora_fim_pesagem: null,
  valor_total_bruto: 5300,
  comissao: 100,
  porcentagem_comissao: 2,
  funrural: 79.5,
  senar: 10.6,
  observacao: 'segredo',
  responsavel_id: 5,
  status_visualizacao: 'Publico',
  comprador: { nome_empresa: 'Frigorífico X', cnpj: '11.222.333/0001-81' },
  fazenda: { nome_fazenda: 'Paturi', cnpj: '1', inscricao_estadual: '2' },
  pecuarista: { nome_pecuarista: 'João', cpf_cnpj: '529.982.247-25' },
  lotes: [
    {
      lote_id: 2,
      nome_lote: 'Bois',
      tipo_lote: 'Boi',
      genero: 'Macho',
      rendimento_carcaca: 53,
      qtd_animais: 1,
      valor_unidade: 300,
      valor_total_lote: 5300,
      gados: [GADO],
      _count: { gados: 1 },
    },
  ],
};

describe('visão reduzida do usuário Normal (whitelist)', () => {
  it('tela de pesagem: lotes e pesos, sem dado restrito', () => {
    const pesagem = negocioParaPesagem(
      NEGOCIO as unknown as Parameters<typeof negocioParaPesagem>[0],
    );
    expect(chaves(pesagem).filter((c) => RESTRITOS.includes(c))).toEqual([]);
    expect(pesagem).toMatchObject({
      negocio_id: 7,
      nome_fazenda: 'Paturi',
      nome_pecuarista: 'João',
      lotes: [
        {
          lote_id: 2,
          nome_lote: 'Bois',
          qtd_gados: 1,
          gados: [{ gado_id: 1, peso_total: 500 }],
        },
      ],
    });
  });

  it('item de "Minhas pesagens": total de cabeças pesadas, sem dado restrito', () => {
    const item = itemMinhasPesagens(
      NEGOCIO as unknown as Parameters<typeof itemMinhasPesagens>[0],
    );
    expect(chaves(item).filter((c) => RESTRITOS.includes(c))).toEqual([]);
    expect(item).toMatchObject({ negocio_id: 7, gados_pesados: 1 });
  });

  it('cabeça e conclusão sem valores', () => {
    const gado = gadoParaNormal(
      GADO as unknown as Parameters<typeof gadoParaNormal>[0],
    );
    expect(chaves(gado)).not.toContain('valor_total');
    expect(chaves(gado)).not.toContain('peso_calculo');
    expect(chaves(conclusaoParaNormal(NEGOCIO))).toEqual([
      'negocio_id',
      'hora_inicio_pesagem',
      'hora_fim_pesagem',
    ]);
  });
});
