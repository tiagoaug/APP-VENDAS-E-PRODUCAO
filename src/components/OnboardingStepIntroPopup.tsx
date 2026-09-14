import { useState } from 'react';
import { HelpCircle, Check } from 'lucide-react';

interface OnboardingStepIntroPopupProps {
  isDarkMode: boolean;
  stepIndex: number; // 1-based
  totalSteps: number;
  title: string;
  paragraphs: string[];
}

// Substitui, passo a passo (a pedido do Tiago), o GuidedTourOverlay de tela cheia do
// Assistente de Configuração por algo mais simples: um popup explicando a etapa que aparece
// uma vez ao entrar na tela, fecha com "Entendi" e vira um "?" flutuante que reabre a mesma
// explicação a qualquer momento — sem spotlight, sem tap-to-advance. Quem monta o componente
// (App.tsx) usa `key={stepIndex}` pra remontar (reabrir o popup automaticamente) sempre que o
// assistente avança pra uma etapa nova.
export default function OnboardingStepIntroPopup({ isDarkMode, stepIndex, totalSteps, title, paragraphs }: OnboardingStepIntroPopupProps) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="fixed z-[64000]" style={{ right: 16, bottom: 104 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="O que estou fazendo aqui?"
          aria-label="O que estou fazendo aqui? Toque para ver a explicação desta etapa de novo."
          className="relative w-14 h-14 rounded-full bg-indigo-600 text-white shadow-2xl flex items-center justify-center active:scale-95 transition-transform border-4 border-white dark:border-slate-800"
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
          <HelpCircle size={24} strokeWidth={2.5} className="relative" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[64000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        <span className="self-start px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest">
          Etapa {stepIndex} de {totalSteps}
        </span>

        <h3 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>

        <div className="flex flex-col gap-3">
          {paragraphs.map((p, i) => (
            <p key={i} className={`text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{p}</p>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-1 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all"
        >
          <Check size={16} strokeWidth={3} /> Entendi
        </button>
      </div>
    </div>
  );
}
