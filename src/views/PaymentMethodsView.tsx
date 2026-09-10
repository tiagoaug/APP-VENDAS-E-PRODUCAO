import { useState } from 'react';
import { Share } from '@capacitor/share';
import { PaymentMethod } from '../types';
import { Plus, Trash2, Edit, Copy, Eye, Share2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import PaymentCardModal from '../components/PaymentCardModal';
import PixIcon from '../components/icons/PixIcon';
import { toast } from '../utils/toast';

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
  const [viewingMethod, setViewingMethod] = useState<PaymentMethod | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.show('Copiado!');
  };

  const handleShare = async (method: PaymentMethod) => {
    if (!method.value) return;
    try {
      await Share.share({ title: method.name, text: `${method.name}\nChave Pix: ${method.value}` });
    } catch {
      // usuário cancelou o share nativo — nada a fazer
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
          <div key={method.id} className={`p-5 rounded-[2rem] border shadow-sm flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <PixIcon size={22} />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white tracking-tight truncate">{method.name}</h3>
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
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onEdit(method.id)} className="p-2 text-slate-300 hover:text-indigo-600">
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteClick(method.id)}
                  className="p-2 text-slate-300 hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewingMethod(method)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <Eye size={13} /> Visualizar
              </button>
              <button
                type="button"
                onClick={() => handleShare(method)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-400 dark:hover:bg-teal-950/70"
              >
                <Share2 size={13} /> Compartilhar
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={onAdd}
          data-guide-anchor="paymethod.novo"
          className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] py-8 flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-100 dark:hover:border-blue-900/30 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer"
        >
          <Plus size={24} />
          <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Método</span>
        </button>
      </div>

      {viewingMethod && (
        <PaymentCardModal
          isOpen={true}
          onClose={() => setViewingMethod(null)}
          methods={[viewingMethod]}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
