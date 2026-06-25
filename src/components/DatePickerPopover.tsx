import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerPopoverProps {
  value: string; // Formato "yyyy-MM-dd"
  onChange: (date: string) => void;
  onClose: () => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const parseDateStr = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateStr = (year: number, month: number, day: number): string => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

export default function DatePickerPopover({ value, onChange, onClose }: DatePickerPopoverProps) {
  const [currentDate, setCurrentDate] = useState(() => parseDateStr(value));

  const selectedDate = parseDateStr(value);
  const today = new Date();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const selectDay = (dayDate: Date) => {
    const formatted = formatDateStr(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    onChange(formatted);
    onClose();
  };

  const selectToday = () => {
    const formatted = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());
    onChange(formatted);
    onClose();
  };

  // Grid de dias
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];

  // Dias do mês anterior (padding)
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    cells.push({
      day: dayNum,
      monthOffset: -1,
      date: new Date(year, month - 1, dayNum)
    });
  }

  // Dias do mês atual
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      day: i,
      monthOffset: 0,
      date: new Date(year, month, i)
    });
  }

  // Dias do mês seguinte (padding até preencher 42 células para layout estável)
  const remainingCells = 42 - cells.length;
  for (let i = 1; i <= remainingCells; i++) {
    cells.push({
      day: i,
      monthOffset: 1,
      date: new Date(year, month + 1, i)
    });
  }

  const checkIsToday = (d: Date) => {
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const checkIsSelected = (d: Date) => {
    return d.getDate() === selectedDate.getDate() &&
           d.getMonth() === selectedDate.getMonth() &&
           d.getFullYear() === selectedDate.getFullYear();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-[310px] overflow-hidden flex flex-col animate-in zoom-in duration-200">
        
        {/* Cabeçalho do Mês - Fundo Azul Claro */}
        <div className="bg-sky-50 dark:bg-sky-950/45 px-5 py-4 flex items-center justify-between border-b border-sky-100/50 dark:border-sky-900/30 shrink-0">
          <button 
            type="button" 
            onClick={prevMonth} 
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors active:scale-95 outline-none"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-800 dark:text-sky-300">
            {MONTHS[month]} {year}
          </span>
          
          <button 
            type="button" 
            onClick={nextMonth} 
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors active:scale-95 outline-none"
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-1 px-5 pt-4 text-center shrink-0">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest w-9 h-9 flex items-center justify-center">
              {day}
            </div>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7 gap-1 px-5 pb-4 pt-1 shrink-0">
          {cells.map(({ day, monthOffset, date: cellDate }, idx) => {
            const isToday = checkIsToday(cellDate);
            const isSelected = checkIsSelected(cellDate);
            const isCurrentMonth = monthOffset === 0;

            let btnClass = "w-9 h-9 flex items-center justify-center rounded-full text-xs font-bold transition-all relative active:scale-90 outline-none ";

            if (isSelected) {
              btnClass += "bg-indigo-650 shadow-lg shadow-indigo-500/25 ";
              if (isToday) {
                btnClass += "text-red-500 dark:text-red-400 font-black ";
              } else {
                btnClass += "text-white ";
              }
            } else if (isToday) {
              btnClass += "text-red-500 dark:text-red-400 font-black ";
            } else if (!isCurrentMonth) {
              btnClass += "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/30 ";
            } else {
              btnClass += "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => selectDay(cellDate)}
                className={btnClass}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Rodapé - Ações */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={selectToday}
            className="py-2.5 px-4 text-[9px] font-black uppercase tracking-[0.15em] text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-colors outline-none"
          >
            Hoje
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
