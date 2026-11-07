import { ehLinkCurto, expandirLinkMapa } from './localizacao.util';

/** fetch falso: cada URL devolve o redirecionamento (ou status) configurado. */
function fetchFalso(
  respostas: Record<string, { status: number; location?: string }>,
) {
  const chamadas: string[] = [];
  const buscar = (async (url: string) => {
    chamadas.push(url);
    const r = respostas[url] ?? { status: 404 };
    return new Response(null, {
      status: r.status,
      headers: r.location ? { location: r.location } : {},
    });
  }) as unknown as typeof fetch;
  return { buscar, chamadas };
}

describe('ehLinkCurto', () => {
  it.each([
    ['https://maps.app.goo.gl/abc123', true],
    ['https://goo.gl/maps/abc123', true],
    ['https://www.google.com/maps/place/X/@-20.1,-51.2,15z', false],
    ['https://goo.gl/abc123', false],
    ['http://maps.app.goo.gl/abc123', false],
    ['-20.1,-51.2', false],
  ])('%s → %s', (link, esperado) => {
    expect(ehLinkCurto(link)).toBe(esperado);
  });
});

describe('expandirLinkMapa', () => {
  const COMPLETO =
    'https://www.google.com/maps/place/Fazenda/@-20.7123,-51.6543,15z';

  it('segue o redirecionamento até o link completo', async () => {
    const { buscar } = fetchFalso({
      'https://maps.app.goo.gl/abc': { status: 302, location: COMPLETO },
    });
    await expect(
      expandirLinkMapa('https://maps.app.goo.gl/abc', buscar),
    ).resolves.toBe(COMPLETO);
  });

  it('segue mais de um salto entre links curtos', async () => {
    const { buscar, chamadas } = fetchFalso({
      'https://goo.gl/maps/abc': {
        status: 301,
        location: 'https://maps.app.goo.gl/xyz',
      },
      'https://maps.app.goo.gl/xyz': { status: 302, location: COMPLETO },
    });
    await expect(
      expandirLinkMapa('https://goo.gl/maps/abc', buscar),
    ).resolves.toBe(COMPLETO);
    expect(chamadas).toHaveLength(2);
  });

  it('não segue redirecionamento para outro site', async () => {
    const { buscar, chamadas } = fetchFalso({
      'https://maps.app.goo.gl/abc': {
        status: 302,
        location: 'https://exemplo.com/maps',
      },
    });
    await expect(
      expandirLinkMapa('https://maps.app.goo.gl/abc', buscar),
    ).resolves.toBeNull();
    expect(chamadas).toHaveLength(1);
  });

  it('null sem redirecionamento ou com erro de rede', async () => {
    const { buscar } = fetchFalso({
      'https://maps.app.goo.gl/abc': { status: 200 },
    });
    await expect(
      expandirLinkMapa('https://maps.app.goo.gl/abc', buscar),
    ).resolves.toBeNull();
    const falha = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(
      expandirLinkMapa('https://maps.app.goo.gl/abc', falha),
    ).resolves.toBeNull();
  });

  it('para num laço de links curtos', async () => {
    const { buscar, chamadas } = fetchFalso({
      'https://maps.app.goo.gl/a': {
        status: 302,
        location: 'https://maps.app.goo.gl/b',
      },
      'https://maps.app.goo.gl/b': {
        status: 302,
        location: 'https://maps.app.goo.gl/a',
      },
    });
    await expect(
      expandirLinkMapa('https://maps.app.goo.gl/a', buscar),
    ).resolves.toBeNull();
    expect(chamadas).toHaveLength(5);
  });
});
