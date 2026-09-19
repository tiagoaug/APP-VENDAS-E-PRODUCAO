import React, { useState, useMemo, useRef, useEffect, FormEvent, ChangeEvent, ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
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
  Settings,
  Percent,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import { FlowTag, Sector, ProductionConfigItem, Person, ColorValue, Grid, GridType, CategoryType, Category, ProductionScreenType, ViewType, Product, SoleStockEntry, ProductionLot, FlowTagTemplate, SectorTemplate, PackagingTemplate, UnitTemplate } from '../types';
import { subscribeToFlowTagTemplates, saveFlowTagTemplate } from '../services/flowTagTemplatesService';
import { subscribeToSectorTemplates, saveSectorTemplate } from '../services/sectorTemplatesService';
import { subscribeToPackagingTemplates, savePackagingTemplate, deletePackagingTemplate } from '../services/packagingTemplatesService';
import { subscribeToUnitTemplates, saveUnitTemplate, deleteUnitTemplate } from '../services/unitTemplatesService';
import { isTemplateAdmin } from '../utils/templateAdmin';
import { DefaultUnitItem } from '../services/defaultUnitsService';
import Modal from '../components/Modal';
import PersonModal from '../components/PersonModal';
import MaterialFormFields from '../components/MaterialFormFields';
import ComboBox from '../components/ComboBox';
import ConfigMenuItem from '../components/ConfigMenuItem';
import CalculatorModal from '../components/CalculatorModal';
import EngineeringPickerModal from '../components/EngineeringPickerModal';
import { BADGE_COLOR_OPTIONS, BADGE_COLOR_CLASSES, DEFAULT_BADGE_COLOR } from '../utils/badgeColors';

import ConsumptionCalculatorModal from '../components/ConsumptionCalculatorModal';
import { toast } from '../utils/toast';
import { getTotalMaterialStock } from '../utils/materialStock';
import { generateId } from '../utils/id';
import GuidePulseDot from '../components/GuidePulseDot';

// Trava de ordenação das numerações (ex: "34", "38-39", "40-41") para que a grade de
// tamanhos sempre apareça na mesma ordem numérica crescente, independente da ordem em
// que foram cadastradas. Extrai o primeiro número de cada chave para comparar.
const getSizeSortKey = (size: string): number => {
  const match = String(size).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : Infinity;
};

const sortSizeKeys = (sizes: string[]): string[] =>
  [...sizes].sort((a, b) => getSizeSortKey(a) - getSizeSortKey(b));

const sortSizeEntries = <T,>(entries: [string, T][]): [string, T][] =>
  [...entries].sort(([a], [b]) => getSizeSortKey(a) - getSizeSortKey(b));

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
            data-guide-anchor="prodcfg.areaCalculadora"
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
          data-guide-anchor="prodcfg.areaConsumoCalc"
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

  const handleSeedPecas = async () => {
    for (const def of DEFAULT_PECAS) {
      const nova: ProductionConfigItem = {
        id: `p-${Date.now()}-${def.name}`,
        name: def.name,
        description: def.pieceType,
        type: 'PIECE',
        createdAt: Date.now(),
        metadata: { pieceType: def.pieceType }
      };
      await onSave(nova);
    }
    setPecas([...pecas, ...DEFAULT_PECAS.map(def => ({
      id: `p-${Date.now()}-${def.name}`,
      name: def.name,
      description: def.pieceType,
      type: 'PIECE' as const,
      createdAt: Date.now(),
      metadata: { pieceType: def.pieceType }
    }))]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          data-guide-anchor="peca.voltar"
          className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <ArrowLeft size={18} /> Voltar
        </button>
      </div>

      <p className={`text-xs font-bold -mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Esses cadastros são usados dentro da Ficha Técnica, em Engenharia de Modelos, para nomear os componentes e peças do roteiro de produção.
      </p>

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
            data-guide-anchor="peca.adicionar"
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
                      <button type="button" onClick={() => salvarEdicao(p)} data-guide-anchor="peca.salvarEdicao" className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 hover:bg-emerald-100 transition-colors" title="Salvar">
                        <Check size={15} strokeWidth={3} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} data-guide-anchor="peca.cancelarEdicao" className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 transition-colors" title="Cancelar">
                        <X size={15} strokeWidth={2.5} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditingId(p.id); setEditingName(p.name); }} data-guide-anchor="peca.editar" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-indigo-50 hover:text-indigo-500 dark:hover:bg-indigo-900/20 transition-colors" title="Editar">
                        <Edit3 size={14} />
                      </button>
                      <button type="button" onClick={() => removerPeca(p.id)} data-guide-anchor="peca.remover" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 transition-colors" title="Excluir">
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
        <div className="flex flex-col items-center gap-4 py-8">
          <p className={`text-sm font-bold tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma peça cadastrada</p>
          <button
            type="button"
            onClick={handleSeedPecas}
            data-guide-anchor="peca.carregarPadrao"
            className="px-6 py-3 rounded-2xl bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100"
          >
            Carregar Peças Padrão
          </button>
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

// Cores das categorias do Catálogo de Insumos (Adesivos, Embalagens, Couro/Sintético...) —
// hoisted pra fora do render pra dar pra reaproveitar tanto na lista de categorias quanto no
// cabeçalho do popup que abre com os itens dela (ver openMaterialCategoryPopup).
const MATERIAL_CATEGORY_PALETTE = [
  { bg: '#6366f1', light: '#eef2ff', border: '#c7d2fe' },
  { bg: '#8b5cf6', light: '#f5f3ff', border: '#ddd6fe' },
  { bg: '#10b981', light: '#ecfdf5', border: '#a7f3d0' },
  { bg: '#f59e0b', light: '#fffbeb', border: '#fde68a' },
  { bg: '#ef4444', light: '#fef2f2', border: '#fecaca' },
  { bg: '#0ea5e9', light: '#f0f9ff', border: '#bae6fd' },
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

// Sugestão de Padrões de Embalagem pro botão "Carregar Padrões" — mesma ideia do DEFAULT_UNITS
// acima, só que em modo 'FREE' (só "X pares", sem quebra por tamanho) porque a capacidade real
// da caixa varia por negócio; são pontos de partida editáveis, não valores fixos.
const DEFAULT_PACKAGING = [
  { name: 'Caixa 6 Pares', description: 'Ponto de partida — ajuste a capacidade se sua caixa for diferente', metadata: { mode: 'FREE', capacity: 6, sizes: [], sizeQuantities: {} } },
  { name: 'Caixa 12 Pares', description: 'Ponto de partida — ajuste a capacidade se sua caixa for diferente', metadata: { mode: 'FREE', capacity: 12, sizes: [], sizeQuantities: {} } },
];

// Sugestão de nomes de Componente/Peça pro botão "Carregar Peças Padrão" — mesma ideia do
// DEFAULT_UNITS acima, só aparece quando a conta ainda não tem nenhuma cadastrada.
const DEFAULT_PECAS: { name: string; pieceType: 'ENTRADA' | 'PECA' }[] = [
  { name: 'LATERAL', pieceType: 'PECA' },
  { name: 'FRENTE', pieceType: 'PECA' },
  { name: 'CAIXA COLETIVA', pieceType: 'PECA' },
  { name: 'CAIXA UNITARIA', pieceType: 'PECA' },
  { name: 'COLA PVC', pieceType: 'ENTRADA' },
  { name: 'COLA SPRAY', pieceType: 'ENTRADA' },
];

interface ProductionConfigViewProps {
  flowTags?: FlowTag[];
  sectors?: Sector[];
  productionConfigs?: ProductionConfigItem[];
  onSaveFlowTag: (tag: FlowTag) => Promise<void>;
  onDeleteFlowTag: (id: string) => Promise<void>;
  // Cadastro rápido de Fluxo/Setor sem sair da tela de origem (ex: Solados) — diferente de
  // onSaveFlowTag (usado pela própria tela de gestão de Flow Tags), este retorna o registro
  // criado (com id) pra já poder ser selecionado no formulário que chamou.
  onQuickAddFlowTag?: (tag: Omit<FlowTag, 'id'>) => Promise<FlowTag>;
  // Cadastro rápido de Categoria (ex: categoria de Solado) sem sair da tela de origem —
  // retorna o registro criado (com id) mesmo a Categoria em si guardando só o nome (string)
  // nos metadados do item, igual já acontece com Categoria Mestre de Insumos.
  onQuickAddCategory?: (category: Omit<Category, 'id'>) => Promise<Category>;
  // Cadastro rápido de Fornecedor sem sair do cadastro de Solados — mesmo padrão já usado em
  // PurchaseFormView/SaleFormView (PersonModal + onQuickAddPerson).
  onQuickAddPerson?: (person: Omit<Person, 'id'>) => Promise<Person>;
  // Cadastro rápido de Insumo (Material) sem sair do cadastro de Solados — mesmo padrão
  // (retorna o item criado, com id) já usado por onQuickAddFlowTag/onQuickAddCategory.
  onQuickAddMaterial?: (item: Omit<ProductionConfigItem, 'id'>) => Promise<ProductionConfigItem>;
  // Cadastro rápido de Cor — usado pelos campos "Cores Disponíveis" (MaterialFormFields).
  onQuickAddColor?: (color: Omit<ColorValue, 'id'>) => Promise<ColorValue>;
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
  onCreateGrid?: (grid: Omit<Grid, 'id'>) => Promise<void>;
  onUpdateGrid?: (id: string, grid: Omit<Grid, 'id'>) => Promise<void>;
  onDeleteGrid?: (id: string) => Promise<void>;
  categories?: any[];
  initialScreen?: ProductionScreenType;
  onNavigate?: (view: ViewType) => void;
  onAddProduct?: () => void;
  onNavigateGrids?: () => void;
  lots?: ProductionLot[];
  products?: Product[];
  soleStock?: SoleStockEntry[];
  // true = acesso restrito só à tela Embalagens — pensado pra contas sem o módulo de Produção
  // (revendedor) que ainda assim precisam cadastrar grade/composição por tamanho de caixa (ver
  // "Converter em Pares" em Estoque e "Transformar em Varejo ao Receber" em Compras). Com isso
  // ligado, sair da tela de Embalagens (fechar o modal ou "Voltar" dentro dela) chama `onBack`
  // direto em vez de `setCurrentScreen('MENU')` — o menu com Facas/Matrizes/Fichas etc. (tudo
  // que só faz sentido com Produção) nunca chega a renderizar.
  restrictToPackaging?: boolean;
  // true = acesso restrito só à tela Facas de Corte — usado pelo atalho "Não encontrou? Cadastre
  // uma faca completa aqui" de dentro da Ficha Técnica (EngineeringEditor), pra reaproveitar o
  // formulário completo (categoria/grade com criação inline) sem duplicar essa lógica. Mesmo
  // padrão de restrictToPackaging acima: fechar chama `onBack` direto, sem passar pelo MENU.
  restrictToFacas?: boolean;
  // true = acesso restrito só à tela Catálogo de Insumos — mesmo uso do restrictToFacas acima,
  // pro atalho "Não encontrou o material? Cadastre um material aqui" da Ficha Técnica.
  restrictToInsumos?: boolean;
  onStartJourney?: (journeyId: string) => void;
  // Unidades de Medida sugeridas pro botão "Carregar Unidades Padrão" — vem do Firestore
  // (appDefaultUnits/units, ver defaultUnitsService.ts) quando a conta de desenvolvimento já
  // publicou um padrão customizado; cai em DEFAULT_UNITS (hardcoded acima) enquanto isso não
  // acontece. onSaveDefaultUnits só aparece pra quem já é dev (ver isTemplateAdmin()).
  defaultUnits?: DefaultUnitItem[] | null;
  onSaveDefaultUnits?: (items: DefaultUnitItem[]) => void | Promise<void>;
  // Bolinha pulsante em "Modelos Disponíveis" de Embalagens, ver Etapa 6 do Assistente de
  // Configuração (mesmo mecanismo de CategoriesView/ColorsView/GradesView).
  guideActive?: boolean;
}

// Quando a conjugação é < 1, a faca precisa de mais de 1 batida para formar 1 par
// (ex.: 0.5 PR/BAT = 2 batidas por par). Exibe nesse caso como "X BAT/PR" para facilitar a leitura.
function formatConjugationLabel(conjugation: number): string {
  if (conjugation > 0 && conjugation < 1) {
    return `${Math.round(1 / conjugation)} BAT/PR`;
  }
  return `${conjugation} PR/BAT`;
}

export default function ProductionConfigView({
  flowTags = [],
  sectors = [],
  productionConfigs = [],
  onSaveFlowTag,
  onDeleteFlowTag,
  onQuickAddFlowTag,
  onQuickAddCategory,
  onQuickAddPerson,
  onQuickAddMaterial,
  onQuickAddColor,
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
  onCreateGrid,
  onUpdateGrid,
  onDeleteGrid,
  categories = [],
  initialScreen = 'MENU',
  onNavigate,
  onAddProduct,
  onNavigateGrids,
  lots = [],
  products = [],
  soleStock = [],
  restrictToPackaging = false,
  restrictToFacas = false,
  restrictToInsumos = false,
  onStartJourney,
  defaultUnits,
  onSaveDefaultUnits,
  guideActive,
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

  // Modelos de Flow Tag e Setor salvos por qualquer conta (coleções compartilhadas, fora de
  // users/{uid}) — pool de sugestões prontas pra tocar e adicionar, alimentada pelo botão de
  // marcador em cada item já cadastrado (ver handleSaveFlowTagAsTemplate/
  // handleSaveSectorAsTemplate e handleAddFlowTagFromTemplate/handleAddSectorFromTemplate).
  const [flowTagTemplates, setFlowTagTemplates] = useState<FlowTagTemplate[]>([]);
  const [sectorTemplates, setSectorTemplates] = useState<SectorTemplate[]>([]);
  const [flowTagTemplatesOpen, setFlowTagTemplatesOpen] = useState(false);
  const [sectorTemplatesOpen, setSectorTemplatesOpen] = useState(false);
  useEffect(() => {
    const unsub = subscribeToFlowTagTemplates(setFlowTagTemplates);
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = subscribeToSectorTemplates(setSectorTemplates);
    return () => unsub();
  }, []);

  const isFlowTagSavedAsTemplate = (tag: FlowTag) =>
    flowTagTemplates.some(t => t.name.toUpperCase() === tag.name.toUpperCase());

  const handleSaveFlowTagAsTemplate = (tag: FlowTag) => {
    if (isFlowTagSavedAsTemplate(tag)) return;
    saveFlowTagTemplate({ name: tag.name, subcategories: tag.subcategories });
  };

  const handleAddFlowTagFromTemplate = (template: FlowTagTemplate) => {
    const exists = flowTags.some(t => t.name.toUpperCase() === template.name.toUpperCase());
    if (exists) return;
    onSaveFlowTag({ id: '', name: template.name, subcategories: template.subcategories, isCuttingFlowTag: false });
  };

  const isSectorSavedAsTemplate = (sector: Sector) =>
    sectorTemplates.some(t => t.name.toUpperCase() === sector.name.toUpperCase());

  const handleSaveSectorAsTemplate = (sector: Sector) => {
    if (isSectorSavedAsTemplate(sector)) return;
    const flowTagNames = (sector.flowTagIds || [])
      .map(id => flowTags.find(t => t.id === id)?.name)
      .filter((name): name is string => !!name);
    saveSectorTemplate({
      name: sector.name,
      color: sector.color,
      flowTagNames,
      isProductionCycleEnd: sector.isProductionCycleEnd,
      defaultServiceValue: sector.defaultServiceValue,
    });
  };

  // Puxar um modelo de Setor precisa resolver cada nome de Flow Tag salvo no modelo pra um id
  // real na conta atual — os ids do modelo são de outra conta e não existem aqui. Se já existe
  // uma tag com o mesmo nome (case-insensitive), reaproveita; senão cria na hora com
  // onQuickAddFlowTag (mesmo mecanismo já usado pra criação rápida de Flow Tag a partir de
  // outros formulários, ex.: cadastro de Solado).
  const handleAddSectorFromTemplate = async (template: SectorTemplate) => {
    const exists = sectors.some(s => s.name.toUpperCase() === template.name.toUpperCase());
    if (exists) return;
    const resolvedIds: string[] = [];
    for (const name of template.flowTagNames) {
      const existingTag = flowTags.find(t => t.name.toUpperCase() === name.toUpperCase());
      if (existingTag) {
        resolvedIds.push(existingTag.id);
      } else if (onQuickAddFlowTag) {
        const created = await onQuickAddFlowTag({ name, subcategories: [], isCuttingFlowTag: false });
        resolvedIds.push(created.id);
      }
    }
    await onSaveSector({
      id: '',
      name: template.name,
      color: template.color,
      order: sectors.length,
      flowTagIds: resolvedIds,
      isProductionCycleEnd: template.isProductionCycleEnd,
      defaultServiceValue: template.defaultServiceValue,
      hidden: false,
    });
  };

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

  const moldCategoryNames = useMemo(() => {
    const fromSystem = categories
      .filter(c => c.type === CategoryType.MOLD)
      .map(c => c.name.toUpperCase());

    if (fromSystem.length > 0) return fromSystem;
    return ['GERAL', 'SOLADO', 'SALTO', 'PALMILHA'];
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
    if (editingTag.isCuttingFlowTag) {
      const previousCuttingTag = flowTags.find(t => t.id !== editingTag.id && t.isCuttingFlowTag);
      if (previousCuttingTag) {
        await onSaveFlowTag({ ...previousCuttingTag, isCuttingFlowTag: false });
      }
    }
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

  // Quantos lotes estão NO MOMENTO ATUAL neste setor (passo presente da rota) — não
  // conta lotes que já passaram por aqui nem os que ainda vão chegar. É diferente de
  // "lote ativo" (não finalizado): um lote ativo que já saiu deste setor não bloqueia.
  const getSectorPendingCount = (sectorId: string): number => {
    return lots.filter(l => !l.finishedAt && l.route?.[l.currentSectorIndex] === sectorId).length;
  };

  const handleToggleSectorHidden = async (sector: Sector) => {
    if (!sector.hidden) {
      const pendingCount = getSectorPendingCount(sector.id);
      if (pendingCount > 0) {
        toast.show(`Não é possível ocultar "${sector.name}": há ${pendingCount} ${pendingCount === 1 ? 'pedido no setor' : 'pedidos no setor'} agora. Conclua ou mova-os antes de ocultar.`);
        return;
      }
      if (!confirm(`Ocultar o setor "${sector.name}"? Ele deixará de aparecer no PCP (painel de setores, seletores etc.) até ser exibido novamente.`)) return;
      await onSaveSector({ ...sector, hidden: true });
      toast.show(`Setor "${sector.name}" ocultado.`);
      return;
    }
    await onSaveSector({ ...sector, hidden: false });
    toast.show(`Setor "${sector.name}" voltou a aparecer no PCP.`);
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
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Essas configurações agora ficam no Menu Mais
                </p>
                <p className="text-[10px] text-slate-400 max-w-xs">
                  Setores, Etapas, Prazos, Solados, Materiais, Unidades, Facas, Peças e Embalagens foram centralizados em Mais {'>'} Módulo de Produção, pra facilitar o acesso.
                </p>
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
              data-guide-anchor="sector.novo"
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
                pendingCount={getSectorPendingCount(sector.id)}
                isSavedAsTemplate={isSectorSavedAsTemplate(sector)}
                onEdit={() => {
                  setEditingSector({ ...sector });
                  setIsAddingSector(false);
                }}
                onDelete={() => onDeleteSector(sector.id)}
                onToggleHidden={() => handleToggleSectorHidden(sector)}
                onSaveAsTemplate={() => handleSaveSectorAsTemplate(sector)}
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

          <div className="rounded-[2rem] border-2 overflow-hidden bg-violet-50/30 dark:bg-violet-950/20 border-violet-100/50 dark:border-violet-900/30">
            <button
              type="button"
              onClick={() => setSectorTemplatesOpen(o => !o)}
              data-guide-anchor="sector.modelosToggle"
              className="w-full flex items-center justify-between px-4 py-3 text-violet-600 dark:text-violet-400"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} />
                <span className="text-[11px] font-black uppercase tracking-widest">Modelos Disponíveis</span>
              </div>
              <ChevronDown size={16} className={`transition-transform duration-200 ${sectorTemplatesOpen ? 'rotate-180' : ''}`} />
            </button>
            {sectorTemplatesOpen && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                <p className="w-full text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-snug">
                  Toque num modelo abaixo para adicioná-lo aos seus setores.
                </p>
                {sectorTemplates.length === 0 && (
                  <p className="text-[10px] font-bold text-slate-400 italic py-2">Nenhum modelo disponível ainda.</p>
                )}
                {sectorTemplates.map(template => {
                    const exists = sectors.some(s => s.name.toUpperCase() === template.name.toUpperCase());
                    return (
                      <button
                        type="button"
                        key={template.id}
                        onClick={() => handleAddSectorFromTemplate(template)}
                        data-guide-anchor="sector.modeloAdicionar"
                        disabled={exists}
                        title={`Adicionar modelo: ${template.name}`}
                        className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${
                          exists
                            ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 border-transparent'
                            : 'bg-white dark:bg-slate-900 text-violet-600 border-violet-100 hover:border-violet-500 dark:text-violet-400 dark:border-violet-900 shadow-sm active:scale-95'
                        }`}
                      >
                        {template.name} {exists && '✓'}
                      </button>
                    );
                  })}
                </div>
              )}
              {sectorTemplatesOpen && onStartJourney && (
                <button
                  type="button"
                  onClick={() => onStartJourney('tour_cadastrar_setor')}
                  data-guide-anchor="sector.naoAchouModelo"
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-3 border-t border-violet-100/50 dark:border-violet-900/30 text-[10px] font-black uppercase tracking-widest text-violet-500 hover:text-violet-600 transition-colors"
                >
                  Não achou um modelo? Veja como criar uma nova
                </button>
              )}
            </div>
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
                setEditingTag({ id: '', name: '', subcategories: [], isCuttingFlowTag: false });
                setIsAddingTag(true);
              }}
              title="Adicionar Flow Tag"
              aria-label="Adicionar nova flow tag de processo"
              data-guide-anchor="flowtag.novo"
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
                    <div className="flex items-center gap-2">
                      <p className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tag.name}</p>
                      {tag.isCuttingFlowTag && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-indigo-600 text-white tracking-widest">Corte</span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {tag.subcategories.length} {tag.subcategories.length === 1 ? 'Subcategoria' : 'Subcategorias'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isTemplateAdmin() && (
                    <button
                      onClick={() => handleSaveFlowTagAsTemplate(tag)}
                      data-guide-anchor="flowtag.salvarModelo"
                      disabled={isFlowTagSavedAsTemplate(tag)}
                      title={isFlowTagSavedAsTemplate(tag) ? 'Usada como exemplo pra novas contas' : 'Usar como exemplo pra novas contas'}
                      aria-label={isFlowTagSavedAsTemplate(tag) ? `${tag.name} já é um modelo disponível` : `Usar ${tag.name} como exemplo pra novas contas`}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isFlowTagSavedAsTemplate(tag)
                          ? 'text-violet-500'
                          : isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-violet-400' : 'bg-slate-50 text-slate-400 hover:text-violet-600'
                      }`}
                    >
                      {isFlowTagSavedAsTemplate(tag) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingTag({ ...tag });
                      setIsAddingTag(false);
                    }}
                    data-guide-anchor="flowtag.editar"
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
                    data-guide-anchor="flowtag.excluir"
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

          <div className="rounded-[2rem] border-2 overflow-hidden bg-violet-50/30 dark:bg-violet-950/20 border-violet-100/50 dark:border-violet-900/30">
            <button
              type="button"
              onClick={() => setFlowTagTemplatesOpen(o => !o)}
              data-guide-anchor="flowtag.modelosToggle"
              className="w-full flex items-center justify-between px-4 py-3 text-violet-600 dark:text-violet-400"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} />
                <span className="text-[11px] font-black uppercase tracking-widest">Modelos Disponíveis</span>
              </div>
              <ChevronDown size={16} className={`transition-transform duration-200 ${flowTagTemplatesOpen ? 'rotate-180' : ''}`} />
            </button>
            {flowTagTemplatesOpen && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                <p className="w-full text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-snug">
                  Toque num modelo abaixo para adicioná-lo às suas Flow Tags.
                </p>
                {flowTagTemplates.length === 0 && (
                  <p className="text-[10px] font-bold text-slate-400 italic py-2">Nenhum modelo disponível ainda.</p>
                )}
                {flowTagTemplates.map(template => {
                    const exists = flowTags.some(t => t.name.toUpperCase() === template.name.toUpperCase());
                    return (
                      <button
                        type="button"
                        key={template.id}
                        onClick={() => handleAddFlowTagFromTemplate(template)}
                        data-guide-anchor="flowtag.modeloAdicionar"
                        disabled={exists}
                        title={`Adicionar modelo: ${template.name}`}
                        className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${
                          exists
                            ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 border-transparent'
                            : 'bg-white dark:bg-slate-900 text-violet-600 border-violet-100 hover:border-violet-500 dark:text-violet-400 dark:border-violet-900 shadow-sm active:scale-95'
                        }`}
                      >
                        {template.name} {exists && '✓'}
                      </button>
                    );
                  })}
                </div>
              )}
              {flowTagTemplatesOpen && onStartJourney && (
                <button
                  type="button"
                  onClick={() => onStartJourney('tour_cadastrar_flowtag')}
                  data-guide-anchor="flowtag.naoAchouModelo"
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-3 border-t border-violet-100/50 dark:border-violet-900/30 text-[10px] font-black uppercase tracking-widest text-violet-500 hover:text-violet-600 transition-colors"
                >
                  Não achou um modelo? Veja como criar uma nova
                </button>
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
          seedDefaults={defaultUnits ?? DEFAULT_UNITS}
          seedButtonLabel="Carregar Unidades Padrão"
          onSaveAsDefault={onSaveDefaultUnits}
          productionConfigs={productionConfigs}
          people={people}
          onNavigateToScreen={handleNavigateShortcut}
          guideActive={guideActive && currentScreen === 'UNIDADES'}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'FACAS'}
        onClose={restrictToFacas ? onBack : () => setCurrentScreen('MENU')}
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
          onBack={restrictToFacas ? onBack : () => setCurrentScreen('MENU')}
          placeholderLabel="Nenhuma faca cadastrada"
          productionConfigs={productionConfigs}
          people={people}
          colors={colors}
          grids={grids}
          onCreateGrid={onCreateGrid}
          onUpdateGrid={onUpdateGrid}
          onDeleteGrid={onDeleteGrid}
          toolCategoryNames={toolCategoryNames}
          onQuickAddCategory={onQuickAddCategory}
          products={products}
          sectors={sectors}
          onNavigateToScreen={restrictToFacas ? undefined : handleNavigateShortcut}
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
        onClose={restrictToPackaging ? onBack : () => setCurrentScreen('MENU')}
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
          onBack={restrictToPackaging ? onBack : () => setCurrentScreen('MENU')}
          placeholderLabel="Nenhum padrão de embalagem"
          seedDefaults={DEFAULT_PACKAGING}
          seedButtonLabel="Carregar Padrões de Embalagem"
          productionConfigs={productionConfigs}
          people={people}
          grids={grids}
          onCreateGrid={onCreateGrid}
          onUpdateGrid={onUpdateGrid}
          onDeleteGrid={onDeleteGrid}
          onNavigateToScreen={restrictToPackaging ? undefined : handleNavigateShortcut}
          zIndex={60000}
          guideActive={guideActive && currentScreen === 'EMBALAGENS'}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'PECAS'}
        onClose={() => setCurrentScreen('MENU')}
        title="Nome do Componente e Peça"
        zIndex={60000}
      >
        <PecasConfig
          title="Nome do Componente e Peça"
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
        onClose={restrictToInsumos ? onBack : () => setCurrentScreen('MENU')}
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
          onBack={restrictToInsumos ? onBack : () => setCurrentScreen('MENU')}
          placeholderLabel="Nenhum insumo cadastrado"
          productionConfigs={productionConfigs}
          people={people}
          supplyCategoryNames={supplyCategoryNames}
          colors={colors}
          flowTags={flowTags}
          onQuickAddCategory={onQuickAddCategory}
          onQuickAddFlowTag={onQuickAddFlowTag}
          onQuickAddPerson={onQuickAddPerson}
          onQuickAddMaterial={onQuickAddMaterial}
          onQuickAddColor={onQuickAddColor}
          onNavigateToScreen={restrictToInsumos ? undefined : handleNavigateShortcut}
          zIndex={60000}
          purchaseNeeds={purchaseNeeds}
        />
      </Modal>

      <Modal
        isOpen={currentScreen === 'MATRIZES'}
        onClose={() => setCurrentScreen('MENU')}
        title="Cadastro de Solados"
        zIndex={60000}
      >
        <ErrorBoundary label="Cadastro de Solados">
          <GenericConfigList
            title="Cadastro de Solados"
            label="CADASTRO DE SOLADOS"
            items={productionConfigs}
            type="MOLD"
            icon={<Grid3X3 size={22} />}
            isDarkMode={isDarkMode}
            onSave={onSaveConfigItem}
            onDelete={onDeleteConfigItem}
            onBack={() => setCurrentScreen('MENU')}
            placeholderLabel="Nenhuma sola cadastrada"
            people={people}
            colors={colors}
            grids={grids}
            onCreateGrid={onCreateGrid}
            onUpdateGrid={onUpdateGrid}
            onDeleteGrid={onDeleteGrid}
            flowTags={flowTags}
            onQuickAddFlowTag={onQuickAddFlowTag}
            moldCategoryNames={moldCategoryNames}
            onQuickAddCategory={onQuickAddCategory}
            onQuickAddPerson={onQuickAddPerson}
            onQuickAddMaterial={onQuickAddMaterial}
            onQuickAddColor={onQuickAddColor}
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
            data-guide-anchor="prodcfg.voltarInicio"
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

          <label className="flex items-center gap-4 cursor-pointer select-none px-1">
            <div className={`relative w-11 h-6 rounded-full transition-all duration-200 shrink-0 ${editingTag?.isCuttingFlowTag ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <input
                type="checkbox"
                checked={!!editingTag?.isCuttingFlowTag}
                onChange={(e) => setEditingTag(prev => prev ? { ...prev, isCuttingFlowTag: e.target.checked } : null)}
                className="sr-only"
              />
              <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-200 ${editingTag?.isCuttingFlowTag ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest block text-slate-700 dark:text-slate-200">Tag de Corte</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                Define esta etapa como o gatilho da Área de Corte (somente uma tag pode ser marcada)
              </span>
            </div>
          </label>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subcategorias (Serviços)</label>
              <button
                type="button"
                onClick={handleAddSubcategory}
                data-guide-anchor="flowtag.adicionarSubcategoria"
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
                    data-guide-anchor="flowtag.removerSubcategoria"
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
            data-guide-anchor="flowtag.salvar"
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

          <div className="flex flex-col gap-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Flow Tags do Setor (Obrigações)</label>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
              <Info size={18} className="shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold leading-relaxed normal-case tracking-normal">
                Flow Tags são as etapas/obrigações que este setor acompanha durante a produção (ex.: "Cabedal Solado", "Palmilha", "Peças Cortadas"). Marque aqui as que se aplicam a este setor — elas viram as opções de status que um pedido pode assumir enquanto estiver aqui, tanto no Monitor PCP quanto na etiqueta/ficha impressa. Um setor pode ter mais de uma marcada.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {flowTags.map((tag) => {
                const isSelected = editingSector?.flowTagIds?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTagInSector(tag.id)}
                    data-guide-anchor="sector.flowTagToggle"
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
            type="button"
            onClick={() => setEditingSector(prev => prev ? { ...prev, isProductionCycleEnd: !prev.isProductionCycleEnd } : null)}
            data-guide-anchor="sector.fimCicloToggle"
            className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left ${editingSector?.isProductionCycleEnd
              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
              : (isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-500' : 'border-slate-100 bg-white text-slate-400')
              }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${editingSector?.isProductionCycleEnd ? 'bg-indigo-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`}>
              <CheckCircle2 size={18} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={`text-[11px] font-black uppercase tracking-tight ${editingSector?.isProductionCycleEnd ? 'text-indigo-900 dark:text-white' : ''}`}>Fim do Ciclo de Produção</span>
              <span className="text-[10px] font-bold normal-case tracking-normal opacity-80">Ao chegar aqui, o pedido pode ser finalizado individualmente (baixa de estoque/reserva), sem depender do nome do setor. <span className="text-red-600 dark:text-red-400 font-black">Só clique se aqui acontece o final da sua produção.</span></span>
            </div>
            {editingSector?.isProductionCycleEnd && <div className="ml-auto w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0"><Check size={12} className="text-white" strokeWidth={4} /></div>}
          </button>

          <button
            type="submit"
            data-guide-anchor="sector.salvar"
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
  seedButtonLabel,
  onSaveAsDefault,
  people = [],
  colors = [],
  flowTags = [],
  productionConfigs = [],
  grids = [],
  onCreateGrid,
  onUpdateGrid,
  onDeleteGrid,
  onQuickAddFlowTag,
  moldCategoryNames = [],
  onQuickAddCategory,
  onQuickAddPerson,
  onQuickAddMaterial,
  onQuickAddColor,
  supplyCategoryNames = [],
  toolCategoryNames = [],
  products = [],
  onNavigateToScreen,
  zIndex = 60000,
  soleStock = [],
  purchaseNeeds = {},
  sectors = [],
  guideActive = false,
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
  // `metadata` é opcional — só usado por tipos que precisam de mais do que nome+descrição pra
  // já nascer utilizável (ex.: PACKAGING, que sem `metadata.capacity` fica um registro vazio).
  seedDefaults?: { name: string; description: string; metadata?: any }[];
  // Texto do botão "Carregar Padrão" — cada tipo usa um rótulo próprio (Unidades, Embalagens
  // etc.); sem isso o botão sempre dizia "Carregar Unidades Padrão" mesmo pra outros tipos.
  seedButtonLabel?: string;
  // Só a conta de desenvolvimento vê o botão que chama isto — grava os itens ATUAIS deste tipo
  // como o novo `seedDefaults` que contas novas verão no botão "Carregar Padrão" (ver
  // defaultUnitsService.ts; hoje só passado pra type="UNIT").
  onSaveAsDefault?: (items: { name: string; description: string }[]) => void | Promise<void>;
  people?: Person[];
  colors?: ColorValue[];
  flowTags?: FlowTag[];
  productionConfigs?: ProductionConfigItem[];
  grids?: Grid[];
  onCreateGrid?: (grid: Omit<Grid, 'id'>) => Promise<void>;
  onUpdateGrid?: (id: string, grid: Omit<Grid, 'id'>) => Promise<void>;
  onDeleteGrid?: (id: string) => Promise<void>;
  onQuickAddFlowTag?: (tag: Omit<FlowTag, 'id'>) => Promise<FlowTag>;
  moldCategoryNames?: string[];
  onQuickAddCategory?: (category: Omit<Category, 'id'>) => Promise<Category>;
  onQuickAddPerson?: (person: Omit<Person, 'id'>) => Promise<Person>;
  onQuickAddMaterial?: (item: Omit<ProductionConfigItem, 'id'>) => Promise<ProductionConfigItem>;
  onQuickAddColor?: (color: Omit<ColorValue, 'id'>) => Promise<ColorValue>;
  supplyCategoryNames?: string[];
  toolCategoryNames?: string[];
  products?: Product[];
  onNavigateToScreen?: (screen: ProductionScreenType | ViewType) => void;
  zIndex?: number;
  soleStock?: SoleStockEntry[];
  purchaseNeeds?: Record<string, number>;
  sectors?: Sector[];
  guideActive?: boolean;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionConfigItem | null>(null);
  // Categoria de Insumo (Catálogo de Insumos) abre num popup com os itens dela, em vez de
  // expandir inline — null = nenhum popup aberto.
  const [openMaterialCategoryPopup, setOpenMaterialCategoryPopup] = useState<string | null>(null);
  const [materialCategoryPopupSearch, setMaterialCategoryPopupSearch] = useState('');

  // "Modelos Disponíveis" de Padrão de Embalagem (só type === 'PACKAGING') — mesmo desenho de
  // GradesView.tsx (templates compartilhados entre contas, com prévia expansível), mas carrega
  // mode/capacity/sizeQuantities pra já nascer utilizável (embalagem sem isso é um registro
  // vazio, diferente de uma grade que só precisa das numerações).
  const [packagingTemplates, setPackagingTemplates] = useState<PackagingTemplate[]>([]);
  const [packagingTemplatesOpen, setPackagingTemplatesOpen] = useState(false);
  const [expandedPackagingTemplateId, setExpandedPackagingTemplateId] = useState<string | null>(null);
  useEffect(() => {
    if (type !== 'PACKAGING') return;
    const unsub = subscribeToPackagingTemplates(setPackagingTemplates);
    return () => unsub();
  }, [type]);

  const findPackagingTemplateFor = (item: ProductionConfigItem) =>
    packagingTemplates.find(t => t.name.toUpperCase() === item.name.toUpperCase());
  const isSavedAsPackagingTemplate = (item: ProductionConfigItem) => !!findPackagingTemplateFor(item);

  // Toggle real — igual handleToggleTemplate de GradesView: tocar de novo numa já marcada
  // desmarca (apaga o modelo compartilhado).
  const handleTogglePackagingTemplate = (item: ProductionConfigItem) => {
    const existing = findPackagingTemplateFor(item);
    if (existing) {
      deletePackagingTemplate(existing.id);
    } else {
      savePackagingTemplate({
        name: item.name,
        mode: item.metadata?.mode === 'FREE' ? 'FREE' : 'FIXED',
        capacity: item.metadata?.capacity || 0,
        sizes: item.metadata?.sizes || [],
        sizeQuantities: item.metadata?.sizeQuantities || {},
      });
    }
  };

  const handleAddFromPackagingTemplate = (template: PackagingTemplate) => {
    const exists = items.some(i => i.type === 'PACKAGING' && i.name.toUpperCase() === template.name.toUpperCase());
    if (exists) return;
    onSave({
      id: '',
      name: template.name,
      description: '',
      type: 'PACKAGING',
      createdAt: Date.now(),
      metadata: { mode: template.mode, capacity: template.capacity, sizes: template.sizes, sizeQuantities: template.sizeQuantities },
    } as any);
  };

  // "Modelos Disponíveis" de Unidade de Medida (só type === 'UNIT') — mesmo desenho de
  // CategoriesView.tsx (chips simples, sem prévia expansível, já que unidade é só nome +
  // descrição). Complementa "Carregar Unidades Padrão" (seedDefaults/DEFAULT_UNITS), que
  // carrega um conjunto fixo de uma vez só — aqui dá pra ir adicionando modelo a modelo.
  const [unitTemplates, setUnitTemplates] = useState<UnitTemplate[]>([]);
  const [unitTemplatesOpen, setUnitTemplatesOpen] = useState(false);
  useEffect(() => {
    if (type !== 'UNIT') return;
    const unsub = subscribeToUnitTemplates(setUnitTemplates);
    return () => unsub();
  }, [type]);

  const findUnitTemplateFor = (item: ProductionConfigItem) =>
    unitTemplates.find(t => t.name.toUpperCase() === item.name.toUpperCase());
  const isSavedAsUnitTemplate = (item: ProductionConfigItem) => !!findUnitTemplateFor(item);

  const handleToggleUnitTemplate = (item: ProductionConfigItem) => {
    const existing = findUnitTemplateFor(item);
    if (existing) deleteUnitTemplate(existing.id);
    else saveUnitTemplate({ name: item.name, description: item.description || '' });
  };

  const handleAddFromUnitTemplate = (template: UnitTemplate) => {
    const exists = items.some(i => i.type === 'UNIT' && i.name.toUpperCase() === template.name.toUpperCase());
    if (exists) return;
    onSave({ id: '', name: template.name, description: template.description, type: 'UNIT', createdAt: Date.now(), metadata: {} } as any);
  };
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [newSize, setNewSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProductFilter, setSelectedProductFilter] = useState('');
  const [isProductFilterPickerOpen, setIsProductFilterPickerOpen] = useState(false);
  const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
  const [isColorWeightsModalOpen, setIsColorWeightsModalOpen] = useState(false);
  const [gridSuccess, setGridSuccess] = useState(false);
  const [isGridSearchOpen, setIsGridSearchOpen] = useState(false);
  const [gridSearchTerm, setGridSearchTerm] = useState('');
  const [isCreatingGridInline, setIsCreatingGridInline] = useState(false);
  const [editingGridId, setEditingGridId] = useState<string | null>(null);
  const [newGridName, setNewGridName] = useState('');
  const [newGridSizes, setNewGridSizes] = useState<string[]>([]);
  const [newGridSizeInput, setNewGridSizeInput] = useState('');
  // "Buscar Padrão de Embalagem" — mesmo desenho do "Buscar Grade" do Molde acima (isGridSearchOpen
  // etc.), só que salva/aplica GridType.EMBALAGEM em vez de SOLADO, e escreve em sizeQuantities
  // (não sizeWeights). Duplicado em vez de generalizado pra não arriscar mexer no fluxo do Molde,
  // que já está em produção.
  const [isProductionGradeSearchOpen, setIsProductionGradeSearchOpen] = useState(false);
  const [productionGradeSearchTerm, setProductionGradeSearchTerm] = useState('');
  const [isCreatingProductionGradeInline, setIsCreatingProductionGradeInline] = useState(false);
  const [editingProductionGradeId, setEditingProductionGradeId] = useState<string | null>(null);
  const [newProductionGradeName, setNewProductionGradeName] = useState('');
  const [newProductionGradeSizes, setNewProductionGradeSizes] = useState<string[]>([]);
  const [newProductionGradeSizeInput, setNewProductionGradeSizeInput] = useState('');
  const [isFlowTagPickerOpen, setIsFlowTagPickerOpen] = useState(false);
  const [flowTagSearch, setFlowTagSearch] = useState('');
  const [isCreatingFlowTagInline, setIsCreatingFlowTagInline] = useState(false);
  const [newFlowTagName, setNewFlowTagName] = useState('');
  const [isMaterialPickerOpen, setIsMaterialPickerOpen] = useState(false);
  const [materialPickerTarget, setMaterialPickerTarget] = useState<'base' | number | null>(null);
  const [materialPickerSearch, setMaterialPickerSearch] = useState('');
  const [isCreatingMaterialInline, setIsCreatingMaterialInline] = useState(false);
  const [newMaterialItem, setNewMaterialItem] = useState<ProductionConfigItem | null>(null);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [isCreatingCategoryInline, setIsCreatingCategoryInline] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>(CategoryType.MOLD);
  // Picker de Categoria da Faca — estado independente do picker de Categoria do Solado acima
  // (isCategoryPickerOpen etc.), senão abrir um abriria os dois juntos (mesmo state
  // compartilhado). Sempre CategoryType.CUTTING_TOOL, então não precisa das abas de tipo que o
  // do Solado tem.
  const [isToolCategoryPickerOpen, setIsToolCategoryPickerOpen] = useState(false);
  const [toolCategorySearch, setToolCategorySearch] = useState('');
  const [isCreatingToolCategoryInline, setIsCreatingToolCategoryInline] = useState(false);
  const [newToolCategoryName, setNewToolCategoryName] = useState('');

  // Picker de Grade da Faca — mesmo motivo acima: estado próprio, não reaproveita
  // isGridSearchOpen/newGridName/etc. (aqueles são do Solado, tipo GridType.SOLADO).
  const [isFacaGridSearchOpen, setIsFacaGridSearchOpen] = useState(false);
  const [facaGridSearchTerm, setFacaGridSearchTerm] = useState('');
  const [isCreatingFacaGridInline, setIsCreatingFacaGridInline] = useState(false);
  const [editingFacaGridId, setEditingFacaGridId] = useState<string | null>(null);
  const [newFacaGridName, setNewFacaGridName] = useState('');
  const [newFacaGridSizes, setNewFacaGridSizes] = useState<string[]>([]);
  const [newFacaGridSizeInput, setNewFacaGridSizeInput] = useState('');

  const [isSupplierPickerOpen, setIsSupplierPickerOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isQuickPersonModalOpen, setIsQuickPersonModalOpen] = useState(false);
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

  // As 3 perguntas de Solado (materiais/serviços/peso) inferem o valor inicial do togle a
  // partir de dado já cadastrado — nunca escondem, por padrão, composição/serviços/pesos que
  // uma matriz já tinha antes dessas perguntas existirem.
  const moldBuysReadySole = editingItem?.metadata?.buysReadySole ?? false;
  const moldBuysMaterials = editingItem?.metadata?.buysMaterials
    ?? ((editingItem?.metadata?.composition?.length ?? 0) > 0 || !!editingItem?.metadata?.baseMaterialId);
  const moldHasSoleServices = editingItem?.metadata?.hasSoleServices
    ?? ((editingItem?.metadata?.extraServices?.length ?? 0) > 0);
  const moldTracksWeight = editingItem?.metadata?.tracksWeight
    ?? (Object.values(editingItem?.metadata?.sizeWeights ?? {}).some(w => (w as number) > 0)
      || Object.keys(editingItem?.metadata?.colorWeights ?? {}).length > 0);

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

    // Validação dos campos obrigatórios de Material — antes eram <select required>
    // (bloqueio nativo do navegador), migrados para ComboBox (sem suporte a required).
    if (type === 'MATERIAL') {
      if (!editingItem.metadata?.masterCategory) {
        toast.show('Selecione a Categoria Mestre.');
        return;
      }
      if (!editingItem.metadata?.unitId) {
        toast.show('Selecione a Unidade.');
        return;
      }
    }

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
      if (conjugation <= 0) {
        toast.show('A conjugação deve ser maior que 0');
        return;
      }
    }

    // Validation for Packaging Grade
    if (type === 'PACKAGING' && !(editingItem as any).metadata?.capacity) {
      toast.show('Faltou escolher a quantidade da grade.');
      return;
    }
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
        createdAt: Date.now(),
        ...(def.metadata ? { metadata: def.metadata } : {}),
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
          data-guide-anchor="mold.atalhoConfigurar"
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

  const applyGridToMold = (grid: Grid, sizesOverride?: string[]) => {
    const gridSizes = sizesOverride || (grid as any).sizes || (grid as any).items?.map((i: any) => i.size) || [];
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
    setIsGridSearchOpen(false);
    setIsCreatingGridInline(false);
    setEditingGridId(null);
    setGridSearchTerm('');
    setNewGridName('');
    setNewGridSizes([]);
    setNewGridSizeInput('');
  };

  const addNewGridSize = () => {
    const trimmed = newGridSizeInput.trim();
    if (trimmed !== '' && !newGridSizes.includes(trimmed)) {
      setNewGridSizes(prev => [...prev, trimmed]);
      setNewGridSizeInput('');
    }
  };

  const removeNewGridSize = (size: string) => {
    setNewGridSizes(prev => prev.filter(s => s !== size));
  };

  const startCreateGrid = () => {
    setEditingGridId(null);
    setNewGridName('');
    setNewGridSizes([]);
    setIsCreatingGridInline(true);
  };

  const startEditGrid = (grid: Grid) => {
    setEditingGridId(grid.id);
    setNewGridName(grid.name);
    setNewGridSizes(grid.sizes || []);
    setIsCreatingGridInline(true);
  };

  const handleDeleteGrid = async (grid: Grid) => {
    if (!onDeleteGrid) return;
    if (confirm(`Deseja excluir a grade "${grid.name}"? Essa ação não pode ser desfeita.`)) {
      await onDeleteGrid(grid.id);
    }
  };

  // Contraparte de applyGridToMold — a Faca guarda a grade escolhida em sizes/sizeAreas (não
  // sizeWeights), mesmo campo já usado no <select> antigo (ver metadata.sizeAreas acima).
  const applyGridToFaca = (grid: Grid, sizesOverride?: string[]) => {
    const gridSizes = sizesOverride || (grid as any).sizes || (grid as any).items?.map((i: any) => i.size) || [];
    setEditingItem(prev => {
      if (!prev) return null;
      const newSizeAreas = { ...(prev.metadata?.sizeAreas || {}) };
      gridSizes.forEach((s: string) => {
        if (newSizeAreas[s] === undefined) newSizeAreas[s] = 0;
      });
      return { ...prev, metadata: { ...prev.metadata, sizes: gridSizes, sizeAreas: newSizeAreas } };
    });
    setIsFacaGridSearchOpen(false);
    setIsCreatingFacaGridInline(false);
    setEditingFacaGridId(null);
    setFacaGridSearchTerm('');
    setNewFacaGridName('');
    setNewFacaGridSizes([]);
    setNewFacaGridSizeInput('');
  };

  const addNewFacaGridSize = () => {
    const trimmed = newFacaGridSizeInput.trim();
    if (trimmed !== '' && !newFacaGridSizes.includes(trimmed)) {
      setNewFacaGridSizes(prev => [...prev, trimmed]);
      setNewFacaGridSizeInput('');
    }
  };

  const removeNewFacaGridSize = (size: string) => {
    setNewFacaGridSizes(prev => prev.filter(s => s !== size));
  };

  const startCreateFacaGrid = () => {
    setEditingFacaGridId(null);
    setNewFacaGridName('');
    setNewFacaGridSizes([]);
    setIsCreatingFacaGridInline(true);
  };

  const startEditFacaGrid = (grid: Grid) => {
    setEditingFacaGridId(grid.id);
    setNewFacaGridName(grid.name);
    setNewFacaGridSizes(grid.sizes || []);
    setIsCreatingFacaGridInline(true);
  };

  const handleSaveInlineFacaGrid = async () => {
    if (!newFacaGridName.trim() || newFacaGridSizes.length === 0) return;
    if (editingFacaGridId) {
      if (!onUpdateGrid) return;
      const existing = grids.find(g => g.id === editingFacaGridId);
      const updated = { name: newFacaGridName.trim(), type: GridType.FACA, sizes: newFacaGridSizes, configuration: existing?.configuration || {} };
      await onUpdateGrid(editingFacaGridId, updated);
      applyGridToFaca({ id: editingFacaGridId, ...updated });
    } else {
      if (!onCreateGrid) return;
      await onCreateGrid({ name: newFacaGridName.trim(), type: GridType.FACA, sizes: newFacaGridSizes, configuration: {} });
      applyGridToFaca({ id: '', name: newFacaGridName.trim(), type: GridType.FACA, sizes: newFacaGridSizes, configuration: {} });
    }
  };

  const handleQuickCreateToolCategory = async () => {
    if (!newToolCategoryName.trim() || !onQuickAddCategory) return;
    const color = CATEGORY_TYPE_OPTIONS.find(o => o.type === CategoryType.CUTTING_TOOL)?.color || 'bg-orange-500';
    const created = await onQuickAddCategory({ name: newToolCategoryName.trim().toUpperCase(), type: CategoryType.CUTTING_TOOL, color });
    setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: created.name } } : null);
    setIsToolCategoryPickerOpen(false);
    setIsCreatingToolCategoryInline(false);
    setNewToolCategoryName('');
  };

  // Escolher uma Grade de Produção Padrão agora faz 2 coisas de uma vez: grava
  // productionGradeId (usado de verdade no PCP pra converter pares em caixas — ver
  // computeStockProjection) E já preenche as numerações/distribuição aqui mesmo, substituindo
  // o antigo "Buscar Padrão de Embalagem" (que só fazia a segunda parte, sem o vínculo real).
  // Em modo Livre não existe distribuição por tamanho — só grava o vínculo, sem mexer em sizes.
  const applyProductionGradeToPack = (grid: Grid, sizesOverride?: string[]) => {
    const gridSizes = sizesOverride || grid.sizes || [];
    setEditingItem(prev => {
      if (!prev) return null;
      if (prev.metadata?.mode === 'FREE') {
        return { ...prev, metadata: { ...prev.metadata, productionGradeId: grid.id || undefined } };
      }
      const quantities: Record<string, number> = { ...(prev.metadata?.sizeQuantities || {}) };
      gridSizes.forEach((s: string) => { if (quantities[s] === undefined) quantities[s] = 0; });
      return { ...prev, metadata: { ...prev.metadata, sizes: gridSizes, sizeQuantities: quantities, productionGradeId: grid.id || undefined } };
    });
    setIsProductionGradeSearchOpen(false);
    setIsCreatingProductionGradeInline(false);
    setEditingProductionGradeId(null);
    setProductionGradeSearchTerm('');
    setNewProductionGradeName('');
    setNewProductionGradeSizes([]);
    setNewProductionGradeSizeInput('');
  };

  const addNewProductionGradeSize = () => {
    const trimmed = newProductionGradeSizeInput.trim();
    if (trimmed !== '' && !newProductionGradeSizes.includes(trimmed)) {
      setNewProductionGradeSizes(prev => [...prev, trimmed]);
      setNewProductionGradeSizeInput('');
    }
  };

  const removeNewProductionGradeSize = (size: string) => {
    setNewProductionGradeSizes(prev => prev.filter(s => s !== size));
  };

  const startCreateProductionGrade = () => {
    setEditingProductionGradeId(null);
    setNewProductionGradeName('');
    setNewProductionGradeSizes([]);
    setIsCreatingProductionGradeInline(true);
  };

  const startEditProductionGrade = (grid: Grid) => {
    setEditingProductionGradeId(grid.id);
    setNewProductionGradeName(grid.name);
    setNewProductionGradeSizes(grid.sizes || []);
    setIsCreatingProductionGradeInline(true);
  };

  const handleSaveInlineProductionGrade = async () => {
    if (!newProductionGradeName.trim() || newProductionGradeSizes.length === 0) return;
    if (editingProductionGradeId) {
      if (!onUpdateGrid) return;
      const existing = grids.find(g => g.id === editingProductionGradeId);
      const updated = { name: newProductionGradeName.trim(), type: GridType.FORMA, sizes: newProductionGradeSizes, configuration: existing?.configuration || {} };
      await onUpdateGrid(editingProductionGradeId, updated);
      applyProductionGradeToPack({ id: editingProductionGradeId, ...updated });
    } else {
      if (!onCreateGrid) return;
      // Gera o ID aqui (em vez de deixar o Firestore decidir) porque precisamos dele JÁ na
      // hora de gravar productionGradeId — onCreateGrid não devolve o id da criação.
      const newId = generateId();
      const newGrid = { id: newId, name: newProductionGradeName.trim(), type: GridType.FORMA, sizes: newProductionGradeSizes, configuration: {} };
      await onCreateGrid(newGrid as any);
      applyProductionGradeToPack(newGrid);
    }
  };

  const handleQuickCreateFlowTag = async () => {
    if (!newFlowTagName.trim() || !onQuickAddFlowTag) return;
    const created = await onQuickAddFlowTag({ name: newFlowTagName.trim().toUpperCase(), subcategories: [], isCuttingFlowTag: false });
    setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, flowTagId: created.id } } : null);
    setIsFlowTagPickerOpen(false);
    setIsCreatingFlowTagInline(false);
    setNewFlowTagName('');
  };

  // Mesmas cores já usadas pelas abas correspondentes em CategoriesView.tsx — mantém a nova
  // categoria visualmente consistente onde quer que ela apareça depois.
  const CATEGORY_TYPE_OPTIONS: { type: CategoryType; label: string; color: string }[] = [
    { type: CategoryType.MOLD, label: 'Solados', color: 'bg-cyan-500' },
    { type: CategoryType.SUPPLY, label: 'Insumos', color: 'bg-emerald-500' },
    { type: CategoryType.CUTTING_TOOL, label: 'Facas', color: 'bg-orange-500' },
    { type: CategoryType.PRODUCTION, label: 'Produção', color: 'bg-orange-500' },
    { type: CategoryType.GENERAL, label: 'Geral', color: 'bg-blue-500' },
  ];

  const handleQuickCreateCategory = async () => {
    if (!newCategoryName.trim() || !onQuickAddCategory) return;
    const color = CATEGORY_TYPE_OPTIONS.find(o => o.type === newCategoryType)?.color || 'bg-cyan-500';
    const created = await onQuickAddCategory({ name: newCategoryName.trim().toUpperCase(), type: newCategoryType, color });
    setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: created.name } } : null);
    setIsCategoryPickerOpen(false);
    setIsCreatingCategoryInline(false);
    setNewCategoryName('');
    setNewCategoryType(CategoryType.MOLD);
  };

  const openMaterialPicker = (target: 'base' | number) => {
    setMaterialPickerTarget(target);
    setMaterialPickerSearch('');
    setIsMaterialPickerOpen(true);
  };

  // Aplica um insumo (já existente ou recém-criado) no alvo certo do picker — separado de
  // selectMaterialForTarget pra não depender de reencontrar o item em `productionConfigs`
  // (prop só atualiza depois que o listener do Firestore refletir o novo insumo, o que não
  // acontece a tempo logo após criar um novo — ver handleQuickCreateMaterial).
  const applyMaterialToTarget = (material: ProductionConfigItem) => {
    if (materialPickerTarget === 'base') {
      const pricePerKg = material.metadata?.baseCost || 0;
      const avgW = averageWeightLive || 0;
      const calcUnitCost = avgW > 0 ? parseFloat(((avgW / 1000) * pricePerKg).toFixed(4)) : 0;
      setEditingItem(prev => prev ? {
        ...prev,
        metadata: { ...prev.metadata, price: pricePerKg, baseMaterialId: material.id, unitCost: calcUnitCost }
      } : null);
    } else if (typeof materialPickerTarget === 'number') {
      const index = materialPickerTarget;
      const newComp = [...(editingItem?.metadata?.composition || [])];
      newComp[index] = { ...newComp[index], materialId: material.id };
      setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null);
    }
    setIsMaterialPickerOpen(false);
    setMaterialPickerTarget(null);
    setIsCreatingMaterialInline(false);
  };

  const selectMaterialForTarget = (materialId: string) => {
    const material = productionConfigs.find(m => m.id === materialId);
    if (material) applyMaterialToTarget(material);
  };

  const existingMaterialReferences = productionConfigs
    .filter(c => c.type === 'MATERIAL')
    .map(c => (c.metadata?.reference || '').toUpperCase().trim())
    .filter(c => c !== '');

  const startCreateMaterial = () => {
    let counter = 1;
    let code = `MAT-${counter.toString().padStart(3, '0')}`;
    while (existingMaterialReferences.includes(code)) { counter++; code = `MAT-${counter.toString().padStart(3, '0')}`; }
    setNewMaterialItem({
      id: '',
      name: '',
      description: '',
      type: 'MATERIAL',
      createdAt: Date.now(),
      metadata: { masterCategory: '', reference: code, unitId: '', baseCost: 0, width: 0, colorIds: [], flowTagId: '', supplierId: '' },
    });
    setIsCreatingMaterialInline(true);
  };

  const handleQuickCreateMaterial = async () => {
    if (!newMaterialItem?.name.trim() || !onQuickAddMaterial) return;
    const { id, ...payload } = newMaterialItem;
    const created = await onQuickAddMaterial(payload);
    applyMaterialToTarget(created);
    setNewMaterialItem(null);
  };

  const handleSaveInlineGrid = async () => {
    if (!newGridName.trim() || newGridSizes.length === 0) return;
    if (editingGridId) {
      if (!onUpdateGrid) return;
      const existing = grids.find(g => g.id === editingGridId);
      const updated = { name: newGridName.trim(), type: GridType.SOLADO, sizes: newGridSizes, configuration: existing?.configuration || {} };
      await onUpdateGrid(editingGridId, updated);
      applyGridToMold({ id: editingGridId, ...updated });
    } else {
      if (!onCreateGrid) return;
      await onCreateGrid({ name: newGridName.trim(), type: GridType.SOLADO, sizes: newGridSizes, configuration: {} });
      applyGridToMold({ id: '', name: newGridName.trim(), type: GridType.SOLADO, sizes: newGridSizes, configuration: {} });
    }
  };

  const renderYesNoToggle = (value: boolean, onChange: (val: boolean) => void, question: string, icon: ReactNode, hint?: string, anchor?: string) => (
    <div className={`p-5 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`} data-guide-anchor={anchor}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className={`text-xs font-black uppercase tracking-widest flex-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{question}</span>
      </div>
      <div className={`p-1.5 rounded-2xl border flex items-center gap-2 transition-all ${value ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50' : 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${value ? "bg-emerald-500 shadow-lg shadow-emerald-500/20 text-white" : "text-slate-400 dark:text-slate-500"}`}
          aria-label={`Sim, ${question}`}
        >
          <div className={`w-2 h-2 rounded-full ${value ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!value ? "bg-rose-500 shadow-lg shadow-rose-500/20 text-white" : "text-slate-400 dark:text-slate-500"}`}
          aria-label={`Não, ${question}`}
        >
          <div className={`w-2 h-2 rounded-full ${!value ? 'bg-white' : 'bg-slate-300'}`} />
          Não
        </button>
      </div>
      {hint && <p className="text-[9px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest mt-2 px-1">{hint}</p>}
    </div>
  );

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
      <div className={`p-3 rounded-[2rem] shadow-xl flex items-center gap-2.5 relative overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        {onBack && (
          <button
            onClick={onBack}
            data-guide-anchor="prodcfg.listaVoltar"
            title="Voltar"
            aria-label="Voltar para a tela anterior"
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-slate-700'}`}
          >
            <ChevronLeft size={16} />
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
          data-guide-anchor="prodcfg.addRegistro"
          className={`flex-1 py-2.5 px-4 rounded-2xl flex items-center gap-3 transition-all shadow-lg active:scale-[0.98] ${isDarkMode ? 'bg-indigo-600 text-white shadow-indigo-900/40' : 'bg-indigo-600 text-white shadow-indigo-200/80'}`}
        >
          <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Plus size={16} strokeWidth={3} />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] leading-none">Adicionar Novo Registro</span>
            <span className="text-[8px] font-bold uppercase tracking-widest opacity-70 mt-0.5">Cadastrar em {label}</span>
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

      {type === 'UNIT' && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${isDarkMode ? 'bg-indigo-900/10 border-indigo-900/30' : 'bg-indigo-50/50 border-indigo-100'}`}>
          <Scale size={18} className="text-indigo-500 mt-0.5 shrink-0" />
          <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider leading-relaxed">
            Unidades de Medida servem pra medir materiais na Ficha Técnica dos produtos — ex.: <span className="text-indigo-600 dark:text-indigo-400 font-black">KG</span>, <span className="text-indigo-600 dark:text-indigo-400 font-black">MT</span>, <span className="text-indigo-600 dark:text-indigo-400 font-black">UN</span>. Cada insumo cadastrado usa uma delas.
          </p>
        </div>
      )}

      {type === 'UNIT' && (
        <div className="rounded-[2rem] border-2 overflow-hidden bg-violet-50/30 dark:bg-violet-950/20 border-violet-100/50 dark:border-violet-900/30">
          <button
            type="button"
            onClick={() => setUnitTemplatesOpen(o => !o)}
            data-guide-anchor="prodcfg.alternarModelosUnidade"
            className="relative w-full flex items-center justify-between px-4 py-3 text-violet-600 dark:text-violet-400"
          >
            {guideActive && <span className="absolute top-2 right-9"><GuidePulseDot show /></span>}
            <div className="flex items-center gap-2">
              <Sparkles size={14} />
              <span className="text-[11px] font-black uppercase tracking-widest">Modelos Disponíveis</span>
            </div>
            <ChevronDown size={16} className={`transition-transform duration-200 ${unitTemplatesOpen ? 'rotate-180' : ''}`} />
          </button>
          {unitTemplatesOpen && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              <p className="w-full text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-snug">
                Toque num modelo abaixo pra adicioná-lo às suas unidades.
              </p>
              {unitTemplates.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 italic py-2">Nenhum modelo disponível ainda.</p>
              )}
              {unitTemplates.map(template => {
                const exists = items.some(i => i.type === 'UNIT' && i.name.toUpperCase() === template.name.toUpperCase());
                return (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => handleAddFromUnitTemplate(template)}
                    disabled={exists}
                    title={`Adicionar modelo: ${template.name}`}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${
                      exists
                        ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 border-transparent'
                        : 'bg-white dark:bg-slate-900 text-violet-600 border-violet-100 hover:border-violet-500 dark:text-violet-400 dark:border-violet-900 shadow-sm active:scale-95'
                    }`}
                  >
                    {template.name} {exists && '✓'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {type === 'PACKAGING' && (
        <div className="rounded-[2rem] border-2 overflow-hidden bg-violet-50/30 dark:bg-violet-950/20 border-violet-100/50 dark:border-violet-900/30">
          <button
            type="button"
            onClick={() => setPackagingTemplatesOpen(o => !o)}
            data-guide-anchor="prodcfg.alternarModelosEmbalagem"
            className="relative w-full flex items-center justify-between px-4 py-3 text-violet-600 dark:text-violet-400"
          >
            {guideActive && <span className="absolute top-2 right-9"><GuidePulseDot show /></span>}
            <div className="flex items-center gap-2">
              <Sparkles size={14} />
              <span className="text-[11px] font-black uppercase tracking-widest">Modelos Disponíveis</span>
            </div>
            <ChevronDown size={16} className={`transition-transform duration-200 ${packagingTemplatesOpen ? 'rotate-180' : ''}`} />
          </button>
          {packagingTemplatesOpen && (
            <div className="px-4 pb-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-snug">
                Toque num modelo abaixo pra adicioná-lo já com a capacidade e a distribuição por numeração prontas.
              </p>
              {packagingTemplates.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 italic py-2">Nenhum modelo disponível ainda. Toque em "Adicionar Novo Registro" acima e cadastre um padrão de embalagem do seu jeito.</p>
              )}
              {packagingTemplates.map(template => {
                const exists = items.some(i => i.type === 'PACKAGING' && i.name.toUpperCase() === template.name.toUpperCase());
                const isExpanded = expandedPackagingTemplateId === template.id;
                return (
                  <div
                    key={template.id}
                    className={`rounded-xl border-2 overflow-hidden ${
                      exists
                        ? 'bg-slate-100 dark:bg-slate-800 border-transparent'
                        : 'bg-white dark:bg-slate-900 border-violet-100 dark:border-violet-900 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleAddFromPackagingTemplate(template)}
                        disabled={exists}
                        title={`Adicionar modelo: ${template.name}`}
                        className={`flex-1 text-left px-3 py-2.5 text-[11px] font-black uppercase tracking-widest active:scale-[0.98] ${
                          exists ? 'text-slate-300 dark:text-slate-600' : 'text-violet-600 dark:text-violet-400'
                        }`}
                      >
                        {template.name} {exists && '✓'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedPackagingTemplateId(isExpanded ? null : template.id)}
                        title={isExpanded ? 'Ocultar prévia da configuração' : 'Mostrar prévia da configuração'}
                        aria-label={isExpanded ? 'Ocultar prévia da configuração' : 'Mostrar prévia da configuração'}
                        className={`px-3 py-2.5 shrink-0 ${exists ? 'text-slate-300 dark:text-slate-600' : 'text-violet-400 hover:text-violet-600'}`}
                      >
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-violet-100/60 dark:border-violet-900/40">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 pt-2">
                          {template.mode === 'FREE' ? `Grade Livre — Capacidade Total: ${template.capacity} pares` : `Grade Fixa — ${template.capacity} pares por caixa`}
                        </span>
                        {template.mode !== 'FREE' && (
                          <div className="flex flex-wrap gap-1.5">
                            {(template.sizes || []).map(size => (
                              <span
                                key={size}
                                className={`px-2 py-1 rounded-lg border text-[9px] font-black ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                              >
                                {size}: {template.sizeQuantities?.[size] || 0}
                              </span>
                            ))}
                            {(template.sizes || []).length === 0 && (
                              <span className="text-[9px] text-slate-300 dark:text-slate-700 font-bold italic">Sem numerações</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {onSaveAsDefault && isTemplateAdmin() && (
        <button
          type="button"
          onClick={() => onSaveAsDefault(items.filter(i => i?.type === type).map(i => ({ name: i.name, description: i.description || '' })))}
          data-guide-anchor="prodcfg.salvarPadraoNovasContas"
          className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-b from-violet-500 to-violet-600 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Bookmark size={14} /> Salvar Como Padrão para Novas Contas
        </button>
      )}

      {type === 'TOOL' && products.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setIsProductFilterPickerOpen(true)}
            data-guide-anchor="prodcfg.facaFiltroModeloAbrir"
            className={`relative w-full flex items-center justify-between gap-2 pl-12 pr-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 text-left ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-700'} ${selectedProductFilter ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : ''}`}
          >
            <Package size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <span className="truncate">
              {selectedProductFilter ? products.find(p => p.id === selectedProductFilter)?.name : 'TODOS OS MODELOS'}
            </span>
            <ChevronDown size={16} className="text-slate-400 shrink-0" />
          </button>
          <EngineeringPickerModal
            isOpen={isProductFilterPickerOpen}
            onClose={() => setIsProductFilterPickerOpen(false)}
            title="Filtrar por Modelo"
            icon={<Package size={18} />}
            options={[
              { id: '', name: 'TODOS OS MODELOS' },
              ...products.map(p => ({ id: p.id, name: p.name, subtitle: p.reference })),
            ]}
            selectedId={selectedProductFilter}
            onSelect={(id) => setSelectedProductFilter(id)}
            isDarkMode={isDarkMode}
            searchPlaceholder="Pesquisar modelo..."
            zIndex={70000}
          />
        </>
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
                            CONSUMO P/ ÁREA • {formatConjugationLabel(item.metadata?.conjugation || 1)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pr-2">
                        <button type="button" onClick={() => { setEditingItem({ ...item }); setIsModalOpen(true); }} data-guide-anchor="prodcfg.itemEditar" className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"><Edit3 size={18} /></button>
                        <button type="button" onClick={() => { if (confirm(`Deseja excluir ${item.name}?`)) onDelete(item.id); }} data-guide-anchor="prodcfg.itemExcluir" className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })
        ) : type === 'MATERIAL' ? (
          Object.entries(groupedItems || {}).map(([category, catItems]: [string, ProductionConfigItem[]], catIdx) => {
            const pal = MATERIAL_CATEGORY_PALETTE[catIdx % MATERIAL_CATEGORY_PALETTE.length];
            const alertCount = catItems.filter(i => {
              const stock = getTotalMaterialStock(i);
              const minStock = i.metadata?.minStock ?? 0;
              return stock < minStock;
            }).length;
            return (
            <div key={category} className="flex flex-col gap-3">
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setOpenMaterialCategoryPopup(category); setMaterialCategoryPopupSearch(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setOpenMaterialCategoryPopup(category); setMaterialCategoryPopupSearch(''); } }}
                data-guide-anchor="prodcfg.categoriaToggle"
                title={`Ver itens de ${category}`}
                aria-label={`Ver itens de ${category}`}
                className={`flex items-center gap-4 px-4 py-3 rounded-2xl border cursor-pointer select-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: pal.bg }}>
                  <Tags size={16} color="#fff" />
                </div>
                <div className="flex-1">
                  <h4 className={`text-xs font-black uppercase tracking-[0.2em] leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{category}</h4>
                  <p className="text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5 text-slate-400">{catItems.length} {catItems.length === 1 ? 'ITEM' : 'ITENS'} CADASTRADO{catItems.length !== 1 ? 'S' : ''}</p>
                </div>
                {alertCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: '#ef4444' }}>
                    {alertCount} ALERTA{alertCount > 1 ? 'S' : ''}
                  </span>
                )}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white"
                  style={{ backgroundColor: pal.bg }}
                >
                  <ChevronDown size={14} strokeWidth={3} className="-rotate-90" />
                </div>
              </div>
              {/* Itens desta categoria abrem num popup à parte (ver Modal logo abaixo do
                  Object.entries), em vez de expandir inline aqui embaixo. */}
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
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">CONSUMO P/ ÁREA • {formatConjugationLabel(item.metadata?.conjugation || 1)}</p>
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
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${BADGE_COLOR_CLASSES[(item.metadata?.badgeColor as keyof typeof BADGE_COLOR_CLASSES) || DEFAULT_BADGE_COLOR].swatch}`} />
                          {item.metadata?.capacity || 0} PARES {item.metadata?.mode !== 'FREE' && `• ${(item.metadata?.sizes || []).length} TAMANHOS`}
                        </p>
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
                        {isTemplateAdmin() && (
                          <button
                            type="button"
                            onClick={() => handleTogglePackagingTemplate(item)}
                            title={isSavedAsPackagingTemplate(item) ? 'Toque pra desmarcar como exemplo' : 'Usar como exemplo pra novas contas'}
                            className={`self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.97] ${
                              isSavedAsPackagingTemplate(item)
                                ? 'bg-violet-100 border-violet-200 text-violet-700 dark:bg-violet-500/20 dark:border-violet-500/40 dark:text-violet-300'
                                : 'bg-slate-200 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isSavedAsPackagingTemplate(item) ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                            {isSavedAsPackagingTemplate(item) ? 'Usado como exemplo' : 'Marcar como modelo'}
                          </button>
                        )}
                      </div>
                    ) : type === 'UNIT' ? (
                      <div className="flex flex-col gap-2 mt-0.5">
                        {item.description && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.description}</p>}
                        {isTemplateAdmin() && (
                          <button
                            type="button"
                            onClick={() => handleToggleUnitTemplate(item)}
                            title={isSavedAsUnitTemplate(item) ? 'Toque pra desmarcar como exemplo' : 'Usar como exemplo pra novas contas'}
                            className={`self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.97] ${
                              isSavedAsUnitTemplate(item)
                                ? 'bg-violet-100 border-violet-200 text-violet-700 dark:bg-violet-500/20 dark:border-violet-500/40 dark:text-violet-300'
                                : 'bg-slate-200 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isSavedAsUnitTemplate(item) ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                            {isSavedAsUnitTemplate(item) ? 'Usado como exemplo' : 'Marcar como modelo'}
                          </button>
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
                    data-guide-anchor="prodcfg.itemEditar"
                    title="Editar item"
                    aria-label={`Editar ${item.name}`}
                    className={`p-2 rounded-full transition-all ${isDarkMode ? 'text-slate-600 hover:text-white' : 'text-slate-200 hover:text-slate-400'}`}
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Deseja excluir ${item.name}?`)) onDelete(item.id); }}
                    data-guide-anchor="prodcfg.itemExcluir"
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
            <button onClick={handleSeed} data-guide-anchor="prodcfg.carregarPadrao" className="px-6 py-3 rounded-2xl bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">{seedButtonLabel ?? 'Carregar Padrões'}</button>
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className={`p-12 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center text-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300">{icon}</div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{search ? 'Nenhum resultado encontrado' : placeholderLabel}</p>
          </div>
        )}
      </div>

      {/* Popup com os itens da categoria de Insumo tocada (ver openMaterialCategoryPopup) — abre
          num popup em vez de expandir inline na lista de categorias. */}
      {type === 'MATERIAL' && (() => {
        const categoryKeys = Object.keys(groupedItems || {});
        const catIdx = openMaterialCategoryPopup ? categoryKeys.indexOf(openMaterialCategoryPopup) : -1;
        const pal = MATERIAL_CATEGORY_PALETTE[Math.max(0, catIdx) % MATERIAL_CATEGORY_PALETTE.length];
        const catItems = (openMaterialCategoryPopup ? (groupedItems?.[openMaterialCategoryPopup] || []) : [])
          .filter(item => {
            const q = materialCategoryPopupSearch.trim().toLowerCase();
            if (!q) return true;
            return (item.name || '').toLowerCase().includes(q) || (item.metadata?.reference || '').toLowerCase().includes(q);
          });
        return (
          <Modal
            isOpen={!!openMaterialCategoryPopup}
            onClose={() => setOpenMaterialCategoryPopup(null)}
            title={openMaterialCategoryPopup || ''}
            icon={<div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: pal.bg }}><Tags size={16} color="#fff" /></div>}
            maxWidth="max-w-lg"
            zIndex={75000}
          >
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  type="text"
                  value={materialCategoryPopupSearch}
                  onChange={(e) => setMaterialCategoryPopupSearch(e.target.value)}
                  placeholder={`Buscar em ${openMaterialCategoryPopup || ''}...`}
                  className={`w-full pl-11 pr-4 py-3 rounded-2xl text-xs font-bold outline-none border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-transparent text-slate-900 focus:border-indigo-200'}`}
                />
              </div>
              {catItems.length === 0 && (
                <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest py-4">Nenhum item encontrado.</p>
              )}
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
                  colors={colors}
                  productionConfigs={productionConfigs}
                />
              ))}
            </div>
          </Modal>
        );
      })()}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Editar / Cadastrar`} zIndex={70000}>
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {type === 'MOLD' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2" data-guide-anchor="mold.referencia">
                  <label htmlFor="mold-reference" className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Referência *</label>
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
                <div className="flex flex-col gap-2" data-guide-anchor="mold.nome">
                  <label htmlFor="mold-name" className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Nome da Matriz *</label>
                  <input id="mold-name" type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)} required title="Nome da Matriz" placeholder="NOME DA MATRIZ" className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`} />
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2" data-guide-anchor="mold.categoria">
                  <label className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Categoria</label>
                  <button
                    type="button"
                    onClick={() => { setIsCategoryPickerOpen(true); setIsCreatingCategoryInline(false); setCategorySearch(''); }}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                  >
                    <span className={!editingItem?.metadata?.category ? 'opacity-40 normal-case' : ''}>
                      {editingItem?.metadata?.category || 'Selecionar categoria...'}
                    </span>
                    <ChevronRight size={18} className="text-slate-400 shrink-0" />
                  </button>
                </div>

                <Modal isOpen={isCategoryPickerOpen} onClose={() => { setIsCategoryPickerOpen(false); setIsCreatingCategoryInline(false); }} title="Categoria do Solado" maxWidth="max-w-sm" zIndex={80000}>
                  {!isCreatingCategoryInline ? (
                    <div className="flex flex-col gap-4" data-guide-anchor="mold.categoriaLista">
                      <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                          type="text"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          placeholder="Buscar categoria..."
                          className={`w-full pl-10 pr-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                        />
                      </div>
                      <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                        {moldCategoryNames.filter(name => name.toLowerCase().includes(categorySearch.toLowerCase())).map(name => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => { setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: name } } : null); setIsCategoryPickerOpen(false); }}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                          >
                            <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{name}</span>
                            <ChevronRight size={16} className="text-indigo-400" />
                          </button>
                        ))}
                        {moldCategoryNames.filter(name => name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                          <p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-6">Nenhuma categoria encontrada.</p>
                        )}
                      </div>
                      {onQuickAddCategory && (
                        <button
                          type="button"
                          onClick={() => { setIsCreatingCategoryInline(true); setNewCategoryType(CategoryType.MOLD); }}
                          data-guide-anchor="mold.cadastrarCategoria"
                          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                        >
                          <Plus size={14} strokeWidth={3} /> Não encontrou? Cadastre uma categoria aqui
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest leading-relaxed">
                        Salvo direto em Categorias — fica disponível pra qualquer outro cadastro do sistema, sem sair de Solados.
                      </p>
                      <div>
                        <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Em qual aba de Categorias salvar?</label>
                        <div className="grid grid-cols-3 gap-2">
                          {CATEGORY_TYPE_OPTIONS.map(opt => (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => setNewCategoryType(opt.type)}
                              data-guide-anchor="mold.categoriaTipo"
                              className={`flex items-center justify-center py-2.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${newCategoryType === opt.type ? `${opt.color} border-transparent text-white shadow-lg` : (isDarkMode ? 'bg-slate-800 border-slate-700 text-blue-300' : 'bg-slate-50 border-slate-100 text-blue-900')}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Nome da Categoria</label>
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickCreateCategory())}
                          placeholder="Ex: Injetado"
                          className={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setIsCreatingCategoryInline(false)} data-guide-anchor="mold.categoriaInlineVoltar" className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 text-sm">
                          Voltar
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickCreateCategory}
                          data-guide-anchor="mold.categoriaSalvarUsar"
                          disabled={!newCategoryName.trim()}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg transition-all"
                        >
                          Salvar e Usar
                        </button>
                      </div>
                    </div>
                  )}
                </Modal>
                <div className="flex flex-col gap-2" data-guide-anchor="mold.fornecedor">
                  <label className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Fornecedor</label>
                  <button
                    type="button"
                    onClick={() => { setIsSupplierPickerOpen(true); setSupplierSearch(''); }}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                  >
                    <span className={!editingItem?.metadata?.supplierId ? 'opacity-40 normal-case' : ''}>
                      {suppliers.find(s => s.id === editingItem?.metadata?.supplierId)?.name || 'Selecione...'}
                    </span>
                    <ChevronRight size={18} className="text-slate-400 shrink-0" />
                  </button>
                </div>
              </div>

              <Modal isOpen={isSupplierPickerOpen} onClose={() => setIsSupplierPickerOpen(false)} title="Selecionar Fornecedor" maxWidth="max-w-sm" zIndex={80000}>
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      placeholder="Buscar fornecedor..."
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                    />
                  </div>
                  <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                    {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, supplierId: s.id } } : null); setIsSupplierPickerOpen(false); }}
                        data-guide-anchor="mold.fornecedorItem"
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                      >
                        <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{s.name}</span>
                        <ChevronRight size={16} className="text-indigo-400" />
                      </button>
                    ))}
                    {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                      <p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-6">Nenhum fornecedor encontrado.</p>
                    )}
                  </div>
                  {onQuickAddPerson && (
                    <button
                      type="button"
                      onClick={() => { setIsSupplierPickerOpen(false); setIsQuickPersonModalOpen(true); }}
                      data-guide-anchor="mold.cadastrarFornecedor"
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus size={14} strokeWidth={3} /> Não encontrou? Cadastre um fornecedor aqui
                    </button>
                  )}
                </div>
              </Modal>

              {onQuickAddPerson && (
                <PersonModal
                  isOpen={isQuickPersonModalOpen}
                  onClose={() => setIsQuickPersonModalOpen(false)}
                  onSave={async (p) => {
                    const created = await onQuickAddPerson(p);
                    setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, supplierId: created.id } } : null);
                    setIsQuickPersonModalOpen(false);
                  }}
                  sellers={people.filter(p => p.isSeller)}
                  allPeople={people}
                  initialData={{ isSupplier: true }}
                  isDarkMode={isDarkMode}
                />
              )}
              {renderYesNoToggle(
                moldBuysReadySole,
                (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, buysReadySole: val } } : null),
                'Você compra o solado pronto?',
                <CheckCircle2 size={18} className="text-emerald-500" />,
                'Se sim: informe direto quanto você paga por par do solado já pronto, sem precisar cadastrar material/composição.',
                'mold.buysReadySole'
              )}
              {moldBuysReadySole && (
                <div className="flex flex-col gap-2" data-guide-anchor="mold.custoSoladoPronto">
                  <label htmlFor="mold-ready-sole-cost" className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Valor Pago por Par (R$)</label>
                  <div className="relative group">
                    <input
                      id="mold-ready-sole-cost"
                      type="number"
                      step="0.01"
                      value={editingItem?.metadata?.readySoleCost ?? ''}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, readySoleCost: parseFloat(e.target.value) || 0 } } : null)}
                      title="Valor pago por par do solado pronto"
                      placeholder="0,00"
                      className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                    />
                    <button
                      type="button"
                      title="Abrir Calculadora"
                      aria-label="Abrir calculadora para definir o valor pago por par"
                      onClick={() => setActiveCalc({
                        initialValue: editingItem?.metadata?.readySoleCost || 0,
                        onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, readySoleCost: val } } : null)
                      })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
                    >
                      <Calculator size={16} />
                    </button>
                  </div>
                </div>
              )}
              {renderYesNoToggle(
                moldBuysMaterials,
                (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, buysMaterials: val } } : null),
                'Você compra materiais para o solado?',
                <Layers size={18} className="text-indigo-500" />,
                'Se sim: cadastre o material base (pra puxar preço) e a composição de materiais abaixo.',
                'mold.buysMaterials'
              )}
              {moldBuysMaterials && (<>
              <div className="flex flex-col gap-2" data-guide-anchor="mold.materialBase">
                <label className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Material Base (Insumos)</label>
                <button
                  type="button"
                  onClick={() => openMaterialPicker('base')}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                >
                  {(() => {
                    const selected = productionConfigs.find(m => m.id === editingItem?.metadata?.baseMaterialId);
                    return (
                      <span className={!selected ? 'opacity-40 normal-case text-blue-900 dark:text-blue-300' : ''}>
                        {selected ? `${selected.name} (${selected.metadata?.reference}) - R$ ${selected.metadata?.baseCost || 0}` : 'Selecionar insumo para puxar preço...'}
                      </span>
                    );
                  })()}
                  <ChevronRight size={18} className="text-slate-400 shrink-0" />
                </button>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2" data-guide-anchor="mold.precoKg">
                  <label htmlFor="mold-price" className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Preço do Material / KG (R$)</label>
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
                <div className="flex flex-col gap-2" data-guide-anchor="mold.custoPorPar">
                  <div className="flex items-center justify-between">
                    <label htmlFor="mold-unit-cost" className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Custo por Par (R$)</label>
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
                      title="Abrir Calculadora"
                      aria-label="Abrir calculadora para definir custo por par"
                      onClick={() => setActiveCalc({
                        initialValue: editingItem?.metadata?.unitCost || 0,
                        onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, unitCost: val } } : null)
                      })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
                    >
                      <Calculator size={16} />
                    </button>
                  </div>
                  {editingItem?.metadata?.unitCost && editingItem.metadata.unitCost > 0 && (
                    <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest ml-2">
                      ≈ R$ {Number(editingItem.metadata.unitCost).toFixed(4)} / par
                    </p>
                  )}
                </div>
              </div>
              </>)}
              <div className="flex flex-col gap-2" data-guide-anchor="mold.estagioFluxo">
                <label className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Estágio do Fluxo / Setor</label>
                <button
                  type="button"
                  onClick={() => { setIsFlowTagPickerOpen(true); setIsCreatingFlowTagInline(false); setFlowTagSearch(''); }}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                >
                  <span className={!editingItem?.metadata?.flowTagId ? 'opacity-40' : ''}>
                    {flowTags.find(t => t.id === editingItem?.metadata?.flowTagId)?.name || 'SELECIONE O ESTÁGIO...'}
                  </span>
                  <ChevronRight size={18} className="text-slate-400 shrink-0" />
                </button>
              </div>

              <Modal isOpen={isFlowTagPickerOpen} onClose={() => { setIsFlowTagPickerOpen(false); setIsCreatingFlowTagInline(false); }} title="Estágio do Fluxo / Setor" maxWidth="max-w-sm" zIndex={80000}>
                {!isCreatingFlowTagInline ? (
                  <div className="flex flex-col gap-4" data-guide-anchor="mold.estagioFluxoLista">
                    <div className="relative">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={flowTagSearch}
                        onChange={(e) => setFlowTagSearch(e.target.value)}
                        placeholder="Buscar fluxo/setor..."
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                      {flowTags.filter(t => t.name.toLowerCase().includes(flowTagSearch.toLowerCase())).map(tag => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => { setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, flowTagId: tag.id } } : null); setIsFlowTagPickerOpen(false); }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                        >
                          <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tag.name}</span>
                          <ChevronRight size={16} className="text-indigo-400" />
                        </button>
                      ))}
                      {flowTags.filter(t => t.name.toLowerCase().includes(flowTagSearch.toLowerCase())).length === 0 && (
                        <p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-6">Nenhum fluxo/setor encontrado.</p>
                      )}
                    </div>
                    {onQuickAddFlowTag && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingFlowTagInline(true)}
                        data-guide-anchor="mold.cadastrarFluxo"
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                      >
                        <Plus size={14} strokeWidth={3} /> Não encontrou? Cadastre um fluxo aqui
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest leading-relaxed">
                      Salvo direto em Fluxos de Setor — fica disponível pra qualquer outro cadastro do sistema, sem sair de Solados.
                    </p>
                    <div>
                      <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Nome do Fluxo / Setor</label>
                      <input
                        type="text"
                        value={newFlowTagName}
                        onChange={(e) => setNewFlowTagName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickCreateFlowTag())}
                        placeholder="Ex: Injeção"
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => setIsCreatingFlowTagInline(false)} data-guide-anchor="mold.fluxoInlineVoltar" className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 text-sm">
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickCreateFlowTag}
                        data-guide-anchor="mold.fluxoSalvarUsar"
                        disabled={!newFlowTagName.trim()}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg transition-all"
                      >
                        Salvar e Usar
                      </button>
                    </div>
                  </div>
                )}
              </Modal>

              <Modal isOpen={isMaterialPickerOpen} onClose={() => { setIsMaterialPickerOpen(false); setIsCreatingMaterialInline(false); setNewMaterialItem(null); }} title="Selecionar Insumo" icon={<Layers size={20} />} maxWidth="max-w-md" zIndex={80000}>
                {!isCreatingMaterialInline ? (
                  <div className="flex flex-col gap-4">
                    <div className="relative">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={materialPickerSearch}
                        onChange={(e) => setMaterialPickerSearch(e.target.value)}
                        placeholder="Buscar insumo..."
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                      {productionConfigs.filter(m => m.type === 'MATERIAL' && m.name.toLowerCase().includes(materialPickerSearch.toLowerCase())).map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectMaterialForTarget(m.id)}
                          data-guide-anchor="mold.materialItem"
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className={`text-xs font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{m.name}</span>
                            <span className="text-[9px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">{m.metadata?.reference} • R$ {m.metadata?.baseCost || 0}/kg</span>
                          </div>
                          <ChevronRight size={16} className="text-indigo-400 shrink-0" />
                        </button>
                      ))}
                      {productionConfigs.filter(m => m.type === 'MATERIAL' && m.name.toLowerCase().includes(materialPickerSearch.toLowerCase())).length === 0 && (
                        <p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-6">Nenhum insumo encontrado.</p>
                      )}
                    </div>
                    {onQuickAddMaterial && (
                      <button
                        type="button"
                        onClick={startCreateMaterial}
                        data-guide-anchor="mold.cadastrarMaterial"
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                      >
                        <Plus size={14} strokeWidth={3} /> Não encontrou? Cadastre um insumo aqui
                      </button>
                    )}
                  </div>
                ) : newMaterialItem ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest leading-relaxed">
                      Cadastro completo de Insumo — salvo direto em Insumos, fica disponível pra
                      qualquer outro cadastro do sistema, sem perder o progresso deste Solado.
                    </p>
                    <MaterialFormFields
                      item={newMaterialItem}
                      onChange={setNewMaterialItem}
                      isDarkMode={isDarkMode}
                      suppliers={suppliers}
                      flowTags={flowTags}
                      colors={colors}
                      units={units}
                      supplyCategoryNames={supplyCategoryNames}
                      existingReferences={existingMaterialReferences}
                      onQuickAddCategory={onQuickAddCategory}
                      onQuickAddFlowTag={onQuickAddFlowTag}
                      onQuickAddPerson={onQuickAddPerson}
                      onQuickAddUnit={onQuickAddMaterial}
                      onQuickAddColor={onQuickAddColor}
                    />
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setIsCreatingMaterialInline(false); setNewMaterialItem(null); }} data-guide-anchor="mold.materialInlineVoltar" className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 text-sm">
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickCreateMaterial}
                        data-guide-anchor="mold.materialSalvarUsar"
                        disabled={!newMaterialItem.name.trim()}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg transition-all"
                      >
                        Salvar e Usar
                      </button>
                    </div>
                  </div>
                ) : null}
              </Modal>
              <div className={`p-6 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Grid3X3 size={18} className="text-indigo-500" /><span className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">Numeração / Grade do Solado</span></div>
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
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => { setIsGridSearchOpen(true); setIsCreatingGridInline(false); setEditingGridId(null); setGridSearchTerm(''); }}
                    data-guide-anchor="mold.buscarGrade"
                    className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] border-2 ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-900/40' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100/50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Search size={20} />
                      <div className="text-left">
                        <span className="text-xs font-black uppercase tracking-widest block">Buscar Grade</span>
                        <span className="text-xs font-bold uppercase tracking-widest opacity-70">Usar uma grade já cadastrada ou criar uma nova</span>
                      </div>
                    </div>
                    <ChevronRight size={18} />
                  </button>
                  <div className="flex gap-2" data-guide-anchor="mold.numeracaoManual">
                    <input id="mold-new-size" type="text" value={newSize} onChange={(e) => setNewSize(e.target.value)} title="Nova Numeração" placeholder="Ou adicione uma numeração avulsa, ex: 37" className={`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                    <button type="button" title="Adicionar Numeração" aria-label="Adicionar este tamanho" onClick={addSize} className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      <Plus size={24} />
                    </button>
                  </div>
                  <div className="p-4 rounded-[1.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                    {sortSizeKeys(editingItem?.metadata?.sizes || []).map(size => (
                      <div key={size} className={`px-3 py-1.5 rounded-xl flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                        <span className="text-[10px] font-black">{size}</span>
                        <button type="button" title={`Remover ${size}`} aria-label={`Remover tamanho ${size}`} onClick={() => removeSize(size)} data-guide-anchor="mold.numeracaoRemover" className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Modal isOpen={isGridSearchOpen} onClose={() => { setIsGridSearchOpen(false); setIsCreatingGridInline(false); setEditingGridId(null); }} title="Buscar Grade de Solado" icon={<Grid3X3 size={20} />} maxWidth="max-w-md" zIndex={80000}>
                {!isCreatingGridInline ? (
                  <div className="flex flex-col gap-4" data-guide-anchor="mold.buscarGrade.lista">
                    <div className="relative">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={gridSearchTerm}
                        onChange={(e) => setGridSearchTerm(e.target.value)}
                        placeholder="Buscar grade de solado..."
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                      {grids.filter(g => g.type === GridType.SOLADO && g.name.toLowerCase().includes(gridSearchTerm.toLowerCase())).map(g => (
                        <div
                          key={g.id}
                          className={`w-full flex items-center gap-2 p-4 rounded-2xl border-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                        >
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className={`text-xs font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{g.name}</span>
                            <span className="text-[9px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest truncate">
                              {(g.sizes || []).length > 0 ? sortSizeKeys(g.sizes || []).join(', ') : 'Sem numerações cadastradas'}
                            </span>
                          </div>
                          <button type="button" title="Usar esta Grade" aria-label={`Usar a grade ${g.name}`} onClick={() => applyGridToMold(g)} className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shrink-0">
                            <Check size={14} strokeWidth={3} />
                          </button>
                          <button type="button" title="Editar Grade" aria-label={`Editar a grade ${g.name}`} onClick={() => startEditGrid(g)} className={`p-2.5 rounded-xl transition-colors shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-700'}`}>
                            <Edit3 size={14} />
                          </button>
                          <button type="button" title="Excluir Grade" aria-label={`Excluir a grade ${g.name}`} onClick={() => handleDeleteGrid(g)} className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {grids.filter(g => g.type === GridType.SOLADO && g.name.toLowerCase().includes(gridSearchTerm.toLowerCase())).length === 0 && (
                        <p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-6">Nenhuma grade de solado encontrada.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={startCreateGrid}
                      data-guide-anchor="mold.buscarGrade.criar"
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus size={14} strokeWidth={3} /> Não encontrou? Criar Nova Grade
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">{editingGridId ? 'Editando Grade' : 'Nova Grade'}</p>
                    <div>
                      <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Nome da Grade</label>
                      <input
                        type="text"
                        value={newGridName}
                        onChange={(e) => setNewGridName(e.target.value)}
                        placeholder="Ex: Feminino 34-40"
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Adicionar Numeração</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newGridSizeInput}
                          onChange={(e) => setNewGridSizeInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewGridSize())}
                          placeholder="Ex: 38"
                          className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                        />
                        <button type="button" onClick={addNewGridSize} data-guide-anchor="mold.gradeInlineAddSize" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-black transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="min-h-[50px] flex flex-wrap gap-2 p-3 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                      {newGridSizes.map(size => (
                        <span key={size} className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          {size}
                          <button type="button" onClick={() => removeNewGridSize(size)} data-guide-anchor="mold.gradeInlineRemoveSize" className="text-rose-400 hover:text-rose-600">×</button>
                        </span>
                      ))}
                      {newGridSizes.length === 0 && <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold italic self-center">Adicione numerações acima</span>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setIsCreatingGridInline(false); setEditingGridId(null); }} data-guide-anchor="mold.gradeInlineVoltar" className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 text-sm">
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInlineGrid}
                        data-guide-anchor="mold.gradeInlineSalvar"
                        disabled={!newGridName.trim() || newGridSizes.length === 0}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg transition-all"
                      >
                        {editingGridId ? 'Salvar Alterações e Usar' : 'Salvar e Usar'}
                      </button>
                    </div>
                  </div>
                )}
              </Modal>

              {renderYesNoToggle(
                moldTracksWeight,
                (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, tracksWeight: val } } : null),
                'Você pesa sua sola para fazer conferência (peso por par)?',
                <Scale size={18} className="text-indigo-500" />,
                'Se sim: cadastre o peso por tamanho e, se quiser, o peso por cor abaixo.',
                'mold.tracksWeight'
              )}
              {moldTracksWeight && (
              <div className={`p-6 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Scale size={18} className="text-indigo-500" /><span className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">Pesos por Tamanho (GR)</span></div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWeightsModalOpen(true)}
                  data-guide-anchor="mold.pesosPorTamanho"
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
                      {sortSizeEntries(Object.entries(editingItem?.metadata?.sizeWeights || {})).map(([size, weight]) => (
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
                              <span className="text-[8px] font-black text-blue-900 dark:text-blue-300">GR</span>
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
                              data-guide-anchor="mold.pesoTamanhoCalc"
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
                    data-guide-anchor="mold.pesosPorTamanho"
                    className="flex-1 py-3 px-4 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <Scale size={16} /> Pesos por Tamanho
                  </button>
                  {colors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsColorWeightsModalOpen(true)}
                      data-guide-anchor="mold.pesosPorCor"
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
                    <p className="text-xs text-blue-900 dark:text-blue-300 font-medium">
                      Cadastre o peso médio para cada cor. Se tiver pesos diferentes por tamanho, cadastre também os tamanhos.
                    </p>
                    <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                      {(() => {
                        const registeredColorIds = new Set((editingItem?.metadata?.colorVariations || []).map((cv: any) => cv.colorId));
                        const registeredColors = (colors || []).filter(c => registeredColorIds.has(c.id));
                        if (registeredColors.length === 0) {
                          return (
                            <p className="text-xs text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-8 px-4 leading-relaxed">
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
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-blue-900 dark:text-blue-300">GR</span>
                                </div>
                              </div>
                            </div>

                            {sizes.length > 0 && (
                              <div className="p-3 grid grid-cols-4 gap-2">
                                {sizes.map(size => {
                                  const sizeWeight = colorSizeWeights[size] || 0;
                                  return (
                                    <div key={size} className="flex flex-col gap-1">
                                      <label className="text-[8px] font-black text-blue-900 dark:text-blue-300 uppercase text-center">{size}</label>
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

                <div className="flex items-center justify-between mt-4 pt-6 border-t-2 border-dashed border-slate-100 dark:border-slate-800" data-guide-anchor="mold.pesoGradeTotal">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-1">Peso da Grade (Soma GR)</label>
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 mb-1">Rendimento por KG</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {averageWeightLive > 0 ? (1000 / averageWeightLive).toFixed(2) : '0.00'}
                      </span>
                      <span className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase">PRS / KG</span>
                    </div>
                    <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest mt-1">
                      1000 g ÷ Média ({averageWeightLive.toFixed(1)} g)
                    </p>
                  </div>
                </div>
              </div>
              )}
              {moldBuysMaterials && (
              <div className={`p-6 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col gap-1"><div className="flex items-center gap-2"><Layers size={18} className="text-indigo-500" /><span className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">Composição de Materiais</span></div><span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">Defina o consumo de insumos</span></div>
                  <button
                    type="button"
                    onClick={() => { const currentComposition = editingItem?.metadata?.composition || []; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: [...currentComposition, { materialId: '', quantity: 0, type: 'weight' }] } } : null); }}
                    title="Adicionar Material"
                    aria-label="Adicionar novo material à composição"
                    data-guide-anchor="mold.composicaoAdicionar"
                    className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {(editingItem?.metadata?.composition || []).map((item: any, index: number) => (
                    <div key={index} data-guide-anchor="mold.composicaoItem" className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3 p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <div className="col-span-6 flex flex-col gap-1">
                        <label className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-1">Insumo / Material</label>
                        <button
                          type="button"
                          onClick={() => openMaterialPicker(index)}
                          className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-bold text-xs uppercase outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-50 text-slate-900'}`}
                        >
                          <span className={`truncate ${!item.materialId ? 'opacity-40 normal-case' : ''}`}>
                            {productionConfigs.find(c => c.id === item.materialId)?.name || 'Selecione...'}
                          </span>
                          <ChevronRight size={14} className="text-slate-400 shrink-0" />
                        </button>
                      </div>
                      <div className="col-span-3 flex flex-col gap-1"><label htmlFor={`qty-${index}`} className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-1">Quant / %</label><div className="relative group"><input id={`qty-${index}`} type="number" step="0.001" value={item.quantity || ''} title="Quantidade" placeholder="0,000" onChange={(e) => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], materialId: e.target.value, quantity: parseFloat(e.target.value) }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); }} className={`w-full px-3 py-3 rounded-xl font-black text-[10px] text-center outline-none border-2 pr-10 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-600'}`} /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir quantidade" onClick={() => setActiveCalc({ initialValue: item.quantity || 0, onResult: (val) => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], quantity: val }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); } })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all"><Calculator size={12} /></button></div></div>
                      <div className="col-span-2 flex flex-col gap-1"><label className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-1">Tipo</label><button type="button" title="Alternar Tipo" aria-label="Alternar entre peso e porcentagem" onClick={() => { const newComp = [...(editingItem?.metadata?.composition || [])]; newComp[index] = { ...newComp[index], type: item.type === 'weight' ? 'percentage' : 'weight' }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); }} className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all ${item.type === 'percentage' ? 'bg-amber-500 border-amber-600 text-white' : 'bg-indigo-500 border-indigo-600 text-white'}`}>{item.type === 'percentage' ? '%' : 'GR'}</button></div>
                      <div className="col-span-1 flex items-end pb-1"><button type="button" title="Remover Insumo" aria-label="Remover este insumo da composição" onClick={() => { const newComp = (editingItem?.metadata?.composition || []).filter((_: any, i: number) => i !== index); setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null); }} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"><Trash2 size={16} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
              )}
              {renderYesNoToggle(
                moldHasSoleServices,
                (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, hasSoleServices: val } } : null),
                'Você tem algum serviço na sola?',
                <Hammer size={18} className="text-emerald-500" />,
                'Ex: pintura, injeção de sola, colar etiquetas. Se sim: cadastre os serviços agregados abaixo.',
                'mold.hasSoleServices'
              )}
              {moldHasSoleServices && (
              <div className={`p-6 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col gap-1"><div className="flex items-center gap-2"><Hammer size={18} className="text-emerald-500" /><span className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">Serviços Agregados</span></div><span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">Mão de obra ou processos terceirizados</span></div>
                  <button
                    type="button"
                    onClick={() => { const currentServices = editingItem?.metadata?.extraServices || []; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: [...currentServices, { name: '', cost: 0 }] } } : null); }}
                    title="Adicionar Serviço"
                    aria-label="Adicionar novo serviço agregado"
                    data-guide-anchor="mold.servicoAdicionar"
                    className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {(editingItem?.metadata?.extraServices || []).map((service: any, index: number) => (
                    <div key={index} data-guide-anchor="mold.servicoItem" className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3 p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <div className="col-span-7 flex flex-col gap-1"><label htmlFor={`service-name-${index}`} className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-1">Nome do Serviço</label><input id={`service-name-${index}`} type="text" value={service.name} title="Nome do Serviço" onChange={(e) => { const newServices = [...(editingItem?.metadata?.extraServices || [])]; newServices[index] = { ...newServices[index], name: e.target.value.toUpperCase() }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); }} placeholder="EX: PINTURA" className={`w-full px-4 py-3 rounded-xl font-bold text-xs uppercase outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-emerald-600'}`} /></div>
                      <div className="col-span-4 flex flex-col gap-1"><label htmlFor={`service-cost-${index}`} className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-1">Valor (R$)</label><div className="relative group"><input id={`service-cost-${index}`} type="number" step="0.01" value={service.cost || ''} title="Custo do Serviço" onChange={(e) => { const newServices = [...(editingItem?.metadata?.extraServices || [])]; newServices[index] = { ...newServices[index], cost: parseFloat(e.target.value) }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); }} placeholder="0,00" className={`w-full px-4 py-3 rounded-xl font-bold text-xs text-center outline-none border-2 pr-10 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-emerald-600'}`} /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir valor do serviço" onClick={() => setActiveCalc({ initialValue: service.cost || 0, onResult: (val) => { const newServices = [...(editingItem?.metadata?.extraServices || [])]; newServices[index] = { ...newServices[index], cost: val }; setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); } })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all"><Calculator size={12} /></button></div></div>
                      <div className="col-span-1 flex items-end pb-1"><button type="button" title="Remover Serviço" aria-label="Remover este serviço" onClick={() => { const newServices = (editingItem?.metadata?.extraServices || []).filter((_: any, i: number) => i !== index); setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null); }} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"><Trash2 size={16} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
              )}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Palette size={18} className="text-indigo-500" /><span className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">Cores Selecionadas e Sub-Ref</span></div>
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(true)}
                    data-guide-anchor="mold.coresAdicionar"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <Plus size={13} strokeWidth={3} /> Adicionar Cor
                  </button>
                </div>
                {(editingItem?.metadata?.colorVariations || []).length === 0 ? (
                  <p className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest text-center py-4">Nenhuma cor selecionada — toque em "Adicionar Cor".</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {(editingItem?.metadata?.colorVariations || []).map((variation: any) => {
                      const color = (colors || []).find(c => c.id === variation.colorId);
                      const removeColor = () => { setEditingItem(prev => { if (!prev) return null; const variations = (prev.metadata?.colorVariations || []).filter((cv: any) => cv.colorId !== variation.colorId); return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } }; }); };
                      return (
                        <div key={variation.colorId} data-guide-anchor="mold.corSubRef" className={`p-3 rounded-2xl border-2 flex flex-col gap-2 transition-all border-indigo-500/30 bg-indigo-500/5`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`flex-1 min-w-0 truncate text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{color?.name || variation.colorName}</span>
                            <button type="button" onClick={removeColor} aria-label={`Remover ${color?.name || variation.colorName}`} title="Remover" className="text-rose-400 hover:text-rose-500 shrink-0">
                              <X size={16} strokeWidth={3} />
                            </button>
                          </div>
                          <input type="text" placeholder="SUB-REF" value={variation.subRef || ''} onChange={(e) => { const subRef = e.target.value.toUpperCase(); setEditingItem(prev => { if (!prev) return null; const variations = [...(prev.metadata?.colorVariations || [])]; const idx = variations.findIndex((cv: any) => cv.colorId === variation.colorId); variations[idx] = { ...variations[idx], subRef }; return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } }; }); }} className={`w-full px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100'}`} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Modal isOpen={showColorPicker} onClose={() => setShowColorPicker(false)} title="Escolher Cores" icon={<Palette size={20} />} maxWidth="max-w-md" zIndex={80000}>
                <div className="grid grid-cols-2 gap-2">
                  {(colors || []).map(color => {
                    const isSelected = (editingItem?.metadata?.colorVariations || []).some((cv: any) => cv.colorId === color.id);
                    const toggleColor = () => { setEditingItem(prev => { if (!prev) return null; const variations = [...(prev.metadata?.colorVariations || [])]; const idx = variations.findIndex((cv: any) => cv.colorId === color.id); if (idx >= 0) variations.splice(idx, 1); else variations.push({ colorId: color.id, colorName: color.name, subRef: '' }); return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } }; }); };
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={toggleColor}
                        data-guide-anchor="mold.corPickerItem"
                        className={`p-3 rounded-2xl border-2 flex items-center gap-2 min-w-0 transition-all ${isSelected ? 'border-indigo-500/30 bg-indigo-500/5' : isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-50 bg-slate-50/50'}`}
                      >
                        <span className={`flex-1 min-w-0 truncate text-left text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{color.name}</span>
                        {isSelected ? <CheckCircle2 size={18} className="text-indigo-500 shrink-0" /> : <Circle size={18} className="text-slate-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </Modal>

              {/* CALCULATION CARD — só faz sentido se a matriz compra/consome material (Pergunta 1) */}
              {moldBuysMaterials && (() => {
                const activeSizesCount = Object.values(editingItem?.metadata?.sizeWeights || {}).filter(w => (w as number) > 0).length;
                const effectiveTotalWeight = editingItem?.metadata?.totalWeight || totalWeightLive;
                const avgWeight = activeSizesCount > 0 ? effectiveTotalWeight / activeSizesCount : 0;
                const materialPrice = editingItem?.metadata?.price || 0;
                const materialCostPerPair = (avgWeight / 1000) * materialPrice;
                const extraServicesCost = (editingItem?.metadata?.extraServices || []).reduce((sum: number, s: any) => sum + (s.cost || 0), 0);
                const suggestedPrice = materialCostPerPair + extraServicesCost;
                const isUnitCostSynced = (editingItem?.metadata?.unitCost || 0) > 0 && Math.abs((editingItem?.metadata?.unitCost || 0) - suggestedPrice) < 0.0001;

                return (
                  <div data-guide-anchor="mold.analiseCusto" className={`mt-4 p-6 rounded-[2rem] border-2 flex flex-col gap-4 ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Target size={18} className="text-indigo-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Análise de Custo Sugerido</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">Peso Médio (Par)</span>
                      <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{avgWeight.toFixed(2)} GR</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">Custo Material (Média × Preço/KG)</span>
                      <span className="text-xs font-black text-amber-600">R$ {materialCostPerPair.toFixed(4)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">Serviços Agregados</span>
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
            <MaterialFormFields
              item={editingItem!}
              onChange={(updated) => setEditingItem(updated)}
              isDarkMode={isDarkMode}
              suppliers={suppliers}
              flowTags={flowTags}
              colors={colors}
              units={units}
              supplyCategoryNames={supplyCategoryNames}
              existingReferences={productionConfigs.filter(c => c.type === 'MATERIAL' && c.id !== editingItem?.id).map(c => (c.metadata?.reference || '').toUpperCase()).filter(Boolean)}
              onQuickAddCategory={onQuickAddCategory}
              onQuickAddFlowTag={onQuickAddFlowTag}
              onQuickAddPerson={onQuickAddPerson}
              onQuickAddUnit={onQuickAddMaterial}
              onQuickAddColor={onQuickAddColor}
            />
          ) : type === 'TOOL' ? (
            <div className="flex flex-col gap-6">
              <div className={`w-full aspect-video rounded-3xl overflow-hidden relative border-2 border-dashed ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'} flex items-center justify-center transition-all`}>
                {editingItem?.imageUrl ? (
                  <>
                    <img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" title="Remover Foto" aria-label="Remover foto atual" onClick={() => setEditingItem(prev => prev ? { ...prev, imageUrl: '' } : null)} data-guide-anchor="tool.removerFoto" className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg">
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <button type="button" title="Adicionar Foto" aria-label="Adicionar nova foto" onClick={() => fileInputRef.current?.click()} data-guide-anchor="tool.adicionarFoto" className="flex flex-col items-center gap-2 text-blue-900 dark:text-blue-300">
                    <Camera size={24} />
                    <span className="text-xs font-bold uppercase tracking-widest">Adicionar Foto</span>
                  </button>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" title="Upload de Imagem" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Referência da Faca *</label>
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
                    data-guide-anchor="tool.gerarCodigo"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                    title="Gerar Código Automático"
                  >
                    <Wand2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Nome / Descrição da Faca *</label>
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Categoria da Faca</label>
                <button
                  type="button"
                  onClick={() => { setIsToolCategoryPickerOpen(true); setIsCreatingToolCategoryInline(false); setToolCategorySearch(''); }}
                  data-guide-anchor="tool.categoriaAbrir"
                  className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                >
                  <span className={!editingItem?.metadata?.category ? 'opacity-40 normal-case' : ''}>
                    {editingItem?.metadata?.category || 'Sem categoria'}
                  </span>
                  <ChevronRight size={18} className="text-slate-400 shrink-0" />
                </button>
              </div>

              <Modal isOpen={isToolCategoryPickerOpen} onClose={() => { setIsToolCategoryPickerOpen(false); setIsCreatingToolCategoryInline(false); }} title="Categoria da Faca" maxWidth="max-w-sm" zIndex={80000}>
                {!isCreatingToolCategoryInline ? (
                  <div className="flex flex-col gap-4" data-guide-anchor="tool.categoriaLista">
                    <button
                      type="button"
                      onClick={() => { setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: '' } } : null); setIsToolCategoryPickerOpen(false); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                    >
                      <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Sem categoria</span>
                    </button>
                    <div className="relative">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={toolCategorySearch}
                        onChange={(e) => setToolCategorySearch(e.target.value)}
                        placeholder="Buscar categoria..."
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                      {toolCategoryNames.filter(name => name.toLowerCase().includes(toolCategorySearch.toLowerCase())).map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => { setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: name } } : null); setIsToolCategoryPickerOpen(false); }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                        >
                          <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{name}</span>
                          <ChevronRight size={16} className="text-indigo-400" />
                        </button>
                      ))}
                      {toolCategoryNames.filter(name => name.toLowerCase().includes(toolCategorySearch.toLowerCase())).length === 0 && (
                        <p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-6">Nenhuma categoria encontrada.</p>
                      )}
                    </div>
                    {onQuickAddCategory && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingToolCategoryInline(true)}
                        data-guide-anchor="tool.categoriaCadastrar"
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                      >
                        <Plus size={14} strokeWidth={3} /> Não encontrou? Cadastre uma categoria aqui
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest leading-relaxed">
                      Salvo direto em Categorias — fica disponível pra qualquer outro cadastro do sistema, sem sair de Facas.
                    </p>
                    <div>
                      <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Nome da Categoria</label>
                      <input
                        type="text"
                        value={newToolCategoryName}
                        onChange={(e) => setNewToolCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickCreateToolCategory())}
                        placeholder="Ex: Lateral"
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => setIsCreatingToolCategoryInline(false)} data-guide-anchor="tool.categoriaInlineVoltar" className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 text-sm">
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickCreateToolCategory}
                        data-guide-anchor="tool.categoriaSalvarUsar"
                        disabled={!newToolCategoryName.trim()}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg transition-all"
                      >
                        Salvar e Usar
                      </button>
                    </div>
                  </div>
                )}
              </Modal>
              <div className="flex flex-col gap-2">
                <input
                  type="number"
                  step="any"
                  value={editingItem?.metadata?.conjugation ?? ''}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, conjugation: e.target.value === '' ? undefined : Number(e.target.value) } } : null)}
                  placeholder="1"
                  className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2`}
                  required
                />
                <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mt-1 ml-2 leading-relaxed italic">
                  ( AQUI CADASTRAMOS SE A FACA E SIMPLES OU CONJUGADA, SE CONJUGADA ELA TEM QUANTAS REPETICOES, CONJUGACOES. SE A FACA PRECISA DE MAIS DE 1 BATIDA PARA FORMAR 1 PAR, USE UM VALOR FRACIONARIO, EX: <span className="text-black dark:text-white not-italic">2</span> BATIDAS POR PAR = <span className="text-black dark:text-white not-italic">0.5</span> )
                </p>
              </div>

              <div className="flex flex-col gap-2 mb-2 ml-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500"><TableCellsMerge size={16} /></div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Puxar Grade</label>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsFacaGridSearchOpen(true); setFacaGridSearchTerm(''); setIsCreatingFacaGridInline(false); }}
                  data-guide-anchor="tool.gradeAbrir"
                  className={`w-full flex items-center justify-between px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-600'}`}
                >
                  <span className={(editingItem?.metadata?.sizes || []).length === 0 ? 'opacity-40 normal-case' : ''}>
                    {grids.find(g => g.type === GridType.FACA && JSON.stringify(g.sizes) === JSON.stringify(editingItem?.metadata?.sizes || []))?.name || 'Selecionar...'}
                  </span>
                  <ChevronRight size={16} className="text-slate-400 shrink-0" />
                </button>
              </div>

              <Modal isOpen={isFacaGridSearchOpen} onClose={() => { setIsFacaGridSearchOpen(false); setIsCreatingFacaGridInline(false); }} title="Grade da Faca" maxWidth="max-w-md" zIndex={80000}>
                {!isCreatingFacaGridInline ? (
                  <div className="flex flex-col gap-4" data-guide-anchor="tool.gradeLista">
                    <div className="relative">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={facaGridSearchTerm}
                        onChange={(e) => setFacaGridSearchTerm(e.target.value)}
                        placeholder="Buscar grade de faca..."
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                      {grids.filter(g => g.type === GridType.FACA && g.name.toLowerCase().includes(facaGridSearchTerm.toLowerCase())).map(g => (
                        <div key={g.id} className={`w-full flex items-center gap-2 p-4 rounded-2xl border-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className={`text-xs font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{g.name}</span>
                            <span className="text-[9px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest truncate">
                              {(g.sizes || []).length > 0 ? sortSizeKeys(g.sizes || []).join(', ') : 'Sem numerações cadastradas'}
                            </span>
                          </div>
                          <button type="button" title="Usar esta Grade" aria-label={`Usar a grade ${g.name}`} onClick={() => applyGridToFaca(g)} className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shrink-0">
                            <Check size={14} strokeWidth={3} />
                          </button>
                          <button type="button" title="Editar Grade" aria-label={`Editar a grade ${g.name}`} onClick={() => startEditFacaGrid(g)} className={`p-2.5 rounded-xl transition-colors shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-700'}`}>
                            <Edit3 size={14} />
                          </button>
                          <button type="button" title="Excluir Grade" aria-label={`Excluir a grade ${g.name}`} onClick={() => handleDeleteGrid(g)} className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {grids.filter(g => g.type === GridType.FACA && g.name.toLowerCase().includes(facaGridSearchTerm.toLowerCase())).length === 0 && (
                        <p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-6">Nenhuma grade de faca encontrada.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={startCreateFacaGrid}
                      data-guide-anchor="tool.gradeCriar"
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus size={14} strokeWidth={3} /> Não encontrou? Criar Nova Grade
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">{editingFacaGridId ? 'Editando Grade' : 'Nova Grade'}</p>
                    <div>
                      <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Nome da Grade</label>
                      <input
                        type="text"
                        value={newFacaGridName}
                        onChange={(e) => setNewFacaGridName(e.target.value)}
                        placeholder="Ex: 38 ao 43"
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Adicionar Numeração</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFacaGridSizeInput}
                          onChange={(e) => setNewFacaGridSizeInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewFacaGridSize())}
                          placeholder="Ex: 38"
                          className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                        />
                        <button type="button" onClick={addNewFacaGridSize} data-guide-anchor="tool.gradeInlineAddSize" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-black transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="min-h-[50px] flex flex-wrap gap-2 p-3 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                      {newFacaGridSizes.map(size => (
                        <span key={size} className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          {size}
                          <button type="button" onClick={() => removeNewFacaGridSize(size)} data-guide-anchor="tool.gradeInlineRemoveSize" className="text-rose-400 hover:text-rose-600">×</button>
                        </span>
                      ))}
                      {newFacaGridSizes.length === 0 && <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold italic self-center">Adicione numerações acima</span>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setIsCreatingFacaGridInline(false); setEditingFacaGridId(null); }} data-guide-anchor="tool.gradeInlineVoltar" className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 text-sm">
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInlineFacaGrid}
                        data-guide-anchor="tool.gradeInlineSalvar"
                        disabled={!newFacaGridName.trim() || newFacaGridSizes.length === 0}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg transition-all"
                      >
                        {editingFacaGridId ? 'Salvar Alterações e Usar' : 'Salvar e Usar'}
                      </button>
                    </div>
                  </div>
                )}
              </Modal>

              <div className="flex flex-col gap-4">
                <label htmlFor="tool-new-size" className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 px-2">Configurar Numerações</label>
                <div className="flex gap-2">
                  <input id="tool-new-size" type="text" value={newSize} onChange={(e) => setNewSize(e.target.value)} title="Nova Numeração" placeholder="Ex: 37" className={`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                  <button type="button" title="Adicionar Numeração" aria-label="Adicionar este tamanho" onClick={addSize} data-guide-anchor="tool.numeracaoAdicionar" className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Plus size={24} />
                  </button>
                </div>
                <div className="p-6 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                  {(editingItem?.metadata?.sizes || []).map(size => (
                    <div key={size} className={`px-4 py-2 rounded-xl flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                      <span className="text-xs font-black">{size}</span>
                      <button type="button" title={`Remover ${size}`} aria-label={`Remover tamanho ${size}`} onClick={() => removeSize(size)} data-guide-anchor="tool.numeracaoRemover" className="text-slate-300 hover:text-red-500 transition-colors">
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
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">MATRIZ DE ÁREA (M²)</h4>
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
                      data-guide-anchor="tool.escalonarGrade"
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
                            data-guide-anchor="tool.modeloToggle"
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all active:scale-[0.99] ${selected ? (isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50') : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-indigo-600 border-indigo-600' : isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                              {selected && <Check size={12} strokeWidth={3} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{product.name}</p>
                              <p className="text-[9px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">{product.reference}</p>
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

              {/* PALMILHA - vincular esta faca como molde de palmilha (estoque por cor/grade) */}
              <div className={`p-6 rounded-[2rem] border-2 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setEditingItem(prev => {
                    if (!prev) return null;
                    const meta = { ...(prev.metadata || {}) };
                    if (meta.palmilha) {
                      delete meta.palmilha;
                    } else {
                      meta.palmilha = { subtype: 'MONTAGEM', colorVariations: [] };
                    }
                    return { ...prev, metadata: meta };
                  })}
                  data-guide-anchor="tool.palmilhaToggle"
                  className="w-full flex items-center justify-between gap-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Footprints size={18} className="text-rose-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">Esta faca também é molde de Palmilha?</span>
                  </div>
                  {editingItem?.metadata?.palmilha ? <CheckCircle2 size={22} className="text-rose-500" /> : <Circle size={22} className="text-slate-300" />}
                </button>

                {editingItem?.metadata?.palmilha && (
                  <div className="flex flex-col gap-4 pt-2">
                    <p className="text-[9px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest leading-relaxed">
                      Usa as numerações cadastradas acima como grades de estoque de palmilha.
                    </p>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Tipo de Palmilha</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['MONTAGEM', 'ACABAMENTO'] as const).map(sub => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setEditingItem(prev => {
                              if (!prev) return null;
                              const currentPalmilha = prev.metadata?.palmilha || { subtype: 'MONTAGEM' as const, colorVariations: [] };
                              return { ...prev, metadata: { ...prev.metadata, palmilha: { ...currentPalmilha, subtype: sub } } };
                            })}
                            data-guide-anchor="tool.palmilhaSubtipo"
                            className={`py-3 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all ${editingItem?.metadata?.palmilha?.subtype === sub ? 'bg-rose-500 border-rose-600 text-white' : isDarkMode ? 'bg-slate-900 border-slate-800 text-blue-300' : 'bg-white border-slate-100 text-blue-900'}`}
                          >
                            {sub === 'MONTAGEM' ? 'Montagem' : 'Acabamento'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2"><Palette size={18} className="text-rose-500" /><span className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">Cores da Palmilha</span></div>
                      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {(colors || []).map(color => {
                          const variation = (editingItem?.metadata?.palmilha?.colorVariations || []).find((cv: any) => cv.colorId === color.id);
                          const isSelected = !!variation;
                          return (
                            <div key={color.id} className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all ${isSelected ? 'border-rose-500/30 bg-rose-500/5' : isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-50 bg-slate-50/50'}`}>
                              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl shadow-sm border border-black/10" style={{ backgroundColor: color.hex }} /><span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{color.name}</span></div>
                              <div className="flex items-center gap-2">
                                {isSelected && (
                                  <input
                                    type="text"
                                    placeholder="SUB-REF"
                                    value={variation.subRef || ''}
                                    onChange={(e) => {
                                      const subRef = e.target.value.toUpperCase();
                                      setEditingItem(prev => {
                                        if (!prev) return null;
                                        const currentPalmilha = prev.metadata?.palmilha || { subtype: 'MONTAGEM' as const, colorVariations: [] };
                                        const variations = [...(currentPalmilha.colorVariations || [])];
                                        const idx = variations.findIndex((cv: any) => cv.colorId === color.id);
                                        variations[idx] = { ...variations[idx], subRef };
                                        return { ...prev, metadata: { ...prev.metadata, palmilha: { ...currentPalmilha, colorVariations: variations } } };
                                      });
                                    }}
                                    className={`w-24 px-3 py-2 rounded-xl font-black text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100'}`}
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItem(prev => {
                                      if (!prev) return null;
                                      const currentPalmilha = prev.metadata?.palmilha || { subtype: 'MONTAGEM' as const, colorVariations: [] };
                                      const variations = [...(currentPalmilha.colorVariations || [])];
                                      const idx = variations.findIndex((cv: any) => cv.colorId === color.id);
                                      if (idx >= 0) variations.splice(idx, 1);
                                      else variations.push({ colorId: color.id, colorName: color.name, subRef: '' });
                                      return { ...prev, metadata: { ...prev.metadata, palmilha: { ...currentPalmilha, colorVariations: variations } } };
                                    });
                                  }}
                                  data-guide-anchor="tool.palmilhaCorToggle"
                                  className={`p-2 rounded-xl transition-all ${isSelected ? 'text-rose-500' : 'text-slate-300'}`}
                                >
                                  {isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {editingItem?.metadata?.palmilha?.subtype === 'ACABAMENTO' && (
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Serviço de Acabamento (ex: Silk)</label>
                        <select
                          value={editingItem?.metadata?.palmilha?.silkServiceId || ''}
                          title="Serviço de Acabamento"
                          onChange={(e) => setEditingItem(prev => {
                            if (!prev) return null;
                            const currentPalmilha = prev.metadata?.palmilha || { subtype: 'ACABAMENTO' as const, colorVariations: [] };
                            return { ...prev, metadata: { ...prev.metadata, palmilha: { ...currentPalmilha, silkServiceId: e.target.value || undefined } } };
                          })}
                          className={`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-rose-100'}`}
                        >
                          <option value="">Nenhum</option>
                          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : type === 'INFESTO' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Layers size={32} /></div><p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest leading-relaxed">Configuração de Camadas para<br />Corte e Produção</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Nome do Infesto *</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: COURO PADRÃO" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Quantidade de Camadas *</label><div className="relative group"><input type="number" value={editingItem?.metadata?.layers || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, layers: Number(e.target.value) } } : null)} placeholder="Ex: 4" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir quantidade de camadas" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.layers || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, layers: val } } : null) })} data-guide-anchor="infesto.camadasCalc" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
            </div>
          ) : type === 'DEADLINE' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><CalendarClock size={32} /></div><p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest leading-relaxed">Definição de Prazos e SLA<br />para Ordens de Produção</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Nome do Prazo *</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: URGENTE, PADRÃO..." className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Prazo em Dias *</label><div className="relative group"><input type="number" value={editingItem?.metadata?.days || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, days: Number(e.target.value) } } : null)} placeholder="Ex: 7" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir prazo em dias" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.days || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, days: val } } : null) })} data-guide-anchor="deadline.diasCalc" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div></div>
            </div>
          ) : type === 'PACKAGING' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Grid3X3 size={32} /></div><p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest leading-relaxed">Configuração de Grades e<br />Tamanhos para Embalagens</p></div>
              <div className="flex flex-col gap-2"><label className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ml-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nome do Padrão * {guideActive && <GuidePulseDot show />}</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: FEMININO 33-40" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2">
                <label className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ml-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Tipo de Grade {guideActive && <GuidePulseDot show />}</label>
                <div data-guide-anchor="pkg.tipoGradeToggle" className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FIXED' } } : null)}
                    className={`flex flex-col gap-1 p-4 rounded-2xl border-2 text-left transition-all ${(!editingItem?.metadata?.mode || editingItem?.metadata?.mode === 'FIXED') ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-widest ${(!editingItem?.metadata?.mode || editingItem?.metadata?.mode === 'FIXED') ? 'text-indigo-600 dark:text-indigo-400' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>Grade Fixa</span>
                    <span className="text-[10px] font-medium normal-case text-blue-900 dark:text-blue-300 leading-relaxed">Use quando toda caixa desse padrão sempre leva a mesma quantidade de pares de cada numeração (ex.: 1 par de cada tamanho, do 34 ao 40). Você define essa distribuição abaixo.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FREE' } } : null)}
                    className={`flex flex-col gap-1 p-4 rounded-2xl border-2 text-left transition-all ${editingItem?.metadata?.mode === 'FREE' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-widest ${editingItem?.metadata?.mode === 'FREE' ? 'text-indigo-600 dark:text-indigo-400' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>Grade Livre</span>
                    <span className="text-[10px] font-medium normal-case text-blue-900 dark:text-blue-300 leading-relaxed">Use quando a mistura de numerações dentro da caixa varia a cada vez — só a capacidade total de pares importa, sem uma distribuição fixa por tamanho.</span>
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2"><label className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ml-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Capacidade Total (Pares) * {guideActive && <GuidePulseDot show />}</label><div className="relative group"><input type="number" value={editingItem?.metadata?.capacity || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, capacity: Number(e.target.value) } } : null)} placeholder="Ex: 12" className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center pr-12 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /><button type="button" title="Abrir Calculadora" aria-label="Abrir calculadora para definir capacidade total" onClick={() => setActiveCalc({ initialValue: editingItem?.metadata?.capacity || 0, onResult: (val) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, capacity: val } } : null) })} data-guide-anchor="pkg.capacidadeCalc" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"><Calculator size={16} /></button></div>
                <p className="text-[10px] font-medium text-blue-900 dark:text-blue-300 leading-relaxed px-2">Quantos pares cabem nessa embalagem?</p>
              </div>

              {/* Cor do badge de estoque (ex.: "12P") — escolhida aqui pra diferenciar de
                  relance, no Estoque, caixas de padrões diferentes (12 pares x 15 pares...). */}
              <div className="flex flex-col gap-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cor do Badge no Estoque</label>
                <div className="flex flex-wrap gap-2 px-2">
                  {BADGE_COLOR_OPTIONS.map(color => {
                    const active = (editingItem?.metadata?.badgeColor || DEFAULT_BADGE_COLOR) === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, badgeColor: color } } : null)}
                        data-guide-anchor="pkg.corBadge"
                        title={color}
                        aria-label={`Cor ${color}`}
                        className={`w-9 h-9 rounded-full ${BADGE_COLOR_CLASSES[color].swatch} flex items-center justify-center transition-all ${active ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-950 scale-110' : 'opacity-60 hover:opacity-100'}`}
                      >
                        {active && <Check size={16} className="text-white" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 ml-2">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500"><Factory size={16} /></div>
                  <label className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Grade de Produção Padrão {guideActive && <GuidePulseDot show />}</label>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsProductionGradeSearchOpen(true); setIsCreatingProductionGradeInline(false); setEditingProductionGradeId(null); setProductionGradeSearchTerm(''); }}
                  data-guide-anchor="pkg.buscarGrade"
                  title="Grade de Produção Padrão"
                  aria-label="Selecionar grade de produção padrão"
                  className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none flex items-center justify-between border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                >
                  <span>{grids.find(g => g.id === editingItem?.metadata?.productionGradeId)?.name || 'Nenhuma'}</span>
                  <ChevronDown size={18} className="text-blue-500 shrink-0" />
                </button>
                <p className="text-[10px] font-medium text-blue-900 dark:text-blue-300 leading-relaxed px-2">
                  Qual a numeração (grade) que vai nessa embalagem? Toque acima pra escolher entre as grades já cadastradas ou criar uma nova — produtos cadastrados com essa grade de produção usarão automaticamente esta embalagem para converter os pares produzidos em caixas no Estoque.
                </p>
              </div>

              {/* Único popup pra Grade de Produção — antes existia também "Buscar Padrão de
                  Embalagem" separado, fazendo quase a mesma coisa (só preenchia numerações, sem
                  gravar o vínculo real usado no PCP). Consolidado num só, pra não ter duas ações
                  parecidas fazendo coisas diferentes. Fora do "mode !== FREE" de propósito — o
                  vínculo com a grade de produção faz sentido em qualquer modo, só o preenchimento
                  automático de numerações é pulado em modo Livre (ver applyProductionGradeToPack). */}
              <Modal isOpen={isProductionGradeSearchOpen} onClose={() => { setIsProductionGradeSearchOpen(false); setIsCreatingProductionGradeInline(false); setEditingProductionGradeId(null); }} title="Grade de Produção Padrão" icon={<Factory size={20} />} maxWidth="max-w-md" zIndex={80000}>
                {!isCreatingProductionGradeInline ? (
                  <div className="flex flex-col gap-4">
                    <div className="relative">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text"
                        value={productionGradeSearchTerm}
                        onChange={(e) => setProductionGradeSearchTerm(e.target.value)}
                        placeholder="Buscar grade de produção..."
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                      {grids.filter(g => (g.type === GridType.FORMA || !g.type) && g.name.toLowerCase().includes(productionGradeSearchTerm.toLowerCase())).map(g => (
                        <div
                          key={g.id}
                          className={`w-full flex items-center gap-2 p-4 rounded-2xl border-2 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                        >
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className={`text-xs font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{g.name}</span>
                            <span className="text-[9px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest truncate">
                              {(g.sizes || []).length > 0 ? sortSizeKeys(g.sizes || []).join(', ') : 'Sem numerações cadastradas'}
                            </span>
                          </div>
                          <button type="button" title="Usar esta Grade" aria-label={`Usar a grade ${g.name}`} onClick={() => applyProductionGradeToPack(g)} className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shrink-0">
                            <Check size={14} strokeWidth={3} />
                          </button>
                          <button type="button" title="Editar Grade" aria-label={`Editar a grade ${g.name}`} onClick={() => startEditProductionGrade(g)} className={`p-2.5 rounded-xl transition-colors shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-700'}`}>
                            <Edit3 size={14} />
                          </button>
                          <button type="button" title="Excluir Grade" aria-label={`Excluir a grade ${g.name}`} onClick={() => handleDeleteGrid(g)} className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {grids.filter(g => (g.type === GridType.FORMA || !g.type) && g.name.toLowerCase().includes(productionGradeSearchTerm.toLowerCase())).length === 0 && (
                        <p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest text-center py-6">Nenhuma grade encontrada. Crie aqui uma grade de sua necessidade.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={startCreateProductionGrade}
                      data-guide-anchor="pkg.buscarGrade.criar"
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus size={14} strokeWidth={3} /> Criar uma Grade de Sua Necessidade
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">{editingProductionGradeId ? 'Editando Grade' : 'Nova Grade de Produção'}</p>
                    <div>
                      <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Nome da Grade</label>
                      <input
                        type="text"
                        value={newProductionGradeName}
                        onChange={(e) => setNewProductionGradeName(e.target.value)}
                        placeholder="Ex: Adulto 34 ao 39"
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-blue-900 dark:text-blue-300 mb-1.5 block tracking-widest">Adicionar Numeração</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newProductionGradeSizeInput}
                          onChange={(e) => setNewProductionGradeSizeInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewProductionGradeSize())}
                          placeholder="Ex: 38"
                          className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-500'}`}
                        />
                        <button type="button" onClick={addNewProductionGradeSize} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-black transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="min-h-[50px] flex flex-wrap gap-2 p-3 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                      {newProductionGradeSizes.map(size => (
                        <span key={size} className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          {size}
                          <button type="button" onClick={() => removeNewProductionGradeSize(size)} className="text-rose-400 hover:text-rose-600">×</button>
                        </span>
                      ))}
                      {newProductionGradeSizes.length === 0 && <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold italic self-center">Adicione numerações acima</span>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setIsCreatingProductionGradeInline(false); setEditingProductionGradeId(null); }} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 text-sm">
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInlineProductionGrade}
                        data-guide-anchor="pkg.gradeInlineSalvar"
                        disabled={!newProductionGradeName.trim() || newProductionGradeSizes.length === 0}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg transition-all"
                      >
                        {editingProductionGradeId ? 'Salvar Alterações e Usar' : 'Salvar e Usar'}
                      </button>
                    </div>
                  </div>
                )}
              </Modal>

              {editingItem?.metadata?.mode !== 'FREE' && (editingItem?.metadata?.sizes || []).length > 0 && (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    <label className={`text-[10px] font-black uppercase tracking-widest px-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Numerações desta Embalagem</label>
                    <div className="flex flex-wrap gap-2">
                      {(editingItem?.metadata?.sizes || []).map(size => (
                        <div key={size} className={`px-4 py-2 rounded-xl flex items-center gap-2 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          <span className="text-xs font-black">{size}</span>
                          <button type="button" title={`Remover ${size}`} aria-label={`Remover tamanho ${size}`} onClick={() => removeSize(size)} data-guide-anchor="pkg.numeracaoRemover" className="text-slate-300 hover:text-red-500 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(editingItem?.metadata?.sizes || []).length > 0 && (
                    <div className={`p-6 rounded-[2.5rem] flex flex-col gap-6 ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/50'}`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between px-2">
                          <h4 className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Distribuição da Grade {guideActive && <GuidePulseDot show />}</h4>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${Object.values(editingItem?.metadata?.sizeQuantities || {}).reduce((a: number, b) => a + (Number(b) || 0), 0) === (editingItem?.metadata?.capacity || 0) ? 'text-emerald-500' : 'text-red-500'}`}>Total: {Object.values(editingItem?.metadata?.sizeQuantities || {}).reduce((a: number, b) => a + (Number(b) || 0), 0)} / {editingItem?.metadata?.capacity || 0}</span>
                        </div>
                        <p className="text-[10px] font-medium text-blue-900 dark:text-blue-300 leading-relaxed px-2">Quantos pares de cada número vão nessa embalagem — a soma precisa bater com a Capacidade Total.</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {(editingItem?.metadata?.sizes || []).map(size => (
                          <div key={size} className="flex flex-col gap-2 items-center">
                            <label htmlFor={`pack-qty-${size}`} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${isDarkMode ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>{size}</label>
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
              <div className="flex flex-col gap-2 text-center"><div className={`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{icon}</div><p className="text-[10px] text-blue-900 dark:text-blue-300 font-bold uppercase tracking-widest leading-relaxed">Preencha os dados abaixo para<br />registrar em {label}</p></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Nome / Sigla</label><input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="Ex: UN, KG, MT..." className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} required /></div>
              <div className="flex flex-col gap-2"><label className="text-[10px] font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 ml-2">Descrição Completa</label><input type="text" value={editingItem?.description || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)} placeholder="Ex: Unidade, Quilograma, Metro..." className={`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2`} /></div>
            </div>
          )}
          <button type="submit" disabled={isLoading} data-guide-anchor="prodcfg.salvarRegistro" className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? (<><Loader2 size={18} className="animate-spin" />SALVANDO...</>) : (<><Check size={18} strokeWidth={3} />{editingItem?.id ? 'Salvar Alterações' : 'Confirmar Cadastro'}</>)}</button>
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
              data-guide-anchor="prodcfg.escalonarCancelar"
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
              data-guide-anchor="prodcfg.escalonarAplicar"
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


function SectorCard({ sector, flowTags, isDarkMode, pendingCount, isSavedAsTemplate, onEdit, onDelete, onToggleHidden, onSaveAsTemplate }: {
  sector: Sector;
  flowTags: FlowTag[];
  isDarkMode: boolean;
  pendingCount: number;
  isSavedAsTemplate: boolean;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  onToggleHidden: () => void | Promise<void>;
  onSaveAsTemplate: () => void;
  key?: React.Key;
}) {
  const controls = useDragControls();
  const sectorTags = flowTags.filter(t => sector.flowTagIds?.includes(t.id));

  return (
    <Reorder.Item
      value={sector}
      dragListener={false}
      dragControls={controls}
      className={`p-5 rounded-[2.5rem] border flex flex-col gap-4 group transition-shadow ${sector.hidden ? 'opacity-60' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}
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
              <div className="flex items-center gap-2">
                <h4 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sector.name}</h4>
                {sector.hidden && (
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 tracking-widest">Oculto</span>
                )}
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Setor de Produção{pendingCount > 0 ? ` · ${pendingCount} ${pendingCount === 1 ? 'pedido ativo' : 'pedidos ativos'}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              data-guide-anchor="sector.editar"
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
              data-guide-anchor="sector.excluir"
              title="Excluir Setor"
              aria-label="Excluir Setor"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-red-400' : 'bg-slate-50 text-slate-400 hover:text-red-500'}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onToggleHidden}
              data-guide-anchor="sector.ocultarToggle"
              title={sector.hidden ? 'Exibir Setor no PCP' : 'Ocultar Setor do PCP'}
              aria-label={sector.hidden ? 'Exibir Setor no PCP' : 'Ocultar Setor do PCP'}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
            >
              {sector.hidden ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            {isTemplateAdmin() && (
              <button
                onClick={onSaveAsTemplate}
                data-guide-anchor="sector.salvarModelo"
                disabled={isSavedAsTemplate}
                title={isSavedAsTemplate ? 'Usado como exemplo pra novas contas' : 'Usar como exemplo pra novas contas'}
                aria-label={isSavedAsTemplate ? `${sector.name} já é um modelo disponível` : `Usar ${sector.name} como exemplo pra novas contas`}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isSavedAsTemplate
                    ? 'text-violet-500'
                    : isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-violet-400' : 'bg-slate-50 text-slate-400 hover:text-violet-600'
                }`}
              >
                {isSavedAsTemplate ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {sector.isProductionCycleEnd && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-violet-900/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
          <CheckCircle2 size={14} className="shrink-0" />
          <p className="text-[9px] font-black uppercase tracking-widest leading-tight">Fim do Ciclo de Produção — finaliza o pedido (baixa de estoque/reserva) ao concluir aqui</p>
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

function MaterialCard({ item, isDarkMode, onEdit, onDelete, flowTags, people, need = 0, colors, productionConfigs }: {
  item: ProductionConfigItem,
  isDarkMode: boolean,
  onEdit: () => void,
  onDelete: () => void | Promise<void>,
  flowTags: FlowTag[],
  people: any[],
  need?: number,
  colors: any[],
  productionConfigs: ProductionConfigItem[],
  key?: React.Key
}) {
  const [expanded, setExpanded] = useState(false);
  const unitName = productionConfigs.find(c => c.id === item.metadata?.unitId)?.name || item.metadata?.unit || 'UN';
  const flowTag = flowTags.find(t => t.id === item.metadata?.flowTagId);
  const supplier = people.find(p => p.id === item.metadata?.supplierId);

  const { yieldVal } = useMemo(() => {
    const weights = Object.values(item.metadata?.sizeWeights || {}) as number[];
    const activeWeights = weights.filter(w => w > 0);
    const total = activeWeights.reduce((a, b) => a + b, 0);
    return { totalWeight: total, yieldVal: activeWeights.length > 0 ? activeWeights.length / total : 0 };
  }, [item.metadata]);

  const stock = getTotalMaterialStock(item);
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
        data-guide-anchor="material.cardToggle"
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
          <span className="text-[8px] font-bold text-slate-400 uppercase">{unitName}</span>
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
                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase">{yieldVal.toFixed(2)} prs / {unitName}</span>
              </div>
            )}
          </div>

          {/* Stock + need */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl flex flex-col gap-0.5 ${isLowStock ? (isDarkMode ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-100') : (isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50')}`}>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estoque Atual</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-black ${isLowStock ? 'text-rose-500' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{stock.toLocaleString('pt-BR')}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">{unitName}</span>
              </div>
              <span className="text-[8px] font-bold text-slate-400 uppercase">Mín: {minStock}</span>
              {isLowStock && <span className="text-[8px] font-black text-rose-500 uppercase mt-0.5">⚠ Estoque Baixo</span>}
            </div>

            <div className={`p-3 rounded-xl flex flex-col gap-0.5 ${hasPendingNeed ? (isDarkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100') : (isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50')}`}>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Necessidade Prod.</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-black ${hasPendingNeed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{need.toLocaleString('pt-BR')}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">{unitName}</span>
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
            <span className="text-[9px] font-bold text-slate-400 uppercase">Cores Cadastradas: {item.metadata?.colorIds?.length || 0}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} data-guide-anchor="material.cardEditar" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 hover:bg-indigo-100 transition-colors">
                <Edit3 size={11} /> Editar
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} data-guide-anchor="material.cardExcluir" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 transition-colors">
                <Trash2 size={11} /> Excluir
              </button>
            </div>
          </div>

          {/* Estoque detalhado por cor */}
          {((item.metadata?.colorIds?.length || 0) > 0) && (
            <div className={`mt-2 p-3 rounded-xl flex flex-col gap-2 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estoque por Cor</span>
              <div className="flex flex-wrap gap-2">
                {(item.metadata?.colorIds || []).map((colorId) => {
                  const color = colors.find(c => c.id === colorId);
                  const qty = item.metadata?.stockByColor?.[colorId] || 0;
                  return (
                    <div key={colorId} className="flex items-center gap-1.5 px-2 py-1 rounded-md border shadow-sm bg-white dark:bg-slate-900 dark:border-slate-800">
                      <div className="w-2 h-2 rounded-full border border-slate-200" style={{ backgroundColor: color?.hex || '#ccc' }} />
                      <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">{color?.name || 'COR'}</span>
                      <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 ml-1">{Number(qty).toLocaleString('pt-BR')} {unitName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
  // Com mais de 4 numerações os cards (aumentados a pedido do Tiago pra mostrar estoque
  // melhor) não cabem mais numa linha só — encolhe de volta pro tamanho compacto original
  // pra organizar em mais colunas por linha em vez de estourar o card pra baixo.
  const isCompactSizes = Object.keys(safeSizeWeights).length > 4;

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
            <p className="text-[9px] text-blue-900 dark:text-blue-300 font-medium uppercase tracking-widest mt-0.5">{item.metadata?.category || 'GERAL'} • {flowTag?.name || 'S/ FLUXO'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} data-guide-anchor="mold.cardEditar" title="Editar Matriz" aria-label={`Editar matriz ${item.name}`} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"><Edit3 size={18} /></button>
          <button onClick={onDelete} data-guide-anchor="mold.cardExcluir" title="Excluir Matriz" aria-label={`Excluir matriz ${item.name}`} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
        </div>
      </div>

      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedColors.map((cv: any) => {
            if (!cv) return null;
            const color = safeColors.find(c => c.id === cv.colorId);
            return (
              <div key={cv.colorId || String(Math.random())} className={`px-3.5 py-2 rounded-xl flex items-center gap-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: color?.hex || '#ccc' }} />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">{color?.name || 'COR'} ({cv.subRef})</span>
              </div>
            );
          })}
        </div>
      )}

      {Object.keys(safeSizeWeights).length > 0 && (
        <div className={`p-4 rounded-2xl flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
            <Package size={14} />
            <span className="text-[9px] font-black uppercase tracking-widest">Pesos por Tamanho (g)</span>
          </div>
          {isCompactSizes ? (
            /* Mais de 4 numerações — vira um card único em formato de tabela em vez de N
               caixinhas separadas (que passariam a quebrar em várias linhas e deixar o card
               enorme); pedido do Tiago como alternativa ao encolher as caixinhas. */
            <div className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black">
                    <th className="px-4 py-2 text-left text-[10px] font-black text-white uppercase tracking-widest">Tamanho</th>
                    <th className="px-4 py-2 text-right text-[10px] font-black text-white uppercase tracking-widest">Peso</th>
                    <th className="px-4 py-2 text-right text-[10px] font-black text-white uppercase tracking-widest">Estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {sortSizeEntries(Object.entries(safeSizeWeights)).map(([size, weight]) => {
                    const stock = getStockForSize(size);
                    return (
                      <tr key={size} className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <td className="px-4 py-2.5 text-sm font-black text-slate-800 dark:text-white">{size}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-800 dark:text-slate-200">{Number(weight) || 0} g</td>
                        <td className="px-4 py-2.5 text-right text-sm font-medium text-emerald-500">{stock > 0 ? stock : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {sortSizeEntries(Object.entries(safeSizeWeights)).map(([size, weight]) => {
                const stock = getStockForSize(size);
                return (
                  <div key={size} className="flex flex-col items-center rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm min-w-[96px]">
                    <div className="w-full px-5 py-2 bg-black flex items-center justify-center">
                      <span className="text-xs font-black text-white uppercase tracking-widest">{size}</span>
                    </div>
                    <div className="w-full px-5 py-4 bg-white flex flex-col items-center gap-1">
                      <span className="text-lg font-medium text-slate-800">{Number(weight) || 0} g</span>
                      {stock > 0 && (
                        <span className="text-xs font-medium text-emerald-500 uppercase tracking-widest">Est: {stock}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-0.5">Rendimento:</span>
              <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
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
            <span className="text-[9px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest ml-1">
              Soma: {Object.values(safeSizeWeights).reduce((a, b) => Number(a) + Number(b), 0).toFixed(1)} g
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[9px] font-black text-blue-900 dark:text-blue-300 uppercase tracking-widest mb-1">Custo por Par</p>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-black text-emerald-500">R$</span>
            <span className="text-xl font-black text-emerald-500">
              {(() => {
                // Quando "Você compra o solado pronto?" = SIM, o valor digitado direto em
                // "Valor Pago por Par" (readySoleCost) é o custo de verdade — usar o unitCost
                // (calculado por peso × preço/KG do material) aqui ignorava isso e mostrava um
                // valor antigo/errado no card (reportado pelo Tiago com print).
                const baseCost = item.metadata?.buysReadySole
                  ? (Number(item.metadata?.readySoleCost) || 0)
                  : (Number(item.metadata?.unitCost) || 0);
                const servicesCost = safeExtraServices.reduce((acc: number, s: any) => acc + (Number(s?.cost) || 0), 0);
                return (baseCost + servicesCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
