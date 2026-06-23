import { useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import AnalogClock from "./AnalogClock";

interface DateTimePickerProps {
  value?: number | null;
  onChange: (ts: number | null) => void;
  isDarkMode?: boolean;
  placeholder?: string;
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const pad = (n: number) => String(n).padStart(2, "0");

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DateTimePicker({ value, onChange, isDarkMode = false, placeholder = "Definir data e hora" }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = value ? new Date(value) : null;
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? new Date().getMonth());
  const [time, setTime] = useState(selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : "08:00");

  const commit = (day: number, timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    onChange(new Date(viewYear, viewMonth, day, h, m).getTime());
  };

  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-700"}`}
      >
        <Calendar size={12} className="text-sky-500 shrink-0" />
        <span className={`flex-1 text-left truncate ${!selected ? "text-slate-400" : ""}`}>
          {selected ? `${selected.toLocaleDateString("pt-BR")} · ${pad(selected.getHours())}:${pad(selected.getMinutes())}` : placeholder}
        </span>
        {selected && (
          <span
            role="button"
            title="Remover lembrete"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="text-rose-400 hover:text-rose-500 shrink-0"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            <div className={`relative w-full max-w-[300px] max-h-[90vh] overflow-y-auto p-4 rounded-[1.75rem] shadow-2xl border ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  title="Mês anterior"
                  onClick={() => setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; })}
                  className={`p-1.5 rounded-lg ${isDarkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-400"}`}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[11px] font-black uppercase tracking-wide capitalize">{monthLabel}</span>
                <button
                  type="button"
                  title="Próximo mês"
                  onClick={() => setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; })}
                  className={`p-1.5 rounded-lg ${isDarkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-400"}`}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  title="Fechar"
                  onClick={() => setIsOpen(false)}
                  className={`p-1.5 rounded-lg ml-1 ${isDarkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-400"}`}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((w, i) => (
                  <div key={i} className="text-center text-[8px] font-black text-slate-400">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  const isSelected = !!day && !!selected && selected.getDate() === day && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!day}
                      onClick={() => day && commit(day, time)}
                      className={`aspect-square rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                        !day ? "invisible" : isSelected ? "bg-indigo-600 text-white" : isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {day || ""}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-center">
                <AnalogClock
                  hour24={parseInt(time.split(":")[0], 10)}
                  minute={parseInt(time.split(":")[1], 10)}
                  isDarkMode={isDarkMode}
                  onChange={(h, m) => {
                    const newTime = `${pad(h)}:${pad(m)}`;
                    setTime(newTime);
                    if (selected) commit(selected.getDate(), newTime);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full mt-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
