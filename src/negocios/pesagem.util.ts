import { Prisma } from '@prisma/client';

// Visão reduzida do negócio para o usuário Normal (responsável pela pesagem). Tudo aqui é
// WHITELIST: só sai o que está listado. Comprador, valores (R$), comissão, Funrural/Senar,
// observação, documentos, dados bancários, responsável e status nunca entram.

/** Campos do gado que o Normal recebe (peso e horário; sem valores). */
const SELECT_GADO_PESAGEM = {
  gado_id: true,
  lote_id: true,
  peso_total: true,
  data_pesagem: true,
  horario_pesagem: true,
  uuid_origem: true,
} as const satisfies Prisma.gadoSelect;

/** Negócio da listagem "Minhas pesagens". */
export const SELECT_ITEM_PESAGEM = {
  negocio_id: true,
  data_negocio: true,
  modalidade: true,
  tipo_gado: true,
  qtd_animais: true,
  hora_inicio_pesagem: true,
  hora_fim_pesagem: true,
  fazenda: { select: { nome_fazenda: true } },
  pecuarista: { select: { nome_pecuarista: true } },
  lotes: { select: { _count: { select: { gados: true } } } },
} as const satisfies Prisma.negocioSelect;

/** Negócio da tela de pesagem: lotes (sem preço) e as cabeças já lançadas. */
export const SELECT_PESAGEM = {
  negocio_id: true,
  data_negocio: true,
  modalidade: true,
  tipo_gado: true,
  qtd_animais: true,
  hora_inicio_pesagem: true,
  hora_fim_pesagem: true,
  fazenda: { select: { nome_fazenda: true } },
  pecuarista: { select: { nome_pecuarista: true } },
  lotes: {
    orderBy: { lote_id: 'asc' },
    select: {
      lote_id: true,
      nome_lote: true,
      tipo_lote: true,
      genero: true,
      rendimento_carcaca: true,
      qtd_animais: true,
      gados: { orderBy: { gado_id: 'asc' }, select: SELECT_GADO_PESAGEM },
    },
  },
} as const satisfies Prisma.negocioSelect;

type ItemPesagemGravado = Prisma.negocioGetPayload<{
  select: typeof SELECT_ITEM_PESAGEM;
}>;
type PesagemGravada = Prisma.negocioGetPayload<{
  select: typeof SELECT_PESAGEM;
}>;
type GadoGravado = Prisma.gadoGetPayload<{
  select: typeof SELECT_GADO_PESAGEM;
}>;

function cabecalho(n: {
  negocio_id: number;
  data_negocio: Date;
  modalidade: string;
  tipo_gado: string;
  qtd_animais: number;
  hora_inicio_pesagem: Date | null;
  hora_fim_pesagem: Date | null;
  fazenda: { nome_fazenda: string };
  pecuarista: { nome_pecuarista: string };
}) {
  return {
    negocio_id: n.negocio_id,
    data_negocio: n.data_negocio,
    modalidade: n.modalidade,
    tipo_gado: n.tipo_gado,
    qtd_animais: n.qtd_animais,
    hora_inicio_pesagem: n.hora_inicio_pesagem,
    hora_fim_pesagem: n.hora_fim_pesagem,
    nome_fazenda: n.fazenda.nome_fazenda,
    nome_pecuarista: n.pecuarista.nome_pecuarista,
  };
}

/** Cabeça como o Normal recebe (POST /gados e tela de pesagem). */
export function gadoParaNormal(g: GadoGravado) {
  return {
    gado_id: g.gado_id,
    lote_id: g.lote_id,
    peso_total: g.peso_total,
    data_pesagem: g.data_pesagem,
    horario_pesagem: g.horario_pesagem,
    uuid_origem: g.uuid_origem,
  };
}

/** Item de GET /negocios/minhas-pesagens. */
export function itemMinhasPesagens(n: ItemPesagemGravado) {
  return {
    ...cabecalho(n),
    gados_pesados: n.lotes.reduce((soma, l) => soma + l._count.gados, 0),
  };
}

/** GET /negocios/:id/pesagem. */
export function negocioParaPesagem(n: PesagemGravada) {
  return {
    ...cabecalho(n),
    lotes: n.lotes.map((l) => ({
      lote_id: l.lote_id,
      nome_lote: l.nome_lote,
      tipo_lote: l.tipo_lote,
      genero: l.genero,
      rendimento_carcaca: l.rendimento_carcaca,
      qtd_animais: l.qtd_animais,
      qtd_gados: l.gados.length,
      gados: l.gados.map(gadoParaNormal),
    })),
  };
}

/** Resposta de PATCH /negocios/:id/concluir para o Normal: só os horários da pesagem. */
export function conclusaoParaNormal(n: {
  negocio_id: number;
  hora_inicio_pesagem: Date | null;
  hora_fim_pesagem: Date | null;
}) {
  return {
    negocio_id: n.negocio_id,
    hora_inicio_pesagem: n.hora_inicio_pesagem,
    hora_fim_pesagem: n.hora_fim_pesagem,
  };
}
