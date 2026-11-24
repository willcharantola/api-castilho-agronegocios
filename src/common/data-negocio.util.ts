import { BadRequestException } from '@nestjs/common';

// `negocio.data_negocio` é uma data de calendário: o banco guarda a meia-noite UTC do dia
// (timestamp sem fuso, '2026-11-24 00:00:00'). O cliente envia o dia escolhido como
// "YYYY-MM-DD" (aceita-se também o ISO completo de versões anteriores, ex.: da fila
// offline) e só os 10 primeiros caracteres contam: nada passa pelo fuso do servidor nem
// pelo do aparelho.

const DIA = /^(\d{4})-(\d{2})-(\d{2})/;

/** "YYYY-MM-DD" de uma data de negócio enviada pelo cliente; inválida → 400. */
export function diaDoNegocio(valor: string): string {
  const m = DIA.exec(valor);
  if (!m) {
    throw new BadRequestException(
      'data_negocio inválida: use o formato YYYY-MM-DD',
    );
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Valor gravado em `data_negocio`: a meia-noite UTC do dia (`${dia}T00:00:00.000Z`). */
export function dataNegocioParaGravar(valor: string): Date {
  return new Date(`${diaDoNegocio(valor)}T00:00:00.000Z`);
}

/** Início do dia (UTC) para o filtro "de" da listagem. */
export function inicioDoDia(valor: string): Date {
  return new Date(`${diaDoNegocio(valor)}T00:00:00.000Z`);
}

/** Fim do dia (UTC) para o filtro "até": o dia final entra inteiro. */
export function fimDoDia(valor: string): Date {
  return new Date(`${diaDoNegocio(valor)}T23:59:59.999Z`);
}
