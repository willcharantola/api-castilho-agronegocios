export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Converte "HH:mm" ou "HH:mm:ss" em Date (1970-01-01 UTC) para colunas TIME do Postgres.
 */
export function horaParaDate(hora: string): Date {
  const [hh, mm, ss] = hora.split(':');
  return new Date(
    Date.UTC(1970, 0, 1, Number(hh), Number(mm), Number(ss ?? 0)),
  );
}
