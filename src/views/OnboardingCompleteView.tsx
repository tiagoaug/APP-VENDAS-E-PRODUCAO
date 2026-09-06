import { motion } from 'framer-motion';
import { PartyPopper, ArrowRight, CheckCircle2 } from 'lucide-react';

interface OnboardingCompleteViewProps {
  isDarkMode: boolean;
  completedCount: number;
  totalCount: number;
  onFinish: () => void;
}

// Tela final do Assistente de Configuração — fecha o fluxo com uma confirmação clara em vez de
// simplesmente cair no Painel sem aviso nenhum. Reforça positivamente o que já foi feito (bom
// pra quem tá começando ganhar confiança) e deixa claro que dá pra voltar aqui depois (Mais
// Opções → Assistente de Configuração) pra terminar o que faltou.
export default function OnboardingCompleteView({ isDarkMode, completedCount, totalCount, onFinish }: OnboardingCompleteViewProps) {
  const allDone = completedCount >= totalCount;
  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden force-scrollbar px-1 pb-10">
      <div className="flex flex-col items-center text-center gap-3 pt-8 pb-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30"
        >
          <PartyPopper size={36} className="text-white" />
        </motion.div>
        <h1 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {allDone ? 'Tudo Pronto!' : 'Boa, você avançou!'}
        </h1>
        <p className={`text-sm max-w-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {allDone
            ? 'Você configurou o essencial pra começar a vender de verdade. O app já está pronto pro seu dia a dia.'
            : `Você concluiu ${completedCount} de ${totalCount} passos. Pode continuar de onde parou quando quiser, em Mais Opções → Assistente de Configuração.`}
        </p>
      </div>

      <div className={`flex items-center gap-3 rounded-2xl p-4 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
        <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
        <div className="min-w-0">
          <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{completedCount} de {totalCount} passos concluídos</p>
          <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Categorias, cores, clientes e o resto do essencial já cadastrados dão base pra tudo que vem depois — vendas, produção e financeiro.
          </p>
        </div>
      </div>

      <button
        onClick={onFinish}
        className="mt-6 w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all"
      >
        Ir para o Painel <ArrowRight size={16} />
      </button>
    </div>
  );
}
