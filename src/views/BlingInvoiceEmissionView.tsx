import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, FileCheck2, AlertTriangle, ChevronDown, ChevronUp, Tags as TagsIcon, ChevronRight, ExternalLink, Store, Loader2, ShoppingBag, Globe, Building2, HelpCircle } from 'lucide-react';
import { BlingOrder, BlingProductMapping, Product, ViewType } from '../types';
import { subscribeToBlingOrders, subscribeToBlingMappings, syncBlingOrdersNow, emitBlingInvoice, emitBlingInvoicesBatch } from '../services/blingService';
import { toast } from '../utils/toast';

interface BlingInvoiceEmissionViewProps {
  isDarkMode: boolean;
  products: Product[];
  onNavigate: (view: ViewType) => void;
}

// Sem logo oficial de marketplace embutido no app — usamos ícone + cor de marca como símbolo
// visual do canal, resolvido de verdade a partir do canal de venda do Bling (ver
// functions/src/bling/sync.ts, loadSalesChannelOrigins).
const ORIGIN_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  PROPRIO: { label: 'Loja Própria', icon: <Building2 size={11} />, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  MERCADO_LIVRE: { label: 'Mercado Livre', icon: <ShoppingBag size={11} />, color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  SHOPEE: { label: 'Shopee', icon: <Store size={11} />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  LOJA_VIRTUAL: { label: 'Loja Virtual', icon: <Globe size={11} />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  OUTRO: { label: 'Outro Marketplace', icon: <HelpCircle size={11} />, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
};

function isFullyMapped(order: BlingOrder): boolean {
  return order.itens.every((i) => i.mapeado);
}

export default function BlingInvoiceEmissionView({ isDarkMode, products, onNavigate }: BlingInvoiceEmissionViewProps) {
  const [orders, setOrders] = useState<BlingOrder[]>([]);
  const [mappings, setMappings] = useState<BlingProductMapping[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [emittingSingle, setEmittingSingle] = useState<string | null>(null);
  const [emittingBatch, setEmittingBatch] = useState(false);

  useEffect(() => subscribeToBlingOrders(setOrders), []);
  useEffect(() => subscribeToBlingMappings(setMappings), []);

  const mappingByBlingId = useMemo(() => new Map(mappings.map((m) => [m.blingProdutoId, m])), [mappings]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const pending = useMemo(() => orders.filter((o) => o.status === 'PENDENTE' || o.status === 'PRONTO_PARA_EMITIR'), [orders]);

  const toggleSelect = (id: string, mapped: boolean) => {
    if (!mapped) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncBlingOrdersNow();
      toast.show(res.message || `Pedidos sincronizados (${res.ordersImported}).`);
    } catch (e: any) {
      toast.show('Erro ao sincronizar pedidos: ' + (e.message || e));
    } finally {
      setSyncing(false);
    }
  };

  const handleEmitOne = async (order: BlingOrder) => {
    setEmittingSingle(order.id);
    try {
      const res = await emitBlingInvoice(order.id);
      if (res.ok) toast.show(`Nota emitida — pedido ${order.numero}.`);
      else toast.show(`Falha ao emitir pedido ${order.numero}: ${res.motivo || 'erro desconhecido'}`);
    } catch (e: any) {
      toast.show('Erro ao emitir nota fiscal: ' + (e.message || e));
    } finally {
      setEmittingSingle(null);
    }
  };

  const handleEmitBatch = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setEmittingBatch(true);
    try {
      // Emissão sequencial no backend (não paralela) — respeita rate limit do Bling e a
      // numeração sequencial da NF-e, mesma exigência já descrita na especificação original.
      const results = await emitBlingInvoicesBatch(ids);
      const ok = results.filter((r) => r.ok).length;
      const fail = results.length - ok;
      toast.show(`${ok} nota(s) emitida(s)${fail > 0 ? `, ${fail} com falha` : ''}.`);
      setSelected(new Set());
    } catch (e: any) {
      toast.show('Erro ao emitir notas em lote: ' + (e.message || e));
    } finally {
      setEmittingBatch(false);
    }
  };

  const selectedCount = selected.size;

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex-1 h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando...' : 'Sincronizar Pedidos'}
        </button>
        <button
          onClick={handleEmitBatch}
          disabled={selectedCount === 0 || emittingBatch}
          className="flex-1 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
        >
          {emittingBatch ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />}
          {emittingBatch ? 'Emitindo...' : `Emitir Selecionadas (${selectedCount})`}
        </button>
      </div>

      {pending.length === 0 && (
        <div className={`p-10 rounded-[2.5rem] border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-300'}`}>
          <p className="text-xs font-black uppercase tracking-widest">Nenhum pedido pendente de emissão</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {pending.map((order) => {
          const mapped = isFullyMapped(order);
          const isExpanded = expanded.has(order.id);
          const isEmittingThis = emittingSingle === order.id;
          return (
            <div key={order.id} className={`p-5 rounded-[2rem] border shadow-sm flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(order.id)}
                  onChange={() => toggleSelect(order.id, mapped)}
                  disabled={!mapped}
                  className="w-5 h-5 rounded shrink-0 accent-emerald-600 disabled:opacity-30"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pedido {order.numero}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${(ORIGIN_CONFIG[order.origem] || ORIGIN_CONFIG.OUTRO).color} ${(ORIGIN_CONFIG[order.origem] || ORIGIN_CONFIG.OUTRO).bg}`}>
                      {(ORIGIN_CONFIG[order.origem] || ORIGIN_CONFIG.OUTRO).icon} {(ORIGIN_CONFIG[order.origem] || ORIGIN_CONFIG.OUTRO).label}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">{order.cliente}</p>
                  </div>
                </div>
                <button onClick={() => toggleExpand(order.id)} className="p-1.5 text-slate-400 shrink-0">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {!mapped && (
                <button
                  onClick={() => onNavigate(ViewType.BLING_PRODUCT_MAPPING)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest w-fit"
                >
                  <AlertTriangle size={12} /> Itens sem vínculo — <TagsIcon size={12} /> Vincular Produtos <ChevronRight size={12} />
                </button>
              )}

              {isExpanded && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                  {order.itens.map((item, idx) => {
                    const mapping = mappingByBlingId.get(item.blingProdutoId);
                    const product = mapping ? productById.get(mapping.productId) : undefined;
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs gap-2">
                        <div className="min-w-0">
                          <p className={`font-bold truncate ${item.mapeado ? (isDarkMode ? 'text-slate-300' : 'text-slate-700') : 'text-amber-600 dark:text-amber-400'}`}>
                            {item.quantidade}x {item.descricao}{!item.mapeado && ' (sem vínculo)'}
                          </p>
                          {mapping && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider truncate">
                              → {product?.reference || '?'} · {mapping.productName} · {mapping.variationName}{mapping.size ? ` · ${mapping.size}` : ' · Atacado'}
                            </p>
                          )}
                        </div>
                        <span className="text-slate-400 font-bold shrink-0">R$ {item.valorUnitario.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={`flex items-center justify-between pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                <p className="text-sm font-black text-slate-500 dark:text-slate-400">Total: <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>R$ {order.valorTotal.toFixed(2)}</span></p>
                <button
                  onClick={() => handleEmitOne(order)}
                  disabled={!mapped || isEmittingThis}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest"
                >
                  {isEmittingThis ? <Loader2 size={13} className="animate-spin" /> : <FileCheck2 size={13} />}
                  {isEmittingThis ? 'Emitindo...' : 'Emitir NF-e'}
                </button>
              </div>

              {order.status === 'REJEITADA' && order.motivoRejeicao && (
                <p className="text-[10px] font-bold text-rose-500">{order.motivoRejeicao}</p>
              )}
            </div>
          );
        })}
      </div>

      {orders.some((o) => o.status === 'EMITIDA') && (
        <div className="flex flex-col gap-3 mt-2">
          <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Notas Emitidas</h3>
          {orders.filter((o) => o.status === 'EMITIDA').map((order) => (
            <div key={order.id} className={`p-4 rounded-[1.75rem] border shadow-sm flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="min-w-0">
                <p className={`text-xs font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pedido {order.numero}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">{order.cliente}</p>
              </div>
              {order.danfeUrl && (
                <a
                  href={order.danfeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 shrink-0"
                >
                  DANFE <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
