import { useState, useEffect } from 'react';
import { Account, AccountType } from '../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: Omit<Account, 'id'>) => void;
  account?: Account;
}

export default function AccountModal({ isOpen, onClose, onSave, account }: AccountModalProps) {
  const [name, setName] = useState(account?.name || '');
  const [balance, setBalance] = useState<number>(account?.balance || 0);
  const [type, setType] = useState<AccountType>(account?.type || AccountType.BANK);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setBalance(account.balance);
      setType(account.type);
    }
  }, [account]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-xl font-black text-slate-800 dark:text-white">
          {account ? 'Editar Conta' : 'Nova Conta'}
        </h2>
        <input
          type="text"
          placeholder="Nome da Conta"
          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          placeholder="Saldo Inicial"
          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
          value={balance}
          onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
        />
        <div className="grid grid-cols-2 gap-2">
            {[AccountType.BANK, AccountType.CASH, AccountType.SAVINGS, AccountType.PERSONAL].map((t) => (
                <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${type === t ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-transparent'}`}
                >
                    {t === AccountType.BANK ? 'Banco' : t === AccountType.CASH ? 'Dinheiro' : t === AccountType.SAVINGS ? 'Reserva' : 'Pessoal'}
                </button>
            ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
          <button 
            onClick={() => {
              onSave({ name, balance, color: 'bg-indigo-500', type });
              setName('');
              setBalance(0);
              setType(AccountType.BANK);
              onClose();
            }}
            className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold text-white shadow-lg"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
