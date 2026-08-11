import { useEffect, useMemo, useState } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, Loader2, Lightbulb, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { Product, Variation, BlingOrder, BlingProductMapping, SaleType } from '../types';
import { subscribeToBlingOrders, subscribeToBlingMappings } from '../services/blingService';
import { productHasSaleType } from '../utils/stockPools';
import { toast } from '../utils/toast';

interface BlingStockViewProps {
  isDarkMode: boolean;
  products: Product[];
  onReconcileStockBalance?: (productId: string, deltas: { variationId: string; key: string; oldValue: number; newValue: number }[]) => Promise<void>;
}

interface MovementTarget {
  product: Product;
  variation: Variation;
  sizeKey: string;
  sizeLabel: string;
  currentQty: number;
}

/** Movimentação manual pontual (uma referência/cor/tamanho por vez) — usa exatamente o mesmo
 * `onReconcileStockBalance` que a tela de Estoque (Balanço de Estoque) já usa pra editar
 * `product.variations[].stock`, então o resultado é gravado na MESMA fonte de dados que Vendas
 * já lê (não é um estoque paralelo). Reduções também consomem/criam StockLots do jeito de
 * sempre, mantendo o histórico de lotes coerente com o resto do app.
 */
function ManualMovementModal({ target, isDarkMode, onClose, onConfirm }: { target: MovementTarget; isDarkMode: boolean; onClose: () => void; onConfirm: (newQty: number) => Promise<void> }) {
  const [mode, setMode] = useState<'entrada' | 'saida' | 'ajustar'>('entrada');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedQty = Math.max(0, Math.floor(Number(qty) || 0));
  const resultingQty = mode === 'ajustar' ? parsedQty : mode === 'entrada' ? target.currentQty + parsedQty : Math.max(0, target.currentQty - parsedQty);
  const canConfirm = mode === 'ajustar' ? qty !== '' : parsedQty > 0;

  // "Ajustar" edita o número final direto (ex.: vê 28, digita 26) em vez de somar/subtrair uma
  // quantidade — pré-preenche com o valor atual pra já cair editando o dígito certo.
  const switchMode = (next: 'entrada' | 'saida' | 'ajustar') => {
    setMode(next);
    setQty(next === 'ajustar' ? String(target.currentQty) : '');
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      await onConfirm(resultingQty);
      onClose();
    } catch (e: any) {
      toast.show('Erro ao movimentar estoque: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-[2rem] p-6 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Movimentação Manual</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
              {target.product.reference} · {target.variation.colorName} · {target.sizeLabel}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 shrink-0"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => switchMode('entrada')}
            className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 ${mode === 'entrada' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
          >
            <ArrowUpCircle size={14} /> Entrada
          </button>
          <button
            onClick={() => switchMode('saida')}
            className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 ${mode === 'saida' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
          >
            <ArrowDownCircle size={14} /> Saída
          </button>
          <button
            onClick={() => switchMode('ajustar')}
            className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 ${mode === 'ajustar' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            <Pencil size={13} /> Ajustar
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">{mode === 'ajustar' ? 'Nova quantidade' : 'Quantidade'}</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
            placeholder="0"
            className={`w-full px-4 py-3 rounded-2xl text-lg font-black outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />
        </div>

        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estoque atual → novo</span>
          <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{target.currentQty} → {resultingQty}</span>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!canConfirm || saving}
          className="w-full h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? 'Salvando...' : 'Confirmar Movimentação'}
        </button>
      </div>
    </div>
  );
}

export default function BlingStockView({ isDarkMode, products, onReconcileStockBalance }: BlingStockViewProps) {
  const [orders, setOrders] = useState<BlingOrder[]>([]);
  const [mappings, setMappings] = useState<BlingProductMapping[]>([]);
  const [movementTarget, setMovementTarget] = useState<MovementTarget | null>(null);
  // Presença aqui = referência recolhida — por padrão nenhuma referência está aqui, ou seja,
  // todas começam abertas (mesmo comportamento de sempre), só quem for fechado no toque entra.
  const [collapsedProducts, setCollapsedProducts] = useState<Set<string>>(new Set());

  const toggleProductCollapsed = (productId: string) => {
    setCollapsedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  useEffect(() => subscribeToBlingOrders(setOrders), []);
  useEffect(() => subscribeToBlingMappings(setMappings), []);

  // Quanto de cada produto/variação/tamanho ainda está pendente de separação — mesma chave da
  // Lista de Separação, pra destacar em azul aqui.
  const pendingByKey = useMemo(() => {
    const map = new Map<string, number>();
    const mappingByBlingId = new Map(mappings.map((m) => [m.blingProdutoId, m]));
    for (const order of orders) {
      if (order.status === 'REJEITADA') continue;
      for (const item of order.itens) {
        if (item.separado) continue;
        const mapping = mappingByBlingId.get(item.blingProdutoId);
        if (!mapping) continue;
        const key = `${mapping.productId}|${mapping.variationId}|${mapping.size || 'ATACADO'}`;
        map.set(key, (map.get(key) || 0) + item.quantidade);
      }
    }
    return map;
  }, [orders, mappings]);

  // Modelos (produtos) de VAREJO que têm PELO MENOS uma variação/tamanho vinculado ao Bling —
  // mostra o estoque completo desses modelos (todas as cores/tamanhos), igual à aba "Varejo"
  // de "Disponível em Estoque", só que com a quantidade pendente de separação em azul.
  const linkedProducts = useMemo(() => {
    const linkedIds = new Set(mappings.map((m) => m.productId));
    return products
      .filter((p) => linkedIds.has(p.id) && productHasSaleType(p, SaleType.RETAIL))
      .sort((a, b) => a.reference.localeCompare(b.reference));
  }, [products, mappings]);

  return (
    <div className="flex flex-col gap-6 pb-32">
      {movementTarget && onReconcileStockBalance && (
        <ManualMovementModal
          target={movementTarget}
          isDarkMode={isDarkMode}
          onClose={() => setMovementTarget(null)}
          onConfirm={async (newQty) => {
            await onReconcileStockBalance(movementTarget.product.id, [
              { variationId: movementTarget.variation.id, key: movementTarget.sizeKey, oldValue: movementTarget.currentQty, newValue: newQty },
            ]);
            toast.show('Estoque movimentado.');
          }}
        />
      )}

      <div className="flex items-center gap-2 px-1">
        <div className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Azul = tem quantidade pendente de separação de pedidos</p>
      </div>

      <div className="flex flex-col gap-3">
        {linkedProducts.length === 0 && (
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhum modelo vinculado ao Bling ainda.</p>
        )}
        {linkedProducts.map((product) => {
          const isCollapsed = collapsedProducts.has(product.id);
          return (
          <div
            key={product.id}
            className={`p-4 rounded-[2rem] border shadow-sm bg-gradient-to-br ${isDarkMode ? 'from-slate-900 to-slate-900/80 border-slate-800' : 'from-white to-slate-50 border-slate-100'}`}
          >
            <button
              onClick={() => toggleProductCollapsed(product.id)}
              className={`w-full flex items-center justify-between gap-2 text-left ${isCollapsed ? '' : 'mb-3'}`}
            >
              <h3 className={`text-[13px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {product.reference ? `${product.reference} — ` : ''}{product.name}
              </h3>
              {isCollapsed ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronUp size={16} className="text-slate-400 shrink-0" />}
            </button>

            {!isCollapsed && (
            <>
            {onReconcileStockBalance && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20 mb-3">
                <Lightbulb size={16} className="shrink-0" />
                <p className="text-[11px] font-bold leading-snug">Clique em qualquer numeração para alterar.</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {product.variations.map((variation) => {
                const sizeEntries = Object.entries(variation.stock).filter(([size]) => size !== 'WHOLESALE');
                const wholesaleQty = variation.stock['WHOLESALE'];
                const totalRetail = sizeEntries.reduce((s, [, qty]) => s + qty, 0);

                return (
                  <div key={variation.id} className={`flex flex-col gap-1.5 p-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/80'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[13px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalRetail} pr</span>
                      <span className={`text-[11px] font-bold uppercase tracking-tight truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{variation.colorName}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {sizeEntries.map(([size, qty]) => {
                        const pending = pendingByKey.get(`${product.id}|${variation.id}|${size}`) || 0;
                        const isPending = pending > 0;
                        return (
                          <button
                            key={size}
                            onClick={() => onReconcileStockBalance && setMovementTarget({ product, variation, sizeKey: size, sizeLabel: size, currentQty: qty })}
                            disabled={!onReconcileStockBalance}
                            className={`flex flex-col items-center justify-center min-w-[42px] px-2 py-1.5 rounded-lg border ${
                              isPending
                                ? isDarkMode ? 'bg-sky-900/30 border-sky-600' : 'bg-sky-100 border-sky-400'
                                : isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'
                            }`}
                          >
                            <span className={`text-[8px] font-black uppercase ${isPending ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400'}`}>{size}</span>
                            <span className={`text-[12px] font-black ${isPending ? 'text-sky-700 dark:text-sky-200' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>{qty}</span>
                            {isPending && <span className="text-[7px] font-black text-sky-500">-{pending}</span>}
                          </button>
                        );
                      })}

                      {wholesaleQty !== undefined && (() => {
                        const pending = pendingByKey.get(`${product.id}|${variation.id}|ATACADO`) || 0;
                        const isPending = pending > 0;
                        return (
                          <button
                            onClick={() => onReconcileStockBalance && setMovementTarget({ product, variation, sizeKey: 'WHOLESALE', sizeLabel: 'Atacado', currentQty: wholesaleQty })}
                            disabled={!onReconcileStockBalance}
                            className={`flex flex-col items-center justify-center min-w-[52px] px-2 py-1.5 rounded-lg border ${
                              isPending
                                ? isDarkMode ? 'bg-sky-900/30 border-sky-600' : 'bg-sky-100 border-sky-400'
                                : isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'
                            }`}
                          >
                            <span className={`text-[8px] font-black uppercase ${isPending ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400'}`}>Atacado</span>
                            <span className={`text-[12px] font-black ${isPending ? 'text-sky-700 dark:text-sky-200' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>{wholesaleQty}</span>
                            {isPending && <span className="text-[7px] font-black text-sky-500">-{pending}</span>}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
