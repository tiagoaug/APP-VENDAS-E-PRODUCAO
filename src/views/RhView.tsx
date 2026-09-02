import { useMemo, useState } from 'react';
import { UserCog, ChevronRight, ChevronDown, CalendarClock, CalendarDays, Users2, Wallet, Settings, Banknote, Receipt, HandCoins } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Collaborator, Person, Sale, CompanyProfile, ViewType, RhGlobalConfig, CollaboratorLoan } from '../types';
import { computeCollaboratorPayroll } from '../utils/collaborators';
import CommissionToSellersCard from '../components/CommissionToSellersCard';

// Módulo RH — reúne o que antes vivia espalhado em Configurações (Colaboradores) e Financeiro
// (Folha de Pagamento), ver ViewType.RH_MENU em types.ts. Colaboradores continua sendo a
// mesma tela de sempre (CollaboratorsConfigView, ViewType.COLLABORATORS_CONFIG) — aqui é só um
// atalho pra ela, não uma duplicata. Folha de Pagamento é embutida direto (mesmo componente
// reutilizado em Financeiro/Dashboard, ver CommissionToSellersCard.tsx — nome do arquivo ficou
// desatualizado, mas o componente agora soma Salário + Comissão de qualquer colaborador).
interface RhViewProps {
  isDarkMode: boolean;
  sales: Sale[];
  collaborators: Collaborator[];
  people: Person[];
  companyProfile?: CompanyProfile | null;
  onPayCommission?: (params: {
    supplierId?: string;
    initialGeneralItems: { id: string; description: string; quantity: number; value: number; kind: 'general' }[];
    initialDescription: string;
  }) => void;
  onOpenSale?: (id: string) => void;
  onNavigate: (view: ViewType) => void;
  rhConfig: RhGlobalConfig;
  onSaveRhConfig: (config: RhGlobalConfig) => void;
  loans?: CollaboratorLoan[];
  onSaveLoan?: (loan: CollaboratorLoan) => void | Promise<void>;
}

// Dias até a próxima ocorrência de um dia fixo do mês (ex.: dia 5) — se o dia já passou nesse
// mês, aponta pro mês seguinte; clampa em meses mais curtos (ex.: dia 31 em fevereiro vira 28/29).
function daysUntilDayOfMonth(day: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const clampDay = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate());

  let targetMonth = today.getMonth();
  let targetYear = today.getFullYear();
  let target = new Date(targetYear, targetMonth, clampDay(targetYear, targetMonth));

  if (target < today) {
    targetMonth += 1;
    if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
    target = new Date(targetYear, targetMonth, clampDay(targetYear, targetMonth));
  }

  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// N-ésimo dia útil (segunda a sexta) de um mês — não considera feriados, só fins de semana.
function nthBusinessDayOfMonth(year: number, month: number, n: number): Date {
  let count = 0;
  let day = 1;
  while (true) {
    const d = new Date(year, month, day);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      count++;
      if (count === n) return d;
    }
    day++;
  }
}

// Dias até o próximo Nº dia útil do mês — se já passou nesse mês, aponta pro mês seguinte.
function daysUntilNthBusinessDay(n: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let target = nthBusinessDayOfMonth(today.getFullYear(), today.getMonth(), n);
  if (target < today) {
    let nextMonth = today.getMonth() + 1;
    let nextYear = today.getFullYear();
    if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    target = nthBusinessDayOfMonth(nextYear, nextMonth, n);
  }
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function RhView({
  isDarkMode, sales, collaborators, people, companyProfile, onPayCommission, onOpenSale, onNavigate, rhConfig, onSaveRhConfig,
  loans = [], onSaveLoan,
}: RhViewProps) {
  const [configExpanded, setConfigExpanded] = useState(false);

  const cardClass = `p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`;
  const inputClass = `w-full px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`;
  const labelClass = 'text-[10px] font-black uppercase tracking-widest text-slate-400 px-1';

  const diasAtePagamento = useMemo(
    () => rhConfig.paymentDayMode === 'business_day_5' ? daysUntilNthBusinessDay(5) : daysUntilDayOfMonth(rhConfig.paymentDay),
    [rhConfig.paymentDay, rhConfig.paymentDayMode]
  );
  const diasAteAdiantamento = useMemo(() => daysUntilDayOfMonth(rhConfig.advanceDay), [rhConfig.advanceDay]);

  const valorFolhaPagamento = useMemo(() => {
    const payrollCollaborators = collaborators.filter(c => c.isSeller || (c.salary || 0) > 0 || c.cargo === 'diretor');
    const start = startOfMonth(new Date()).getTime();
    const end = endOfMonth(new Date()).getTime();
    return payrollCollaborators.reduce((acc, c) => acc + computeCollaboratorPayroll(c, sales as any, start, end, true).total, 0);
  }, [collaborators, sales]);

  // Divide a Folha do mês entre o que sai no dia de Adiantamento e o que sai no Fechamento —
  // só quem tem "Recebe Adiantamento Quinzenal?" ligado (paymentFrequency BIWEEKLY) divide
  // salário/pró-labore pelo % configurado acima (advancePercent); comissão de vendas sempre
  // fecha junto com o pagamento final, nunca é antecipada.
  const { totalAdiantamento, totalFechamento } = useMemo(() => {
    const payrollCollaborators = collaborators.filter(c => c.isSeller || (c.salary || 0) > 0 || c.cargo === 'diretor');
    const start = startOfMonth(new Date()).getTime();
    const end = endOfMonth(new Date()).getTime();
    const advanceRatio = (rhConfig.advancePercent ?? 50) / 100;
    let adiantamento = 0, fechamento = 0;
    payrollCollaborators.forEach(c => {
      const payroll = computeCollaboratorPayroll(c, sales as any, start, end, true);
      const baseAmount = payroll.salary + payroll.proLabore;
      const commissionAmount = payroll.total - baseAmount;
      if (c.paymentFrequency === 'BIWEEKLY') {
        adiantamento += baseAmount * advanceRatio;
        fechamento += baseAmount * (1 - advanceRatio) + commissionAmount;
      } else {
        fechamento += baseAmount + commissionAmount;
      }
    });
    return { totalAdiantamento: adiantamento, totalFechamento: fechamento };
  }, [collaborators, sales, rhConfig.advancePercent]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col gap-6 pb-10 max-w-4xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400">
          <UserCog size={24} />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">RH</h2>
      </header>

      <div className={cardClass} data-guide-anchor="rh.configGlobal">
        <button
          type="button"
          onClick={() => setConfigExpanded(v => !v)}
          data-guide-anchor="rh.expandirConfigGlobal"
          className="flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-slate-400" />
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Configurações Globais</h3>
          </div>
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${configExpanded ? 'rotate-180' : ''}`} />
        </button>

        {configExpanded && (
          <>
            <p className="text-[10px] font-semibold text-slate-400 -mt-2">Dias de referência da empresa toda — usados pra calcular a contagem regressiva abaixo. Colaboradores com vencimento próprio (aba Financeira) não são afetados.</p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Dia de Pagamento (mensal)</label>
                <div className={`flex p-1 rounded-2xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <button
                    type="button"
                    onClick={() => onSaveRhConfig({ ...rhConfig, paymentDayMode: 'fixed' })}
                    data-guide-anchor="rh.modoPagamentoFixo"
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(rhConfig.paymentDayMode ?? 'fixed') === 'fixed' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    Dia Fixo
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveRhConfig({ ...rhConfig, paymentDayMode: 'business_day_5' })}
                    data-guide-anchor="rh.modoPagamento5DiaUtil"
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rhConfig.paymentDayMode === 'business_day_5' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    5º Dia Útil
                  </button>
                </div>
                {(rhConfig.paymentDayMode ?? 'fixed') === 'fixed' ? (
                  <input
                    type="number" inputMode="numeric" min={1} max={31}
                    value={rhConfig.paymentDay}
                    onChange={e => onSaveRhConfig({ ...rhConfig, paymentDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
                    data-guide-anchor="rh.diaPagamento"
                    className={inputClass}
                  />
                ) : (
                  <p className="text-[9px] font-bold text-slate-400 px-1">Paga sempre no 5º dia útil do mês (só considera fins de semana, não feriados).</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Dia de Adiantamento (quinzena)</label>
                <input
                  type="number" inputMode="numeric" min={1} max={31}
                  value={rhConfig.advanceDay}
                  onChange={e => onSaveRhConfig({ ...rhConfig, advanceDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
                  data-guide-anchor="rh.diaAdiantamento"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>% do Salário no Adiantamento</label>
                <input
                  type="number" inputMode="numeric" min={0} max={100}
                  value={rhConfig.advancePercent}
                  onChange={e => onSaveRhConfig({ ...rhConfig, advancePercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  data-guide-anchor="rh.percentualAdiantamento"
                  className={inputClass}
                />
                <p className="text-[9px] font-bold text-slate-400 px-1">Ex.: 40 = 40% no Adiantamento e 60% no Fechamento, pra quem tem "Recebe Adiantamento Quinzenal?" ligado.</p>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className={`p-4 rounded-2xl flex flex-col gap-1 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`} data-guide-anchor="rh.diasAtePagamento">
            <div className="flex items-center gap-1.5 text-slate-400">
              <CalendarClock size={13} />
              <span className="text-[9px] font-black uppercase tracking-widest">Faltam p/ Pagamento</span>
            </div>
            <span className="text-lg font-black text-emerald-500">{diasAtePagamento === 0 ? 'Hoje' : `${diasAtePagamento} dia${diasAtePagamento === 1 ? '' : 's'}`}</span>
          </div>
          <div className={`p-4 rounded-2xl flex flex-col gap-1 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`} data-guide-anchor="rh.diasAteAdiantamento">
            <div className="flex items-center gap-1.5 text-slate-400">
              <CalendarDays size={13} />
              <span className="text-[9px] font-black uppercase tracking-widest">Faltam p/ Adiantamento</span>
            </div>
            <span className="text-lg font-black text-indigo-500">{diasAteAdiantamento === 0 ? 'Hoje' : `${diasAteAdiantamento} dia${diasAteAdiantamento === 1 ? '' : 's'}`}</span>
          </div>
          <div className={`p-4 rounded-2xl flex flex-col gap-1 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`} data-guide-anchor="rh.quantidadeColaboradores">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Users2 size={13} />
              <span className="text-[9px] font-black uppercase tracking-widest">Colaboradores</span>
            </div>
            <span className="text-lg font-black text-slate-700 dark:text-slate-200">{collaborators.length}</span>
          </div>
          <div className={`p-4 rounded-2xl flex flex-col gap-1 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`} data-guide-anchor="rh.valorFolhaPagamento">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Wallet size={13} />
              <span className="text-[9px] font-black uppercase tracking-widest">Folha (Mês Atual)</span>
            </div>
            <span className="text-lg font-black text-rose-500">{fmt(valorFolhaPagamento)}</span>
          </div>
          <div className={`p-4 rounded-2xl flex flex-col gap-1 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`} data-guide-anchor="rh.aPagarAdiantamento">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Banknote size={13} />
              <span className="text-[9px] font-black uppercase tracking-widest">A Pagar em Adiantamento ({rhConfig.advancePercent}%)</span>
            </div>
            <span className="text-lg font-black text-indigo-500">{fmt(totalAdiantamento)}</span>
          </div>
          <div className={`p-4 rounded-2xl flex flex-col gap-1 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`} data-guide-anchor="rh.aPagarFechamento">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Receipt size={13} />
              <span className="text-[9px] font-black uppercase tracking-widest">A Pagar em Fechamento ({100 - rhConfig.advancePercent}%)</span>
            </div>
            <span className="text-lg font-black text-emerald-500">{fmt(totalFechamento)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigate(ViewType.COLLABORATORS_CONFIG)}
        data-guide-anchor="rh.colaboradores"
        className={`w-full flex items-center gap-4 p-6 rounded-[2.5rem] border shadow-sm transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/50' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
          <UserCog size={24} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Equipe</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Diretoria, Gerentes e Colaboradores — cadastro, PIN e permissões</p>
        </div>
        <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
      </button>

      <CommissionToSellersCard
        isDarkMode={isDarkMode}
        sales={sales}
        collaborators={collaborators}
        people={people}
        companyProfile={companyProfile}
        onPayCommission={onPayCommission}
        onOpenSale={onOpenSale}
        advancePercent={rhConfig.advancePercent}
        loans={loans}
        onSaveLoan={onSaveLoan}
      />

      <button
        type="button"
        onClick={() => onNavigate(ViewType.COLLABORATOR_LOANS)}
        data-guide-anchor="rh.emprestimos"
        className={`w-full flex items-center gap-4 p-6 rounded-[2.5rem] border shadow-sm transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/50' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
          <HandCoins size={24} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Empréstimos</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Adiantamentos a colaboradores, com desconto na folha</p>
        </div>
        <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
      </button>
    </div>
  );
}
