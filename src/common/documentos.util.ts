import { Transform } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';

// CPF, CNPJ e inscrição estadual: aceitos com ou sem pontuação, validados (dígitos
// verificadores no CPF/CNPJ, formato na inscrição) e gravados sempre formatados.

/** Só os dígitos. */
const digitos = (valor: string) => valor.replace(/\D/g, '');

/** Mesmo dígito repetido (000.000.000-00, 11.111.111/1111-11) passa no cálculo, mas é inválido. */
const repetido = (d: string) => /^(\d)\1*$/.test(d);

/** Dígito verificador módulo 11 com os pesos dados (resto < 2 → 0). */
function dv(base: string, pesos: number[]) {
  const soma = [...base].reduce((total, c, i) => total + Number(c) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 11 || repetido(d)) return false;
  const primeiro = dv(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = dv(d.slice(0, 9) + primeiro, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${primeiro}${segundo}`);
}

export function cnpjValido(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 14 || repetido(d)) return false;
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const primeiro = dv(d.slice(0, 12), pesos.slice(1));
  const segundo = dv(d.slice(0, 12) + primeiro, pesos);
  return d.endsWith(`${primeiro}${segundo}`);
}

/** "12345678909" → "123.456.789-09". */
export const formatarCpf = (valor: string) =>
  digitos(valor).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

/** "12345678000190" → "12.345.678/0001-90". */
export const formatarCnpj = (valor: string) =>
  digitos(valor).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/** Inscrição estadual de MS: 9 dígitos, no formato 00.000.000-0. */
export const INSCRICAO_ESTADUAL = /^\d{2}\.\d{3}\.\d{3}-\d$/;

/** "287666883" → "28.766.688-3". */
export const formatarInscricaoEstadual = (valor: string) =>
  digitos(valor).replace(/^(\d{2})(\d{3})(\d{3})(\d)$/, '$1.$2.$3-$4');

/** Valor como gravado: CPF ou CNPJ válido sai formatado; o resto, só sem espaços nas pontas. */
function normalizarDocumento(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  const texto = valor.trim();
  if (cpfValido(texto)) return formatarCpf(texto);
  if (cnpjValido(texto)) return formatarCnpj(texto);
  return texto;
}

type Regra = (valor: unknown, objeto: Record<string, unknown>) => boolean;

/** Transform (normaliza) + validação, num só decorador. */
function documento(
  nome: string,
  mensagem: string,
  normalizar: (valor: unknown) => unknown,
  regra: Regra,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    Transform(({ value }: { value: unknown }) => normalizar(value))(
      target,
      propertyName,
    );
    registerDecorator({
      name: nome,
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: mensagem, ...options },
      validator: {
        validate: (valor, args) =>
          regra(valor, (args?.object ?? {}) as Record<string, unknown>),
      },
    });
  };
}

/**
 * CPF (pessoa física) ou CNPJ (jurídica), conforme `fisico_juridico` do mesmo corpo; sem
 * ele (PATCH parcial), aceita qualquer um dos dois.
 */
export function CpfCnpj(options?: ValidationOptions) {
  return documento(
    'cpfCnpj',
    'CPF/CNPJ inválido: informe um CPF (pessoa física) ou CNPJ (pessoa jurídica) válido.',
    normalizarDocumento,
    (valor, objeto) => {
      if (typeof valor !== 'string') return false;
      if (objeto.fisico_juridico === 'fisico') return cpfValido(valor);
      if (objeto.fisico_juridico === 'juridico') return cnpjValido(valor);
      return cpfValido(valor) || cnpjValido(valor);
    },
    options,
  );
}

/** CNPJ obrigatório (frigorífico). */
export function Cnpj(options?: ValidationOptions) {
  return documento(
    'cnpj',
    'CNPJ inválido. Use o formato 00.000.000/0000-00.',
    normalizarDocumento,
    (valor) => typeof valor === 'string' && cnpjValido(valor),
    options,
  );
}

/** CNPJ opcional (fazenda): '' ou só espaços → null. */
export function CnpjOpcional(options?: ValidationOptions) {
  return documento(
    'cnpjOpcional',
    'CNPJ inválido. Use o formato 00.000.000/0000-00.',
    (valor) =>
      typeof valor === 'string' && valor.trim() === ''
        ? null
        : normalizarDocumento(valor),
    (valor) =>
      valor === null ||
      valor === undefined ||
      (typeof valor === 'string' && cnpjValido(valor)),
    options,
  );
}

/** Inscrição estadual (MS): com ou sem pontuação, gravada como 00.000.000-0. */
export function InscricaoEstadual(options?: ValidationOptions) {
  return documento(
    'inscricaoEstadual',
    'Inscrição estadual inválida. Use o formato 00.000.000-0.',
    (valor) => {
      if (typeof valor !== 'string') return valor;
      const texto = valor.trim();
      return /^\d{9}$/.test(texto) ? formatarInscricaoEstadual(texto) : texto;
    },
    (valor) => typeof valor === 'string' && INSCRICAO_ESTADUAL.test(valor),
    options,
  );
}
