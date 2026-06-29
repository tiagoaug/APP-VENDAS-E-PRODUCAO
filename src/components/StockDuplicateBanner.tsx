import { AlertTriangle, ChevronRight } from 'lucide-react';

interface StockDuplicateBannerProps {
  count: number;
  onOpen: () => void;
  isDarkMode: boolean;
}

// Aviso direto na tela inicial (PCP e Estoques) quando há baixas de estoque duplicadas
// — antes só aparecia escondido dentro do popup de Ações Rápidas do PCP.
export default function StockDuplicateBanner({ count, onOpen, isDarkMode }: StockDuplicateBannerProps) {
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15' : 'bg-rose-50 border-rose-200 hover:bg-rose-100'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-500'}`}>
        <AlertTriangle size={18} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>
          {count} duplicidade{count === 1 ? '' : 's'} de estoque detectada{count === 1 ? '' : 's'}
        </p>
        <p className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest mt-0.5">Toque para revisar e corrigir</p>
      </div>
      <ChevronRight size={16} className="text-rose-400 shrink-0" />
    </button>
  );
}
