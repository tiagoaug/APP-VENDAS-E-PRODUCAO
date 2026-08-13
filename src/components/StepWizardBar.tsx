import { motion } from 'framer-motion';
import { Check, X, ArrowLeft, ArrowRight } from 'lucide-react';

interface StepWizardBarProps {
  isDarkMode: boolean;
  title: string; // ex.: "Configuração Inicial", "Cadastro Guiado"
  stepIndex: number; // 1-based
  totalSteps: number;
  label: string;
  isComplete: boolean;
  onContinue: () => void;
  onSkipStep: () => void;
  onDismiss: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export default function StepWizardBar({
  isDarkMode, title, stepIndex, totalSteps, label, isComplete, onContinue, onSkipStep, onDismiss, onBack, canGoBack,
}: StepWizardBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border shadow-sm mb-4 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
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
          <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {label}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onSkipStep}
            className={`text-[11px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
          >
            Pular etapa
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
    </motion.div>
  );
}
