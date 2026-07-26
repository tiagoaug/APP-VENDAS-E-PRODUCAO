import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation';
import { LocateFixed, Loader2, Box, Map as MapIcon } from 'lucide-react';
import { toast } from '../utils/toast';

// Carregado só quando o usuário troca pra 3D — maplibre-gl é uma dependência relativamente
// grande, sem sentido pagar esse peso no carregamento inicial pra quem nunca usa o modo 3D.
const DeliveryMapGL = lazy(() => import('./DeliveryMapGL'));

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

// Bolinha azul (padrão "você está aqui" de apps de mapa) — deliberadamente diferente do
// pin em gota usado pros outros marcadores, pra não confundir com uma parada/endereço.
const MY_LOCATION_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 2px rgba(37,99,235,0.45), 0 2px 4px rgba(0,0,0,0.35);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Botão flutuante "Minha Localização" — busca o GPS do aparelho, mostra uma bolinha azul
// na posição e centraliza o mapa nela. Independente do pin/marcadores de parada — é só
// uma referência de "onde eu estou", não move nada que já esteja marcado no mapa.
function MyLocationControl({ isDarkMode }: { isDarkMode: boolean }) {
  const map = useMap();
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const locate = async () => {
    setIsLocating(true);
    try {
      await Geolocation.requestPermissions().catch(() => undefined);
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMyLocation(loc);
      map.flyTo([loc.lat, loc.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    } catch {
      toast.show('Não foi possível obter sua localização agora.');
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <>
      {myLocation && <Marker position={[myLocation.lat, myLocation.lng]} icon={MY_LOCATION_ICON} />}
      <button
        type="button"
        onClick={locate}
        disabled={isLocating}
        title="Minha localização"
        aria-label="Minha localização"
        className={`absolute z-[1000] bottom-3 right-3 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'bg-white text-teal-600 border border-slate-200'}`}
      >
        {isLocating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
      </button>
    </>
  );
}

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
  // Botão flutuante "Minha Localização" — ligado por padrão, só desliga em mapas muito
  // pequenos/específicos onde o botão atrapalharia mais do que ajudaria.
  showLocateButton?: boolean;
}

function DeliveryMap2D({
  isDarkMode,
  height = 260,
  marker,
  onMarkerChange,
  flyTo,
  markers,
  polyline,
  fallbackCenter = { lat: -14.235, lng: -51.9253 },
  showLocateButton = true,
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

        {showLocateButton && <MyLocationControl isDarkMode={isDarkMode} />}

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

// Wrapper público — decide entre o mapa 2D (Leaflet, padrão, leve) e o 3D (MapLibre GL,
// carregado sob demanda) via um botão flutuante. O 3D dá inclinação/rotação por gesto e
// um controle de bússola pra voltar ao norte — nenhuma das duas coisas existe no Leaflet.
export default function DeliveryMap(props: DeliveryMapProps) {
  const [is3D, setIs3D] = useState(false);
  const { isDarkMode, height = 260 } = props;

  return (
    <div className="relative w-full">
      {is3D ? (
        <Suspense
          fallback={
            <div style={{ height }} className={`w-full rounded-2xl border flex items-center justify-center ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <Loader2 size={22} className="animate-spin text-teal-600" />
            </div>
          }
        >
          <DeliveryMapGL {...props} height={height} />
        </Suspense>
      ) : (
        <DeliveryMap2D {...props} height={height} />
      )}
      <button
        type="button"
        onClick={() => setIs3D(v => !v)}
        title={is3D ? 'Mudar para mapa 2D' : 'Mudar para mapa 3D'}
        className={`absolute z-[1000] top-3 right-3 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'bg-white text-teal-600 border border-slate-200'}`}
      >
        {is3D ? <MapIcon size={13} /> : <Box size={13} />}
        {is3D ? '2D' : '3D'}
      </button>
    </div>
  );
}
