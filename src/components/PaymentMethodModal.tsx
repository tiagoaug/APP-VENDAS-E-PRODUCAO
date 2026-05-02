import { useState, useEffect } from 'react';
import { PaymentMethod } from '../types';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (method: Omit<PaymentMethod, 'id'>) => void;
  method?: PaymentMethod;
}

export default function PaymentMethodModal({ isOpen, onClose, onSave, method }: PaymentMethodModalProps) {
  const [name, setName] = useState(method?.name || '');
  const [value, setValue] = useState(method?.value || '');

  useEffect(() => {
    if (method) {
      setName(method.name);
      setValue(method.value || '');
    }
  }, [method]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-xl font-black text-slate-800 dark:text-white">
          {method ? 'Editar Método' : 'Novo Método de Pagamento'}
        </h2>
        <input
          type="text"
          placeholder="Nome (Ex: Pix)"
          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Chave (Ex: CPF, E-mail)"
          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
          <button 
            onClick={() => {
              onSave({ name, icon: 'CreditCard', value });
              setName('');
              setValue('');
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
