import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { X, Receipt, Send } from "lucide-react";
import { Person } from "../types";
import ComboBox from "./ComboBox";

interface ProviderServiceReportFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  providers: Person[];
  onSubmit: (text: string) => void;
}

const QUINZENA_CYCLE_STORAGE_KEY = "ai_provider_report_quinzena_cycle_start_day";

const toInputDate = (d: Date) => format(d, "yyyy-MM-dd");
const toDisplayDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const addDaysLocal = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

// Calcula a quinzena (período de ~15 dias) que contém hoje, com base no dia em que o
// ciclo quinzenal começa (ex.: dia 1 -> 1-15 / 16-fim do mês; dia 5 -> 5-19 / 20-4).
const getQuinzenaPeriod = (cycleStartDay: number): [Date, Date] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = Math.min(Math.max(cycleStartDay, 1), 28);

  const anchorThis = new Date(today.getFullYear(), today.getMonth(), day);
  const midThis = addDaysLocal(anchorThis, 15);
  const anchorNext = new Date(today.getFullYear(), today.getMonth() + 1, day);
  const anchorPrev = new Date(today.getFullYear(), today.getMonth() - 1, day);
  const midPrev = addDaysLocal(anchorPrev, 15);

  if (today < anchorThis) {
    return [midPrev, addDaysLocal(anchorThis, -1)];
  }
  if (today < midThis) {
    return [anchorThis, addDaysLocal(midThis, -1)];
  }
  return [midThis, addDaysLocal(anchorNext, -1)];
};

export default function ProviderServiceReportFormModal({ isOpen, onClose, isDarkMode, providers, onSubmit }: ProviderServiceReportFormModalProps) {
  const [providerId, setProviderId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [cycleStartDay, setCycleStartDay] = useState(() => {
    const stored = Number(localStorage.getItem(QUINZENA_CYCLE_STORAGE_KEY));
    return Number.isFinite(stored) && stored >= 1 && stored <= 28 ? stored : 1;
  });

  useEffect(() => {
    localStorage.setItem(QUINZENA_CYCLE_STORAGE_KEY, String(cycleStartDay));
  }, [cycleStartDay]);

  const inputClass = `px-3 py-2.5 rounded-xl border text-xs font-semibold outline-none transition-all focus:ring-4 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-indigo-500/10"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-slate-900/5"
  }`;

  const periodButtonClass = `px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
    isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  }`;

  const applyPeriod = (from: Date, to: Date) => {
    setFromDate(toInputDate(from));
    setToDate(toInputDate(to));
  };

  const handleThisWeek = () => {
    const now = new Date();
    applyPeriod(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 }));
  };

  const handleThisMonth = () => {
    const now = new Date();
    applyPeriod(startOfMonth(now), endOfMonth(now));
  };

  const handleLastMonth = () => {
    const lastMonth = subMonths(new Date(), 1);
    applyPeriod(startOfMonth(lastMonth), endOfMonth(lastMonth));
  };

  const handleThisQuinzena = () => {
    const [from, to] = getQuinzenaPeriod(cycleStartDay);
    applyPeriod(from, to);
  };

  const handleClearPeriod = () => {
    setFromDate("");
    setToDate("");
  };

  const handleSubmit = () => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    let text = `Quero o relatório de serviços terceirizados do prestador ${provider.name}`;
    if (fromDate && toDate) {
      text += ` no período de ${toDisplayDate(fromDate)} a ${toDisplayDate(toDate)}`;
    } else if (fromDate) {
      text += ` a partir de ${toDisplayDate(fromDate)}`;
    } else if (toDate) {
      text += ` até ${toDisplayDate(toDate)}`;
    } else {
      text += ", considerando todo o período";
    }
    text += ". Quanto tenho que pagar?";

    onSubmit(text);
    setProviderId("");
    setFromDate("");
    setToDate("");
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 no-print" data-no-print="true" style={{ zIndex: 50010 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full max-w-lg max-h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border ${
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            }`}
          >
            <div className="flex items-center justify-between gap-2 px-6 py-5 border-b border-slate-50 dark:border-slate-800/50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Receipt size={13} />
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                  Relatório de Serviços Terceirizados
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Escolha o prestador de serviço e, opcionalmente, o período desejado. A IA vai consultar as O.S. e
                montar um relatório com o total a pagar, podendo ser exportado em PDF ou imagem.
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-900 dark:text-white">Prestador de serviço</span>
                <ComboBox
                  options={providers.map((p) => ({ id: p.id, name: p.name }))}
                  value={providerId}
                  onChange={setProviderId}
                  placeholder="Digite para buscar..."
                  isDarkMode={isDarkMode}
                  icon={<Receipt size={14} />}
                />
                {providers.length === 0 && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Nenhum prestador de serviço cadastrado.
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-900 dark:text-white">Período (opcional)</span>
                <div className="flex items-center gap-2">
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`flex-1 ${inputClass}`} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">até</span>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`flex-1 ${inputClass}`} />
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button type="button" onClick={handleThisWeek} className={periodButtonClass}>Esta semana</button>
                  <button type="button" onClick={handleThisMonth} className={periodButtonClass}>Este mês</button>
                  <button type="button" onClick={handleThisQuinzena} className={periodButtonClass}>Esta quinzena</button>
                  <button type="button" onClick={handleLastMonth} className={periodButtonClass}>Mês passado</button>
                  <button type="button" onClick={handleClearPeriod} className={periodButtonClass}>Todo o período</button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Ciclo da quinzena começa no dia
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    aria-label="Dia de início do ciclo quinzenal"
                    value={cycleStartDay}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val)) setCycleStartDay(Math.min(Math.max(val, 1), 28));
                    }}
                    className={`w-16 px-2 py-1.5 rounded-lg border text-xs font-semibold text-center outline-none transition-all focus:ring-4 ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/10"
                        : "bg-white border-slate-200 text-slate-900 focus:ring-slate-900/5"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-50 dark:border-slate-800/50 shrink-0 bg-slate-50/30 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!providerId}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-colors active:scale-95 disabled:opacity-40"
              >
                <Send size={14} />
                Enviar para a IA
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
