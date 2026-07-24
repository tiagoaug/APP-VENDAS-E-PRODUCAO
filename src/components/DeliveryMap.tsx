import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone de pin em SVG inline — evita o problema clássico de bundling do Leaflet
// (as imagens padrão de marcador não resolvem certo com Vite/empacotadores sem
// configuração extra). Sem dependência de arquivo de imagem nenhum.
// `number` (ordem na rota) é desenhado dentro do círculo branco quando informado.
function pinIcon(color: string, number?: number): L.DivIcon {
  const numberSvg = number !== undefined
    ? `<text x="15" y="15" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="900" fill="${color}" font-family="sans-serif">${number}</text>`
    : '';
  return L.divIcon({
    className: '',
    html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${color}"/>
      <circle cx="15" cy="15" r="9" fill="white"/>
      ${numberSvg}
    </svg>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
  });
}

const DEFAULT_MARKER_ICON = pinIcon('#0d9488');

// Clique no mapa também move/cria o pin — mesmo efeito de arrastar o marcador,
// mais fácil de acertar num celular do que pegar o marcador com precisão.
function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Leva o mapa até `lat`/`lng` sempre que `signal` muda (busca por endereço, endereço
// colado ou localização colada) — react-leaflet só usa `center`/`zoom` do MapContainer na
// montagem inicial, então sem isso o pin "some" fora da área visível depois de uma busca.
// `lat`/`lng` vêm do PRÓPRIO resultado da busca (não do prop `marker`, que só reflete o
// endereço depois de o Firestore confirmar a gravação e o snapshot voltar — nesse meio
// tempo `signal` já tinha disparado com o `marker` antigo, voando pro lugar errado ou nem
// disparando se ainda não havia pin nenhum). Não reage a mudança de `lat`/`lng` sozinha:
// arrastar o pin também muda essas coordenadas, e recentralizar a cada arrasto brigaria
// com o gesto do usuário — só voa quando `signal` (que só sobe em busca/colagem) muda.
function FlyToOnSignal({ lat, lng, signal }: { lat: number; lng: number; signal: number }) {
  const map = useMap();
  useEffect(() => {
    if (signal === 0) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
  return null;
}

export interface DeliveryMapMarker {
  id: string;
  lat: number;
  lng: number;
  // Nome do cliente — mostrado como tooltip permanente acima do pin.
  label?: string;
  // Ordem da parada na rota (1, 2, 3...) — desenhado dentro do próprio pin.
  number?: number;
  color?: string;
}

interface DeliveryMapProps {
  isDarkMode: boolean;
  height?: number;
  // Modo pin único e editável (card da venda): marcador arrastável/clicável.
  marker?: { lat: number; lng: number } | null;
  onMarkerChange?: (lat: number, lng: number) => void;
  // Alvo explícito de uma busca/colagem bem-sucedida (não do prop `marker`, que só
  // atualiza depois do round-trip com o Firestore — ver comentário em FlyToOnSignal).
  // `signal` muda a cada busca nova, mesmo pro mesmo lat/lng de novo.
  flyTo?: { lat: number; lng: number; signal: number } | null;
  // Modo visão de rota (builder/detalhe): vários marcadores fixos + linha da rota.
  markers?: DeliveryMapMarker[];
  polyline?: { lat: number; lng: number }[];
  // Centro/zoom inicial quando não há nenhum ponto ainda (padrão: Brasil, visão geral).
  fallbackCenter?: { lat: number; lng: number };
}

export default function DeliveryMap({
  isDarkMode,
  height = 260,
  marker,
  onMarkerChange,
  flyTo,
  markers,
  polyline,
  fallbackCenter = { lat: -14.235, lng: -51.9253 },
}: DeliveryMapProps) {
  const center = useMemo(() => {
    if (marker) return marker;
    if (markers && markers.length > 0) return { lat: markers[0].lat, lng: markers[0].lng };
    return fallbackCenter;
  }, [marker, markers, fallbackCenter]);

  const zoom = marker || (markers && markers.length > 0) ? 15 : 4;

  return (
    <div
      style={{ height }}
      className={`w-full rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        dragging={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {marker && (
          <Marker
            position={[marker.lat, marker.lng]}
            icon={DEFAULT_MARKER_ICON}
            draggable={!!onMarkerChange}
            eventHandlers={onMarkerChange ? {
              dragend: (e) => {
                const pos = e.target.getLatLng();
                onMarkerChange(pos.lat, pos.lng);
              },
            } : undefined}
          />
        )}

        {onMarkerChange && <ClickToPlace onPlace={onMarkerChange} />}

        {flyTo && <FlyToOnSignal lat={flyTo.lat} lng={flyTo.lng} signal={flyTo.signal} />}

        {markers?.map(m => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={pinIcon(m.color || '#0d9488', m.number)}>
            {m.label && (
              <Tooltip permanent direction="top" offset={[0, -38]} opacity={1}
                className="!bg-white dark:!bg-slate-900 !text-slate-900 dark:!text-white !border-0 !rounded-lg !px-2 !py-1 !text-[10px] !font-black !shadow-md"
              >
                {m.label}
              </Tooltip>
            )}
          </Marker>
        ))}

        {polyline && polyline.length > 1 && (
          <Polyline positions={polyline.map(p => [p.lat, p.lng])} pathOptions={{ color: '#0d9488', weight: 4, opacity: 0.8 }} />
        )}
      </MapContainer>
    </div>
  );
}
