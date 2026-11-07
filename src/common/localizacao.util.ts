import { registerDecorator, type ValidationOptions } from 'class-validator';

// Validação de fazenda.localizacao_google: link do Google Maps (de um host permitido) ou
// coordenadas "latitude,longitude". O front usa a mesma lista para montar o botão
// "Ver no mapa" — nunca se aceita link de texto livre (javascript:, data:, outros sites).

/** "lat,lng" com ponto decimal; aceita espaço depois da vírgula. */
const COORDENADAS_REGEX = /^(-?\d{1,2}(?:\.\d+)?),\s?(-?\d{1,3}(?:\.\d+)?)$/;

export function ehCoordenadas(valor: string): boolean {
  const match = COORDENADAS_REGEX.exec(valor.trim());
  if (!match) return false;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

/**
 * Link https do Google Maps: www.google.com/maps, google.com/maps, maps.google.com,
 * maps.app.goo.gl (link curto do app) e goo.gl/maps.
 */
export function ehLinkMapaPermitido(valor: string): boolean {
  let url: URL;
  try {
    url = new URL(valor.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const caminhoMaps =
    url.pathname === '/maps' || url.pathname.startsWith('/maps/');
  switch (url.hostname) {
    case 'www.google.com':
    case 'google.com':
    case 'goo.gl':
      return caminhoMaps;
    case 'maps.google.com':
    case 'maps.app.goo.gl':
      return true;
    default:
      return false;
  }
}

export function localizacaoValida(valor: string): boolean {
  return ehCoordenadas(valor) || ehLinkMapaPermitido(valor);
}

/** Decorator de DTO: string vazia/null passam (campo opcional); o resto precisa ser válido. */
export function IsLocalizacaoGoogle(
  opcoes?: ValidationOptions,
): PropertyDecorator {
  return (alvo, propriedade) =>
    registerDecorator({
      name: 'isLocalizacaoGoogle',
      target: alvo.constructor,
      propertyName: propriedade as string,
      options: {
        message:
          'localizacao_google deve ser um link do Google Maps ou coordenadas "latitude,longitude"',
        ...opcoes,
      },
      validator: {
        validate: (valor: unknown) =>
          valor == null ||
          valor === '' ||
          (typeof valor === 'string' && localizacaoValida(valor)),
      },
    });
}

/** Link curto (maps.app.goo.gl, goo.gl/maps): não traz o lugar, só redireciona para ele. */
export function ehLinkCurto(valor: string): boolean {
  if (!ehLinkMapaPermitido(valor)) return false;
  const host = new URL(valor.trim()).hostname;
  return host === 'maps.app.goo.gl' || host === 'goo.gl';
}

const MAX_REDIRECIONAMENTOS = 5;
const TEMPO_LIMITE_MS = 5000;

/**
 * Link completo por trás de um link curto, para o front montar a pré-visualização do mapa
 * (o navegador não consegue ler o redirecionamento por causa do CORS). Segue os
 * redirecionamentos um a um e só enquanto eles apontam para hosts permitidos (nunca vira
 * uma requisição para outro site). null se não chegar a um link completo do Maps.
 */
export async function expandirLinkMapa(
  link: string,
  buscar: typeof fetch = fetch,
): Promise<string | null> {
  let atual = link.trim();
  for (let i = 0; i < MAX_REDIRECIONAMENTOS && ehLinkCurto(atual); i++) {
    let resposta: Response;
    try {
      resposta = await buscar(atual, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch {
      return null;
    }
    const destino = resposta.headers.get('location');
    if (resposta.status < 300 || resposta.status >= 400 || !destino)
      return null;
    const proximo = new URL(destino, atual).toString();
    if (!ehLinkMapaPermitido(proximo)) return null;
    atual = proximo;
  }
  return ehLinkCurto(atual) ? null : atual;
}
