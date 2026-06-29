import { createPortal } from 'react-dom';
import { X, AlertTriangle, Check } from 'lucide-react';
import { toast } from '../utils/toast';
import { DuplicateStockByRefColor } from '../hooks/useStockLotDuplicates';

interface StockDuplicateDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  groups: DuplicateStockByRefColor[];
  onMarkResolved: (groupKeys: { key: string; count: number }[]) => void;
}

export default function StockDuplicateDiagnosticModal({
  isOpen, onClose, isDarkMode, groups, onMarkResolved,
}: StockDuplicateDiagnosticModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-lg max-h-[85vh] flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-500'}`}>
              <AlertTriangle size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className={`text-base font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Diagnóstico de Estoque Duplicado</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{groups.length} referência(s)/cor(es) afetada(s)</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" title="Fechar"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 custom-scrollbar">
          {groups.length === 0 && (
            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhuma duplicidade encontrada.</p>
          )}
          {groups.map(g => (
            <div key={`${g.productReference}::${g.variationName}`} className={`rounded-2xl border p-4 flex flex-col gap-2 ${isDarkMode ? 'bg-rose-900/15 border-rose-800/40' : 'bg-rose-50 border-rose-100'}`}>
              <p className={`text-[12px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {g.productReference ? `${g.productReference} — ` : ''}{g.productName} · {g.variationName}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                Veio de: {g.lotOrderNumbers.join(', ')}
              </p>
              <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total a descontar</span>
                <span className="text-[14px] font-black text-rose-500">
                  {g.excessBoxes > 0 ? `${g.excessBoxes} cx` : `${g.excessPairs} pares`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onMarkResolved(g.groupKeys);
                  toast.show('Marcado como resolvido.');
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
              >
                <Check size={12} strokeWidth={3} /> Marcar como Resolvido
              </button>
            </div>
          ))}
          {groups.length > 0 && (
            <button type="button"
              onClick={() => {
                const text = groups.map(g =>
                  `${g.productReference} ${g.productName} ${g.variationName} (origem: ${g.lotOrderNumbers.join(', ')}): descontar ${g.excessBoxes > 0 ? `${g.excessBoxes} cx` : `${g.excessPairs} pares`}`
                ).join('\n');
                navigator.clipboard.writeText(text);
                toast.show('Resumo copiado.');
              }}
              className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              Copiar Resumo
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
