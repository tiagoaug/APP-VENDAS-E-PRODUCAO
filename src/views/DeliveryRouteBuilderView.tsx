import { useEffect, useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { Geolocation } from '@capacitor/geolocation';
import { ArrowLeft, GripVertical, Route as RouteIcon, MapPin, CheckCircle2, Navigation, Map as MapIcon, Loader2, ChevronDown, ChevronUp, Milestone, AlertTriangle, LocateFixed } from 'lucide-react';
import { DeliveryRoute, DeliveryStop, Product, Sale, StockLot } from '../types';
import { bucketSalesByReadiness } from '../utils/salesReadiness';
import { optimizeRoute } from '../utils/deliveryRouteOptimizer';
import { getRoadRoute, RoadRouteResult } from '../utils/deliveryRoadRoute';
import { generateId } from '../utils/id';
import { toast } from '../utils/toast';
import DeliveryMap from '../components/DeliveryMap';

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

interface DeliveryRouteBuilderViewProps {
  sales: Sale[];
  products: Product[];
  stockLots: StockLot[];
  isDarkMode: boolean;
  onBack: () => void;
  onSaveRoute: (route: DeliveryRoute) => Promise<void>;
}

type WorkingStop = DeliveryStop & { lat: number; lng: number };

function StopCard({ stop, sale, isDarkMode, index }: { stop: WorkingStop; sale?: Sale; isDarkMode: boolean; index: number }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={stop}
      dragListener={false}
      dragControls={controls}
      className={`flex items-center gap-3 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
    >
      <div
        onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
        className={`p-2.5 rounded-xl cursor-grab active:cursor-grabbing select-none touch-none ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} text-slate-400`}
      >
        <GripVertical size={18} />
      </div>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black text-white ${stop.priority === 'URGENT' ? 'bg-rose-600' : 'bg-teal-600'}`}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {sale?.customerName || sale?.orderNumber || 'Pedido'}
        </p>
        <p className="text-[10px] font-bold text-slate-400 truncate">
          Pedido #{sale?.orderNumber} {stop.priority === 'URGENT' && '· URGENTE'}
        </p>
      </div>
    </Reorder.Item>
  );
}

export default function DeliveryRouteBuilderView({ sales, products, stockLots, isDarkMode, onBack, onSaveRoute }: DeliveryRouteBuilderViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orderedStops, setOrderedStops] = useState<WorkingStop[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);
  const [reverseRoadRoute, setReverseRoadRoute] = useState<RoadRouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [roadRouteError, setRoadRouteError] = useState<string | null>(null);
  const [showStreetList, setShowStreetList] = useState(false);

  // Origem real (GPS do aparelho) — de onde a entrega de fato começa. Sem ela, cai no
  // centro geográfico dos próprios pedidos selecionados como aproximação (ver
  // fallbackOrigin abaixo), que nunca soube de onde o motorista realmente estava saindo.
  const [realOrigin, setRealOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingOrigin, setIsLocatingOrigin] = useState(false);
  const [originError, setOriginError] = useState<string | null>(null);

  const fetchRealOrigin = async () => {
    setIsLocatingOrigin(true);
    setOriginError(null);
    try {
      await Geolocation.requestPermissions().catch(() => undefined);
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      setRealOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setOriginError('Não foi possível obter sua localização — usando o centro dos pedidos como ponto de partida aproximado.');
    } finally {
      setIsLocatingOrigin(false);
    }
  };

  // Busca a localização assim que a tela abre — pronta antes mesmo de "Otimizar Rota"
  // pra já usar a origem real no cálculo, não só na exibição depois.
  useEffect(() => { fetchRealOrigin(); }, []);

  // Sem localização real disponível (permissão negada, GPS indisponível), cai no centro
  // geográfico dos pedidos selecionados — aproximação, não o ponto de partida de verdade.
  const fallbackOrigin = useMemo(() => {
    if (!orderedStops || orderedStops.length === 0) return null;
    return {
      lat: orderedStops.reduce((s, p) => s + p.lat, 0) / orderedStops.length,
      lng: orderedStops.reduce((s, p) => s + p.lng, 0) / orderedStops.length,
    };
  }, [orderedStops]);

  const previewOrigin = realOrigin || fallbackOrigin;

  const previewMarkers = useMemo(() => {
    const stopMarkers = (orderedStops || []).map((s, i) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      color: s.priority === 'URGENT' ? '#e11d48' : '#0d9488',
      number: i + 1,
      label: sales.find(sale => sale.id === s.saleId)?.customerName || `Parada ${i + 1}`,
    }));
    if (!previewOrigin) return stopMarkers;
    return [{ id: 'origin', lat: previewOrigin.lat, lng: previewOrigin.lng, color: '#2563eb', label: 'Partida' }, ...stopMarkers];
  }, [orderedStops, sales, previewOrigin]);

  // Calcula o trajeto seguindo ruas de verdade (OSRM) só quando a prévia está aberta —
  // refaz sozinho se a ordem das paradas mudar enquanto o mapa está visível. Falha
  // graciosamente pra linha reta se o serviço de rota estiver fora (ver render abaixo).
  // Depois do trajeto principal, calcula TAMBÉM o trajeto com as paradas na ordem
  // invertida — só pra comparar a distância e mostrar se a ordem atual é mesmo a melhor
  // (ou a única alternativa possível, no caso de 2 paradas). Roda em sequência (não em
  // paralelo) pra não sobrecarregar o servidor público do OSRM; se falhar, some o selo
  // de comparação sem afetar a exibição do trajeto principal.
  useEffect(() => {
    if (!showMapPreview || !previewOrigin || !orderedStops || orderedStops.length === 0) return;
    let cancelled = false;
    setIsLoadingRoute(true);
    setRoadRouteError(null);
    setReverseRoadRoute(null);
    const stopCoords = orderedStops.map(s => ({ lat: s.lat, lng: s.lng }));

    (async () => {
      try {
        const result = await getRoadRoute(previewOrigin, stopCoords);
        if (cancelled) return;
        if (!result) { setRoadRouteError('Não foi possível calcular o trajeto pelas ruas agora — mostrando linha reta entre os pontos.'); setRoadRoute(null); return; }
        setRoadRoute(result);

        if (stopCoords.length > 1) {
          try {
            const reverse = await getRoadRoute(previewOrigin, [...stopCoords].reverse());
            if (!cancelled) setReverseRoadRoute(reverse);
          } catch {
            // comparação é um extra — falhar aqui não deve afetar o trajeto já exibido.
          }
        }
      } catch {
        if (!cancelled) { setRoadRouteError('Não foi possível calcular o trajeto pelas ruas agora — mostrando linha reta entre os pontos.'); setRoadRoute(null); }
      } finally {
        if (!cancelled) setIsLoadingRoute(false);
      }
    })();

    return () => { cancelled = true; };
  }, [showMapPreview, previewOrigin, orderedStops]);

  // Compara a distância real (pelas ruas) da ordem atual contra a ordem invertida — a
  // única outra alternativa possível com 2 paradas, e ainda assim um bom sinal com mais.
  // Diferença menor que 50m é tratada como empate (arredondamento/variação de rota).
  const optimizationBadge = useMemo(() => {
    if (!roadRoute || !reverseRoadRoute) return null;
    const diff = reverseRoadRoute.totalDistanceMeters - roadRoute.totalDistanceMeters;
    if (Math.abs(diff) < 50) return { type: 'equal' as const };
    if (diff > 0) return { type: 'better' as const, deltaMeters: diff };
    return { type: 'worse' as const, deltaMeters: -diff };
  }, [roadRoute, reverseRoadRoute]);

  const stopLabel = (i: number) => (i === 0 ? 'Origem' : `Parada ${i}`);

  const { prontos } = useMemo(() => bucketSalesByReadiness(sales, stockLots, products), [sales, stockLots, products]);

  const eligibleSales = useMemo(
    () => prontos.filter(s => s.deliveryAddress?.lat !== undefined && s.deliveryAddress?.lng !== undefined),
    [prontos]
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    setOrderedStops(null);
  };

  const handleOptimize = () => {
    const chosen = eligibleSales.filter(s => selected.has(s.id));
    if (chosen.length === 0) return;

    const stops: WorkingStop[] = chosen.map(s => ({
      id: generateId(),
      saleId: s.id,
      order: 0,
      lat: s.deliveryAddress!.lat!,
      lng: s.deliveryAddress!.lng!,
      priority: s.deliveryPriority === 'URGENT' ? 'URGENT' : 'NORMAL',
      status: 'PENDING',
    }));

    // Usa a localização real do aparelho (buscada ao abrir a tela) como ponto de partida
    // sempre que disponível — sem ela, cai no centro geográfico dos próprios pontos
    // selecionados como aproximação (ver fetchRealOrigin/fallbackOrigin acima).
    const origin = realOrigin || {
      lat: stops.reduce((s, p) => s + p.lat, 0) / stops.length,
      lng: stops.reduce((s, p) => s + p.lng, 0) / stops.length,
    };

    const optimized = optimizeRoute(origin, stops);
    setOrderedStops(optimized as WorkingStop[]);
  };

  const handleSave = async () => {
    if (!orderedStops || orderedStops.length === 0) return;
    setIsSaving(true);
    try {
      const finalStops = orderedStops.map((s, i) => ({ ...s, order: i }));
      const origin = realOrigin || {
        lat: finalStops.reduce((s, p) => s + p.lat, 0) / finalStops.length,
        lng: finalStops.reduce((s, p) => s + p.lng, 0) / finalStops.length,
      };
      const route: DeliveryRoute = {
        id: generateId(),
        createdAt: Date.now(),
        date: Date.now(),
        originLat: origin.lat,
        originLng: origin.lng,
        stops: finalStops,
        status: 'DRAFT',
        optimizedAt: Date.now(),
      };
      await onSaveRoute(route);
      toast.show('Rota salva com sucesso.');
    } catch (err: any) {
      toast.show(err?.message || 'Erro ao salvar a rota.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full pb-32">
      <div className="flex justify-between items-center px-2 pt-2 pb-4">
        <button onClick={onBack} title="Voltar" aria-label="Voltar para o menu de Entregas"
          className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'} shadow-sm`}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Montar Rota</h1>
        <div className="w-9" />
      </div>

      <div className={`flex items-center gap-2 mx-1 mb-4 px-4 py-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        {isLocatingOrigin ? (
          <>
            <Loader2 size={15} className="animate-spin text-teal-600 shrink-0" />
            <p className="text-[10px] font-bold text-slate-400">Obtendo sua localização atual...</p>
          </>
        ) : realOrigin ? (
          <>
            <LocateFixed size={15} className="text-teal-600 shrink-0" />
            <p className="flex-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Partindo de: <span className="font-black text-slate-700 dark:text-slate-200">sua localização atual</span>
            </p>
            <button type="button" onClick={fetchRealOrigin} className="text-[9px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 shrink-0">
              Atualizar
            </button>
          </>
        ) : (
          <>
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <p className="flex-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {originError || 'Localização não disponível — usando o centro dos pedidos como partida aproximada.'}
            </p>
            <button type="button" onClick={fetchRealOrigin} className="text-[9px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 shrink-0">
              Tentar Novamente
            </button>
          </>
        )}
      </div>

      {eligibleSales.length === 0 ? (
        <div className={`flex-1 flex flex-col items-center justify-center gap-3 p-8 rounded-3xl border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
          <MapPin size={32} strokeWidth={1.5} />
          <p className="text-xs font-bold uppercase tracking-widest">Nenhum pedido pronto com localização marcada</p>
          <p className="text-[10px] font-bold max-w-xs">Marque a localização de entrega nos cards de Vendas (pedidos com status "Venda" e prontos pra expedir) pra eles aparecerem aqui.</p>
        </div>
      ) : !orderedStops ? (
        <div className="flex flex-col gap-3 px-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
            Selecione os pedidos ({eligibleSales.length} disponíveis)
          </p>
          {eligibleSales.map(sale => {
            const isSelected = selected.has(sale.id);
            return (
              <button
                key={sale.id}
                type="button"
                onClick={() => toggleSelect(sale.id)}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${isSelected ? (isDarkMode ? 'bg-teal-900/20 border-teal-700' : 'bg-teal-50 border-teal-200') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}`}
              >
                <div
                  role="checkbox"
                  aria-checked={isSelected}
                  className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center ${isSelected ? 'bg-teal-600 border-teal-600' : (isDarkMode ? 'border-slate-700' : 'border-slate-200')}`}
                >
                  {isSelected && <CheckCircle2 size={14} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {sale.customerName || 'Cliente'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 truncate">
                    Pedido #{sale.orderNumber} {sale.deliveryPriority === 'URGENT' && '· URGENTE'}
                  </p>
                </div>
              </button>
            );
          })}

          {selected.size > 0 && (
            <div className={`flex flex-col gap-3 px-5 py-4 mt-2 rounded-2xl border ${isDarkMode ? 'bg-teal-950/30 border-teal-800' : 'bg-teal-50 border-teal-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white">
                  {selected.size} selecionado{selected.size > 1 ? 's' : ''}
                </span>
                <button type="button" onClick={() => setSelected(new Set())} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  Limpar
                </button>
              </div>
              <button
                type="button"
                onClick={handleOptimize}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.98] transition-all"
              >
                <RouteIcon size={14} />
                Otimizar Rota
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-1">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {orderedStops.length} parada{orderedStops.length > 1 ? 's' : ''} — arraste pra reordenar
            </p>
            <button type="button" onClick={() => setOrderedStops(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              Refazer seleção
            </button>
          </div>

          <Reorder.Group axis="y" values={orderedStops} onReorder={setOrderedStops} className="flex flex-col gap-2">
            {orderedStops.map((stop, i) => (
              <StopCard key={stop.id} stop={stop} sale={sales.find(s => s.id === stop.saleId)} isDarkMode={isDarkMode} index={i} />
            ))}
          </Reorder.Group>

          <button
            type="button"
            onClick={() => setShowMapPreview(v => !v)}
            className={`flex items-center justify-center gap-2 px-4 py-3 mt-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-[0.98] ${
              showMapPreview
                ? 'bg-teal-600 border-teal-600 text-white'
                : isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-600'
            }`}
          >
            <MapIcon size={14} />
            {showMapPreview ? 'Ocultar Rota no Mapa' : 'Visualizar Rota no Mapa'}
          </button>

          {showMapPreview && previewOrigin && (
            <>
              <DeliveryMap
                isDarkMode={isDarkMode}
                height={280}
                markers={previewMarkers}
                polyline={
                  roadRoute && roadRoute.coordinates.length > 1
                    ? roadRoute.coordinates
                    : [previewOrigin, ...orderedStops.map(s => ({ lat: s.lat, lng: s.lng }))]
                }
              />

              {isLoadingRoute && (
                <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-bold text-slate-400">
                  <Loader2 size={13} className="animate-spin" /> Calculando trajeto pelas ruas...
                </div>
              )}

              {!isLoadingRoute && roadRouteError && (
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 px-1">{roadRouteError}</p>
              )}

              {!isLoadingRoute && roadRoute && (
                <div className={`flex flex-col rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <button
                    type="button"
                    onClick={() => setShowStreetList(v => !v)}
                    className="flex items-center justify-between gap-2 px-4 py-3"
                  >
                    <span className="flex items-center gap-2">
                      <Milestone size={14} className="text-teal-600 shrink-0" />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {formatDistance(roadRoute.totalDistanceMeters)} · {formatDuration(roadRoute.totalDurationSeconds)}
                      </span>
                    </span>
                    {showStreetList ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </button>

                  {showStreetList && (
                    <div className="flex flex-col gap-3 px-4 pb-4">
                      {roadRoute.legs.map((leg, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-teal-600">
                            {stopLabel(i)} → {stopLabel(i + 1)} · {formatDistance(leg.distanceMeters)} · {formatDuration(leg.durationSeconds)}
                          </p>
                          {leg.steps.map((step, si) => (
                            <p key={si} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pl-2">
                              {step.maneuver} <span className="font-black text-slate-700 dark:text-slate-200">{step.streetName}</span>
                              {step.distanceMeters > 0 && ` — ${formatDistance(step.distanceMeters)}`}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isLoadingRoute && optimizationBadge && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold ${
                  optimizationBadge.type === 'worse'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {optimizationBadge.type === 'better' && (
                    <><CheckCircle2 size={13} className="shrink-0" /> Rota otimizada — {formatDistance(optimizationBadge.deltaMeters)} mais curta que a ordem inversa.</>
                  )}
                  {optimizationBadge.type === 'worse' && (
                    <><AlertTriangle size={13} className="shrink-0" /> A ordem inversa seria {formatDistance(optimizationBadge.deltaMeters)} mais curta — considere arrastar pra reordenar.</>
                  )}
                  {optimizationBadge.type === 'equal' && (
                    <><CheckCircle2 size={13} className="shrink-0" /> Distância igual nos dois sentidos.</>
                  )}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-4 py-3.5 mt-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            <Navigation size={14} />
            {isSaving ? 'Salvando...' : 'Salvar Rota'}
          </button>
        </div>
      )}
    </div>
  );
}
