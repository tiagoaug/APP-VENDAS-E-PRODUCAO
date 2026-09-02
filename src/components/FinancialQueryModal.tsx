import { useState, useMemo } from 'react';
import { Person, Transaction, TransactionType, Sale, Purchase, Account, Product } from '../types';
import { Search, X, User, Calendar, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DatePicker from './DatePicker';
import TransactionListCard from './TransactionListCard';

interface FinancialQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  transactions: Transaction[];
  purchases: Purchase[];
  sales: Sale[];
  products: Product[];
  accounts: Account[];
  onSettle: (transaction: Transaction) => Promise<void>;
  // Mesmos handlers já usados na lista principal do Financeiro (ver FinancialView.tsx
  // handleEdit/handleDeleteClick) — abrem o TransactionModal/ConfirmDialog que já ficam
  // montados lá (z-index maior que este popup, aparecem por cima normalmente).
  onEdit: (transaction: Transaction) => void;
  onDeleteClick: (id: string) => void;
  onOpenPurchase?: (id: string) => void;
  onOpenSale?: (id: string) => void;
  settlingId?: string | null;
  deletingId?: string | null;
  isDarkMode: boolean;
}

export default function FinancialQueryModal({
  isOpen,
  onClose,
  people,
  transactions,
  purchases,
  sales,
  products,
  accounts,
  onSettle,
  onEdit,
  onDeleteClick,
  onOpenPurchase,
  onOpenSale,
  settlingId,
  deletingId,
  isDarkMode
}: FinancialQueryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredPeople = useMemo(() => {
    if (!searchTerm) return [];
    return people.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.document?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [people, searchTerm]);

  const selectedPerson = useMemo(() =>
    people.find(p => p.id === selectedPersonId),
  [people, selectedPersonId]);

  // Resolve o nome/id de "dono" de um lançamento pra filtro por nome — o mesmo dado exibido no
  // card (ver TransactionListCard.tsx): cliente da Venda, fornecedor da Compra, prestador via
  // personId (OS de mão de obra) ou o contactName manual. Sem isso, buscar "Gustavo" não achava
  // a Venda #04000 dele, porque Transaction.contactName fica vazio em lançamentos gerados por
  // Venda/Compra — o nome só existe no registro relacionado (Sale.customerName/Purchase.supplierId).
  const resolveTxPerson = (t: Transaction): { id?: string; name?: string } => {
    const sale = t.relatedId ? sales.find(s => s.id === t.relatedId) : undefined;
    if (sale) return { id: sale.customerId, name: sale.customerName || people.find(p => p.id === sale.customerId)?.name };
    const purchase = t.relatedId ? purchases.find(p => p.id === t.relatedId) : undefined;
    if (purchase) return { id: purchase.supplierId, name: people.find(p => p.id === purchase.supplierId)?.name };
    if (t.contactName || t.contactId) return { id: t.contactId, name: t.contactName };
    if (t.personId) return { id: t.personId, name: people.find(p => p.id === t.personId)?.name };
    return {};
  };

  const filteredTransactions = useMemo(() => {
    let list = transactions;

    // Filter by person if selected
    if (selectedPersonId) {
      list = list.filter(t => {
        const owner = resolveTxPerson(t);
        return owner.id === selectedPersonId || (!!owner.name && owner.name === selectedPerson?.name);
      });
    } else if (searchTerm) {
      // If no person selected, but search term exists, try to match description, IDs or the
      // resolved cliente/fornecedor/prestador — parte do nome já basta (match parcial).
      const term = searchTerm.toLowerCase();
      list = list.filter(t => {
        const owner = resolveTxPerson(t);
        return (
          t.description.toLowerCase().includes(term) ||
          t.id.toLowerCase().includes(term) ||
          t.relatedId?.toLowerCase().includes(term) ||
          t.contactName?.toLowerCase().includes(term) ||
          !!owner.name?.toLowerCase().includes(term)
        );
      });
    }

    // Filter by status
    if (statusFilter !== 'ALL') {
      list = list.filter(t => t.status === statusFilter);
    }

    // Filter by period
    if (startDate) {
      const start = new Date(startDate).getTime();
      list = list.filter(t => t.date >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime();
      list = list.filter(t => t.date <= end);
    }

    return list;
  }, [transactions, selectedPersonId, selectedPerson, searchTerm, statusFilter, startDate, endDate, sales, purchases, people]);

  const stats = useMemo(() => {
    const pendingIncome = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME && t.status === 'PENDING')
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const pendingExpense = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.status === 'PENDING')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const completedIncome = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME && t.status === 'COMPLETED')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const completedExpense = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.status === 'COMPLETED')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const balance = pendingIncome - pendingExpense;
    const movedTotal = completedIncome + completedExpense;

    return { pendingIncome, pendingExpense, balance, movedTotal };
  }, [filteredTransactions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col font-sans select-none lg:p-12">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto"
        onClick={onClose}
      />
      
      <div className={`relative flex-1 flex flex-col overflow-hidden sm:rounded-[3rem] animate-in slide-in-from-bottom duration-500 shadow-2xl ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'}`}>
        {/* Header */}
        <div className={`p-6 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className={`p-2 rounded-xl transition-all active:scale-95 ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              title="Fechar"
              aria-label="Fechar"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Consultas e Baixas</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Visão Financeira Completa</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <div className={`hidden md:flex items-center gap-4 px-4 py-2 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Total Movimentado</p>
                  <p className="text-sm font-black text-indigo-500">R$ {stats.movedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
             </div>
          </div>
        </div>

        {/* Search Bar (Always Visible) */}
        <div className={`px-4 py-3 sm:px-6 sm:py-4 border-b shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex-1 relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome, fornecedor ou ID..."
              title="Pesquisar"
              className={`w-full h-11 pl-12 pr-4 rounded-xl border text-xs font-bold uppercase tracking-tight focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedPersonId) setSelectedPersonId(null);
              }}
            />
            {/* Quick Person Results */}
            {searchTerm && !selectedPersonId && filteredPeople.length > 0 && (
              <div className={`absolute top-full left-0 right-0 z-20 mt-2 rounded-2xl border shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                {filteredPeople.map(person => (
                  <button
                    key={person.id}
                    onClick={() => {
                      setSelectedPersonId(person.id);
                      setSearchTerm(person.name);
                    }}
                    title={person.name}
                    aria-label={`Selecionar ${person.name}`}
                    className={`w-full p-3 flex items-center gap-3 hover:bg-indigo-500/10 text-left transition-colors border-b last:border-b-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <User size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-tight leading-none text-current">{person.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">{person.isSupplier ? 'Fornecedor' : 'Cliente'} {person.document ? `• ${person.document}` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Accordion Capsule */}
        <div className={`mx-4 mt-4 shrink-0 rounded-[2rem] border overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            title="Expandir/Recolher Filtros"
            aria-label="Expandir ou recolher seção de filtros"
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-500/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                <Filter size={16} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-current">Filtros e Resumos</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                    {statusFilter === 'ALL' ? 'Todos Status' : statusFilter === 'PENDING' ? 'Pendentes' : 'Quitadas'}
                  </span>
                  {(startDate || endDate) && (
                    <span className="text-[7px] font-bold text-indigo-500 uppercase tracking-widest">• Com Período</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 mr-4">
                <div className="text-right">
                  <p className="text-[7px] font-black uppercase text-emerald-500 tracking-widest">Receber</p>
                  <p className="text-[10px] font-black">R$ {stats.pendingIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right border-l pl-3 border-slate-200 dark:border-slate-800">
                  <p className="text-[7px] font-black uppercase text-rose-500 tracking-widest">Pagar</p>
                  <p className="text-[10px] font-black">R$ {stats.pendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </div>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className={`p-5 space-y-5 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Filtrar por Status</p>
                    <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                      {[
                        { id: 'ALL', label: 'Todos' },
                        { id: 'PENDING', label: 'Pendentes' },
                        { id: 'COMPLETED', label: 'Quitadas' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setStatusFilter(f.id as any)}
                          title={f.label}
                          aria-label={`Filtrar por ${f.label}`}
                          className={`flex-1 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === f.id ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Filters */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Filtrar Período</p>
                      {(startDate || endDate) && (
                        <button 
                          onClick={() => { setStartDate(''); setEndDate(''); }}
                          className="text-[8px] font-black uppercase text-rose-500 hover:underline"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 flex items-center gap-2 px-3 h-11 rounded-xl border relative ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <DatePicker 
                          raw
                          value={startDate}
                          onChange={setStartDate}
                          placeholder="Data Inicial"
                          className="bg-transparent text-[9px] font-black uppercase tracking-widest focus:outline-none w-full text-current cursor-pointer text-left"
                        />
                      </div>
                      <div className="w-2 h-0.5 bg-slate-300 dark:bg-slate-700 shrink-0"></div>
                      <div className={`flex-1 flex items-center gap-2 px-3 h-11 rounded-xl border relative ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <DatePicker 
                          raw
                          value={endDate}
                          onChange={setEndDate}
                          placeholder="Data Final"
                          className="bg-transparent text-[9px] font-black uppercase tracking-widest focus:outline-none w-full text-current cursor-pointer text-left"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/50 border-emerald-500/20' : 'bg-emerald-50/30 border-emerald-100'}`}>
                      <p className="text-[7px] font-black text-emerald-600 uppercase tracking-widest leading-none">A Receber</p>
                      <p className="text-sm font-black mt-1 text-emerald-600">R$ {stats.pendingIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/50 border-rose-500/20' : 'bg-rose-50/30 border-rose-100'}`}>
                      <p className="text-[7px] font-black text-rose-600 uppercase tracking-widest leading-none">A Pagar</p>
                      <p className="text-sm font-black mt-1 text-rose-600">R$ {stats.pendingExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/50 border-indigo-500/20' : 'bg-indigo-50/30 border-indigo-100'}`}>
                      <p className="text-[7px] font-black text-indigo-600 uppercase tracking-widest leading-none">Pendente</p>
                      <p className={`text-sm font-black mt-1 ${stats.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/50 border-slate-700' : 'bg-slate-100/50 border-slate-200'}`}>
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Volume Período</p>
                      <p className="text-sm font-black mt-1 text-indigo-500">R$ {stats.movedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 sm:pb-32 custom-scrollbar">
           <div className="max-w-2xl mx-auto py-2">
              <div className="flex items-center justify-between mb-6 px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Resultados da Consulta ({filteredTransactions.length})</h3>
                <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800 ml-4"></div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50 dark:bg-slate-900/50 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 rounded-[2rem] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-700 mb-4">
                    <Search size={32} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-8 leading-relaxed">Nenhum lançamento encontrado com esses filtros</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredTransactions.map(tx => (
                    <TransactionListCard
                      key={tx.id}
                      transaction={tx}
                      accounts={accounts}
                      people={people}
                      products={products}
                      sales={sales}
                      purchases={purchases}
                      isDarkMode={isDarkMode}
                      onOpenPurchase={onOpenPurchase}
                      onOpenSale={onOpenSale}
                      onSettle={onSettle}
                      onEdit={onEdit}
                      onDeleteClick={onDeleteClick}
                      settlingId={settlingId}
                      deletingId={deletingId}
                    />
                  ))}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
