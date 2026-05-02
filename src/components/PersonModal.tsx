import { useState, useEffect } from 'react';
import { Person } from '../types';
import { X } from 'lucide-react';

interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: Omit<Person, 'id'>) => void;
  person?: Person;
}

export default function PersonModal({ isOpen, onClose, onSave, person }: PersonModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [isCustomer, setIsCustomer] = useState(false);
  const [isSupplier, setIsSupplier] = useState(false);

  useEffect(() => {
    if (person) {
      setName(person.name || '');
      setPhone(person.phone || '');
      setEmail(person.email || '');
      setDocument(person.document || '');
      setIsCustomer(person.isCustomer || false);
      setIsSupplier(person.isSupplier || false);
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setDocument('');
      setIsCustomer(false);
      setIsSupplier(false);
    }
  }, [person, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name || !phone) {
      alert('Nome e Telefone são obrigatórios');
      return;
    }
    onSave({ name, phone, email, document, isCustomer, isSupplier });
    
    // Se for um novo cadastro, limpa para o próximo
    if (!person) {
      setName('');
      setPhone('');
      setEmail('');
      setDocument('');
      setIsCustomer(false);
      setIsSupplier(false);
      alert('Cadastro realizado com sucesso!');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-sm shadow-2xl border border-white/20">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
            {person ? 'Editar Cadastro' : 'Novo Registro'}
          </h3>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome Completo</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone / WhatsApp</label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail (Opcional)</label>
            <input
              type="email"
              placeholder="exemplo@email.com"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">CPF ou CNPJ</label>
            <input
              type="text"
              placeholder="000.000.000-00"
              className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 text-sm font-bold transition-all outline-none dark:text-white"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
            />
          </div>

          <div className="flex gap-4 pt-2">
            <label className="flex-1 flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600"
                checked={isCustomer} 
                onChange={(e) => setIsCustomer(e.target.checked)} 
              />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Cliente</span>
            </label>
            <label className="flex-1 flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-2 border-transparent has-[:checked]:border-indigo-500">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:border-slate-600"
                checked={isSupplier} 
                onChange={(e) => setIsSupplier(e.target.checked)} 
              />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Fornecedor</span>
            </label>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[11px] tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
