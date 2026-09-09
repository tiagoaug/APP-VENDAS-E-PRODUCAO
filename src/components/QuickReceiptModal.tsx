import { useState } from 'react';
import { X, DollarSign, Wallet } from 'lucide-react';
import { toast } from '../utils/toast';

interface QuickReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
  isDarkMode: boolean;
}

// Versão enxuta de "Receber da Empresa" (ver TransferToPersonalModal.tsx) pra quem só tem o
// Módulo Pessoal ativo, sem nenhuma conta comercial — não faz sentido pedir "conta de origem"
// se não existe empresa nenhuma. Aqui é só o valor: usado como "Recebimentos", um jeito rápido
// de lançar dinheiro que entrou de fora (presente, reembolso, etc.), diferente de "Entradas"
// (que continua existindo pra receita categorizada, tipo salário).
export default function QuickReceiptModal({ isOpen, onClose, onConfirm, isDarkMode }: QuickReceiptModalProps) {
  const [amount, setAmount] = useState<number | string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.show('Informe um valor válido');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(numAmount);
      setAmount('');
      onClose();
    } catch (error: any) {
      toast.show('Erro: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Recebimentos</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Valor recebido de fora</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor Recebido (R$)</label>
          <div className="relative mt-2">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              type="number"
              autoFocus
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </span>
            ) : (
              <>
                <Wallet size={20} />
                Confirmar Recebimento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
