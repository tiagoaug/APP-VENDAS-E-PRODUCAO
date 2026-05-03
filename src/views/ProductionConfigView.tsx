import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { 
  Tags, 
  Factory, 
  Plus, 
  ChevronLeft, 
  GripVertical, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  PlusCircle,
  Hash,
  Ruler,
  Scissors,
  Layers,
  CalendarClock,
  Footprints,
  Box,
  Package,
  Grid3X3,
  Search,
  ChevronDown,
  Camera,
  Target,
  Loader2
} from 'lucide-react';
import { FlowTag, Sector, ProductionConfigItem, Person, ColorValue } from '../types';

interface ProductionConfigViewProps {
  flowTags: FlowTag[];
  sectors: Sector[];
  productionConfigs: ProductionConfigItem[];
  onSaveFlowTag: (tag: FlowTag) => Promise<void>;
  onDeleteFlowTag: (id: string) => Promise<void>;
  onSaveSector: (sector: Sector) => Promise<void>;
  onDeleteSector: (id: string) => Promise<void>;
  onSaveConfigItem: (item: ProductionConfigItem) => Promise<void>;
  onDeleteConfigItem: (id: string) => Promise<void>;
  onUpdateSectorsOrder: (sectors: Sector[]) => Promise<void>;
  onBack: () => void;
  isDarkMode: boolean;
  people?: Person[];
  colors?: ColorValue[];
}

const SECTOR_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#14b8a6', // Teal
  '#64748b', // Slate
];

type ScreenType = 'MENU' | 'SECTORS' | 'FLOW_TAGS' | 'UNIDADES' | 'FACAS' | 'INFESTO' | 'PRAZOS' | 'FICHAS' | 'EMBALAGENS' | 'INSUMOS' | 'MATRIZES';

const MASTER_CATEGORIES = [
  'CABEDAL',
  'FORRO',
  'SOLADO',
  'ADESIVOS',
  'QUÍMICOS',
  'EMBALAGEM',
  'COMPONENTES',
  'OUTROS'
];

const DEFAULT_UNITS = [
  { name: 'UN', description: 'Unidade' },
  { name: 'PR', description: 'Par' },
  { name: 'KG', description: 'Quilograma' },
  { name: 'MT', description: 'Metro' },
  { name: 'MT2', description: 'Metro Quadrado' },
  { name: 'CM', description: 'Centímetro' },
  { name: 'GR', description: 'Grama' },
  { name: 'L', description: 'Litro' },
  { name: 'MIL', description: 'Milheiro' },
];

export default function ProductionConfigView({
  flowTags,
  sectors,
  productionConfigs,
  onSaveFlowTag,
  onDeleteFlowTag,
  onSaveSector,
  onDeleteSector,
  onSaveConfigItem,
  onDeleteConfigItem,
  onUpdateSectorsOrder,
  onBack,
  isDarkMode
}: ProductionConfigViewProps) {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('MENU');
  const [editingTag, setEditingTag] = useState<FlowTag | null>(null);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddingSector, setIsAddingSector] = useState(false);

  // Flow Tag Handlers
  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;
    await onSaveFlowTag(editingTag);
    setEditingTag(null);
    setIsAddingTag(false);
  };

  const handleAddSubcategory = () => {
    if (!editingTag) return;
    setEditingTag({
      ...editingTag,
      subcategories: [...editingTag.subcategories, '']
    });
  };

  const handleUpdateSubcategory = (index: number, value: string) => {
    if (!editingTag) return;
    const newSubs = [...editingTag.subcategories];
    newSubs[index] = value;
    setEditingTag({ ...editingTag, subcategories: newSubs });
  };

  const handleRemoveSubcategory = (index: number) => {
    if (!editingTag) return;
    const newSubs = editingTag.subcategories.filter((_, i) => i !== index);
    setEditingTag({ ...editingTag, subcategories: newSubs });
  };

  // Sector Handlers
  const handleSaveSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSector) return;
    
    if (isAddingSector) {
      const usedColors = sectors.map(s => s.color);
      const availableColor = SECTOR_COLORS.find(c => !usedColors.includes(c)) || SECTOR_COLORS[Math.floor(Math.random() * SECTOR_COLORS.length)];
      editingSector.color = availableColor;
      editingSector.order = sectors.length;
    }

    await onSaveSector(editingSector);
    setEditingSector(null);
    setIsAddingSector(false);
  };

  const toggleTagInSector = (tagId: string) => {
    if (!editingSector) return;
    const currentIds = editingSector.flowTagIds || [];
    const newIds = currentIds.includes(tagId)
      ? currentIds.filter(id => id !== tagId)
      : [...currentIds, tagId];
    setEditingSector({ ...editingSector, flowTagIds: newIds });
  };

  const getScreenTitle = () => {
    switch(currentScreen) {
      case 'MENU': return 'Configurações';
      case 'SECTORS': return 'Setores';
      case 'FLOW_TAGS': return 'Flow Tags';
      case 'UNIDADES': return 'Unidades';
      case 'FACAS': return 'Facas Corte';
      case 'INFESTO': return 'Infesto';
      case 'PRAZOS': return 'Prazos';
      case 'FICHAS': return 'Fichas Técnicas';
      case 'EMBALAGENS': return 'Padrão Embalagens';
      case 'INSUMOS': return 'Insumos';
      case 'MATRIZES': return 'Matrizes Sola';
      default: return 'Configurações';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fafafa] dark:bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className={`px-4 pt-12 pb-4 border-b shrink-0 flex items-center justify-between ${isDarkMode ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={currentScreen === 'MENU' ? onBack : () => setCurrentScreen('MENU')}
            className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {getScreenTitle()}
            </h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Produção</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-32">
        <AnimatePresence mode="wait">
          {currentScreen === 'MENU' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-3"
            >
              <ConfigMenuItem 
                icon={<Factory size={24} />}
                label="Setores"
                desc="Ordem de Produção"
                color="text-indigo-600"
                bg="bg-indigo-50"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('SECTORS')}
              />
              <ConfigMenuItem 
                icon={<Tags size={24} />}
                label="Flow Tags"
                desc="Categorias de Serviços"
                color="text-emerald-600"
                bg="bg-emerald-50"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('FLOW_TAGS')}
              />
              <ConfigMenuItem 
                icon={<Ruler size={24} />}
                label="Unidades"
                desc="Medidas"
                color="text-slate-600"
                bg="bg-slate-100"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('UNIDADES')}
              />
              <ConfigMenuItem 
                icon={<Scissors size={24} />}
                label="Facas Corte"
                desc="Matrizes"
                color="text-orange-600"
                bg="bg-orange-50"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('FACAS')}
              />
              <ConfigMenuItem 
                icon={<Layers size={24} />}
                label="Infesto"
                desc="Camadas"
                color="text-blue-600"
                bg="bg-blue-50"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('INFESTO')}
              />
              <ConfigMenuItem 
                icon={<CalendarClock size={24} />}
                label="Prazos"
                desc="SLA Entrega"
                color="text-teal-600"
                bg="bg-teal-50"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('PRAZOS')}
              />
              <ConfigMenuItem 
                icon={<Footprints size={24} />}
                label="Fichas Técnicas"
                desc="Modelagem"
                color="text-slate-700"
                bg="bg-slate-100"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('FICHAS')}
              />
              <ConfigMenuItem 
                icon={<Grid3X3 size={24} />}
                label="Padrão Embalagens"
                desc="Tamanhos & Grades"
                color="text-violet-600"
                bg="bg-violet-50"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('EMBALAGENS')}
              />
              <ConfigMenuItem 
                icon={<Package size={24} />}
                label="Insumos"
                desc="Catálogo"
                color="text-amber-600"
                bg="bg-amber-50"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('INSUMOS')}
              />
              <ConfigMenuItem 
                icon={<Grid3X3 size={24} />}
                label="Matrizes Sola"
                desc="Solados"
                color="text-slate-800"
                bg="bg-slate-100"
                isDarkMode={isDarkMode}
                onClick={() => setCurrentScreen('MATRIZES')}
              />
            </motion.div>
          )}

          {currentScreen === 'SECTORS' && (
            <motion.div
              key="sectors"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Setores de Fábrica</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Defina a ordem da produção</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingSector({ id: '', name: '', color: '', order: sectors.length, flowTagIds: [] });
                    setIsAddingSector(true);
                  }}
                  className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  <Plus size={24} strokeWidth={3} />
                </button>
              </div>

              <Reorder.Group 
                axis="y" 
                values={sectors} 
                onReorder={onUpdateSectorsOrder}
                className="flex flex-col gap-4"
              >
                {sectors.map((sector) => (
                  <SectorCard 
                    key={sector.id}
                    sector={sector}
                    flowTags={flowTags}
                    isDarkMode={isDarkMode}
                    onEdit={() => {
                      setEditingSector({ ...sector });
                      setIsAddingSector(false);
                    }}
                    onDelete={() => onDeleteSector(sector.id)}
                  />
                ))}
              </Reorder.Group>

              {sectors.length === 0 && (
                <div className={`p-12 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center text-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300">
                    <Factory size={32} />
                  </div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Nenhum setor cadastrado</p>
                </div>
              )}
            </motion.div>
          )}

          {currentScreen === 'FLOW_TAGS' && (
            <motion.div
              key="flowtags"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Flow Tags</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Categorias de Serviços</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingTag({ id: '', name: '', subcategories: [] });
                    setIsAddingTag(true);
                  }}
                  className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  <Plus size={24} strokeWidth={3} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {flowTags.map((tag) => (
                  <motion.div
                    key={tag.id}
                    layout
                    className={`p-6 rounded-[2.5rem] border flex items-center justify-between group ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Tags size={24} />
                      </div>
                      <div>
                        <p className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tag.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          {tag.subcategories.length} {tag.subcategories.length === 1 ? 'Subcategoria' : 'Subcategorias'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingTag({ ...tag });
                          setIsAddingTag(false);
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('Deseja excluir esta Flow Tag?')) onDeleteFlowTag(tag.id);
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-red-400' : 'bg-slate-50 text-slate-400 hover:text-red-500'}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {flowTags.length === 0 && (
                  <div className={`p-12 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center text-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300">
                      <Tags size={32} />
                    </div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Nenhuma Flow Tag cadastrada</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentScreen === 'FACAS' && (
            <motion.div key="facas" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GenericConfigList title="Facas de Corte" label="FACAS" items={productionConfigs} type="TOOL" icon={<Scissors size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} placeholderLabel="Nenhuma faca cadastrada" />
            </motion.div>
          )}

          {currentScreen === 'UNIDADES' && (
            <motion.div key="unidades" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GenericConfigList title="Unidades" label="UNIDADES" items={productionConfigs} type="UNIT" icon={<Ruler size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} placeholderLabel="Nenhuma unidade cadastrada" seedDefaults={DEFAULT_UNITS} />
            </motion.div>
          )}

          {currentScreen === 'INFESTO' && (
            <motion.div key="infesto" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GenericConfigList title="Infesto" label="INFESTO" items={productionConfigs} type="INFESTO" icon={<Layers size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} placeholderLabel="Nenhum registro de infesto" />
            </motion.div>
          )}

          {currentScreen === 'PRAZOS' && (
            <motion.div key="prazos" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GenericConfigList title="Prazos" label="PRAZOS" items={productionConfigs} type="DEADLINE" icon={<CalendarClock size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} placeholderLabel="Nenhum prazo cadastrado" />
            </motion.div>
          )}

          {currentScreen === 'FICHAS' && (
            <motion.div key="fichas" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GenericConfigList title="Fichas Técnicas" label="FICHAS TÉCNICAS" items={productionConfigs} type="TECH_SHEET" icon={<Footprints size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} placeholderLabel="Nenhuma ficha técnica" />
            </motion.div>
          )}

          {currentScreen === 'EMBALAGENS' && (
            <motion.div key="embalagens" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GenericConfigList title="Padrão de Embalagens" label="PADRÃO EMBALAGENS" items={productionConfigs} type="PACKAGING" icon={<Grid3X3 size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} placeholderLabel="Nenhum padrão de embalagem" />
            </motion.div>
          )}

          {currentScreen === 'INSUMOS' && (
            <motion.div key="insumos" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GenericConfigList title="Insumos" label="INSUMOS" items={productionConfigs} type="MATERIAL" icon={<Package size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} placeholderLabel="Nenhum insumo cadastrado" />
            </motion.div>
          )}

          {currentScreen === 'MATRIZES' && (
            <motion.div key="matrizes" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <GenericConfigList title="Matrizes Sola" label="MATRIZES SOLA" items={productionConfigs} type="MOLD" icon={<Grid3X3 size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} placeholderLabel="Nenhuma matriz cadastrada" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals for Tags and Sectors */}
      <Modal 
        isOpen={!!editingTag} 
        onClose={() => setEditingTag(null)}
        isDarkMode={isDarkMode}
        title={isAddingTag ? "Nova Flow Tag" : "Editar Flow Tag"}
      >
        <form onSubmit={handleSaveTag} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome da Categoria</label>
            <input 
              type="text"
              value={editingTag?.name || ''}
              onChange={(e) => setEditingTag(prev => prev ? { ...prev, name: e.target.value } : null)}
              placeholder="Ex: Corte, Costura, Montagem"
              className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
              required
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subcategorias (Serviços)</label>
              <button 
                type="button"
                onClick={handleAddSubcategory}
                className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
              >
                <PlusCircle size={14} /> Adicionar
              </button>
            </div>
            
            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
              {editingTag?.subcategories.map((sub, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                    <Hash size={16} />
                  </div>
                  <input 
                    type="text"
                    value={sub}
                    onChange={(e) => handleUpdateSubcategory(index, e.target.value)}
                    placeholder="Nome do serviço"
                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => handleRemoveSubcategory(index)}
                    className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              {editingTag?.subcategories.length === 0 && (
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-4 italic">Nenhuma subcategoria adicionada</p>
              )}
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
          >
            <Check size={18} strokeWidth={3} />
            {isAddingTag ? 'Criar Flow Tag' : 'Salvar Alterações'}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={!!editingSector} 
        onClose={() => setEditingSector(null)}
        isDarkMode={isDarkMode}
        title={isAddingSector ? "Novo Setor" : "Editar Setor"}
      >
        <form onSubmit={handleSaveSector} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Setor</label>
            <input 
              type="text"
              value={editingSector?.name || ''}
              onChange={(e) => setEditingSector(prev => prev ? { ...prev, name: e.target.value } : null)}
              placeholder="Ex: Almoxarifado, Montagem, Expedição"
              className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
              required
            />
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Flow Tags do Setor (Obrigações)</label>
            
            <div className="grid grid-cols-2 gap-3">
              {flowTags.map((tag) => {
                const isSelected = editingSector?.flowTagIds?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTagInSector(tag.id)}
                    className={`p-4 rounded-2xl border-2 flex flex-col gap-2 transition-all text-left ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                        : (isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-500' : 'border-slate-100 bg-white text-slate-400')
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Tags size={16} className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : ''} />
                      {isSelected && <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center"><Check size={10} className="text-white" strokeWidth={4} /></div>}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-tight ${isSelected ? 'text-indigo-900 dark:text-white' : ''}`}>{tag.name}</span>
                  </button>
                );
              })}
            </div>
            {flowTags.length === 0 && (
              <div className="p-6 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Cadastre Flow Tags primeiro</p>
              </div>
            )}
          </div>

          <button 
            type="submit"
            className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
          >
            <Check size={18} strokeWidth={3} />
            {isAddingSector ? 'Criar Setor' : 'Salvar Alterações'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function GenericConfigList({ 
  title, 
  label, 
  items, 
  type, 
  icon, 
  isDarkMode, 
  onSave, 
  onDelete, 
  placeholderLabel,
  seedDefaults 
}: {
  title: string;
  label: string;
  items: ProductionConfigItem[];
  type: ProductionConfigItem['type'];
  icon: React.ReactNode;
  isDarkMode: boolean;
  onSave: (item: ProductionConfigItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  placeholderLabel: string;
  seedDefaults?: { name: string; description: string }[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionConfigItem | null>(null);
  const [search, setSearch] = useState('');
  const [newSize, setNewSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    return items
      .filter(item => item.type === type)
      .filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase()) || 
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
      );
  }, [items, type, search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || isLoading) return;
    
    // Validar metadados para Facas
    if (type === 'TOOL') {
      const conjugation = editingItem.metadata?.conjugation || 1;
      if (conjugation < 1) {
        alert('A conjugação deve ser pelo menos 1');
        return;
      }
    }

    // Validation for Packaging Grade
    if (type === 'PACKAGING' && editingItem.metadata?.mode !== 'FREE') {
      const totalDist = Object.values(editingItem.metadata?.sizeQuantities || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      const capacity = Number(editingItem.metadata?.capacity || 0);
      
      if (totalDist !== capacity) {
        alert(`A soma das quantidades (${totalDist}) deve ser exatamente igual à capacidade da embalagem (${capacity}).`);
        return;
      }
    }

    setIsLoading(true);
    try {
      console.log('[GenericConfigList] Saving item:', editingItem);
      await onSave(editingItem);
      console.log('[GenericConfigList] Save success');
      alert('Registro salvo com sucesso!');
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      console.error('[GenericConfigList] Error saving item:', err);
      alert('Erro ao salvar: ' + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!seedDefaults) return;
    for (const def of seedDefaults) {
      await onSave({
        id: '',
        name: def.name,
        description: def.description,
        type,
        createdAt: Date.now()
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Compress and resize image
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 800px
          const MAX_SIZE = 800;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Quality 0.7 for good balance between size and quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setEditingItem(prev => prev ? { ...prev, imageUrl: compressedBase64 } : null);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const addSize = () => {
    if (!newSize || !editingItem) return;
    const currentMetadata = editingItem.metadata || {};
    const currentSizes = currentMetadata.sizes || [];
    if (!currentSizes.includes(newSize)) {
      setEditingItem({
        ...editingItem,
        metadata: {
          ...currentMetadata,
          sizes: [...currentSizes, newSize],
          sizeAreas: { ...(currentMetadata.sizeAreas || {}), [newSize]: 0 }
        }
      });
    }
    setNewSize('');
  };

  const removeSize = (size: string) => {
    if (!editingItem) return;
    const currentMetadata = editingItem.metadata || {};
    const newSizes = (currentMetadata.sizes || []).filter(s => s !== size);
    const newAreas = { ...(currentMetadata.sizeAreas || {}) };
    delete newAreas[size];
    setEditingItem({
      ...editingItem,
      metadata: { ...currentMetadata, sizes: newSizes, sizeAreas: newAreas }
    });
  };

  const updateArea = (size: string, area: number) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      metadata: {
        ...(editingItem.metadata || {}),
        sizeAreas: { ...(editingItem.metadata?.sizeAreas || {}), [size]: area }
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
       {/* Main Header Card */}
       <div className={`p-8 rounded-[3rem] shadow-xl flex flex-col gap-6 relative overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
          <div className="relative z-10 flex items-center gap-4">
             {title !== 'Configurações' && (
                <button 
                  onClick={() => window.history.back()}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                >
                  <ChevronLeft size={18} />
                </button>
             )}
             <div>
                <h3 className={`text-2xl font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Banco de Dados<br/>Técnico
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Configurações base do sistema</p>
             </div>
          </div>
          
          <button 
            onClick={() => {
              setEditingItem({ 
                id: '', 
                name: '', 
                description: '', 
                type, 
                createdAt: Date.now(),
                metadata: type === 'TOOL' ? { conjugation: 1, sizes: [], sizeAreas: {} } : undefined
              });
              setIsModalOpen(true);
            }}
            className={`w-full py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black uppercase tracking-[0.1em] text-xs transition-all shadow-lg active:scale-[0.98] ${
              isDarkMode 
                ? 'bg-slate-800 text-white shadow-slate-950/20' 
                : 'bg-[#4a4a55] text-white shadow-slate-200'
            }`}
          >
            <Plus size={20} strokeWidth={3} />
            Novo Registro
          </button>
       </div>

       {/* Category Pill */}
       <div className="flex justify-center -mt-3">
          <div className={`px-8 py-3 rounded-2xl border-2 flex items-center gap-3 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'}`}>
            <div className={`text-indigo-600 dark:text-indigo-400`}>{icon}</div>
            <span className={`text-xs font-black uppercase tracking-[0.15em] ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{label}</span>
            <ChevronDown size={16} className="text-slate-300" />
          </div>
       </div>

       {/* Search Bar */}
       <div className="relative group">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500">
            <Search size={20} />
          </div>
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`BUSCAR EM ${label}...`}
            className={`w-full pl-14 pr-6 py-5 rounded-3xl font-black text-xs uppercase tracking-widest outline-none transition-all border-2 ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' 
                : 'bg-white border-slate-50 text-slate-900 focus:border-indigo-100 placeholder:text-slate-300'
            }`}
          />
       </div>

       {/* List Items */}
       <div className="flex flex-col gap-3">
          {filteredItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              className={`p-4 rounded-[1.5rem] border flex items-center justify-between group transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}
            >
              <div className="flex items-center gap-5 flex-1">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-slate-50 text-slate-400'}`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    icon
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</p>
                  {type === 'TOOL' ? (
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      CONSUMO P/ ÁREA • {item.metadata?.conjugation || 1} PR/BAT
                    </p>
                  ) : type === 'INFESTO' ? (
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {item.metadata?.layers || 0} CAMADAS
                    </p>
                  ) : type === 'DEADLINE' ? (
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {item.metadata?.days || 0} DIAS
                    </p>
                  ) : type === 'PACKAGING' ? (
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {item.metadata?.capacity || 0} PARES {item.metadata?.mode !== 'FREE' && `• ${(item.metadata?.sizes || []).length} TAMANHOS`}
                    </p>
                  ) : item.description ? (
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 pr-4">
                <button 
                  onClick={() => {
                    setEditingItem({ ...item });
                    setIsModalOpen(true);
                  }}
                  className={`p-2 rounded-full transition-all ${isDarkMode ? 'text-slate-600 hover:text-white' : 'text-slate-200 hover:text-slate-400'}`}
                >
                  <Edit3 size={18} />
                </button>
                <button 
                  onClick={() => {
                    if (confirm(`Deseja excluir ${item.name}?`)) onDelete(item.id);
                  }}
                  className={`p-2 rounded-full transition-all ${isDarkMode ? 'text-slate-600 hover:text-red-400' : 'text-slate-200 hover:text-red-400'}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}

          {filteredItems.length === 0 && search === '' && seedDefaults && (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lista vazia</p>
              <button 
                onClick={handleSeed}
                className="px-6 py-3 rounded-2xl bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100"
              >
                Carregar Unidades Padrão
              </button>
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className={`p-12 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center text-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300">
                {icon}
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                {search ? 'Nenhum resultado encontrado' : placeholderLabel}
              </p>
            </div>
          )}
       </div>

       <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          isDarkMode={isDarkMode}
          title={editingItem?.id ? `Editar Registro` : `Novo Registro`}
       >
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {type === 'TOOL' ? (
              // Specialized Form for Facas
              <div className="flex flex-col gap-6">
                {/* Image Upload Area */}
                <div className="flex flex-col items-center gap-4">
                  <div className={`relative w-32 h-32 rounded-[2.5rem] border-2 border-dashed overflow-hidden flex items-center justify-center ${isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'}`}>
                    {editingItem?.imageUrl ? (
                      <>
                        <img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setEditingItem(prev => prev ? { ...prev, imageUrl: '' } : null)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 text-slate-400"
                      >
                        <Camera size={24} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Adicionar Foto</span>
                      </button>
                    )}
                  </div>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Referência da Faca *</label>
                  <input 
                    type="text"
                    value={editingItem?.name || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Ex: F-TENIS-CYBER"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Conjugação (Pares/Batida) *</label>
                  <input 
                    type="number"
                    value={editingItem?.metadata?.conjugation || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, conjugation: Number(e.target.value) } } : null)}
                    placeholder="1"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>

                {/* Numerations Config */}
                <div className="flex flex-col gap-4">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Configurar Numerações da Faca</label>
                   <div className="flex gap-2">
                      <input 
                        type="text"
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                        placeholder="Ex: 37"
                        className={`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
                      />
                      <button 
                        type="button"
                        onClick={addSize}
                        className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-700"
                      >
                        <Plus size={24} />
                      </button>
                   </div>

                   <div className="p-6 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                      {(editingItem?.metadata?.sizes || []).map(size => (
                        <div key={size} className={`px-4 py-2 rounded-xl flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          <span className="text-xs font-black">{size}</span>
                          <button 
                            type="button"
                            onClick={() => removeSize(size)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {(editingItem?.metadata?.sizes || []).length === 0 && (
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mx-auto py-2">Nenhuma numeração</p>
                      )}
                   </div>
                </div>

                {/* Area Matrix */}
                {(editingItem?.metadata?.sizes || []).length > 0 && (
                  <div className={`p-6 rounded-[2.5rem] flex flex-col gap-6 ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/50'}`}>
                    <div className="flex items-center gap-3 px-2">
                      <Target size={18} className="text-slate-400" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Matriz de Área (M²)</h4>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                       {editingItem?.metadata?.sizes.map(size => (
                         <div key={size} className="flex flex-col gap-2 items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase">{size}</span>
                            <input 
                              type="number"
                              step="0.01"
                              value={editingItem.metadata.sizeAreas?.[size] || ''}
                              onChange={(e) => updateArea(size, Number(e.target.value))}
                              placeholder="0,00"
                              className={`w-full px-2 py-3 rounded-xl font-bold text-xs text-center outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                            />
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            ) : type === 'INFESTO' ? (
              // Specialized Form for Infesto
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 text-center">
                  <div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    <Layers size={32} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                    Configuração de Camadas para<br/>Corte e Produção
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Infesto *</label>
                  <input 
                    type="text"
                    value={editingItem?.name || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Ex: COURO PADRÃO"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Quantidade de Camadas *</label>
                  <input 
                    type="number"
                    value={editingItem?.metadata?.layers || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, layers: Number(e.target.value) } } : null)}
                    placeholder="Ex: 4"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>
              </div>
            ) : type === 'DEADLINE' ? (
              // Specialized Form for Deadline
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 text-center">
                  <div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    <CalendarClock size={32} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                    Definição de Prazos e SLA<br/>para Ordens de Produção
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Prazo *</label>
                  <input 
                    type="text"
                    value={editingItem?.name || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Ex: URGENTE, PADRÃO..."
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Prazo em Dias *</label>
                  <input 
                    type="number"
                    value={editingItem?.metadata?.days || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, days: Number(e.target.value) } } : null)}
                    placeholder="Ex: 7"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>
              </div>
            ) : type === 'PACKAGING' ? (
              // Specialized Form for Packaging/Grades
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 text-center">
                  <div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    <Grid3X3 size={32} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                    Configuração de Grades e<br/>Tamanhos para Embalagens
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Padrão *</label>
                  <input 
                    type="text"
                    value={editingItem?.name || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Ex: FEMININO 33-40"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo de Grade</label>
                  <div className={`flex gap-2 p-1.5 rounded-2xl border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <button 
                      type="button"
                      onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FIXED' } } : null)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(!editingItem?.metadata?.mode || editingItem?.metadata?.mode === 'FIXED') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-500'}`}
                    >
                      Grade Fixa
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FREE' } } : null)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingItem?.metadata?.mode === 'FREE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-500'}`}
                    >
                      Grade Livre
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Capacidade Total (Pares) *</label>
                  <input 
                    type="number"
                    value={editingItem?.metadata?.capacity || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, capacity: Number(e.target.value) } } : null)}
                    placeholder="Ex: 12"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>

                {editingItem?.metadata?.mode === 'FREE' ? null : (
                  /* Grade Fixa mode */
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Adicionar Numerações</label>
                       <div className="flex gap-2">
                          <input 
                            type="text"
                            value={newSize}
                            onChange={(e) => setNewSize(e.target.value)}
                            placeholder="Ex: 37"
                            className={`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
                          />
                          <button 
                            type="button"
                            onClick={addSize}
                            className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                          >
                            <Plus size={24} strokeWidth={3} />
                          </button>
                       </div>

                       <div className="flex flex-wrap gap-2">
                          {(editingItem?.metadata?.sizes || []).map(size => (
                            <div key={size} className={`px-4 py-2 rounded-xl flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                              <span className="text-xs font-black">{size}</span>
                              <button 
                                type="button"
                                onClick={() => removeSize(size)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          {(editingItem?.metadata?.sizes || []).length === 0 && (
                            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mx-auto py-2">Nenhuma numeração</p>
                          )}
                       </div>
                    </div>

                    {/* Quantity Matrix */}
                    {(editingItem?.metadata?.sizes || []).length > 0 && (
                      <div className={`p-6 rounded-[2.5rem] flex flex-col gap-6 ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/50'}`}>
                         <div className="flex items-center justify-between px-2">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distribuição da Grade</h4>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                              Object.values(editingItem?.metadata?.sizeQuantities || {}).reduce((a, b) => a + (Number(b) || 0), 0) === (editingItem?.metadata?.capacity || 0)
                                ? 'text-emerald-500'
                                : 'text-red-500'
                            }`}>
                               Total: {Object.values(editingItem?.metadata?.sizeQuantities || {}).reduce((a, b) => a + (Number(b) || 0), 0)} / {editingItem?.metadata?.capacity || 0}
                            </span>
                         </div>
                         
                         <div className="grid grid-cols-4 gap-4">
                            {editingItem?.metadata?.sizes.map(size => (
                              <div key={size} className="flex flex-col gap-2 items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase">{size}</span>
                                <input 
                                  type="number"
                                  value={editingItem?.metadata?.sizeQuantities?.[size] || ''}
                                  onChange={(e) => {
                                    const qty = Number(e.target.value);
                                    setEditingItem(prev => ({
                                      ...prev!,
                                      metadata: {
                                        ...prev!.metadata,
                                        sizeQuantities: { ...prev!.metadata!.sizeQuantities, [size]: qty }
                                      }
                                    }));
                                  }}
                                  placeholder="0"
                                  className={`w-full px-2 py-3 rounded-xl font-bold text-xs text-center outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                                />
                              </div>
                            ))}
                         </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : type === 'MATERIAL' ? (
              // Specialized Form for Insumos
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Material *</label>
                  <input 
                    type="text"
                    value={editingItem?.name || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Ex: Nobuck Preto"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ref. do Material</label>
                  <input 
                    type="text"
                    value={editingItem?.metadata?.reference || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, reference: e.target.value } } : null)}
                    placeholder="Ex: REF-100"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Categoria Mestre *</label>
                    <select 
                      value={editingItem?.metadata?.masterCategory || ''}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, masterCategory: e.target.value } } : null)}
                      className={`w-full px-4 py-4 rounded-2xl font-bold transition-all outline-none appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                      required
                    >
                      <option value="">Selecione...</option>
                      {MASTER_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Flow Tag (Fluxo) *</label>
                    <select 
                      value={editingItem?.metadata?.flowTagId || ''}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, flowTagId: e.target.value } } : null)}
                      className={`w-full px-4 py-4 rounded-2xl font-bold transition-all outline-none appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                      required
                    >
                      <option value="">Selecione...</option>
                      {flowTags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Fornecedor Padrão</label>
                  <select 
                    value={editingItem?.metadata?.supplierId || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, supplierId: e.target.value } } : null)}
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                  >
                    <option value="">Vincular Fornecedor...</option>
                    {suppliers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Unidade</label>
                    <select 
                      value={editingItem?.metadata?.unit || ''}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, unit: e.target.value } } : null)}
                      className={`w-full px-4 py-4 rounded-2xl font-bold transition-all outline-none appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    >
                      <option value="">Unidade...</option>
                      {units.map(u => <option key={u.id} value={u.name}>{u.name} - {u.description}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Largura (M)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editingItem?.metadata?.width || ''}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, width: Number(e.target.value) } } : null)}
                      placeholder="1.40"
                      className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    />
                  </div>
                </div>

                <div className={`p-6 rounded-[2.5rem] flex flex-col gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'} border-2`}>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Preço Base (R$)</label>
                   <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-slate-400">R$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={editingItem?.metadata?.baseCost || ''}
                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, baseCost: Number(e.target.value) } } : null)}
                        placeholder="0.00"
                        className={`w-full bg-transparent text-2xl font-black outline-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                      />
                   </div>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2">* Alterações neste campo gerarão um registro automático no histórico.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Cores Ativas no Catálogo</label>
                  <div className="flex flex-wrap gap-2 p-2">
                     {colors.map(color => (
                       <button
                         key={color.id}
                         type="button"
                         onClick={() => {
                           const current = editingItem?.metadata?.colorIds || [];
                           const next = current.includes(color.id)
                             ? current.filter(id => id !== color.id)
                             : [...current, color.id];
                           setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, colorIds: next } } : null);
                         }}
                         className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                           (editingItem?.metadata?.colorIds || []).includes(color.id)
                             ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                             : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-500'
                         }`}
                       >
                         {color.name}
                       </button>
                     ))}
                  </div>
                </div>
              </div>
            ) : (
              // Generic Form for other types
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 text-center">
                  <div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    {icon}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                    Preencha os dados abaixo para<br/>registrar em {label}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome / Sigla</label>
                  <input 
                    type="text"
                    value={editingItem?.name || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Ex: UN, KG, MT..."
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Descrição Completa</label>
                  <input 
                    type="text"
                    value={editingItem?.description || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="Ex: Unidade, Quilograma, Metro..."
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
                  />
                </div>
              </div>
            )}
            
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  SALVANDO...
                </>
              ) : (
                <>
                  <Check size={18} strokeWidth={3} />
                  {editingItem?.id ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </>
              )}
            </button>
          </form>
       </Modal>
    </div>
  );
}

function ConfigMenuItem({ icon, label, desc, color, bg, isDarkMode, onClick }: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  bg: string;
  isDarkMode: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`w-full p-4 rounded-[2rem] border-2 flex items-center gap-5 transition-all group ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-800/60 hover:border-indigo-500/30' 
          : 'bg-white border-slate-100/50 shadow-sm hover:border-indigo-100'
      }`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${isDarkMode ? 'bg-slate-800' : bg} ${color}`}>
        {icon}
      </div>
      <div className="text-left flex-1">
        <p className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{label}</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{desc}</p>
      </div>
    </motion.button>
  );
}

function SectorCard({ sector, flowTags, isDarkMode, onEdit, onDelete }: { 
  sector: Sector; 
  flowTags: FlowTag[];
  isDarkMode: boolean; 
  onEdit: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  const sectorTags = flowTags.filter(t => sector.flowTagIds?.includes(t.id));

  return (
    <Reorder.Item 
      value={sector}
      dragListener={false}
      dragControls={controls}
      className={`p-5 rounded-[2.5rem] border flex flex-col gap-4 group transition-shadow ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div 
            onPointerDown={(e) => {
              e.preventDefault();
              controls.start(e);
            }}
            className={`p-3 rounded-2xl cursor-grab active:cursor-grabbing transition-colors select-none touch-none ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-500' : 'bg-slate-50 hover:bg-slate-100 text-slate-400'}`}
          >
            <GripVertical size={18} />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: sector.color }}>
              <Factory size={22} className="text-white" />
            </div>
            <div>
              <h4 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sector.name}</h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Setor de Produção</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onEdit}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
          >
            <Edit3 size={18} />
          </button>
          <button 
            onClick={() => {
              if (confirm(`Deseja excluir o setor ${sector.name}?`)) onDelete();
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-red-400' : 'bg-slate-50 text-slate-400 hover:text-red-500'}`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {sectorTags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/50">
          {sectorTags.map(tag => (
            <div key={tag.id} className={`px-3 py-1.5 rounded-xl flex items-center gap-2 ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Tags size={12} />
              <span className="text-[9px] font-black uppercase tracking-widest">{tag.name}</span>
            </div>
          ))}
        </div>
      )}
    </Reorder.Item>
  );
}

function Modal({ isOpen, onClose, title, children, isDarkMode }: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string;
  children: React.ReactNode;
  isDarkMode: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className={`relative w-full max-w-[400px] rounded-[3.5rem] p-10 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25)] flex flex-col gap-8 max-h-[85vh] overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="flex flex-col items-center text-center gap-2 shrink-0">
              <h3 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <div className="w-12 h-1 bg-indigo-600 rounded-full opacity-20" />
            </div>

            <div className="overflow-y-auto custom-scrollbar px-2 pb-4">
              {children}
            </div>

            <button 
              onClick={onClose}
              className={`absolute top-6 right-6 p-2 rounded-full transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
            >
              <X size={18} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function MaterialCard({ item, isDarkMode, onEdit, onDelete }: { item: ProductionConfigItem, isDarkMode: boolean, onEdit: () => void, onDelete: () => void }) {
  return (
    <div className={`p-6 rounded-[2rem] border flex flex-col gap-6 relative transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.metadata?.reference || 'S/ REF'}</span>
          <h5 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</h5>
          <div className="flex items-center gap-2 mt-1">
            <PackageOpen size={12} className="text-slate-400" />
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.metadata?.flowTagName || 'Fluxo não definido'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"><Edit3 size={16} /></button>
          <button onClick={onDelete} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Custo Base</span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-black text-emerald-500">R$</span>
          <span className="text-xl font-black text-emerald-500">{(item.metadata?.baseCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-2">
           <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest">
             {item.metadata?.masterCategory || 'GERAL'}
           </div>
           <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 text-[8px] font-black uppercase tracking-widest">
             {item.metadata?.unit || 'UN'}
           </div>
        </div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cores: {item.metadata?.colorIds?.length || 0}</span>
      </div>
    </div>
  );
}
