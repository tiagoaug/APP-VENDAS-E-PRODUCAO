import { useState } from 'react';
import { HandCoins, Plus, ChevronDown, Trash2, Calendar, DollarSign, User, Check, X, Calculator as CalculatorIcon } from 'lucide-react';
import { Collaborator, CollaboratorLoan, LoanPayment } from '../types';
import { generateId } from '../utils/id';
import { toast } from '../utils/toast';
import ConfirmDialog from '../components/ConfirmDialog';
import CalculatorModal from '../components/CalculatorModal';
import { format } from 'date-fns';

// Empréstimos da empresa a colaboradores (RH → Empréstimos) — desconto mensal automático na
// Folha de Pagamento (ver CommissionToSellersCard.tsx: usa CollaboratorLoan.monthlyDeduction pra
// abater do Fechamento e registra o abatimento como LoanPayment tipo 'payroll' aqui) mais
// pagamentos manuais registrados diretamente nesta tela (tipo 'manual', ex.: colaborador pagou
// por fora). O "Restante" de cada empréstimo é sempre totalValue - soma dos payments.
interface LoansViewProps {
  isDarkMode: boolean;
  collaborators: Collaborator[];
  loans: CollaboratorLoan[];
  onSave: (loan: CollaboratorLoan) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

function loanTotals(loan: CollaboratorLoan) {
  const discounted = loan.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, loan.totalValue - discounted);
  return { discounted, remaining };
}

const inputClass = (isDarkMode: boolean) =>
  `px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`;

const labelClass = 'text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1';

function emptyDraft(): CollaboratorLoan {
  return {
    id: generateId(),
    collaboratorId: '',
    collaboratorName: '',
    totalValue: 0,
    monthlyDeduction: 0,
    date: Date.now(),
    payments: [],
  };
}

export default function LoansView({ isDarkMode, collaborators, loans, onSave, onDelete }: LoansViewProps) {
  const [draft, setDraft] = useState<CollaboratorLoan | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Qual campo do formulário a calculadora está preenchendo — 'total' (Valor do Empréstimo) ou
  // 'monthly' (Desconto Mensal). A calculadora já soma/subtrai/multiplica/divide sozinha (ex.:
  // "500 - 50" pra já entrar com o valor descontado), sem precisar fazer conta de cabeça.
  const [calculatorTarget, setCalculatorTarget] = useState<'total' | 'monthly' | null>(null);
  // Calculadora pro campo de pagamento manual — guarda o ID do empréstimo alvo (cada card de
  // empréstimo tem seu próprio campo, mas usam a mesma calculadora, uma instância só).
  const [calculatorPaymentLoanId, setCalculatorPaymentLoanId] = useState<string | null>(null);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const activeLoans = loans.filter(l => loanTotals(l).remaining > 0).sort((a, b) => b.date - a.date);
  const paidLoans = loans.filter(l => loanTotals(l).remaining <= 0).sort((a, b) => b.date - a.date);

  const handleSave = async () => {
    if (!draft || !draft.collaboratorId || draft.totalValue <= 0 || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draft);
      toast.show('Empréstimo salvo com sucesso!');
      setDraft(null);
    } catch (e: any) {
      toast.show('Erro ao salvar empréstimo: ' + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDelete(deleteTarget);
      toast.show('Empréstimo excluído.');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.show('Erro ao excluir: ' + (e?.message || e));
    }
  };

  const registerManualPayment = async (loan: CollaboratorLoan) => {
    const raw = paymentDrafts[loan.id];
    const amount = Math.max(0, Number(raw) || 0);
    if (amount <= 0) {
      toast.show('Informe um valor válido.');
      return;
    }
    const payment: LoanPayment = { id: generateId(), date: Date.now(), amount, type: 'manual' };
    await onSave({ ...loan, payments: [...loan.payments, payment] });
    setPaymentDrafts(prev => ({ ...prev, [loan.id]: '' }));
    toast.show('Pagamento registrado!');
  };

  const renderLoanCard = (loan: CollaboratorLoan) => {
    const { discounted, remaining } = loanTotals(loan);
    const collab = collaborators.find(c => c.id === loan.collaboratorId);
    const isExpanded = expandedId === loan.id;
    return (
      <div key={loan.id} className={`rounded-[2rem] overflow-hidden border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <button
          type="button"
          onClick={() => setExpandedId(v => v === loan.id ? null : loan.id)}
          className="w-full flex items-center justify-between gap-3 p-5 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            {collab?.photoUrl ? (
              <img src={collab.photoUrl} alt={loan.collaboratorName} className="w-10 h-10 rounded-2xl shrink-0 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: collab?.colorHex || '#64748b' }}>
                {loan.collaboratorName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-sm font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{loan.collaboratorName}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Total {fmt(loan.totalValue)} · {format(loan.date, 'dd/MM/yyyy')}
                {loan.monthlyDeduction > 0 && <> · Desconto mensal {fmt(loan.monthlyDeduction)}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className={`text-sm font-black ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmt(remaining)}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Restante</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {isExpanded && (
          <div className={`flex flex-col gap-3 px-5 pb-5 border-t pt-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="grid grid-cols-3 gap-2">
              <div className={`p-3 rounded-xl flex flex-col gap-0.5 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                <span className="text-[8px] font-black uppercase text-slate-400">Empréstimo</span>
                <span className="text-xs font-black">{fmt(loan.totalValue)}</span>
              </div>
              <div className={`p-3 rounded-xl flex flex-col gap-0.5 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                <span className="text-[8px] font-black uppercase text-slate-400">Descontado</span>
                <span className="text-xs font-black text-indigo-500">{fmt(discounted)}</span>
              </div>
              <div className={`p-3 rounded-xl flex flex-col gap-0.5 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                <span className="text-[8px] font-black uppercase text-slate-400">Restante</span>
                <span className={`text-xs font-black ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmt(remaining)}</span>
              </div>
            </div>

            {loan.payments.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-0.5 custom-scrollbar">
                {[...loan.payments].sort((a, b) => b.date - a.date).map(p => (
                  <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <div>
                      <p className="text-[10px] font-black">{format(p.date, 'dd/MM/yyyy')}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{p.type === 'payroll' ? 'Desconto na Folha' : 'Pago pelo Colaborador'}</p>
                    </div>
                    <p className="text-xs font-black text-indigo-500">{fmt(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}

            {remaining > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="Valor pago pelo colaborador"
                  value={paymentDrafts[loan.id] ?? ''}
                  onChange={e => setPaymentDrafts(prev => ({ ...prev, [loan.id]: e.target.value }))}
                  className={`flex-1 ${inputClass(isDarkMode)}`}
                />
                <button
                  type="button"
                  onClick={() => setCalculatorPaymentLoanId(loan.id)}
                  title="Abrir calculadora"
                  aria-label="Abrir calculadora pra este campo"
                  className={`p-3 rounded-2xl border-2 shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-50 border-slate-100 text-indigo-600'}`}
                >
                  <CalculatorIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => registerManualPayment(loan)}
                  className="px-4 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shrink-0"
                >
                  <Check size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDeleteTarget(loan.id)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              <Trash2 size={12} /> Excluir Empréstimo
            </button>
          </div>
        )}
      </div>
    );
  };

  if (draft) {
    return (
      <div className="flex flex-col gap-6 pb-32 max-w-2xl mx-auto">
        <header className="flex items-center gap-3">
          <button type="button" onClick={() => setDraft(null)} className={`p-2 rounded-2xl ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white border border-slate-100 text-slate-500'}`}>
            <X size={18} />
          </button>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Novo Empréstimo</h2>
        </header>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelClass}><User size={11} /> Colaborador</label>
            <select
              value={draft.collaboratorId}
              onChange={e => {
                const c = collaborators.find(cc => cc.id === e.target.value);
                setDraft({ ...draft, collaboratorId: e.target.value, collaboratorName: c?.name || '' });
              }}
              className={inputClass(isDarkMode)}
            >
              <option value="">Selecione...</option>
              {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass}><DollarSign size={11} /> Valor do Empréstimo (R$)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="decimal" min={0} step={0.01}
                value={draft.totalValue || ''}
                onChange={e => setDraft({ ...draft, totalValue: Math.max(0, Number(e.target.value) || 0) })}
                placeholder="0,00"
                className={`flex-1 ${inputClass(isDarkMode)}`}
              />
              <button
                type="button"
                onClick={() => setCalculatorTarget('total')}
                title="Abrir calculadora"
                aria-label="Abrir calculadora pra este campo"
                className={`p-3 rounded-2xl border-2 shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-50 border-slate-100 text-indigo-600'}`}
              >
                <CalculatorIcon size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass}><DollarSign size={11} /> Desconto Mensal no Salário (R$)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="decimal" min={0} step={0.01}
                value={draft.monthlyDeduction || ''}
                onChange={e => setDraft({ ...draft, monthlyDeduction: Math.max(0, Number(e.target.value) || 0) })}
                placeholder="0,00 — deixe em branco pra só receber pagamentos manuais"
                className={`flex-1 ${inputClass(isDarkMode)}`}
              />
              <button
                type="button"
                onClick={() => setCalculatorTarget('monthly')}
                title="Abrir calculadora"
                aria-label="Abrir calculadora pra este campo"
                className={`p-3 rounded-2xl border-2 shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-50 border-slate-100 text-indigo-600'}`}
              >
                <CalculatorIcon size={18} />
              </button>
            </div>
            <p className="text-[9px] font-bold text-slate-400 px-1">Abatido automaticamente do Fechamento da Folha de Pagamento até quitar. Use a calculadora pra já descontar valores manuais (ex.: 800 - 50).</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass}><Calendar size={11} /> Data do Empréstimo</label>
            <input
              type="date"
              value={format(draft.date, 'yyyy-MM-dd')}
              onChange={e => setDraft({ ...draft, date: e.target.value ? new Date(e.target.value + 'T12:00:00').getTime() : Date.now() })}
              className={inputClass(isDarkMode)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!draft.collaboratorId || draft.totalValue <= 0 || isSaving}
          className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-black uppercase tracking-widest transition-all active:scale-95"
        >
          {isSaving ? 'Salvando...' : 'Salvar Empréstimo'}
        </button>

        <CalculatorModal
          isOpen={calculatorTarget !== null}
          onClose={() => setCalculatorTarget(null)}
          isDarkMode={isDarkMode}
          initialValue={calculatorTarget === 'total' ? draft.totalValue : calculatorTarget === 'monthly' ? draft.monthlyDeduction : undefined}
          onResult={(result) => {
            if (calculatorTarget === 'total') setDraft(d => d ? { ...d, totalValue: Math.max(0, result) } : d);
            if (calculatorTarget === 'monthly') setDraft(d => d ? { ...d, monthlyDeduction: Math.max(0, result) } : d);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-32 max-w-2xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
            <HandCoins size={24} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Empréstimos</h2>
        </div>
        <button
          type="button"
          onClick={() => setDraft(emptyDraft())}
          className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-95"
          aria-label="Novo Empréstimo"
        >
          <Plus size={18} />
        </button>
      </header>

      {loans.length === 0 && (
        <div className={`p-8 rounded-[3rem] border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className="text-xs text-slate-400 font-medium italic">Nenhum empréstimo cadastrado ainda.</p>
        </div>
      )}

      {activeLoans.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-500">Ativos</h3>
          <div className="flex flex-col gap-3">{activeLoans.map(renderLoanCard)}</div>
        </div>
      )}

      {paidLoans.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">Quitados</h3>
          <div className="flex flex-col gap-3">{paidLoans.map(renderLoanCard)}</div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Excluir Empréstimo"
        message="Tem certeza que deseja excluir este empréstimo? O histórico de pagamentos será perdido."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <CalculatorModal
        isOpen={calculatorPaymentLoanId !== null}
        onClose={() => setCalculatorPaymentLoanId(null)}
        isDarkMode={isDarkMode}
        initialValue={calculatorPaymentLoanId ? Number(paymentDrafts[calculatorPaymentLoanId]) || undefined : undefined}
        onResult={(result) => {
          if (calculatorPaymentLoanId) setPaymentDrafts(prev => ({ ...prev, [calculatorPaymentLoanId]: String(Math.max(0, result)) }));
        }}
      />
    </div>
  );
}
