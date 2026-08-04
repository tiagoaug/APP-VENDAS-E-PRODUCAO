import { useEffect, useState, type ReactNode } from 'react';
import { Printer, FileText, Image as ImageIcon, User, Boxes, PenLine, CheckSquare, Loader2, Share2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from './Modal';
import { DeliveryPrintPrefs } from '../types';

type ExportChoice = Omit<DeliveryPrintPrefs, 'id'>;

interface DeliveryExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  initialPrefs: DeliveryPrintPrefs;
  onConfirm: (choice: ExportChoice) => Promise<void>;
  onPreview: (choice: ExportChoice) => Promise<string[] | boolean>;
}

// Modal de geração/compartilhamento da Central de Impressão de Entregas, aberto de dentro
// de uma rota — pré-preenchido com as preferências padrão (Configurações de Entrega >
// Central de Impressão), ajustável ali mesmo sem alterar o padrão salvo. Mesma linguagem
// visual/interação da Central de Compartilhamento do PCP (toggles + pré-visualização +
// compartilhar), mas com props/semântica próprias de entrega.
export default function DeliveryExportModal({
  isOpen,
  onClose,
  isDarkMode,
  initialPrefs,
  onConfirm,
  onPreview,
}: DeliveryExportModalProps) {
  const [choice, setChoice] = useState<ExportChoice>(initialPrefs);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[] | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setChoice(initialPrefs);
      setPreviewPages(null);
      setPreviewIdx(0);
    }
  }, [isOpen, initialPrefs]);

  const handlePreview = async () => {
    setIsGenerating(true);
    try {
      const result = await onPreview(choice);
      if (Array.isArray(result)) {
        setPreviewPages(result);
        setPreviewIdx(0);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await onConfirm(choice);
      onClose();
    } finally {
      setIsSharing(false);
    }
  };

  const toggles: { key: 'showOrders' | 'showCustomers' | 'showSignatureField' | 'showCheckbox'; label: string; icon: ReactNode }[] = [
    { key: 'showCustomers', label: 'Clientes', icon: <User size={16} /> },
    { key: 'showOrders', label: 'Pedidos', icon: <FileText size={16} /> },
    { key: 'showCheckbox', label: 'Checkbox', icon: <CheckSquare size={16} /> },
    { key: 'showSignatureField', label: 'Assinatura', icon: <PenLine size={16} /> },
  ];

  // Resumido/Completo são mutuamente exclusivos (boxesMode só guarda um valor) — marcar
  // um desmarca o outro automaticamente.
  const boxesChips: { mode: 'summary' | 'full'; label: string }[] = [
    { mode: 'summary', label: 'Prod. Resumido' },
    { mode: 'full', label: 'Prod. Completo' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Central de Impressão" icon={<Printer size={20} />} maxWidth="max-w-lg">
      <div className="flex flex-col gap-5 p-1">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conteúdo</p>
          <div className="grid grid-cols-4 gap-2">
            {toggles.map(t => {
              const active = choice[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setChoice(prev => ({ ...prev, [t.key]: !prev[t.key] })); setPreviewPages(null); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                      : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  {t.icon}
                  <span className="text-[10px] font-black uppercase tracking-wide">{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {boxesChips.map(opt => {
              const active = choice.boxesMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => { setChoice(prev => ({ ...prev, boxesMode: active ? 'none' : opt.mode })); setPreviewPages(null); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                    active
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                      : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  <Boxes size={16} />
                  <span className="text-[10px] font-black uppercase tracking-wide">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entregas por Folha</p>
          <div className="grid grid-cols-3 gap-2">
            {([0, 3, 5, 8, 10, 15] as const).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { setChoice(prev => ({ ...prev, stopsPerPage: n })); setPreviewPages(null); }}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                  choice.stopsPerPage === n
                    ? 'bg-teal-500 text-white'
                    : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400 border border-slate-200'
                }`}
              >
                {n === 0 ? 'Automático' : n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Outra:</span>
            <input
              type="number"
              min={1}
              placeholder="Ex: 7"
              value={choice.stopsPerPage > 0 && ![3, 5, 8, 10, 15].includes(choice.stopsPerPage) ? choice.stopsPerPage : ''}
              onChange={(e) => {
                const n = Math.max(1, parseInt(e.target.value, 10) || 0);
                if (n > 0) { setChoice(prev => ({ ...prev, stopsPerPage: n })); setPreviewPages(null); }
              }}
              className={`w-16 py-1.5 px-2 rounded-lg text-xs font-black text-center ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
              aria-label="Quantidade personalizada de entregas por folha"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tamanho do Papel</p>
          <div className="grid grid-cols-2 gap-2">
            {([{ id: '100x150', label: '100 x 150mm' }, { id: 'a4', label: 'A4' }] as const).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setChoice(prev => ({ ...prev, pageSize: opt.id })); setPreviewPages(null); }}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                  choice.pageSize === opt.id
                    ? 'bg-teal-500 text-white'
                    : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400 border border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Formato</p>
          <div className="grid grid-cols-2 gap-2">
            {([{ id: 'jpg', label: 'JPG', icon: <ImageIcon size={14} /> }, { id: 'pdf', label: 'PDF', icon: <FileText size={14} /> }] as const).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setChoice(prev => ({ ...prev, format: opt.id })); setPreviewPages(null); }}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                  choice.format === opt.id
                    ? 'bg-teal-500 text-white'
                    : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400 border border-slate-200'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {previewPages && previewPages.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className={`relative rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              {choice.format === 'pdf' ? (
                <iframe src={previewPages[previewIdx]} title="Pré-visualização" className="w-full h-[420px] bg-white" />
              ) : (
                <img src={previewPages[previewIdx]} alt="Pré-visualização" className="w-full max-h-[420px] object-contain bg-white" />
              )}
            </div>
            {previewPages.length > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button type="button" disabled={previewIdx === 0} onClick={() => setPreviewIdx(i => i - 1)} className="p-1.5 rounded-full disabled:opacity-30 bg-slate-100 dark:bg-slate-800">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[10px] font-black text-slate-400">{previewIdx + 1} / {previewPages.length}</span>
                <button type="button" disabled={previewIdx === previewPages.length - 1} onClick={() => setPreviewIdx(i => i + 1)} className="p-1.5 rounded-full disabled:opacity-30 bg-slate-100 dark:bg-slate-800">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isGenerating}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-[0.98] border-2 ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'} disabled:opacity-60`}
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            Pré-visualizar
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            Compartilhar
          </button>
        </div>
      </div>
    </Modal>
  );
}
