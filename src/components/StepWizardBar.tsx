import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, X, ArrowLeft, ArrowRight } from 'lucide-react';

interface StepWizardBarProps {
  isDarkMode: boolean;
  title: string; // ex.: "Configuração Inicial", "Cadastro Guiado"
  stepIndex: number; // 1-based
  totalSteps: number;
  isComplete: boolean;
  onContinue: () => void;
  onSkipStep: () => void;
  onDismiss: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  // Distância extra do topo, em pixels, somada a env(safe-area-inset-top) — sem isso a barra
  // (fixa via portal, fora do <header> normal) ignorava a área de status e ficava colada/atrás
  // do relógio/notch em vários aparelhos. Usa o MESMO valor de "Espaço no Topo" (Configurações
  // > Acessibilidade) que a pessoa já ajustou pro cabeçalho normal, pra ficar consistente em
  // vez de precisar resolver esse overlap duas vezes.
  topOffsetPx?: number;
}

// Telas como Embalagens/Unidades (dentro de Configuração de Produção) abrem um Modal PRÓPRIO
// por cima (zIndex 60000) quando o passo do Assistente aponta pra elas — como este componente
// antes renderizava dentro do Modal global do Assistente (zIndex 50000), esse Modal interno
// cobria a barra inteira e escondia o "Continuar" depois de completar a etapa (usuário ficava
// sem noção de como avançar). Virou um portal fixo com zIndex bem alto, sempre visível por cima
// de qualquer modal aninhado, independente da tela do passo atual.
export default function StepWizardBar({
  isDarkMode, title, stepIndex, totalSteps, isComplete, onContinue, onSkipStep, onDismiss, onBack, canGoBack, topOffsetPx = 12,
}: StepWizardBarProps) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ top: `calc(env(safe-area-inset-top, 0px) + ${topOffsetPx}px)` }}
      className={`fixed inset-x-0 z-[90000] mx-auto w-[calc(100%-1.5rem)] max-w-md rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {title} · Etapa {stepIndex} de {totalSteps}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Encerrar assistente"
          title="Encerrar assistente"
          className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 px-4 pt-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < stepIndex - 1 ? 'bg-indigo-500' : i === stepIndex - 1 ? 'bg-indigo-400' : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              disabled={!canGoBack}
              aria-label="Voltar etapa"
              title="Voltar etapa"
              className={`p-1.5 rounded-xl shrink-0 transition-colors ${
                canGoBack ? (isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100') : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
              }`}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {isComplete && <Check size={16} className="text-emerald-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onSkipStep}
            className={`text-[11px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
          >
            Pular esta etapa
          </button>
          <button
            onClick={onContinue}
            disabled={!isComplete}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black transition-colors ${
              isComplete ? 'bg-indigo-600 text-white' : `${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'} cursor-not-allowed`
            }`}
          >
            Continuar
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
