// Versão 3D do mapa de Entregas — MapLibre GL (vetorial) em vez do Leaflet (raster) usado
// no modo 2D padrão. Dá inclinação (pitch), rotação por arrasto/pinça e um controle de
// bússola que volta pro norte com um toque — nada disso é possível no Leaflet puro.
// Tiles vetoriais do OpenFreeMap (tiles.openfreemap.org) — gratuito, sem cadastro/chave,
// mesmo espírito das outras integrações de mapa/geocodificação deste módulo (Nominatim,
// OSRM, Overpass).
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre acha o worker (thread que decodifica os tiles vetoriais) montando uma URL
// RELATIVA ao próprio script dele (`./maplibre-gl-worker.mjs`) — isso só funciona se o
// pacote for servido do jeito que ele veio do npm. Depois do bundle do Vite (tudo
// remontado num arquivo `vendor-maplibre-[hash].js` só), essa URL relativa aponta pra um
// arquivo que não existe, o worker nunca carrega, e o mapa fica preso pra sempre
// "carregando" (sem nenhum erro visível — busca de tile pelo processo principal funciona
// normal, só a DECODIFICAÇÃO no worker é que nunca acontece). O `?url` abaixo faz o Vite
// emitir o arquivo do worker como um asset físico de verdade e devolver a URL real dele,
// que passamos pro MapLibre usar em vez de tentar adivinhar sozinho.
// eslint-disable-next-line import/no-unresolved
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { Geolocation } from '@capacitor/geolocation';
import { LocateFixed, Loader2 } from 'lucide-react';
import { toast } from '../utils/toast';
import type { DeliveryMapMarker } from './DeliveryMap';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface DeliveryMapGLProps {
  isDarkMode: boolean;
  height: number;
  marker?: { lat: number; lng: number } | null;
  onMarkerChange?: (lat: number, lng: number) => void;
  flyTo?: { lat: number; lng: number; signal: number } | null;
  markers?: DeliveryMapMarker[];
  polyline?: { lat: number; lng: number }[];
  fallbackCenter?: { lat: number; lng: number };
  showLocateButton?: boolean;
}

function pinElement(color: string, number?: number): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.width = '30px';
  wrapper.style.height = '42px';
  wrapper.innerHTML = `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${color}"/>
    <circle cx="15" cy="15" r="9" fill="white"/>
    ${number !== undefined ? `<text x="15" y="15" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="900" fill="${color}" font-family="sans-serif">${number}</text>` : ''}
  </svg>`;
  return wrapper;
}

function labelElement(text: string, isDarkMode: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.position = 'absolute';
  el.style.bottom = '46px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%)';
  el.style.whiteSpace = 'nowrap';
  el.style.padding = '3px 8px';
  el.style.borderRadius = '8px';
  el.style.fontSize = '10px';
  el.style.fontWeight = '900';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
  el.style.background = isDarkMode ? '#0f172a' : '#ffffff';
  el.style.color = isDarkMode ? '#ffffff' : '#0f172a';
  return el;
}

const POLYLINE_SOURCE_ID = 'delivery-route-line';
const POLYLINE_LAYER_ID = 'delivery-route-line-layer';

export default function DeliveryMapGL({
  isDarkMode,
  height,
  marker,
  onMarkerChange,
  flyTo,
  markers,
  polyline,
  fallbackCenter = { lat: -14.235, lng: -51.9253 },
  showLocateButton = true,
}: DeliveryMapGLProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const myLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  // Falha de carregamento (tile/estilo/fonte) hoje ficava silenciosa — o mapa só parecia
  // "vazio" sem explicar por quê. Mostra o motivo real na tela pra dar pra diagnosticar.
  const [mapError, setMapError] = useState<string | null>(null);

  const initialCenter = marker || (markers && markers.length > 0 ? markers[0] : fallbackCenter);
  // Mais fechado que o modo 2D (15) — em zoom 15 a rua ficava fina/quase invisível contra o
  // fundo bege do estilo vetorial; 17 é o nível "rua" de verdade, onde a malha viária e os
  // lotes aparecem com contraste.
  const initialZoom = marker || (markers && markers.length > 0) ? 17 : 4;
  const initialPitch = marker || (markers && markers.length > 0) ? 30 : 0;

  // Cria o mapa uma vez só — mudanças de props depois disso são aplicadas via os efeitos
  // abaixo (marker/markers/polyline/flyTo), nunca recriando a instância inteira.
  //
  // NÃO cria o mapa até o container ter um tamanho real: nascendo com 0x0 (troca de tela
  // ainda animando), o MapLibre calcula um viewport sem sentido nesse instante e dispara um
  // primeiro lote de pedidos de tile pra área/zoom ERRADOS — mesmo corrigindo a câmera
  // depois (o que já era feito), esses pedidos iniciais continuam na fila e, num aparelho
  // com poucas conexões simultâneas por origem, empacam os pedidos certos atrás deles. Só
  // constrói o mapa quando já dá pra confiar no tamanho do container.
  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map | null = null;
    let cleanupMap: (() => void) | null = null;
    let cancelled = false;

    const buildMap = () => {
      if (cancelled || map || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [initialCenter.lng, initialCenter.lat],
        zoom: initialZoom,
        pitch: initialPitch,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
      mapRef.current = map;

      map.on('error', (e) => {
        console.error('[DeliveryMapGL]', e.error);
        setMapError(e.error?.message || 'Erro desconhecido ao carregar o mapa.');
      });

      const innerResizeObserver = new ResizeObserver(() => map?.resize());
      innerResizeObserver.observe(containerRef.current);

      if (onMarkerChange) {
        map.on('click', (e: maplibregl.MapMouseEvent) => onMarkerChange(e.lngLat.lat, e.lngLat.lng));
      }

      cleanupMap = () => {
        innerResizeObserver.disconnect();
        map?.remove();
        mapRef.current = null;
      };
    };

    if (containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
      buildMap();
    }
    const outerResizeObserver = new ResizeObserver(() => {
      if (!map && containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
        buildMap();
      }
    });
    outerResizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      outerResizeObserver.disconnect();
      cleanupMap?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marcador único arrastável (modo pin de endereço).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!marker) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const el = pinElement('#0d9488');
      markerRef.current = new maplibregl.Marker({ element: el, draggable: !!onMarkerChange, anchor: 'bottom' })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map);
      if (onMarkerChange) {
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current!.getLngLat();
          onMarkerChange(pos.lat, pos.lng);
        });
      }
    } else {
      markerRef.current.setLngLat([marker.lng, marker.lat]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker?.lat, marker?.lng]);

  // Voa até o alvo de uma busca/colagem bem-sucedida — mesmo padrão do modo 2D.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo || flyTo.signal === 0) return;
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.signal]);

  // Marcadores fixos (paradas de rota) — recriados do zero a cada mudança da lista, mais
  // simples que reconciliar item a item pra uma lista que muda pouco (seleção de paradas).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = (markers || []).map(m => {
      const el = pinElement(m.color || '#0d9488', m.number);
      if (m.label) el.appendChild(labelElement(m.label, isDarkMode));
      el.style.position = 'relative';
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([m.lng, m.lat]).addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, isDarkMode]);

  // Linha da rota — GeoJSON source/layer adicionados uma vez, atualizados via setData.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyLine = () => {
      const coords = (polyline && polyline.length > 1) ? polyline.map(p => [p.lng, p.lat]) : [];
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords as [number, number][] },
      };
      const source = map.getSource(POLYLINE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson);
      } else if (coords.length > 1) {
        map.addSource(POLYLINE_SOURCE_ID, { type: 'geojson', data: geojson });
        map.addLayer({
          id: POLYLINE_LAYER_ID,
          type: 'line',
          source: POLYLINE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#0d9488', 'line-width': 4, 'line-opacity': 0.85 },
        });
      }
    };

    if (map.isStyleLoaded()) applyLine();
    else map.once('load', applyLine);
  }, [polyline]);

  const locate = async () => {
    const map = mapRef.current;
    if (!map) return;
    setIsLocating(true);
    try {
      await Geolocation.requestPermissions().catch(() => undefined);
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!myLocationMarkerRef.current) {
        const el = document.createElement('div');
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '50%';
        el.style.background = '#2563eb';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.45), 0 2px 4px rgba(0,0,0,0.35)';
        myLocationMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([loc.lng, loc.lat]).addTo(map);
      } else {
        myLocationMarkerRef.current.setLngLat([loc.lng, loc.lat]);
      }
      map.flyTo({ center: [loc.lng, loc.lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
    } catch {
      toast.show('Não foi possível obter sua localização agora.');
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div style={{ height, position: 'relative' }} className={`w-full rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {mapError && (
        <div className="absolute z-[20] top-2 left-2 right-2 px-3 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-bold shadow-lg">
          Mapa 3D: {mapError}
        </div>
      )}
      {showLocateButton && (
        <button
          type="button"
          onClick={locate}
          disabled={isLocating}
          title="Minha localização"
          aria-label="Minha localização"
          className={`absolute z-[10] bottom-3 right-3 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'bg-white text-teal-600 border border-slate-200'}`}
        >
          {isLocating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        </button>
      )}
    </div>
  );
}
