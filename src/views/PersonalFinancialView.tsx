import { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Category, Account, AccountType, CategoryType, FamilyMember, Budget, Person } from '../types';
import { Search, Plus, TrendingUp, TrendingDown, DollarSign, Wallet, ArrowRightLeft, User, Trash2, Edit, CheckCircle2, AlertCircle, Clock, RefreshCcw, LayoutGrid, ArrowLeft, Settings, Users, Target, ChevronLeft, ChevronRight, Calculator, Phone, Calendar, Eye } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TransactionModal from '../components/TransactionModal';
import ConfirmDialog from '../components/ConfirmDialog';
import CategoryModal from '../components/CategoryModal';
import FamilyMemberModal from '../components/FamilyMemberModal';
import PersonalContactModal from '../components/PersonalContactModal';
import BudgetModal from '../components/BudgetModal';
import TransferToPersonalModal from '../components/TransferToPersonalModal';
import CalculatorModal from '../components/CalculatorModal';
import PartialPaymentModal from '../components/PartialPaymentModal';
import { toast } from '../utils/toast';
import { generateId } from '../utils/id';
import { exportPersonalExpense } from '../utils/personalExpenseExport';

interface PersonalFinancialViewProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  familyMembers: FamilyMember[];
  personalContacts: Person[];
  budgets: Budget[];
  onSaveTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  onEditTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onSaveCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  onEditCategory: (id: string, category: Omit<Category, 'id'>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onSaveFamilyMember: (fm: Omit<FamilyMember, 'id'>) => Promise<void>;
  onEditFamilyMember: (id: string, fm: Partial<FamilyMember>) => Promise<void>;
  onDeleteFamilyMember: (id: string) => Promise<void>;
  onSavePersonalContact: (pc: Omit<Person, 'id'>) => Promise<void>;
  onEditPersonalContact: (id: string, pc: Partial<Person>) => Promise<void>;
  onDeletePersonalContact: (id: string) => Promise<void>;
  onSaveBudget: (b: Omit<Budget, 'id'>) => Promise<void>;
  onEditBudget: (id: string, b: Partial<Budget>) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  onAddAccount: (account: Omit<Account, 'id'>) => Promise<void>;
  onBack: () => void;
  isDarkMode: boolean;
  // Atalhos do card "Saldo Pessoal" no Dashboard geral — já cai direto na ação certa
  // em vez de abrir só a tela de extrato. Ver DashboardView.tsx.
  initialAction?: 'NEW_INCOME' | 'NEW_EXPENSE' | 'BUDGETS' | 'INSTALLMENTS' | 'CONFIG';
}

export default function PersonalFinancialView({ 
  transactions, 
  categories, 
  accounts, 
  familyMembers,
  personalContacts,
  budgets,
  onSaveTransaction, 
  onEditTransaction,
  onDeleteTransaction,
  onSaveCategory,
  onEditCategory,
  onDeleteCategory,
  onSaveFamilyMember,
  onEditFamilyMember,
  onDeleteFamilyMember,
  onSavePersonalContact,
  onEditPersonalContact,
  onDeletePersonalContact,
  onSaveBudget,
  onEditBudget,
  onDeleteBudget,
  onAddAccount,
  onBack,
  isDarkMode,
  initialAction
}: PersonalFinancialViewProps) {
  const [isConfigMode, setIsConfigMode] = useState(false);
  const [configTab, setConfigTab] = useState<'MEMBERS' | 'CONTACTS' | 'BUDGETS' | 'CATEGORIES'>('MEMBERS');
  // "Ver Cadastrados" — a lista só aparece depois de pedida explicitamente (por card), com
  // busca por nome. null = nenhuma lista aberta no momento.
  const [visibleListTab, setVisibleListTab] = useState<'MEMBERS' | 'CONTACTS' | 'BUDGETS' | null>(null);
  const [configSearch, setConfigSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'ANALYSIS'>('TRANSACTIONS');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<TransactionType>(TransactionType.INCOME);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
  const [txInitialRecurring, setTxInitialRecurring] = useState(false);

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isFmModalOpen, setIsFmModalOpen] = useState(false);
  const [editingFm, setEditingFm] = useState<FamilyMember | undefined>();

  const [isPcModalOpen, setIsPcModalOpen] = useState(false);
  const [editingPc, setEditingPc] = useState<Person | undefined>();

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>();

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [calcResult, setCalcResult] = useState<number | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'TX' | 'CAT' | 'FM' | 'PC' | 'BUDGET'>('TX');

  // Painel de Despesas Mensais — mês navegável por setas
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [paymentTx, setPaymentTx] = useState<Transaction | null>(null);
  const [paymentModalMode, setPaymentModalMode] = useState<'PAYMENT' | 'HISTORY'>('PAYMENT');

  // Filter personal account
  const personalAccount = useMemo(() => accounts.find(a => a.type === AccountType.PERSONAL), [accounts]);
  const personalCategories = useMemo(() => categories.filter(c => c.isPersonal), [categories]);
  
  // Filter personal transactions
  const personalTransactions = useMemo(() => {
    return transactions
      .filter(t => (personalAccount && t.accountId === personalAccount.id) || t.isPersonal)
      .sort((a, b) => b.date - a.date);
  }, [transactions, personalAccount]);

  const filteredTxs = personalTransactions.filter(t => {
    const desc = t.description || '';
    const member = familyMembers.find(m => m.id === t.memberId)?.name || '';
    return desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
           member.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Despesas do mês selecionado no Painel de Despesas (subcards) — cada parcela de uma
  // despesa recorrente é seu próprio Transaction, então o filtro por mês já basta pra
  // mostrar só a parcela correspondente ao mês navegado.
  const monthlyExpenses = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth).getTime();
    const monthEnd = endOfMonth(selectedMonth).getTime();
    return personalTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.date >= monthStart && t.date <= monthEnd)
      .sort((a, b) => a.date - b.date);
  }, [personalTransactions, selectedMonth]);

  const monthSummary = useMemo(() => {
    const total = monthlyExpenses.reduce((acc, t) => acc + t.amount, 0);
    const paidCount = monthlyExpenses.filter(t => t.status === 'COMPLETED').length;
    const pendingCount = monthlyExpenses.filter(t => t.status === 'PENDING').length;
    return { total, paidCount, pendingCount };
  }, [monthlyExpenses]);

  const handlePartialPay = async (amount: number, accountId: string, note: string) => {
    if (!paymentTx) return;
    const newHistory = [...(paymentTx.paymentHistory || []), { id: generateId(), date: Date.now(), amount, accountId, note }];
    const totalPaid = newHistory.reduce((acc, p) => acc + p.amount, 0);
    await onEditTransaction(paymentTx.id, {
      paymentHistory: newHistory,
      status: totalPaid >= paymentTx.amount ? 'COMPLETED' : 'PENDING',
    });
    setPaymentTx(null);
  };

  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date()).getTime();
    const monthEnd = endOfMonth(new Date()).getTime();
    
    const monthlyTxs = personalTransactions.filter(t => t.date >= monthStart && t.date <= monthEnd);
    
    const income = monthlyTxs
      .filter(t => t.type === TransactionType.INCOME && t.status === 'COMPLETED')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const expenses = monthlyTxs
      .filter(t => t.type === TransactionType.EXPENSE && t.status === 'COMPLETED')
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { income, expenses, balance: personalAccount?.balance || 0 };
  }, [personalTransactions, personalAccount]);

  // Budget calculations
  const budgetProgress = useMemo(() => {
    const monthStart = startOfMonth(new Date()).getTime();
    const monthEnd = endOfMonth(new Date()).getTime();
    
    return budgets.map(b => {
      const consumed = personalTransactions
        .filter(t => 
          t.type === TransactionType.EXPENSE && 
          t.categoryId === b.categoryId && 
          t.date >= monthStart && 
          t.date <= monthEnd &&
          (b.memberIds.length === 0 || (t.memberId && b.memberIds.includes(t.memberId)))
        )
        .reduce((acc, curr) => acc + curr.amount, 0);
      
      const percentage = (consumed / b.amount) * 100;
      return { ...b, consumed, percentage };
    });
  }, [budgets, personalTransactions]);

  // Despesas Recorrentes/Parceladas — agrupa por recurrenceGroupId (cada parcela é seu
  // próprio Transaction, ver TransactionModal) pra mostrar uma linha por assinatura/
  // parcelamento, com a próxima parcela em aberto pronta pra quitar com um toque.
  const recurringGroups = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    personalTransactions.forEach(t => {
      if (!t.isRecurring || !t.recurrenceGroupId) return;
      const list = groups.get(t.recurrenceGroupId) || [];
      list.push(t);
      groups.set(t.recurrenceGroupId, list);
    });
    return Array.from(groups.entries()).map(([groupId, txs]) => {
      const sorted = [...txs].sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
      const paidCount = sorted.filter(t => t.status === 'COMPLETED').length;
      const nextPending = sorted.find(t => t.status !== 'COMPLETED') || null;
      const first = sorted[0];
      return {
        groupId,
        description: first.description,
        categoryId: first.categoryId,
        totalInstallments: first.totalInstallments || sorted.length,
        paidCount,
        nextPending,
        allPaid: !nextPending,
      };
    }).sort((a, b) => (a.nextPending?.date || 0) - (b.nextPending?.date || 0));
  }, [personalTransactions]);

  const handleAddTx = (type: TransactionType, recurring = false) => {
    if (!personalAccount) {
      toast.show('Crie a Conta Pessoal primeiro.');
      return;
    }
    setModalInitialType(type);
    setEditingTransaction(undefined);
    setTxInitialRecurring(recurring);
    setIsTxModalOpen(true);
  };

  // Atalhos vindos do card "Saldo Pessoal" no Dashboard geral (ver DashboardView.tsx) —
  // cai direto na ação pedida em vez de só abrir o extrato.
  useEffect(() => {
    if (!initialAction) return;
    if (initialAction === 'NEW_INCOME') handleAddTx(TransactionType.INCOME);
    else if (initialAction === 'NEW_EXPENSE') handleAddTx(TransactionType.EXPENSE);
    else if (initialAction === 'INSTALLMENTS') handleAddTx(TransactionType.EXPENSE, true);
    else if (initialAction === 'BUDGETS') {
      setIsConfigMode(true);
      setConfigTab('BUDGETS');
    }
    else if (initialAction === 'CONFIG') setIsConfigMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  const handleTransfer = () => {
    if (!personalAccount) {
      toast.show('Crie a Conta Pessoal primeiro.');
      return;
    }
    const bizAccounts = accounts.filter(a => a.type !== AccountType.PERSONAL);
    if (bizAccounts.length === 0) {
      toast.show('Você não possui contas comerciais para transferir.');
      return;
    }
    setIsTransferModalOpen(true);
  };

  const confirmTransfer = async (fromId: string, amount: number) => {
    try {
      const from = accounts.find(a => a.id === fromId);
      if (!from || !personalAccount) return;

      // Fallback strategy for categoryId to avoid 'transfer' literal if possible
      const revenueCats = categories.filter(c => c.type === CategoryType.REVENUE);
      const expenseCats = categories.filter(c => c.type === CategoryType.EXPENSE);
      
      const transferInCat = revenueCats.find(c => c.name.toLowerCase().includes('transfer') || c.isPersonal)?.id || revenueCats[0]?.id || 'transfer';
      const transferOutCat = expenseCats.find(c => c.name.toLowerCase().includes('transfer'))?.id || expenseCats[0]?.id || 'transfer';

      await onSaveTransaction({ 
        type: TransactionType.EXPENSE, 
        categoryId: transferOutCat, 
        accountId: from.id, 
        amount, 
        date: Date.now(), 
        description: `Retirada p/ Pessoal: ${from.name}`, 
        status: 'COMPLETED',
        isPersonal: true 
      });
      
      await onSaveTransaction({ 
        type: TransactionType.INCOME, 
        categoryId: transferInCat, 
        accountId: personalAccount.id, 
        amount, 
        date: Date.now(), 
        description: `Recebido da Empresa (${from.name})`, 
        status: 'COMPLETED', 
        isPersonal: true 
      });

      toast.show('Transferência realizada com sucesso!');
    } catch (err: any) { 
      console.error(err);
      toast.show('Erro ao realizar transferência: ' + err.message); 
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
       {/* Header */}
       <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={isConfigMode ? () => setIsConfigMode(false) : onBack}
              data-guide-anchor="pessoal.voltar"
              className={`p-3 rounded-2xl border transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-500'}`}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {isConfigMode ? 'Configurações' : 'Financeiro Pessoal'}
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                {isConfigMode ? 'Gestão de estrutura e orçamentos' : 'Gestão de gastos privados'}
              </p>
            </div>
          </div>

          {!isConfigMode && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsCalcModalOpen(true)}
                data-guide-anchor="pessoal.calculadoraAbrir"
                className={`p-3 rounded-2xl border transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-500'}`}
                title="Abrir Calculadora"
                aria-label="Abrir Calculadora"
              >
                <Calculator size={20} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />
              </button>
            </div>
          )}
       </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Excluir item?"
        message="Esta ação é irreversível."
        confirmLabel="Sim, Excluir"
        onConfirm={async () => {
          if (!idToDelete) return;
          if (deleteType === 'TX') await onDeleteTransaction(idToDelete);
          else if (deleteType === 'CAT') await onDeleteCategory(idToDelete);
          else if (deleteType === 'FM') await onDeleteFamilyMember(idToDelete);
          else if (deleteType === 'PC') await onDeletePersonalContact(idToDelete);
          else if (deleteType === 'BUDGET') await onDeleteBudget(idToDelete);
          setIsConfirmOpen(false);
        }}
        onCancel={() => setIsConfirmOpen(false)}
        isDanger={true}
      />

      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setCalcResult(null);
        }}
        onSave={async (data) => {
          // Não chamar setCalcResult(null) aqui — isso muda a prop initialValue do
          // TransactionModal, que ainda está montado, e dispara o useEffect de reset do
          // formulário (zera isRecurring/totalInstallments/amount) NO MEIO do laço de
          // parcelas, antes das parcelas seguintes serem salvas. onClose já limpa isso
          // uma única vez, depois que todas as parcelas terminam.
          if (editingTransaction) await onEditTransaction(editingTransaction.id, { ...data, isPersonal: true });
          else await onSaveTransaction({ ...data, isPersonal: true });
        }}
        categories={personalCategories}
        onRequestNewCategory={() => { setEditingCategory(null); setIsCatModalOpen(true); }}
        onRequestNewContact={() => { setEditingPc(undefined); setIsPcModalOpen(true); }}
        accounts={personalAccount ? [personalAccount] : accounts}
        familyMembers={familyMembers}
        people={personalContacts}
        initialType={modalInitialType}
        transaction={editingTransaction}
        initialValue={calcResult || undefined}
        initialIsRecurring={txInitialRecurring}
        isDarkMode={isDarkMode}
      />

      {paymentTx && (
        <PartialPaymentModal
          isOpen={!!paymentTx}
          onClose={() => setPaymentTx(null)}
          entity={{ id: paymentTx.id, total: paymentTx.amount, paymentHistory: paymentTx.paymentHistory }}
          accounts={personalAccount ? [personalAccount] : accounts}
          entityLabel={personalContacts.find(p => p.id === paymentTx.contactId)?.name || paymentTx.contactName}
          onPay={handlePartialPay}
          isDarkMode={isDarkMode}
          initialMode={paymentModalMode}
        />
      )}

      <CategoryModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        onSave={async (data) => {
          if (editingCategory) await onEditCategory(editingCategory.id, { ...data, isPersonal: true });
          else await onSaveCategory({ ...data, isPersonal: true } as any);
        }}
        category={editingCategory || undefined}
        categories={categories}
        modulesConfig={{ personal: true, sales: true, production: true, ai: false, entregas: false, bling: false, rh: false }}
        defaultType={CategoryType.OTHER}
        zIndex={110}
      />

      <FamilyMemberModal 
        isOpen={isFmModalOpen}
        onClose={() => setIsFmModalOpen(false)}
        onSave={async (data) => {
          if (editingFm) await onEditFamilyMember(editingFm.id, data);
          else await onSaveFamilyMember(data);
        }}
        member={editingFm}
      />

      <PersonalContactModal 
        isOpen={isPcModalOpen}
        onClose={() => setIsPcModalOpen(false)}
        onSave={async (data) => {
          if (editingPc) await onEditPersonalContact(editingPc.id, data);
          else await onSavePersonalContact(data);
        }}
        contact={editingPc}
        isDarkMode={isDarkMode}
        zIndex={110}
      />

      <BudgetModal 
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        onSave={async (data) => {
          if (editingBudget) await onEditBudget(editingBudget.id, data);
          else await onSaveBudget(data);
        }}
        categories={personalCategories}
        familyMembers={familyMembers}
        budget={editingBudget}
      />

      <TransferToPersonalModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onConfirm={confirmTransfer}
        businessAccounts={accounts.filter(a => a.type !== AccountType.PERSONAL)}
        isDarkMode={isDarkMode}
      />

      <CalculatorModal 
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        isDarkMode={isDarkMode}
        onResult={(result) => {
          // Open transaction modal with this amount
          setEditingTransaction(undefined);
          setModalInitialType(TransactionType.EXPENSE);
          setIsTxModalOpen(true);
          // We need to pass the result to the modal.
          // I'll update TransactionModal to support an initialValue or just force it here if I had a more direct way.
          // For now, I'll store the calc result in a state.
          setCalcResult(result);
        }}
      />

      {!isConfigMode ? (
        <>
          {/* Dashboard View */}
          <div className={`p-8 rounded-[2.5rem] border shadow-xl relative overflow-hidden transition-all ${
            isDarkMode
              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border-slate-800'
              : 'bg-gradient-to-br from-sky-100 via-blue-100 to-sky-200 border-sky-200 text-sky-900'
          }`}>
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-sky-300/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
            
            <div className="absolute top-6 right-8 z-20">
                <button 
                  onClick={handleTransfer}
                  data-guide-anchor="pessoal.transferir"
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                    isDarkMode
                      ? 'bg-slate-800/80 text-indigo-400 border border-slate-700 hover:bg-slate-700'
                      : 'bg-white/60 text-sky-700 backdrop-blur-md border border-sky-200 hover:bg-white/80'
                  }`}
                  title="Receber da Empresa"
                  aria-label="Receber transferência da empresa para conta pessoal"
                >
                  <ArrowRightLeft size={14} strokeWidth={3} /> Receber Empresa
                </button>
            </div>
            
            <div className="relative z-10">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-sky-500'}`}>Saldo Disponível</p>
              <h2 className="text-4xl font-black mt-2 tracking-tighter flex items-baseline gap-2">
                <span className="text-sm opacity-50 font-bold tracking-normal">R$</span>
                {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mt-10">
                <div className={`p-4 rounded-3xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-white/50 backdrop-blur-sm'}`}>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'opacity-60' : 'text-sky-500'}`}>Entradas (Mês)</p>
                  <p className={`text-lg font-black flex items-center gap-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    <TrendingUp size={16} />
                    R$ {stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`p-4 rounded-3xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-white/50 backdrop-blur-sm'}`}>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'opacity-60' : 'text-sky-500'}`}>Saídas (Mês)</p>
                  <p className={`text-lg font-black flex items-center gap-2 ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`}>
                    <TrendingDown size={16} />
                    R$ {stats.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!personalAccount && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-[2rem] flex flex-col items-center gap-4 text-center border border-amber-100 dark:border-amber-800">
                <AlertCircle size={32} className="text-amber-500" />
                <p className="text-[10px] font-black uppercase tracking-tight text-amber-800">Crie sua conta pessoal nas configurações de contas do menu lateral.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsConfigMode(true)}
            data-guide-anchor="pessoal.configAbrirCard"
            title="Configurações do Financeiro Pessoal"
            aria-label="Configurações do Financeiro Pessoal"
            className={`relative text-left p-4 rounded-[1.75rem] border transition-all ${isDarkMode ? "bg-slate-900 border-slate-800 hover:bg-slate-800" : "bg-white border-slate-100 hover:bg-slate-50"}`}
          >
            <div className={`absolute top-3 right-3 p-1.5 rounded-lg ${isDarkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
              <Settings size={14} strokeWidth={2.5} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest pr-8 ${isDarkMode ? "text-white" : "text-slate-700"}`}>Configurações</span>
            <p className="text-[9px] font-bold text-slate-400 leading-snug pr-8 normal-case tracking-normal mt-0.5">
              Onde você configura Família, Fornecedores e Orçamentos do Financeiro Pessoal.
            </p>
          </button>

          {/* Painel de Despesas Mensais — card grande com setas pra trocar de mês e
              subcards de despesa (estilo Compras): fornecedor, data, valor, recorrência/
              parcela, badges de membro e status, e ações editar/excluir/pagar/exportar. */}
          <div className={`p-6 rounded-[2.5rem] border shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setSelectedMonth(m => subMonths(m, 1))}
                data-guide-anchor="pessoal.mesAnterior"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-indigo-400' : 'bg-slate-50 text-slate-400 hover:text-indigo-500'}`}
                title="Mês anterior"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Painel de Despesas</p>
              </div>
              <button
                onClick={() => setSelectedMonth(m => addMonths(m, 1))}
                data-guide-anchor="pessoal.mesProximo"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-indigo-400' : 'bg-slate-50 text-slate-400 hover:text-indigo-500'}`}
                title="Próximo mês"
                aria-label="Próximo mês"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Resumo do mês */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
                <p className="text-[8px] font-black uppercase text-rose-400 tracking-widest mb-1">Total do Mês</p>
                <p className={`text-sm font-black ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>
                  R$ {monthSummary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <p className="text-[8px] font-black uppercase text-emerald-400 tracking-widest mb-1">Pagas</p>
                <p className={`text-sm font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{monthSummary.paidCount}</p>
              </div>
              <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <p className="text-[8px] font-black uppercase text-amber-500 tracking-widest mb-1">A Pagar</p>
                <p className={`text-sm font-black ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>{monthSummary.pendingCount}</p>
              </div>
            </div>

            {/* Subcards de despesa */}
            <div className="flex flex-col gap-3">
              {monthlyExpenses.length === 0 && (
                <p className="text-center text-[10px] font-bold uppercase text-slate-300 dark:text-slate-700 py-6">Nenhuma despesa neste mês.</p>
              )}
              {monthlyExpenses.map(t => {
                const contact = personalContacts.find(p => p.id === t.contactId);
                const member = familyMembers.find(m => m.id === t.memberId);
                const isPaid = t.status === 'COMPLETED';
                const contactName = contact?.name || t.contactName;
                return (
                  <div key={t.id} className={`p-5 rounded-[1.5rem] border flex flex-col gap-3 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-black text-[13px] uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {contactName || t.description}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPaid ? (
                          <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-tight">Quitado</span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-tight">Pendente</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <Calendar size={11} strokeWidth={3} /> {format(t.date, "dd MMM yyyy", { locale: ptBR })}
                    </div>

                    {(t.isRecurring || member) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {t.isRecurring && t.totalInstallments && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                            Parcela {t.installmentNumber}/{t.totalInstallments}
                          </span>
                        )}
                        {member && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <User size={9} /> {member.name}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                      <p className={`font-black text-base ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`}>
                        R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <div className={`flex items-center gap-1.5 p-1.5 rounded-full border shadow-sm backdrop-blur-md ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-100'}`}>
                        <button
                          onClick={() => exportPersonalExpense({ transaction: t, contactName, memberName: member?.name }, 'pdf')}
                          data-guide-anchor="pessoal.exportarPdf"
                          className="w-9 h-9 flex items-center justify-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-full font-black text-[9px]"
                          title="Exportar PDF"
                          aria-label="Exportar PDF"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => exportPersonalExpense({ transaction: t, contactName, memberName: member?.name }, 'jpg')}
                          data-guide-anchor="pessoal.exportarJpg"
                          className="w-9 h-9 flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full font-black text-[9px]"
                          title="Exportar JPG"
                          aria-label="Exportar JPG"
                        >
                          JPG
                        </button>
                        {!isPaid && (
                          <button
                            onClick={() => { setPaymentTx(t); setPaymentModalMode('PAYMENT'); }}
                            data-guide-anchor="pessoal.registrarPagamento"
                            className="w-9 h-9 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-full"
                            title="Registrar Pagamento"
                            aria-label="Registrar Pagamento"
                          >
                            <DollarSign size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingTransaction(t); setIsTxModalOpen(true); }}
                          data-guide-anchor="pessoal.editarDespesa"
                          className={`w-9 h-9 flex items-center justify-center rounded-full text-blue-500 ${isDarkMode ? 'bg-slate-700' : 'bg-white'}`}
                          title="Editar Despesa"
                          aria-label="Editar Despesa"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => { setIdToDelete(t.id); setDeleteType('TX'); setIsConfirmOpen(true); }}
                          data-guide-anchor="pessoal.excluirDespesa"
                          className={`w-9 h-9 flex items-center justify-center rounded-full text-rose-500 ${isDarkMode ? 'bg-slate-700' : 'bg-white'}`}
                          title="Excluir Despesa"
                          aria-label="Excluir Despesa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Despesas Recorrentes — uma linha por assinatura/parcelamento, com a próxima
              parcela em aberto pronta pra quitar com um toque. */}
          {recurringGroups.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Despesas Recorrentes</h3>
                <span className="text-[8px] font-black text-cyan-500 uppercase">Parcelas</span>
              </div>
              <div className="flex flex-col gap-3">
                {recurringGroups.map(g => {
                  const category = categories.find(c => c.id === g.categoryId);
                  return (
                    <div key={g.groupId} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{g.description}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{category?.name} • {g.paidCount}/{g.totalInstallments} pagas</span>
                        {g.nextPending ? (
                          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">
                            Próxima: Parcela {g.nextPending.installmentNumber} • {format(g.nextPending.date, 'dd/MM/yyyy')} • R$ {g.nextPending.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Todas as parcelas quitadas</span>
                        )}
                      </div>
                      {g.nextPending && (
                        <button
                          onClick={() => onEditTransaction(g.nextPending!.id, { status: 'COMPLETED' })}
                          data-guide-anchor="pessoal.quitarParcela"
                          title="Quitar Parcela"
                          aria-label="Quitar Parcela"
                          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                        >
                          <CheckCircle2 size={13} strokeWidth={3} /> Quitar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Budget Progress Section */}
          {budgets.length > 0 && (
            <div className="flex flex-col gap-4">
               <div className="flex items-center justify-between">
                 <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Monitoramento de Orçamentos</h3>
                 <span className="text-[8px] font-black text-indigo-500 uppercase">Mês Atual</span>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {budgetProgress.map(bp => {
                    const category = categories.find(c => c.id === bp.categoryId);
                    const isAlert = bp.percentage >= bp.alertPercentage;
                    const isExceeded = bp.percentage >= 100;
                    const ringColor = isExceeded ? '#f43f5e' : isAlert ? '#f59e0b' : '#10b981';
                    const radius = 22;
                    const circumference = 2 * Math.PI * radius;
                    const dashOffset = circumference * (1 - Math.min(bp.percentage, 100) / 100);
                    return (
                      <div key={bp.id} className={`p-4 rounded-3xl border flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="flex items-center gap-3">
                          <div className="relative w-14 h-14 shrink-0">
                            <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
                              <circle cx="28" cy="28" r={radius} fill="none" strokeWidth="6" className={isDarkMode ? 'stroke-slate-800' : 'stroke-slate-100'} />
                              <circle
                                cx="28" cy="28" r={radius} fill="none" strokeWidth="6" strokeLinecap="round"
                                stroke={ringColor}
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                              />
                            </svg>
                            <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${isExceeded ? 'text-rose-500' : isAlert ? 'text-amber-500' : (isDarkMode ? 'text-white' : 'text-slate-800')}`}>
                              {Math.round(bp.percentage)}%
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <span className={`text-[10px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{category?.name}</span>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Gasto: R$ {bp.consumed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Teto: R$ {bp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                        </div>

                        {(isAlert || isExceeded) && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isExceeded ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                            <AlertCircle size={13} strokeWidth={2.5} />
                            <span className="text-[9px] font-black uppercase tracking-tight">
                              {isExceeded ? 'Orçamento estourado!' : `Atenção: ${Math.round(bp.percentage)}% do teto já consumido`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
               </div>
            </div>
          )}

          {/* Transactions List */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar gastos ou membros..."
                  className={`w-full py-4 pl-12 pr-4 rounded-2xl border text-[11px] font-bold uppercase tracking-tight focus:outline-none focus:ring-4 focus:ring-indigo-500/5 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-800 placeholder:text-slate-300'}`}
                  value={searchTerm}
                  title="Pesquisar Transações"
                  aria-label="Pesquisar gastos ou membros da família"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={() => handleAddTx(TransactionType.EXPENSE)}
                data-guide-anchor="pessoal.adicionarGasto"
                className="bg-indigo-600 text-white px-6 rounded-2xl flex items-center shadow-lg active:scale-95 transition-all"
                title="Adicionar Gasto"
                aria-label="Adicionar Gasto"
              >
                <Plus size={20} strokeWidth={4} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {filteredTxs.map(t => {
                const cat = categories.find(c => c.id === t.categoryId);
                const member = familyMembers.find(m => m.id === t.memberId);
                return (
                  <div key={t.id} className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                        {t.type === TransactionType.INCOME ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                      </div>
                      <div>
                        <h4 className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.description}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{cat?.name} • {format(t.date, 'dd/MM/yy')}</span>
                          {member && (
                            <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tight flex items-center gap-1">
                              <User size={8} /> {member.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black tracking-tight ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                         {t.type === TransactionType.INCOME ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex gap-1 mt-1 justify-end">
                        <button 
                          onClick={() => { setEditingTransaction(t); setIsTxModalOpen(true); }}
                          data-guide-anchor="pessoal.editarTransacao"
                          className="p-1 text-slate-300 hover:text-indigo-400"
                          title="Editar Transação"
                          aria-label="Editar Transação"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => { setIdToDelete(t.id); setDeleteType('TX'); setIsConfirmOpen(true); }}
                          data-guide-anchor="pessoal.excluirTransacao"
                          className="p-1 text-slate-300 hover:text-rose-500"
                          title="Excluir Transação"
                          aria-label="Excluir Transação"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Configuration Area */
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {[
              { id: 'MEMBERS', label: 'Família', icon: Users, color: 'bg-indigo-500', description: 'Cadastre quem divide as contas com você e vincule cada gasto ou receita a uma pessoa da família.', newLabel: 'Novo Membro' },
              { id: 'CONTACTS', label: 'Fornecedores', icon: Phone, color: 'bg-emerald-500', description: 'Contatos pessoais recorrentes — academia, streaming, escola, prestadores de serviço da casa.', newLabel: 'Novo Fornecedor' },
              { id: 'BUDGETS', label: 'Orçamentos', icon: Target, color: 'bg-amber-500', description: 'Defina um teto de gasto por categoria e acompanhe quanto já foi consumido, com avisos ao se aproximar do limite.', newLabel: 'Novo Orçamento' }
            ].map((tab) => (
              <div
                key={tab.id}
                className={`relative p-4 rounded-[1.75rem] flex flex-col gap-2 border transition-all ${
                  visibleListTab === tab.id
                    ? `${isDarkMode ? 'bg-slate-800 border-indigo-500/50 shadow-indigo-500/10' : 'bg-white border-indigo-500/20 shadow-indigo-500/10'} shadow-xl`
                    : `${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-transparent'}`
                }`}
              >
                <div className={`absolute top-3 right-3 ${tab.color} text-white p-1.5 rounded-lg shadow-md`}>
                    <tab.icon size={13} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest pr-8 ${visibleListTab === tab.id ? 'text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                    {tab.label}
                </span>
                <p className="text-[9px] font-bold text-slate-400 leading-snug pr-8 normal-case tracking-normal">
                  {tab.description}
                </p>
                <div className="flex gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConfigTab(tab.id as any);
                      if (tab.id === 'MEMBERS') { setEditingFm(undefined); setIsFmModalOpen(true); }
                      else if (tab.id === 'CONTACTS') { setEditingPc(undefined); setIsPcModalOpen(true); }
                      else { setEditingBudget(undefined); setIsBudgetModalOpen(true); }
                    }}
                    data-guide-anchor="pessoal.configNovo"
                    title={tab.newLabel}
                    aria-label={tab.newLabel}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    <Plus size={11} strokeWidth={3.5} /> Novo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfigTab(tab.id as any);
                      setConfigSearch('');
                      setVisibleListTab(prev => prev === tab.id ? null : tab.id as any);
                    }}
                    data-guide-anchor="pessoal.configVer"
                    title={`Ver cadastrados em ${tab.label}`}
                    aria-label={`Ver cadastrados em ${tab.label}`}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all border ${
                      visibleListTab === tab.id
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                        : `${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`
                    }`}
                  >
                    <Eye size={11} strokeWidth={3} /> Ver
                  </button>
                </div>
              </div>
            ))}
          </div>

          {visibleListTab && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nome..."
                className={`w-full py-3 pl-11 pr-4 rounded-2xl border text-[11px] font-bold tracking-tight focus:outline-none focus:ring-4 focus:ring-indigo-500/5 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-800 placeholder:text-slate-300'}`}
                value={configSearch}
                title="Buscar cadastrados por nome"
                aria-label="Buscar cadastrados por nome"
                onChange={(e) => setConfigSearch(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-3">
             {visibleListTab === 'MEMBERS' && familyMembers.filter(m => m.name.toLowerCase().includes(configSearch.toLowerCase())).map(m => (
               <div key={m.id} className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><User size={20} /></div>
                   <h4 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{m.name}</h4>
                 </div>
                 <div className="flex gap-1">
                   <button 
                     onClick={() => { setEditingFm(m); setIsFmModalOpen(true); }}
                     data-guide-anchor="pessoal.membroEditar"
                     className="p-2 text-slate-300 hover:text-indigo-400"
                     title="Editar Membro"
                     aria-label="Editar Membro"
                   >
                     <Edit size={18} />
                   </button>
                   <button 
                     onClick={() => { setIdToDelete(m.id); setDeleteType('FM'); setIsConfirmOpen(true); }}
                     data-guide-anchor="pessoal.membroExcluir"
                     className="p-2 text-slate-300 hover:text-rose-500"
                     title="Excluir Membro"
                     aria-label="Excluir Membro"
                   >
                     <Trash2 size={18} />
                   </button>
                 </div>
               </div>
             ))}

             {visibleListTab === 'CONTACTS' && personalContacts.filter(c => c.name.toLowerCase().includes(configSearch.toLowerCase())).map(c => (
               <div key={c.id} className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-indigo-400"><Phone size={20} /></div>
                   <div className="flex flex-col">
                      <h4 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{c.name}</h4>
                      <p className="text-[9px] text-slate-400 font-bold tracking-widest">{c.phone}</p>
                   </div>
                 </div>
                 <div className="flex gap-1">
                   <button 
                     onClick={() => { setEditingPc(c); setIsPcModalOpen(true); }}
                     data-guide-anchor="pessoal.fornecedorEditar"
                     className="p-2 text-slate-300 hover:text-emerald-400"
                     title="Editar Fornecedor"
                     aria-label="Editar Fornecedor"
                   >
                     <Edit size={18} />
                   </button>
                   <button 
                     onClick={() => { setIdToDelete(c.id); setDeleteType('PC'); setIsConfirmOpen(true); }}
                     data-guide-anchor="pessoal.fornecedorExcluir"
                     className="p-2 text-slate-300 hover:text-rose-500"
                     title="Excluir Fornecedor"
                     aria-label="Excluir Fornecedor"
                   >
                     <Trash2 size={18} />
                   </button>
                 </div>
               </div>
             ))}

             {visibleListTab === 'BUDGETS' && budgetProgress.filter(bp => (categories.find(c => c.id === bp.categoryId)?.name || '').toLowerCase().includes(configSearch.toLowerCase())).map(bp => {
               const cat = categories.find(c => c.id === bp.categoryId);
               const isAlert = bp.percentage >= bp.alertPercentage;
               const isExceeded = bp.percentage >= 100;
               const ringColor = isExceeded ? '#f43f5e' : isAlert ? '#f59e0b' : '#10b981';
               const radius = 20;
               const circumference = 2 * Math.PI * radius;
               const dashOffset = circumference * (1 - Math.min(bp.percentage, 100) / 100);
               return (
                 <div key={bp.id} className={`p-4 rounded-2xl border flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                   <div className="flex items-center justify-between gap-3">
                     <div className="flex items-center gap-3 min-w-0">
                       <div className="relative w-12 h-12 shrink-0">
                         <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
                           <circle cx="24" cy="24" r={radius} fill="none" strokeWidth="5" className={isDarkMode ? 'stroke-slate-800' : 'stroke-slate-100'} />
                           <circle
                             cx="24" cy="24" r={radius} fill="none" strokeWidth="5" strokeLinecap="round"
                             stroke={ringColor}
                             strokeDasharray={circumference}
                             strokeDashoffset={dashOffset}
                             style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                           />
                         </svg>
                         <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-black ${isExceeded ? 'text-rose-500' : isAlert ? 'text-amber-500' : (isDarkMode ? 'text-white' : 'text-slate-800')}`}>
                           {Math.round(bp.percentage)}%
                         </span>
                       </div>
                       <div className="flex flex-col gap-1 min-w-0">
                         <h4 className={`text-xs font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{cat?.name}</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gasto: R$ {bp.consumed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Teto: R$ {bp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • {bp.memberIds.length === 0 ? 'Todos' : `${bp.memberIds.length} Membros`}</p>
                       </div>
                     </div>
                     <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => { setEditingBudget(bp); setIsBudgetModalOpen(true); }}
                          data-guide-anchor="pessoal.orcamentoEditar"
                          className="p-2 text-slate-300 hover:text-indigo-400"
                          title="Editar Orçamento"
                          aria-label="Editar Orçamento"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => { setIdToDelete(bp.id); setDeleteType('BUDGET'); setIsConfirmOpen(true); }}
                          data-guide-anchor="pessoal.orcamentoExcluir"
                          className="p-2 text-slate-300 hover:text-rose-500"
                          title="Excluir Orçamento"
                          aria-label="Excluir Orçamento"
                        >
                          <Trash2 size={18} />
                        </button>
                     </div>
                   </div>

                   {(isAlert || isExceeded) && (
                     <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isExceeded ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                       <AlertCircle size={13} strokeWidth={2.5} />
                       <span className="text-[9px] font-black uppercase tracking-tight">
                         {isExceeded ? 'Orçamento estourado!' : `Atenção: ${Math.round(bp.percentage)}% do teto já consumido`}
                       </span>
                     </div>
                   )}
                 </div>
               );
             })}
          </div>
        </div>
      )}
    </div>
  );
}

