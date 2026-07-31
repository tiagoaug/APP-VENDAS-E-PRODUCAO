import { useEffect, useMemo, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Navigation, Circle, MapPin, Radio, RotateCcw, Waypoints, Loader2, Camera as CameraIcon, Trash2, Share2, X, Plus, PlayCircle, Timer, Milestone, Pencil, GripVertical, CheckCircle2, StickyNote, ListChecks } from 'lucide-react';
import { Carrier, DeliveryRoute, DeliveryStop, Product, Sale, SaleType, StockLot } from '../types';
import DeliveryMap from '../components/DeliveryMap';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import NavigationProviderModal from '../components/NavigationProviderModal';
import { openNavigation, buildGoogleMapsUrl, type NavigationProvider } from '../utils/deliveryNavLink';
import { optimizeRoute, haversineKm } from '../utils/deliveryRouteOptimizer';
import { getRoadRoute, RoadRouteResult } from '../utils/deliveryRoadRoute';
import { bucketSalesByReadiness } from '../utils/salesReadiness';
import { getSaleStopLocations } from '../utils/deliverySaleStops';
import { generateId } from '../utils/id';
import { photoToCompressedImage, CompressedImage } from '../utils/aiImageUtils';
import { toast } from '../utils/toast';

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

interface DeliveryRouteDetailViewProps {
  route: DeliveryRoute;
  sales: Sale[];
  products: Product[];
  stockLots: StockLot[];
  carriers: Carrier[];
  isDarkMode: boolean;
  onBack: () => void;
  // Um array — normalmente 1 pedido, mas pode ter vários quando a parada é de uma
  // transportadora com mais de um pedido agrupado (ver DeliveryStop.saleIds).
  onMarkDelivered: (stopId: string, saleIds: string[]) => Promise<void>;
  onUndoDelivered: (stopId: string, saleIds: string[]) => Promise<void>;
  onUpdateStops: (stops: DeliveryStop[]) => Promise<void>;
  // Igual a onUpdateStops, mas também sincroniza Sale.deliveryRouteId dos pedidos
  // acrescentados/retirados na edição — onUpdateStops sozinho só grava a rota em si, então
  // usar ele pra adicionar/remover deixaria a venda "presa" (ou "solta") sem refletir a
  // mudança, quebrando o filtro de "já está em outra rota" do próximo Editar Rota.
  onEditRouteStops: (stops: DeliveryStop[], addedSaleIds: string[], removedSaleIds: string[]) => Promise<void>;
  onUpdateDriverLocation?: (lat: number, lng: number) => Promise<void>;
  onDeleteRoute: () => Promise<void>;
  onStartRoute: () => Promise<void>;
  // Provedor de navegação preferido do colaborador ativo (Collaborator.deliveryNavProviderPref)
  // — só pré-destaca uma opção no popup de escolha (NavigationProviderModal), nunca dispara
  // navegação sozinho.
  deliveryNavProviderPref?: string;
  // Configuração de "Navegação Integrada" (Configurações de Entrega → Preferências de
  // Navegação → Aproximação da Parada) — usados abaixo pra acelerar o foco do mapa perto da
  // parada e pra decidir quando recalcular a rota OSRM automaticamente (ver efeito de
  // watchPosition mais abaixo). Sem SDK nativo nenhum — tudo web, sem custo de API.
  approachDistanceMeters?: number;
  approachFastUpdateMs?: number;
  approachFarUpdateMs?: number;
}

// Uma linha arrastável do editor de rota — separado em componente próprio (igual ao
// StopCard do Montar Rota) pra useDragControls funcionar por item, não pro grupo inteiro.
function EditStopRow({ stop, sale, carrierName, extraCount, isDarkMode, index, onRemove }: {
  stop: DeliveryStop; sale?: Sale; carrierName?: string; extraCount?: number; isDarkMode: boolean; index: number; onRemove: () => void;
}) {
  const controls = useDragControls();
  const isDelivered = stop.status === 'DELIVERED';
  return (
    <Reorder.Item
      value={stop}
      dragListener={false}
      dragControls={controls}
      className={`flex items-center gap-3 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
    >
      <div
        onPointerDown={(e) => { if (isDelivered) return; e.preventDefault(); controls.start(e); }}
        className={`p-2 rounded-xl shrink-0 select-none touch-none ${isDelivered ? 'opacity-30' : `cursor-grab active:cursor-grabbing ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`} text-slate-400`}
      >
        <GripVertical size={16} />
      </div>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black text-white ${isDelivered ? 'bg-emerald-600' : stop.priority === 'URGENT' ? 'bg-rose-600' : 'bg-teal-600'}`}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {carrierName ? `${carrierName} (transportadora)` : (stop.label || sale?.customerName || 'Cliente')}
          {stop.addressLabel && ` · ${stop.addressLabel}`}
        </p>
        <p className="text-[10px] font-bold text-slate-400 truncate">
          {stop.saleId
            ? `Pedido #${sale?.orderNumber}${extraCount ? ` + ${extraCount} pedido${extraCount > 1 ? 's' : ''}` : ''}`
            : 'Parada manual'} {isDelivered && '· ENTREGUE'}
        </p>
      </div>
      {!isDelivered && (
        <button type="button" onClick={onRemove} title="Remover parada" className="p-2 rounded-xl shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
          <X size={16} />
        </button>
      )}
    </Reorder.Item>
  );
}

// Linha arrastável da lista principal "Fazer entrega no app" — deixa reordenar a rota
// direto por aqui (arrastando pelo grip), sem precisar abrir o modal "Editar Rota" só
// pra mudar a ordem. Paradas já entregues ficam com o grip inerte (mesmo padrão do
// EditStopRow) — não faz sentido arrastar algo que já foi visitado.
function LiveStopRow({ stop, index, sale, stopSales, carrierName, isDarkMode, isMarking, onDragEnd, onOpenPhoto, onToggleDelivered, onOpenNote, onOpenItems }: {
  stop: DeliveryStop; index: number; sale?: Sale; stopSales: Sale[]; carrierName?: string;
  isDarkMode: boolean; isMarking: boolean; onDragEnd: () => void; onOpenPhoto: () => void; onToggleDelivered: () => void; onOpenNote: () => void; onOpenItems?: () => void;
}) {
  const controls = useDragControls();
  const isDelivered = stop.status === 'DELIVERED';
  const customerNames = stopSales.length > 1 ? stopSales.map(s => s.customerName || 'cliente').join(', ') : undefined;
  return (
    <Reorder.Item
      value={stop}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 p-4 rounded-2xl border ${isDelivered ? (isDarkMode ? 'bg-emerald-900/10 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}`}
    >
      <div
        onPointerDown={(e) => { if (isDelivered) return; e.preventDefault(); controls.start(e); }}
        className={`p-2 rounded-xl shrink-0 select-none touch-none ${isDelivered ? 'opacity-30' : `cursor-grab active:cursor-grabbing ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`} text-slate-400`}
      >
        <GripVertical size={16} />
      </div>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black text-white ${isDelivered ? 'bg-emerald-600' : stop.priority === 'URGENT' ? 'bg-rose-600' : 'bg-teal-600'}`}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {carrierName ? `${carrierName} (transportadora)` : (stop.label || sale?.customerName || 'Cliente')}
          {stop.addressLabel && ` · ${stop.addressLabel}`}
        </p>
        <p className="text-[10px] font-bold text-slate-400 truncate">
          {stop.saleId
            ? (customerNames
                ? `${stopSales.length} pedidos · p/ ${customerNames}`
                : <>Pedido #{sale?.orderNumber} {carrierName && `· p/ ${sale?.customerName || 'cliente'}`}</>)
            : 'Parada manual'} {stop.priority === 'URGENT' && '· URGENTE'}
        </p>
        {stop.note && (
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 truncate mt-0.5">{stop.note}</p>
        )}
      </div>
      <div className="flex items-center gap-1 p-1 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm shrink-0">
        {onOpenItems && ((stop.deliveryItems && stop.deliveryItems.length > 0) || stop.deliveryItemsNote) && (
          <button
            type="button"
            onClick={onOpenItems}
            className="w-8 h-8 flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full active:scale-90 transition-all"
            title="Itens na entrega"
          >
            <ListChecks size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenNote}
          className="relative w-8 h-8 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-full active:scale-90 transition-all"
          title="Observações da parada"
        >
          <StickyNote size={15} />
          {(stop.note || stop.deliveryItemsNote) && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3 h-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-rose-500" />
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenPhoto}
          className="w-8 h-8 flex items-center justify-center bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-full active:scale-90 transition-all"
          title="Fotos da entrega"
        >
          <CameraIcon size={15} />
        </button>
        <button
          type="button"
          disabled={isMarking}
          onClick={onToggleDelivered}
          className={`w-8 h-8 flex items-center justify-center rounded-full active:scale-90 transition-all disabled:opacity-50 ${isDelivered ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}
          title={isDelivered ? 'Marcar como não entregue' : 'Marcar como entregue'}
        >
          {isDelivered ? <RotateCcw size={15} /> : <Circle size={17} />}
        </button>
      </div>
    </Reorder.Item>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}min`;
  return `${m}min${String(s).padStart(2, '0')}s`;
}

// Espaçamento mínimo entre gravações da posição do motorista — evita gerar uma
// escrita no banco a cada segundo enquanto o GPS reporta.
const LOCATION_WRITE_INTERVAL_MS = 15000;

// "Navegação Integrada" — ver efeito de watchPosition mais abaixo.
const APPROACH_DEFAULT_DISTANCE_METERS = 150;
const APPROACH_DEFAULT_FAST_UPDATE_MS = 1000;
// Cadência de checagem enquanto NENHUMA parada está dentro da distância de aproximação —
// mais espaçada, sem sentido recalcular/focar o mapa toda hora longe de qualquer parada.
const APPROACH_FAR_CHECK_MS = 5000;
// Quão longe do traçado sugerido (OSRM) o motorista precisa estar pra considerarmos que
// "saiu da rota" e disparar um recálculo automático — abaixo disso é só imprecisão normal
// de GPS, não desvio de verdade.
const REROUTE_DEVIATION_METERS = 70;
// Espaçamento mínimo entre recálculos automáticos — o OSRM público é gratuito mas
// compartilhado; sem esse limite, cada atualização de GPS fora da rota dispararia uma
// chamada nova.
const REROUTE_MIN_INTERVAL_MS = 20000;

// Distância aproximada (metros) de um ponto até o traçado da rota — usa o vértice mais
// próximo entre os pontos do polyline (o OSRM devolve pontos densos o bastante ao longo das
// curvas pra isso ser uma boa aproximação, sem precisar projetar em cada segmento).
function distanceToPolylineMeters(point: { lat: number; lng: number }, polyline: { lat: number; lng: number }[]): number {
  if (polyline.length === 0) return Infinity;
  let min = Infinity;
  for (const p of polyline) {
    const d = haversineKm(point, p) * 1000;
    if (d < min) min = d;
  }
  return min;
}

function timeAgoLabel(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)}h`;
}

export default function DeliveryRouteDetailView({ route, sales, products, stockLots, carriers, isDarkMode, onBack, onMarkDelivered, onUndoDelivered, onUpdateStops, onEditRouteStops, onUpdateDriverLocation, onDeleteRoute, onStartRoute, deliveryNavProviderPref, approachDistanceMeters, approachFastUpdateMs, approachFarUpdateMs }: DeliveryRouteDetailViewProps) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  // "Navegação Integrada" — foco do mapa perto da parada + recálculo automático de rota ao
  // sair do trajeto sugerido (ver efeito de watchPosition abaixo). `focusSignal` incrementa
  // a cada vez que queremos forçar o mapa a voar pra `focusStop` (mesmo padrão de
  // DeliveryMap's `flyTo`/FlyToOnSignal).
  const [focusStop, setFocusStop] = useState<{ lat: number; lng: number } | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const lastApproachCheckAtRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  // Waze e Apple Maps só navegam pra 1 destino por vez (ao contrário do Google Maps, que já
  // mostra a rota inteira) — guarda qual foi o último provedor escolhido pra, ao marcar uma
  // entrega como concluída, oferecer ir direto pra próxima parada nesse mesmo app.
  const [lastProvider, setLastProvider] = useState<NavigationProvider | null>(null);
  const [nextStopSuggestion, setNextStopSuggestion] = useState<{ stop: DeliveryStop; label: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStops, setEditStops] = useState<DeliveryStop[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [photoStop, setPhotoStop] = useState<{ id: string; sale?: Sale } | null>(null);
  const [photoQueue, setPhotoQueue] = useState<CompressedImage[]>([]);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isSharingPhotos, setIsSharingPhotos] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);
  const roadRouteRef = useRef(roadRoute);
  useEffect(() => { roadRouteRef.current = roadRoute; });
  const [isLoadingRoadRoute, setIsLoadingRoadRoute] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lastWriteAtRef = useRef(0);

  // Observações da parada (ex.: "deixar na portaria", "ligar antes de chegar") — editadas
  // numa cópia local até "Salvar", só então grava em route.stops via onUpdateStops.
  const [noteStop, setNoteStop] = useState<DeliveryStop | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Checklist de itens da parada (cadastrado no card da venda, ver Sale.deliveryItems) —
  // só visualização aqui, não dá pra editar na tela de entrega. As marcações abaixo são só
  // locais (não persistem) — servem de apoio visual pra conferência física na hora, não pra
  // rastrear separação/estoque de verdade.
  const [itemsStop, setItemsStop] = useState<DeliveryStop | null>(null);
  const [checkedItemIndexes, setCheckedItemIndexes] = useState<Set<number>>(new Set());

  // Ordem sendo arrastada na lista principal (fora do modal "Editar Rota") — null fora de
  // um arrasto, quando a ordem exibida vem direto de `route.stops` (fonte da verdade).
  // Assim que o arrasto termina, grava a nova ordem e volta a `null` — o próprio
  // snapshot do Firestore já reflete a ordem nova, e o efeito de recálculo de trajeto
  // (mais abaixo, dependente de `orderedStops`) dispara sozinho quando ela muda.
  const [dragOrder, setDragOrder] = useState<DeliveryStop[] | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Relógio ao vivo do tempo decorrido — só roda enquanto a rota está em andamento
  // (congela sozinho quando conclui, ver completedAt/onMarkDelivered em App.tsx).
  useEffect(() => {
    if (route.status !== 'IN_PROGRESS') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [route.status]);

  const orderedStops = [...route.stops].sort((a, b) => a.order - b.order);
  // Espelha em refs pro callback do watchPosition (efeito com deps fixas, ver mais abaixo)
  // sempre ler o valor mais recente sem precisar reiniciar o watch a cada mudança.
  const orderedStopsRef = useRef(orderedStops);
  useEffect(() => { orderedStopsRef.current = orderedStops; });
  // Enquanto um arrasto está em andamento (ou acabou de terminar e ainda não veio o
  // snapshot novo do Firestore), mostra a ordem local — sem isso a lista "pularia" de
  // volta pra ordem antiga por um instante a cada arrasto.
  const displayStops = dragOrder ?? orderedStops;
  const deliveredCount = orderedStops.filter(s => s.status === 'DELIVERED').length;
  const nextStop = orderedStops.find(s => s.status !== 'DELIVERED');
  const nextStopSale = nextStop ? sales.find(s => s.id === nextStop.saleId) : undefined;

  // Rótulo de exibição de uma parada (nome da transportadora + clientes agrupados nela, ou
  // nome do cliente + endereço extra) — reaproveitado pelo marker no mapa, pela sugestão de
  // "próxima parada" e pela exportação da rota, pra não duplicar essa lógica em 3 lugares.
  // Uma parada de transportadora com 2+ pedidos agrupados mostra os nomes dos clientes
  // (mesmo padrão de LiveStopRow's `customerNames`), não só a contagem — importante saber
  // quem está naquela entrega antes de sair navegando ou compartilhar a rota.
  const getStopLabel = (s: DeliveryStop, indexHint = 0): string => {
    const stopSaleIds = s.saleIds && s.saleIds.length > 0 ? s.saleIds : (s.saleId ? [s.saleId] : []);
    const stopSales = stopSaleIds.map(id => sales.find(sale => sale.id === id)).filter((sale): sale is Sale => !!sale);
    const stopSale = stopSales[0];
    const effectiveCarrierId = s.carrierId || stopSale?.carrierId;
    const carrierName = effectiveCarrierId ? carriers.find(c => c.id === effectiveCarrierId)?.name : undefined;
    if (carrierName) {
      const customerNames = stopSales.length > 1 ? stopSales.map(sale => sale.customerName || 'cliente').join(', ') : undefined;
      return `${carrierName}${customerNames ? ` (${stopSales.length} pedidos · p/ ${customerNames})` : ''}${s.addressLabel ? ` · ${s.addressLabel}` : ''}`;
    }
    return `${stopSale?.customerName || s.label || `Parada ${indexHint + 1}`}${s.addressLabel ? ` · ${s.addressLabel}` : ''}`;
  };

  const stopMarkers = [
    ...orderedStops.map((s, i) => {
      const label = getStopLabel(s, i);
      return {
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        color: s.status === 'DELIVERED' ? '#16a34a' : s.priority === 'URGENT' ? '#e11d48' : '#0d9488',
        number: i + 1,
        label,
      };
    }),
    ...(route.driverLocation ? [{ id: 'driver', lat: route.driverLocation.lat, lng: route.driverLocation.lng, color: '#2563eb' }] : []),
  ];

  // Chave estável da composição das paradas (id+posição+ordem) — `orderedStops` é um
  // array novo a cada render (vem de `.sort()` sobre route.stops), então usá-lo direto
  // como dependência do efeito abaixo faria recalcular a rota em TODO render (inclusive
  // quando só a localização do motorista muda a cada poucos segundos).
  const stopsKey = orderedStops.map(s => `${s.id}:${s.lat}:${s.lng}:${s.order}`).join('|');

  // Trajeto seguindo ruas de verdade (OSRM) — mesmo padrão do Montar Rota. Recalcula
  // sozinho quando a composição/ordem das paradas muda (entrega marcada, "Recalcular
  // Rota"), mas NÃO a cada atualização de driverLocation (evitaria dezenas de chamadas
  // ao serviço público de rota enquanto o GPS reporta a cada 15s).
  useEffect(() => {
    if (orderedStops.length === 0) return;
    let cancelled = false;
    setIsLoadingRoadRoute(true);
    getRoadRoute({ lat: route.originLat, lng: route.originLng }, orderedStops.map(s => ({ lat: s.lat, lng: s.lng })))
      .then(result => { if (!cancelled) setRoadRoute(result); })
      .catch(() => { if (!cancelled) setRoadRoute(null); })
      .finally(() => { if (!cancelled) setIsLoadingRoadRoute(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, route.originLat, route.originLng]);

  // Enquanto esta tela estiver aberta (o motorista fazendo a entrega), reporta a
  // posição atual pra quem estiver acompanhando a rota — só funciona com o app aberto
  // em primeiro plano; ao fechar/trocar de app, para de atualizar (retoma sozinho
  // quando reaberto, sem precisar de nenhuma configuração extra).
  useEffect(() => {
    if (!onUpdateDriverLocation || route.status === 'COMPLETED') return;
    let watchId: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        await Geolocation.requestPermissions().catch(() => undefined);
        watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, (position, err) => {
          if (cancelled) return;
          if (err || !position) {
            setLocationError('Não foi possível obter a localização — verifique a permissão de localização do app.');
            return;
          }
          setLocationError(null);
          const now = Date.now();
          const currentPos = { lat: position.coords.latitude, lng: position.coords.longitude };

          // "Navegação Integrada" (Configurações de Entrega → Preferências de Navegação):
          // foco do mapa perto da parada + recálculo automático de rota ao sair do trajeto
          // sugerido, mantendo os MESMOS destinos. Roda com frequência própria, independente
          // do throttle de gravação no Firestore logo abaixo.
          const pendingStops = orderedStopsRef.current.filter(s => s.status !== 'DELIVERED');
          if (pendingStops.length > 0) {
            const nearestStop = pendingStops[0];
            const distanceToStopM = haversineKm(currentPos, { lat: nearestStop.lat, lng: nearestStop.lng }) * 1000;
            const isNear = distanceToStopM <= (approachDistanceMeters ?? APPROACH_DEFAULT_DISTANCE_METERS);
            const checkIntervalMs = isNear ? (approachFastUpdateMs ?? APPROACH_DEFAULT_FAST_UPDATE_MS) : (approachFarUpdateMs ?? APPROACH_FAR_CHECK_MS);
            if (now - lastApproachCheckAtRef.current >= checkIntervalMs) {
              lastApproachCheckAtRef.current = now;
              if (isNear) {
                setFocusStop({ lat: nearestStop.lat, lng: nearestStop.lng });
                setFocusSignal(s => s + 1);
              }
            }

            const currentRoadRoute = roadRouteRef.current;
            if (currentRoadRoute && now - lastRerouteAtRef.current >= REROUTE_MIN_INTERVAL_MS) {
              const deviationM = distanceToPolylineMeters(currentPos, currentRoadRoute.coordinates);
              if (deviationM > REROUTE_DEVIATION_METERS) {
                lastRerouteAtRef.current = now;
                getRoadRoute(currentPos, pendingStops.map(s => ({ lat: s.lat, lng: s.lng })))
                  .then(result => {
                    if (cancelled || !result) return;
                    setRoadRoute(result);
                    toast.show('Rota recalculada');
                  })
                  .catch(() => undefined);
              }
            }
          }

          if (now - lastWriteAtRef.current < LOCATION_WRITE_INTERVAL_MS) return;
          lastWriteAtRef.current = now;
          onUpdateDriverLocation(currentPos.lat, currentPos.lng).catch(() => undefined);
        });
      } catch {
        if (!cancelled) setLocationError('Não foi possível acessar a localização do dispositivo.');
      }
    })();

    return () => {
      cancelled = true;
      if (watchId) Geolocation.clearWatch({ id: watchId }).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id, route.status]);

  const handleMark = async (stopId: string, saleIds: string[]) => {
    setMarkingId(stopId);
    try {
      await onMarkDelivered(stopId, saleIds);
      // Waze/Apple Maps só levam a 1 destino por vez — oferece ir direto pra próxima parada
      // pendente no mesmo app, já que ele não mostra a rota inteira sozinho.
      if (lastProvider === 'waze' || lastProvider === 'apple_maps') {
        const remaining = orderedStops.filter(s => s.id !== stopId && s.status !== 'DELIVERED');
        if (remaining.length > 0) {
          const next = remaining[0];
          setNextStopSuggestion({ stop: next, label: getStopLabel(next) });
        }
      }
    } finally {
      setMarkingId(null);
    }
  };

  // Compartilha a rota inteira (todas as paradas pendentes, em ordem) pelo menu nativo de
  // compartilhamento — cobre apps fora da lista fixa do popup (Waze/Google Maps/Apple Maps)
  // e serve pra mandar a lista de endereços pra alguém. Inclui o link do Google Maps com
  // TODAS as paradas (esse já suporta múltiplos waypoints numa URL só).
  const handleExportRoute = async () => {
    const pending = orderedStops.filter(s => s.status !== 'DELIVERED');
    if (pending.length === 0) {
      toast.show('Nenhuma parada pendente pra exportar.');
      return;
    }
    const lines = pending.map((s, i) => {
      const label = getStopLabel(s, i);
      return `${i + 1}. ${label} — https://maps.google.com/?q=${s.lat},${s.lng}`;
    });
    const mapsUrl = buildGoogleMapsUrl(pending.map(s => ({ lat: s.lat, lng: s.lng })));
    const text = `Rota de Entrega (${pending.length} parada${pending.length > 1 ? 's' : ''})\n\n${lines.join('\n')}`;
    try {
      await Share.share({ title: 'Rota de Entrega', text, url: mapsUrl || undefined, dialogTitle: 'Compartilhar rota' });
    } catch {
      // Cancelamento do share pelo usuário também cai aqui — não é erro, não avisa nada.
    }
  };

  // Abre o seletor nativo "abrir com..." do Android pra PRÓXIMA parada pendente, via
  // esquema geo: — é o intent padrão que TODO app de navegação instalado (Waze, Google
  // Maps, ou qualquer outro) se registra pra atender, ao contrário do menu de
  // compartilhamento de texto (Share.share acima), que só alcança apps de mensagem/e-mail.
  // Só cobre 1 parada por vez — mesma limitação do geo: em si.
  const handleOpenAnyApp = () => {
    if (Capacitor.getPlatform() !== 'android') {
      toast.show('"Outro app" disponível apenas no Android — use Exportar Rota nesta plataforma.');
      return;
    }
    const pending = orderedStops.filter(s => s.status !== 'DELIVERED');
    if (pending.length === 0) {
      toast.show('Nenhuma parada pendente.');
      return;
    }
    const next = pending[0];
    const label = encodeURIComponent(getStopLabel(next));
    window.open(`geo:${next.lat},${next.lng}?q=${next.lat},${next.lng}(${label})`, '_system');
  };

  const handleUndo = async (stopId: string, saleIds: string[]) => {
    setMarkingId(stopId);
    try {
      await onUndoDelivered(stopId, saleIds);
    } finally {
      setMarkingId(null);
    }
  };

  const openNoteModal = (stop: DeliveryStop) => {
    setNoteStop(stop);
    setNoteText(stop.note || '');
  };

  const handleSaveNote = async () => {
    if (!noteStop) return;
    setIsSavingNote(true);
    try {
      const trimmed = noteText.trim();
      const newStops = orderedStops.map(s => s.id === noteStop.id ? { ...s, note: trimmed || undefined } : s);
      await onUpdateStops(newStops);
      setNoteStop(null);
    } catch (error: any) {
      toast.show(error?.message || 'Erro ao salvar a observação.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Reotimiza só as paradas ainda pendentes (as já entregues ficam fixas, sem sentido
  // revisitar), partindo da posição atual do motorista se já houver uma reportada —
  // mais preciso que reusar a origem original, já traz a rota alinhada com onde ele
  // realmente está agora.
  const handleRecalculate = async () => {
    const pending = orderedStops.filter(s => s.status !== 'DELIVERED');
    const delivered = orderedStops.filter(s => s.status === 'DELIVERED');
    if (pending.length === 0) return;
    setIsRecalculating(true);
    try {
      const origin = route.driverLocation
        ? { lat: route.driverLocation.lat, lng: route.driverLocation.lng }
        : { lat: route.originLat, lng: route.originLng };
      const reOptimized = optimizeRoute(origin, pending);
      const newStops = [...delivered, ...reOptimized].map((s, i) => ({ ...s, order: i }));
      await onUpdateStops(newStops);
    } finally {
      setIsRecalculating(false);
    }
  };

  // Grava a nova ordem assim que o usuário solta uma parada arrastada na lista principal
  // — recalcula os números da posição e persiste direto, sem precisar de um botão
  // "Salvar" separado (diferente do modal "Editar Rota", que também deixa adicionar/
  // remover pedidos e por isso tem confirmação própria).
  const persistDragOrder = async (stops: DeliveryStop[]) => {
    const withOrder = stops.map((s, i) => ({ ...s, order: i }));
    setIsSavingOrder(true);
    try {
      await onUpdateStops(withOrder);
    } finally {
      setIsSavingOrder(false);
      setDragOrder(null);
    }
  };

  // Fotos da entrega: acumula quantas forem necessárias numa fila só em memória (nada
  // é gravado no banco) e compartilha todas juntas de uma vez, numa única chamada do
  // compartilhamento nativo — evita abrir o WhatsApp (ou o app escolhido) uma vez por
  // foto. Fechar o popup sem compartilhar descarta a fila inteira.
  const handleCapturePhoto = async () => {
    setIsCapturingPhoto(true);
    try {
      const photo = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Base64, quality: 85, width: 1536 });
      const compressed = await photoToCompressedImage(photo);
      setPhotoQueue(prev => [...prev, compressed]);
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) return;
      toast.show(`Não foi possível tirar a foto: ${msg}`);
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const handleRemoveQueuedPhoto = (index: number) => {
    setPhotoQueue(prev => prev.filter((_, i) => i !== index));
  };

  const handleShareQueuedPhotos = async () => {
    if (!photoStop || photoQueue.length === 0) return;
    setIsSharingPhotos(true);
    try {
      const baseLabel = photoStop.sale?.orderNumber || photoStop.id;
      if (Capacitor.getPlatform() === 'web') {
        const files = await Promise.all(photoQueue.map(async (img, i) => {
          const blob = await (await fetch(img.dataUrl)).blob();
          return new File([blob], `entrega-${baseLabel}-${i + 1}.jpg`, { type: 'image/jpeg' });
        }));
        if (navigator.share && navigator.canShare?.({ files })) {
          await navigator.share({ files, title: `Entrega ${baseLabel}` });
        } else {
          files.forEach((file, i) => {
            const a = document.createElement('a');
            a.href = photoQueue[i].dataUrl;
            a.download = file.name;
            a.click();
          });
        }
      } else {
        const written = await Promise.all(photoQueue.map((img, i) =>
          Filesystem.writeFile({ path: `entrega-${baseLabel}-${i + 1}-${Date.now()}.jpg`, data: img.data, directory: Directory.Cache })
        ));
        await Share.share({ title: `Entrega ${baseLabel}`, files: written.map(w => w.uri) });
      }
      setPhotoStop(null);
      setPhotoQueue([]);
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) return;
      toast.show(`Não foi possível compartilhar as fotos: ${msg}`);
    } finally {
      setIsSharingPhotos(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteRoute();
    } catch (error: any) {
      toast.show(error?.message || 'Erro ao excluir a rota.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Editor de rota: acrescentar/retirar paradas ou reordenar sem precisar apagar e
  // remontar a rota inteira. Trabalha numa cópia local (editStops) até "Salvar Alterações".
  const openEditModal = () => {
    setEditStops(orderedStops.map(s => ({ ...s })));
    setShowEditModal(true);
  };

  // Pedidos prontos pra entrega, com localização marcada, que ainda não estão nesta
  // edição — e que não estão reservados em OUTRA rota (deliveryRouteId de outro id).
  const eligibleToAdd = useMemo(() => {
    const { prontos } = bucketSalesByReadiness(sales, stockLots, products);
    const editStopSaleIds = new Set(editStops.map(s => s.saleId));
    return prontos.filter(s =>
      getSaleStopLocations(s, carriers).length > 0 &&
      !editStopSaleIds.has(s.id) &&
      (!s.deliveryRouteId || s.deliveryRouteId === route.id)
    );
  }, [sales, stockLots, products, editStops, route.id, carriers]);

  // Acrescenta UMA parada por endereço do pedido (principal + adicionais) — mesmo padrão
  // do Montar Rota (ver getSaleStopLocations).
  const handleAddStopToEdit = (sale: Sale) => {
    const locs = getSaleStopLocations(sale, carriers);
    if (locs.length === 0) return;
    setEditStops(prev => [
      ...prev,
      ...locs.map((loc, i): DeliveryStop => ({
        id: generateId(),
        saleId: sale.id,
        saleIds: [sale.id],
        order: prev.length + i,
        lat: loc.lat,
        lng: loc.lng,
        priority: sale.deliveryPriority === 'URGENT' ? 'URGENT' : 'NORMAL',
        status: 'PENDING',
        ...(loc.addressLabel ? { addressLabel: loc.addressLabel } : {}),
        ...(loc.carrierId ? { carrierId: loc.carrierId } : {}),
        ...(loc.deliveryItems ? { deliveryItems: loc.deliveryItems } : {}),
        ...(loc.deliveryItemsNote ? { deliveryItemsNote: loc.deliveryItemsNote } : {}),
      })),
    ]);
  };

  const handleRemoveStopFromEdit = (stopId: string) => {
    setEditStops(prev => prev.filter(s => s.id !== stopId));
  };

  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    try {
      const finalStops = editStops.map((s, i) => ({ ...s, order: i }));
      // Achata pra TODOS os pedidos de cada parada — uma parada de transportadora
      // agrupada tem vários (ver DeliveryStop.saleIds), não só o `saleId` "principal".
      const flattenSaleIds = (stops: DeliveryStop[]) => stops.flatMap(s => s.saleIds && s.saleIds.length > 0 ? s.saleIds : (s.saleId ? [s.saleId] : []));
      const originalSaleIds = new Set(flattenSaleIds(orderedStops));
      const finalSaleIds = new Set(flattenSaleIds(finalStops));
      const addedSaleIds = flattenSaleIds(finalStops).filter(id => !originalSaleIds.has(id));
      const removedSaleIds = flattenSaleIds(orderedStops).filter(id => !finalSaleIds.has(id));
      await onEditRouteStops(finalStops, addedSaleIds, removedSaleIds);
      setShowEditModal(false);
      toast.show('Rota atualizada.');
    } catch (error: any) {
      toast.show(error?.message || 'Erro ao salvar alterações da rota.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="flex flex-col h-full pb-32">
      <div className="flex justify-between items-center px-2 pt-2 pb-4">
        <button onClick={onBack} title="Voltar" aria-label="Voltar"
          className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'} shadow-sm`}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Rota de Entrega</h1>
        <div className="flex items-center gap-2">
          <button onClick={openEditModal} title="Editar Rota" aria-label="Editar Rota"
            className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-teal-400' : 'bg-white text-teal-600'} shadow-sm`}>
            <Pencil size={18} />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} title="Excluir Rota" aria-label="Excluir Rota"
            className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-rose-500' : 'bg-white text-rose-500'} shadow-sm`}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-1">
        <div className={`px-4 py-2 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-teal-900/20 text-teal-400' : 'bg-teal-50 text-teal-700'}`}>
          {deliveredCount}/{orderedStops.length} paradas entregues
        </div>

        {route.status === 'DRAFT' ? (
          <button
            type="button"
            disabled={isStarting}
            onClick={async () => { setIsStarting(true); try { await onStartRoute(); } finally { setIsStarting(false); } }}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {isStarting ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            Iniciar Entregas
          </button>
        ) : (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-1.5">
              <Timer size={14} className="text-teal-600 shrink-0" />
              <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {formatElapsed((route.status === 'COMPLETED' ? (route.completedAt || now) : now) - (route.startedAt || now))}
              </span>
            </div>
            <span className={`w-px h-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className="flex items-center gap-1.5">
              <Milestone size={14} className="text-teal-600 shrink-0" />
              <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {roadRoute ? formatDistance(roadRoute.totalDistanceMeters) : isLoadingRoadRoute ? '...' : '—'}
              </span>
            </div>
            {route.status === 'COMPLETED' && (
              <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-emerald-600">Concluída</span>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {route.driverLocation && (
            <button
              type="button"
              onClick={() => setShowLiveModal(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-[0.98] ${isDarkMode ? 'border-teal-800 text-teal-400 hover:bg-teal-900/20' : 'border-teal-200 text-teal-700 hover:bg-teal-50'}`}
            >
              <Radio size={14} />
              Acompanhar ao Vivo
            </button>
          )}
          <button
            type="button"
            disabled={isRecalculating || deliveredCount >= orderedStops.length}
            onClick={handleRecalculate}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-[0.98] disabled:opacity-50 ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {isRecalculating ? <Loader2 size={14} className="animate-spin" /> : <Waypoints size={14} />}
            Recalcular Rota
          </button>
        </div>

        {locationError && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
            {locationError}
          </div>
        )}

        <DeliveryMap
          isDarkMode={isDarkMode}
          height={240}
          markers={stopMarkers}
          polyline={
            roadRoute && roadRoute.coordinates.length > 1
              ? roadRoute.coordinates
              : [{ lat: route.originLat, lng: route.originLng }, ...orderedStops.map(s => ({ lat: s.lat, lng: s.lng }))]
          }
          flyTo={focusStop ? { lat: focusStop.lat, lng: focusStop.lng, signal: focusSignal } : undefined}
        />

        <button
          type="button"
          onClick={() => setShowProviderPicker(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.98] transition-all"
        >
          <Navigation size={14} />
          Escolher Provedor
        </button>

        {showProviderPicker && (
          <NavigationProviderModal
            isDarkMode={isDarkMode}
            stops={orderedStops}
            preferredProvider={deliveryNavProviderPref}
            onSelect={(provider) => setLastProvider(provider)}
            onExportRoute={handleExportRoute}
            onOpenAnyApp={handleOpenAnyApp}
            onClose={() => setShowProviderPicker(false)}
          />
        )}

        {nextStopSuggestion && (
          <div className={`flex items-center justify-between gap-2 p-3 rounded-2xl border ${isDarkMode ? 'bg-teal-900/10 border-teal-800/40' : 'bg-teal-50 border-teal-100'}`}>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">Próxima parada</p>
              <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{nextStopSuggestion.label}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                openNavigation(lastProvider as 'waze' | 'apple_maps', [{ lat: nextStopSuggestion.stop.lat, lng: nextStopSuggestion.stop.lng }]);
                setNextStopSuggestion(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 active:scale-95 transition-all shrink-0"
            >
              <Navigation size={13} /> Navegar
            </button>
            <button type="button" onClick={() => setNextStopSuggestion(null)} aria-label="Dispensar" title="Dispensar"
              className="p-2 rounded-xl shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fazer entrega no app</p>
            {isSavingOrder && (
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-teal-600">
                <Loader2 size={11} className="animate-spin" /> Salvando ordem...
              </span>
            )}
          </div>
          {displayStops.length > 1 && (
            <p className="text-[9px] font-bold text-slate-400 px-1 -mt-1">Arraste pelo ícone pra reordenar a entrega.</p>
          )}
          <Reorder.Group axis="y" values={displayStops} onReorder={(next) => setDragOrder(next)} className="flex flex-col gap-2">
            {displayStops.map((stop, i) => {
              const stopSaleIds = stop.saleIds && stop.saleIds.length > 0 ? stop.saleIds : (stop.saleId ? [stop.saleId] : []);
              const stopSales = stopSaleIds.map(id => sales.find(s => s.id === id)).filter((s): s is Sale => !!s);
              const sale = stopSales[0];
              const effectiveCarrierId = stop.carrierId || sale?.carrierId;
              const carrierName = effectiveCarrierId ? carriers.find(c => c.id === effectiveCarrierId)?.name : undefined;
              return (
                <LiveStopRow
                  key={stop.id}
                  stop={stop}
                  index={i}
                  sale={sale}
                  stopSales={stopSales}
                  carrierName={carrierName}
                  isDarkMode={isDarkMode}
                  isMarking={markingId === stop.id}
                  onDragEnd={() => persistDragOrder(dragOrder ?? displayStops)}
                  onOpenPhoto={() => { setPhotoStop({ id: stop.id, sale }); setPhotoQueue([]); }}
                  onOpenNote={() => openNoteModal(stop)}
                  onOpenItems={() => { setItemsStop(stop); setCheckedItemIndexes(new Set()); }}
                  onToggleDelivered={() => stop.status === 'DELIVERED' ? handleUndo(stop.id, stopSaleIds) : handleMark(stop.id, stopSaleIds)}
                />
              );
            })}
          </Reorder.Group>
          {displayStops.length === 0 && (
            <div className={`flex flex-col items-center gap-2 p-8 rounded-3xl border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
              <MapPin size={28} strokeWidth={1.5} />
              <p className="text-xs font-bold uppercase tracking-widest">Rota sem paradas</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showLiveModal}
        onClose={() => setShowLiveModal(false)}
        title="Motorista ao Vivo"
        icon={<Radio size={20} />}
        maxWidth="max-w-3xl"
        closeLabel="Fechar"
      >
        {route.driverLocation && (
          <div className="flex flex-col gap-3">
            <div className={`px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
              <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {deliveredCount >= orderedStops.length ? 'Todas as entregas concluídas' : `Indo para: ${nextStop?.label || nextStopSale?.customerName || 'próxima parada'}`}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">
                Posição atualizada {timeAgoLabel(route.driverLocation.updatedAt)}
              </p>
            </div>
            <DeliveryMap
              isDarkMode={isDarkMode}
              height={420}
              markers={stopMarkers}
              polyline={
                roadRoute && roadRoute.coordinates.length > 1
                  ? roadRoute.coordinates
                  : [{ lat: route.originLat, lng: route.originLng }, ...orderedStops.map(s => ({ lat: s.lat, lng: s.lng }))]
              }
              flyTo={focusStop ? { lat: focusStop.lat, lng: focusStop.lng, signal: focusSignal } : undefined}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Excluir Rota"
        message={isDeleting ? 'Excluindo...' : 'Essa rota será apagada. Os pedidos continuam normalmente em Vendas — só a rota em si é excluída. Deseja continuar?'}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        isDanger
      />

      <Modal
        isOpen={!!photoStop}
        onClose={() => { setPhotoStop(null); setPhotoQueue([]); }}
        title="Fotos da Entrega"
        icon={<CameraIcon size={20} />}
        closeLabel="Descartar e Fechar"
      >
        <div className="flex flex-col gap-4">
          {photoQueue.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoQueue.map((img, i) => (
                <div key={i} className="relative rounded-2xl overflow-hidden aspect-square">
                  <img src={img.dataUrl} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveQueuedPhoto(i)}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-slate-900/70 text-white"
                    title="Remover foto"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={isCapturingPhoto}
            onClick={handleCapturePhoto}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-dashed transition-all active:scale-[0.98] disabled:opacity-50 ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {isCapturingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {photoQueue.length === 0 ? 'Tirar Foto' : 'Tirar Mais Uma Foto'}
          </button>

          {photoQueue.length > 0 && (
            <button
              type="button"
              disabled={isSharingPhotos}
              onClick={handleShareQueuedPhotos}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
            >
              {isSharingPhotos ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
              Compartilhar {photoQueue.length} Foto{photoQueue.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!noteStop}
        onClose={() => setNoteStop(null)}
        title="Observações da Parada"
        icon={<StickyNote size={20} />}
        maxWidth="max-w-lg"
        closeLabel="Cancelar"
      >
        <div className="flex flex-col gap-4">
          {noteStop?.deliveryItemsNote && (
            <div className={`flex flex-col gap-1 p-3 rounded-2xl border ${isDarkMode ? 'bg-orange-900/10 border-orange-800/40' : 'bg-orange-50 border-orange-200'}`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                Observação cadastrada na venda
              </span>
              <p className="text-xs font-bold text-orange-700 dark:text-orange-300">{noteStop.deliveryItemsNote}</p>
            </div>
          )}
          <textarea
            rows={4}
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ex: deixar na portaria, ligar antes de chegar, portão dos fundos..."
            className={`w-full ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-teal-500 rounded-2xl px-4 py-3 text-sm font-bold transition-all outline-none resize-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
          />
          <button
            type="button"
            disabled={isSavingNote}
            onClick={handleSaveNote}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {isSavingNote ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Salvar Observação
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={!!itemsStop}
        onClose={() => setItemsStop(null)}
        title="Itens na Entrega"
        icon={<ListChecks size={20} />}
        maxWidth="max-w-lg"
        closeLabel="Fechar"
      >
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-slate-400 px-1 mb-1">
            Cadastrado no card da venda — marque aqui só como apoio visual pra conferir na hora, não altera estoque nem o pedido.
          </p>
          {(itemsStop?.deliveryItems || []).map((item, idx) => {
            const product = products.find(p => p.id === item.productId);
            const variation = product?.variations.find(v => v.id === item.variationId);
            const unit = item.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
            const isChecked = checkedItemIndexes.has(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCheckedItemIndexes(prev => {
                  const next = new Set(prev);
                  next.has(idx) ? next.delete(idx) : next.add(idx);
                  return next;
                })}
                className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${isChecked ? (isDarkMode ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}`}
              >
                <div className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center ${isChecked ? 'bg-emerald-600 border-emerald-600' : (isDarkMode ? 'border-slate-700' : 'border-slate-200')}`}>
                  {isChecked && <CheckCircle2 size={14} className="text-white" />}
                </div>
                <div className={`min-w-0 flex-1 ${isChecked ? 'line-through opacity-60' : ''}`}>
                  <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {item.quantity} {unit} · {product?.reference && `${product.reference} · `}{product?.name}
                    {variation?.colorName && ` · ${variation.colorName}`}
                  </p>
                  {item.size && <p className="text-[10px] font-bold text-slate-400">Nº {item.size}</p>}
                </div>
              </button>
            );
          })}
          {itemsStop?.deliveryItemsNote && (
            <div className={`flex flex-col gap-1 p-3 mt-1 rounded-2xl border ${isDarkMode ? 'bg-orange-900/10 border-orange-800/40' : 'bg-orange-50 border-orange-200'}`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                Observação desta entrega
              </span>
              <p className="text-xs font-bold text-orange-700 dark:text-orange-300">{itemsStop.deliveryItemsNote}</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Rota"
        icon={<Pencil size={20} />}
        maxWidth="max-w-lg"
        closeLabel="Cancelar"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              {editStops.length} parada{editStops.length !== 1 ? 's' : ''} — arraste pra reordenar
            </p>
            <Reorder.Group axis="y" values={editStops} onReorder={setEditStops} className="flex flex-col gap-2">
              {editStops.map((stop, i) => {
                const sale = sales.find(s => s.id === stop.saleId);
                const effectiveCarrierId = stop.carrierId || sale?.carrierId;
                const carrierName = effectiveCarrierId ? carriers.find(c => c.id === effectiveCarrierId)?.name : undefined;
                const extraCount = (stop.saleIds?.length || 0) > 1 ? stop.saleIds!.length - 1 : 0;
                return (
                  <EditStopRow
                    key={stop.id}
                    stop={stop}
                    sale={sale}
                    carrierName={carrierName}
                    extraCount={extraCount}
                    isDarkMode={isDarkMode}
                    index={i}
                    onRemove={() => handleRemoveStopFromEdit(stop.id)}
                  />
                );
              })}
            </Reorder.Group>
            {editStops.length === 0 && (
              <p className="text-[10px] font-bold text-slate-400 text-center py-4">Nenhuma parada — adicione pedidos abaixo.</p>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              Adicionar Pedidos ({eligibleToAdd.length} disponíve{eligibleToAdd.length !== 1 ? 'is' : 'l'})
            </p>
            {eligibleToAdd.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400 px-1">Nenhum pedido pronto disponível pra adicionar agora.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto force-scrollbar">
                {eligibleToAdd.map(sale => (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => handleAddStopToEdit(sale)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-teal-700' : 'bg-white border-slate-100 hover:border-teal-200'}`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${isDarkMode ? 'bg-teal-900/30 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                      <Plus size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sale.customerName || 'Cliente'}</p>
                      <p className="text-[10px] font-bold text-slate-400 truncate">
                        Pedido #{sale.orderNumber} {sale.deliveryPriority === 'URGENT' && '· URGENTE'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isSavingEdit}
            onClick={handleSaveEdit}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Salvar Alterações
          </button>
        </div>
      </Modal>
    </div>
  );
}
