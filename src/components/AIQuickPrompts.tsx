import { useEffect, useRef } from "react";
import { Zap } from "lucide-react";
import { AIQuickPrompt } from "../types";
import { getPromptIcon } from "./aiPromptIcons";

interface AIQuickPromptsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (prompt: string, autoSend: boolean) => void;
  isDarkMode: boolean;
  prompts: AIQuickPrompt[];
}

export default function AIQuickPrompts({ isOpen, onClose, onSelect, isDarkMode, prompts }: AIQuickPromptsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={`absolute right-0 top-full mt-2 z-10 w-72 rounded-2xl border shadow-xl overflow-hidden ${
        isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
      }`}
    >
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}>
        <Zap size={14} className="text-indigo-500" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perguntas Rápidas</p>
      </div>
      <div className="flex flex-col p-1.5 max-h-80 overflow-y-auto custom-scrollbar">
        {prompts.length === 0 && (
          <p className="px-3 py-3 text-[11px] font-bold text-slate-400 text-center">
            Nenhuma pergunta cadastrada. Adicione em Configurações.
          </p>
        )}
        {prompts.map((qp) => (
          <button
            key={qp.id}
            type="button"
            onClick={() => {
              onSelect(qp.prompt, !!qp.autoSend);
              onClose();
            }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[11px] font-bold transition-all active:scale-[0.98] ${
              isDarkMode ? "text-slate-200 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="text-indigo-500 shrink-0">{getPromptIcon(qp.icon)}</span>
            {qp.label}
          </button>
        ))}
      </div>
    </div>
  );
}
