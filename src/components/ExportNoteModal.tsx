import React, { useState } from 'react';
import { X, FileText, Send, DollarSign, EyeOff, Layers, Pencil, Plus, Check, Trash2, Settings2, Save, ChevronDown, ListStart } from 'lucide-react';


export interface ExportProfile {
  id: string;
  name: string;
  format: 'pdf' | 'jpg';
  financialValues: boolean;
  groupMode: 'none' | 'ref_color' | 'ref';
  pcpTotalGrid: boolean;
  showMaterials: boolean;
  showItemGrid: boolean;
  showSectorNotes: boolean;
  showOrderList: boolean;
}

const DEFAULT_PROFILE: Omit<ExportProfile, 'id' | 'name'> = {
  format: 'pdf',
  financialValues: true,
  groupMode: 'none',
  pcpTotalGrid: true,
  showMaterials: true,
  showItemGrid: true,
  showSectorNotes: true,
  showOrderList: true,
};

const loadProfiles = (): ExportProfile[] => {
  const data = localStorage.getItem('@app:export_profiles');
  return data ? JSON.parse(data) : [];
};

const saveProfiles = (profiles: ExportProfile[]) => {
  localStorage.setItem('@app:export_profiles', JSON.stringify(profiles));
};

const loadLastState = (): Omit<ExportProfile, 'id' | 'name'> => {
  const data = localStorage.getItem('@app:export_last_state');
  return data ? JSON.parse(data) : DEFAULT_PROFILE;
};

interface ExportNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupMode: 'none' | 'ref_color' | 'ref', pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean, showOrderList: boolean) => void;
  isDarkMode: boolean;
  title?: string;
  initialFormat?: 'pdf' | 'jpg';
  /** Quando true, exibe um seletor para incluir ou ocultar valores financeiros no documento exportado */
  showValuesToggle?: boolean;
  /** Quando true, exibe um seletor para agrupar itens com a mesma referência e cor (somando quantidades) */
  showGroupingToggle?: boolean;
  showPCPTotalGridToggle?: boolean;
  showMaterialsToggle?: boolean;
  showItemGridToggle?: boolean;
  showSectorNotesToggle?: boolean;
  showOrderListToggle?: boolean;
  onPreview?: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupMode: 'none' | 'ref_color' | 'ref', pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean, showOrderList: boolean) => Promise<string | boolean>;
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
  showGroupingToggle = false,
  showPCPTotalGridToggle = false,
  showMaterialsToggle = false,
  showItemGridToggle = false,
  showSectorNotesToggle = false,
  showOrderListToggle = false,
  onPreview
}: ExportNoteModalProps) {
  const [note, setNote] = useState('');
  
  // Profile State
  const [profiles, setProfiles] = useState<ExportProfile[]>(() => loadProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');

  // Main config state
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [showFinancialValues, setShowFinancialValues] = useState(true);
  const [groupMode, setGroupMode] = useState<'none' | 'ref_color' | 'ref'>('none');
  const [pcpTotalGrid, setPcpTotalGrid] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);
  const [showItemGrid, setShowItemGrid] = useState(true);
  const [showSectorNotes, setShowSectorNotes] = useState(true);
  const [showOrderList, setShowOrderList] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const state = loadLastState();
      setSelectedFormat(initialFormat || state.format);
      setShowFinancialValues(state.financialValues);
      setGroupMode(state.groupMode);
      setPcpTotalGrid(state.pcpTotalGrid);
      setShowMaterials(state.showMaterials);
      setShowItemGrid(state.showItemGrid);
      setShowSectorNotes(state.showSectorNotes);
      setShowOrderList(state.showOrderList);
      setActiveProfileId(localStorage.getItem('@app:export_active_profile') || null);
    }
  }, [isOpen, initialFormat]);

  React.useEffect(() => {
    if (!isOpen) return;
    const state = {
      format: selectedFormat,
      financialValues: showFinancialValues,
      groupMode: groupMode,
      pcpTotalGrid: pcpTotalGrid,
      showMaterials: showMaterials,
      showItemGrid: showItemGrid,
      showSectorNotes: showSectorNotes,
      showOrderList: showOrderList,
    };
    localStorage.setItem('@app:export_last_state', JSON.stringify(state));

    if (activeProfileId) {
      const p = profiles.find(x => x.id === activeProfileId);
      if (p) {
        const isSame = 
          p.format === selectedFormat &&
          p.financialValues === showFinancialValues &&
          p.groupMode === groupMode &&
          p.pcpTotalGrid === pcpTotalGrid &&
          p.showMaterials === showMaterials &&
          p.showItemGrid === showItemGrid &&
          p.showSectorNotes === showSectorNotes &&
          p.showOrderList === showOrderList;
        
        if (!isSame) {
          setActiveProfileId(null);
          localStorage.removeItem('@app:export_active_profile');
        }
      }
    }
  }, [isOpen, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, activeProfileId, profiles]);

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


  const handlePreview = async () => {
    if (!onPreview) return;
    setIsPreviewLoading(true);
    try {
      const url = await onPreview(note, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList);
      if (typeof url === 'string') {
        setPreviewUrl(url);
      }
    } catch (e) {
      console.error("Preview failed", e);
    } finally {
      setIsPreviewLoading(false);
    }
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
      setGroupMode('none');
      setPcpTotalGrid(true);
      setShowMaterials(true);
      setShowItemGrid(true);
      setShowSectorNotes(true);
      setShowOrderList(true);
      setPreviewUrl(null);
      setIsPreviewLoading(false);
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


          {/* PCP Total Grid Toggle */}
          {showPCPTotalGridToggle && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Resumo da Grade</span>
              </div>
              <button
                type="button"
                onClick={() => setPcpTotalGrid(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    pcpTotalGrid
                      ? 'bg-amber-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {pcpTotalGrid ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir grade total consolidada</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra uma tabela extra somando todos os pedidos do documento
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Materials Toggle */}
          {showMaterialsToggle && (
            <div>
              <button
                type="button"
                onClick={() => setShowMaterials(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] mt-2 ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showMaterials
                      ? 'bg-emerald-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {showMaterials ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir materiais</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra a tabela de requisição consolidada de materiais
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Item Grid Toggle */}
          {showItemGridToggle && (
            <div>
              <button
                type="button"
                onClick={() => setShowItemGrid(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] mt-2 ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showItemGrid
                      ? 'bg-indigo-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {showItemGrid ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir grade do pedido</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra a grade detalhada individual de cada pedido listado
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}


          {/* Order List Toggle */}
          {showOrderListToggle && (
            <div>
              <button
                type="button"
                onClick={() => setShowOrderList(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] mt-2 ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showOrderList
                      ? 'bg-cyan-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {showOrderList ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir lista de pedidos</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra uma relação destacada de todos os pedidos no documento
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Sector Notes Toggle */}
          {showSectorNotesToggle && (
            <div>
              <button
                type="button"
                onClick={() => setShowSectorNotes(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] mt-2 ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showSectorNotes
                      ? 'bg-rose-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {showSectorNotes ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir instruções por setor</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra as observações e instruções cadastradas por setor
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Grouping Toggle */}
          {showGroupingToggle && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Layers size={12} className="text-indigo-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Agrupamento de Itens</span>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setGroupMode('none')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'none' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Não agrupar</span>
                  <span className="text-[10px] text-slate-500 font-medium">Cada item aparece individualmente</span>
                </button>
                <button type="button" onClick={() => setGroupMode('ref_color')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'ref_color' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Agrupar por Modelo e Cor</span>
                  <span className="text-[10px] text-slate-500 font-medium">Soma as grades de mesma referência E cor</span>
                </button>
                <button type="button" onClick={() => setGroupMode('ref')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'ref' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Agrupar apenas por Referência</span>
                  <span className="text-[10px] text-slate-500 font-medium">Soma as cores do mesmo modelo juntas</span>
                </button>
              </div>
            </div>
          )}
        </div>

                {/* Profile Button */}
        <div className={`px-6 pb-4 pt-2`}>
          <button 
            type="button" 
            onClick={() => setShowProfilePopup(true)}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-[0.99] ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                <Settings2 size={16} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Perfis de Exportação</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  {activeProfileId 
                    ? `Ativo: ${profiles.find(p => p.id === activeProfileId)?.name || 'Desconhecido'}` 
                    : 'Últimas opções usadas'}
                </p>
              </div>
            </div>
            <ChevronDown size={18} className="text-slate-400" />
          </button>
        </div>
                {/* Footer Actions */}
        <div className={`p-4 flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
          {/* Preview Section */}
          {previewUrl && (
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">Pré-visualização</span>
                <button type="button" onClick={() => setPreviewUrl(null)} className="text-[10px] font-black uppercase tracking-widest text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all px-3 py-1.5 rounded-full shadow-sm">Fechar Preview</button>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner max-h-[60vh] overflow-y-auto">
                {selectedFormat === 'pdf' ? (
                  <iframe src={previewUrl + "#toolbar=0"} className="w-full h-[500px]" />
                ) : (
                  <img src={previewUrl} className="w-full h-auto" />
                )}
              </div>
            </div>
          )}

          {/* Cards Actions */}
          <div className="flex flex-col gap-2">
            {/* Visualizar */}
            {onPreview && (
              <div className={`p-1.5 rounded-[20px] shadow-sm flex ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  className={`w-full py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-800 shadow-slate-800/20`}
                >
                  {isPreviewLoading ? 'Carregando...' : 'Visualizar Arquivo'}
                </button>
              </div>
            )}

            {/* Cancel / Generate */}
            <div className={`p-1.5 rounded-[20px] shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
              <button
                onClick={onClose}
                className={`flex-1 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${
                  isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-50 text-slate-700'
                }`}
              >
                Cancelar
              </button>
              <button 
                onClick={() => onConfirm(note, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList)}
                className={`flex-[1.5] py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                  selectedFormat === 'pdf' ? 'bg-rose-500' : 'bg-indigo-600'
                }`}
              >
                {selectedFormat === 'pdf' ? <FileText size={16} /> : <Send size={16} className="rotate-45" />}
                Gerar {selectedFormat.toUpperCase()}
              </button>
            </div>

            {/* Format Toggles */}
            <div className={`p-1.5 rounded-[20px] shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
              <button
                onClick={() => setSelectedFormat('pdf')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedFormat === 'pdf' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Formato PDF
              </button>
              <button
                onClick={() => setSelectedFormat('jpg')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedFormat === 'jpg' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Formato JPG
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Profile Popup */}
      {showProfilePopup && (
        <div className="absolute inset-0 z-50 flex flex-col bg-slate-900/40 backdrop-blur-sm p-4">
          <div className={`flex-1 rounded-3xl shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-indigo-500" />
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Perfis Salvos</h3>
              </div>
              <button onClick={() => setShowProfilePopup(false)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <button
                onClick={() => {
                  const state = loadLastState();
                  setSelectedFormat(state.format);
                  setShowFinancialValues(state.financialValues);
                  setGroupMode(state.groupMode);
                  setPcpTotalGrid(state.pcpTotalGrid);
                  setShowMaterials(state.showMaterials);
                  setShowItemGrid(state.showItemGrid);
                  setShowSectorNotes(state.showSectorNotes);
                  setShowOrderList(state.showOrderList);
                  setActiveProfileId(null);
                  localStorage.removeItem('@app:export_active_profile');
                  setShowProfilePopup(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                  activeProfileId === null
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeProfileId === null ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  <ListStart size={14} strokeWidth={2.5} />
                </div>
                <span className={`flex-1 text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Últimas Opções Usadas</span>
              </button>

              {profiles.map((p) => (
                <div key={p.id} className={`w-full flex items-center gap-2 pr-2 rounded-2xl border transition-all text-left ${
                  activeProfileId === p.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                }`}>
                  {editingProfileId === p.id ? (
                    <div className="flex-1 flex items-center gap-2 p-2">
                      <input
                        type="text"
                        value={editingProfileName}
                        onChange={(e) => setEditingProfileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingProfileName.trim()) {
                            e.preventDefault();
                            const newP = profiles.map(x => x.id === p.id ? { ...x, name: editingProfileName.trim() } : x);
                            setProfiles(newP);
                            saveProfiles(newP);
                            setEditingProfileId(null);
                          }
                        }}
                        autoFocus
                        className={`flex-1 min-w-0 rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                          isDarkMode ? 'bg-slate-800 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingProfileName.trim()) {
                            const newP = profiles.map(x => x.id === p.id ? { ...x, name: editingProfileName.trim() } : x);
                            setProfiles(newP);
                            saveProfiles(newP);
                            setEditingProfileId(null);
                          }
                        }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-emerald-500 hover:bg-emerald-500/10"
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedFormat(p.format);
                          setShowFinancialValues(p.financialValues);
                          setGroupMode(p.groupMode);
                          setPcpTotalGrid(p.pcpTotalGrid);
                          setShowMaterials(p.showMaterials);
                          setShowItemGrid(p.showItemGrid);
                          setShowSectorNotes(p.showSectorNotes);
                          setShowOrderList(p.showOrderList);
                          setActiveProfileId(p.id);
                          localStorage.setItem('@app:export_active_profile', p.id);
                          setShowProfilePopup(false);
                        }}
                        className="flex-1 flex items-center gap-3 p-3"
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeProfileId === p.id ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          <Save size={14} strokeWidth={2.5} />
                        </div>
                        <span className={`flex-1 text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{p.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProfileId(p.id);
                          setEditingProfileName(p.name);
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 hover:bg-indigo-500/10 ${isDarkMode ? 'text-slate-400 hover:text-indigo-400' : 'text-slate-500 hover:text-indigo-600'}`}
                      >
                        <Pencil size={14} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newP = profiles.filter(x => x.id !== p.id);
                          setProfiles(newP);
                          saveProfiles(newP);
                          if (activeProfileId === p.id) {
                            setActiveProfileId(null);
                            localStorage.removeItem('@app:export_active_profile');
                          }
                        }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Profile */}
            <div className={`p-4 shrink-0 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newProfileName.trim()) {
                      e.preventDefault();
                      const p: ExportProfile = {
                        id: Date.now().toString(),
                        name: newProfileName.trim(),
                        format: selectedFormat,
                        financialValues: showFinancialValues,
                        groupMode: groupMode,
                        pcpTotalGrid: pcpTotalGrid,
                        showMaterials: showMaterials,
                        showItemGrid: showItemGrid,
                        showSectorNotes: showSectorNotes,
                        showOrderList: showOrderList
                      };
                      const newP = [...profiles, p];
                      setProfiles(newP);
                      saveProfiles(newP);
                      setActiveProfileId(p.id);
                      localStorage.setItem('@app:export_active_profile', p.id);
                      setNewProfileName('');
                    }
                  }}
                  placeholder="Nome para novo perfil..."
                  className={`flex-1 min-w-0 rounded-2xl px-4 py-3 text-[11px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    isDarkMode ? 'bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border border-slate-200 text-slate-700 placeholder:text-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newProfileName.trim()) {
                      const p: ExportProfile = {
                        id: Date.now().toString(),
                        name: newProfileName.trim(),
                        format: selectedFormat,
                        financialValues: showFinancialValues,
                        groupMode: groupMode,
                        pcpTotalGrid: pcpTotalGrid,
                        showMaterials: showMaterials,
                        showItemGrid: showItemGrid,
                        showSectorNotes: showSectorNotes,
                        showOrderList: showOrderList
                      };
                      const newP = [...profiles, p];
                      setProfiles(newP);
                      saveProfiles(newP);
                      setActiveProfileId(p.id);
                      localStorage.setItem('@app:export_active_profile', p.id);
                      setNewProfileName('');
                    }
                  }}
                  disabled={!newProfileName.trim()}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                    newProfileName.trim() ? 'bg-indigo-600 text-white active:scale-95' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
