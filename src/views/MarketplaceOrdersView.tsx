import { useEffect, useRef, useState } from 'react';
import { PackageCheck, PackageX, AlertTriangle, Clock, Search, Undo2, Tags as TagsIcon, ChevronRight } from 'lucide-react';
import { MarketplaceOrder, MarketplaceOrderStatus, ViewType } from '../types';
import { subscribeToMarketplaceOrders, importShopeeOrderManually, revertShopeeOrderReturn } from '../services/marketplaceService';
import { toast } from '../utils/toast';
import ConfirmDialog from '../components/ConfirmDialog';

interface MarketplaceOrdersViewProps {
  isDarkMode: boolean;
  onNavigate: (view: ViewType) => void;
}

const STATUS_CONFIG: Record<MarketplaceOrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING_IMPORT: { label: 'Aguardando Importação', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', icon: <Clock size={12} /> },
  PARTIALLY_MAPPED: { label: 'Falta Mapear SKU', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: <AlertTriangle size={12} /> },
  STOCK_DEBITED: { label: 'Estoque Debitado', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: <PackageCheck size={12} /> },
  RETURNED: { label: 'Devolvido', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', icon: <PackageX size={12} /> },
  ERROR: { label: 'Erro', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', icon: <AlertTriangle size={12} /> },
};

export default function MarketplaceOrdersView({ isDarkMode, onNavigate }: MarketplaceOrdersViewProps) {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [orderSn, setOrderSn] = useState('');
  const [importing, setImporting] = useState(false);
  const [returnTarget, setReturnTarget] = useState<MarketplaceOrder | null>(null);
  const seenDebited = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => subscribeToMarketplaceOrders((list) => {
    if (firstLoad.current) {
      list.forEach((o) => { if (o.status === 'STOCK_DEBITED') seenDebited.current.add(o.id); });
      firstLoad.current = false;
    } else {
      list.forEach((o) => {
        if (o.status === 'STOCK_DEBITED' && !seenDebited.current.has(o.id)) {
          seenDebited.current.add(o.id);
          toast.show(`Estoque debitado automaticamente — Pedido ${o.orderNumber} (${o.channel}).`);
        }
      });
    }
    setOrders(list);
  }), []);

  const handleImport = async () => {
    if (!orderSn.trim()) return;
    setImporting(true);
    try {
      const res = await importShopeeOrderManually(orderSn.trim());
      toast.show(res.message);
      if (res.ok) setOrderSn('');
    } catch (e: any) {
      toast.show('Erro ao importar pedido: ' + (e.message || e));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!returnTarget) return;
    try {
      const res = await revertShopeeOrderReturn(returnTarget.id);
      toast.show(res.message);
    } catch (e: any) {
      toast.show('Erro ao registrar devolução: ' + (e.message || e));
    } finally {
      setReturnTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
      <ConfirmDialog
        isOpen={!!returnTarget}
        title="Registrar Devolução?"
        message={`O estoque debitado pelo pedido ${returnTarget?.orderNumber} será restituído. Confirma a devolução?`}
        confirmLabel="Sim, Repor Estoque"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmReturn}
        onCancel={() => setReturnTarget(null)}
        isDanger={false}
      />

      <div className={`p-5 rounded-[2rem] border shadow-sm flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Importar Pedido Manualmente</p>
        <div className="flex gap-2">
          <input
            value={orderSn}
            onChange={(e) => setOrderSn(e.target.value)}
            placeholder="Número do pedido na Shopee (order_sn)"
            className={`flex-1 h-11 px-4 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />
          <button
            onClick={handleImport}
            disabled={importing || !orderSn.trim()}
            className="h-11 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
          >
            <Search size={14} /> {importing ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>

      {orders.length === 0 && (
        <div className={`p-10 rounded-[2.5rem] border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-300'}`}>
          <p className="text-xs font-black uppercase tracking-widest">Nenhum pedido importado ainda</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {orders.map((order) => {
          const cfg = STATUS_CONFIG[order.status];
          return (
            <div key={order.id} className={`p-5 rounded-[2rem] border shadow-sm flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{order.orderNumber}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">#{order.externalOrderId} · {order.buyerName || 'Comprador não informado'}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${cfg.color} ${cfg.bg}`}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className={`font-bold truncate ${item.mapping ? (isDarkMode ? 'text-slate-300' : 'text-slate-700') : 'text-amber-600 dark:text-amber-400'}`}>
                      {item.quantity}x {item.externalName}{!item.mapping && ' (sem mapeamento)'}
                    </span>
                    <span className="text-slate-400 font-bold shrink-0 ml-2">R$ {item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className={`flex items-center justify-between pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                <p className="text-sm font-black text-slate-500 dark:text-slate-400">Total: <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>R$ {order.total.toFixed(2)}</span></p>
                {order.status === 'PARTIALLY_MAPPED' && (
                  <button
                    onClick={() => onNavigate(ViewType.MARKETPLACE_SKU_MAPPING)}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400"
                  >
                    <TagsIcon size={12} /> Mapear SKU <ChevronRight size={12} />
                  </button>
                )}
                {order.status === 'STOCK_DEBITED' && (
                  <button
                    onClick={() => setReturnTarget(order)}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600"
                  >
                    <Undo2 size={12} /> Registrar Devolução
                  </button>
                )}
                {order.status === 'ERROR' && order.errorReason && (
                  <p className="text-[10px] font-bold text-rose-500 max-w-[60%] text-right">{order.errorReason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
