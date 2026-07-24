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

export async function geocodeAddress(address: {
  street?: string; number?: string; neighborhood?: string; city?: string; state?: string; zip?: string;
}): Promise<GeocodeResult | null> {
  const text = buildAddressText(address);
  if (!text.trim()) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(text)}`;
  const res = await throttledFetch(url);
  if (!res.ok) throw new Error('Falha ao consultar geocodificação.');

  const results: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
  if (!results.length) return null;

  const first = results[0];
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), displayName: first.display_name };
}
