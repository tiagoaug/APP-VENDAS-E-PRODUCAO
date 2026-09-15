import { useState } from 'react';
import { Share } from '@capacitor/share';
import { PaymentMethod } from '../types';
import { Plus, Trash2, Edit, Copy, Eye, Share2, Info } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import PaymentCardModal from '../components/PaymentCardModal';
import PixIcon from '../components/icons/PixIcon';
import { toast } from '../utils/toast';
import GuidePulseDot from '../components/GuidePulseDot';

interface PaymentMethodsViewProps {
  methods: PaymentMethod[];
  // Aceita um nome opcional pra pré-preencher o modal (ver atalho "Chave Pix" abaixo) — sem
  // argumento, abre em branco como sempre.
  onAdd: (initialName?: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  // Cria direto, sem passar pelo modal — só faz sentido pra métodos sem "chave" nenhuma
  // (Dinheiro, Cartão); Pix sempre precisa da chave de verdade, então abre o modal (onAdd).
  onQuickAdd: (name: string) => void;
  isDarkMode: boolean;
  // Bolinha pulsante nos atalhos "Dinheiro"/"Cartão", ver Etapa 11 do Assistente de Configuração.
  guideActive?: boolean;
}

export default function PaymentMethodsView({ methods, onAdd, onEdit, onDelete, onQuickAdd, isDarkMode, guideActive }: PaymentMethodsViewProps) {
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
        {/* Explicação — essa tela confunde quem chega sem contexto (nome genérico "método de
            pagamento" não deixa óbvio que é aqui que se cadastra a PRÓPRIA chave Pix/dados
            bancários pra receber, não uma forma de pagar terceiros). */}
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${isDarkMode ? 'bg-indigo-950/30 border-indigo-900/40' : 'bg-indigo-50 border-indigo-100'}`}>
          <Info size={16} className="text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 leading-relaxed">
            Cadastre aqui sua chave Pix ou dados bancários pra receber de clientes — depois é só compartilhar o método certo na hora de cobrar ou fechar uma venda.
          </p>
        </div>
        {methods.length === 0 && (
          <div data-guide-anchor="paymethod.atalhos" className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Atalhos — sem digitar nada {guideActive && <GuidePulseDot show />}</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onQuickAdd('Dinheiro')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
              >
                + Dinheiro
              </button>
              <button
                type="button"
                onClick={() => onQuickAdd('Cartão')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                + Cartão
              </button>
              <button
                type="button"
                onClick={() => onAdd('Chave Pix')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-teal-900/20 text-teal-400 hover:bg-teal-900/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'}`}
              >
                + Chave Pix
              </button>
            </div>
          </div>
        )}
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
          onClick={() => onAdd()}
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
