// Monta o link de navegação real (Google Maps / Apple Maps / Waze) com as paradas na ordem
// definida pela rota — a navegação turn-by-turn de verdade fica sempre a cargo do app
// nativo do celular, nunca calculada aqui (evita qualquer custo de API de rota).
//
// A 4ª opção, 'embedded_sdk', NÃO passa por aqui — não abre nenhum app externo, é só o
// usuário optando por ficar na tela de rota usando o mapa e o acompanhamento já embutidos
// no próprio app (foco automático perto da parada + recálculo de rota, ver
// DeliveryRouteDetailView.tsx). 100% web, sem SDK nativo nem custo de API.

export type NavPoint = { lat: number; lng: number };

export type NavigationProvider = 'waze' | 'google_maps' | 'apple_maps' | 'embedded_sdk';

// Apple Maps não suporta uma rota com vários waypoints intermediários do mesmo jeito
// que o Google Maps (`/dir/?waypoints=`) — só aceita origem+destino diretos. Como
// aproximação, usamos a ÚLTIMA parada como destino e a penúltima como origem, cobrindo
// pelo menos o trecho final; pra percorrer a rota inteira nesse app, é preciso abrir
// perna por perna manualmente.
export function buildGoogleMapsUrl(stops: NavPoint[]): string | null {
  if (stops.length === 0) return null;
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'driving',
  });
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(p => `${p.lat},${p.lng}`).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildAppleMapsUrl(stops: NavPoint[]): string | null {
  if (stops.length === 0) return null;
  const destination = stops[stops.length - 1];
  const origin = stops.length > 1 ? stops[stops.length - 2] : undefined;
  const params = new URLSearchParams({
    daddr: `${destination.lat},${destination.lng}`,
    dirflg: 'd',
  });
  if (origin) params.set('saddr', `${origin.lat},${origin.lng}`);
  return `https://maps.apple.com/?${params.toString()}`;
}

// Link universal do Waze — redireciona pro app nativo se instalado, senão pra loja/web.
// Assim como o Google/Apple Maps acima, não tem suporte real a waypoints intermediários:
// só destino único, então usamos a ÚLTIMA parada.
export function buildWazeUrl(stops: NavPoint[]): string | null {
  if (stops.length === 0) return null;
  const destination = stops[stops.length - 1];
  const params = new URLSearchParams({
    ll: `${destination.lat},${destination.lng}`,
    navigate: 'yes',
  });
  return `https://waze.com/ul?${params.toString()}`;
}

// Cobre só os provedores resolvidos por link web ('embedded_sdk' passa por
// src/lib/embeddedNavigation.ts, nunca por aqui).
export function openNavigation(app: Exclude<NavigationProvider, 'embedded_sdk'>, stops: NavPoint[]): void {
  const url = app === 'apple_maps' ? buildAppleMapsUrl(stops)
    : app === 'waze' ? buildWazeUrl(stops)
    : buildGoogleMapsUrl(stops);
  if (!url) return;
  window.open(url, '_system');
}
