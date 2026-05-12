import React, { useState } from 'react';
import { X, FileText, Send, Check } from 'lucide-react';

interface ExportNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string, format: 'pdf' | 'jpg') => void;
  isDarkMode: boolean;
  title?: string;
  initialFormat?: 'pdf' | 'jpg';
}

const PREDEFINED_NOTES = [
  "O DESCONTO É PELO PEDIDO À VISTA",
  "PEDIDO PARA RETIRADA NO LOCAL",
  "FRETE POR CONTA DO CLIENTE (FOB)",
  "PAGAMENTO À VISTA NA ENTREGA",
  "VALOR SUJEITO A ALTERAÇÃO SEM PRÉVIO AVISO"
];

export default function ExportNoteModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isDarkMode, 
  title = "Exportar Documento",
  initialFormat = 'pdf'
}: ExportNoteModalProps) {
  const [note, setNote] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'jpg'>(initialFormat);

  // Update selectedFormat if initialFormat changes when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFormat(initialFormat);
    }
  }, [isOpen, initialFormat]);

  if (!isOpen) return null;

  const handlePredefinedClick = (text: string) => {
    if (note.includes(text)) {
      setNote(prev => prev.replace(text, '').replace(/\n\n$/, '').trim());
    } else {
      setNote(prev => prev ? `${prev}\n\n${text}` : text);
    }
  };

  return (
    <div className="fixed inset-0 z-[300000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className={`w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              {selectedFormat === 'pdf' ? <FileText size={24} strokeWidth={2.5} /> : <Send size={24} strokeWidth={2.5} className="rotate-45" />}
            </div>
            <div>
              <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                Gerando arquivo em formato {selectedFormat.toUpperCase()}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <FileText size={14} className="text-indigo-500" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Observação Interna / Rodapé</span>
            </div>
            <textarea 
              className={`w-full h-32 rounded-3xl p-5 text-[12px] font-medium leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none ${
                isDarkMode 
                  ? 'bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-600' 
                  : 'bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-300'
              }`}
              placeholder="Digite aqui alguma observação importante para constar no documento..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Predefined Chips */}
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_NOTES.map((text, idx) => {
              const isSelected = note.includes(text);
              return (
                <button
                  key={idx}
                  onClick={() => handlePredefinedClick(text)}
                  className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {text}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`p-6 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className={`flex-1 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all ${
                isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-400 border border-slate-100'
              }`}
            >
              Cancelar
            </button>
            <button 
              onClick={() => onConfirm(note, selectedFormat)}
              className={`flex-[1.5] py-4 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
                selectedFormat === 'pdf' ? 'bg-rose-500 shadow-rose-500/20' : 'bg-indigo-600 shadow-indigo-600/20'
              }`}
            >
              {selectedFormat === 'pdf' ? <FileText size={18} /> : <Send size={18} className="rotate-45" />}
              Gerar {selectedFormat.toUpperCase()}
            </button>
          </div>

          <div className="flex justify-center gap-4 mt-2">
            <button 
              onClick={() => setSelectedFormat('pdf')}
              className={`text-[9px] font-black uppercase tracking-widest transition-all ${selectedFormat === 'pdf' ? 'text-rose-500 underline underline-offset-4' : 'text-slate-400'}`}
            >
              Alternar para PDF
            </button>
            <button 
              onClick={() => setSelectedFormat('jpg')}
              className={`text-[9px] font-black uppercase tracking-widest transition-all ${selectedFormat === 'jpg' ? 'text-indigo-500 underline underline-offset-4' : 'text-slate-400'}`}
            >
              Alternar para JPG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
