import { Wand2, Plus, ArrowRight } from 'lucide-react';

interface ProductCreationChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseGuided: () => void;
  onChooseDirect: () => void;
  isDarkMode: boolean;
}

export default function ProductCreationChoiceModal({ isOpen, onClose, onChooseGuided, onChooseDirect, isDarkMode }: ProductCreationChoiceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4" style={{ zIndex: 90000 }}>
      <div className={`rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <div>
          <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Novo Modelo</h2>
          <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Como você quer cadastrar?</p>
        </div>

        <button
          type="button"
          onClick={onChooseGuided}
          className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
            isDarkMode ? 'bg-indigo-950/30 border-indigo-900/50 hover:border-indigo-600' : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-400'
          }`}
        >
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Wand2 size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cadastro Guiado</p>
            <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Passo a passo, garantindo fornecedor/categoria/cores</p>
          </div>
          <ArrowRight size={16} className={isDarkMode ? 'text-slate-600' : 'text-slate-300'} />
        </button>

        <button
          type="button"
          onClick={onChooseDirect}
          className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
            isDarkMode ? 'bg-slate-800/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:border-slate-300'
          }`}
        >
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
            <Plus size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Só Adicionar o Modelo</p>
            <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Já tenho todos os cadastros prontos</p>
          </div>
          <ArrowRight size={16} className={isDarkMode ? 'text-slate-600' : 'text-slate-300'} />
        </button>

        <button
          onClick={onClose}
          className={`py-3 rounded-xl font-bold text-sm ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
