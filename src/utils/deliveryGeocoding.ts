// Geocodificação de endereço em texto -> lat/lng via Nominatim (OpenStreetMap),
// gratuito e sem chave — mas com política de uso justo (~1 req/s, sem paralelismo).
// Serializa as chamadas numa fila simples pra nunca violar isso, mesmo se o usuário
// buscar vários endereços em sequência rápida (ex.: vários cards de venda abertos).

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function throttledFetch(url: string): Promise<Response> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return fetch(url, {
      headers: { 'Accept-Language': 'pt-BR' },
    });
  });
  // Desacopla erros desta chamada da fila — uma busca que falha não deve travar
  // as próximas colocadas na fila depois dela.
  queue = run.catch(() => undefined);
  return run;
}

function buildAddressText(address: {
  street?: string; number?: string; neighborhood?: string; city?: string; state?: string; zip?: string;
}): string {
  const parts = [
    [address.street, address.number].filter(Boolean).join(', '),
    address.neighborhood,
    address.city,
    address.state,
    address.zip,
  ].filter(Boolean);
  return parts.join(', ');
}

async function geocodeText(text: string): Promise<GeocodeResult | null> {
  if (!text.trim()) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(text)}`;
  const res = await throttledFetch(url);
  if (!res.ok) throw new Error('Falha ao consultar geocodificação.');

  const results: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
  if (!results.length) return null;

  const first = results[0];
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), displayName: first.display_name };
}

export async function geocodeAddress(address: {
  street?: string; number?: string; neighborhood?: string; city?: string; state?: string; zip?: string;
}): Promise<GeocodeResult | null> {
  return geocodeText(buildAddressText(address));
}

// Busca a partir de um endereço colado como texto livre (ex.: copiado do WhatsApp) — sem
// tentar quebrar em rua/número/bairro/etc., só verifica se esse texto é encontrável e
// devolve a posição, mesmo padrão de throttle/fila da busca por campos.
export async function geocodeFreeText(text: string): Promise<GeocodeResult | null> {
  return geocodeText(text);
}

// Extrai lat/lng diretamente de uma localização compartilhada (WhatsApp encaminha como
// link do Google Maps — `?q=`, `/@lat,lng,`, `query=lat,lng` — ou às vezes só o texto
// "lat, lng"; `geo:` é o URI padrão de apps de mapa em geral). Prioriza isso sobre
// geocodificar por texto: é a posição EXATA que a pessoa compartilhou, sem depender do
// Nominatim (nem gastar uma chamada da fila) — só cai pra busca por endereço quando não
// acha coordenadas no texto colado.
// Exige 3+ casas decimais (precisão típica de GPS) pra não confundir com números soltos
// de endereço (ex.: "Rua Tal, 123" nunca bate — "123" não tem ponto decimal).
export function parseLatLngFromText(text: string): { lat: number; lng: number } | null {
  const geoUri = text.match(/geo:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i);
  if (geoUri) {
    const lat = parseFloat(geoUri[1]);
    const lng = parseFloat(geoUri[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Link do Google Maps pra um ENDEREÇO/local com nome (não um pino solto) resolve pra
  // esse formato — `!3d{lat}!4d{lng}` — em vez do `@lat,lng` ou `q=lat,lng` de sempre.
  // Confirmado ao vivo em 24/07/2026 com um link maps.app.goo.gl real.
  const placeFormat = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (placeFormat) {
    const lat = parseFloat(placeFormat[1]);
    const lng = parseFloat(placeFormat[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  const coordPattern = /(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/;
  const match = text.match(coordPattern);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  return null;
}
