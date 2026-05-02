import { useState, useEffect } from 'react';
import { Budget, Category, FamilyMember } from '../types';
import { X, DollarSign, Tag, Users, AlertCircle } from 'lucide-react';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budget: Omit<Budget, 'id'>) => void;
  categories: Category[];
  familyMembers: FamilyMember[];
  budget?: Budget;
}

export default function BudgetModal({ isOpen, onClose, onSave, categories, familyMembers, budget }: BudgetModalProps) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState<number | string>(0);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [alertPercentage, setAlertPercentage] = useState<number>(80);

  useEffect(() => {
    if (budget) {
      setCategoryId(budget.categoryId);
      setAmount(budget.amount);
      setMemberIds(budget.memberIds);
      setAlertPercentage(budget.alertPercentage || 80);
    } else {
      setCategoryId(categories[0]?.id || '');
      setAmount(0);
      setMemberIds([]);
      setAlertPercentage(80);
    }
  }, [budget, isOpen, categories]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!categoryId || !amount || amount === 0) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    onSave({ 
      categoryId, 
      amount: Number(amount), 
      memberIds, 
      alertPercentage,
      isPersonal: true 
    });
    onClose();
  };

  const toggleMember = (id: string) => {
    setMemberIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
              {budget ? 'Editar Orçamento' : 'Novo Orçamento'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Planejamento Mensal</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoria do Orçamento</label>
            <div className="relative">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white appearance-none"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor Teto (R$)</label>
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
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Aviso em (%)</label>
              <div className="relative">
                <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="number"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                  placeholder="80"
                  value={alertPercentage}
                  onChange={(e) => setAlertPercentage(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
             <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
               <Users size={14} /> Membros Participantes
             </label>
             <div className="grid grid-cols-2 gap-2">
                {familyMembers.map(m => {
                  const isSelected = memberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMember(m.id)}
                      className={`p-3 rounded-2xl border text-[10px] font-black uppercase tracking-tight transition-all text-left flex items-center gap-2 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-300'}`} />
                      {m.name}
                    </button>
                  );
                })}
             </div>
             {familyMembers.length === 0 && (
               <p className="text-[9px] font-black text-slate-300 uppercase py-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center">Nenhum membro cadastrado</p>
             )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={handleSave}
            className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all"
          >
            Configurar Orçamento
          </button>
        </div>
      </div>
    </div>
  );
}
