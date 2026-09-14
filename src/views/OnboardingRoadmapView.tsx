import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight, ListChecks, Factory, ShoppingBag } from 'lucide-react';

interface OnboardingRoadmapStep {
  label: string;
  why: string;
  isComplete: boolean;
  // Etiqueta 🏭/🛒 — a maioria dos cadastros de catálogo (Empresa, Equipe, Categoria, Cor,
  // Fornecedor, Produto) serve tanto pra quem fabrica quanto pra quem revende ('shared'); só
  // Grade/Embalagem/Unidade são específicos de Fabricação, e Cliente/Conta/Pagamento/Venda são
  // específicos de Vendas.
  group: 'shared' | 'fabricacao' | 'vendas';
}

const GROUP_BADGES: Record<OnboardingRoadmapStep['group'], { label: string; icons: Array<'fabricacao' | 'vendas'> }> = {
  fabricacao: { label: 'Fabricação', icons: ['fabricacao'] },
  vendas: { label: 'Vendas', icons: ['vendas'] },
  shared: { label: 'Vendas e Fabricação', icons: ['vendas', 'fabricacao'] },
};

interface OnboardingRoadmapViewProps {
  isDarkMode: boolean;
  steps: OnboardingRoadmapStep[];
  onStart: () => void;
  onSkip: () => void;
}

// Mostrado uma vez, entre escolher a área de atuação (OnboardingWelcomeView) e o primeiro passo
// de verdade — dá pra quem tá começando ver o caminho inteiro antes de sair tocando em botão,
// em vez de ser surpreendido passo a passo sem saber quantos faltam. Puramente informativo (não
// navega em lugar nenhum sozinho); "Vamos Começar!" é quem de fato dispara o primeiro passo.
export default function OnboardingRoadmapView({ isDarkMode, steps, onStart, onSkip }: OnboardingRoadmapViewProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden force-scrollbar px-1 pb-10">
      <div className="flex flex-col items-center text-center gap-3 pt-4 pb-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <ListChecks size={30} className="text-white" />
        </div>
        <h1 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Seu Caminho até Aqui
        </h1>
        <p className={`text-sm max-w-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          São {steps.length} passos rápidos. Em cada um, a gente te leva direto pro botão certo e explica o que fazer — sem enrolação.
        </p>
      </div>

      <div className={`rounded-3xl border p-2 flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="flex items-start gap-3 p-3"
          >
            <div className="shrink-0 mt-0.5">
              {step.isComplete ? (
                <CheckCircle2 size={20} className="text-emerald-500" />
              ) : (
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  {idx + 1}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-black tracking-tight ${step.isComplete ? 'text-emerald-500 line-through decoration-2' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {step.label}
              </p>
              <p className={`text-[11px] mt-0.5 leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{step.why}</p>
              <div className="flex items-center gap-1 mt-1.5">
                {GROUP_BADGES[step.group].icons.map((icon) => {
                  const Icon = icon === 'fabricacao' ? Factory : ShoppingBag;
                  const colorCls = icon === 'fabricacao'
                    ? (isDarkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-50 text-violet-600')
                    : (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600');
                  return (
                    <span key={icon} className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${colorCls}`} title={GROUP_BADGES[step.group].label}>
                      <Icon size={11} strokeWidth={2.5} />
                    </span>
                  );
                })}
                <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>{GROUP_BADGES[step.group].label}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="mt-6 w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all"
      >
        Vamos Começar! <ArrowRight size={16} />
      </button>

      <button
        onClick={onSkip}
        className={`mt-4 text-xs font-bold uppercase tracking-widest self-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
      >
        Pular por agora
      </button>
    </div>
  );
}
