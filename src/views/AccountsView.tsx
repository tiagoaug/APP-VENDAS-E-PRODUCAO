import { useState } from 'react';
import { Account, AccountType } from '../types';
import { Plus, Wallet, Edit, Trash2, ArrowRightLeft, Search, RefreshCcw, DollarSign, Building2, Landmark, Banknote, User } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

interface AccountsViewProps {
  accounts: Account[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAdjust: (id: string) => void;
  onTransfer: () => void;
  isDarkMode: boolean;
}

export default function AccountsView({ accounts, onAdd, onEdit, onDelete, onAdjust, onTransfer, isDarkMode }: AccountsViewProps) {
  const businessAccounts = accounts.filter(a => a.type !== AccountType.PERSONAL);
  const totalBalance = businessAccounts.reduce((acc, account) => acc + account.balance, 0);
  const [filter, setFilter] = useState('TODAS');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
        case AccountType.BANK: return Landmark;
        case AccountType.CASH: return Banknote;
        case AccountType.SAVINGS: return Building2;
        case AccountType.PERSONAL: return User;
        default: return Wallet;
    }
  };

  const handleDeleteClick = (id: string) => {
    setIdToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (idToDelete) {
      onDelete(idToDelete);
      setIdToDelete(null);
      setIsConfirmOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-64 p-2">
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Excluir Conta?"
        message="Deseja realmente excluir esta conta? Todas as transações passadas permanecerão associadas ao histórico, mas a conta será removida dos novos lançamentos."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsConfirmOpen(false);
          setIdToDelete(null);
        }}
        isDanger={true}
      />
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase">Gerenciamento de Contas</h2>
        <p className="text-sm text-slate-500">Controle financeiro e fluxo entre contas</p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
         <button 
           onClick={onAdd}
           className="py-4 px-6 rounded-3xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
         >
            <Plus size={20} /> Nova Conta
         </button>
         <button 
           onClick={onTransfer}
           className="py-4 px-6 rounded-3xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
         >
            <ArrowRightLeft size={20} /> Transferir
         </button>
      </div>

      {/* Summary Cards */}
      <div className="flex flex-col gap-3">
        <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
          <div className="flex items-center gap-3 text-emerald-500 mb-2">
            <DollarSign size={20} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SALDO TOTAL CONSOLIDADO</span>
          </div>
          <span className="text-4xl font-black text-slate-800 dark:text-white">R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
            <div className="flex items-center gap-3 text-indigo-500 mb-2">
              <Wallet size={20} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">CONTAS ATIVAS</span>
            </div>
            <span className="text-4xl font-black text-slate-800 dark:text-white">{accounts.length}</span>
          </div>
          <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <RefreshCcw size={20} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">TRANSF. RECENTES</span>
            </div>
            <span className="text-4xl font-black text-slate-800 dark:text-white">0</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className={`flex items-center gap-3 p-4 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
        <Search size={20} className="text-slate-400" />
        <input type="text" placeholder="Buscar conta pelo nome..." className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-700 dark:text-white" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['TODAS', 'BANCOS', 'DINHEIRO', 'POUPANÇA', 'PESSOAL'].map((f) => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            {f}
          </button>
        ))}
      </div>
      
      {/* List */}
      <div className="flex flex-col gap-3">
          {accounts.filter(a => {
            if (filter === 'TODAS') return true;
            if (filter === 'BANCOS') return a.type === AccountType.BANK;
            if (filter === 'DINHEIRO') return a.type === AccountType.CASH;
            if (filter === 'POUPANÇA') return a.type === AccountType.SAVINGS;
            if (filter === 'PESSOAL') return a.type === AccountType.PERSONAL;
            return true;
          }).map((account) => {
            const Icon = getAccountIcon(account.type);
            const isPersonal = account.type === AccountType.PERSONAL;
            return (
            <div key={account.id} className={`p-4 rounded-3xl border shadow-sm flex flex-col gap-4 relative group transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              {/* Red dot for personal accounts as shown in user screenshot */}
              {isPersonal && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${account.color} flex items-center justify-center text-white shadow-lg`}>
                    <Icon size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className={`font-black text-sm uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{account.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <p className={`text-lg font-black tracking-tighter italic ${isPersonal ? 'text-indigo-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                         R$ {account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                   <button 
                     onClick={() => onAdjust(account.id)}
                     className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-700 hover:text-emerald-400' : 'text-slate-200 hover:text-emerald-600'}`}
                     title="Reajustar Saldo"
                   >
                     <RefreshCcw size={18} strokeWidth={2.5} />
                   </button>
                   <button 
                     onClick={() => onEdit(account.id)}
                     className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-700 hover:text-indigo-400' : 'text-slate-200 hover:text-indigo-600'}`}
                     title="Editar Conta"
                     aria-label="Editar Conta"
                   >
                     <Edit size={18} strokeWidth={2.5} />
                   </button>
                   <button 
                     onClick={() => handleDeleteClick(account.id)}
                     className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-700 hover:text-rose-500' : 'text-slate-200 hover:text-rose-500'}`}
                     title="Excluir Conta"
                     aria-label="Excluir Conta"
                   >
                     <Trash2 size={18} strokeWidth={2.5} />
                   </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
    </div>
  );
}
