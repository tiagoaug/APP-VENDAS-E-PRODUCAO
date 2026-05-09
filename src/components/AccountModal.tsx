import { useState, useEffect } from 'react';
import { Account, AccountType, AppModulesConfig } from '../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: Omit<Account, 'id'>) => void;
  account?: Account;
  modulesConfig: AppModulesConfig;
}

export default function AccountModal({ isOpen, onClose, onSave, account, modulesConfig }: AccountModalProps) {
  const [name, setName] = useState(account?.name || '');
  const [balance, setBalance] = useState<number>(account?.balance || 0);
  const [type, setType] = useState<AccountType>(account?.type || AccountType.BANK);
  const [isDefault, setIsDefault] = useState(account?.isDefault || false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setBalance(account.balance);
      setType(account.type);
      setIsDefault(account.isDefault || false);
    } else {
      setName('');
      setBalance(0);
      setType(AccountType.BANK);
      setIsDefault(false);
    }
  }, [account, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-sm flex flex-col gap-6 shadow-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
            {account ? 'Editar Conta' : 'Nova Conta'}
          </h2>
          <p className="text-xs text-slate-400">Configure os detalhes da conta bancária</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identificação</span>
            <input
              type="text"
              placeholder="Ex: Caixa da Fábrica"
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl px-5 py-4 text-sm font-bold dark:text-white placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo em Conta</span>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">R$</span>
              <input
                type="number"
                placeholder="0,00"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold dark:text-white placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                value={balance}
                onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Conta</span>
            <div className="grid grid-cols-2 gap-2">
                {[AccountType.BANK, AccountType.CASH, AccountType.SAVINGS, AccountType.PERSONAL]
                  .filter(t => t !== AccountType.PERSONAL || modulesConfig?.personal)
                  .map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all border-2 ${type === t ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white dark:bg-slate-800 border-slate-50 dark:border-slate-700 text-slate-400'}`}
                    >
                        {t === AccountType.BANK ? 'Banco' : t === AccountType.CASH ? 'Dinheiro' : t === AccountType.SAVINGS ? 'Reserva' : 'Pessoal'}
                    </button>
                ))}
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setIsDefault(!isDefault)}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isDefault ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 text-slate-500'}`}
          >
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-black uppercase tracking-widest">Conta Padrão</span>
              <span className="text-[9px] opacity-70">Selecionar automaticamente</span>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-all ${isDefault ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isDefault ? 'left-5' : 'left-1'}`} />
            </div>
          </button>
        </div>

        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition-all">Cancelar</button>
          <button 
            onClick={() => {
              onSave({ name, balance, color: 'bg-indigo-500', type, isDefault });
              onClose();
            }}
            className="flex-1 py-4 rounded-2xl bg-indigo-600 font-black uppercase tracking-widest text-[10px] text-white shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
