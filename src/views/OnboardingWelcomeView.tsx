import { motion } from 'framer-motion';
import { Store, Factory, Layers, ArrowRight, Sparkles } from 'lucide-react';
import type { BusinessType } from '../types';

interface OnboardingWelcomeViewProps {
  isDarkMode: boolean;
  onSelectBusinessType: (type: BusinessType) => void;
  onSkip: () => void;
}

const OPTIONS: { type: BusinessType; title: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    type: 'REVENDA',
    title: 'Revenda',
    description: 'Compro produtos prontos de fornecedores e revendo. Não fabrico nada.',
    icon: <Store size={28} />,
    color: 'bg-emerald-500',
  },
  {
    type: 'FABRICACAO',
    title: 'Fabricação própria',
    description: 'Produzo meus próprios modelos na fábrica, do zero.',
    icon: <Factory size={28} />,
    color: 'bg-indigo-600',
  },
  {
    type: 'HIBRIDO',
    title: 'Fabricação + Revenda',
    description: 'Faço as duas coisas: fabrico alguns modelos e revendo outros.',
    icon: <Layers size={28} />,
    color: 'bg-amber-500',
  },
];

export default function OnboardingWelcomeView({ isDarkMode, onSelectBusinessType, onSkip }: OnboardingWelcomeViewProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden force-scrollbar px-1 pb-10">
      <div className="flex flex-col items-center text-center gap-3 pt-4 pb-8">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Sparkles size={30} className="text-white" />
        </div>
        <h1 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Bem-vindo!
        </h1>
        <p className={`text-sm max-w-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Vamos configurar o essencial pra você começar a vender. Primeiro, qual é a sua área de atuação?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {OPTIONS.map((opt, idx) => (
          <motion.button
            key={opt.type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            onClick={() => onSelectBusinessType(opt.type)}
            className={`w-full flex items-center gap-4 p-4 rounded-3xl border text-left shadow-sm active:scale-[0.98] transition-transform ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white ${opt.color}`}>
              {opt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{opt.title}</p>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{opt.description}</p>
            </div>
            <ArrowRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
          </motion.button>
        ))}
      </div>

      <button
        onClick={onSkip}
        className={`mt-8 text-xs font-bold uppercase tracking-widest self-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
      >
        Pular por agora
      </button>
    </div>
  );
}
