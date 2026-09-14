import { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

interface OnboardingStepIntroPopupProps {
  isDarkMode: boolean;
  stepIndex: number; // 1-based
  totalSteps: number;
  title: string;
  paragraphs: string[];
  // Versão longa opcional — alternável pelo próprio usuário via "Ver explicação completa" /
  // "Ver resumo". Sem isso, o popup mostra só `paragraphs` sem esse link (compatível com
  // passos ainda não convertidos pra ter as duas versões).
  fullParagraphs?: string[];
  isOpen: boolean;
  onClose: () => void;
}

// Substitui, passo a passo (a pedido do Tiago), o GuidedTourOverlay de tela cheia do
// Assistente de Configuração por algo mais simples: um popup explicando a etapa que aparece
// uma vez ao entrar na tela e fecha com "Entendi" — sem spotlight, sem tap-to-advance. O
// gatilho "?" que reabre essa mesma explicação depois de fechado NÃO mora aqui (fica dentro do
// pill minimizado da navegação, ver App.tsx) — este componente só renderiza o popup em si,
// controlado de fora via isOpen/onClose.
export default function OnboardingStepIntroPopup({ isDarkMode, stepIndex, totalSteps, title, paragraphs, fullParagraphs, isOpen, onClose }: OnboardingStepIntroPopupProps) {
  const [showFull, setShowFull] = useState(false);

  // Sempre reabre no resumo — evita herdar "modo completo" de uma etapa anterior quando o
  // popup reabre pro "?" de uma etapa nova.
  useEffect(() => {
    if (isOpen) setShowFull(false);
  }, [isOpen, title]);

  if (!isOpen) return null;

  const activeParagraphs = showFull && fullParagraphs ? fullParagraphs : paragraphs;

  return (
    <div className="fixed inset-0 z-[64000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-[2rem] p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        <span className="self-start px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest">
          Etapa {stepIndex} de {totalSteps}
        </span>

        <h3 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>

        <div className="flex flex-col gap-3">
          {activeParagraphs.map((p, i) => (
            <p key={i} className={`text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{p}</p>
          ))}
        </div>

        {fullParagraphs && fullParagraphs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFull(v => !v)}
            className="self-start flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-500"
          >
            {showFull ? <>Ver resumo <ChevronUp size={13} /></> : <>Ver explicação completa <ChevronDown size={13} /></>}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all"
        >
          <Check size={16} strokeWidth={3} /> Entendi
        </button>
      </div>
    </div>
  );
}
