import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Pencil, Trash2, Check, ListChecks, Gauge, ExternalLink, AlertTriangle } from "lucide-react";
import { AIQuickPrompt, AIUsageEntry, AIUsageLimits } from "../types";
import {
  subscribeToQuickPrompts,
  saveQuickPrompt,
  deleteQuickPrompt,
  subscribeToUsageEntries,
  getUsageLimits,
  saveUsageLimits,
  computeUsageStats,
  AIUsageStats,
} from "../services/aiSettingsService";
import { AI_PROMPT_ICON_KEYS, getPromptIcon } from "./aiPromptIcons";

interface AIAssistantSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

type PromptFormState = {
  id?: string;
  label: string;
  prompt: string;
  icon: string;
  autoSend: boolean;
};

const EMPTY_FORM: PromptFormState = { label: "", prompt: "", icon: "sparkles", autoSend: false };

function formatTokens(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

function formatUSD(n: number): string {
  return `US$ ${n.toFixed(4)}`;
}

function UsageBar({ label, used, limit, costUSD, isDarkMode }: { label: string; used: number; limit: number; costUSD: number; isDarkMode: boolean }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300">
          {formatTokens(used)} / {formatTokens(limit)} tokens
        </span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-slate-400">Custo estimado: {formatUSD(costUSD)}</span>
    </div>
  );
}

export default function AIAssistantSettings({ isOpen, onClose, isDarkMode }: AIAssistantSettingsProps) {
  const [tab, setTab] = useState<"prompts" | "usage">("prompts");
  const [prompts, setPrompts] = useState<AIQuickPrompt[]>([]);
  const [usageEntries, setUsageEntries] = useState<AIUsageEntry[]>([]);
  const [limits, setLimits] = useState<AIUsageLimits>({ dailyTokenLimit: 100000, weeklyTokenLimit: 500000 });
  const [limitsInput, setLimitsInput] = useState({ daily: "100000", weekly: "500000" });
  const [form, setForm] = useState<PromptFormState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubPrompts = subscribeToQuickPrompts(setPrompts);
    const unsubUsage = subscribeToUsageEntries(setUsageEntries);
    getUsageLimits().then((l) => {
      setLimits(l);
      setLimitsInput({ daily: String(l.dailyTokenLimit), weekly: String(l.weeklyTokenLimit) });
    });
    return () => {
      unsubPrompts();
      unsubUsage();
    };
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const stats: AIUsageStats = computeUsageStats(usageEntries);

  const handleSavePrompt = async () => {
    if (!form || !form.label.trim() || !form.prompt.trim()) return;
    const order = form.id
      ? prompts.find((p) => p.id === form.id)?.order ?? prompts.length
      : prompts.length;
    await saveQuickPrompt({
      id: form.id,
      label: form.label.trim(),
      prompt: form.prompt.trim(),
      icon: form.icon,
      autoSend: form.autoSend,
      order,
    });
    setForm(null);
  };

  const handleDeletePrompt = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeletePrompt = async () => {
    if (!deleteConfirmId) return;
    await deleteQuickPrompt(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleSaveLimits = async () => {
    const daily = Math.max(0, parseInt(limitsInput.daily, 10) || 0);
    const weekly = Math.max(0, parseInt(limitsInput.weekly, 10) || 0);
    const newLimits = { dailyTokenLimit: daily, weeklyTokenLimit: weekly };
    setLimits(newLimits);
    await saveUsageLimits(newLimits);
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border text-xs font-semibold outline-none transition-all focus:ring-4 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-indigo-500/10"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-slate-900/5"
  }`;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 no-print" data-no-print="true" style={{ zIndex: 50001 }}>
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
            className="relative w-full max-w-lg max-h-[85vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 dark:border-slate-800/50 shrink-0">
              <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Configurações do Assistente
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 pt-4 shrink-0">
              <button
                type="button"
                onClick={() => setTab("prompts")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  tab === "prompts"
                    ? "bg-indigo-600 text-white"
                    : isDarkMode
                    ? "bg-slate-800 text-slate-400"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <ListChecks size={14} /> Perguntas
              </button>
              <button
                type="button"
                onClick={() => setTab("usage")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  tab === "usage"
                    ? "bg-indigo-600 text-white"
                    : isDarkMode
                    ? "bg-slate-800 text-slate-400"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <Gauge size={14} /> Uso e Limites
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-3">
              {tab === "prompts" && (
                <>
                  {prompts.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-2xl ${isDarkMode ? "bg-slate-800" : "bg-slate-50"}`}
                    >
                      <span className="text-indigo-500 shrink-0">{getPromptIcon(p.icon)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.label}</p>
                        <p className="text-[10px] font-semibold text-slate-400 truncate">{p.prompt}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm({ id: p.id, label: p.label, prompt: p.prompt, icon: p.icon, autoSend: p.autoSend })}
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-all shrink-0"
                        aria-label="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePrompt(p.id)}
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-all shrink-0"
                        aria-label="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {form ? (
                    <div className={`flex flex-col gap-2.5 p-4 rounded-2xl border ${isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                      <input
                        type="text"
                        placeholder="Título (ex: Resumo do dia)"
                        value={form.label}
                        onChange={(e) => setForm({ ...form, label: e.target.value })}
                        className={inputClass}
                      />
                      <textarea
                        placeholder="Pergunta / instrução para a IA"
                        value={form.prompt}
                        onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                        rows={2}
                        className={`${inputClass} resize-none`}
                      />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {AI_PROMPT_ICON_KEYS.map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setForm({ ...form, icon: key })}
                            className={`p-2 rounded-lg transition-all ${
                              form.icon === key
                                ? "bg-indigo-600 text-white"
                                : isDarkMode
                                ? "bg-slate-700 text-slate-300"
                                : "bg-white text-slate-500 border border-slate-200"
                            }`}
                          >
                            {getPromptIcon(key)}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.autoSend}
                          onChange={(e) => setForm({ ...form, autoSend: e.target.checked })}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        Enviar automaticamente ao clicar (sem precisar completar o texto)
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setForm(null)}
                          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-500"}`}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSavePrompt}
                          className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white flex items-center justify-center gap-1.5"
                        >
                          <Check size={14} /> Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setForm({ ...EMPTY_FORM })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                        isDarkMode ? "bg-slate-800 text-indigo-400 hover:bg-slate-700" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      }`}
                    >
                      <Plus size={14} /> Nova pergunta rápida
                    </button>
                  )}
                </>
              )}

              {tab === "usage" && (
                <>
                  <UsageBar label="Hoje" used={stats.todayTokens} limit={limits.dailyTokenLimit} costUSD={stats.todayCostUSD} isDarkMode={isDarkMode} />
                  <UsageBar label="Esta semana" used={stats.weekTokens} limit={limits.weeklyTokenLimit} costUSD={stats.weekCostUSD} isDarkMode={isDarkMode} />

                  <div className={`flex flex-col gap-2.5 p-4 rounded-2xl ${isDarkMode ? "bg-slate-800" : "bg-slate-50"}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Definir limites (tokens)</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        value={limitsInput.daily}
                        onChange={(e) => setLimitsInput({ ...limitsInput, daily: e.target.value })}
                        placeholder="Limite diário"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        min={0}
                        value={limitsInput.weekly}
                        onChange={(e) => setLimitsInput({ ...limitsInput, weekly: e.target.value })}
                        placeholder="Limite semanal"
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveLimits}
                      className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white"
                    >
                      Salvar limites
                    </button>
                  </div>

                  <div className={`flex flex-col gap-1 p-4 rounded-2xl text-[10px] font-bold leading-relaxed ${isDarkMode ? "bg-slate-800/60 text-slate-400" : "bg-slate-50 text-slate-500"}`}>
                    <p>
                      Total acumulado: {formatTokens(stats.totalTokens)} tokens ({formatUSD(stats.totalCostUSD)} estimado)
                    </p>
                    <p>
                      Os valores de custo são estimativas com base no preço do modelo Claude Sonnet e podem não refletir exatamente sua fatura.
                      O saldo real de créditos da sua conta Anthropic pode ser consultado em{" "}
                      <a
                        href="https://console.anthropic.com/settings/billing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-500 underline"
                      >
                        console.anthropic.com <ExternalLink size={10} />
                      </a>
                      .
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {deleteConfirmId && (
            <div className="fixed inset-0 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ zIndex: 50002 }}>
              <div className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center gap-4 ${isDarkMode ? "bg-slate-900" : "bg-white"}`}>
                <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
                  <AlertTriangle size={32} className="text-rose-500" strokeWidth={2} />
                </div>

                <div className="text-center">
                  <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    Excluir pergunta?
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-2 leading-relaxed">
                    Esta pergunta rápida será removida permanentemente.
                  </p>
                </div>

                <div className="flex gap-3 w-full mt-1">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    title="Cancelar"
                    className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
                      isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeletePrompt}
                    title="Confirmar exclusão"
                    className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
