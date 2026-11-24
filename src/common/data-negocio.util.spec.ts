import {
  dataNegocioParaGravar,
  diaDoNegocio,
  fimDoDia,
  inicioDoDia,
} from './data-negocio.util';

// O resultado não pode depender do fuso do servidor.
const FUSOS = ['America/Cuiaba', 'UTC', 'America/Sao_Paulo', 'Asia/Tokyo'];
const TZ_ORIGINAL = process.env.TZ;

afterEach(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

describe.each(FUSOS)('data do negócio com o servidor em %s', (fuso) => {
  beforeEach(() => {
    process.env.TZ = fuso;
  });

  it('"YYYY-MM-DD" é gravado como a meia-noite UTC do próprio dia', () => {
    expect(dataNegocioParaGravar('2026-11-24').toISOString()).toBe(
      '2026-11-24T00:00:00.000Z',
    );
  });

  it('ISO completo (fila offline antiga) vale pela data', () => {
    expect(
      dataNegocioParaGravar('2026-11-24T00:00:00.000Z').toISOString(),
    ).toBe('2026-11-24T00:00:00.000Z');
    expect(diaDoNegocio('2026-11-24T04:00:00.000Z')).toBe('2026-11-24');
  });

  it('negócio criado às 21h em Cuiabá (aparelho envia o dia 24) fica no dia 24', () => {
    // O aparelho envia hojeEmCuiaba() = "2026-11-24" (já é 25 em UTC).
    expect(dataNegocioParaGravar('2026-11-24').toISOString()).toBe(
      '2026-11-24T00:00:00.000Z',
    );
  });

  it('filtro "até" inclui o dia final inteiro', () => {
    expect(inicioDoDia('2026-11-01').toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
    expect(fimDoDia('2026-11-30').toISOString()).toBe(
      '2026-11-30T23:59:59.999Z',
    );
  });
});

it('data inválida → 400', () => {
  expect(() => dataNegocioParaGravar('24/11/2026')).toThrow(
    'data_negocio inválida',
  );
});
