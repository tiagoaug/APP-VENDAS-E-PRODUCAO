import React, { useState, useMemo, useRef, FormEvent, ChangeEvent, ReactNode } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
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
  PackageOpen,
  Grid3X3,
  Search,
  ChevronDown,
  Camera,
  Target,
  Loader2,
  Users,
  Scale,
  Palette,
  Circle,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  TableCellsMerge,
  GanttChartSquare,
  Hammer,
  ClipboardList,
  FileText,
  ArrowUpDown,
  Calculator,
  Wand2,
  Sparkles,
  RefreshCw,
  Settings
} from 'lucide-react';
import { FlowTag, Sector, ProductionConfigItem, Person, ColorValue, Grid, GridType, CategoryType, ProductionScreenType, ViewType } from '../types';
import Modal from '../components/Modal';
import ConfigMenuItem from '../components/ConfigMenuItem';
import CalculatorModal from '../components/CalculatorModal';

const AreaInput = ({ size, value, onChange, isDarkMode, onShowCalc }: any) => {
  const [localValue, setLocalValue] = React.useState(
    value !== undefined && value !== null
      ? Number(value).toFixed(4).replace('.', ',')
      : ''
  );

  React.useEffect(() => {
    if (value !== undefined && value !== null) {
      const formatted = Number(value).toFixed(4).replace('.', ',');
      if (parseFloat(localValue.replace(',', '.')) !== Number(value)) {
        setLocalValue(formatted);
      }
    } else {
      setLocalValue('');
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="flex items-center justify-between w-full px-1">
        <label htmlFor={`area-input-${size}`} className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{size}</label>
        {onShowCalc && (
          <button
            type="button"
            onClick={() => onShowCalc(parseFloat(localValue.replace(',', '.')) || 0, (val: number) => {
              setLocalValue(val.toFixed(4).replace('.', ','));
              onChange(val);
            })}
            className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
          >
            <Calculator size={10} />
          </button>
        )}
      </div>
      <input
        id={`area-input-${size}`}
        type="text"
        value={localValue}
        onChange={(e) => {
          const val = e.target.value.replace('.', ',');
          setLocalValue(val);
          const numericVal = parseFloat(val.replace(',', '.'));
          if (!isNaN(numericVal)) {
            onChange(numericVal);
          } else if (val === '') {
            onChange(0);
          }
        }}
        onBlur={() => {
          if (localValue !== '') {
            const num = parseFloat(localValue.replace(',', '.'));
            if (!isNaN(num)) {
              setLocalValue(num.toFixed(4).replace('.', ','));
            }
          }
        }}
        placeholder="0,0000"
        className={`w-full px-2 py-3 rounded-xl font-bold text-xs text-center outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
      />
    </div>
  );
};

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
  grids?: Grid[];
  categories?: any[];
  initialScreen?: ProductionScreenType;
  onNavigate?: (view: ViewType) => void;
  onAddProduct?: () => void;
  onNavigateGrids?: () => void;
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

// ProductionScreenType moved to types.ts

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
  isDarkMode,
  people = [],
  colors = [],
  grids = [],
  categories = [],
  initialScreen = 'MENU',
  onNavigate,
  onAddProduct,
  onNavigateGrids
}: ProductionConfigViewProps) {
  const [currentScreen, setCurrentScreen] = useState<ProductionScreenType>(initialScreen);

  const handleNavigateShortcut = (screen: ProductionScreenType | ViewType) => {
    if (Object.values(ViewType).includes(screen as ViewType)) {
      onNavigate?.(screen as ViewType);
    } else {
      setCurrentScreen(screen as ProductionScreenType);
    }
  };

  // Sincronizar tela inicial quando alterada via prop
  React.useEffect(() => {
    if (initialScreen && initialScreen !== currentScreen) {
      setCurrentScreen(initialScreen);
    }
  }, [initialScreen]);

  const supplyCategoryNames = useMemo(() => {
    const fromSystem = categories
      .filter(c => c.type === CategoryType.SUPPLY)
      .map(c => c.name.toUpperCase());

    if (fromSystem.length > 0) return fromSystem;
    // Fallback if no categories defined in system yet
    return ['SOLADOS', 'PALMILHAS', 'COURO/SINTÉTICO', 'FORROS', 'ADESIVOS', 'LINHAS', 'EMBALAGENS', 'OUTROS'];
  }, [categories]);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex-1 overflow-y-auto pb-32 custom-scrollbar">
        <AnimatePresence mode="wait">
          {currentScreen === 'MENU' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-col gap-8 pb-10">
                {/* CARD: GESTÃO DE PROCESSOS */}
                <div className="flex flex-col gap-3">
                  <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Gestão de Processos</h3>
                  <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <ConfigMenuItem
                      icon={<TableCellsMerge size={22} />}
                      label="Setores de Produção"
                      desc="Fluxo da fábrica"
                      onClick={() => setCurrentScreen('SECTORS')}
                      color="text-indigo-600"
                      bg="bg-indigo-50"
                      isDarkMode={isDarkMode}
                    />
                    <ConfigMenuItem
                      icon={<Tags size={22} />}
                      label="Etapas e Processos"
                      desc="Serviços e Flow Tags"
                      onClick={() => setCurrentScreen('FLOW_TAGS')}
                      color="text-emerald-600"
                      bg="bg-emerald-50"
                      isDarkMode={isDarkMode}
                    />
                    <ConfigMenuItem
                      icon={<CalendarClock size={24} />}
                      label="Prazos de Entrega"
                      desc="SLA por processo"
                      color="text-teal-600"
                      bg="bg-teal-50"
                      isDarkMode={isDarkMode}
                      onClick={() => setCurrentScreen('PRAZOS')}
                      isLast={true}
                    />
                  </div>
                </div>

                {/* CARD: PARÂMETROS DE MODELAGEM (Same as Dashboard) */}
                <div className="flex flex-col gap-3">
                  <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Parâmetros de Modelagem</h3>
                  <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <ConfigMenuItem
                      icon={<Package size={22} />}
                      label="Produtos Cadastrados"
                      desc="Catálogo técnico completo"
                      onClick={() => onNavigate?.(ViewType.PRODUCTS)}
                      color="text-indigo-600"
                      bg="bg-indigo-50"
                      isDarkMode={isDarkMode}
                    />
                    <ConfigMenuItem
                      icon={<Plus size={22} />}
                      label="Cadastrar Novo Modelo"
                      desc="Solados, Cores e Materiais"
                      onClick={() => onAddProduct?.()}
                      color="text-emerald-600"
                      bg="bg-emerald-50"
                      isDarkMode={isDarkMode}
                    />
                    <ConfigMenuItem
                      icon={<Grid3X3 size={22} />}
                      label="Grades de Produção"
                      desc="Tamanhos e configurações"
                      onClick={() => onNavigateGrids?.()}
                      color="text-violet-600"
                      bg="bg-violet-50"
                      isDarkMode={isDarkMode}
                    />
                    <ConfigMenuItem
                      icon={<Footprints size={24} />}
                      label="Matrizes de Solados"
                      desc="Catálogo e moldes"
                      color="text-orange-600"
                      bg="bg-orange-50"
                      isDarkMode={isDarkMode}
                      onClick={() => setCurrentScreen('MATRIZES')}
                    />
                    <ConfigMenuItem
                      icon={<Layers size={24} />}
                      label="Materiais e Insumos"
                      desc="Componentes de produção"
                      color="text-blue-600"
                      bg="bg-blue-50"
                      isDarkMode={isDarkMode}
                      onClick={() => setCurrentScreen('INSUMOS')}
                      isLast={true}
                    />
                  </div>
                </div>

                {/* CARD: ESTRUTURA E LOGÍSTICA */}
                <div className="flex flex-col gap-3">
                  <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Estrutura e Logística</h3>
                  <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <ConfigMenuItem
                      icon={<GanttChartSquare size={22} />}
                      label="Unidades de Medida"
                      desc="KG, MT, UN, PR..."
                      onClick={() => setCurrentScreen('UNIDADES')}
                      color="text-slate-600"
                      isDarkMode={isDarkMode}
                    />
                    <ConfigMenuItem
                      icon={<Scissors size={24} />}
                      label="Facas de Corte"
                      desc="Matrizes de corte"
                      color="text-rose-600"
                      bg="bg-rose-50"
                      isDarkMode={isDarkMode}
                      onClick={() => setCurrentScreen('FACAS')}
                    />
                    <ConfigMenuItem
                      icon={<Box size={24} />}
                      label="Infesto"
                      desc="Camadas de tecido"
                      color="text-sky-600"
                      bg="bg-sky-50"
                      isDarkMode={isDarkMode}
                      onClick={() => setCurrentScreen('INFESTO')}
                    />
                    <ConfigMenuItem
                      icon={<PackageOpen size={24} />}
                      label="Padrão Embalagens"
                      desc="Caixas e grades"
                      color="text-amber-600"
                      bg="bg-amber-50"
                      isDarkMode={isDarkMode}
                      onClick={() => setCurrentScreen('EMBALAGENS')}
                      isLast={true}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}



        </AnimatePresence>
      </div>

      {/* Modals for RAMIFICAÇÕES (Sub-screens) */}
      <Modal
        isOpen={currentScreen === 'SECTORS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Setores de Produção"
      >
        <div className="flex flex-col gap-6">
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
              title="Adicionar Setor"
              aria-label="Adicionar novo setor de produção"
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
        </div>
      </Modal>

      <Modal
        isOpen={currentScreen === 'FLOW_TAGS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Etapas e Processos"
      >
        <div className="flex flex-col gap-6">
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
              title="Adicionar Flow Tag"
              aria-label="Adicionar nova flow tag de processo"
              className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Plus size={24} strokeWidth={3} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {flowTags.map((tag) => (
              <div
                key={tag.id}
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
                    title="Editar Tag"
                    aria-label={`Editar flow tag ${tag.name}`}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Deseja excluir esta Flow Tag?')) onDeleteFlowTag(tag.id);
                    }}
                    title="Excluir Tag"
                    aria-label={`Excluir flow tag ${tag.name}`}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-red-400' : 'bg-slate-50 text-slate-400 hover:text-red-500'}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
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
        </div>
      </Modal>

      <Modal
        isOpen={currentScreen === 'UNIDADES'}
        onClose={() => setCurrentScreen('MENU')}
        title="Unidades de Medida"
      >
        <GenericConfigList
          title="Unidades"
          label="UNIDADES"
          items={productionConfigs}
          type="UNIT"
          icon={<Ruler size={22} />}
          isDarkMode={isDarkMode}
          onSave={onSaveConfigItem}
          onDelete={onDeleteConfigItem}
          onBack={() => setCurrentScreen('MENU')}
          placeholderLabel="Nenhuma unidade cadastrada"
          seedDefaults={DEFAULT_UNITS}
          productionConfigs={productionConfigs}
          people={people}
          onNavigateToScreen={handleNavigateShortcut}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'FACAS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Facas de Corte"
      >
        <GenericConfigList
          title="Facas de Corte"
          label="FACAS"
          items={productionConfigs}
          type="TOOL"
          icon={<Scissors size={22} />}
          isDarkMode={isDarkMode}
          onSave={onSaveConfigItem}
          onDelete={onDeleteConfigItem}
          onBack={() => setCurrentScreen('MENU')}
          placeholderLabel="Nenhuma faca cadastrada"
          productionConfigs={productionConfigs}
          people={people}
          grids={grids}
          onNavigateToScreen={handleNavigateShortcut}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'INFESTO'}
        onClose={() => setCurrentScreen('MENU')}
        title="Configuração de Infestos"
      >
        <GenericConfigList title="Infesto" label="INFESTO" items={productionConfigs} type="INFESTO" icon={<Layers size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} onBack={() => setCurrentScreen('MENU')} placeholderLabel="Nenhum registro de infesto" onNavigateToScreen={handleNavigateShortcut} />
      </Modal>

      <Modal
        isOpen={currentScreen === 'PRAZOS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Prazos Padrão"
      >
        <GenericConfigList title="Prazos" label="PRAZOS" items={productionConfigs} type="DEADLINE" icon={<CalendarClock size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} onBack={() => setCurrentScreen('MENU')} placeholderLabel="Nenhum prazo cadastrado" onNavigateToScreen={handleNavigateShortcut} />
      </Modal>

      <Modal
        isOpen={currentScreen === 'FICHAS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Fichas Técnicas"
      >
        <GenericConfigList title="Fichas Técnicas" label="FICHAS TÉCNICAS" items={productionConfigs} type="TECH_SHEET" icon={<Footprints size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} onBack={() => setCurrentScreen('MENU')} placeholderLabel="Nenhuma ficha técnica" onNavigateToScreen={handleNavigateShortcut} />
      </Modal>

      <Modal
        isOpen={currentScreen === 'EMBALAGENS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Padrão de Embalagens"
      >
        <GenericConfigList
          title="Padrão de Embalagens"
          label="PADRÃO EMBALAGENS"
          items={productionConfigs}
          type="PACKAGING"
          icon={<Grid3X3 size={22} />}
          isDarkMode={isDarkMode}
          onSave={onSaveConfigItem}
          onDelete={onDeleteConfigItem}
          onBack={() => setCurrentScreen('MENU')}
          placeholderLabel="Nenhum padrão de embalagem"
          productionConfigs={productionConfigs}
          people={people}
          grids={grids}
          onNavigateToScreen={handleNavigateShortcut}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'INSUMOS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Catálogo de Insumos"
      >
        <GenericConfigList
          title="Insumos"
          label="INSUMOS"
          items={productionConfigs}
          type="MATERIAL"
          icon={<Package size={22} />}
          isDarkMode={isDarkMode}
          onSave={onSaveConfigItem}
          onDelete={onDeleteConfigItem}
          onBack={() => setCurrentScreen('MENU')}
          placeholderLabel="Nenhum insumo cadastrado"
          productionConfigs={productionConfigs}
          people={people}
          supplyCategoryNames={supplyCategoryNames}
          colors={colors}
          flowTags={flowTags}
          onNavigateToScreen={handleNavigateShortcut}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'MATRIZES'}
        onClose={() => setCurrentScreen('MENU')}
        title="Matrizes Sola"
      >
        <GenericConfigList
          title="Matrizes Sola"
          label="MATRIZES SOLA"
          items={productionConfigs}
          type="MOLD"
          icon={<Grid3X3 size={22} />}
          isDarkMode={isDarkMode}
          onSave={onSaveConfigItem}
          onDelete={onDeleteConfigItem}
          onBack={() => setCurrentScreen('MENU')}
          placeholderLabel="Nenhuma matriz cadastrada"
          people={people}
          colors={colors}
          grids={grids}
          flowTags={flowTags}
          productionConfigs={productionConfigs}
          onNavigateToScreen={handleNavigateShortcut}
        />
      </Modal>

      {currentScreen === 'MENU' && (
        <div className="mt-8 flex justify-center px-4">
          <button
            onClick={onBack}
            title="Voltar ao Início"
            aria-label="Voltar para a tela inicial do dashboard"
            className={`flex items-center justify-center gap-3 px-8 py-5 rounded-[2rem] w-full transition-all shadow-lg active:scale-[0.98] ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}
          >
            <ArrowLeft size={18} strokeWidth={3} />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Voltar ao Início</span>
          </button>
        </div>
      )}

      {/* Modals for Tags and Sectors */}
      <Modal
        isOpen={!!editingTag}
        onClose={() => setEditingTag(null)}
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
                title="Adicionar Subcategoria"
                aria-label="Adicionar nova subcategoria de serviço"
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
                    title="Remover Subcategoria"
                    aria-label="Remover esta subcategoria de serviço"
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
                    className={`p-4 rounded-2xl border-2 flex flex-col gap-2 transition-all text-left ${isSelected
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
  onBack,
  placeholderLabel,
  seedDefaults,
  people = [],
  colors = [],
  flowTags = [],
  productionConfigs = [],
  grids = [],
  supplyCategoryNames = [],
  onNavigateToScreen
}: {
  title: string;
  label: string;
  items: ProductionConfigItem[];
  type: ProductionConfigItem['type'];
  icon: ReactNode;
  isDarkMode: boolean;
  onSave: (item: ProductionConfigItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack?: () => void;
  placeholderLabel: string;
  seedDefaults?: { name: string; description: string }[];
  people?: Person[];
  colors?: ColorValue[];
  flowTags?: FlowTag[];
  productionConfigs?: ProductionConfigItem[];
  grids?: Grid[];
  supplyCategoryNames?: string[];
  onNavigateToScreen?: (screen: ProductionScreenType | ViewType) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionConfigItem | null>(null);
  const [search, setSearch] = useState('');
  const [newSize, setNewSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
  const [activeCalc, setActiveCalc] = useState<{
    initialValue: number;
    onResult: (val: number) => void;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateCode = () => {
    if (!editingItem) return;

    // Get existing codes for this type
    const existingCodes = items
      .filter(item => item.type === type && item.id !== editingItem.id)
      .map(item => (item.metadata?.reference || item.metadata?.moldReference || '').toUpperCase().trim())
      .filter(code => code !== '');

    let prefix = 'REF';
    if (type === 'MATERIAL') prefix = 'MAT';
    if (type === 'MOLD') prefix = 'MOD';
    if (type === 'TOOL') prefix = 'FAC';
    if (type === 'PACKAGING') prefix = 'EMB';

    let counter = 1;
    let newCode = `${prefix}-${counter.toString().padStart(3, '0')}`;

    while (existingCodes.includes(newCode)) {
      counter++;
      newCode = `${prefix}-${counter.toString().padStart(3, '0')}`;
    }

    setEditingItem(prev => {
      if (!prev) return null;
      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          reference: newCode,
          moldReference: newCode // Mantendo para compatibilidade
        }
      };
    });
  };

  const { totalWeightLive, yieldLive } = useMemo(() => {
    if (!editingItem?.metadata?.sizeWeights) return { totalWeightLive: 0, yieldLive: 0 };
    const weights = Object.values(editingItem?.metadata?.sizeWeights || {}) as number[];
    const activeWeights = weights.filter(w => w > 0);
    const total = activeWeights.reduce((a, b) => a + b, 0);
    const yld = total > 0 ? 1000 / total : 0;
    return { totalWeightLive: total, yieldLive: yld };
  }, [editingItem?.metadata?.sizeWeights]);

  const units = useMemo(() => productionConfigs.filter(c => c.type === 'UNIT'), [productionConfigs]);
  const suppliers = useMemo(() => people.filter(p => p.isSupplier), [people]);

  const filteredItems = useMemo(() => {
    return items
      .filter(item => item.type === type)
      .filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.metadata?.reference || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
      );
  }, [items, type, search]);

  const groupedItems = useMemo<Record<string, ProductionConfigItem[]> | null>(() => {
    if (type !== 'MATERIAL') return null;
    const groups: Record<string, ProductionConfigItem[]> = {};
    filteredItems.forEach(item => {
      const cat = ((item as any).metadata?.masterCategory || 'OUTROS').trim().toUpperCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems, type]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem || isLoading) return;

    // Validation for duplicate codes
    const currentCode = (editingItem.metadata?.reference || '').toUpperCase().trim();
    if (currentCode) {
      const isDuplicate = items.some(item =>
        item.type === type &&
        item.id !== editingItem.id &&
        (item.metadata?.reference || '').toUpperCase().trim() === currentCode
      );
      if (isDuplicate) {
        alert(`O código "${currentCode}" já está sendo usado em outro item deste tipo.`);
        return;
      }
    }

    // Validar metadados para Facas
    if (type === 'TOOL') {
      const conjugation = editingItem.metadata?.conjugation || 1;
      if (conjugation < 1) {
        alert('A conjugação deve ser pelo menos 1');
        return;
      }
    }

    // Validation for Packaging Grade
    if (type === 'PACKAGING' && (editingItem as any).metadata?.mode !== 'FREE') {
      const sizeQuantities = (editingItem as any).metadata?.sizeQuantities || {};
      const totalDist = Object.values(sizeQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
      const capacity = Number((editingItem as any).metadata?.capacity || 0);

      if (totalDist !== capacity) {
        alert(`A soma das quantidades (${totalDist}) deve ser exatamente igual à capacidade da embalagem (${capacity}).`);
        return;
      }
    }

    setIsLoading(true);
    try {
      await onSave(editingItem);
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
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

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
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
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setEditingItem(prev => prev ? { ...prev, imageUrl: compressedBase64 } : null);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const renderLabelWithShortcut = (id: string, text: string, screen?: ProductionScreenType | ViewType, required: boolean = false) => (
    <div className="flex items-center justify-between ml-2">
      <label htmlFor={id} className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
        {text} {required && '*'}
      </label>
      {screen && onNavigateToScreen && (
        <button
          type="button"
          onClick={() => {
            if (confirm(`Deseja sair da edição atual para configurar ${text}? Salve suas alterações primeiro!`)) {
              onNavigateToScreen(screen);
            }
          }}
          className="p-1 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-all"
          title={`Configurar ${text}`}
        >
          <Settings size={10} />
        </button>
      )}
    </div>
  );

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
          sizeAreas: { ...(currentMetadata.sizeAreas || {}), [newSize]: 0 },
          sizeWeights: { ...(currentMetadata.sizeWeights || {}), [newSize]: 0 },
          sizeQuantities: { ...(currentMetadata.sizeQuantities || {}), [newSize]: 0 }
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
    const newWeights = { ...(currentMetadata.sizeWeights || {}) };
    const newQtys = { ...(currentMetadata.sizeQuantities || {}) };
    delete newAreas[size];
    delete newWeights[size];
    delete newQtys[size];
    setEditingItem({
      ...editingItem,
      metadata: { ...currentMetadata, sizes: newSizes, sizeAreas: newAreas, sizeWeights: newWeights, sizeQuantities: newQtys }
    });
  };

  const updateArea = (size: string, area: number | string) => {
    if (!editingItem) return;
    const currentMetadata = editingItem.metadata || { conjugation: 1, sizes: [], sizeAreas: {} };
    const numArea = typeof area === 'string' ? parseFloat(area.replace(',', '.')) || 0 : area;

    setEditingItem({
      ...editingItem,
      metadata: {
        ...currentMetadata,
        sizeAreas: { ...(editingItem.metadata?.sizeAreas || {}), [size]: numArea }
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className={`p-6 rounded-[3rem] shadow-xl flex flex-col gap-5 relative overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-slate-700'}`}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              {icon}
            </div>
            <span className={`text-sm font-black uppercase tracking-[0.15em] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{label}</span>
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
              metadata: type === 'TOOL' ? { conjugation: 1, sizes: [], sizeAreas: {} } :
                type === 'MOLD' ? { moldReference: '', sizes: [], sizeWeights: {}, composition: [], colorVariations: [], extraServices: [] } :
                  type === 'MATERIAL' ? { masterCategory: '', reference: '', unitId: '', baseCost: 0, width: 0, colorIds: [], flowTagId: '', supplierId: '' } :
                    type === 'PACKAGING' ? { mode: 'FIXED', capacity: 0, sizes: [], sizeQuantities: {} } :
                      undefined
            });
            setIsModalOpen(true);
          }}
          className={`w-full py-4 px-6 rounded-[2rem] flex items-center gap-4 transition-all shadow-lg active:scale-[0.98] ${isDarkMode ? 'bg-indigo-600 text-white shadow-indigo-900/40' : 'bg-indigo-600 text-white shadow-indigo-200/80'
            }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Plus size={20} strokeWidth={3} />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-black uppercase tracking-[0.15em] leading-none">Adicionar Novo Registro</span>
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 mt-1">Cadastrar em {label}</span>
          </div>
        </button>
      </div>

      <div className="relative group">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500">
          <Search size={20} />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`BUSCAR EM ${label}...`}
          className={`w-full pl-14 pr-6 py-5 rounded-3xl font-black text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-50 text-slate-900 focus:border-indigo-100 placeholder:text-slate-300'
            }`}
        />
      </div>

      <div className="flex flex-col gap-8">
        {type === 'MATERIAL' ? (
          Object.entries(groupedItems || {}).map(([category, catItems]: [string, ProductionConfigItem[]]) => (
            <div key={category} className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white border border-slate-100 shadow-sm text-slate-500'}`}>
                  <Tags size={18} />
                </div>
                <div>
                  <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{category}</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">{catItems.length} ITENS CADASTRADOS</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {catItems.map(item => (
                  <MaterialCard
                    key={item.id}
                    item={item}
                    isDarkMode={isDarkMode}
                    onEdit={() => { setEditingItem({ ...item }); setIsModalOpen(true); }}
                    onDelete={() => { if (confirm(`Deseja excluir ${item.name}?`)) onDelete(item.id); }}
                    flowTags={flowTags}
                    people={people}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          filteredItems.map((item) => (
            type === 'MOLD' ? (
              <SoleMatrixCard
                key={item.id}
                item={item}
                isDarkMode={isDarkMode}
                onEdit={() => { setEditingItem({ ...item }); setIsModalOpen(true); }}
                onDelete={() => { if (confirm(`Deseja excluir ${item.name}?`)) onDelete(item.id); }}
                flowTags={flowTags}
                colors={colors}
                productionConfigs={productionConfigs}
              />
            ) : (
              <motion.div
                key={item.id}
                layout
                className={`p-4 rounded-[1.5rem] border flex items-center justify-between group transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}
              >
                <div className="flex items-center gap-5 flex-1">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-slate-50 text-slate-400'}`}>
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : icon}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</p>
                    {type === 'TOOL' ? (
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">CONSUMO P/ ÁREA • {item.metadata?.conjugation || 1} PR/BAT</p>
                    ) : type === 'INFESTO' ? (
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.metadata?.layers || 0} CAMADAS</p>
                    ) : type === 'DEADLINE' ? (
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.metadata?.days || 0} DIAS</p>
                    ) : type === 'PACKAGING' ? (
                      <div className="flex flex-col gap-3 mt-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.metadata?.capacity || 0} PARES {item.metadata?.mode !== 'FREE' && `• ${(item.metadata?.sizes || []).length} TAMANHOS`}</p>
                        {item.metadata?.mode !== 'FREE' && (item.metadata?.sizes || []).length > 0 && (
                          <div className={`p-3 rounded-2xl flex flex-wrap gap-x-4 gap-y-2 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
                            {(item.metadata?.sizes || []).map((size: string) => (
                              <div key={size} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-slate-400">{size}</span>
                                <span className={`text-[10px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.metadata?.sizeQuantities?.[size] || 0}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : item.description ? (
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.description}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 pr-4">
                  <button
                    onClick={() => { setEditingItem({ ...item }); setIsModalOpen(true); }}
                    title="Editar item"
                    aria-label={`Editar ${item.name}`}
                    className={`p-2 rounded-full transition-all ${isDarkMode ? 'text-slate-600 hover:text-white' : 'text-slate-200 hover:text-slate-400'}`}
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Deseja excluir ${item.name}?`)) onDelete(item.id); }}
                    title="Excluir item"
                    aria-label={`Excluir ${item.name}`}
                    className={`p-2 rounded-full transition-all ${isDarkMode ? 'text-slate-600 hover:text-red-400' : 'text-slate-200 hover:text-red-400'}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            )
          ))
        )}

        {filteredItems.length === 0 && search === '' && seedDefaults && (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lista vazia</p>
            <button onClick={handleSeed} className="px-6 py-3 rounded-2xl bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">Carregar Unidades Padrão</button>
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className={`p-12 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center text-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300">{icon}</div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{search ? 'Nenhum resultado encontrado' : placeholderLabel}</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Editar / Cadastrar`}>
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {type === 'MOLD' ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="mold-reference" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Referência *</label>
                  <div className="relative group">
                    <input id="mold-reference" type="text" value={editingItem?.metadata?.reference || editingItem?.metadata?.moldReference || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, reference: e.target.value.toUpperCase(), moldReference: e.target.value.toUpperCase() } } : null)} required title="Referência da Matriz" placeholder="EX: REF-01" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                    <button
                      type="button"
                      onClick={generateCode}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                      title="Gerar Código Automático"
                    >
                      <Wand2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="col-span-2 flex flex-col gap-2">
                  <label htmlFor="mold-name" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Nome da Matriz *</label>
                  <input id="mold-name" type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)} required title="Nome da Matriz" placeholder="NOME DA MATRIZ" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mold-category', 'Categoria', ViewType.CATEGORIES)}
                  <select id="mold-category" value={editingItem?.metadata?.category || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: e.target.value } } : null)} title="Selecionar Categoria" className={`w-full px-4 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">GERAL</option><option value="SOLADO">SOLADO</option><option value="SALTO">SALTO</option><option value="PALMILHA">PALMILHA</option></select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="mold-price" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Preço do Material / KG (R$)</label>
                  <div className="relative group">
                    <input id="mold-price" type="number" step="0.01" value={editingItem?.metadata?.price || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, price: parseFloat(e.target.value) } } : null)} title="Preço por KG" placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                    <button
                      type="button"
                      onClick={() => setActiveCalc({
                        initialValue: editingItem?.metadata?.price || 0,
                        onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, price: val } } : null)
                      })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
                    >
                      <Calculator size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {renderLabelWithShortcut('mold-flowtag', 'Estágio do Fluxo / Setor', 'FLOW_TAGS')}
                <div className="relative">
                  <select id="mold-flowtag" value={editingItem?.metadata?.flowTagId || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, flowTagId: e.target.value } } : null)} title="Selecionar Estágio" className={`w-full px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] outline-none border-2 transition-all appearance-none cursor-pointer ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}><option value="">SELECIONE O ESTÁGIO...</option>{flowTags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>
              <div className={`p-6 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Scale size={18} className="text-indigo-500" /><span className="text-xs font-black uppercase tracking-widest text-slate-500">Pesos por Tamanho (GR)</span></div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWeightsModalOpen(true)}
                  className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] mb-2 border-2 ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-900/40' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <ArrowUpDown size={20} />
                    <div className="text-left">
                      <span className="text-xs font-black uppercase tracking-widest block">Cadastrar Pesos por Tamanho</span>
                      <span className="text-xs font-bold uppercase tracking-widest opacity-70">Ajuste de consumo por numeração</span>
                    </div>
                  </div>
                  <ChevronRight size={18} />
                </button>

                <Modal
                  isOpen={isWeightsModalOpen}
                  onClose={() => setIsWeightsModalOpen(false)}
                  title="Pesos por Tamanho (GR)"
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/30">
                      <div className="flex items-center gap-2">
                        {renderLabelWithShortcut('mold-pull-grid', 'Puxar Grade', ViewType.GRIDS)}
                      </div>
                      <select id="mold-pull-grid" title="Selecionar Grade" onChange={(e) => { const gridId = e.target.value; const grid = grids.find(g => g.id === gridId); if (grid) { const weights: Record<string, number> = {}; grid.sizes.forEach(s => { weights[s] = editingItem?.metadata?.sizeWeights?.[s] || 0; }); setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, sizeWeights: weights, sizes: grid.sizes } } : null); } }} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-600'}`}><option value="">Selecionar...</option>{grids.filter(g => g.type === GridType.SOLADO || !g.type).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                      {Object.entries(editingItem?.metadata?.sizeWeights || {}).map(([size, weight]) => (
                        <div key={size} className={`flex items-center justify-between p-3 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'}`}>
                          <label htmlFor={`weight-${size}`} className="text-xs font-black text-slate-600 dark:text-slate-300 w-24 ml-2">TAM {size}</label>
                          <div className="relative flex-1 max-w-[150px] group">
                            <input
                              id={`weight-${size}`}
                              type="number"
                              value={weight as number || ''}
                              title={`Peso para tamanho ${size}`}
                              placeholder="0"
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setEditingItem(prev => {
                                  if (!prev) return null;
                                  const newWeights = { ...(prev.metadata?.sizeWeights || {}) };
                                  newWeights[size] = val;
                                  return { ...prev, metadata: { ...prev.metadata, sizeWeights: newWeights } };
                                });
                              }}
                              className={`w-full px-4 py-3 rounded-xl font-black text-xs text-right pr-16 outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                            />
                            <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              <span className="text-[8px] font-black text-slate-400">GR</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveCalc({
                                initialValue: weight as number || 0,
                                onResult: (val) => setEditingItem(prev => {
                                  if (!prev) return null;
                                  const newWeights = { ...(prev.metadata?.sizeWeights || {}) };
                                  newWeights[size] = val;
                                  return { ...prev, metadata: { ...prev.metadata, sizeWeights: newWeights } };
                                })
                              })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all"
                            >
                              <Calculator size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Modal>

                <div className="flex items-center justify-between mt-4 pt-6 border-t-2 border-dashed border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Peso da Grade (Soma GR)</label>
                    <div className="relative group">
                      <input
                        type="number"
                        step="0.01"
                        value={editingItem?.metadata?.totalWeight || (totalWeightLive > 0 ? totalWeightLive.toFixed(2) : '')}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, totalWeight: val } } : null);
                        }}
                        placeholder={totalWeightLive > 0 ? totalWeightLive.toFixed(2) : "0.00"}
                        className={`w-40 px-4 py-3 rounded-xl font-black text-xs outline-none border-2 pr-12 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setActiveCalc({
                          initialValue: editingItem?.metadata?.totalWeight || totalWeightLive || 0,
                          onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, totalWeight: val } } : null)
                        })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all"
                      >
                        <Calculator size={14} />
                      </button>
                    </div>
                    {totalWeightLive > 0 && (
                      <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1 ml-1">
                        Soma Calculada: {totalWeightLive.toFixed(2)}g
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rendimento por KG</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {(editingItem?.metadata?.totalWeight || totalWeightLive) > 0 ? (1000 / (editingItem?.metadata?.totalWeight || totalWeightLive)).toFixed(2) : '0.00'}
                      </span>
                      <span className="text-xs font-black text-slate-400 uppercase">PRS / KG</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      1.000g ÷ Soma ({(editingItem?.metadata?.totalWeight || totalWeightLive).toFixed(0)}g)
                    </p>
                  </div>
                </div>
              </div>
              <div className={`p-6 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col gap-1"><div className="flex items-center gap-2"><Layers size={18} className="text-indigo-500" /><span className="text-xs font-black uppercase tracking-widest text-slate-500">Composição de Materiais</span></div><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Defina o consumo de insumos</span></div>
                  <button
                    type="button"
                    onClick={() => { const currentComposition = editingItem?.metadata?.composition || []; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: [...currentComposition, { materialId: '', quantity: 0, type: 'weight' }] } } : null); }}
                    title="Adicionar Material"
                    aria-label="Adicionar novo material à composição"
                    className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {(editingItem?.metadata?.composition || []).map((item: any, index: number) => (
                    <div key={index} className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3 p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <div className="col-span-6 flex flex-col gap-1"><label htmlFor={`material-${index}`} className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1">Insumo / Material</label><select id={`material-${index}`} value={item.materialId} title="Selecionar Insumo" onChange={(e) => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], materialId: e.target.value }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); }} className={`w-full px-3 py-3 rounded-xl font-bold text-xs uppercase outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-100'}`}><option value="">SELECIONE...</option>{productionConfigs.filter(c => c.type === 'MATERIAL').map(mat => <option key={mat.id} value={mat.id}>{mat.name}</option>)}</select></div>
                      <div className="col-span-3 flex flex-col gap-1"><label htmlFor={`qty-${index}`} className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1">Quant / %</label><div className="relative group"><input id={`qty-${index}`} type="number" step="0.001" value={item.quantity || ''} title="Quantidade" placeholder="0,000" onChange={(e) => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], quantity: parseFloat(e.target.value) }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); }} className={`w-full px-3 py-3 rounded-xl font-black text-[10px] text-center outline-none border-2 pr-10 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-600'}`} /><button type="button" onClick={() => setActiveCalc({ initialValue: item.quantity || 0, onResult: (val) => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], quantity: val }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); } })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all"><Calculator size={12} /></button></div></div>
                      <div className="col-span-2 flex flex-col gap-1"><label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1">Tipo</label><button type="button" title="Alternar Tipo" aria-label="Alternar entre peso e porcentagem" onClick={() => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], type: item.type === 'weight' ? 'percentage' : 'weight' }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); }} className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all ${item.type === 'percentage' ? 'bg-amber-500 border-amber-600 text-white' : 'bg-indigo-500 border-indigo-600 text-white'}`}>{item.type === 'percentage' ? '%' : 'GR'}</button></div>
                      <div className="col-span-1 flex items-end pb-1"><button type="button" title="Remover Insumo" aria-label="Remover este insumo da composição" onClick={() => { const newComp = (editingItem?.metadata?.composition || []).filter((_: any, i: number) => i !== index); setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); }} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"><Trash2 size={16} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`p-6 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col gap-1"><div className="flex items-center gap-2"><Hammer size={18} className="text-emerald-500" /><span className="text-xs font-black uppercase tracking-widest text-slate-500">Serviços Agregados</span></div><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mão de obra ou processos terceirizados</span></div>
                  <button
                    type="button"
                    onClick={() => { const currentServices = editingItem?.metadata?.extraServices || []; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: [...currentServices, { name: '', cost: 0 }] } } : null); }}
                    title="Adicionar Serviço"
                    aria-label="Adicionar novo serviço agregado"
                    className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {(editingItem?.metadata?.extraServices || []).map((service: any, index: number) => (
                    <div key={index} className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3 p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <div className="col-span-7 flex flex-col gap-1"><label htmlFor={`service-name-${index}`} className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Nome do Serviço</label><input id={`service-name-${index}`} type="text" value={service.name} title="Nome do Serviço" onChange={(e) => { const newServices = [...(editingItem?.metadata?.extraServices || [])]; newServices[index] = { ...newServices[index], name: e.target.value.toUpperCase() }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); }} placeholder="EX: PINTURA" className={`w-full px-4 py-3 rounded-xl font-bold text-xs uppercase outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-emerald-600'}`} /></div>
                      <div className="col-span-4 flex flex-col gap-1"><label htmlFor={`service-cost-${index}`} className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Valor (R$)</label><div className="relative group"><input id={`service-cost-${index}`} type="number" step="0.01" value={service.cost || ''} title="Custo do Serviço" onChange={(e) => { const newServices = [...(editingItem?.metadata?.extraServices || [])]; newServices[index] = { ...newServices[index], cost: parseFloat(e.target.value) }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); }} placeholder="0,00" className={`w-full px-4 py-3 rounded-xl font-bold text-xs text-center outline-none border-2 pr-10 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-emerald-600'}`} /><button type="button" onClick={() => setActiveCalc({ initialValue: service.cost || 0, onResult: (val) => { const newServices = [...(editingItem?.metadata?.extraServices || [])]; newServices[index] = { ...newServices[index], cost: val }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); } })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all"><Calculator size={12} /></button></div></div>
                      <div className="col-span-1 flex items-end pb-1"><button type="button" title="Remover Serviço" aria-label="Remover este serviço" onClick={() => { const newServices = (editingItem?.metadata?.extraServices || []).filter((_: any, i: number) => i !== index); setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); }} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"><Trash2 size={16} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2"><Palette size={18} className="text-indigo-500" /><span className="text-xs font-black uppercase tracking-widest text-slate-500">Cores Disponíveis e Sub-Ref</span></div>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {(colors || []).map(color => {
                    const variation = (editingItem?.metadata?.colorVariations || []).find((cv: any) => cv.colorId === color.id);
                    const isSelected = !!variation;
                    return (
                      <div key={color.id} className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all ${isSelected ? 'border-indigo-500/30 bg-indigo-500/5' : isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-50 bg-slate-50/50'}`}>
                        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl shadow-sm border border-black/10" style={{ backgroundColor: color.hex }} /><span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{color.name}</span></div>
                        <div className="flex items-center gap-2">{isSelected && (<input type="text" placeholder="SUB-REF" value={variation.subRef || ''} onChange={(e) => { const subRef = e.target.value.toUpperCase(); setEditingItem(prev => { if (!prev) return null; const variations = [...(prev.metadata?.colorVariations || [])]; const idx = variations.findIndex((cv: any) => cv.colorId === color.id); variations[idx] = { ...variations[idx], subRef }; return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } }; }); }} className={`w-24 px-3 py-2 rounded-xl font-black text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100'}`} />)}<button type="button" onClick={() => { setEditingItem(prev => { if (!prev) return null; const variations = [...(prev.metadata?.colorVariations || [])]; const idx = variations.findIndex((cv: any) => cv.colorId === color.id); if (idx >= 0) variations.splice(idx, 1); else variations.push({ colorId: color.id, subRef: '' }); return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } }; }); }} className={`p-2 rounded-xl transition-all ${isSelected ? 'text-indigo-500' : 'text-slate-300'}`}>{isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* CALCULATION CARD */}
              {(() => {
                const activeSizesCount = Object.values(editingItem?.metadata?.sizeWeights || {}).filter(w => (w as number) > 0).length;
                const effectiveTotalWeight = editingItem?.metadata?.totalWeight || totalWeightLive;
                const avgWeight = activeSizesCount > 0 ? effectiveTotalWeight / activeSizesCount : 0;
                const materialPrice = editingItem?.metadata?.price || 0;
                const materialCostPerPair = (avgWeight / 1000) * materialPrice;
                const extraServicesCost = (editingItem?.metadata?.extraServices || []).reduce((sum: number, s: any) => sum + (s.cost || 0), 0);
                const suggestedPrice = materialCostPerPair + extraServicesCost;

                return (
                  <div className={`mt-4 p-6 rounded-[2rem] border-2 flex flex-col gap-4 ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Target size={18} className="text-indigo-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Análise de Custo Sugerido</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Peso Médio (Par)</span>
                      <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{avgWeight.toFixed(2)} GR</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Custo Material (Média x Preço/KG)</span>
                      <span className="text-xs font-black text-amber-600">R$ {materialCostPerPair.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Serviços Agregados</span>
                      <span className="text-xs font-black text-emerald-600">R$ {extraServicesCost.toFixed(2)}</span>
                    </div>

                    <div className="h-px w-full bg-indigo-200 dark:bg-indigo-800/50 my-2" />

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Sugestão de Preço</span>
                      <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">R$ {suggestedPrice.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : type === 'MATERIAL' ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mat-master-category', 'Categoria Mestre', ViewType.CATEGORIES, true)}
                  <select id="mat-master-category" value={editingItem?.metadata?.masterCategory || ''} title="Categoria Mestre" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, masterCategory: e.target.value as any } } : null)} required className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">SELECIONAR...</option>{supplyCategoryNames.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="mat-reference" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Referência / Código</label>
                  <div className="relative group">
                    <input id="mat-reference" type="text" value={editingItem?.metadata?.reference || ''} title="Referência" placeholder="REFERÊNCIA" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, reference: e.target.value.toUpperCase() } } : null)} className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                    <button type="button" onClick={generateCode} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all" title="Gerar Código Automático"><Wand2 size={16} /></button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="mat-name" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Nome do Material *</label>
                <input id="mat-name" type="text" value={editingItem?.name || ''} title="Nome do Material" placeholder="NOME DO MATERIAL" onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)} required className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mat-flowtag', 'Flow Tag (Estágio)', 'FLOW_TAGS')}
                  <select id="mat-flowtag" value={editingItem?.metadata?.flowTagId || ''} title="Flow Tag" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, flowTagId: e.target.value } } : null)} className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">NENHUMA...</option>{flowTags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>
                </div>
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mat-supplier', 'Fornecedor Principal', ViewType.PEOPLE)}
                  <select id="mat-supplier" value={editingItem?.metadata?.supplierId || ''} title="Fornecedor" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, supplierId: e.target.value } } : null)} className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">NENHUM...</option>{suppliers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mat-unit', 'Unidade', 'UNIDADES', true)}
                  <select id="mat-unit" value={editingItem?.metadata?.unitId || ''} title="Unidade" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, unitId: e.target.value } } : null)} required className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">SELECIONAR...</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                </div>
                <div className="flex flex-col gap-2"><label htmlFor="mat-cost" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Custo Base</label><div className="relative group"><input id="mat-cost" type="number" step="0.01" value={editingItem?.metadata?.baseCost || ''} title="Custo Base" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, baseCost: Number(e.target.value) } } : null)} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} /><button type="button" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.baseCost || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, baseCost: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
                <div className="flex flex-col gap-2"><label htmlFor="mat-width" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Largura (m)</label><div className="relative group"><input id="mat-width" type="number" step="0.01" value={editingItem?.metadata?.width || ''} title="Largura" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, width: Number(e.target.value) } } : null)} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} /><button type="button" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.width || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, width: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
              </div>
              <div className="flex flex-col gap-2">
                {renderLabelWithShortcut('mat-colors', 'Cores Disponíveis', ViewType.COLORS)}
                <div className={`p-4 rounded-2xl border-2 flex flex-wrap gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>{colors.map(color => { const isSelected = (editingItem?.metadata?.colorIds || []).includes(color.id); return (<button key={color.id} type="button" onClick={() => { const currentIds = editingItem?.metadata?.colorIds || []; const newIds = isSelected ? currentIds.filter(id => id !== color.id) : [...currentIds, color.id]; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, colorIds: newIds } } : null); }} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400 border border-slate-100'}`}>{color.name}</button>); })}</div>
              </div>
            </div>
          ) : type === 'TOOL' ? (
            <div className="flex flex-col gap-6">
              <div className={`w-full aspect-video rounded-3xl overflow-hidden relative border-2 border-dashed ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'} flex items-center justify-center transition-all`}>
                {editingItem?.imageUrl ? (
                  <>
                    <img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" title="Remover Foto" aria-label="Remover foto atual" onClick={() => setEditingItem(prev => prev ? { ...prev, imageUrl: '' } : null)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg">
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <button type="button" title="Adicionar Foto" aria-label="Adicionar nova foto" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-slate-400">
                    <Camera size={24} />
                    <span className="text-xs font-bold uppercase tracking-widest">Adicionar Foto</span>
                  </button>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" title="Upload de Imagem" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Referência da Faca *</label>
                <div className="relative group">
                  <input
                    type="text"
                    value={editingItem?.metadata?.reference || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, reference: e.target.value.toUpperCase() } } : null)}
                    placeholder="Ex: FAC-001"
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2`}
                    required
                  />
                  <button
                    type="button"
                    onClick={generateCode}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                    title="Gerar Código Automático"
                  >
                    <Wand2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome / Descrição da Faca *</label>
                <input
                  type="text"
                  value={editingItem?.name || ''}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)}
                  placeholder="Ex: FACA TENIS CYBER"
                  className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2`}
                  required
                />
              </div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Conjugação (Pares/Batida) *</label><input type="number" value={editingItem?.metadata?.conjugation || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, conjugation: Number(e.target.value) } } : null)} placeholder="1" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>

              <div className="flex items-center justify-between mb-2 ml-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500"><TableCellsMerge size={16} /></div>
                  {renderLabelWithShortcut('tool-pull-grid', 'Puxar Grade', ViewType.GRIDS)}
                </div>
                <select
                  id="tool-pull-grid"
                  title="Selecionar Grade"
                  onChange={(e) => {
                    const gridId = e.target.value;
                    const grid = grids.find(g => g.id === gridId);
                    if (grid) {
                      const areas: Record<string, number> = {};
                      grid.sizes.forEach(s => { areas[s] = editingItem?.metadata?.sizeAreas?.[s] || 0; });
                      setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, sizeAreas: areas, sizes: grid.sizes } } : null);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-600 focus:border-indigo-600'}`}
                >
                  <option value="">Selecionar...</option>
                  {grids.filter(g => g.type === GridType.FACA || !g.type).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-4">
                <label htmlFor="tool-new-size" className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Configurar Numerações</label>
                <div className="flex gap-2">
                  <input id="tool-new-size" type="text" value={newSize} onChange={(e) => setNewSize(e.target.value)} title="Nova Numeração" placeholder="Ex: 37" className={`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                  <button type="button" title="Adicionar Numeração" aria-label="Adicionar este tamanho" onClick={addSize} className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Plus size={24} />
                  </button>
                </div>
                <div className="p-6 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                  {(editingItem?.metadata?.sizes || []).map(size => (
                    <div key={size} className={`px-4 py-2 rounded-xl flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                      <span className="text-xs font-black">{size}</span>
                      <button type="button" title={`Remover ${size}`} aria-label={`Remover tamanho ${size}`} onClick={() => removeSize(size)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {(editingItem?.metadata?.sizes || []).length > 0 && (
                <div className={`p-6 rounded-[2.5rem] flex flex-col gap-6 ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/50'}`}>
                  <div className="flex items-center gap-3 px-2">
                    <Target size={18} className="text-slate-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Matriz de Área (M²)</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {(editingItem?.metadata?.sizes || []).map(size => (
                      <AreaInput
                        key={size}
                        size={size}
                        value={editingItem?.metadata?.sizeAreas?.[size]}
                        onChange={(val: any) => updateArea(size, val)}
                        onShowCalc={(initialValue: number, onResult: (v: number) => void) => setActiveCalc({ initialValue, onResult })}
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : type === 'INFESTO' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Layers size={32} /></div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Configuração de Camadas para<br />Corte e Produção</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Infesto *</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: COURO PADRÃO" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Quantidade de Camadas *</label><div className="relative group"><input type="number" value={editingItem?.metadata?.layers || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, layers: Number(e.target.value) } } : null)} placeholder="Ex: 4" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.layers || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, layers: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
            </div>
          ) : type === 'DEADLINE' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><CalendarClock size={32} /></div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Definição de Prazos e SLA<br />para Ordens de Produção</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Prazo *</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: URGENTE, PADRÃO..." className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Prazo em Dias *</label><div className="relative group"><input type="number" value={editingItem?.metadata?.days || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, days: Number(e.target.value) } } : null)} placeholder="Ex: 7" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.days || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, days: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
            </div>
          ) : type === 'PACKAGING' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Grid3X3 size={32} /></div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Configuração de Grades e<br />Tamanhos para Embalagens</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Padrão *</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: FEMININO 33-40" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo de Grade</label><div className={`flex gap-2 p-1.5 rounded-2xl border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}><button type="button" onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FIXED' } } : null)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(!editingItem?.metadata?.mode || editingItem?.metadata?.mode === 'FIXED') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-500'}`}>Grade Fixa</button><button type="button" onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FREE' } } : null)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingItem?.metadata?.mode === 'FREE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-500'}`}>Grade Livre</button></div></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Capacidade Total (Pares) *</label><div className="relative group"><input type="number" value={editingItem?.metadata?.capacity || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, capacity: Number(e.target.value) } } : null)} placeholder="Ex: 12" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.capacity || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, capacity: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
              {editingItem?.metadata?.mode !== 'FREE' && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between mb-2 ml-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500"><TableCellsMerge size={16} /></div>
                      {renderLabelWithShortcut('pack-pull-grid', 'Puxar Grade', ViewType.GRIDS)}
                    </div>
                    <select
                      id="pack-pull-grid"
                      title="Selecionar Grade"
                      onChange={(e) => {
                        const gridId = e.target.value;
                        const grid = grids.find(g => g.id === gridId);
                        if (grid) {
                          const quantities: Record<string, number> = {};
                          grid.sizes.forEach(s => { quantities[s] = editingItem?.metadata?.sizeQuantities?.[s] || 0; });
                          setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, sizeQuantities: quantities, sizes: grid.sizes } } : null);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-600 focus:border-indigo-600'}`}
                    >
                      <option value="">Selecionar...</option>
                      {grids.filter(g => g.type === GridType.EMBALAGEM || !g.type).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-4">
                    <label htmlFor="pack-new-size" className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Adicionar Numerações</label>
                    <div className="flex gap-2">
                      <input id="pack-new-size" type="text" value={newSize} onChange={(e) => setNewSize(e.target.value)} title="Nova Numeração" placeholder="Ex: 37" className={`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                      <button type="button" title="Adicionar Numeração" aria-label="Adicionar este tamanho" onClick={addSize} className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                        <Plus size={24} strokeWidth={3} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(editingItem?.metadata?.sizes || []).map(size => (
                        <div key={size} className={`px-4 py-2 rounded-xl flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          <span className="text-xs font-black">{size}</span>
                          <button type="button" title={`Remover ${size}`} aria-label={`Remover tamanho ${size}`} onClick={() => removeSize(size)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(editingItem?.metadata?.sizes || []).length > 0 && (
                    <div className={`p-6 rounded-[2.5rem] flex flex-col gap-6 ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/50'}`}>
                      <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distribuição da Grade</h4>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${Object.values(editingItem?.metadata?.sizeQuantities || {}).reduce((a: number, b) => a + (Number(b) || 0), 0) === (editingItem?.metadata?.capacity || 0) ? 'text-emerald-500' : 'text-red-500'}`}>Total: {Object.values(editingItem?.metadata?.sizeQuantities || {}).reduce((a: number, b) => a + (Number(b) || 0), 0)} / {editingItem?.metadata?.capacity || 0}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {(editingItem?.metadata?.sizes || []).map(size => (
                          <div key={size} className="flex flex-col gap-2 items-center">
                            <label htmlFor={`pack-qty-${size}`} className="text-[9px] font-black text-slate-400 uppercase">{size}</label>
                            <input
                              id={`pack-qty-${size}`}
                              type="number"
                              value={editingItem?.metadata?.sizeQuantities?.[size] || ''}
                              title={`Quantidade para tamanho ${size}`}
                              placeholder="0"
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                setEditingItem(prev => {
                                  if (!prev) return null;
                                  const metadata = prev.metadata || {};
                                  return {
                                    ...prev,
                                    metadata: {
                                      ...metadata,
                                      sizeQuantities: {
                                        ...(metadata.sizeQuantities || {}),
                                        [size]: qty
                                      }
                                    }
                                  };
                                });
                              }}
                              className={`w-full px-2 py-3 rounded-xl font-black text-xs text-center outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{icon}</div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Preencha os dados abaixo para<br />registrar em {label}</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome / Sigla</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: UN, KG, MT..." className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Descrição Completa</label><input type="text" value={editingItem?.description || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)} placeholder="Ex: Unidade, Quilograma, Metro..." className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} /></div>
            </div>
          )}
          <button type="submit" disabled={isLoading} className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? (<><Loader2 size={18} className="animate-spin" />SALVANDO...</>) : (<><Check size={18} strokeWidth={3} />{editingItem?.id ? 'Salvar Alterações' : 'Confirmar Cadastro'}</>)}</button>
        </form>
      </Modal>

      <CalculatorModal
        isOpen={!!activeCalc}
        onClose={() => setActiveCalc(null)}
        initialValue={activeCalc?.initialValue || 0}
        onResult={(val) => {
          activeCalc?.onResult(val);
          setActiveCalc(null);
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}


function SectorCard({ sector, flowTags, isDarkMode, onEdit, onDelete }: {
  sector: Sector;
  flowTags: FlowTag[];
  isDarkMode: boolean;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  key?: React.Key;
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
            title="Editar Setor"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
          >
            <Edit3 size={18} />
          </button>
          <button
            onClick={() => {
              if (confirm(`Deseja excluir o setor ${sector.name}?`)) onDelete();
            }}
            title="Excluir Setor"
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

function MaterialCard({ item, isDarkMode, onEdit, onDelete, flowTags, people }: {
  item: ProductionConfigItem,
  isDarkMode: boolean,
  onEdit: () => void,
  onDelete: () => void | Promise<void>,
  flowTags: FlowTag[],
  people: any[],
  key?: React.Key
}) {
  const flowTag = flowTags.find(t => t.id === item.metadata?.flowTagId);
  const supplier = people.find(p => p.id === item.metadata?.supplierId);

  const { totalWeight, yieldVal } = useMemo(() => {
    const weights = Object.values(item.metadata?.sizeWeights || {}) as number[];
    const activeWeights = weights.filter(w => w > 0);
    const total = activeWeights.reduce((a, b) => a + b, 0);
    return { totalWeight: total, yieldVal: total > 0 ? 1000 / total : 0 };
  }, [item.metadata]);

  return (
    <div className={`p-6 rounded-[2rem] border flex flex-col gap-6 relative transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.metadata?.reference || 'S/ REF'}</span>
          <h5 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</h5>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2">
              <PackageOpen size={12} className="text-slate-400" />
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{flowTag?.name || 'ESTÁGIO NÃO DEF.'}</span>
            </div>
            {supplier && (
              <div className="flex items-center gap-2">
                <Users size={12} className="text-slate-400" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{supplier.name}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} title="Editar Material" aria-label={`Editar material ${item.name}`} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"><Edit3 size={16} /></button>
          <button onClick={onDelete} title="Excluir Material" aria-label={`Excluir material ${item.name}`} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
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
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest">
              {item.metadata?.masterCategory || 'GERAL'}
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 text-[8px] font-black uppercase tracking-widest">
              {item.metadata?.unit || 'UN'}
            </div>
          </div>
          {yieldVal > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Hash size={10} className="text-emerald-500" />
              <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                {yieldVal.toFixed(2)} PRS / KG
              </span>
            </div>
          )}
        </div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cores: {item.metadata?.colorIds?.length || 0}</span>
      </div>
    </div>
  );
}

function SoleMatrixCard({ item, isDarkMode, onEdit, onDelete, flowTags, colors, productionConfigs }: {
  item: ProductionConfigItem,
  isDarkMode: boolean,
  onEdit: () => void,
  onDelete: () => void | Promise<void>,
  flowTags: FlowTag[],
  colors: ColorValue[],
  productionConfigs: ProductionConfigItem[],
  key?: React.Key
}) {
  const flowTag = flowTags.find(t => t.id === item.metadata?.flowTagId);
  const selectedColors = item.metadata?.colorVariations || [];

  return (
    <div className={`p-6 rounded-[2.5rem] border flex flex-col gap-6 relative transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 flex gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-slate-50 text-slate-400'}`}>
            <Grid3X3 size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] font-mono">{item.metadata?.reference || item.metadata?.moldReference || 'S/ REF'}</span>
            <h5 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</h5>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.metadata?.category || 'GERAL'} • {flowTag?.name || 'S/ FLUXO'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} title="Editar Matriz" aria-label={`Editar matriz ${item.name}`} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"><Edit3 size={18} /></button>
          <button onClick={onDelete} title="Excluir Matriz" aria-label={`Excluir matriz ${item.name}`} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
        </div>
      </div>

      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedColors.map((cv: any) => {
            if (!cv) return null;
            const color = colors.find(c => c.id === cv.colorId);
            return (
              <div key={cv.colorId} className={`px-3 py-1.5 rounded-xl flex items-center gap-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: color?.hex || '#ccc' }} />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{color?.name || 'COR'} ({cv.subRef})</span>
              </div>
            );
          })}
        </div>
      )}

      {item.metadata?.sizeWeights && Object.keys(item.metadata.sizeWeights || {}).length > 0 && (
        <div className={`p-4 rounded-2xl flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
          <div className="flex items-center gap-2 text-slate-400">
            <Package size={14} />
            <span className="text-[9px] font-black uppercase tracking-widest">Pesos por Tamanho (GR)</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {Object.entries(item.metadata?.sizeWeights || {}).map(([size, weight]) => (
              <div key={size} className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-slate-400">{size}</span>
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{weight}g</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.metadata?.composition && (item.metadata.composition as any[]).length > 0 && (
        <div className={`p-4 rounded-2xl flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
          <div className="flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-2">
              <Layers size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">Composição de Materiais</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">
              {(item.metadata.composition as any[]).length} ITENS
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {(item.metadata.composition as any[]).slice(0, 3).map((comp: any, idx: number) => {
                const mat = (productionConfigs || []).find(c => c.id === comp.materialId);
                return (
                  <span key={idx} className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    {mat?.name || 'MATERIAL'} {idx < 2 && idx < (item.metadata?.composition as any[]).length - 1 ? '•' : ''}
                  </span>
                );
              })}
              {(item.metadata.composition as any[]).length > 3 && (
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">+{(item.metadata.composition as any[]).length - 3}</span>
              )}
            </div>
            <div className="flex items-baseline gap-1 bg-indigo-500/10 px-2 py-1 rounded-lg">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                {(() => {
                  const avgWeight = item.metadata?.averageWeight;
                  if (avgWeight && avgWeight > 0) return (1000 / avgWeight).toFixed(2);

                  const weights = Object.values(item.metadata?.sizeWeights || {}) as number[];
                  const activeWeights = weights.filter(w => w > 0);
                  if (activeWeights.length === 0) return '---';
                  const calcAvg = activeWeights.reduce((a, b) => a + b, 0) / activeWeights.length;
                  return (1000 / calcAvg).toFixed(2);
                })()}
              </span>
              <span className="text-[7px] font-black text-indigo-400 uppercase">PRS/KG</span>
            </div>
          </div>
        </div>
      )}

      {item.metadata?.extraServices && (item.metadata.extraServices as any[]).length > 0 && (
        <div className={`p-4 rounded-2xl flex flex-col gap-3 ${isDarkMode ? 'bg-emerald-950/20' : 'bg-emerald-50/50'}`}>
          <div className="flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-2">
              <Hammer size={14} className="text-emerald-500" />
              <span className="text-[9px] font-black uppercase tracking-widest">Serviços Agregados</span>
            </div>
            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
              R$ {(item.metadata.extraServices as any[]).reduce((acc, s) => acc + (s.cost || 0), 0).toFixed(2)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(item.metadata.extraServices as any[]).map((s: any, idx: number) => (
              <span key={idx} className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
                {s.name} (R$ {s.cost?.toFixed(2)})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/50">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            <Hash size={12} className="text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-[7px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-0.5">Rendimento:</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {(() => {
                  const weights = Object.values(item.metadata?.sizeWeights || {}) as number[];
                  const activeWeights = weights.filter(w => w > 0);
                  const total = activeWeights.reduce((a, b) => a + b, 0);
                  return total > 0 ? (1000 / total).toFixed(2) : '0.00';
                })()} PRS/KG
              </span>
            </div>
          </div>
          {item.metadata?.sizeWeights && (
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              Soma: {Object.values(item.metadata.sizeWeights).reduce((a, b) => (a as number) + (b as number), 0).toFixed(1)}g
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Total</p>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-black text-emerald-500">R$</span>
            <span className="text-xl font-black text-emerald-500">
              {(() => {
                const basePrice = item.metadata?.price || 0;
                const servicesCost = (item.metadata?.extraServices as any[] || []).reduce((acc, s) => acc + (s.cost || 0), 0);
                return (basePrice + servicesCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
