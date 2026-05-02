import { useState } from 'react';
import { Account, AccountType } from '../types';
import { X, ArrowRightLeft, DollarSign, Landmark, Banknote, Building2 } from 'lucide-react';

interface TransferToPersonalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fromAccountId: string, amount: number) => Promise<void>;
  businessAccounts: Account[];
  isDarkMode: boolean;
}

export default function TransferToPersonalModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  businessAccounts, 
  isDarkMode 
}: TransferToPersonalModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState(businessAccounts[0]?.id || '');
  const [amount, setAmount] = useState<number | string>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const numAmount = Number(amount);
    if (!selectedAccountId) {
      alert('Selecione uma conta de origem');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Informe um valor válido');
      return;
    }

    const sourceAccount = businessAccounts.find(a => a.id === selectedAccountId);
    if (sourceAccount && numAmount > sourceAccount.balance) {
       if (!confirm(`O valor (R$ ${numAmount}) é superior ao saldo da conta (R$ ${sourceAccount.balance}). Deseja continuar?`)) {
         return;
       }
    }

    setIsSubmitting(true);
    try {
      await onConfirm(selectedAccountId, numAmount);
      onClose();
    } catch (error: any) {
      alert('Erro: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.BANK: return Landmark;
      case AccountType.CASH: return Banknote;
      case AccountType.SAVINGS: return Building2;
      default: return Landmark;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Receber da Empresa</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Transferência para Pessoal</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Conta de Origem (Empresa)</label>
            <div className="grid grid-cols-1 gap-2">
               {businessAccounts.map(account => {
                 const Icon = getIcon(account.type);
                 const isSelected = selectedAccountId === account.id;
                 return (
                   <button
                     key={account.id}
                     onClick={() => setSelectedAccountId(account.id)}
                     className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}
                   >
                     <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 text-slate-400 shadow-sm'}`}>
                         <Icon size={20} />
                       </div>
                       <div className="text-left">
                         <p className={`text-[11px] font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{account.name}</p>
                         <p className={`text-[9px] font-bold uppercase tracking-widest ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>Saldo: R$ {account.balance.toLocaleString('pt-BR')}</p>
                       </div>
                     </div>
                     {isSelected && <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-indigo-600"><div className="w-2 h-2 rounded-full bg-indigo-600" /></div>}
                   </button>
                 );
               })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor a Transferir (R$)</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="number"
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processando...
              </span>
            ) : (
              <>
                <ArrowRightLeft size={20} />
                Confirmar Transferência
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
