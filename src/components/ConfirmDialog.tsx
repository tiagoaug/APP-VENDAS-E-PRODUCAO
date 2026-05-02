import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isDanger = true
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
        >
          <div className="p-8 flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-6 ${isDanger ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400' : 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400'}`}>
              <AlertTriangle size={32} strokeWidth={2.5} />
            </div>
            
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">
              {title}
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              {message}
            </p>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-2">
            <button
              onClick={onConfirm}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] ${
                isDanger 
                  ? 'bg-rose-500 text-white shadow-rose-100 dark:shadow-none hover:bg-rose-600' 
                  : 'bg-indigo-600 text-white shadow-indigo-100 dark:shadow-none hover:bg-indigo-700'
              }`}
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
            >
              {cancelLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
