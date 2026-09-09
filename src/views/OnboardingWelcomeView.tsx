import { motion } from 'framer-motion';
import { Store, Layers, ArrowRight, Sparkles, Info, UserCog } from 'lucide-react';
import type { BusinessType } from '../types';

interface OnboardingWelcomeViewProps {
  isDarkMode: boolean;
  onSelectBusinessType: (type: BusinessType) => void;
  onSkip: () => void;
  // Sai da conta atual e volta pra tela de login/escolha de conta — único jeito de trocar de
  // conta aqui, já que o botão "Voltar" do cabeçalho e o menu de navegação ficam escondidos
  // durante o onboarding (ver App.tsx).
  onSwitchAccount: () => void;
}

// "FABRICACAO" (só fábrica, sem revenda) saiu da lista — não existe mais como estado real do
// app: Produção sempre exige Vendas ativo (ver ModuleConfigView.tsx), então quem fabrica também
// tem Vendas ligado por baixo dos panos. O tipo continua em BusinessType (types.ts) só por
// compatibilidade com contas antigas que já escolheram essa opção antes dessa mudança.
const OPTIONS: { type: BusinessType; title: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    type: 'REVENDA',
    title: 'Revenda',
    description: 'Compro produtos prontos de fornecedores e revendo. Não fabrico nada.',
    icon: <Store size={28} />,
    color: 'bg-emerald-500',
  },
  {
    type: 'HIBRIDO',
    title: 'Fabricação + Revenda',
    description: 'Faço as duas coisas: fabrico alguns modelos e revendo outros.',
    icon: <Layers size={28} />,
    color: 'bg-amber-500',
  },
];

export default function OnboardingWelcomeView({ isDarkMode, onSelectBusinessType, onSkip, onSwitchAccount }: OnboardingWelcomeViewProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden force-scrollbar px-1 pb-10">
      <div className="flex flex-col items-center text-center gap-3 pt-4 pb-8">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Sparkles size={30} className="text-white" />
        </div>
        <h1 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Bem-vindo!
        </h1>
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
          Foco no setor calçadista
        </span>
        <p className={`text-sm max-w-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Vamos configurar o essencial pra você começar a vender. Primeiro, qual é a sua área de atuação?
        </p>
        <p className={`text-xs max-w-xs -mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Feito pra revendedores e pequenas empresas calçadistas, com foco em controle de vendas e produção.
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

      <motion.button
        type="button"
        onClick={onSwitchAccount}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: OPTIONS.length * 0.06 }}
        className={`mt-3 p-4 rounded-3xl border flex items-center gap-4 text-left active:scale-[0.98] transition-transform ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
          <UserCog size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Trocar de Conta</p>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Não é essa conta? Volte pra tela de login e entre com outra.</p>
        </div>
        <ArrowRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
      </motion.button>

      <div className={`mt-4 p-4 rounded-2xl flex items-start gap-2.5 ${isDarkMode ? 'bg-indigo-950/20' : 'bg-indigo-50'}`}>
        <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className={`text-[11px] font-medium leading-relaxed ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
          Só fabrica e não revende produto pronto? Escolha <span className="font-black">"Fabricação + Revenda"</span> mesmo assim — os cadastros usados (produtos, categorias, etc.) são os mesmos nos dois casos.
        </p>
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
