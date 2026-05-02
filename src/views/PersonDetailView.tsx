import { useMemo } from 'react';
import { Person, Transaction, TransactionType, Sale, Purchase, Category, Account, SaleStatus } from '../types';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, Wallet, Package, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';

interface PersonDetailViewProps {
  personId: string;
  people: Person[];
  transactions: Transaction[];
  sales: Sale[];
  purchases: Purchase[];
  categories: Category[];
  accounts: Account[];
  onBack: () => void;
  isDarkMode: boolean;
}

export default function PersonDetailView({ 
  personId, 
  people, 
  transactions, 
  sales, 
  purchases, 
  categories, 
  accounts,
  onBack, 
  isDarkMode 
}: PersonDetailViewProps) {
  const person = useMemo(() => people.find(p => p.id === personId), [people, personId]);

  const personTransactions = useMemo(() => 
    transactions.filter(t => t.contactId === personId).sort((a, b) => b.date - a.date),
  [transactions, personId]);

  const personSales = useMemo(() => 
    sales.filter(s => s.customerId === personId && s.status === SaleStatus.SALE).sort((a, b) => b.date - a.date),
  [sales, personId]);

  const personPurchases = useMemo(() => 
    purchases.filter(p => p.supplierId === personId).sort((a, b) => b.date - a.date),
  [purchases, personId]);

  const stats = useMemo(() => {
    const totalTransactions = personTransactions.reduce((acc, t) => {
      return t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount;
    }, 0);

    const pendingToReceive = personTransactions
      .filter(t => t.type === TransactionType.INCOME && t.status === 'PENDING')
      .reduce((acc, t) => acc + t.amount, 0);

    const pendingToPay = personTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.status === 'PENDING')
      .reduce((acc, t) => acc + t.amount, 0);

    return { totalTransactions, pendingToReceive, pendingToPay };
  }, [personTransactions]);

  if (!person) return <div className="p-8 text-center font-bold text-slate-500">Pessoa não encontrada</div>;

  return (
    <div className="flex flex-col gap-6 pb-40">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400" title="Voltar" aria-label="Voltar">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">{person.name}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Histórico Detalhado</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`p-5 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <TrendingUp size={16} strokeWidth={3} />
            <span className="text-[8px] font-black uppercase tracking-widest">A Receber</span>
          </div>
          <p className="text-xl font-black text-emerald-600 tracking-tighter">R$ {stats.pendingToReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className={`p-5 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-rose-50 border-rose-100'}`}>
          <div className="flex items-center gap-2 text-rose-600 mb-2">
            <TrendingDown size={16} strokeWidth={3} />
            <span className="text-[8px] font-black uppercase tracking-widest">A Pagar</span>
          </div>
          <p className="text-xl font-black text-rose-600 tracking-tighter">R$ {stats.pendingToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-3">Transações Financeiras</h3>
          <div className="flex flex-col gap-3">
            {personTransactions.map(t => {
              const category = categories.find(c => c.id === t.categoryId);
              return (
                <div key={t.id} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                      {t.type === TransactionType.INCOME ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                      <p className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                          <Calendar size={10} /> {format(t.date, "dd/MM/yyyy")}
                        </span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${category?.color || 'bg-slate-100 text-slate-500'} text-white`}>
                          {category?.name}
                        </span>
                        <span className={`text-[8px] font-bold uppercase tracking-widest ${t.status === 'COMPLETED' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {t.status === 'COMPLETED' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className={`font-black text-xs ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {t.type === TransactionType.INCOME ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              );
            })}
            {personTransactions.length === 0 && (
              <p className="text-[10px] text-slate-300 italic text-center py-4 uppercase font-bold tracking-widest">Nenhuma transação vinculada</p>
            )}
          </div>
        </div>

        {person.isCustomer && (
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-3">Vendas Realizadas</h3>
            <div className="flex flex-col gap-3">
              {personSales.map(s => (
                <div key={s.id} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 flex items-center justify-center">
                      <ShoppingCart size={18} />
                    </div>
                    <div>
                      <p className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Venda #{s.orderNumber}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                        <Calendar size={10} /> {format(s.date, "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                  <p className={`font-black text-xs ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
              {personSales.length === 0 && (
                <p className="text-[10px] text-slate-300 italic text-center py-4 uppercase font-bold tracking-widest">Nenhuma venda encontrada</p>
              )}
            </div>
          </div>
        )}

        {person.isSupplier && (
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-3">Compras Realizadas</h3>
            <div className="flex flex-col gap-3">
              {personPurchases.map(p => (
                <div key={p.id} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20 flex items-center justify-center">
                      <Package size={18} />
                    </div>
                    <div>
                      <p className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Compra {p.batchNumber ? `Lote ${p.batchNumber}` : 'Estoque'}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                        <Calendar size={10} /> {format(p.date, "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                  <p className={`font-black text-xs ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
              {personPurchases.length === 0 && (
                <p className="text-[10px] text-slate-300 italic text-center py-4 uppercase font-bold tracking-widest">Nenhuma compra encontrada</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
