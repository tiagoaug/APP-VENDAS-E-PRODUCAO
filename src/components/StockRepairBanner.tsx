import { Wrench, ChevronRight } from 'lucide-react';

interface StockRepairBannerProps {
  fixable: number;
  unresolved: number;
  onOpen: () => void;
  isDarkMode: boolean;
}

// Aviso quando há pedidos finalizados que não somaram ao estoque (StockLot faltante) ou
// StockLots ATACADO sem boxQty — mesmos dados do "Reparar Caixas" (PCP), pra não depender
// do usuário lembrar de abrir Ações Rápidas pra descobrir que tem caixa perdida.
export default function StockRepairBanner({ fixable, unresolved, onOpen, isDarkMode }: StockRepairBannerProps) {
  const total = fixable + unresolved;
  if (total === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
        <Wrench size={18} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
          {total} pedido{total === 1 ? '' : 's'} de produção não somaram ao estoque
        </p>
        <p className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest mt-0.5">
          {fixable > 0 ? `${fixable} corrigível${fixable === 1 ? '' : 'is'} automaticamente` : ''}
          {fixable > 0 && unresolved > 0 ? ' · ' : ''}
          {unresolved > 0 ? `${unresolved} precisa${unresolved === 1 ? '' : 'm'} de investigação` : ''}
        </p>
      </div>
      <ChevronRight size={16} className="text-amber-500 shrink-0" />
    </button>
  );
}
