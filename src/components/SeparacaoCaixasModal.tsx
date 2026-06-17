import { useState, useMemo } from 'react';
import { Sale, SaleType, Product, StockLot } from '../types';
import { X, Minus, Plus, Boxes, Package, CheckCircle2 } from 'lucide-react';

interface Props {
  sale: Sale;
  products: Product[];
  stockLots: StockLot[];
  isDarkMode: boolean;
  onConfirm: (separations: { itemIdx: number; quantity: number }[]) => Promise<void>;
  onClose: () => void;
}

export default function SeparacaoCaixasModal({ sale, products, stockLots, isDarkMode, onConfirm, onClose }: Props) {
  const reservedLots = useMemo(
    () => stockLots.filter(l => l.saleId === sale.id && l.status === 'RESERVADO'),
    [stockLots, sale.id]
  );

  const rows = useMemo(() => {
    return sale.items.map((item, idx) => {
      const product = products.find(p => p.id === item.productId);
      const variation = product?.variations.find(v => v.id === item.variationId);
      const unit = item.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
      const separated = item.boxesSeparated || 0;
      const remaining = Math.max(0, item.quantity - separated);

      const itemLots = reservedLots.filter(
        l => l.productId === item.productId && l.variationId === item.variationId
      );
      const hasReserved = itemLots.length > 0;

      const stockKey = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || '');
      const stockAvailable = variation?.stock?.[stockKey] || 0;

      // Max separable: from reserved lots qty OR from stock qty
      const maxFromLots = itemLots.reduce((s, l) => s + (l.boxQty || 1), 0);
      const maxSeparable = hasReserved
        ? Math.min(remaining, maxFromLots)
        : Math.min(remaining, stockAvailable);

      return { idx, item, product, variation, unit, separated, remaining, itemLots, hasReserved, stockAvailable, maxSeparable };
    });
  }, [sale.items, products, reservedLots]);

  const pendingRows = rows.filter(r => r.remaining > 0);
  const doneRows = rows.filter(r => r.remaining === 0);

  const [quantities, setQuantities] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    rows.forEach(r => { init[r.idx] = r.maxSeparable; });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const setQty = (idx: number, max: number, val: number) =>
    setQuantities(prev => ({ ...prev, [idx]: Math.min(max, Math.max(0, val)) }));

  const toApply = rows
    .map(r => ({ itemIdx: r.idx, quantity: quantities[r.idx] || 0 }))
    .filter(s => s.quantity > 0);

  const handleConfirm = async () => {
    if (toApply.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(toApply);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const totalToSeparate = toApply.reduce((s, x) => s + x.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md max-h-[88vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Boxes size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Separação de Caixas</p>
              <p className={`text-base font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pedido #{sale.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar"
            className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Items */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3 custom-scrollbar">
          {pendingRows.length === 0 && doneRows.length > 0 && (
            <div className="py-8 text-center">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Todos os itens já separados</p>
            </div>
          )}

          {pendingRows.map(row => {
            const qty = quantities[row.idx] ?? 0;
            return (
              <div
                key={row.idx}
                className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
              >
                {/* Product header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className={`text-[12px] font-black uppercase tracking-tight leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      {row.product?.reference && `${row.product.reference} · `}{row.product?.name}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                      {row.variation?.colorName}{row.item.size ? ` · Nº ${row.item.size}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[11px] font-black uppercase tracking-widest ${row.separated > 0 ? 'text-indigo-500' : 'text-slate-400'}`}>
                      {row.separated}/{row.item.quantity} {row.unit}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Faltam {row.remaining}
                    </p>
                  </div>
                </div>

                {/* Source badge */}
                {row.hasReserved ? (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg mb-2.5 ${isDarkMode ? 'bg-violet-900/20' : 'bg-violet-50'}`}>
                    <Boxes size={10} className="text-violet-500 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
                      {row.itemLots.length} lote(s) produzido(s) reservado(s)
                    </span>
                    <span className="ml-auto text-[8px] font-black text-violet-500">
                      {row.itemLots.map(l => l.gradeLabel).join(', ')}
                    </span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg mb-2.5 ${
                    row.stockAvailable >= row.remaining
                      ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50')
                      : (isDarkMode ? 'bg-amber-900/20' : 'bg-amber-50')
                  }`}>
                    <Package size={10} className={row.stockAvailable >= row.remaining ? 'text-emerald-500 shrink-0' : 'text-amber-500 shrink-0'} />
                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                      row.stockAvailable >= row.remaining
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      Estoque disponível: {row.stockAvailable} {row.unit}
                    </span>
                  </div>
                )}

                {/* Quantity stepper */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Separar</span>
                  <div className={`flex items-center flex-1 rounded-xl p-1 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
                    <button
                      type="button"
                      onClick={() => setQty(row.idx, row.maxSeparable, qty - 1)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}
                      aria-label="Diminuir"
                    >
                      <Minus size={13} strokeWidth={3} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={row.maxSeparable}
                      value={qty === 0 ? '' : qty}
                      onFocus={e => e.target.select()}
                      onChange={e => setQty(row.idx, row.maxSeparable, parseInt(e.target.value) || 0)}
                      className={`flex-1 text-center border-none p-0 text-sm font-black focus:ring-0 bg-transparent ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                      aria-label="Quantidade"
                    />
                    <button
                      type="button"
                      onClick={() => setQty(row.idx, row.maxSeparable, qty + 1)}
                      className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center active:scale-90 transition-all"
                      aria-label="Aumentar"
                    >
                      <Plus size={13} strokeWidth={3} />
                    </button>
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-400 w-8 text-center shrink-0">{row.unit}</span>
                </div>
              </div>
            );
          })}

          {/* Already separated items */}
          {doneRows.length > 0 && pendingRows.length > 0 && (
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center pt-1">Já separados</p>
          )}
          {doneRows.map(row => (
            <div
              key={row.idx}
              className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50 border-emerald-100'}`}
            >
              <div className="min-w-0">
                <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                  {row.product?.reference && `${row.product.reference} · `}{row.product?.name}
                </p>
                <p className="text-[9px] font-bold text-emerald-500 mt-0.5 uppercase tracking-widest">
                  {row.variation?.colorName}{row.item.size ? ` · Nº ${row.item.size}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CheckCircle2 size={14} className="text-emerald-500" strokeWidth={2.5} />
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                  {row.separated}/{row.item.quantity} {row.unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`p-5 border-t shrink-0 flex gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-100'}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || toApply.length === 0}
            onClick={handleConfirm}
            className={`flex-[1.5] py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
              toApply.length === 0
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
            }`}
          >
            <Boxes size={16} strokeWidth={2.5} />
            {saving ? 'Separando...' : `Separar (${totalToSeparate})`}
          </button>
        </div>
      </div>
    </div>
  );
}
