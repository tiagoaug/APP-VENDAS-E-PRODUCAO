import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Transaction, TransactionType, Category, Account, AccountType, Person, Purchase, PaymentStatus, PurchaseType, PaymentTerm, PaymentHistory, Sale, Product } from '../types';
import { Search, Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Wallet, User, Trash2, Edit, CheckCircle2, AlertCircle, Clock, RefreshCcw, ClipboardCheck, Package, History, Clipboard, Hash } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TransactionModal from '../components/TransactionModal';
import ConfirmDialog from '../components/ConfirmDialog';
import FinancialQueryModal from '../components/FinancialQueryModal';
import PartialPaymentModal from '../components/PartialPaymentModal';

interface FinancialViewProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  people: Person[];
  purchases: Purchase[];
  sales: Sale[];
  products: Product[];
  onSave: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  onEdit: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdatePurchase: (id: string, purchase: Partial<Purchase>) => Promise<void>;
  onUpdatePerson?: (id: string, updates: Partial<Person>) => Promise<void>;
  isDarkMode: boolean;
}

export default function FinancialView({ 
  transactions, 
  categories, 
  accounts, 
  people,
  purchases,
  sales,
  products,
  onSave, 
  onEdit,
  onDelete,
  onUpdatePurchase,
  onUpdatePerson,
  isDarkMode 
}: FinancialViewProps) {
  const [filterType, setFilterType] = useState<TransactionType | 'ALL' | 'PAYABLE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<TransactionType>(TransactionType.INCOME);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);

  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [paymentModalMode, setPaymentModalMode] = useState<'PAYMENT' | 'HISTORY'>('PAYMENT');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const payableCount = useMemo(() => 
    purchases.filter(p => p.paymentTerm === PaymentTerm.INSTALLMENTS && p.paymentStatus !== PaymentStatus.PAID).length
  , [purchases]);

  const filtered = transactions
    .filter(t => !t.isPersonal && accounts.find(a => a.id === t.accountId)?.type !== AccountType.PERSONAL)
    .filter(t => {
      const matchesFilter = filterType === 'ALL' || t.type === filterType;
      const desc = t.description || '';
      const contact = t.contactName || '';
      const matchesSearch = desc.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            contact.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    }).sort((a, b) => b.date - a.date);

  const businessAccounts = useMemo(() => accounts.filter(a => a.type !== AccountType.PERSONAL), [accounts]);
  const businessCategories = useMemo(() => categories.filter(c => !c.isPersonal), [categories]);

  const stats = useMemo(() => {
    const businessTransactions = transactions.filter(t => !t.isPersonal && accounts.find(a => a.id === t.accountId)?.type !== AccountType.PERSONAL);
    const income = businessTransactions
      .filter(t => t.type === TransactionType.INCOME && t.status === 'COMPLETED')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const expenses = businessTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.status === 'COMPLETED')
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { income, expenses, balance: businessAccounts.reduce((acc, a) => acc + a.balance, 0) };
  }, [transactions, businessAccounts]);

  const handleAdd = (type: TransactionType) => {
    setModalInitialType(type);
    setEditingTransaction(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSettle = async (transaction: Transaction) => {
    try {
      setSettlingId(transaction.id);
      await onEdit(transaction.id, { status: 'COMPLETED' });
      setSettlingId(null);
    } catch (error: any) {
      setSettlingId(null);
      console.error('Error settling transaction:', error);
      alert('Erro ao dar baixa: ' + (error.message || error));
    }
  };

  const handleDeleteClick = (id: string) => {
    setIdToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!idToDelete) return;
    
    setIsConfirmOpen(false);
    try {
      setDeletingId(idToDelete);
      await onDelete(idToDelete);
      setDeletingId(null);
      setIdToDelete(null);
    } catch (error: any) {
      setDeletingId(null);
      setIdToDelete(null);
      console.error('Error deleting transaction:', error);
      alert('Erro ao excluir: ' + (error.message || error));
    }
  };

  const handlePartialPayment = (purchase: Purchase, mode: 'PAYMENT' | 'HISTORY' = 'PAYMENT') => {
    setSelectedPurchase(purchase);
    setPaymentModalMode(mode);
    setIsPaymentModalOpen(true);
  };

  const copyHistory = (purchase: Purchase) => {
    if (!purchase.paymentHistory || purchase.paymentHistory.length === 0) {
      alert('Nenhum pagamento registrado para copiar');
      return;
    }

    const supplier = people.find(s => s.id === purchase.supplierId);
    const text = purchase.paymentHistory
      .map(p => `${format(p.date, 'dd/MM/yyyy')} - R$ ${p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      .join('\n');
    
    const totalPaid = purchase.paymentHistory.reduce((acc, p) => acc + p.amount, 0);
    const remaining = Math.max(0, purchase.total - totalPaid);

    const summary = `Histórico de Pagamentos - Compra #${purchase.id.slice(-6).toUpperCase()}\nFornecedor: ${supplier?.name || '---'}\nTotal: R$ ${purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n${text}\n\nTotal Pago: R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nRestante: R$ ${remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    navigator.clipboard.writeText(summary);
    alert('Histórico de pagamentos copiado!');
  };

  const onPartialPay = async (amount: number, accountId: string, note: string) => {
    if (!selectedPurchase) return;

    const supplier = people.find(s => s.id === selectedPurchase.supplierId);
    
    // 1. Create Transaction
    await onSave({
      type: TransactionType.EXPENSE,
      categoryId: selectedPurchase.categoryId || '',
      accountId: accountId,
      amount: amount,
      date: Date.now(),
      description: `PAGTO PARCIAL COMPRA - ${supplier?.name || ''} ${note ? `(${note})` : ''}`,
      status: 'COMPLETED',
      contactId: selectedPurchase.supplierId,
      contactName: supplier?.name,
      relatedId: selectedPurchase.id
    });

    // 2. Prepare new history entry
    const newPayment: PaymentHistory = {
      id: crypto.randomUUID(),
      date: Date.now(),
      amount: amount,
      accountId: accountId,
      note: note
    };

    const currentHistory = selectedPurchase.paymentHistory || [];
    const updatedHistory = [...currentHistory, newPayment];
    const totalPaid = updatedHistory.reduce((acc, p) => acc + p.amount, 0);

    const isPaid = totalPaid >= selectedPurchase.total;
    
    // 3. Update Purchase
    await onUpdatePurchase(selectedPurchase.id, {
      paymentHistory: updatedHistory,
      paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING
    });

    // 4. Handle Credit if overpaid
    if (totalPaid > selectedPurchase.total && onUpdatePerson && supplier) {
      const overpaid = totalPaid - selectedPurchase.total;
      const currentCredit = supplier.credit || 0;
      await onUpdatePerson(supplier.id, { credit: currentCredit + overpaid });
      alert(`Sobrepagamento de R$ ${overpaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} adicionado como crédito ao fornecedor!`);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32 h-full overflow-y-auto force-scrollbar">
      {selectedPurchase && (
        <PartialPaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPurchase(null);
          }}
          purchase={selectedPurchase}
          accounts={accounts}
          supplier={people.find(s => s.id === selectedPurchase.supplierId)}
          onPay={onPartialPay}
          isDarkMode={isDarkMode}
          initialMode={paymentModalMode}
        />
      )}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Excluir Lançamento?"
        message="Deseja realmente excluir este lançamento? Esta ação irá reverter qualquer saldo vinculado de forma definitiva."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsConfirmOpen(false);
          setIdToDelete(null);
        }}
        isDanger={true}
      />

        <TransactionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={async (data) => {
            try {
              if (editingTransaction) {
                await onEdit(editingTransaction.id, data);
              } else {
                await onSave(data);
              }
            } catch (error: any) {
              console.error('Error saving transaction:', error);
              alert('Erro ao salvar: ' + (error.message || error));
            }
          }}
          categories={businessCategories}
          accounts={businessAccounts}
          people={people}
          initialType={modalInitialType}
          transaction={editingTransaction}
        />

      <FinancialQueryModal
        isOpen={isQueryModalOpen}
        onClose={() => setIsQueryModalOpen(false)}
        people={people}
        transactions={transactions}
        purchases={purchases}
        sales={sales}
        onSettle={handleSettle}
        isDarkMode={isDarkMode}
      />

      <div className="space-y-6">
        {/* Account Warning */}
        {accounts.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex items-center gap-3">
             <AlertCircle className="text-amber-500" size={20} />
             <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest leading-normal">
               Nenhuma conta bancária encontrada. Crie uma conta em "Contas" para gerenciar saldos.
             </p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-3">
          <div className={`p-6 rounded-[2.5rem] border shadow-sm relative group ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-200'}`}>
             <div className="absolute top-6 right-6 flex flex-col items-end gap-3 text-right">
                <div className="flex gap-2">
                   <button 
                     onClick={() => handleAdd(TransactionType.INCOME)}
                     className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                     title="Nova Entrada"
                   >
                     <Plus size={18} strokeWidth={4} />
                   </button>
                   <button 
                     onClick={() => handleAdd(TransactionType.EXPENSE)}
                     className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                     title="Nova Saída"
                   >
                     <Plus size={18} strokeWidth={4} />
                   </button>
                </div>
                
                <button 
                  onClick={() => setIsQueryModalOpen(true)}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-indigo-400 border border-slate-700' : 'bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-sky-900/10 shadow-sm'}`}
                >
                  <ClipboardCheck size={22} strokeWidth={2.5} />
                  <span className="text-[7px] font-black uppercase tracking-[0.1em]">Consultas</span>
                </button>
             </div>
             <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-indigo-100'}`}>Saldo Confirmado</p>
             <h2 className={`text-3xl font-black mt-2 tracking-tighter ${isDarkMode ? 'text-white' : 'text-white'}`}>R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
             
             <div className="flex gap-4 mt-6">
                <div className="flex-1">
                   <p className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-indigo-200'}`}>Receitas</p>
                   <p className="text-sm font-bold text-emerald-400">R$ {stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="flex-1">
                   <p className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-indigo-200'}`}>Despesas</p>
                   <p className="text-sm font-bold text-rose-400">R$ {stats.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 sticky top-0 z-30 py-4 bg-[#fafafa] dark:bg-slate-950 -mx-4 px-4 border-b border-slate-100 dark:border-slate-900 shadow-sm">
          {/* Filters Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button 
              onClick={() => setFilterType('ALL')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterType === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Tudo
            </button>
            <button 
              onClick={() => setFilterType(TransactionType.INCOME)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterType === TransactionType.INCOME ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Entradas
            </button>
            <button 
              onClick={() => setFilterType(TransactionType.EXPENSE)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterType === TransactionType.EXPENSE ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Saídas
            </button>
            <button 
              onClick={() => setFilterType('PAYABLE')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${filterType === 'PAYABLE' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}
            >
              A Pagar
              {payableCount > 0 && (
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[8px] font-black ${filterType === 'PAYABLE' ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>
                  {payableCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar lançamento..."
                className={`w-full border rounded-2xl py-3 pl-11 pr-4 text-xs font-bold uppercase tracking-tight focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 text-slate-800 dark:text-slate-100 shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {filterType === 'PAYABLE' ? (
            purchases
              .filter(p => p.paymentTerm === PaymentTerm.INSTALLMENTS && p.paymentStatus !== PaymentStatus.PAID)
              .filter(p => {
                const supplier = people.find(s => s.id === p.supplierId);
                const supplierName = supplier?.name || '';
                const notes = p.notes || '';
                return supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       notes.toLowerCase().includes(searchTerm.toLowerCase());
              })
              .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
              .map(purchase => {
                const supplier = people.find(s => s.id === purchase.supplierId);
                const daysUntil = purchase.dueDate ? differenceInDays(purchase.dueDate, new Date()) : null;
                const isLate = daysUntil !== null && daysUntil < 0;
                
                const totalPaid = (purchase.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
                const remaining = Math.max(0, purchase.total - totalPaid);

                return (
                  <div key={purchase.id} className={`p-4 rounded-3x border-2 border-dashed flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
                          <Package size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                             <h3 className={`font-black text-xs uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {purchase.type === PurchaseType.REPLENISHMENT ? 'Abastecimento de Estoque' : 'Compra Geral'}
                             </h3>
                             {totalPaid > 0 && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-500">Parcial</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            <span className="flex items-center gap-1"><User size={10} /> {supplier?.name || 'Fornecedor Desconhecido'}</span>
                            <span className="flex items-center gap-1"><Hash size={10} /> ID: {purchase.batchNumber || purchase.id.slice(-6).toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm tracking-tight text-slate-900 dark:text-white">
                          R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {totalPaid > 0 ? (
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 line-through">
                             Total: R$ {purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                           </p>
                        ) : (
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest mt-1 ${isLate ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
                            {isLate ? <AlertCircle size={10} /> : <Clock size={10} />}
                            {isLate ? 'Vencido' : 'Pendente'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-4">
                          {purchase.dueDate && (
                            <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${isLate ? 'text-rose-500' : 'text-slate-400'}`}>
                              <Calendar size={10} />
                              Vence em: {format(purchase.dueDate, "dd/MM/yyyy")}
                            </span>
                          )}
                          {totalPaid > 0 && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                               PAGO: R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                        
                        <button 
                           onClick={() => handlePartialPayment(purchase, 'PAYMENT')}
                           className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all translate-y-[-4px]"
                        >
                          <DollarSign size={16} strokeWidth={3} />
                          Fazer Pagamento
                        </button>
                      </div>

                      {/* New Row: History and Copy */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handlePartialPayment(purchase, 'HISTORY')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:bg-slate-50 dark:hover:bg-slate-800 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-500'}`}
                        >
                          <History size={14} />
                          Ver Histórico
                        </button>
                        <button 
                          onClick={() => copyHistory(purchase)}
                          className={`px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all ${isDarkMode ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/30' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}
                          title="Copiar Histórico de Pagamentos"
                        >
                          <Clipboard size={14} />
                          Copiar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
          ) : (
            filtered.map((transaction) => {
            const category = categories.find(c => c.id === transaction.categoryId);
            const account = accounts.find(a => a.id === transaction.accountId);
            const isPending = transaction.status === 'PENDING';

            return (
              <div key={transaction.id} className={`p-4 rounded-2xl border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${transaction.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                      {transaction.type === TransactionType.INCOME ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-black text-xs uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {transaction.description}
                        </h3>
                        {transaction.relatedId && sales.find(s => s.id === transaction.relatedId) && (
                           <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 text-[7px] font-black uppercase tracking-widest">VENDA</span>
                        )}
                        {transaction.relatedId && purchases.find(p => p.id === transaction.relatedId) && (
                           <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 text-[7px] font-black uppercase tracking-widest">COMPRA</span>
                        )}
                      </div>

                      {/* Sale Details if applicable */}
                      {(() => {
                        const sale = sales.find(s => s.id === transaction.relatedId);
                        if (sale) {
                          return (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <User size={10} className="text-indigo-400" />
                                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                  {sale.customerName || people.find(p => p.id === sale.customerId)?.name || 'Consumidor'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1">
                                  <Clipboard size={10} />
                                  Pedido #{sale.orderNumber}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Package size={10} />
                                  {(() => {
                                    const totalItems = sale.items.reduce((acc, item) => acc + item.quantity, 0);
                                    const firstItem = sale.items[0];
                                    const firstProduct = products.find(p => p.id === firstItem?.productId);
                                    if (sale.items.length === 1 && firstProduct) {
                                      return `${firstItem.quantity}x ${firstProduct.name}`;
                                    }
                                    if (sale.items.length > 1 && firstProduct) {
                                      return `${totalItems} Itens (${firstProduct.name}...)`;
                                    }
                                    return `${totalItems} Itens`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const purchase = purchases.find(p => p.id === transaction.relatedId);
                        if (purchase) {
                          const supplier = people.find(p => p.id === purchase.supplierId);
                          return (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                  {supplier?.name || 'Fornecedor'}
                                </span>
                              </div>
                              {purchase.notes && (
                                <p className="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[200px]">
                                  {purchase.notes}
                                </p>
                              )}
                            </div>
                          );
                        }

                        if (transaction.contactName) {
                          return (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              <User size={10} /> {transaction.contactName}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm tracking-tight ${transaction.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {transaction.type === TransactionType.INCOME ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest mt-1 ${isPending ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                      {isPending ? <Clock size={10} /> : <CheckCircle2 size={10} />}
                      {isPending ? 'Pendente' : 'Confirmado'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[9px] text-indigo-400 dark:text-indigo-500 font-bold uppercase tracking-widest flex items-center gap-1">
                      <Wallet size={10} />
                      {account?.name || 'Conta'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={10} />
                      {format(transaction.date, "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    {isPending && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSettle(transaction);
                        }}
                        disabled={settlingId === transaction.id}
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
                          settlingId === transaction.id 
                            ? 'bg-slate-200 text-slate-500 animate-pulse' 
                            : 'bg-emerald-500 text-white shadow-emerald-100 hover:bg-emerald-600'
                        }`}
                      >
                        {settlingId === transaction.id ? (
                          <> <RefreshCcw size={14} className="animate-spin" /> Processando... </>
                        ) : (
                          <> <CheckCircle2 size={16} strokeWidth={3} /> Dar Baixa </>
                        )}
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(transaction);
                      }} 
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-500 active:bg-indigo-50 transition-all"
                      title="Editar Lançamento"
                      aria-label="Editar Lançamento"
                    >
                      <Edit size={18} strokeWidth={2.5} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(transaction.id);
                      }}
                      disabled={deletingId === transaction.id}
                      className={`p-3 rounded-xl transition-all ${
                        deletingId === transaction.id
                          ? 'bg-slate-100 text-slate-300 animate-pulse'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 active:bg-rose-50'
                      }`}
                      title="Excluir Lançamento"
                      aria-label="Excluir Lançamento"
                    >
                      {deletingId === transaction.id ? (
                        <RefreshCcw size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
          
          {filtered.length === 0 && filterType !== 'PAYABLE' && (
            <div className="text-center py-12">
              <AlertCircle size={48} className="mx-auto text-slate-100 dark:text-slate-800 mb-4" strokeWidth={1} />
              <p className="text-xs text-slate-300 dark:text-slate-700 font-bold uppercase tracking-widest italic">Nenhuma transação encontrada</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

