import { useState } from 'react';
import { PaymentMethod } from '../types';
import { Plus, CreditCard, Trash2, Edit, DollarSign, Zap, Copy } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

interface PaymentMethodsViewProps {
  methods: PaymentMethod[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
}

export default function PaymentMethodsView({ methods, onAdd, onEdit, onDelete, isDarkMode }: PaymentMethodsViewProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'DollarSign': return <DollarSign size={20} />;
      case 'CreditCard': return <CreditCard size={20} />;
      case 'Zap': return <Zap size={20} />;
      default: return <CreditCard size={20} />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado!');
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
    <div className="flex flex-col gap-6">
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Excluir Método?"
        message="Deseja realmente excluir este método de pagamento? Esta ação não afetará transações já realizadas."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsConfirmOpen(false);
          setIdToDelete(null);
        }}
        isDanger={true}
      />
      <div className="flex flex-col gap-4">
        {methods.map((method) => (
          <div key={method.id} className={`p-5 rounded-[2rem] border shadow-sm flex items-center justify-between group ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-4">
              <div className="text-blue-600 dark:text-blue-400">
                {getIcon(method.icon)}
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white tracking-tight">{method.name}</h3>
                {method.value && (
                    <button 
                        onClick={() => copyToClipboard(method.value!)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 hover:text-indigo-600"
                    >
                        {method.value} <Copy size={10} />
                    </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(method.id)} className="p-2 text-slate-200 hover:text-indigo-600">
                <Edit size={16} />
              </button>
              <button 
                onClick={() => handleDeleteClick(method.id)}
                className="p-2 text-slate-200 hover:text-rose-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        <button 
          onClick={onAdd}
          className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] py-8 flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-100 dark:hover:border-blue-900/30 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer"
        >
          <Plus size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Método</span>
        </button>
      </div>
    </div>
  );
}
