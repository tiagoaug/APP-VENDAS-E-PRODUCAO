import { useState, useMemo } from "react";
import { StockLot, StockLotRevertPreview } from "../types";
import { Search, History, RotateCcw, ChevronRight, TrendingDown, TrendingUp, Boxes } from "lucide-react";
import Modal from "./Modal";

const StockLotRevertModal: React.FC<{
  target: { lot: StockLot; preview: StockLotRevertPreview } | null;
  status: 'confirm' | 'loading' | 'done';
  isDarkMode: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ target, status, isDarkMode, onCancel, onConfirm, onClose }) => {
  if (!target) return null;
  const { preview } = target;

  return (
    <Modal
      isOpen={!!target}
      onClose={status === 'done' ? onClose : onCancel}
      title={status === 'done' ? 'Reversão Concluída' : 'Reverter Entrada de Estoque'}
      icon={<RotateCcw size={20} />}
      maxWidth="max-w-lg"
      closeLabel={status === 'done' ? 'Entendido' : 'Voltar'}
    >
      <div className="flex flex-col gap-4">
        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <p className={`text-xs font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {preview.productReference && <span className="text-indigo-500 mr-1">{preview.productReference}</span>}
            {preview.productName} · {preview.variationName}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {preview.gradeLabel}
          </p>
        </div>

        {status !== 'done' && (
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
            Isso vai remover esta entrada do estoque do produto, repor os solados que foram consumidos e devolver o pedido para Expedição. Confira as quantidades abaixo:
          </p>
        )}

        {preview.stockReverted && preview.productStockRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <TrendingDown size={12} strokeWidth={3} /> Estoque do Produto (vai diminuir)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {preview.productStockRows.map(row => (
                <div key={row.label} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[52px] ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <p className="text-[10px] font-bold text-black dark:text-white leading-none">{row.label}</p>
                  <p className="text-[10px] font-black leading-none mt-1 flex items-center justify-center gap-1">
                    <span className="text-slate-400">{row.before}</span>
                    <ChevronRight size={10} strokeWidth={3} className="text-slate-300" />
                    <span className="text-rose-600 dark:text-rose-400">{row.after}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {preview.sole && preview.sole.rows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp size={12} strokeWidth={3} /> Estoque de Solados (vai repor) — {preview.sole.moldName} · {preview.sole.colorName}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {preview.sole.rows.map(row => (
                <div key={row.size} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[52px] ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <p className="text-[7px] font-bold text-slate-400 leading-none">{row.size}</p>
                  <p className="text-[10px] font-black leading-none mt-1 flex items-center justify-center gap-1">
                    <span className="text-slate-400">{row.before}</span>
                    <ChevronRight size={10} strokeWidth={3} className="text-slate-300" />
                    <span className="text-emerald-600 dark:text-emerald-400">{row.after}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {preview.orderReturnedToExpedicao && (
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Boxes size={12} strokeWidth={3} />
            </span>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              Pedido {preview.orderNumber ? <>#{preview.orderNumber} </> : ''}{status === 'done' ? 'devolvido' : 'será devolvido'} para <span className="font-black">Expedição</span>{preview.lotOrderNumber ? <> no Mapa #{preview.lotOrderNumber}</> : ''}.
              {preview.lotReopened && (status === 'done' ? ' O mapa foi reaberto.' : ' O mapa será reaberto.')}
            </p>
          </div>
        )}

        {status === 'done' && (
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <RotateCcw size={12} strokeWidth={3} />
            </span>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              Reversão concluída com sucesso.
            </p>
          </div>
        )}

        {status !== 'done' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={status === 'loading'}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={status === 'loading'}
              className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 active:scale-95"
            >
              {status === 'loading' ? 'Revertendo...' : 'Confirmar Reversão'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

const StockEntryHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  stockLots: StockLot[];
  isDarkMode: boolean;
  onPreviewRevertStockLot?: (stockLot: StockLot) => StockLotRevertPreview;
  onRevertStockLot?: (stockLot: StockLot) => Promise<StockLotRevertPreview>;
}> = ({ isOpen, onClose, stockLots, isDarkMode, onPreviewRevertStockLot, onRevertStockLot }) => {
  const [term, setTerm] = useState('');
  const [revertTarget, setRevertTarget] = useState<{ lot: StockLot; preview: StockLotRevertPreview } | null>(null);
  const [revertStatus, setRevertStatus] = useState<'confirm' | 'loading' | 'done'>('confirm');

  const filtered = useMemo(() => {
    const t = term.toLowerCase();
    return stockLots
      .filter(l =>
        l.productName.toLowerCase().includes(t) ||
        (l.productReference || '').toLowerCase().includes(t) ||
        l.variationName.toLowerCase().includes(t) ||
        (l.customerName || '').toLowerCase().includes(t) ||
        (l.saleOrderNumber || '').toLowerCase().includes(t) ||
        (l.productionOrderNumber || '').toLowerCase().includes(t) ||
        (l.lotOrderNumber || '').toLowerCase().includes(t)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [stockLots, term]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Histórico de Movimentações de Estoque" icon={<History size={20} />} maxWidth="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por produto, mapa, pedido ou cliente..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Buscar no histórico de movimentações de estoque"
            className={`w-full border rounded-xl py-3 pl-11 pr-4 text-[11px] font-bold uppercase tracking-widest outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
          />
        </div>

        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
          {filtered.length === 0 && (
            <div className={`p-8 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <History size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">Nenhuma movimentação encontrada</p>
            </div>
          )}
          {filtered.map(lot => {
            // Cada StockLot passa por até 3 estados ao longo da vida: crédito de produção
            // (EM_ESTOQUE = entrada disponível, ou RESERVADO quando já nasce comprometido
            // com um cliente) e, mais tarde, ENTREGUE quando sai de fato (Liberar Pedido).
            // Antes essa lista só distinguia "Estoque" vs. nome do cliente, sem indicar que
            // um lote já tinha saído — misturando entrada e saída sob o mesmo rótulo.
            const movementBadge = lot.status === 'ENTREGUE'
              ? { label: 'Saída · Entregue', className: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' }
              : lot.status === 'RESERVADO'
              ? { label: `Reservado · ${lot.customerName || 'Cliente'}`, className: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' }
              : { label: 'Entrada · Estoque', className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' };
            const orderNumber = lot.productionOrderNumber || lot.saleOrderNumber;
            const sizeEntries = Object.entries(lot.sizeBreakdown || {})
              .sort(([a], [b]) => parseFloat(a) - parseFloat(b));
            return (
              <div key={lot.id} className={`p-4 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                    {lot.productReference && <span className="text-indigo-500 mr-1">{lot.productReference}</span>}
                    {lot.productName} · {lot.variationName}
                  </p>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{new Date(lot.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  {lot.boxQty !== undefined ? (
                    <>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{lot.boxQty}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">caixas · {lot.totalPairs} pares</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{lot.totalPairs}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">pares</span>
                    </>
                  )}
                </div>

                {sizeEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sizeEntries.map(([sz, qty]) => (
                      <div key={sz} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[36px] ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <p className="text-[7px] font-bold text-slate-400 leading-none">{sz}</p>
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{qty}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {lot.lotOrderNumber && (
                    <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      Mapa #{lot.lotOrderNumber}
                    </span>
                  )}
                  {orderNumber && (
                    <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      Pedido #{orderNumber}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${movementBadge.className}`}>
                    {movementBadge.label}
                  </span>
                  {lot.boxQty !== undefined && (
                    <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                      {lot.pkgName || 'Avulso'}
                    </span>
                  )}
                </div>

                {onPreviewRevertStockLot && onRevertStockLot && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevertTarget({ lot, preview: onPreviewRevertStockLot(lot) });
                      setRevertStatus('confirm');
                    }}
                    className="self-end px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <RotateCcw size={12} strokeWidth={3} />
                    Reverter
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <StockLotRevertModal
        target={revertTarget}
        status={revertStatus}
        isDarkMode={isDarkMode}
        onCancel={() => { if (revertStatus !== 'loading') setRevertTarget(null); }}
        onConfirm={async () => {
          if (!revertTarget || !onRevertStockLot) return;
          setRevertStatus('loading');
          await onRevertStockLot(revertTarget.lot);
          setRevertStatus('done');
        }}
        onClose={() => setRevertTarget(null)}
      />
    </Modal>
  );
};

export default StockEntryHistoryModal;
