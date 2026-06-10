import React, { useState, useMemo, useRef, useEffect, FormEvent, ChangeEvent, ReactNode, Component } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', this.props.label, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-red-50 border-2 border-red-200 text-red-700 flex flex-col gap-2">
          <p className="font-black text-sm tracking-widest">Erro ao Renderizar {this.props.label}</p>
          <p className="text-xs font-mono break-all">{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })} 
            title="Recarregar o componente"
            aria-label="Tentar novamente"
            className="mt-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black tracking-widest"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
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
  Settings,
  Percent,
  AlertTriangle
} from 'lucide-react';
import { FlowTag, Sector, ProductionConfigItem, Person, ColorValue, Grid, GridType, CategoryType, ProductionScreenType, ViewType, Product, SoleStockEntry, ProductionLot } from '../types';
import Modal from '../components/Modal';
import ComboBox from '../components/ComboBox';
import ConfigMenuItem from '../components/ConfigMenuItem';
import CalculatorModal from '../components/CalculatorModal';

import ConsumptionCalculatorModal from '../components/ConsumptionCalculatorModal';
import { toast } from '../utils/toast';

const AreaInput = ({ size, value, onChange, isDarkMode, onShowCalc, onShowConsumptionCalc }: any) => {
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
    <div className={`flex flex-row sm:flex-col items-center sm:items-center justify-between sm:justify-start gap-4 sm:gap-2 p-4 sm:p-0 rounded-[1.5rem] sm:rounded-none border-2 sm:border-0 transition-all ${isDarkMode ? 'bg-slate-950/50 border-slate-800/50' : 'bg-white border-slate-100'} sm:bg-transparent sm:border-transparent w-full`}>
      <div className="flex items-center justify-between w-auto sm:w-full px-1 gap-3">
        <label htmlFor={`area-input-${size}`} className="text-[10px] font-black text-slate-400 tracking-tighter shrink-0">
          <span className="sm:hidden text-indigo-500 mr-1">TAM</span>{size}
        </label>
        {onShowCalc && (
          <button
            type="button"
            onClick={() => onShowCalc(parseFloat(localValue.replace(',', '.')) || 0, (val: number) => {
              setLocalValue(val.toFixed(4).replace('.', ','));
              onChange(val);
            })}
            aria-label="Abrir calculadora"
            title="Abrir calculadora"
            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
          >
            <Calculator size={14} />
          </button>
        )}
      </div>
      <div className="relative w-full max-w-[160px] sm:max-w-none group">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (onShowConsumptionCalc) {
              onShowConsumptionCalc(size, parseFloat(localValue.replace(',', '.')) || 0, (val: number) => {
                setLocalValue(val.toFixed(4).replace('.', ','));
                onChange(val);
              });
            }
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-600 transition-all active:scale-95 z-10"
          title="Abrir Calculador de Consumo"
          aria-label="Abrir Calculador de Consumo"
        >
          <Ruler size={14} strokeWidth={3} className="rotate-90" />
        </button>
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
          className={`w-full pl-8 pr-2 py-3 rounded-xl font-black text-xs text-center outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
        />
      </div>
    </div>
  );
}

function PecasConfig({
  title,
  isDarkMode,
  onBack,
  zIndex,
  productionConfigs,
  onSave,
  onDelete
}: {
  title: string;
  isDarkMode: boolean;
  onBack: () => void;
  zIndex: number;
  productionConfigs: ProductionConfigItem[];
  onSave: (item: ProductionConfigItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const pecasExistentes = productionConfigs.filter(c => c.type === 'PIECE');
  const [pecas, setPecas] = useState<ProductionConfigItem[]>(pecasExistentes);
  const [novoNome, setNovoNome] = useState('');
  const [tipoSelecionado, setTipoSelecionado] = useState<'ENTRADA' | 'PECA'>('PECA');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    setPecas(productionConfigs.filter(c => c.type === 'PIECE'));
  }, [productionConfigs]);

  const adicionarPeca = async () => {
    if (!novoNome.trim()) return;
    const nova: ProductionConfigItem = {
      id: `p-${Date.now()}`,
      name: novoNome.trim(),
      description: tipoSelecionado,
      type: 'PIECE',
      createdAt: Date.now(),
      metadata: { pieceType: tipoSelecionado }
    };
    await onSave(nova);
    setPecas([...pecas, nova]);
    setNovoNome('');
  };

  const removerPeca = async (id: string) => {
    await onDelete(id);
    setPecas(pecas.filter(p => p.id !== id));
  };

  const salvarEdicao = async (p: ProductionConfigItem) => {
    if (!editingName.trim()) return;
    const updated = { ...p, name: editingName.trim() };
    await onSave(updated);
    setPecas(pecas.map(x => x.id === p.id ? updated : x));
    setEditingId(null);
  };

  const entradas = pecas.filter(p => p.metadata?.pieceType === 'ENTRADA');
  const pecasLista = pecas.filter(p => p.metadata?.pieceType === 'PECA');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <ArrowLeft size={18} /> Voltar
        </button>
      </div>

      <div className={`rounded-2xl border-2 p-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex flex-col gap-2 mb-4">
          {/* Linha 1: tipo + nome */}
          <div className="flex gap-2">
            <select
              value={tipoSelecionado}
              onChange={(e) => setTipoSelecionado(e.target.value as 'ENTRADA' | 'PECA')}
              title="Tipo de item"
              aria-label="Tipo de item"
              className={`px-3 py-3 rounded-xl border-2 text-sm font-bold outline-none shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
            >
              <option value="ENTRADA">Entrada</option>
              <option value="PECA">Peça</option>
            </select>
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarPeca()}
              placeholder="Nome da peça..."
              className={`flex-1 min-w-0 px-4 py-3 rounded-xl border-2 text-sm font-bold outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
            />
          </div>
          {/* Linha 2: botão adicionar */}
          <button
            type="button"
            onClick={adicionarPeca}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Adicionar
          </button>
        </div>
      </div>

      {[
        { label: 'Entradas', list: entradas, color: 'indigo' },
        { label: 'Peças', list: pecasLista, color: 'violet' },
      ].map(({ label, list, color }) => list.length > 0 && (
        <div key={label} className="flex flex-col gap-2">
          <h3 className={`text-[10px] font-black tracking-[0.2em] uppercase px-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</h3>
          <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            {list.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  idx !== list.length - 1 ? (isDarkMode ? 'border-b border-slate-700/60' : 'border-b border-slate-100') : ''
                } ${isDarkMode ? 'bg-slate-800/60' : 'bg-white'}`}
              >
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0 ${
                  color === 'indigo'
                    ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400'
                    : 'bg-violet-50 text-violet-500 dark:bg-violet-900/30 dark:text-violet-400'
                }`}>{label.slice(0, -1)}</span>

                {editingId === p.id ? (
                  <input
                    autoFocus
                    type="text"
                    title="Editar nome"
                    aria-label="Editar nome"
                    placeholder="Nome..."
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(p); if (e.key === 'Escape') setEditingId(null); }}
                    className={`flex-1 min-w-0 px-2 py-1 rounded-lg border text-sm font-bold outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                  />
                ) : (
                  <span className={`flex-1 min-w-0 text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {editingId === p.id ? (
                    <>
                      <button type="button" onClick={() => salvarEdicao(p)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 hover:bg-emerald-100 transition-colors" title="Salvar">
                        <Check size={15} strokeWidth={3} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 transition-colors" title="Cancelar">
                        <X size={15} strokeWidth={2.5} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditingId(p.id); setEditingName(p.name); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-indigo-50 hover:text-indigo-500 dark:hover:bg-indigo-900/20 transition-colors" title="Editar">
                        <Edit3 size={14} />
                      </button>
                      <button type="button" onClick={() => removerPeca(p.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {pecas.length === 0 && (
        <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <p className="text-sm font-bold tracking-wider">Nenhuma peça cadastrada</p>
        </div>
      )}
    </div>
  );
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

interface ProductionConfigViewProps {
  flowTags?: FlowTag[];
  sectors?: Sector[];
  productionConfigs?: ProductionConfigItem[];
  onSaveFlowTag: (tag: FlowTag) => Promise<void>;
  onDeleteFlowTag: (id: string) => Promise<void>;
  onSaveSector: (sector: Sector) => Promise<void>;
  onDeleteSector: (id: string) => Promise<void>;
  onSaveConfigItem: (item: ProductionConfigItem) => Promise<void>;
  onDeleteConfigItem: (id: string) => Promise<void>;
  onUpdateSectorsOrder: (updatedSectors: Sector[]) => void;
  onBack: () => void;
  isDarkMode?: boolean;
  configItems?: ProductionConfigItem[];
  people?: Person[];
  colors?: ColorValue[];
  grids?: Grid[];
  categories?: any[];
  initialScreen?: ProductionScreenType;
  onNavigate?: (view: ViewType) => void;
  onAddProduct?: () => void;
  onNavigateGrids?: () => void;
  lots?: ProductionLot[];
  products?: Product[];
  soleStock?: SoleStockEntry[];
}

export default function ProductionConfigView({
  flowTags = [],
  sectors = [],
  productionConfigs = [],
  onSaveFlowTag,
  onDeleteFlowTag,
  onSaveSector,
  onDeleteSector,
  onSaveConfigItem,
  onDeleteConfigItem,
  onUpdateSectorsOrder,
  onBack,
  isDarkMode = false,
  people = [],
  colors = [],
  grids = [],
  categories = [],
  initialScreen = 'MENU',
  onNavigate,
  onAddProduct,
  onNavigateGrids,
  lots = [],
  products = [],
  soleStock = []
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

  const toolCategoryNames = useMemo(() => {
    const fromSystem = categories
      .filter(c => c.type === CategoryType.CUTTING_TOOL)
      .map(c => c.name.toUpperCase());

    if (fromSystem.length > 0) return fromSystem;
    return ['LATERAL', 'FRENTE', 'TRASEIRA', 'BIQUEIRA', 'CONTRAFORTE', 'PALMILHA', 'VIRA', 'OUTROS'];
  }, [categories]);

  const purchaseNeeds = useMemo(() => {
    const materialReqs: Record<string, number> = {};
    const activeLots = lots.filter(l => !l.finishedAt);

    activeLots.forEach(lot => {
      const product = products.find(p => p.id === lot.productId);
      const variation = product?.variations.find((v: any) => v.id === lot.variationId);
      if (!variation) return;

      variation.consumptions?.forEach((cons: any) => {
        if (!cons.materialId) return;
        let increment: number;
        if (cons.consumptionBasis === 'grade') {
          // Caixas coletivas são unidades inteiras — calcula por grade e arredonda para cima
          let grades: number;
          if (lot.gradesQty) {
            grades = lot.gradesQty;
          } else if (cons.quantity > 0 && cons.quantity < 1) {
            const pairsPerGrade = Math.round(1 / cons.quantity);
            grades = Math.round(lot.quantity / Math.max(1, pairsPerGrade));
          } else {
            grades = lot.quantity;
          }
          increment = Math.ceil(grades * (cons.quantity < 1 ? 1 : cons.quantity));
        } else {
          increment = lot.quantity * cons.quantity;
        }
        materialReqs[cons.materialId] = (materialReqs[cons.materialId] || 0) + increment;
      });
    });
    return materialReqs;
  }, [lots, products]);

  const [editingTag, setEditingTag] = useState<FlowTag | null>(null);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddingSector, setIsAddingSector] = useState(false);
  const [gridSuccess, setGridSuccess] = useState(false);

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
                  <h3 className="px-4 text-[10px] font-black tracking-[0.2em] text-slate-400 leading-none">Gestão de Processos</h3>
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
                  <h3 className="px-4 text-[10px] font-black tracking-[0.2em] text-slate-400 leading-none">Parâmetros de Modelagem</h3>
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
                  <h3 className="px-4 text-[10px] font-black tracking-[0.2em] text-slate-400 leading-none">Estrutura e Logística</h3>
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
                      desc="Camadas empilhadas"
                      color="text-sky-600"
                      bg="bg-sky-50"
                      isDarkMode={isDarkMode}
                      onClick={() => setCurrentScreen('INFESTO')}
                    />
                    <ConfigMenuItem
                      icon={<Layers size={24} />}
                      label="Peças"
                      desc="Entradas e peças"
                      color="text-emerald-600"
                      bg="bg-emerald-50"
                      isDarkMode={isDarkMode}
                      onClick={() => setCurrentScreen('PECAS')}
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
        zIndex={60000}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Setores de Fábrica</h3>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1">Defina a ordem da produção</p>
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
        zIndex={60000}
      >
        <GenericConfigList
          title="Unidades"
          label="UNIDADES"
          items={productionConfigs}
          type="UNIT"
          icon={<Ruler size={22} className="rotate-90" />}
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
        zIndex={60000}
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
          toolCategoryNames={toolCategoryNames}
          products={products}
          onNavigateToScreen={handleNavigateShortcut}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'INFESTO'}
        onClose={() => setCurrentScreen('MENU')}
        title="Configuração de Infestos"
        zIndex={60000}
      >
        <GenericConfigList title="Infesto" label="INFESTO" items={productionConfigs} type="INFESTO" icon={<Layers size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} onBack={() => setCurrentScreen('MENU')} placeholderLabel="Nenhum registro de infesto" onNavigateToScreen={handleNavigateShortcut} />
      </Modal>

      <Modal
        isOpen={currentScreen === 'PRAZOS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Prazos Padrão"
        zIndex={60000}
      >
        <GenericConfigList title="Prazos" label="PRAZOS" items={productionConfigs} type="DEADLINE" icon={<CalendarClock size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} onBack={() => setCurrentScreen('MENU')} placeholderLabel="Nenhum prazo cadastrado" onNavigateToScreen={handleNavigateShortcut} />
      </Modal>

      <Modal
        isOpen={currentScreen === 'FICHAS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Fichas Técnicas"
        zIndex={60000}
      >
        <GenericConfigList title="Fichas Técnicas" label="FICHAS TÉCNICAS" items={productionConfigs} type="TECH_SHEET" icon={<Footprints size={22} />} isDarkMode={isDarkMode} onSave={onSaveConfigItem} onDelete={onDeleteConfigItem} onBack={() => setCurrentScreen('MENU')} placeholderLabel="Nenhuma ficha técnica" onNavigateToScreen={handleNavigateShortcut} />
      </Modal>

      <Modal
        isOpen={currentScreen === 'EMBALAGENS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Padrão de Embalagens"
        zIndex={60000}
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
          zIndex={60000}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'PECAS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Peças"
        zIndex={60000}
      >
        <PecasConfig
          title="Peças"
          isDarkMode={isDarkMode}
          onBack={() => setCurrentScreen('MENU')}
          zIndex={60000}
          productionConfigs={productionConfigs}
          onSave={onSaveConfigItem}
          onDelete={onDeleteConfigItem}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'INSUMOS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Catálogo de Insumos"
        icon={<Package size={20} />}
        zIndex={60000}
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
          zIndex={60000}
          purchaseNeeds={purchaseNeeds}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'MATRIZES'}
        onClose={() => setCurrentScreen('MENU')}
        title="Matrizes Sola"
        zIndex={60000}
      >
        <ErrorBoundary label="Matrizes de Solados">
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
            soleStock={soleStock}
          />
        </ErrorBoundary>
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
        zIndex={70000}
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
        zIndex={70000}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Valor por Par Padrão (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editingSector?.defaultServiceValue ?? ''}
                onChange={(e) => setEditingSector(prev => prev ? { ...prev, defaultServiceValue: parseFloat(e.target.value) || 0 } : null)}
                placeholder="Ex: 1.50"
                className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Prestador de Serviço Padrão</label>
              <ComboBox
                options={people
                  .filter(p => p.isSupplier || (p as any).role === 'WORKER')
                  .map(p => ({ id: p.id || '', name: p.name }))}
                value={editingSector?.defaultServiceProviderId || ''}
                onChange={(id) => {
                  const selectedPerson = people.find(p => p.id === id);
                  setEditingSector(prev => prev ? { 
                    ...prev, 
                    defaultServiceProviderId: id,
                    defaultServiceProviderName: selectedPerson ? selectedPerson.name : '' 
                  } : null);
                }}
                placeholder="Selecionar da agenda..."
                isDarkMode={isDarkMode}
                icon={<Users size={18} />}
              />
            </div>
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
  toolCategoryNames = [],
  products = [],
  onNavigateToScreen,
  zIndex = 60000,
  soleStock = [],
  purchaseNeeds = {}
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
  toolCategoryNames?: string[];
  products?: Product[];
  onNavigateToScreen?: (screen: ProductionScreenType | ViewType) => void;
  zIndex?: number;
  soleStock?: SoleStockEntry[];
  purchaseNeeds?: Record<string, number>;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionConfigItem | null>(null);
  const [search, setSearch] = useState('');
  const [newSize, setNewSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProductFilter, setSelectedProductFilter] = useState('');
  const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
  const [isColorWeightsModalOpen, setIsColorWeightsModalOpen] = useState(false);
  const [gridSuccess, setGridSuccess] = useState(false);
  const [activeCalc, setActiveCalc] = useState<{
    initialValue: number;
    onResult: (val: number) => void;
  } | null>(null);
  const [activeConsumptionCalc, setActiveConsumptionCalc] = useState<{
    size: string;
    initialValue: number;
    onResult: (val: number) => void;
  } | null>(null);
  const [showPercentageModal, setShowPercentageModal] = useState(false);
  const [percBaseSize, setPercBaseSize] = useState('');
  const [percValue, setPercValue] = useState(10);
  const [percField, setPercField] = useState<'sizeAreas' | 'sizeWeights' | 'colorSizeWeights'>('sizeAreas');
  const [percTargetId, setPercTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyPercentageScale = (baseSize: string, percentage: number, field: string = 'sizeAreas', targetId: string | null = null) => {
    const sizes = editingItem?.metadata?.sizes || [];
    let baseValue = 0;
    
    if (targetId && field === 'colorSizeWeights') {
      baseValue = editingItem?.metadata?.colorSizeWeights?.[targetId]?.[baseSize] || 0;
    } else {
      baseValue = editingItem?.metadata?.[field]?.[baseSize] || 0;
    }
    
    if (baseValue === 0) {
      toast.show(`O valor base para o tamanho ${baseSize} é 0. Preencha um valor primeiro para poder escalonar.`);
      return;
    }

    const baseIndex = sizes.indexOf(baseSize);
    const metadata = { ...editingItem?.metadata };

    if (targetId && field === 'colorSizeWeights') {
      const newColorWeights = { ...(metadata.colorSizeWeights?.[targetId] || {}) };
      sizes.forEach((size, index) => {
        const diff = index - baseIndex;
        const factor = 1 + (diff * (percentage / 100));
        newColorWeights[size] = Number((baseValue * factor).toFixed(4));
      });
      metadata.colorSizeWeights = { ...(metadata.colorSizeWeights || {}), [targetId]: newColorWeights };
    } else {
      const newData = { ...(metadata[field] || {}) };
      sizes.forEach((size, index) => {
        const diff = index - baseIndex;
        const factor = 1 + (diff * (percentage / 100));
        newData[size] = field === 'sizeAreas' ? Number((baseValue * factor).toFixed(4)) : Number((baseValue * factor).toFixed(2));
      });
      metadata[field] = newData;
    }

    setEditingItem(prev => prev ? { ...prev, metadata } : null);
    setShowPercentageModal(false);
  };

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

  const { totalWeightLive, averageWeightLive, yieldLive } = useMemo(() => {
    if (!editingItem?.metadata?.sizeWeights) return { totalWeightLive: 0, averageWeightLive: 0, yieldLive: 0 };
    const weights = Object.values(editingItem?.metadata?.sizeWeights || {}) as number[];
    const activeWeights = weights.filter(w => w > 0);
    const total = activeWeights.reduce((a, b) => a + b, 0);
    const avg = activeWeights.length > 0 ? total / activeWeights.length : 0;
    const yld = avg > 0 ? 1000 / avg : 0;
    return { totalWeightLive: total, averageWeightLive: avg, yieldLive: yld };
  }, [editingItem?.metadata?.sizeWeights]);

  const units = useMemo(() => productionConfigs.filter(c => c.type === 'UNIT'), [productionConfigs]);
  const suppliers = useMemo(() => people.filter(p => p.isSupplier), [people]);

  const filteredItems = useMemo(() => {
    return items
      .filter(item => item?.type === type)
      .filter(item => {
        const nameMatch = (item?.name || '').toLowerCase().includes(search.toLowerCase());
        const refMatch = (item?.metadata?.reference || item?.metadata?.moldReference || '').toLowerCase().includes(search.toLowerCase());
        const descMatch = (item?.description || '').toLowerCase().includes(search.toLowerCase());
        return nameMatch || refMatch || descMatch;
      });
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

  const groupedTools = useMemo<Record<string, ProductionConfigItem[]> | null>(() => {
    if (type !== 'TOOL') return null;
    const groups: Record<string, ProductionConfigItem[]> = {};
    const baseItems = selectedProductFilter
      ? filteredItems.filter(item => (item.metadata?.productIds || []).includes(selectedProductFilter))
      : filteredItems;
    baseItems.forEach(item => {
      const cat = (item.metadata?.category || 'SEM CATEGORIA').trim().toUpperCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems, type, selectedProductFilter]);

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
        toast.show(`O código "${currentCode}" já está sendo usado em outro item deste tipo.`);
        return;
      }
    }

    // Validar metadados para Facas
    if (type === 'TOOL') {
      const conjugation = editingItem.metadata?.conjugation || 1;
      if (conjugation < 1) {
        toast.show('A conjugação deve ser pelo menos 1');
        return;
      }
    }

    // Validation for Packaging Grade
    if (type === 'PACKAGING' && (editingItem as any).metadata?.mode !== 'FREE') {
      const sizeQuantities = (editingItem as any).metadata?.sizeQuantities || {};
      const totalDist = Object.values(sizeQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
      const capacity = Number((editingItem as any).metadata?.capacity || 0);

      if (totalDist !== capacity) {
        toast.show(`A soma das quantidades (${totalDist}) deve ser exatamente igual à capacidade da embalagem (${capacity}).`);
        return;
      }
    }

    setIsLoading(true);
    try {
      await onSave(editingItem);
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      toast.show('Erro ao salvar: ' + (err.message || err));
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
      <div className={`p-6 rounded-[3rem] shadow-xl flex items-center gap-3 relative overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        {onBack && (
          <button
            onClick={onBack}
            title="Voltar"
            aria-label="Voltar para a tela anterior"
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-slate-700'}`}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <button
          onClick={() => {
            setEditingItem({
              id: '',
              name: '',
              description: '',
              type,
              createdAt: Date.now(),
              metadata: type === 'TOOL' ? { conjugation: 1, sizes: [], sizeAreas: {}, category: '', productIds: [] } :
                type === 'MOLD' ? { moldReference: '', sizes: [], sizeWeights: {}, sizeAreas: {}, composition: [], colorVariations: [], extraServices: [] } :
                  type === 'MATERIAL' ? { masterCategory: '', reference: '', unitId: '', baseCost: 0, width: 0, colorIds: [], flowTagId: '', supplierId: '' } :
                    type === 'PACKAGING' ? { mode: 'FIXED', capacity: 0, sizes: [], sizeQuantities: {} } :
                      type === 'PIECE' ? { reference: '', flowTagId: '', supplierId: '', baseCost: 0 } :
                        {}
            });
            setIsModalOpen(true);
          }}
          title={`Adicionar Novo Registro em ${label}`}
          aria-label={`Adicionar novo registro na categoria ${label}`}
          className={`flex-1 py-4 px-6 rounded-[2rem] flex items-center gap-4 transition-all shadow-lg active:scale-[0.98] ${isDarkMode ? 'bg-indigo-600 text-white shadow-indigo-900/40' : 'bg-indigo-600 text-white shadow-indigo-200/80'}`}
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

      {type === 'TOOL' && products.length > 0 && (
        <div className="relative">
          <Package size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={selectedProductFilter}
            onChange={(e) => setSelectedProductFilter(e.target.value)}
            className={`w-full pl-12 pr-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest outline-none transition-all border-2 appearance-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-700'} ${selectedProductFilter ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : ''}`}
          >
            <option value="">TODOS OS MODELOS</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.reference})</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {type === 'TOOL' ? (
          Object.entries(groupedTools || {}).map(([category, catItems], catIdx) => {
            const toolPalette = [
              { bg: '#f97316', light: '#fff7ed', border: '#fed7aa' },
              { bg: '#ef4444', light: '#fef2f2', border: '#fecaca' },
              { bg: '#8b5cf6', light: '#f5f3ff', border: '#ddd6fe' },
              { bg: '#0ea5e9', light: '#f0f9ff', border: '#bae6fd' },
              { bg: '#10b981', light: '#ecfdf5', border: '#a7f3d0' },
              { bg: '#f59e0b', light: '#fffbeb', border: '#fde68a' },
            ];
            const pal = toolPalette[catIdx % toolPalette.length];
            return (
              <div key={category} className="flex flex-col gap-3">
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
                  style={{ backgroundColor: isDarkMode ? `${pal.bg}18` : pal.light, borderColor: isDarkMode ? `${pal.bg}40` : pal.border }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: pal.bg }}>
                    <Scissors size={14} color="#fff" />
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-xs font-black uppercase tracking-[0.2em] leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{category}</h4>
                    <p className="text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5" style={{ color: `${pal.bg}99` }}>
                      {catItems.length} {catItems.length === 1 ? 'FACA' : 'FACAS'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 pl-2 border-l-2" style={{ borderColor: `${pal.bg}40` }}>
                  {catItems.map(item => (
                    <motion.div
                      key={item.id}
                      layout
                      className={`p-4 rounded-[1.5rem] border flex items-center justify-between group transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-slate-50 text-slate-400'}`}>
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : icon}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            CONSUMO P/ ÁREA • {item.metadata?.conjugation || 1} PR/BAT
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pr-2">
                        <button type="button" onClick={() => { setEditingItem({ ...item }); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"><Edit3 size={18} /></button>
                        <button type="button" onClick={() => { if (confirm(`Deseja excluir ${item.name}?`)) onDelete(item.id); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })
        ) : type === 'MATERIAL' ? (
          Object.entries(groupedItems || {}).map(([category, catItems]: [string, ProductionConfigItem[]], catIdx) => {
            const catPalette = [
              { bg: '#6366f1', light: '#eef2ff', border: '#c7d2fe' },
              { bg: '#8b5cf6', light: '#f5f3ff', border: '#ddd6fe' },
              { bg: '#10b981', light: '#ecfdf5', border: '#a7f3d0' },
              { bg: '#f59e0b', light: '#fffbeb', border: '#fde68a' },
              { bg: '#ef4444', light: '#fef2f2', border: '#fecaca' },
              { bg: '#0ea5e9', light: '#f0f9ff', border: '#bae6fd' },
            ];
            const pal = catPalette[catIdx % catPalette.length];
            const alertCount = catItems.filter(i => {
              const stock = i.metadata?.currentStock ?? 0;
              const minStock = i.metadata?.minStock ?? 0;
              return stock < minStock;
            }).length;
            return (
            <div key={category} className="flex flex-col gap-3">
              <div
                className="flex items-center gap-4 px-4 py-3 rounded-2xl border"
                style={{ backgroundColor: isDarkMode ? `${pal.bg}18` : pal.light, borderColor: isDarkMode ? `${pal.bg}40` : pal.border }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: pal.bg }}>
                  <Tags size={16} color="#fff" />
                </div>
                <div className="flex-1">
                  <h4 className={`text-xs font-black uppercase tracking-[0.2em] leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{category}</h4>
                  <p className="text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5" style={{ color: `${pal.bg}99` }}>{catItems.length} {catItems.length === 1 ? 'ITEM' : 'ITENS'} CADASTRADO{catItems.length !== 1 ? 'S' : ''}</p>
                </div>
                {alertCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: '#ef4444' }}>
                    {alertCount} ALERTA{alertCount > 1 ? 'S' : ''}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3 pl-2 border-l-2" style={{ borderColor: `${pal.bg}40` }}>
                {catItems.map(item => (
                  <MaterialCard
                    key={item.id}
                    item={item}
                    isDarkMode={isDarkMode}
                    onEdit={() => { setEditingItem({ ...item }); setIsModalOpen(true); }}
                    onDelete={() => { if (confirm(`Deseja excluir ${item.name}?`)) onDelete(item.id); }}
                    flowTags={flowTags}
                    people={people}
                    need={purchaseNeeds[item.id] || 0}
                  />
                ))}
              </div>
            </div>
            );
          })
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
                soleStock={soleStock}
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
                    {(type as string) === 'TOOL' ? (
                      <div className="flex flex-col gap-1 mt-0.5">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">CONSUMO P/ ÁREA • {item.metadata?.conjugation || 1} PR/BAT</p>
                        {item.metadata?.category && (
                          <span className="inline-flex self-start px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/40 text-[8px] font-black text-indigo-500 uppercase tracking-widest">
                            {item.metadata.category}
                          </span>
                        )}
                      </div>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Editar / Cadastrar`} zIndex={70000}>
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {type === 'MOLD' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-6">
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
                <div className="flex flex-col gap-2">
                  <label htmlFor="mold-name" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Nome da Matriz *</label>
                  <input id="mold-name" type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)} required title="Nome da Matriz" placeholder="NOME DA MATRIZ" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mold-category', 'Categoria', ViewType.CATEGORIES)}
                  <select id="mold-category" value={editingItem?.metadata?.category || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: e.target.value } } : null)} title="Selecionar Categoria" className={`w-full px-4 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">GERAL</option><option value="SOLADO">SOLADO</option><option value="SALTO">SALTO</option><option value="PALMILHA">PALMILHA</option></select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="mold-supplier" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Fornecedor</label>
                  <select 
                    id="mold-supplier" 
                    value={editingItem?.metadata?.supplierId || ''} 
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, supplierId: e.target.value } } : null)} 
                    title="Selecionar Fornecedor" 
                    className={`w-full px-4 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                  >
                    <option value="">Selecione...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="mold-base-material" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Material Base (Insumos)</label>
                <select
                  id="mold-base-material"
                  value={editingItem?.metadata?.baseMaterialId || ''}
                  onChange={(e) => {
                    const materialId = e.target.value;
                    const material = productionConfigs.find(m => m.id === materialId);
                    if (material) {
                      const pricePerKg = material.metadata?.baseCost || 0;
                      const avgW = averageWeightLive || 0;
                      const calcUnitCost = avgW > 0 ? parseFloat(((avgW / 1000) * pricePerKg).toFixed(4)) : 0;
                      setEditingItem(prev => prev ? { 
                        ...prev, 
                        metadata: { 
                          ...prev.metadata, 
                          price: pricePerKg,
                          baseMaterialId: materialId,
                          unitCost: calcUnitCost
                        } 
                      } : null);
                    } else {
                      setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, baseMaterialId: '', unitCost: 0 } } : null);
                    }
                  }}
                  className={`w-full px-4 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                >
                  <option value="">SELECIONAR INSUMO PARA PUXAR PREÇO...</option>
                  {productionConfigs.filter(m => m.type === 'MATERIAL').map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.metadata?.reference}) - R$ {m.metadata?.baseCost || 0}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="mold-price" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Preço do Material / KG (R$)</label>
                  <div className="relative group">
                    <input id="mold-price" type="number" step="0.01" value={editingItem?.metadata?.price || ''} onChange={(e) => {
                      const pricePerKg = parseFloat(e.target.value) || 0;
                      const avgW = averageWeightLive || 0;
                      const calcUnitCost = avgW > 0 ? parseFloat(((avgW / 1000) * pricePerKg).toFixed(4)) : 0;
                      setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, price: pricePerKg, unitCost: calcUnitCost } } : null);
                    }} title="Preço por KG" placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                    <button
                      type="button"
                      title="Abrir Calculadora"
                      aria-label="Abrir calculadora para definir preço"
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
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="mold-unit-cost" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Custo por Par (R$)</label>
                    {averageWeightLive > 0 && editingItem?.metadata?.price && editingItem.metadata.price > 0 && (
                      <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest mr-1">
                        {averageWeightLive.toFixed(1)}g ÷ 1000 × R${editingItem.metadata.price}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <input id="mold-unit-cost" type="number" step="0.0001" value={editingItem?.metadata?.unitCost || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, unitCost: parseFloat(e.target.value) } } : null)} title="Custo por par (calculado automaticamente ou informe manualmente)" placeholder={averageWeightLive > 0 && editingItem?.metadata?.price ? ((averageWeightLive / 1000) * (editingItem.metadata.price)).toFixed(4) : '0,00'} className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                    <button
                      type="button"
                      title="Recalcular com peso médio atual"
                      aria-label="Recalcular custo por par com base no peso médio"
                      onClick={() => {
                        const pricePerKg = editingItem?.metadata?.price || 0;
                        const avgW = averageWeightLive || 0;
                        if (avgW > 0 && pricePerKg > 0) {
                          const calc = parseFloat(((avgW / 1000) * pricePerKg).toFixed(4));
                          setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, unitCost: calc } } : null);
                        } else {
                          setActiveCalc({
                            initialValue: editingItem?.metadata?.unitCost || 0,
                            onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, unitCost: val } } : null)
                          });
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  {editingItem?.metadata?.unitCost && editingItem.metadata.unitCost > 0 && (
                    <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest ml-2">
                      ≈ R$ {Number(editingItem.metadata.unitCost).toFixed(4)} / par
                    </p>
                  )}
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

                <div className="flex flex-col gap-4 mb-6">
                  <div className="flex items-center justify-between px-2">
                    <label htmlFor="mold-new-size" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Configurar Numerações</label>
                    <div className="flex items-center gap-3">
                      <AnimatePresence>
                        {gridSuccess && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8, x: 10 }}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                          >
                            <CheckCircle2 size={10} strokeWidth={3} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Grade Carregada!</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 transition-all relative group ${isDarkMode ? 'bg-indigo-950/30 border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400' : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-200 text-indigo-600'}`}>
                        <Grid3X3 size={14} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                        <select
                          onChange={(e) => {
                            const gridId = e.target.value;
                            if (!gridId) return;
                            const grid = grids.find(g => g.id === gridId);
                            if (grid) {
                              const gridSizes = (grid as any).sizes || (grid as any).items?.map((i: any) => i.size) || [];
                              setEditingItem(prev => {
                                if (!prev) return null;
                                const newSizeWeights = { ...(prev.metadata?.sizeWeights || {}) };
                                gridSizes.forEach((s: string) => {
                                  if (newSizeWeights[s] === undefined) newSizeWeights[s] = 0;
                                });
                                return {
                                  ...prev,
                                  metadata: {
                                    ...prev.metadata,
                                    sizes: gridSizes,
                                    sizeWeights: newSizeWeights
                                  }
                                };
                              });
                              setGridSuccess(true);
                              setTimeout(() => setGridSuccess(false), 2500);
                            }
                            e.target.value = "";
                          }}
                          className="bg-transparent border-none outline-none text-[10px] font-black uppercase cursor-pointer pr-4 appearance-none"
                        >
                          <option value="">PUXAR GRADE...</option>
                          {grids.filter(g => g.type === GridType.SOLADO).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input id="mold-new-size" type="text" value={newSize} onChange={(e) => setNewSize(e.target.value)} title="Nova Numeração" placeholder="Ex: 37" className={`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                    <button type="button" title="Adicionar Numeração" aria-label="Adicionar este tamanho" onClick={addSize} className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      <Plus size={24} />
                    </button>
                  </div>
                  <div className="p-4 rounded-[1.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                    {(editingItem?.metadata?.sizes || []).map(size => (
                      <div key={size} className={`px-3 py-1.5 rounded-xl flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                        <span className="text-[10px] font-black">{size}</span>
                        <button type="button" title={`Remover ${size}`} aria-label={`Remover tamanho ${size}`} onClick={() => removeSize(size)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
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
                  title="Pesos por Tamanho (g)"
                  zIndex={75000}
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                      {Object.entries(editingItem?.metadata?.sizeWeights || {}).map(([size, weight]) => (
                        <div key={size} className={`flex items-center justify-between p-3 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'}`}>
                          <label htmlFor={`weight-${size}`} className="text-xs font-black text-slate-600 dark:text-slate-300 w-24 ml-2">TAM {size}</label>
                          <div className="relative flex-1 max-w-[150px] group">
                            <input
                              id={`weight-${size}`}
                              type="text"
                              inputMode="decimal"
                              value={weight !== undefined && weight !== null && weight !== 0 ? String(weight as number).replace('.', ',') : weight === 0 ? '0' : ''}
                              title={`Peso para tamanho ${size}`}
                              placeholder="0"
                              onChange={(e) => {
                                const val = parseFloat(e.target.value.replace(',', '.'));
                                setEditingItem(prev => {
                                  if (!prev) return null;
                                  const newWeights = { ...(prev.metadata?.sizeWeights || {}) };
                                  newWeights[size] = isNaN(val) ? 0 : val;
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

                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsWeightsModalOpen(true)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <Scale size={16} /> Pesos por Tamanho
                  </button>
                  {colors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsColorWeightsModalOpen(true)}
                      className="flex-1 py-3 px-4 rounded-2xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                    >
                      <Palette size={16} /> Pesos por Cor
                    </button>
                  )}
                </div>

                <Modal
                  isOpen={isColorWeightsModalOpen}
                  onClose={() => setIsColorWeightsModalOpen(false)}
                  title="Pesos por Cor e Tamanho (GR)"
                  zIndex={75000}
                >
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-slate-500 font-medium">
                      Cadastre o peso médio para cada cor. Se tiver pesos diferentes por tamanho, cadastre também os tamanhos.
                    </p>
                    <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                      {(() => {
                        const registeredColorIds = new Set((editingItem?.metadata?.colorVariations || []).map((cv: any) => cv.colorId));
                        const registeredColors = (colors || []).filter(c => registeredColorIds.has(c.id));
                        if (registeredColors.length === 0) {
                          return (
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-8 px-4 leading-relaxed">
                              Nenhuma cor cadastrada para esta matriz.<br />Selecione as cores em "Cores Disponíveis e Sub-Ref" antes de configurar os pesos.
                            </p>
                          );
                        }
                        return registeredColors.map((color) => {
                        const colorWeight = editingItem?.metadata?.colorWeights?.[color.id] || 0;
                        const colorSizeWeights = editingItem?.metadata?.colorSizeWeights?.[color.id] || {};
                        const sizes = editingItem?.metadata?.sizes || [];
                        const hasSizeWeights = sizes.length > 0 && Object.keys(colorSizeWeights).length > 0;

                        return (
                          <div key={color.id} className={`rounded-2xl border-2 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-violet-50 dark:bg-violet-900/20">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-6 h-6 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: color.hex }} />
                                <span className="text-xs font-black text-slate-700 dark:text-slate-200 break-words">{color.name}</span>
                              </div>
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:max-w-[100px]">
                                  <input
                                    type="number"
                                    value={colorWeight || ''}
                                    title={`Peso médio para cor ${color.name}`}
                                    placeholder="Média"
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setEditingItem(prev => {
                                        if (!prev) return null;
                                        const newColorWeights = { ...(prev.metadata?.colorWeights || {}) };
                                        if (val > 0) {
                                          newColorWeights[color.id] = val;
                                        } else {
                                          delete newColorWeights[color.id];
                                        }
                                        return { ...prev, metadata: { ...prev.metadata, colorWeights: newColorWeights } };
                                      });
                                    }}
                                    className={`w-full px-3 py-2 rounded-xl font-black text-xs text-right pr-10 outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-violet-500' : 'bg-white border-slate-200 text-slate-900 focus:border-violet-500'}`}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">GR</span>
                                </div>
                              </div>
                            </div>

                            {sizes.length > 0 && (
                              <div className="p-3 grid grid-cols-4 gap-2">
                                {sizes.map(size => {
                                  const sizeWeight = colorSizeWeights[size] || 0;
                                  return (
                                    <div key={size} className="flex flex-col gap-1">
                                      <label className="text-[8px] font-black text-slate-400 uppercase text-center">{size}</label>
                                      <input
                                        type="number"
                                        value={sizeWeight || ''}
                                        title={`Peso ${color.name} - ${size}`}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value);
                                          setEditingItem(prev => {
                                            if (!prev) return null;
                                            const newColorSizeWeights = { ...(prev.metadata?.colorSizeWeights || {}) };
                                            if (!newColorSizeWeights[color.id]) {
                                              newColorSizeWeights[color.id] = {};
                                            }
                                            if (val > 0) {
                                              newColorSizeWeights[color.id][size] = val;
                                            } else {
                                              delete newColorSizeWeights[color.id][size];
                                            }
                                            return { ...prev, metadata: { ...prev.metadata, colorSizeWeights: newColorSizeWeights } };
                                          });
                                        }}
                                        className={`px-2 py-1.5 rounded-lg font-black text-[10px] text-center outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                        });
                      })()}
                    </div>
                    <div className="flex gap-4 mt-2">
                      {(Object.keys(editingItem?.metadata?.colorWeights || {}).length > 0 || Object.keys(editingItem?.metadata?.colorSizeWeights || {}).length > 0) && (
                        <div className="flex-1 p-3 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-500/30">
                          <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                            {Object.keys(editingItem?.metadata?.colorWeights || {}).length} cor(es) com peso médio
                          </p>
                          {Object.keys(editingItem?.metadata?.colorSizeWeights || {}).length > 0 && (
                            <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest mt-1">
                              {Object.keys(editingItem?.metadata?.colorSizeWeights || {}).length} cor(es) com peso por tamanho
                            </p>
                          )}
                        </div>
                      )}
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
                        title="Abrir Calculadora"
                        aria-label="Abrir calculadora para definir peso total"
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
                      <div className="flex flex-col gap-0.5 mt-1 ml-1">
                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                          Soma Calculada: {totalWeightLive.toFixed(1)} g
                        </span>
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                          Média Calculada: {averageWeightLive.toFixed(1)} g
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rendimento por KG</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {averageWeightLive > 0 ? (1000 / averageWeightLive).toFixed(2) : '0.00'}
                      </span>
                      <span className="text-xs font-black text-slate-400 uppercase">PRS / KG</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      1000 g ÷ Média ({averageWeightLive.toFixed(1)} g)
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
                      <div className="col-span-3 flex flex-col gap-1"><label htmlFor={`qty-${index}`} className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1">Quant / %</label><div className="relative group"><input id={`qty-${index}`} type="number" step="0.001" value={item.quantity || ''} title="Quantidade" placeholder="0,000" onChange={(e) => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], materialId: e.target.value, quantity: parseFloat(e.target.value) }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); }} className={`w-full px-3 py-3 rounded-xl font-black text-[10px] text-center outline-none border-2 pr-10 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-600'}`} /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir quantidade" onClick={() => setActiveCalc({ initialValue: item.quantity || 0, onResult: (val) => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], quantity: val }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); } })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all"><Calculator size={12} /></button></div></div>
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
                      <div className="col-span-4 flex flex-col gap-1"><label htmlFor={`service-cost-${index}`} className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Valor (R$)</label><div className="relative group"><input id={`service-cost-${index}`} type="number" step="0.01" value={service.cost || ''} title="Custo do Serviço" onChange={(e) => { const newServices = [...(editingItem?.metadata?.extraServices || [])]; newServices[index] = { ...newServices[index], cost: parseFloat(e.target.value) }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); }} placeholder="0,00" className={`w-full px-4 py-3 rounded-xl font-bold text-xs text-center outline-none border-2 pr-10 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-emerald-600'}`} /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir valor do serviço" onClick={() => setActiveCalc({ initialValue: service.cost || 0, onResult: (val) => { const newServices = [...(editingItem?.metadata?.extraServices || [])]; newServices[index] = { ...newServices[index], cost: val }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); } })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all"><Calculator size={12} /></button></div></div>
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
                        <div className="flex items-center gap-2">{isSelected && (<input type="text" placeholder="SUB-REF" value={variation.subRef || ''} onChange={(e) => { const subRef = e.target.value.toUpperCase(); setEditingItem(prev => { if (!prev) return null; const variations = [...(prev.metadata?.colorVariations || [])]; const idx = variations.findIndex((cv: any) => cv.colorId === color.id); variations[idx] = { ...variations[idx], subRef }; return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } }; }); }} className={`w-24 px-3 py-2 rounded-xl font-black text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100'}`} />)}<button type="button" onClick={() => { setEditingItem(prev => { if (!prev) return null; const variations = [...(prev.metadata?.colorVariations || [])]; const idx = variations.findIndex((cv: any) => cv.colorId === color.id); if (idx >= 0) variations.splice(idx, 1); else variations.push({ colorId: color.id, colorName: color.name, subRef: '' }); return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } }; }); }} className={`p-2 rounded-xl transition-all ${isSelected ? 'text-indigo-500' : 'text-slate-300'}`}>{isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button></div>
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
                const isUnitCostSynced = (editingItem?.metadata?.unitCost || 0) > 0 && Math.abs((editingItem?.metadata?.unitCost || 0) - suggestedPrice) < 0.0001;

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
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Custo Material (Média × Preço/KG)</span>
                      <span className="text-xs font-black text-amber-600">R$ {materialCostPerPair.toFixed(4)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Serviços Agregados</span>
                      <span className="text-xs font-black text-emerald-600">R$ {extraServicesCost.toFixed(4)}</span>
                    </div>

                    <div className="h-px w-full bg-indigo-200 dark:bg-indigo-800/50 my-2" />

                    {/* LINHA SUGESTÃO + BOTÃO COPIAR */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Sugestão de Preço Total</span>
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">R$ {suggestedPrice.toFixed(4)}</span>
                      </div>
                      {suggestedPrice > 0 && !isUnitCostSynced && (
                        <button
                          type="button"
                          title="Usar este valor como Custo por Par"
                          aria-label="Copiar sugestão de preço para o campo Custo por Par"
                          onClick={() => setEditingItem(prev => prev ? {
                            ...prev,
                            metadata: { ...prev.metadata, unitCost: parseFloat(suggestedPrice.toFixed(4)) }
                          } : null)}
                          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/30 whitespace-nowrap"
                        >
                          <Check size={13} strokeWidth={3} />
                          USAR ESTE VALOR
                        </button>
                      )}
                      {isUnitCostSynced && (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                          <Check size={12} strokeWidth={3} className="text-emerald-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Aplicado</span>
                        </div>
                      )}
                    </div>

                    {/* STATUS DO CUSTO POR PAR */}
                    {(editingItem?.metadata?.unitCost || 0) > 0 && (
                      <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-emerald-900/20 border border-emerald-800/40' : 'bg-emerald-50 border border-emerald-200'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Custo por Par Salvo</span>
                        <span className="text-sm font-black text-emerald-600">R$ {Number(editingItem?.metadata?.unitCost).toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : type === 'MATERIAL' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
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
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mat-flowtag', 'Flow Tag (Estágio)', 'FLOW_TAGS')}
                  <select id="mat-flowtag" value={editingItem?.metadata?.flowTagId || ''} title="Flow Tag" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, flowTagId: e.target.value } } : null)} className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">NENHUMA...</option>{flowTags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>
                </div>
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mat-supplier', 'Fornecedor Principal', ViewType.PEOPLE)}
                  <select id="mat-supplier" value={editingItem?.metadata?.supplierId || ''} title="Fornecedor" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, supplierId: e.target.value } } : null)} className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">NENHUM...</option>{suppliers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  {renderLabelWithShortcut('mat-unit', 'Unidade', 'UNIDADES', true)}
                  <select id="mat-unit" value={editingItem?.metadata?.unitId || ''} title="Unidade" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, unitId: e.target.value } } : null)} required className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}><option value="">SELECIONAR...</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                </div>
                <div className="flex flex-col gap-2"><label htmlFor="mat-cost" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Custo Base</label><div className="relative group"><input id="mat-cost" type="number" step="0.01" value={editingItem?.metadata?.baseCost || ''} title="Custo Base" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, baseCost: Number(e.target.value) } } : null)} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir custo base" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.baseCost || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, baseCost: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
                <div className="flex flex-col gap-2"><label htmlFor="mat-width" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Largura (m)</label><div className="relative group"><input id="mat-width" type="number" step="0.01" value={editingItem?.metadata?.width || ''} title="Largura" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, width: Number(e.target.value) } } : null)} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir largura" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.width || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, width: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="mat-stock" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Estoque Atual</label>
                  <div className="relative group">
                    <input id="mat-stock" type="number" step="0.01" value={editingItem?.metadata?.stock || ''} title="Estoque Atual" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, stock: Number(e.target.value) } } : null)} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                    <button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir estoque" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.stock || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, stock: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="mat-min-stock" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Estoque Mínimo</label>
                  <div className="relative group">
                    <input id="mat-min-stock" type="number" step="0.01" value={editingItem?.metadata?.minStock || ''} title="Estoque Mínimo" onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, minStock: Number(e.target.value) } } : null)} placeholder="0,00" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                    <button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir estoque mínimo" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.minStock || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, minStock: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button>
                  </div>
                </div>
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
              <div className="flex flex-col gap-2">
                {renderLabelWithShortcut('tool-category', 'Categoria da Faca', ViewType.CATEGORIES)}
                <select
                  id="tool-category"
                  value={editingItem?.metadata?.category || ''}
                  title="Categoria da Faca"
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: e.target.value } } : null)}
                  className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                >
                  <option value="">SEM CATEGORIA</option>
                  {toolCategoryNames.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                {toolCategoryNames.length === 0 && (
                  <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest ml-2">
                    Nenhuma categoria de faca cadastrada. Clique no ícone acima para criar.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">QUANTAS SÃO NECESSÁRIOS PARA FAZER 1 PAR</label>
                <input
                  type="number" 
                  value={editingItem?.metadata?.conjugation || ''} 
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, conjugation: Number(e.target.value) } } : null)} 
                  placeholder="1" 
                  className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2`} 
                  required 
                />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-2 leading-relaxed italic">
                  ( AQUI CADASTRAMOS SE A FACA E SIMPLES OU CONJUGADA, SE CONJUGADA ELA TEM QUANTAS REPETICOES, CONJUGACOES )
                </p>
              </div>

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
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <Target size={18} className="text-slate-400" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">MATRIZ DE ÁREA (M²)</h4>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        const sizes = editingItem?.metadata?.sizes || [];
                        const firstFilled = sizes.find(s => (editingItem?.metadata?.sizeAreas?.[s] || 0) > 0);
                        setPercBaseSize(firstFilled || sizes[0] || '');
                        setPercField('sizeAreas');
                        setPercTargetId(null);
                        setShowPercentageModal(true);
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 active:scale-95 transition-all flex items-center gap-2 group"
                      title="Escalonar por Porcentagem"
                    >
                      <Percent size={14} strokeWidth={3} className="group-hover:rotate-12 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Escalonar Grade</span>
                    </button>
                  </div>
                  <div className="flex flex-col sm:grid sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {(editingItem?.metadata?.sizes || []).map(size => (
                      <AreaInput
                        key={size}
                        size={size}
                        value={editingItem?.metadata?.sizeAreas?.[size]}
                        onChange={(val: any) => updateArea(size, val)}
                        onShowCalc={(initialValue: number, onResult: (v: number) => void) => setActiveCalc({ initialValue, onResult })}
                        onShowConsumptionCalc={(size: string, initialValue: number, onResult: (v: number) => void) => setActiveConsumptionCalc({ size, initialValue, onResult })}
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </div>
                </div>
              )}

              {products.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 ml-2">
                    <Package size={14} className="text-indigo-500" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                      Modelos que usam esta faca
                    </label>
                  </div>
                  <div className={`rounded-2xl border-2 overflow-hidden ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                      {products.map(product => {
                        const selected = (editingItem?.metadata?.productIds || []).includes(product.id);
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              const current: string[] = editingItem?.metadata?.productIds || [];
                              const updated = selected
                                ? current.filter(id => id !== product.id)
                                : [...current, product.id];
                              setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, productIds: updated } } : null);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all active:scale-[0.99] ${selected ? (isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50') : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-indigo-600 border-indigo-600' : isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                              {selected && <Check size={12} strokeWidth={3} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{product.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.reference}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {(editingItem?.metadata?.productIds || []).length > 0 && (
                      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-indigo-50 dark:bg-indigo-900/20">
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                          {(editingItem?.metadata?.productIds || []).length} modelo(s) selecionado(s)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : type === 'INFESTO' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Layers size={32} /></div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Configuração de Camadas para<br />Corte e Produção</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Infesto *</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: COURO PADRÃO" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Quantidade de Camadas *</label><div className="relative group"><input type="number" value={editingItem?.metadata?.layers || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, layers: Number(e.target.value) } } : null)} placeholder="Ex: 4" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir quantidade de camadas" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.layers || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, layers: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
            </div>
          ) : type === 'DEADLINE' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><CalendarClock size={32} /></div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Definição de Prazos e SLA<br />para Ordens de Produção</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Prazo *</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: URGENTE, PADRÃO..." className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Prazo em Dias *</label><div className="relative group"><input type="number" value={editingItem?.metadata?.days || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, days: Number(e.target.value) } } : null)} placeholder="Ex: 7" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir prazo em dias" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.days || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, days: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
            </div>
          ) : type === 'PACKAGING' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Grid3X3 size={32} /></div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Configuração de Grades e<br />Tamanhos para Embalagens</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Padrão *</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: FEMININO 33-40" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo de Grade</label><div className={`flex gap-2 p-1.5 rounded-2xl border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}><button type="button" onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FIXED' } } : null)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(!editingItem?.metadata?.mode || editingItem?.metadata?.mode === 'FIXED') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-500'}`}>Grade Fixa</button><button type="button" onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FREE' } } : null)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingItem?.metadata?.mode === 'FREE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-500'}`}>Grade Livre</button></div></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Capacidade Total (Pares) *</label><div className="relative group"><input type="number" value={editingItem?.metadata?.capacity || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, capacity: Number(e.target.value) } } : null)} placeholder="Ex: 12" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir capacidade total" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.capacity || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, capacity: val } } : null) })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
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

      <ConsumptionCalculatorModal
        isOpen={!!activeConsumptionCalc}
        onClose={() => setActiveConsumptionCalc(null)}
        sizeLabel={activeConsumptionCalc?.size || ''}
        onResult={(val) => {
          activeConsumptionCalc?.onResult(val);
          setActiveConsumptionCalc(null);
        }}
        isDarkMode={isDarkMode}
      />

      <Modal 
        isOpen={showPercentageModal} 
        onClose={() => setShowPercentageModal(false)} 
        title="ESCALONAMENTO POR PORCENTAGEM"
        zIndex={80000}
      >
        <div className="flex flex-col gap-6 p-2">
          <div className={`p-4 rounded-2xl border-2 border-dashed ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed text-center">
              Deseja preencher a grade automaticamente? <br/>
              Escolha uma numeração de referência e a porcentagem de variação entre os tamanhos.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tamanho de Referência</label>
              <select 
                value={percBaseSize || (editingItem?.metadata?.sizes?.[0] || '')}
                onChange={(e) => setPercBaseSize(e.target.value)}
                className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
              >
                {(editingItem?.metadata?.sizes || []).map(size => {
                  let displayVal = 0;
                  if (percField === 'colorSizeWeights' && percTargetId) {
                    displayVal = editingItem?.metadata?.colorSizeWeights?.[percTargetId]?.[size] || 0;
                  } else {
                    displayVal = (editingItem?.metadata as any)?.[percField]?.[size] || 0;
                  }
                  return (
                    <option key={size} value={size}>
                      TAM {size} ({displayVal})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Porcentagem por Tamanho (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={percValue}
                  onChange={(e) => setPercValue(Number(e.target.value))}
                  placeholder="Ex: 10" 
                  className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`} 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><Percent size={16} /></div>
              </div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-2 italic text-center">
                * Os tamanhos MAIORES serão acrescidos desta % <br/> e os MENORES serão subtraídos.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => setShowPercentageModal(false)}
              className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border-2 ${isDarkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
            >
              Cancelar
            </button>
            <button 
              type="button"
              onClick={() => {
                const base = percBaseSize || editingItem?.metadata?.sizes?.[0] || '';
                applyPercentageScale(base, percValue, percField, percTargetId);
              }}
              className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              Aplicar Escalonamento
            </button>
          </div>
        </div>
      </Modal>
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
            aria-label="Editar Setor"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
          >
            <Edit3 size={18} />
          </button>
          <button
            onClick={() => {
              if (confirm(`Deseja excluir o setor ${sector.name}?`)) onDelete();
            }}
            title="Excluir Setor"
            aria-label="Excluir Setor"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-red-400' : 'bg-slate-50 text-slate-400 hover:text-red-500'}`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {(sector.defaultServiceValue !== undefined || sector.defaultServiceProviderName) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold px-2 py-1">
          {sector.defaultServiceValue !== undefined && sector.defaultServiceValue > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase text-slate-400">Custo/Par:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">R$ {sector.defaultServiceValue.toFixed(2)}</span>
            </div>
          )}
          {sector.defaultServiceProviderName && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase text-slate-400">Prestador Padrão:</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{sector.defaultServiceProviderName}</span>
            </div>
          )}
        </div>
      )}

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

function MaterialCard({ item, isDarkMode, onEdit, onDelete, flowTags, people, need = 0 }: {
  item: ProductionConfigItem,
  isDarkMode: boolean,
  onEdit: () => void,
  onDelete: () => void | Promise<void>,
  flowTags: FlowTag[],
  people: any[],
  need?: number,
  key?: React.Key
}) {
  const [expanded, setExpanded] = useState(false);
  const flowTag = flowTags.find(t => t.id === item.metadata?.flowTagId);
  const supplier = people.find(p => p.id === item.metadata?.supplierId);

  const { yieldVal } = useMemo(() => {
    const weights = Object.values(item.metadata?.sizeWeights || {}) as number[];
    const activeWeights = weights.filter(w => w > 0);
    const total = activeWeights.reduce((a, b) => a + b, 0);
    return { totalWeight: total, yieldVal: activeWeights.length > 0 ? activeWeights.length / total : 0 };
  }, [item.metadata]);

  const stock = item.metadata?.stock || 0;
  const minStock = item.metadata?.minStock || 0;
  const isLowStock = stock < minStock;
  const hasPendingNeed = need > 0;
  const hasAlert = isLowStock || hasPendingNeed;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>

      {/* ── Row (always visible) ── */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}
      >
        {/* Icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <PackageOpen size={16} className={hasAlert ? 'text-rose-400' : 'text-slate-400'} />
        </div>

        {/* Name + ref */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.metadata?.reference || 'S/ REF'} · {item.metadata?.masterCategory || 'GERAL'}</span>
        </div>

        {/* Stock value */}
        <div className="flex flex-col items-end shrink-0 mr-1">
          <span className={`text-sm font-black ${isLowStock ? 'text-rose-500' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {stock.toLocaleString('pt-BR')}
          </span>
          <span className="text-[8px] font-bold text-slate-400 uppercase">{item.metadata?.unit || 'UN'}</span>
        </div>

        {/* Alert badges */}
        <div className="flex flex-col gap-1 shrink-0">
          {isLowStock && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[8px] font-black uppercase">
              <AlertTriangle size={8} strokeWidth={3} /> Baixo
            </span>
          )}
          {hasPendingNeed && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400 text-white text-[8px] font-black uppercase">
              <Sparkles size={8} /> Prod.
            </span>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className={`px-4 pb-4 flex flex-col gap-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>

          {/* Stage + supplier */}
          <div className="flex items-center gap-4 pt-3">
            <div className="flex items-center gap-1.5">
              <PackageOpen size={11} className="text-slate-400" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{flowTag?.name || 'Estágio não def.'}</span>
            </div>
            {supplier && (
              <div className="flex items-center gap-1.5">
                <Users size={11} className="text-slate-400" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{supplier.name}</span>
              </div>
            )}
          </div>

          {/* Custo + rendimento */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Custo Base</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-black text-emerald-500">R$</span>
                <span className="text-lg font-black text-emerald-500">{(item.metadata?.baseCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            {yieldVal > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Hash size={10} className="text-emerald-500" />
                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase">{yieldVal.toFixed(2)} prs / {item.metadata?.unit || 'UN'}</span>
              </div>
            )}
          </div>

          {/* Stock + need */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl flex flex-col gap-0.5 ${isLowStock ? (isDarkMode ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-100') : (isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50')}`}>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estoque Atual</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-black ${isLowStock ? 'text-rose-500' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{stock.toLocaleString('pt-BR')}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">{item.metadata?.unit || 'UN'}</span>
              </div>
              <span className="text-[8px] font-bold text-slate-400 uppercase">Mín: {minStock}</span>
              {isLowStock && <span className="text-[8px] font-black text-rose-500 uppercase mt-0.5">⚠ Estoque Baixo</span>}
            </div>

            <div className={`p-3 rounded-xl flex flex-col gap-0.5 ${hasPendingNeed ? (isDarkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100') : (isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50')}`}>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Necessidade Prod.</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-black ${hasPendingNeed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{need.toLocaleString('pt-BR')}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">{item.metadata?.unit || 'UN'}</span>
              </div>
              {hasPendingNeed && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Sparkles size={9} className="text-amber-500" />
                  <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase">Aguardando Prod.</span>
                </div>
              )}
            </div>
          </div>

          {/* Cores + actions */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Cores: {item.metadata?.colorIds?.length || 0}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 hover:bg-indigo-100 transition-colors">
                <Edit3 size={11} /> Editar
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 transition-colors">
                <Trash2 size={11} /> Excluir
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function SoleMatrixCard({ item, isDarkMode, onEdit, onDelete, flowTags, colors, productionConfigs, soleStock }: {
  item: ProductionConfigItem,
  isDarkMode: boolean,
  onEdit: () => void,
  onDelete: () => void | Promise<void>,
  flowTags: FlowTag[],
  colors: any[],
  productionConfigs: ProductionConfigItem[],
  soleStock?: SoleStockEntry[],
  key?: React.Key
}) {
  const safeFlowTags = Array.isArray(flowTags) ? flowTags : [];
  const safeColors = Array.isArray(colors) ? colors : [];
  const safeProductionConfigs = Array.isArray(productionConfigs) ? productionConfigs : [];
  const flowTag = safeFlowTags.find(t => t?.id === item.metadata?.flowTagId);
  const selectedColors = Array.isArray(item.metadata?.colorVariations) ? item.metadata!.colorVariations! : [];
  const safeExtraServices = Array.isArray(item.metadata?.extraServices) ? item.metadata!.extraServices! : [];
  const safeComposition = Array.isArray(item.metadata?.composition) ? item.metadata!.composition! : [];
  const safeSizeWeights = (item.metadata?.sizeWeights && typeof item.metadata.sizeWeights === 'object' && !Array.isArray(item.metadata.sizeWeights)) ? item.metadata.sizeWeights : {};
  const safeSoleStock = Array.isArray(soleStock) ? soleStock : [];

  const getStockForSize = (size: string) => {
    return safeSoleStock
      .filter(s => s.moldId === item.id)
      .reduce((acc, s) => acc + (s.stock?.[size] || 0), 0);
  };

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
            const color = safeColors.find(c => c.id === cv.colorId);
            return (
              <div key={cv.colorId || String(Math.random())} className={`px-3 py-1.5 rounded-xl flex items-center gap-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: color?.hex || '#ccc' }} />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{color?.name || 'COR'} ({cv.subRef})</span>
              </div>
            );
          })}
        </div>
      )}

      {Object.keys(safeSizeWeights).length > 0 && (
        <div className={`p-4 rounded-2xl flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
          <div className="flex items-center gap-2 text-slate-400">
            <Package size={14} />
            <span className="text-[9px] font-black uppercase tracking-widest">Pesos por Tamanho (g)</span>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {Object.entries(safeSizeWeights).map(([size, weight]) => {
              const stock = getStockForSize(size);
              return (
                <div key={size} className="flex flex-col items-center rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm min-w-[72px]">
                  <div className="w-full px-4 py-1.5 bg-black flex items-center justify-center">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{size}</span>
                  </div>
                  <div className="w-full px-4 py-2.5 bg-white flex flex-col items-center gap-0.5">
                    <span className="text-sm font-black text-slate-800">{Number(weight) || 0} g</span>
                    {stock > 0 && (
                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Est: {stock}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {safeComposition.length > 0 && (
        <div className={`p-4 rounded-2xl flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
          <div className="flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-2">
              <Layers size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">Composição de Materiais</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">
              {safeComposition.length} ITENS
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {safeComposition.slice(0, 3).map((comp: any, idx: number) => {
                const mat = safeProductionConfigs.find(c => c.id === comp?.materialId);
                return (
                  <span key={idx} className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    {mat?.name || 'MATERIAL'} {idx < 2 && idx < safeComposition.length - 1 ? '•' : ''}
                  </span>
                );
              })}
              {safeComposition.length > 3 && (
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">+{safeComposition.length - 3}</span>
              )}
            </div>
            <div className="flex items-baseline gap-1 bg-indigo-500/10 px-2 py-1 rounded-lg">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                {(() => {
                  const avgWeight = item.metadata?.averageWeight;
                  if (avgWeight && avgWeight > 0) return (1000 / avgWeight).toFixed(2);
                  const weights = Object.values(safeSizeWeights) as number[];
                  const activeWeights = weights.filter(w => Number(w) > 0);
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

      {safeExtraServices.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serviços Extras</span>
            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
              R$ {safeExtraServices.reduce((acc: number, s: any) => acc + (Number(s?.cost) || 0), 0).toFixed(2)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {safeExtraServices.map((s: any, idx: number) => (
              <span key={idx} className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
                {s?.name} (R$ {Number(s?.cost || 0).toFixed(2)})
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
                  const weights = Object.values(safeSizeWeights) as number[];
                  const activeWeights = weights.filter(w => Number(w) > 0);
                  const total = activeWeights.reduce((a, b) => a + b, 0);
                  const avg = activeWeights.length > 0 ? total / activeWeights.length : 0;
                  return avg > 0 ? (1000 / avg).toFixed(2) : '0.00';
                })()} PRS/KG
              </span>
            </div>
          </div>
          {Object.keys(safeSizeWeights).length > 0 && (
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              Soma: {Object.values(safeSizeWeights).reduce((a, b) => Number(a) + Number(b), 0).toFixed(1)} g
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo por Par</p>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-black text-emerald-500">R$</span>
            <span className="text-xl font-black text-emerald-500">
              {(() => {
                const unitCost = Number(item.metadata?.unitCost) || 0;
                const servicesCost = safeExtraServices.reduce((acc: number, s: any) => acc + (Number(s?.cost) || 0), 0);
                return (unitCost + servicesCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
