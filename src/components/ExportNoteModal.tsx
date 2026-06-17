import React, { useState } from 'react';
import { X, FileText, Send, DollarSign, EyeOff, Layers, Pencil, Plus, Check, Trash2, Settings2 } from 'lucide-react';

interface ExportNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean) => void;
  isDarkMode: boolean;
  title?: string;
  initialFormat?: 'pdf' | 'jpg';
  /** Quando true, exibe um seletor para incluir ou ocultar valores financeiros no documento exportado */
  showValuesToggle?: boolean;
  /** Quando true, exibe um seletor para agrupar itens com a mesma referência e cor (somando quantidades) */
  showGroupingToggle?: boolean;
}

const DEFAULT_PREDEFINED_NOTES = [
  "O DESCONTO É PELO PEDIDO À VISTA"
];

const PREDEFINED_NOTES_STORAGE_KEY = 'export_predefined_notes_v1';

function loadPredefinedNotes(): string[] {
  try {
    const raw = localStorage.getItem(PREDEFINED_NOTES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(t => typeof t === 'string');
    }
  } catch { /* ignore */ }
  return DEFAULT_PREDEFINED_NOTES;
}

export default function ExportNoteModal({
  isOpen,
  onClose,
  onConfirm,
  isDarkMode,
  title = "Exportar Documento",
  initialFormat = 'pdf',
  showValuesToggle = false,
  showGroupingToggle = false
}: ExportNoteModalProps) {
  const [note, setNote] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'jpg'>(initialFormat);
  const [showFinancialValues, setShowFinancialValues] = useState(true);
  const [groupItems, setGroupItems] = useState(false);

  // Textos rápidos configuráveis (adicionar/editar/excluir) — persistidos em localStorage.
  const [predefinedNotes, setPredefinedNotes] = useState<string[]>(() => loadPredefinedNotes());
  const [manageChips, setManageChips] = useState(false);
  const [chipDraft, setChipDraft] = useState('');
  const [editingChipIdx, setEditingChipIdx] = useState<number | null>(null);

  const persistNotes = (next: string[]) => {
    setPredefinedNotes(next);
    try { localStorage.setItem(PREDEFINED_NOTES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const saveChipDraft = () => {
    const text = chipDraft.trim().toUpperCase();
    if (!text) return;
    if (editingChipIdx !== null) {
      const old = predefinedNotes[editingChipIdx];
      const next = predefinedNotes.map((t, i) => (i === editingChipIdx ? text : t));
      persistNotes(next);
      // Mantém a observação em sincronia se o texto editado já estava aplicado.
      if (old && note.includes(old)) setNote(prev => prev.replace(old, text));
    } else if (!predefinedNotes.includes(text)) {
      persistNotes([...predefinedNotes, text]);
    }
    setChipDraft('');
    setEditingChipIdx(null);
  };

  const removeChip = (idx: number) => {
    const removed = predefinedNotes[idx];
    persistNotes(predefinedNotes.filter((_, i) => i !== idx));
    if (removed && note.includes(removed)) {
      setNote(prev => prev.replace(removed, '').replace(/\n\n+/g, '\n\n').trim());
    }
    if (editingChipIdx === idx) { setEditingChipIdx(null); setChipDraft(''); }
  };

  // Update selectedFormat if initialFormat changes when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFormat(initialFormat);
      setShowFinancialValues(true);
      setGroupItems(false);
      setPredefinedNotes(loadPredefinedNotes());
      setManageChips(false);
      setChipDraft('');
      setEditingChipIdx(null);
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
        className={`w-full max-w-md max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              {selectedFormat === 'pdf' ? <FileText size={24} strokeWidth={2.5} /> : <Send size={24} strokeWidth={2.5} className="rotate-45" />}
            </div>
            <div>
              <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-widest mt-1">
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
        <div className="px-6 pb-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <FileText size={14} className="text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Observação Interna / Rodapé</span>
            </div>
            <textarea
              className={`w-full h-32 rounded-3xl p-5 text-[13px] font-medium leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none ${
                isDarkMode
                  ? 'bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500'
                  : 'bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-400'
              }`}
              placeholder="Digite aqui alguma observação importante para constar no documento..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Predefined Chips — seleção; o gerenciamento (adicionar/editar/excluir) abre em popup */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Textos Rápidos</span>
              <button
                type="button"
                onClick={() => { setManageChips(true); setChipDraft(''); setEditingChipIdx(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                  isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Settings2 size={12} strokeWidth={2.5} /> Configurar
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {predefinedNotes.map((text, idx) => {
                const isSelected = note.includes(text);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePredefinedClick(text)}
                    title={text}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border text-left ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? 'bg-white border-white text-indigo-600'
                        : isDarkMode ? 'border-slate-600 text-transparent' : 'border-slate-300 text-transparent'
                    }`}>
                      <Check size={13} strokeWidth={3.5} />
                    </span>
                    <span className="flex-1 min-w-0 truncate">{text}</span>
                  </button>
                );
              })}
              {predefinedNotes.length === 0 && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-1">Nenhum texto rápido. Toque em "Configurar" para adicionar.</p>
              )}
            </div>
          </div>

          {/* Financial Values Toggle */}
          {showValuesToggle && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <DollarSign size={12} className="text-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Valores Financeiros</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFinancialValues(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showFinancialValues
                      ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                      : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')
                  }`}>
                    {showFinancialValues ? <DollarSign size={15} strokeWidth={2.5} /> : <EyeOff size={15} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {showFinancialValues ? 'Mostrar valores' : 'Ocultar valores'}
                    </p>
                    <p className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {showFinancialValues ? 'Preços e total aparecerão no documento' : 'Documento será gerado sem preços/total'}
                    </p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full p-1 flex items-center transition-all shrink-0 ${
                  showFinancialValues ? 'bg-emerald-500 justify-end' : (isDarkMode ? 'bg-slate-700 justify-start' : 'bg-slate-300 justify-start')
                }`}>
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
              </button>
            </div>
          )}

          {/* Grouping Toggle — agrupa itens de mesma referência e cor, somando quantidades */}
          {showGroupingToggle && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Layers size={12} className="text-indigo-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Agrupamento de Itens</span>
              </div>
              <button
                type="button"
                onClick={() => setGroupItems(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    groupItems
                      ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600')
                      : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')
                  }`}>
                    <Layers size={15} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {groupItems ? 'Agrupar iguais' : 'Não agrupar'}
                    </p>
                    <p className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {groupItems ? 'Mesma referência e cor somadas em uma linha' : 'Cada item aparece em sua própria linha'}
                    </p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full p-1 flex items-center transition-all shrink-0 ${
                  groupItems ? 'bg-indigo-500 justify-end' : (isDarkMode ? 'bg-slate-700 justify-start' : 'bg-slate-300 justify-start')
                }`}>
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`p-6 flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest transition-all ${
                isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-700 border border-slate-100'
              }`}
            >
              Cancelar
            </button>
            <button 
              onClick={() => onConfirm(note, selectedFormat, showFinancialValues, groupItems)}
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
              className={`text-[10px] font-black uppercase tracking-widest transition-all ${selectedFormat === 'pdf' ? 'text-rose-500 underline underline-offset-4' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Alternar para PDF
            </button>
            <button
              onClick={() => setSelectedFormat('jpg')}
              className={`text-[10px] font-black uppercase tracking-widest transition-all ${selectedFormat === 'jpg' ? 'text-indigo-500 underline underline-offset-4' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Alternar para JPG
            </button>
          </div>
        </div>
      </div>

      {/* Popup de gerenciamento dos Textos Rápidos — altura fixa (lista rola internamente,
          o popup não cresce ao acrescentar textos) */}
      {manageChips && (
        <div
          className="absolute inset-0 z-[10] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setManageChips(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md max-h-[80vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            {/* Header */}
            <div className="p-5 flex items-center justify-between shrink-0 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Settings2 size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className={`text-sm font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Textos Rápidos</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Adicionar, editar ou excluir</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManageChips(false)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                aria-label="Fechar"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Campo adicionar / editar (fixo) */}
            <div className="p-4 shrink-0 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chipDraft}
                  onChange={(e) => setChipDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveChipDraft(); } }}
                  placeholder={editingChipIdx !== null ? 'Editar texto...' : 'Novo texto rápido...'}
                  className={`flex-1 min-w-0 rounded-2xl px-4 py-3 text-[11px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    isDarkMode ? 'bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-400'
                  }`}
                />
                {editingChipIdx !== null && (
                  <button
                    type="button"
                    onClick={() => { setEditingChipIdx(null); setChipDraft(''); }}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                    title="Cancelar edição"
                    aria-label="Cancelar edição"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveChipDraft}
                  disabled={!chipDraft.trim()}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                    chipDraft.trim() ? 'bg-indigo-600 text-white active:scale-95' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                  title={editingChipIdx !== null ? 'Salvar' : 'Adicionar'}
                  aria-label={editingChipIdx !== null ? 'Salvar texto' : 'Adicionar texto'}
                >
                  {editingChipIdx !== null ? <Check size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
                </button>
              </div>
            </div>

            {/* Lista rolável (não faz o popup crescer) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {predefinedNotes.length === 0 && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center py-6">Nenhum texto rápido cadastrado.</p>
              )}
              {predefinedNotes.map((text, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 pl-4 pr-2 py-2.5 rounded-2xl border ${
                    editingChipIdx === idx
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <span className={`flex-1 min-w-0 truncate text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{text}</span>
                  <button
                    type="button"
                    onClick={() => { setEditingChipIdx(idx); setChipDraft(text); }}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-200'}`}
                    title="Editar"
                    aria-label="Editar texto"
                  >
                    <Pencil size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeChip(idx)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-rose-500 hover:bg-rose-500/10"
                    title="Excluir"
                    aria-label="Excluir texto"
                  >
                    <Trash2 size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
