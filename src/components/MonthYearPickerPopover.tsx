import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthYearPickerPopoverProps {
  value: string; // Formato "yyyy-MM"
  onChange: (value: string) => void;
  onClose: () => void;
}

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const parseMonthStr = (value: string): { year: number; month: number } => {
  if (!value) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  const [year, month] = value.split('-').map(Number);
  return { year, month: month - 1 };
};

const formatMonthStr = (year: number, month: number): string => `${year}-${String(month + 1).padStart(2, '0')}`;

// Mesmo estilo visual do DatePickerPopover.tsx (usado em Compras) — cabeçalho azul-claro,
// grade e rodapé com "Este mês"/"Voltar" — só que navegando por ano e escolhendo um mês
// inteiro (não um dia), pra telas que usam <input type="month"> (ex.: Análise de Lucro,
// cards com seletor de período Mês/Trimestre/Semestre/Ano).
export default function MonthYearPickerPopover({ value, onChange, onClose }: MonthYearPickerPopoverProps) {
  const selected = parseMonthStr(value);
  const [year, setYear] = useState(selected.year);
  const now = new Date();

  const selectMonth = (month: number) => {
    onChange(formatMonthStr(year, month));
    onClose();
  };

  const selectThisMonth = () => {
    onChange(formatMonthStr(now.getFullYear(), now.getMonth()));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-[310px] overflow-hidden flex flex-col animate-in zoom-in duration-200"
      >
        {/* Cabeçalho do Ano — mesmo fundo azul-claro do DatePickerPopover */}
        <div className="bg-sky-50 dark:bg-sky-950/45 px-5 py-4 flex items-center justify-between border-b border-sky-100/50 dark:border-sky-900/30 shrink-0">
          <button
            type="button"
            onClick={() => setYear(y => y - 1)}
            aria-label="Ano anterior"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors active:scale-95 outline-none"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>

          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-800 dark:text-sky-300">
            {year}
          </span>

          <button
            type="button"
            onClick={() => setYear(y => y + 1)}
            aria-label="Próximo ano"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors active:scale-95 outline-none"
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Grade de meses */}
        <div className="grid grid-cols-3 gap-2 px-5 pt-4 pb-4">
          {MONTHS_SHORT.map((label, month) => {
            const isSelected = year === selected.year && month === selected.month;
            const isCurrent = year === now.getFullYear() && month === now.getMonth();
            let btnClass = "h-12 flex items-center justify-center rounded-2xl text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 outline-none ";
            if (isSelected) {
              btnClass += "bg-indigo-650 shadow-lg shadow-indigo-500/25 text-white ";
            } else if (isCurrent) {
              btnClass += "text-red-500 dark:text-red-400 ";
            } else {
              btnClass += "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ";
            }
            return (
              <button key={month} type="button" onClick={() => selectMonth(month)} className={btnClass}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Rodapé - Ações */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={selectThisMonth}
            className="py-2.5 px-4 text-[9px] font-black uppercase tracking-[0.15em] text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-colors outline-none"
          >
            Este Mês
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors outline-none"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
