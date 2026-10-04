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

// Header com o fuso IANA do aparelho do cliente (ex.: "America/Cuiaba"), enviado pelo front.
export const FUSO_HEADER = 'x-fuso-horario';

// Usado quando o cliente não envia o header ou envia um fuso inválido.
const FUSO_PADRAO = process.env.FUSO_HORARIO ?? 'America/Sao_Paulo';

function formatarHora(fuso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: fuso,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

/**
 * Hora local atual do cliente, no mesmo formato de horaParaDate. O instante vem do
 * relógio do servidor (não confiamos no relógio do aparelho); só o fuso vem do cliente,
 * para registrar a hora local de onde ele está. As colunas são TIME (sem fuso) e o front
 * exibe os componentes UTC do valor — por isso gravar `new Date()` direto daria a hora UTC.
 */
export function horaAtual(fuso?: string): Date {
  if (fuso) {
    try {
      return horaParaDate(formatarHora(fuso));
    } catch {
      // RangeError: fuso desconhecido — cai no padrão.
    }
  }
  return horaParaDate(formatarHora(FUSO_PADRAO));
}
