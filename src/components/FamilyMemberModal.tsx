import { useState, useEffect } from 'react';
import { FamilyMember } from '../types';
import { X, User } from 'lucide-react';

interface FamilyMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Omit<FamilyMember, 'id'>) => void;
  member?: FamilyMember;
}

export default function FamilyMemberModal({ isOpen, onClose, onSave, member }: FamilyMemberModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (member) {
      setName(member.name);
    } else {
      setName('');
    }
  }, [member, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name) {
      alert('Nome é obrigatório');
      return;
    }
    onSave({ name, isPersonal: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
              {member ? 'Editar Membro' : 'Novo Membro'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Família</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome do Membro</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="text"
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                placeholder="Ex: João, Maria..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleSave}
            className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all"
          >
            Salvar Membro
          </button>
        </div>
      </div>
    </div>
  );
}
