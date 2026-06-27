import React, { useState } from 'react';
import { X, FileText, Send, DollarSign, EyeOff, Layers, Pencil, Plus, Check, Trash2, Settings2, Save, ChevronDown, ChevronLeft, ChevronRight, ListStart, Hash, Boxes } from 'lucide-react';


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
  showSoleGrid: boolean;
  selectedSectorIds?: string[];
}

const DEFAULT_PROFILE: Omit<ExportProfile, 'id' | 'name'> = {
  format: 'jpg',
  financialValues: true,
  groupMode: 'none',
  pcpTotalGrid: true,
  showMaterials: true,
  showItemGrid: true,
  showSectorNotes: true,
  showOrderList: true,
  showSoleGrid: false,
  selectedSectorIds: [],
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
  onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupMode: 'none' | 'ref_color' | 'ref', pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean, showOrderList: boolean, splitPages: boolean, showProvider: boolean, showOSData: boolean, showSoleGrid: boolean, selectedSectorIds?: string[], pageSize?: 'a4' | 'marketplace') => void;
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
  itemGridLabel?: string;
  itemGridDescription?: string;
  showSectorNotesToggle?: boolean;
  showOrderListToggle?: boolean;
  /** Quando true, exibe um seletor para dividir a imagem JPG longa em várias páginas (estilo A4) */
  showSplitPagesToggle?: boolean;
  /** Quando true, exibe um seletor para incluir o nome do prestador de serviço da OS de origem */
  showProviderToggle?: boolean;
  /** Quando true, exibe um seletor para incluir valor/data/setor da OS de origem */
  showOSDataToggle?: boolean;
  /** Quando true, exibe a entrada "Detalhes de Setor" com a opção de separação de solas por ficha (Montagem) */
  showSoleGridToggle?: boolean;
  /** Retorna um array com uma data URI por página real de saída (já considerando
   * "Dividir em Páginas"), pra pré-visualização poder navegar página a página
   * exatamente como o arquivo final vai ficar — em vez de mostrar tudo cortado
   * numa imagem só. */
  onPreview?: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupMode: 'none' | 'ref_color' | 'ref', pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean, showOrderList: boolean, splitPages: boolean, showProvider: boolean, showOSData: boolean, showSoleGrid: boolean, selectedSectorIds?: string[], pageSize?: 'a4' | 'marketplace') => Promise<string[] | boolean>;
  /** Quando true, exibe a opção "Abrir no Print Studio" ao lado de "Visualizar Arquivo" —
   * só faz sentido pra quem gera fichas PCP (módulo nativo Android). */
  showOpenInPrintStudioToggle?: boolean;
  onOpenInPrintStudio?: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupMode: 'none' | 'ref_color' | 'ref', pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean, showOrderList: boolean, splitPages: boolean, showProvider: boolean, showOSData: boolean, showSoleGrid: boolean, selectedSectorIds?: string[], pageSize?: 'a4' | 'marketplace') => Promise<void>;
  sectors?: { id: string; name: string; color?: string }[];
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
  initialFormat = 'jpg',
  showValuesToggle = false,
  showGroupingToggle = false,
  showPCPTotalGridToggle = false,
  showMaterialsToggle = false,
  showItemGridToggle = false,
  itemGridLabel = "Exibir grade do pedido",
  itemGridDescription = "Mostra a grade detalhada individual de cada pedido listado",
  showSectorNotesToggle = false,
  showOrderListToggle = false,
  showSplitPagesToggle = false,
  showProviderToggle = false,
  showOSDataToggle = false,
  showSoleGridToggle = false,
  onPreview,
  showOpenInPrintStudioToggle = false,
  onOpenInPrintStudio,
  sectors = []
}: ExportNoteModalProps) {
  const [note, setNote] = useState('');
  const [isObservationOpen, setIsObservationOpen] = useState(false);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [activePopup, setActivePopup] = useState<'financial' | 'grid' | 'group' | 'os' | 'sector' | 'profiles' | null>(null);
  
  // Profile State
  const [profiles, setProfiles] = useState<ExportProfile[]>(() => loadProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');

  // Main config state
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'jpg'>('jpg');
  const [pageSize, setPageSize] = useState<'a4' | 'marketplace'>('a4');
  const [showFinancialValues, setShowFinancialValues] = useState(true);
  const [groupMode, setGroupMode] = useState<'none' | 'ref_color' | 'ref'>('none');
  const [pcpTotalGrid, setPcpTotalGrid] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);
  const [showItemGrid, setShowItemGrid] = useState(true);
  const [showSectorNotes, setShowSectorNotes] = useState(true);
  const [showOrderList, setShowOrderList] = useState(true);
  const [splitPages, setSplitPages] = useState(false);
  const [showProvider, setShowProvider] = useState(true);
  const [showOSData, setShowOSData] = useState(true);
  const [showSoleGrid, setShowSoleGrid] = useState(false);
  // Subcards em acordeão — um por grupo de configurações (Valores, Resumo da
  // Grade, Agrupamento, Dados da OS, Detalhes de Setor). Recolhidos por padrão.
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['share_actions']));
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewPageIdx, setPreviewPageIdx] = useState(0);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isOpeningPrintStudio, setIsOpeningPrintStudio] = useState(false);

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
      setShowSoleGrid(state.showSoleGrid);
      setActiveProfileId(localStorage.getItem('@app:export_active_profile') || null);
      
      const savedSectors = state.selectedSectorIds || [];
      if (savedSectors.length > 0) {
        setSelectedSectorIds(savedSectors);
      } else {
        setSelectedSectorIds(sectors.map(s => s.id));
      }
      
      // UI resets
      setIsObservationOpen(false);
      setActivePopup(null);
      setSplitPages(false);
      setShowProvider(true);
      setShowOSData(true);
      setOpenSections(new Set(['share_actions']));
      setPreviewPages([]);
      setPreviewPageIdx(0);
      setIsPreviewLoading(false);
      setPredefinedNotes(loadPredefinedNotes());
      setManageChips(false);
      setChipDraft('');
      setEditingChipIdx(null);
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
      showSoleGrid: showSoleGrid,
      selectedSectorIds: selectedSectorIds,
    };
    localStorage.setItem('@app:export_last_state', JSON.stringify(state));

    if (activeProfileId) {
      const p = profiles.find(x => x.id === activeProfileId);
      if (p) {
        const isSectorsEqual = 
          (!p.selectedSectorIds && selectedSectorIds.length === 0) ||
          (p.selectedSectorIds && 
           p.selectedSectorIds.length === selectedSectorIds.length && 
           p.selectedSectorIds.every(id => selectedSectorIds.includes(id)));

        const isSame =
          p.format === selectedFormat &&
          p.financialValues === showFinancialValues &&
          p.groupMode === groupMode &&
          p.pcpTotalGrid === pcpTotalGrid &&
          p.showMaterials === showMaterials &&
          p.showItemGrid === showItemGrid &&
          p.showSectorNotes === showSectorNotes &&
          p.showOrderList === showOrderList &&
          p.showSoleGrid === showSoleGrid &&
          isSectorsEqual;

        if (!isSame) {
          setActiveProfileId(null);
          localStorage.removeItem('@app:export_active_profile');
        }
      }
    }
  }, [isOpen, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, showSoleGrid, selectedSectorIds, activeProfileId, profiles]);

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
      const pages = await onPreview(note, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, splitPages, showProvider, showOSData, showSoleGrid, selectedSectorIds, pageSize);
      if (Array.isArray(pages) && pages.length > 0) {
        setPreviewPages(pages);
        setPreviewPageIdx(0);
      }
    } catch (e) {
      console.error("Preview failed", e);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleOpenInPrintStudio = async () => {
    if (!onOpenInPrintStudio) return;
    setIsOpeningPrintStudio(true);
    try {
      await onOpenInPrintStudio(note, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, splitPages, showProvider, showOSData, showSoleGrid, selectedSectorIds, pageSize);
    } catch (e) {
      console.error("Open in Print Studio failed", e);
    } finally {
      setIsOpeningPrintStudio(false);
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

  if (!isOpen) return null;

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const SectionCard = ({ id, icon, label, children }: { id: string; icon: React.ReactNode; label: string; children: React.ReactNode }) => {
    const sectionOpen = openSections.has(id);
    return (
      <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-3 transition-all ${isDarkMode ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100'}`}
        >
          <span className="flex items-center gap-2">
            {icon}
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">{label}</span>
          </span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${sectionOpen ? 'rotate-180' : ''}`} />
        </button>
        {sectionOpen && (
          <div className={`p-3 flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            {children}
          </div>
        )}
      </div>
    );
  };

  const handlePredefinedClick = (text: string) => {
    if (note.includes(text)) {
      setNote(prev => prev.replace(text, '').replace(/\n\n$/, '').trim());
    } else {
      setNote(prev => prev ? `${prev}\n\n${text}` : text);
    }
  };

  const gridActiveCount = [
    showPCPTotalGridToggle && pcpTotalGrid,
    showMaterialsToggle && showMaterials,
    showItemGridToggle && showItemGrid,
    showSplitPagesToggle && splitPages && selectedFormat === 'jpg',
    showOrderListToggle && showOrderList,
    showSectorNotesToggle && showSectorNotes
  ].filter(Boolean).length;

  const showSectorNotesLabel = showSectorNotesToggle && showSectorNotes
    ? (sectors && sectors.length > 0 && selectedSectorIds.length < sectors.length
        ? `Instruções (${selectedSectorIds.length}/${sectors.length} Setores)`
        : 'Instruções Setor')
    : null;

  const gridActiveLabels = [
    showPCPTotalGridToggle && pcpTotalGrid && 'Grade Total',
    showMaterialsToggle && showMaterials && 'Materiais',
    showItemGridToggle && showItemGrid && 'Grade Pedido',
    showSplitPagesToggle && splitPages && selectedFormat === 'jpg' && 'Dividir Páginas',
    showOrderListToggle && showOrderList && 'Lista Pedidos',
    showSectorNotesLabel
  ].filter(Boolean) as string[];

  const gridSubtitle = gridActiveCount > 0 
    ? gridActiveLabels.join(', ')
    : 'Nenhuma opção ativa';

  const groupSubtitle = groupMode === 'none' 
    ? 'Não agrupar' 
    : groupMode === 'ref_color' 
      ? 'Agrupar por Modelo e Cor' 
      : 'Agrupar apenas por Referência';

  const osActiveLabels = [
    showProviderToggle && showProvider && 'Prestador',
    showOSDataToggle && showOSData && 'Dados OS'
  ].filter(Boolean) as string[];
  const osSubtitle = osActiveLabels.length > 0 
    ? osActiveLabels.join(', ')
    : 'Nenhum dado ativo';

  const sectorSubtitle = showSoleGrid ? 'Separação de solas ativa' : 'Nenhuma opção ativa';

  const profileActive = profiles.find(p => p.id === activeProfileId);
  const profileSubtitle = activeProfileId && profileActive 
    ? `Ativo: ${profileActive.name}` 
    : 'Últimas opções usadas';

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
          {/* Observação Interna / Rodapé como Acordeon */}
          <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'}`}>
            <button
              type="button"
              onClick={() => setIsObservationOpen(prev => !prev)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-4 transition-all ${
                isDarkMode ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-3">
                <FileText size={16} className="text-indigo-500" strokeWidth={2.5} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">
                  Observação Interna / Rodapé
                </span>
              </span>
              <div className="flex items-center gap-2">
                {note.trim() && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 uppercase tracking-widest max-w-[120px] truncate">
                    Preenchido
                  </span>
                )}
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isObservationOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            
            {isObservationOpen && (
              <div className={`p-4 flex flex-col gap-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                <textarea
                  className={`w-full h-32 rounded-2xl p-4 text-[13px] font-medium leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none ${
                    isDarkMode
                      ? 'bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-400'
                  }`}
                  placeholder="Digite aqui alguma observação importante para constar no documento..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                {/* Textos Rápidos */}
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
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border text-left ${
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
              </div>
            )}
          </div>

          {/* Configurações de Exportação em Cards */}
          <div className="flex flex-col gap-3">
            <div className="px-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Configurações de Exportação</span>
            </div>

            {/* 1. Valores Financeiros Card */}
            {showValuesToggle && (
              <button
                type="button"
                onClick={() => setActivePopup('financial')}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.99] text-left gap-3 ${
                  isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 ${showFinancialValues ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                    <DollarSign size={16} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Valores Financeiros</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 leading-tight truncate">
                      {showFinancialValues ? 'Exibir valores e total' : 'Ocultar valores'}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className="text-slate-400 -rotate-90 shrink-0" />
              </button>
            )}

            {/* 2. Resumo da Grade Card */}
            {(showPCPTotalGridToggle || showMaterialsToggle || showItemGridToggle || showSplitPagesToggle || showOrderListToggle || showSectorNotesToggle) && (
              <button
                type="button"
                onClick={() => setActivePopup('grid')}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.99] text-left gap-3 ${
                  isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 ${gridActiveCount > 0 ? (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600') : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={gridActiveCount > 0 ? 'text-amber-500' : 'text-slate-400'}><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Resumo da Grade</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 leading-tight truncate">
                      {gridSubtitle}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className="text-slate-400 -rotate-90 shrink-0" />
              </button>
            )}

            {/* 3. Agrupamento de Itens Card */}
            {showGroupingToggle && (
              <button
                type="button"
                onClick={() => setActivePopup('group')}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.99] text-left gap-3 ${
                  isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 ${groupMode !== 'none' ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                    <Layers size={16} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Agrupamento de Itens</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 leading-tight truncate">
                      {groupSubtitle}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className="text-slate-400 -rotate-90 shrink-0" />
              </button>
            )}

            {/* 4. Dados da OS Card */}
            {(showProviderToggle || showOSDataToggle) && (
              <button
                type="button"
                onClick={() => setActivePopup('os')}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.99] text-left gap-3 ${
                  isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 ${osActiveLabels.length > 0 ? (isDarkMode ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600') : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                    <Hash size={16} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Dados da OS</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 leading-tight truncate">
                      {osSubtitle}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className="text-slate-400 -rotate-90 shrink-0" />
              </button>
            )}

            {/* 5. Detalhes de Setor Card */}
            {showSoleGridToggle && (
              <button
                type="button"
                onClick={() => setActivePopup('sector')}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.99] text-left gap-3 ${
                  isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 ${showSoleGrid ? (isDarkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-600') : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                    <Boxes size={16} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Detalhes de Setor</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 leading-tight truncate">
                      {sectorSubtitle}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className="text-slate-400 -rotate-90 shrink-0" />
              </button>
            )}

            {/* 6. Perfis de Exportação Card */}
            <button 
              type="button" 
              onClick={() => setActivePopup('profiles')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.99] text-left gap-3 ${
                isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 ${activeProfileId ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                  <Settings2 size={16} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Perfis de Exportação</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 leading-tight truncate">
                    {profileSubtitle}
                  </p>
                </div>
              </div>
              <ChevronDown size={16} className="text-slate-400 -rotate-90 shrink-0" />
            </button>
          </div>
        </div>
                {/* Footer Actions */}
        <div className={`p-4 flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
          {/* Preview Section — navega página a página exatamente como o arquivo final
              vai ser dividido (ver "Dividir em Páginas"), pra dar pra revisar onde cada
              corte cai antes de gerar de verdade. */}
          {previewPages.length > 0 && (
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">
                  Pré-visualização{previewPages.length > 1 ? ` — Pág. ${previewPageIdx + 1}/${previewPages.length}` : ''}
                </span>
                <button type="button" onClick={() => setPreviewPages([])} className="text-[10px] font-black uppercase tracking-widest text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all px-3 py-1.5 rounded-full shadow-sm">Fechar Preview</button>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner max-h-[60vh] overflow-y-auto">
                {selectedFormat === 'pdf' ? (
                  <iframe src={previewPages[previewPageIdx] + "#toolbar=0"} className="w-full h-[500px]" />
                ) : (
                  <img src={previewPages[previewPageIdx]} className="w-full h-auto" />
                )}
              </div>
              {previewPages.length > 1 && (
                <div className="flex items-center justify-between gap-2 mt-3">
                  <button
                    type="button"
                    disabled={previewPageIdx === 0}
                    onClick={() => setPreviewPageIdx(p => Math.max(0, p - 1))}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewPageIdx === 0 ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <div className="flex items-center gap-1">
                    {previewPages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewPageIdx(idx)}
                        aria-label={`Ir para página ${idx + 1}`}
                        className={`w-2 h-2 rounded-full transition-all ${idx === previewPageIdx ? 'bg-indigo-500 w-5' : 'bg-slate-300 dark:bg-slate-600'}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={previewPageIdx === previewPages.length - 1}
                    onClick={() => setPreviewPageIdx(p => Math.min(previewPages.length - 1, p + 1))}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewPageIdx === previewPages.length - 1 ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  >
                    Próxima <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cards Actions — agrupadas num acordeão (igual aos demais SectionCard da tela);
              só "Cancelar" fica sempre visível, fora do acordeão. */}
          <div className="flex flex-col gap-2">
            <SectionCard id="share_actions" icon={<Send size={13} className="text-cyan-500" />} label="Opções de Compartilhamento">
              {/* Visualizar / Abrir no Print Studio */}
              {(onPreview || (showOpenInPrintStudioToggle && onOpenInPrintStudio)) && (
                <div className="flex gap-1.5">
                  {onPreview && (
                    <button
                      type="button"
                      onClick={handlePreview}
                      disabled={isPreviewLoading}
                      className={`flex-1 py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-800 shadow-slate-800/20`}
                    >
                      {isPreviewLoading ? 'Carregando...' : 'Visualizar Arquivo'}
                    </button>
                  )}
                  {showOpenInPrintStudioToggle && onOpenInPrintStudio && (
                    <button
                      type="button"
                      onClick={handleOpenInPrintStudio}
                      disabled={isOpeningPrintStudio}
                      className={`flex-1 py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 bg-cyan-600 shadow-cyan-600/20`}
                    >
                      {isOpeningPrintStudio ? 'Abrindo...' : 'Print Studio'}
                    </button>
                  )}
                </div>
              )}

              {/* Generate */}
              <button
                type="button"
                onClick={() => onConfirm(note, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, splitPages, showProvider, showOSData, showSoleGrid, selectedSectorIds, pageSize)}
                className={`w-full py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                  selectedFormat === 'pdf' ? 'bg-rose-500' : 'bg-indigo-600'
                }`}
              >
                {selectedFormat === 'pdf' ? <FileText size={16} /> : <Send size={16} className="rotate-45" />}
                Gerar {selectedFormat.toUpperCase()}
              </button>

              {/* Format Toggles */}
              <div className={`p-1.5 rounded-[20px] shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
                <button
                  type="button"
                  onClick={() => setSelectedFormat('pdf')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedFormat === 'pdf' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Formato PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFormat('jpg')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedFormat === 'jpg' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Formato JPG
                </button>
              </div>

              {/* Page Size Selection */}
              <div className="flex flex-col gap-1.5 mt-0.5">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Tamanho de Exportação</span>
                <div className={`p-1.5 rounded-[20px] shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
                  <button
                    type="button"
                    onClick={() => setPageSize('a4')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      pageSize === 'a4' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    Papel A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageSize('marketplace')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      pageSize === 'marketplace' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    Marketplace (100x150)
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Cancelar — única ação que fica fora do acordeão, sempre visível */}
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${
                isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>


      {/* Centralized Pop-ups Overlay */}
      {activePopup && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActivePopup(null)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-[340px] max-h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border ${
              isDarkMode ? 'bg-slate-900 border border-slate-850 text-white' : 'bg-white border-slate-100 text-slate-900'
            }`}
          >
            {/* Pop-up Header */}
            <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-350">
                {activePopup === 'financial' && 'Valores Financeiros'}
                {activePopup === 'grid' && 'Resumo da Grade'}
                {activePopup === 'group' && 'Agrupamento de Itens'}
                {activePopup === 'os' && 'Dados da OS'}
                {activePopup === 'sector' && 'Detalhes de Setor'}
                {activePopup === 'profiles' && 'Perfis de Exportação'}
              </span>
              <button 
                onClick={() => setActivePopup(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                }`}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Pop-up Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {/* Financial Values Popup Content */}
              {activePopup === 'financial' && (
                <button
                  type="button"
                  onClick={() => setShowFinancialValues(prev => !prev)}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                    isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showFinancialValues ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                      {showFinancialValues ? <DollarSign size={15} strokeWidth={2.5} /> : <EyeOff size={15} strokeWidth={2.5} />}
                    </div>
                    <div>
                      <p className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {showFinancialValues ? 'Mostrar valores' : 'Ocultar valores'}
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        {showFinancialValues ? 'Preços aparecerão no arquivo' : 'Arquivo sem preços/total'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-1 flex items-center transition-all shrink-0 ${showFinancialValues ? 'bg-emerald-500 justify-end' : (isDarkMode ? 'bg-slate-700 justify-start' : 'bg-slate-300 justify-start')}`}>
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </div>
                </button>
              )}

              {/* Grid Summary Popup Content */}
              {activePopup === 'grid' && (
                <div className="flex flex-col gap-3">
                  {showPCPTotalGridToggle && (
                    <button
                      type="button"
                      onClick={() => setPcpTotalGrid(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${pcpTotalGrid ? 'bg-amber-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {pcpTotalGrid ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-750 dark:text-slate-200">Grade Consolidada</div>
                          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Soma todos os pedidos em uma tabela extra
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {showMaterialsToggle && (
                    <button
                      type="button"
                      onClick={() => setShowMaterials(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showMaterials ? 'bg-emerald-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {showMaterials ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-750 dark:text-slate-200">Exibir materiais</div>
                          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Mostra a requisição consolidada de materiais
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {showItemGridToggle && (
                    <button
                      type="button"
                      onClick={() => setShowItemGrid(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showItemGrid ? 'bg-indigo-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {showItemGrid ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-750 dark:text-slate-200">{itemGridLabel}</div>
                          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-405 mt-0.5 leading-snug">
                            {itemGridDescription}
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {showSplitPagesToggle && selectedFormat === 'jpg' && (
                    <button
                      type="button"
                      onClick={() => setSplitPages(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${splitPages ? 'bg-cyan-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {splitPages ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-755 dark:text-slate-200">Dividir em Páginas</div>
                          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Corta a imagem em formato A4 em vez de única comprida
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {showOrderListToggle && (
                    <button
                      type="button"
                      onClick={() => setShowOrderList(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showOrderList ? 'bg-cyan-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {showOrderList ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-755 dark:text-slate-200">Exibir lista de pedidos</div>
                          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Mostra relação de pedidos cadastrados
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {showSectorNotesToggle && (
                    <button
                      type="button"
                      onClick={() => setShowSectorNotes(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showSectorNotes ? 'bg-rose-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {showSectorNotes ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-755 dark:text-slate-200">Instruções por Setor</div>
                          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Exibe observações cadastradas por setor
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {showSectorNotes && sectors && sectors.length > 0 && (
                    <div className={`p-3 rounded-2xl border flex flex-col gap-2 ${
                      isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Setores para Instruções
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSectorIds(sectors.map(s => s.id))}
                            className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Todos
                          </button>
                          <span className="text-slate-350 dark:text-slate-700 text-[9px] font-bold">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedSectorIds([])}
                            className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Nenhum
                          </button>
                        </div>
                      </div>
                      
                      <div className="max-h-[160px] overflow-y-auto flex flex-col gap-1.5 custom-scrollbar pr-1">
                        {sectors.map(sec => {
                          const isChecked = selectedSectorIds.includes(sec.id);
                          return (
                            <button
                              key={sec.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedSectorIds(prev => prev.filter(id => id !== sec.id));
                                } else {
                                  setSelectedSectorIds(prev => [...prev, sec.id]);
                                }
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                                isChecked
                                  ? 'border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-500/10'
                                  : isDarkMode ? 'border-slate-800 bg-slate-800/20 hover:border-slate-750' : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {sec.color && (
                                  <div 
                                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                                    style={{ backgroundColor: sec.color }}
                                  />
                                )}
                                <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                  {sec.name}
                                </span>
                              </div>
                              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                isChecked
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : isDarkMode ? 'border-slate-750' : 'border-slate-300'
                              }`}>
                                {isChecked && <Check size={11} strokeWidth={4} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Item Grouping Popup Content */}
              {activePopup === 'group' && (
                <div className="flex flex-col gap-2.5">
                  <button 
                    type="button" 
                    onClick={() => setGroupMode('none')} 
                    className={`w-full p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      groupMode === 'none' 
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${groupMode === 'none' ? 'border-indigo-500 text-indigo-500' : 'border-slate-300 dark:border-slate-700'}`}>
                      {groupMode === 'none' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-750 dark:text-slate-200">Não agrupar</span>
                      <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Cada item aparece individualmente</span>
                    </div>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setGroupMode('ref_color')} 
                    className={`w-full p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      groupMode === 'ref_color' 
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${groupMode === 'ref_color' ? 'border-indigo-500 text-indigo-500' : 'border-slate-300 dark:border-slate-700'}`}>
                      {groupMode === 'ref_color' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-750 dark:text-slate-200">Modelo e Cor</span>
                      <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Soma as grades de mesma referência E cor</span>
                    </div>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setGroupMode('ref')} 
                    className={`w-full p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      groupMode === 'ref' 
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${groupMode === 'ref' ? 'border-indigo-500 text-indigo-500' : 'border-slate-300 dark:border-slate-700'}`}>
                      {groupMode === 'ref' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-750 dark:text-slate-200">Apenas Referência</span>
                      <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Soma as cores do mesmo modelo juntas</span>
                    </div>
                  </button>
                </div>
              )}

              {/* OS Data Popup Content */}
              {activePopup === 'os' && (
                <div className="flex flex-col gap-3">
                  {showProviderToggle && (
                    <button
                      type="button"
                      onClick={() => setShowProvider(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showProvider ? 'bg-violet-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {showProvider ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-755 dark:text-slate-200">Prestador de Serviço</div>
                          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Nome de quem executou, vindo da OS de origem
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {showOSDataToggle && (
                    <button
                      type="button"
                      onClick={() => setShowOSData(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showOSData ? 'bg-violet-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {showOSData ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-755 dark:text-slate-200">Exibir Dados da OS</div>
                          <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Valor, data e setor da OS de origem
                          </div>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Sector Details Popup Content */}
              {activePopup === 'sector' && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSoleGrid(prev => !prev)}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                      isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showSoleGrid ? 'bg-orange-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                        {showSoleGrid ? <Check size={16} strokeWidth={3} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-755 dark:text-slate-200">Separação de Solas (Montagem)</div>
                        <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Mostra o molde/cor de solado e a grade de numeração no pedido
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Profiles Popup Content */}
              {activePopup === 'profiles' && (
                <div className="flex flex-col gap-3">
                  {/* Profiles List */}
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
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
                        setShowSoleGrid(state.showSoleGrid);
                        setSelectedSectorIds(state.selectedSectorIds || sectors.map(s => s.id));
                        setActiveProfileId(null);
                        localStorage.removeItem('@app:export_active_profile');
                        setActivePopup(null);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                        activeProfileId === null
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : isDarkMode ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
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
                          : isDarkMode ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
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
                                setShowSoleGrid(p.showSoleGrid);
                                setSelectedSectorIds(p.selectedSectorIds || sectors.map(s => s.id));
                                setActiveProfileId(p.id);
                                localStorage.setItem('@app:export_active_profile', p.id);
                                setActivePopup(null);
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
                  <div className={`p-3 rounded-2xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
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
                              showOrderList: showOrderList,
                              showSoleGrid: showSoleGrid,
                              selectedSectorIds: selectedSectorIds
                            };
                            const newP = [...profiles, p];
                            setProfiles(newP);
                            saveProfiles(newP);
                            setActiveProfileId(p.id);
                            localStorage.setItem('@app:export_active_profile', p.id);
                            setNewProfileName('');
                          }
                        }}
                        placeholder="Nome do perfil..."
                        className={`flex-1 min-w-0 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                          isDarkMode ? 'bg-slate-800 border border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border border-slate-200 text-slate-700 placeholder:text-slate-400'
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
                              showOrderList: showOrderList,
                              showSoleGrid: showSoleGrid,
                              selectedSectorIds: selectedSectorIds
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
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                          newProfileName.trim() ? 'bg-indigo-600 text-white active:scale-95' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Plus size={16} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pop-up Footer */}
            <div className={`p-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-850' : 'border-slate-100 bg-slate-50'} flex justify-end`}>
              <button
                type="button"
                onClick={() => setActivePopup(null)}
                className="px-5 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                Fechar
              </button>
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
