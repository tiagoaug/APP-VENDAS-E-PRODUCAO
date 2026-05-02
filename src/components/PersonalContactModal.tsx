import { useState } from 'react';
import { User, X, Check } from 'lucide-react';
import { Person } from '../types';

interface PersonalContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contact: Omit<Person, 'id'>) => Promise<void>;
  contact?: Person;
  isDarkMode: boolean;
}

export default function PersonalContactModal({ isOpen, onClose, onSave, contact, isDarkMode }: PersonalContactModalProps) {
  const [name, setName] = useState(contact?.name || '');
  const [phone, setPhone] = useState(contact?.phone || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className={`w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {contact ? 'Editar Contato' : 'Novo Contato'}
          </h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-[9px] uppercase font-black text-slate-400 px-3 mb-2 block tracking-widest leading-none">Nome</label>
            <input 
              type="text"
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-200"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato..."
            />
          </div>
          <div>
            <label className="text-[9px] uppercase font-black text-slate-400 px-3 mb-2 block tracking-widest leading-none">Telefone</label>
            <input 
              type="text"
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-200"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          
          <button 
            onClick={async () => {
                await onSave({ name, phone, isPersonal: true, isCustomer: false, isSupplier: false });
                onClose();
            }}
            className="mt-4 w-full py-4 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Check size={16} /> Salvar Contato
          </button>
        </div>
      </div>
    </div>
  );
}
