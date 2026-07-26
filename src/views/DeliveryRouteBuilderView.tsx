import { useEffect, useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { Geolocation } from '@capacitor/geolocation';
import { ArrowLeft, GripVertical, Route as RouteIcon, MapPin, CheckCircle2, Navigation, Map as MapIcon, Loader2, ChevronDown, ChevronUp, Milestone, AlertTriangle, LocateFixed, X, Plus, Hospital, Fuel, Wrench, MapPinned } from 'lucide-react';
import { Carrier, DeliveryRoute, DeliveryStop, Product, Sale, StockLot } from '../types';
import { bucketSalesByReadiness } from '../utils/salesReadiness';
import { optimizeRoute } from '../utils/deliveryRouteOptimizer';
import { getRoadRoute, RoadRouteResult } from '../utils/deliveryRoadRoute';
import { searchNearbyPOI, POICategory, POIResult, POI_CATEGORY_LABELS } from '../utils/deliveryPoiSearch';
import { generateId } from '../utils/id';
import { toast } from '../utils/toast';
import DeliveryMap from '../components/DeliveryMap';
import Modal from '../components/Modal';

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
  carriers: Carrier[];
  isDarkMode: boolean;
  onBack: () => void;
  onSaveRoute: (route: DeliveryRoute) => Promise<void>;
  // Veio de "Enviar para Entrega" (card da venda) — já chega com esse pedido marcado.
  initialSelectedSaleId?: string;
}

type WorkingStop = DeliveryStop & { lat: number; lng: number };

function StopCard({ stop, sale, stopSales, carrierName, isDarkMode, index }: { stop: WorkingStop; sale?: Sale; stopSales?: Sale[]; carrierName?: string; isDarkMode: boolean; index: number }) {
  const controls = useDragControls();
  const customerNames = (stopSales && stopSales.length > 1) ? stopSales.map(s => s.customerName || 'cliente').join(', ') : undefined;
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
          {carrierName ? `${carrierName} (transportadora)` : (stop.label || sale?.customerName || sale?.orderNumber || 'Pedido')}
        </p>
        <p className="text-[10px] font-bold text-slate-400 truncate">
          {stop.saleId
            ? (customerNames
                ? `${stopSales!.length} pedidos · p/ ${customerNames}`
                : <>Pedido #{sale?.orderNumber} {carrierName && `· p/ ${sale?.customerName || 'cliente'}`}</>)
            : 'Parada manual'} {stop.priority === 'URGENT' && '· URGENTE'}
        </p>
      </div>
    </Reorder.Item>
  );
}

export default function DeliveryRouteBuilderView({ sales, products, stockLots, carriers, isDarkMode, onBack, onSaveRoute, initialSelectedSaleId }: DeliveryRouteBuilderViewProps) {
  const [selected, setSelected] = useState<Set<string>>(() => initialSelectedSaleId ? new Set([initialSelectedSaleId]) : new Set());
  // Ocultar da lista é só uma escolha da sessão atual (ex.: "esse aqui não vai nessa
  // leva") — não mexe no pedido nem na transportadora/endereço dele, some do App.tsx
  // ao sair e voltar pra tela.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const hideFromList = (id: string) => {
    setHiddenIds(prev => new Set(prev).add(id));
    setSelected(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  // Paradas manuais (hospital, posto, oficina, ou um ponto qualquer marcado no mapa) —
  // não têm pedido nenhum atrelado, só um lugar por onde o motorista precisa passar.
  const [manualStops, setManualStops] = useState<{ id: string; label: string; lat: number; lng: number }[]>([]);
  const [isManualStopOpen, setIsManualStopOpen] = useState(false);
  const [manualStopMode, setManualStopMode] = useState<'poi' | 'map'>('poi');
  const [poiCategory, setPoiCategory] = useState<POICategory | null>(null);
  const [poiResults, setPoiResults] = useState<POIResult[]>([]);
  const [isSearchingPoi, setIsSearchingPoi] = useState(false);
  const [poiError, setPoiError] = useState<string | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<POIResult | null>(null);
  const [poiStopLabel, setPoiStopLabel] = useState('');
  const [mapPickedPoint, setMapPickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [mapStopLabel, setMapStopLabel] = useState('');
  const [mapFlySignal, setMapFlySignal] = useState(0);
  const [isLocatingManualStop, setIsLocatingManualStop] = useState(false);

  const removeManualStop = (id: string) => setManualStops(prev => prev.filter(m => m.id !== id));

  const openManualStopModal = () => {
    setManualStopMode('poi');
    setPoiCategory(null);
    setPoiResults([]);
    setPoiError(null);
    setSelectedPoi(null);
    setPoiStopLabel('');
    setMapPickedPoint(null);
    setMapStopLabel('');
    setIsManualStopOpen(true);
  };

  const addManualStop = (label: string, lat: number, lng: number) => {
    setManualStops(prev => [...prev, { id: generateId(), label, lat, lng }]);
    setIsManualStopOpen(false);
  };

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

  // Botão "Usar Minha Localização" do modal de Parada Manual — reaproveita `realOrigin`
  // se já tiver sido obtido (busca automática acima), só pede o GPS de novo se ainda não
  // tiver (permissão negada/demorou) ou se o usuário quiser atualizar.
  const useMyLocationForManualStop = async () => {
    setIsLocatingManualStop(true);
    try {
      let loc = realOrigin;
      if (!loc) {
        await Geolocation.requestPermissions().catch(() => undefined);
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
        loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setRealOrigin(loc);
      }
      setMapPickedPoint(loc);
      setMapFlySignal(s => s + 1);
    } catch {
      toast.show('Não foi possível obter sua localização agora.');
    } finally {
      setIsLocatingManualStop(false);
    }
  };

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
    const stopMarkers = (orderedStops || []).map((s, i) => {
      const stopSale = sales.find(sale => sale.id === s.saleId);
      const carrierName = stopSale?.carrierId ? carriers.find(c => c.id === stopSale.carrierId)?.name : undefined;
      const stopLabel = carrierName
        ? `${carrierName}${(s.saleIds?.length || 0) > 1 ? ` (${s.saleIds!.length} pedidos)` : ''}`
        : (stopSale?.customerName || s.label || `Parada ${i + 1}`);
      return {
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        color: s.priority === 'URGENT' ? '#e11d48' : '#0d9488',
        number: i + 1,
        label: stopLabel,
      };
    });
    if (!previewOrigin) return stopMarkers;
    return [{ id: 'origin', lat: previewOrigin.lat, lng: previewOrigin.lng, color: '#2563eb', label: 'Partida' }, ...stopMarkers];
  }, [orderedStops, sales, carriers, previewOrigin]);

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

  // Pedido com transportadora escolhida continua indo pela rota — o motorista leva ATÉ a
  // transportadora, que faz a última milha depois. Nesse caso a parada usa o endereço
  // CADASTRADO da transportadora como destino, não o endereço do cliente final.
  const getStopLocation = (sale: Sale): { lat: number; lng: number } | null => {
    if (sale.carrierId) {
      const carrier = carriers.find(c => c.id === sale.carrierId);
      if (carrier?.address?.lat !== undefined && carrier?.address?.lng !== undefined) {
        return { lat: carrier.address.lat, lng: carrier.address.lng };
      }
      return null;
    }
    if (sale.deliveryAddress?.lat !== undefined && sale.deliveryAddress?.lng !== undefined) {
      return { lat: sale.deliveryAddress.lat, lng: sale.deliveryAddress.lng };
    }
    return null;
  };

  const eligibleSales = useMemo(
    () => prontos.filter(s => getStopLocation(s) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prontos, carriers]
  );

  const visibleSales = useMemo(() => eligibleSales.filter(s => !hiddenIds.has(s.id)), [eligibleSales, hiddenIds]);

  // Pedido que veio de "Enviar para Entrega" (card da venda) mas não apareceu na lista —
  // sem isso o usuário só via a lista vazia/sem o item, sem entender o motivo real.
  const preselectedMissingSale = useMemo(() => {
    if (!initialSelectedSaleId) return null;
    if (eligibleSales.some(s => s.id === initialSelectedSaleId)) return null;
    const sale = sales.find(s => s.id === initialSelectedSaleId);
    if (!sale) return null;
    const reason = sale.deliveryStatus === 'DELIVERED'
      ? 'ele já está marcado como entregue.'
      : !prontos.some(s => s.id === sale.id)
      ? 'ele ainda não está pronto pra expedir — falta separar as caixas ou repor estoque pra esse pedido.'
      : 'a localização de entrega dele não tem coordenadas válidas (endereço do cliente ou da transportadora sem pin no mapa).';
    return { sale, reason };
  }, [initialSelectedSaleId, eligibleSales, sales, prontos]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    setOrderedStops(null);
  };

  // Centro pra basear a busca de POI por perto: pedidos já escolhidos, senão outras
  // paradas manuais já adicionadas, senão a localização real do aparelho — sem nenhum
  // desses, não dá pra saber "perto de onde" procurar.
  const manualStopSearchCenter = useMemo(() => {
    const chosenLocs = eligibleSales.filter(s => selected.has(s.id)).map(getStopLocation).filter((l): l is { lat: number; lng: number } => l !== null);
    if (chosenLocs.length > 0) {
      return { lat: chosenLocs.reduce((s, p) => s + p.lat, 0) / chosenLocs.length, lng: chosenLocs.reduce((s, p) => s + p.lng, 0) / chosenLocs.length };
    }
    if (manualStops.length > 0) {
      return { lat: manualStops.reduce((s, p) => s + p.lat, 0) / manualStops.length, lng: manualStops.reduce((s, p) => s + p.lng, 0) / manualStops.length };
    }
    return realOrigin;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleSales, selected, manualStops, realOrigin]);

  const runPoiSearch = async (category: POICategory) => {
    if (!manualStopSearchCenter) return;
    setPoiCategory(category);
    setIsSearchingPoi(true);
    setPoiError(null);
    setPoiResults([]);
    setSelectedPoi(null);
    setPoiStopLabel('');
    try {
      const results = await searchNearbyPOI(category, manualStopSearchCenter);
      setPoiResults(results);
      if (results.length === 0) setPoiError('Nenhum local encontrado nesse raio — tente outra categoria.');
    } catch {
      setPoiError('Não foi possível buscar agora — verifique sua conexão e tente de novo.');
    } finally {
      setIsSearchingPoi(false);
    }
  };

  const handleOptimize = () => {
    const chosen = eligibleSales.filter(s => selected.has(s.id));
    if (chosen.length === 0 && manualStops.length === 0) return;

    // Dois ou mais pedidos pra MESMA transportadora caem no mesmo endereço físico — em vez
    // de uma parada duplicada por pedido (motorista "visitando" o mesmo lugar várias vezes
    // na lista), agrupa numa parada só com todos os pedidos daquela transportadora.
    const directSales: Sale[] = [];
    const carrierGroups = new Map<string, Sale[]>();
    chosen.forEach(s => {
      if (s.carrierId) {
        const arr = carrierGroups.get(s.carrierId) || [];
        arr.push(s);
        carrierGroups.set(s.carrierId, arr);
      } else {
        directSales.push(s);
      }
    });

    const stops: WorkingStop[] = [
      ...directSales.map((s): WorkingStop => {
        const loc = getStopLocation(s)!;
        return {
          id: generateId(),
          saleId: s.id,
          saleIds: [s.id],
          order: 0,
          lat: loc.lat,
          lng: loc.lng,
          priority: s.deliveryPriority === 'URGENT' ? 'URGENT' : 'NORMAL',
          status: 'PENDING',
        };
      }),
      ...Array.from(carrierGroups.values()).map((group): WorkingStop => {
        const loc = getStopLocation(group[0])!;
        return {
          id: generateId(),
          saleId: group[0].id,
          saleIds: group.map(s => s.id),
          order: 0,
          lat: loc.lat,
          lng: loc.lng,
          priority: group.some(s => s.deliveryPriority === 'URGENT') ? 'URGENT' : 'NORMAL',
          status: 'PENDING',
        };
      }),
      ...manualStops.map((m): WorkingStop => ({
        id: m.id,
        label: m.label,
        order: 0,
        lat: m.lat,
        lng: m.lng,
        priority: 'NORMAL',
        status: 'PENDING',
      })),
    ];

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

      {preselectedMissingSale && (
        <div className={`flex items-start gap-2 mx-1 mb-4 px-4 py-3 rounded-2xl border ${isDarkMode ? 'bg-amber-950/40 border-amber-900' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
            O pedido #{preselectedMissingSale.sale.orderNumber} ({preselectedMissingSale.sale.customerName}) não apareceu na lista abaixo porque {preselectedMissingSale.reason}
          </p>
        </div>
      )}

      {eligibleSales.length === 0 && manualStops.length === 0 && !orderedStops ? (
        <div className={`flex-1 flex flex-col items-center justify-center gap-3 p-8 rounded-3xl border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
          <MapPin size={32} strokeWidth={1.5} />
          <p className="text-xs font-bold uppercase tracking-widest">Nenhum pedido pronto com localização marcada</p>
          <p className="text-[10px] font-bold max-w-xs">Marque a localização de entrega nos cards de Vendas (pedidos com status "Venda" e prontos pra expedir) pra eles aparecerem aqui, ou adicione uma parada manual abaixo.</p>
          <button
            type="button"
            onClick={openManualStopModal}
            className="flex items-center justify-center gap-2 px-4 py-3 mt-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-teal-600 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all"
          >
            <Plus size={14} />
            Adicionar Parada Manual
          </button>
        </div>
      ) : !orderedStops ? (
        <div className="flex flex-col gap-3 px-1">
          {eligibleSales.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Selecione os pedidos ({visibleSales.length} disponíveis)
                </p>
                {hiddenIds.size > 0 && (
                  <button type="button" onClick={() => setHiddenIds(new Set())} className="text-[9px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 shrink-0">
                    Mostrar {hiddenIds.size} ocultado{hiddenIds.size > 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {visibleSales.length === 0 && (
                <div className={`flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
                  <p className="text-[10px] font-bold">Todos os pedidos disponíveis foram retirados dessa lista.</p>
                </div>
              )}
            </>
          )}
          {visibleSales.map(sale => {
            const isSelected = selected.has(sale.id);
            const carrierName = sale.carrierId ? carriers.find(c => c.id === sale.carrierId)?.name : undefined;
            return (
              <div
                key={sale.id}
                className={`flex items-center gap-1 rounded-2xl border transition-all ${isSelected ? (isDarkMode ? 'bg-teal-900/20 border-teal-700' : 'bg-teal-50 border-teal-200') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(sale.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 p-4 text-left"
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
                      {carrierName && ` · via ${carrierName}`}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  title="Retirar das entregas"
                  aria-label="Retirar das entregas"
                  onClick={(e) => { e.stopPropagation(); hideFromList(sale.id); }}
                  className={`p-2 mr-3 rounded-xl shrink-0 transition-all ${isDarkMode ? 'text-slate-600 hover:text-rose-400 hover:bg-rose-900/20' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-2 px-1 mt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Paradas Manuais{manualStops.length > 0 && ` (${manualStops.length})`}
            </p>
          </div>

          {manualStops.map(m => (
            <div key={m.id} className={`flex items-center gap-1 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex-1 min-w-0 flex items-center gap-3 p-4">
                <div className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                  <MapPinned size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{m.label}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate">Parada manual</p>
                </div>
              </div>
              <button
                type="button"
                title="Remover parada"
                aria-label="Remover parada"
                onClick={() => removeManualStop(m.id)}
                className={`p-2 mr-3 rounded-xl shrink-0 transition-all ${isDarkMode ? 'text-slate-600 hover:text-rose-400 hover:bg-rose-900/20' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
              >
                <X size={16} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={openManualStopModal}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-dashed transition-all active:scale-[0.98] ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Plus size={14} />
            Adicionar Parada Manual
          </button>

          {(selected.size > 0 || manualStops.length > 0) && (
            <div className={`flex flex-col gap-3 px-5 py-4 mt-2 rounded-2xl border ${isDarkMode ? 'bg-teal-950/30 border-teal-800' : 'bg-teal-50 border-teal-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white">
                  {selected.size + manualStops.length} parada{selected.size + manualStops.length > 1 ? 's' : ''} selecionada{selected.size + manualStops.length > 1 ? 's' : ''}
                </span>
                <button type="button" onClick={() => { setSelected(new Set()); setManualStops([]); }} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
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
            {orderedStops.map((stop, i) => {
              const stopSales = (stop.saleIds && stop.saleIds.length > 0 ? stop.saleIds : (stop.saleId ? [stop.saleId] : []))
                .map(id => sales.find(s => s.id === id))
                .filter((s): s is Sale => !!s);
              const stopSale = stopSales[0];
              const carrierName = stopSale?.carrierId ? carriers.find(c => c.id === stopSale.carrierId)?.name : undefined;
              return (
                <StopCard key={stop.id} stop={stop} sale={stopSale} stopSales={stopSales} carrierName={carrierName} isDarkMode={isDarkMode} index={i} />
              );
            })}
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

      <Modal
        isOpen={isManualStopOpen}
        onClose={() => setIsManualStopOpen(false)}
        title="Adicionar Parada Manual"
        icon={<MapPinned size={20} />}
        maxWidth="max-w-lg"
        closeLabel="Cancelar"
      >
        <div className="flex flex-col gap-4">
          <div className={`flex rounded-xl p-1 gap-1 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <button
              type="button"
              onClick={() => setManualStopMode('poi')}
              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${manualStopMode === 'poi' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}
            >
              Ponto de Interesse
            </button>
            <button
              type="button"
              onClick={() => setManualStopMode('map')}
              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${manualStopMode === 'map' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}
            >
              Escolher no Mapa
            </button>
          </div>

          {manualStopMode === 'poi' ? (
            <div className="flex flex-col gap-3">
              {!manualStopSearchCenter ? (
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  Selecione ao menos um pedido, adicione outra parada manual, ou espere sua localização carregar pra buscar pontos por perto.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {(['hospital', 'fuel', 'workshop'] as POICategory[]).map(cat => {
                      const Icon = cat === 'hospital' ? Hospital : cat === 'fuel' ? Fuel : Wrench;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => runPoiSearch(cat)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${poiCategory === cat ? (isDarkMode ? 'bg-teal-900/20 border-teal-700' : 'bg-teal-50 border-teal-200') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}`}
                        >
                          <Icon size={18} className={poiCategory === cat ? 'text-teal-600' : 'text-slate-400'} />
                          <span className="text-[9px] font-black uppercase tracking-widest text-center">{POI_CATEGORY_LABELS[cat]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isSearchingPoi && (
                    <div className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold text-slate-400">
                      <Loader2 size={14} className="animate-spin" /> Buscando por perto...
                    </div>
                  )}

                  {!isSearchingPoi && poiError && (
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{poiError}</p>
                  )}

                  {!isSearchingPoi && poiResults.length > 0 && (
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto force-scrollbar">
                      {poiResults.map(poi => {
                        const isSelected = selectedPoi?.id === poi.id;
                        return (
                          <button
                            key={poi.id}
                            type="button"
                            onClick={() => { setSelectedPoi(poi); setPoiStopLabel(poi.name); }}
                            className={`flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all ${isSelected ? (isDarkMode ? 'bg-teal-900/20 border-teal-700' : 'bg-teal-50 border-teal-200') : (isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-teal-700' : 'bg-white border-slate-100 hover:border-teal-200')}`}
                          >
                            <span className="text-xs font-bold truncate">{poi.name}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{poi.distanceKm.toFixed(1)} km</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedPoi && (
                    <div className="flex flex-col gap-2 pt-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome da parada</label>
                      <input
                        type="text"
                        value={poiStopLabel}
                        onChange={(e) => setPoiStopLabel(e.target.value)}
                        className={`w-full h-12 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-teal-500 rounded-2xl px-4 text-sm font-bold transition-all outline-none dark:text-white`}
                      />
                      <button
                        type="button"
                        disabled={!poiStopLabel.trim()}
                        onClick={() => addManualStop(poiStopLabel.trim() || selectedPoi.name, selectedPoi.lat, selectedPoi.lng)}
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
                      >
                        <Plus size={14} />
                        Adicionar Parada
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-400">Toque no mapa pra marcar o ponto exato da parada.</p>
                <button
                  type="button"
                  disabled={isLocatingManualStop}
                  onClick={useMyLocationForManualStop}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 disabled:opacity-60 shrink-0 transition-all"
                >
                  {isLocatingManualStop ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
                  Usar Meu Local
                </button>
              </div>
              <DeliveryMap
                isDarkMode={isDarkMode}
                height={260}
                marker={mapPickedPoint}
                onMarkerChange={(lat, lng) => setMapPickedPoint({ lat, lng })}
                flyTo={mapPickedPoint ? { lat: mapPickedPoint.lat, lng: mapPickedPoint.lng, signal: mapFlySignal } : null}
                fallbackCenter={manualStopSearchCenter || undefined}
              />
              <input
                type="text"
                placeholder="Nome da parada (opcional)"
                value={mapStopLabel}
                onChange={(e) => setMapStopLabel(e.target.value)}
                className={`w-full h-12 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-teal-500 rounded-2xl px-4 text-sm font-bold transition-all outline-none dark:text-white`}
              />
              <button
                type="button"
                disabled={!mapPickedPoint}
                onClick={() => mapPickedPoint && addManualStop(mapStopLabel.trim() || 'Parada Manual', mapPickedPoint.lat, mapPickedPoint.lng)}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
              >
                <Plus size={14} />
                Adicionar Parada
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
