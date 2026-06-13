import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Trash2, Send, ClipboardList } from "lucide-react";
import { SoleStockEntry } from "../types";

interface SoleNeedsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  soleStockEntries: SoleStockEntry[];
  onSubmit: (text: string) => void;
}

type NeedRow = {
  id: string;
  moldId: string;
  colorId: string;
  grades: Record<string, string>;
};

const GRADE_BLACKLIST = new Set(["pesagem", "total"]);

const gradeKeysFor = (entries: SoleStockEntry[], moldId: string, colorId: string): string[] => {
  const entry = entries.find((e) => e.moldId === moldId && (e.colorId || "") === colorId);
  if (!entry) return [];
  return Object.keys(entry.stock || {}).filter((k) => !GRADE_BLACKLIST.has(k));
};

const emptyRow = (entries: SoleStockEntry[]): NeedRow => {
  const first = entries[0];
  const moldId = first?.moldId || "";
  const colorId = first ? first.colorId || "" : "";
  const grades: Record<string, string> = {};
  gradeKeysFor(entries, moldId, colorId).forEach((g) => (grades[g] = ""));
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, moldId, colorId, grades };
};

export default function SoleNeedsFormModal({ isOpen, onClose, isDarkMode, soleStockEntries, onSubmit }: SoleNeedsFormModalProps) {
  const [rows, setRows] = useState<NeedRow[]>(() => [emptyRow(soleStockEntries)]);

  const molds = Array.from(new Map(soleStockEntries.map((e) => [e.moldId, e.moldName])).entries());

  const colorsForMold = (moldId: string) =>
    Array.from(
      new Map(
        soleStockEntries.filter((e) => e.moldId === moldId).map((e) => [e.colorId || "", e.colorName || "Sem cor específica"])
      ).entries()
    );

  const updateRow = (id: string, updates: Partial<NeedRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleMoldChange = (id: string, moldId: string) => {
    const colors = colorsForMold(moldId);
    const colorId = colors[0]?.[0] ?? "";
    const grades: Record<string, string> = {};
    gradeKeysFor(soleStockEntries, moldId, colorId).forEach((g) => (grades[g] = ""));
    updateRow(id, { moldId, colorId, grades });
  };

  const handleColorChange = (id: string, colorId: string, moldId: string) => {
    const grades: Record<string, string> = {};
    gradeKeysFor(soleStockEntries, moldId, colorId).forEach((g) => (grades[g] = ""));
    updateRow(id, { colorId, grades });
  };

  const handleGradeChange = (id: string, grade: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, grades: { ...r.grades, [grade]: value } } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow(soleStockEntries)]);

  const removeRow = (id: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const handleSubmit = () => {
    const lines: string[] = ["Quero manter os seguintes níveis de estoque de solados:"];
    let hasAny = false;

    rows.forEach((row) => {
      const entry = soleStockEntries.find((e) => e.moldId === row.moldId && (e.colorId || "") === row.colorId);
      if (!entry) return;
      const gradeEntries = Object.entries(row.grades).filter(([, v]) => Number(v) > 0);
      if (gradeEntries.length === 0) return;
      hasAny = true;
      lines.push(`- Molde: ${entry.moldName} | Cor: ${entry.colorName || "sem cor específica"}`);
      gradeEntries.forEach(([grade, qty]) => {
        lines.push(`  ${grade}: ${Number(qty)} pares`);
      });
    });

    if (!hasAny) return;

    lines.push("");
    lines.push(
      "Verifique o estoque disponível (estoque atual menos o que já está reservado pela produção em andamento) e, se houver déficit em algum tamanho, proponha o pedido de compra de solados necessário."
    );

    onSubmit(lines.join("\n"));
    setRows([emptyRow(soleStockEntries)]);
    onClose();
  };

  const inputClass = `px-3 py-2 rounded-xl border text-xs font-semibold outline-none transition-all focus:ring-4 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-indigo-500/10"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-slate-900/5"
  }`;

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
                  <ClipboardList size={13} />
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                  Planejamento de Solados
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
                Informe a grade que você quer manter em estoque para cada molde/cor. A IA vai comparar com o
                disponível (estoque - reservado) e sugerir o pedido de compra do que faltar.
              </p>

              {rows.map((row) => {
                const colors = colorsForMold(row.moldId);
                const grades = Object.keys(row.grades);
                return (
                  <div
                    key={row.id}
                    className={`p-3 rounded-2xl border-2 flex flex-col gap-2 ${isDarkMode ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"}`}
                  >
                    <div className="flex items-center gap-2">
                      <select
                        value={row.moldId}
                        onChange={(e) => handleMoldChange(row.id, e.target.value)}
                        className={`flex-1 ${inputClass}`}
                      >
                        {molds.length === 0 && <option value="">Nenhum molde cadastrado</option>}
                        {molds.map(([moldId, moldName]) => (
                          <option key={moldId} value={moldId}>
                            {moldName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.colorId}
                        onChange={(e) => handleColorChange(row.id, e.target.value, row.moldId)}
                        className={`flex-1 ${inputClass}`}
                      >
                        {colors.map(([colorId, colorName]) => (
                          <option key={colorId} value={colorId}>
                            {colorName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                        aria-label="Remover"
                        className={`p-2 rounded-xl transition-colors disabled:opacity-30 ${isDarkMode ? "text-slate-400 hover:text-red-400 hover:bg-slate-800" : "text-slate-400 hover:text-red-500 hover:bg-slate-100"}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {grades.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {grades.map((grade) => (
                          <div key={grade} className="flex flex-col gap-0.5 min-w-[64px]">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 text-center">{grade}</span>
                            <input
                              type="number"
                              min={0}
                              value={row.grades[grade]}
                              onChange={(e) => handleGradeChange(row.id, grade, e.target.value)}
                              placeholder="0"
                              className={`w-16 text-center ${inputClass}`}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Selecione um molde/cor com grade cadastrada.
                      </span>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRow}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-colors ${
                  isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Plus size={14} />
                Adicionar molde/cor
              </button>
            </div>

            <div className="px-6 py-4 border-t border-slate-50 dark:border-slate-800/50 shrink-0 bg-slate-50/30 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-colors active:scale-95"
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
