import { useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { ArrowLeft, GripVertical, Route as RouteIcon, MapPin, CheckCircle2, Navigation } from 'lucide-react';
import { DeliveryRoute, DeliveryStop, Product, Sale, StockLot } from '../types';
import { bucketSalesByReadiness } from '../utils/salesReadiness';
import { optimizeRoute } from '../utils/deliveryRouteOptimizer';
import { generateId } from '../utils/id';
import { toast } from '../utils/toast';

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

    // Sem origem configurada ainda (Configurações de Entrega, próxima etapa) — usa o
    // centro geográfico dos próprios pontos selecionados como âncora de partida, uma
    // aproximação razoável até a origem real (endereço da fábrica) ser cadastrada.
    const origin = {
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
      const origin = {
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
