import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Navigation, Circle, MapPin, Radio, RotateCcw, Waypoints, Loader2, Camera as CameraIcon, Trash2, Share2, X, Plus } from 'lucide-react';
import { DeliveryRoute, DeliveryStop, Sale } from '../types';
import DeliveryMap from '../components/DeliveryMap';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { openNavigation } from '../utils/deliveryNavLink';
import { optimizeRoute } from '../utils/deliveryRouteOptimizer';
import { photoToCompressedImage, CompressedImage } from '../utils/aiImageUtils';
import { toast } from '../utils/toast';

interface DeliveryRouteDetailViewProps {
  route: DeliveryRoute;
  sales: Sale[];
  isDarkMode: boolean;
  onBack: () => void;
  onMarkDelivered: (stopId: string, saleId: string) => Promise<void>;
  onUndoDelivered: (stopId: string, saleId: string) => Promise<void>;
  onUpdateStops: (stops: DeliveryStop[]) => Promise<void>;
  onUpdateDriverLocation?: (lat: number, lng: number) => Promise<void>;
  onDeleteRoute: () => Promise<void>;
}

// Espaçamento mínimo entre gravações da posição do motorista — evita gerar uma
// escrita no banco a cada segundo enquanto o GPS reporta.
const LOCATION_WRITE_INTERVAL_MS = 15000;

function timeAgoLabel(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)}h`;
}

export default function DeliveryRouteDetailView({ route, sales, isDarkMode, onBack, onMarkDelivered, onUndoDelivered, onUpdateStops, onUpdateDriverLocation, onDeleteRoute }: DeliveryRouteDetailViewProps) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [photoStop, setPhotoStop] = useState<{ id: string; sale?: Sale } | null>(null);
  const [photoQueue, setPhotoQueue] = useState<CompressedImage[]>([]);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isSharingPhotos, setIsSharingPhotos] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const lastWriteAtRef = useRef(0);

  const orderedStops = [...route.stops].sort((a, b) => a.order - b.order);
  const deliveredCount = orderedStops.filter(s => s.status === 'DELIVERED').length;
  const nextStop = orderedStops.find(s => s.status !== 'DELIVERED');
  const nextStopSale = nextStop ? sales.find(s => s.id === nextStop.saleId) : undefined;

  const stopMarkers = [
    ...orderedStops.map(s => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      color: s.status === 'DELIVERED' ? '#16a34a' : s.priority === 'URGENT' ? '#e11d48' : '#0d9488',
    })),
    ...(route.driverLocation ? [{ id: 'driver', lat: route.driverLocation.lat, lng: route.driverLocation.lng, color: '#2563eb' }] : []),
  ];

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
          if (now - lastWriteAtRef.current < LOCATION_WRITE_INTERVAL_MS) return;
          lastWriteAtRef.current = now;
          onUpdateDriverLocation(position.coords.latitude, position.coords.longitude).catch(() => undefined);
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

  const handleMark = async (stopId: string, saleId: string) => {
    setMarkingId(stopId);
    try {
      await onMarkDelivered(stopId, saleId);
    } finally {
      setMarkingId(null);
    }
  };

  const handleUndo = async (stopId: string, saleId: string) => {
    setMarkingId(stopId);
    try {
      await onUndoDelivered(stopId, saleId);
    } finally {
      setMarkingId(null);
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

  return (
    <div className="flex flex-col h-full pb-32">
      <div className="flex justify-between items-center px-2 pt-2 pb-4">
        <button onClick={onBack} title="Voltar" aria-label="Voltar"
          className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'} shadow-sm`}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Rota de Entrega</h1>
        <button onClick={() => setShowDeleteConfirm(true)} title="Excluir Rota" aria-label="Excluir Rota"
          className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-rose-500' : 'bg-white text-rose-500'} shadow-sm`}>
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-1">
        <div className={`px-4 py-2 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-teal-900/20 text-teal-400' : 'bg-teal-50 text-teal-700'}`}>
          {deliveredCount}/{orderedStops.length} paradas entregues
        </div>

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
          polyline={[{ lat: route.originLat, lng: route.originLng }, ...orderedStops.map(s => ({ lat: s.lat, lng: s.lng }))]}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openNavigation('google', orderedStops)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.98] transition-all"
          >
            <Navigation size={14} />
            Google Maps
          </button>
          <button
            type="button"
            onClick={() => openNavigation('apple', orderedStops)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-[0.98] ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Navigation size={14} />
            Apple Maps
          </button>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Fazer entrega no app</p>
          {orderedStops.map((stop, i) => {
            const sale = sales.find(s => s.id === stop.saleId);
            const isDelivered = stop.status === 'DELIVERED';
            return (
              <div
                key={stop.id}
                className={`flex items-center gap-3 p-4 rounded-2xl border ${isDelivered ? (isDarkMode ? 'bg-emerald-900/10 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black text-white ${isDelivered ? 'bg-emerald-600' : stop.priority === 'URGENT' ? 'bg-rose-600' : 'bg-teal-600'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {sale?.customerName || 'Cliente'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 truncate">
                    Pedido #{sale?.orderNumber} {stop.priority === 'URGENT' && '· URGENTE'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setPhotoStop({ id: stop.id, sale }); setPhotoQueue([]); }}
                  className={`p-2.5 rounded-xl shrink-0 transition-all ${isDarkMode ? 'text-slate-500 hover:text-teal-400 hover:bg-slate-800' : 'text-slate-400 hover:text-teal-600 hover:bg-slate-50'}`}
                  title="Fotos da entrega"
                >
                  <CameraIcon size={20} />
                </button>
                <button
                  type="button"
                  disabled={markingId === stop.id}
                  onClick={() => isDelivered ? handleUndo(stop.id, stop.saleId) : handleMark(stop.id, stop.saleId)}
                  className={`p-2.5 rounded-xl shrink-0 transition-all disabled:opacity-50 ${isDelivered ? 'text-emerald-600 hover:text-amber-600' : (isDarkMode ? 'text-slate-500 hover:text-teal-400 hover:bg-slate-800' : 'text-slate-400 hover:text-teal-600 hover:bg-slate-50')}`}
                  title={isDelivered ? 'Marcar como não entregue' : 'Marcar como entregue'}
                >
                  {isDelivered ? <RotateCcw size={20} /> : <Circle size={22} />}
                </button>
              </div>
            );
          })}
          {orderedStops.length === 0 && (
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
                {deliveredCount >= orderedStops.length ? 'Todas as entregas concluídas' : `Indo para: ${nextStopSale?.customerName || 'próxima parada'}`}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">
                Posição atualizada {timeAgoLabel(route.driverLocation.updatedAt)}
              </p>
            </div>
            <DeliveryMap
              isDarkMode={isDarkMode}
              height={420}
              markers={stopMarkers}
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
    </div>
  );
}
