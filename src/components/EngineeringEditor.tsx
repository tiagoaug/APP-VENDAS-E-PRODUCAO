import React, { useState, useEffect } from 'react';
import { 
  X, Scissors, Box, Calculator, Sparkles, Plus, 
  ArrowUpDown, Trash2, Info, ChevronLeft, Save,
  CheckCircle2, ChevronRight, Footprints, ChevronDown, Grid3X3, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ProductionConfigItem, ComponentConsumption, Sector, 
  ColorValue, Grid 
} from '../types';
import Modal from './Modal';
import CalculatorModal from './CalculatorModal';

interface EngineeringEditorProps {
  key?: any;
  isDarkMode: boolean;
  consumption: ComponentConsumption;
  onSave: (consumption: ComponentConsumption) => void;
  onCancel: () => void;
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  sectors: Sector[];
  grids: Grid[];
  productionGridId: string;
  defaultGridId: string;
  toolMapping: { [size: string]: string };
  activeVariationColor?: { name: string, hex: string };
  onSaveConfigItem?: (item: ProductionConfigItem) => Promise<void>;
}

export default function EngineeringEditor({
  isDarkMode,
  consumption,
  onSave,
  onCancel,
  productionConfigs,
  colors,
  sectors,
  grids,
  productionGridId,
  defaultGridId,
  toolMapping,
  activeVariationColor,
  onSaveConfigItem
}: EngineeringEditorProps) {
  const [editing, setEditing] = useState<ComponentConsumption>({ ...consumption });
  const [newServiceId, setNewServiceId] = useState('');
  const [newServiceCost, setNewServiceCost] = useState<number | string>(0);
  const [showToolMapping, setShowToolMapping] = useState(false);
  const [calcExpression, setCalcExpression] = useState(consumption.quantity ? consumption.quantity.toString().replace('.', ',') : '');
  const material = productionConfigs.find(m => m.id === editing.materialId);
  const [calcQty, setCalcQty] = useState(consumption.quantity ? consumption.quantity.toString().replace('.', ',') : '1');
  const [calcUnitVal, setCalcUnitVal] = useState(
    (consumption.unitValue && consumption.unitValue > 0) 
      ? consumption.unitValue.toString().replace('.', ',') 
      : (material?.metadata?.baseCost || 0).toString().replace('.', ',')
  );
  const [unitValManualEdited, setUnitValManualEdited] = useState(!!(consumption.unitValue && consumption.unitValue > 0));
  const [activeCalcField, setActiveCalcField] = useState<'qty' | 'unit' | null>(null);
  const [qtyMode, setQtyMode] = useState<'simple' | 'yield'>('simple');
  const [qtyEmbalagem, setQtyEmbalagem] = useState('1');
  const [qtyRendimento, setQtyRendimento] = useState('1');
  const [showPieceSuggestions, setShowPieceSuggestions] = useState(false);
  const [pieceSearch, setPieceSearch] = useState(consumption.name || '');
  const [showMaterialSuggestions, setShowMaterialSuggestions] = useState(false);
  const [materialSearch, setMaterialSearch] = useState(material?.name || '');
  const [showToolSuggestions, setShowToolSuggestions] = useState(false);
  const [toolSearch, setToolSearch] = useState(productionConfigs.find(t => t.id === editing.toolId)?.name || '');
  const [showQuickAddMaterial, setShowQuickAddMaterial] = useState(false);
  const [quickAddMaterialName, setQuickAddMaterialName] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [quickAddUnitId, setQuickAddUnitId] = useState('');
  const [quickAddBaseCost, setQuickAddBaseCost] = useState('');
  const [quickAddObservacao, setQuickAddObservacao] = useState('');
  const [isSavingQuickMaterial, setIsSavingQuickMaterial] = useState(false);
  const [showQuickCostCalc, setShowQuickCostCalc] = useState(false);

  const pieces = productionConfigs.filter(c => c.type === 'PIECE');
  const filteredPieces = pieces.filter(p => 
    p.name.toLowerCase().includes(pieceSearch.toLowerCase())
  );

  const materials = productionConfigs.filter(c => c.type === 'MATERIAL');
  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(materialSearch.toLowerCase())
  );

  const tools = productionConfigs.filter(c => c.type === 'TOOL');
  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(toolSearch.toLowerCase())
  );

  const masterCategory = material?.metadata?.masterCategory?.toUpperCase() || '';
  const isCuttingPiece = editing.category === 'CUTTING_PIECE';
  const noToolCategories = ['AVIAMENTOS', 'QUIMICOS', 'EMBALAGENS', 'LINHAS', 'MATERIAL DE CONSUMO', 'ADESIVOS', 'COLA', 'METAIS'];
  const needsTool = editing.toolId ? true : (isCuttingPiece && (!noToolCategories.some(cat => masterCategory.includes(cat)) || masterCategory === ''));

  const evaluate = (expr: string) => {
    try {
      const normalized = expr.replace(',', '.');
      if (!normalized || !/^[0-9+\-*/(). ]+$/.test(normalized)) return 0;
      return Number(eval(normalized)) || 0;
    } catch { return 0; }
  };

  const updateQuantity = (qStr: string, uStr: string) => {
    const q = evaluate(qStr);
    // Para itens de consumo direto, a quantidade salva na engenharia é o fator de consumo (calcQty)
    setEditing(prev => ({ ...prev, quantity: q }));
  };

  const computeYieldQty = (emb: string, rend: string) => {
    const e = parseFloat(emb.replace(',', '.')) || 0;
    const r = parseFloat(rend.replace(',', '.')) || 1;
    const result = r > 0 ? e / r : 0;
    const str = result.toFixed(4).replace('.', ',');
    setCalcQty(str);
    updateQuantity(str, calcUnitVal);
  };

  const handleCalcBlur = () => {
    try {
      const normalized = calcExpression.replace(',', '.');
      if (!normalized) {
        setEditing({ ...editing, quantity: 0 });
        return;
      }
      // Simple evaluator for +, -, *, /
      if (/^[0-9+\-*/(). ]+$/.test(normalized)) {
        const result = eval(normalized);
        const finalVal = Number(result) || 0;
        setEditing({ ...editing, quantity: finalVal });
        setCalcExpression(finalVal.toString().replace('.', ','));
      }
    } catch (e) {
      // Revert to current quantity if invalid
      setCalcExpression(editing.quantity.toString().replace('.', ','));
    }
  };

  // Scroll to top when opening
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Inicializar calcUnitVal com o valor do material quando o componente abre (apenas se não houver valor manual salvo)
  useEffect(() => {
    if (unitValManualEdited && consumption.unitValue && consumption.unitValue > 0) return;
    
    // Inicialização do preço se não houver valor manual
    if (material && !unitValManualEdited) {
      const cost = material.metadata?.baseCost || 0;
      setCalcUnitVal(cost.toString().replace('.', ','));
    }
  }, []);

  // Recalcular quantidade quando o mapeamento mudar (global ou local)
  useEffect(() => {
    // Somente recalcula automaticamente se NÃO estiver ignorando a quantidade (modo manual)
    if (editing.ignoreQuantity) return;

    const tool = productionConfigs.find(t => t.id === editing.toolId);
    const material = productionConfigs.find(m => m.id === editing.materialId);
    if (tool && material) {
      const newQty = calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping, false);
      if (Math.abs(newQty - editing.quantity) > 0.0001) {
        setEditing(prev => ({ ...prev, quantity: newQty }));
      }
    }
  }, [toolMapping, productionConfigs, editing.toolId, editing.materialId, editing.piecesPerPair, editing.toolMapping, editing.ignoreQuantity]);

  const calculateConsumption = (tool: ProductionConfigItem, material: ProductionConfigItem, piecesPerPair: number = 2, localMapping?: { [size: string]: string }, ignoreQuantity: boolean = false) => {
    if (!tool || !tool.metadata) return 0;

    const sizeAreas = tool.metadata.sizeAreas || {};
    const conjugation = tool.metadata.conjugation || 1;
    const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
    
    const unit = productionConfigs.find(c => c.id === material?.metadata?.unitId);
    const unitName = unit?.name || '';
    // MTL = Metro Linear, MT = Metro, also check common variations
    const isLinear = ['MT', 'MTL', 'ML'].includes(unitName.toUpperCase()) ||
      unitName.toUpperCase().includes('METRO') ||
      unitName.toUpperCase().includes('LINEAR');
    const width = material?.metadata?.width || 1.4;

    const calculateSingleSize = (area: number) => {
      // area is already stored in m² (e.g. 0.045 m²)
      if (!area || isNaN(area) || area <= 0) return 0;
      if (isLinear) return area / (width || 1); // m² ÷ largura(m) = metro linear
      return area; // already m²
    };

    let baseConsumption = 0;
    if (productGrid?.sizes?.length && Object.keys(sizeAreas).length > 0) {
      let totalCons = 0;
      let count = 0;
      productGrid.sizes.forEach(size => {
        const mappedSize = localMapping?.[size] || toolMapping?.[size] || size;
        const areaVal = sizeAreas[mappedSize] || sizeAreas[String(mappedSize).trim()] || sizeAreas[size] || 0;
        const area = Number(areaVal);
        if (area > 0) {
          totalCons += calculateSingleSize(area);
          count++;
        }
      });
      if (count > 0) baseConsumption = totalCons / count;
      else baseConsumption = calculateSingleSize(Number(Object.values(sizeAreas)[0]) || 0);
    } else {
      baseConsumption = calculateSingleSize(Number(Object.values(sizeAreas)[0]) || 0);
    }

    if (ignoreQuantity) return baseConsumption * piecesPerPair;
    const res = (baseConsumption / conjugation) * piecesPerPair;
    return isNaN(res) ? 0 : res;
  };

  const handleMaterialChange = (materialId: string) => {
    const mat = productionConfigs.find(m => m.id === materialId);
    if (mat) {
      if (!unitValManualEdited) {
        const cost = mat.metadata?.baseCost || 0;
        setCalcUnitVal(cost.toString().replace('.', ','));
      }
    }

    const tool = productionConfigs.find(t => t.id === editing.toolId);
    let newQuantity = editing.quantity;

    if (mat) {
      const mc = mat?.metadata?.masterCategory?.toUpperCase() || '';
      const noToolCats = ['AVIAMENTOS', 'QUIMICOS', 'EMBALAGENS', 'LINHAS', 'MATERIAL DE CONSUMO', 'ADESIVOS', 'COLA', 'METAIS'];
      const isNoTool = editing.category !== 'CUTTING_PIECE' || noToolCats.some(cat => mc.includes(cat));
      
      if (!isNoTool && tool) {
        newQuantity = calculateConsumption(tool, mat, editing.piecesPerPair || 2, editing.toolMapping, editing.ignoreQuantity || false);
      }
    }

    setEditing({ ...editing, materialId, quantity: newQuantity });
  };

  const handleToolChange = (toolId: string) => {
    const tool = productionConfigs.find(t => t.id === toolId);
    const material = productionConfigs.find(m => m.id === editing.materialId);
    
    if (tool && material) {
      const qty = calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping, editing.ignoreQuantity || false);
      setEditing({ ...editing, toolId, quantity: qty });
    } else {
      setEditing({ ...editing, toolId });
    }

    // Automatically open mapping modal when a tool is selected
    if (toolId) {
      setShowToolMapping(true);
    }
  };

  const openQuickAddMaterial = () => {
    setShowMaterialSuggestions(false);
    setQuickAddMaterialName(materialSearch.trim());
    setQuickAddCategory('');
    setQuickAddUnitId('');
    setQuickAddBaseCost('');
    setQuickAddObservacao('');
    setShowQuickAddMaterial(true);
  };

  const handleSaveQuickMaterial = async () => {
    if (!quickAddMaterialName.trim() || !onSaveConfigItem || isSavingQuickMaterial) return;
    setIsSavingQuickMaterial(true);
    try {
      const newId = `m-${Date.now()}`;
      const newMaterial: ProductionConfigItem = {
        id: newId,
        name: quickAddMaterialName.trim().toUpperCase(),
        description: quickAddObservacao.trim() || quickAddCategory,
        type: 'MATERIAL',
        createdAt: Date.now(),
        metadata: {
          masterCategory: quickAddCategory,
          reference: '',
          unitId: quickAddUnitId,
          baseCost: parseFloat(quickAddBaseCost.replace(',', '.')) || 0,
          width: 0,
          colorIds: [],
          flowTagId: '',
          supplierId: ''
        }
      };
      await onSaveConfigItem(newMaterial);
      setEditing(prev => ({ ...prev, materialId: newId }));
      setMaterialSearch(newMaterial.name);
      setShowQuickAddMaterial(false);
    } catch (err) {
      console.error('Erro ao cadastrar insumo:', err);
    } finally {
      setIsSavingQuickMaterial(false);
    }
  };

  const handleQuickAddPiece = async () => {
    if (!pieceSearch.trim() || !onSaveConfigItem) return;
    
    // Check if it already exists
    const exists = productionConfigs.find(p => p.type === 'PIECE' && p.name.toLowerCase() === pieceSearch.trim().toLowerCase());
    if (exists) {
      setEditing({ ...editing, name: exists.name });
      setPieceSearch(exists.name);
      setShowPieceSuggestions(false);
      return;
    }

    const newItem: ProductionConfigItem = {
      id: `p-${Date.now()}`,
      name: pieceSearch.trim(),
      description: 'PECA',
      type: 'PIECE',
      createdAt: Date.now(),
      metadata: { pieceType: 'PECA' }
    };

    try {
      await onSaveConfigItem(newItem);
      setEditing({ ...editing, name: newItem.name });
      setPieceSearch(newItem.name);
      setShowPieceSuggestions(false);
    } catch (err) {
      console.error("Erro ao adicionar peça rápida:", err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`h-full pb-32 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
    >
      {/* Header - Not sticky anymore to avoid overlapping parent modal header */}
      <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onCancel} 
            title="Voltar"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h3 className="text-base font-black uppercase tracking-[0.1em] text-indigo-600 dark:text-indigo-400">Configurar Engenharia</h3>
            <div className="flex items-center gap-2 mt-1">
              {activeVariationColor && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div 
                    className="w-2.5 h-2.5 rounded-full border border-black/10" 
                    style={{ backgroundColor: activeVariationColor.hex }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    VARIANTE: {activeVariationColor.name}
                  </span>
                </div>
              )}
              {editing.name && editing.name.length < 25 && !editing.name.includes('-') && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  COMPONENTE: <span className="text-slate-600 dark:text-slate-300">{editing.name}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        <button 
          onClick={() => onSave({ ...editing, unitValue: evaluate(calcUnitVal) })}
          disabled={!editing.materialId || (!editing.colorId && !editing.ignoreColor)}
          title={(!editing.colorId && !editing.ignoreColor) ? "Selecione uma cor para confirmar" : "Confirmar engenharia e salvar"}
          aria-label="Confirmar engenharia e salvar alterações"
          className={`px-6 py-3 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale ${isDarkMode ? 'bg-indigo-600 shadow-indigo-900/40' : 'bg-slate-900 shadow-slate-900/20 text-white'}`}
        >
          <Save size={16} /> Confirmar
        </button>
      </div>

      <div className="px-1 py-4 sm:p-6 space-y-5 sm:space-y-8 max-w-3xl mx-auto">
        
        {/* NOME DA PEÇA */}
        <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50/50 border-indigo-100'}`}>
          <div className="flex flex-col gap-3 relative">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 px-1">Nome do Componente / Peça</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Ex: Lateral, Gáspea, Biqueira..."
                className={`w-full border-2 rounded-2xl pl-6 pr-14 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-white focus:border-indigo-400 shadow-sm'}`}
                value={editing.name || ''}
                onChange={(e) => {
                  setEditing({ ...editing, name: e.target.value });
                  setPieceSearch(e.target.value);
                  if (pieces.length > 0 || e.target.value.length > 0) setShowPieceSuggestions(true);
                }}
                onFocus={() => (pieces.length > 0 || pieceSearch.length > 0) && setShowPieceSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPieceSuggestions(false), 200)}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {pieceSearch.trim().length > 0 && !pieces.some(p => p.name.toLowerCase() === pieceSearch.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={handleQuickAddPiece}
                    title="Adicionar como nova peça"
                    className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                  >
                    <Database size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPieceSuggestions(!showPieceSuggestions)}
                  title={showPieceSuggestions ? "Fechar sugestões" : "Ver sugestões de peças"}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronDown size={18} className={`transition-transform ${showPieceSuggestions ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
            {showPieceSuggestions && (filteredPieces.length > 0 || (pieceSearch.trim().length > 0 && !pieces.some(p => p.name.toLowerCase() === pieceSearch.trim().toLowerCase()))) && (
              <div className={`absolute z-50 mt-1 w-full rounded-2xl border-2 shadow-xl overflow-hidden max-h-60 overflow-y-auto ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} style={{ top: '100%' }}>
                {filteredPieces.slice(0, 10).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`w-full px-4 py-3 text-left text-sm font-bold transition-colors ${isDarkMode ? 'text-white hover:bg-slate-800' : 'text-slate-900 hover:bg-slate-100'}`}
                    onMouseDown={() => {
                      setEditing({ ...editing, name: p.name });
                      setPieceSearch(p.name);
                      setShowPieceSuggestions(false);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
                
                {pieceSearch.trim().length > 0 && !pieces.some(p => p.name.toLowerCase() === pieceSearch.trim().toLowerCase()) && (
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left text-sm font-black flex items-center gap-3 transition-colors ${isDarkMode ? 'text-indigo-400 hover:bg-slate-800' : 'text-indigo-600 hover:bg-indigo-50'}`}
                    onMouseDown={handleQuickAddPiece}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Database size={16} />
                    </div>
                    <span>Criar nova peça: "{pieceSearch.trim()}"</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card de Faca ou Calculadora de Consumo */}
        {needsTool ? (
          <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-xl space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                <Scissors size={28} />
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="tool-select" className="text-xs font-black uppercase tracking-widest text-slate-400">Faca / Molde Técnica</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Selecionar Faca..."
                    className={`w-full bg-transparent border-none text-sm font-black outline-none transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                    value={toolSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setToolSearch(val);
                      if (val === '') handleToolChange('');
                      if (tools.length > 0) setShowToolSuggestions(true);
                    }}
                    onFocus={() => tools.length > 0 && setShowToolSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowToolSuggestions(false);
                        const currentTool = productionConfigs.find(t => t.id === editing.toolId);
                        setToolSearch(currentTool?.name || '');
                      }, 200);
                    }}
                  />
                  {showToolSuggestions && filteredTools.length > 0 && (
                    <div className={`absolute z-50 mt-2 w-full min-w-[240px] rounded-2xl border-2 shadow-xl overflow-hidden max-h-60 overflow-y-auto ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} style={{ top: '100%', left: 0 }}>
                      {filteredTools.slice(0, 10).map(t => (
                        <button
                          key={t.id}
                          type="button"
                          className={`w-full px-4 py-3 text-left text-sm font-bold transition-colors ${isDarkMode ? 'text-white hover:bg-slate-800' : 'text-slate-900 hover:bg-slate-100'}`}
                          onMouseDown={() => {
                            handleToolChange(t.id);
                            setToolSearch(t.name);
                            setShowToolSuggestions(false);
                          }}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RESUMO TÉCNICO E FINANCEIRO (CORTADOS) */}
            {editing.materialId && editing.toolId && (
              <div className={`p-6 rounded-[2rem] border-2 border-dashed flex items-center justify-between ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consumo Médio</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {editing.quantity.toFixed(4).replace('.', ',')}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo Previsto</span>
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                      {(editing.quantity * (material?.metadata?.baseCost || 0)).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {editing.toolId && (
              <>
                <button 
                  onClick={() => setShowToolMapping(true)}
                  title="Abrir Mapeamento de Tamanhos"
                  aria-label="Configurar mapeamento de tamanhos para esta faca"
                  className={`w-full py-4 px-6 rounded-[2rem] flex items-center justify-between transition-all active:scale-[0.98] ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400 border-2 border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border-2 border-indigo-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <ArrowUpDown size={20} />
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest block text-indigo-600 dark:text-indigo-400">Mapeamento de Tamanhos</span>
                      <span className="text-[11px] font-bold uppercase tracking-widest opacity-70">Ajuste fino de facas</span>
                    </div>
                  </div>
                  <ChevronRight size={18} />
                </button>

                <Modal 
                  isOpen={showToolMapping} 
                  onClose={() => setShowToolMapping(false)}
                  title="Mapeamento de Facas"
                >
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                      {(() => {
                        const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
                        const tool = productionConfigs.find(t => t.id === editing.toolId);
                        if (!productGrid || !tool) return null;

                        const toolSizes = tool.metadata?.sizes || [];

                        return productGrid.sizes.map(size => {
                          const currentMap = editing.toolMapping?.[size] || toolMapping?.[size] || size;
                          
                          return (
                            <div key={size} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100 shadow-sm'}`}>
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">G {size}</span>
                                <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400 drop-shadow-sm">{size}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Faca:</span>
                                <div className="relative">
                                  <select 
                                    className={`pl-5 pr-12 py-3.5 rounded-xl text-sm font-black outline-none appearance-none cursor-pointer border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                                    value={currentMap}
                                    title={`Faca para o tamanho ${size}`}
                                    onChange={(e) => {
                                      const newMapping = { ...(editing.toolMapping || {}) };
                                      newMapping[size] = e.target.value;
                                      setEditing({ ...editing, toolMapping: newMapping });
                                    }}
                                  >
                                    {toolSizes.map(ts => (
                                      <option key={ts} value={ts}>{ts}</option>
                                    ))}
                                    {!toolSizes.includes(size) && <option value={size}>{size}</option>}
                                  </select>
                                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    <div className={`pt-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} space-y-4`}>
                      <div className="flex items-center gap-2 mb-6">
                        <Grid3X3 size={20} className="text-indigo-500" />
                        <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Matriz de Área Resultante (mm²)</span>
                      </div>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {(() => {
                          const tool = productionConfigs.find(t => t.id === editing.toolId);
                          const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
                          if (!tool || !productGrid) return null;

                          return productGrid.sizes.map(size => {
                            const mappedSize = editing.toolMapping?.[size] || toolMapping?.[size] || size;
                            const s = String(mappedSize).trim();
                            const areaVal = tool.metadata?.sizeAreas?.[s] ?? tool.metadata?.sizeAreas?.[mappedSize] ?? tool.metadata?.sizeAreas?.[size];
                            const hasValue = areaVal !== undefined && areaVal !== null;
                            
                            return (
                              <div key={size} className={`flex flex-col items-center p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">G {size}</span>
                                <span className={`text-sm font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {hasValue ? Number(areaVal).toFixed(2).replace('.', ',') : '---'}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </Modal>
              </>
            )}
          </div>
        ) : material && (
          <div className={`p-4 sm:p-8 rounded-[2.5rem] border shadow-2xl space-y-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            {/* MATERIAL + UNID. em linha única */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Material</label>
              <div className={`w-full px-5 py-4 rounded-2xl border-2 flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <span className={`font-black text-sm truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{material.name}</span>
                <span className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-indigo-300 border border-slate-700' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                  {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                </span>
              </div>
            </div>

            {/* QTY & UNIT VAL FIELDS */}
            <div className="flex flex-col gap-3">

              {/* Toggle — acima de tudo, largura da coluna de Quantidade */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quantidade</label>
                <div className={`inline-flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <button
                    type="button"
                    onClick={() => setQtyMode('simple')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${qtyMode === 'simple' ? (isDarkMode ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    Simples
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQtyMode('yield'); computeYieldQty(qtyEmbalagem, qtyRendimento); }}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${qtyMode === 'yield' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    Rendimento
                  </button>
                </div>
                {/* Basis: por par ou por grade — só visível para categoria PACKAGING */}
                {editing.category === 'PACKAGING' && (
                  <div className={`inline-flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button
                      type="button"
                      onClick={() => setEditing(prev => ({ ...prev, consumptionBasis: 'pair' }))}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${(!editing.consumptionBasis || editing.consumptionBasis === 'pair') ? (isDarkMode ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400'}`}
                    >
                      /par
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(prev => ({ ...prev, consumptionBasis: 'grade', quantity: 1 }));
                        setCalcQty('1');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${editing.consumptionBasis === 'grade' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400'}`}
                    >
                      /grade
                    </button>
                  </div>
                )}
              </div>

              {/* Inputs principais — sempre alinhados lado a lado */}
              <div className="grid grid-cols-3 gap-4 items-end">
                {/* Quantidade — col-span-2, sempre o mesmo input */}
                <div className="col-span-2 relative">
                  <input
                    id="quantity-input"
                    type="text"
                    value={calcQty}
                    readOnly={qtyMode === 'yield'}
                    title={qtyMode === 'yield' ? 'Quantidade calculada pelo rendimento' : 'Quantidade'}
                    placeholder="0"
                    onChange={qtyMode === 'simple' ? (e) => { setCalcQty(e.target.value); updateQuantity(e.target.value, calcUnitVal); } : undefined}
                    className={`w-full px-6 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all ${
                      qtyMode === 'yield'
                        ? (isDarkMode ? 'bg-indigo-950/40 border-indigo-900/40 text-indigo-300 cursor-default' : 'bg-indigo-50 border-indigo-100 text-indigo-700 cursor-default')
                        : (isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm')
                    }`}
                  />
                  {qtyMode === 'simple' && (
                    <>
                      <div className="absolute right-3 top-[22px]">
                        <button
                          type="button"
                          onClick={() => setActiveCalcField('qty')}
                          title="Abrir Calculadora de Quantidade"
                          aria-label="Abrir calculadora para definir a quantidade"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        >
                          <Calculator size={16} />
                        </button>
                      </div>
                    </>
                  )}
                  {qtyMode === 'yield' && (
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-1.5 text-[8px] font-black uppercase tracking-widest text-indigo-400">
                      {qtyEmbalagem || '1'} ÷ {qtyRendimento || '1'}
                    </span>
                  )}
                </div>

                {/* Valor Unitário — col-span-1, fixo */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="unit-val-input" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Valor Unit.</label>
                  <div className="relative">
                    <input
                      id="unit-val-input"
                      type="text"
                      value={calcUnitVal}
                      onChange={(e) => { setCalcUnitVal(e.target.value); setUnitValManualEdited(true); updateQuantity(calcQty, e.target.value); }}
                      className={`w-full px-3 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
                    />
                    <button
                      onClick={() => setActiveCalcField('unit')}
                      title="Abrir Calculadora de Valor Unitário"
                      aria-label="Abrir calculadora para definir o valor unitário"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                    <Calculator size={16} />
                  </button>
                </div>
              </div>
            </div>

              {/* Campos de Rendimento — aparecem abaixo do par principal */}
              {qtyMode === 'yield' && (
                <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${isDarkMode ? 'bg-indigo-950/30 border-indigo-900/40' : 'bg-indigo-50/60 border-indigo-100'}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400 text-center">Embalagem</label>
                      <input
                        type="text"
                        value={qtyEmbalagem}
                        onChange={(e) => { setQtyEmbalagem(e.target.value); computeYieldQty(e.target.value, qtyRendimento); }}
                        placeholder="1"
                        title="Quantidade da embalagem do produto"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-indigo-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400 text-center">Rendimento (pares)</label>
                      <input
                        type="text"
                        value={qtyRendimento}
                        onChange={(e) => { setQtyRendimento(e.target.value); computeYieldQty(qtyEmbalagem, e.target.value); }}
                        placeholder="1"
                        title="Rendimento em pares por embalagem"
                        className={`w-full px-4 py-3 rounded-xl font-black text-sm outline-none border-2 transition-all text-center ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-indigo-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                      {qtyEmbalagem || '1'} ÷ {qtyRendimento || '1'} = qtd/par
                    </span>
                    <span className={`text-sm font-black ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {calcQty}
                      <span className="text-[9px] font-bold ml-1">
                        {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

             {/* RESUMO TÉCNICO E FINANCEIRO (DIRETO) */}
             <div className="flex flex-col gap-2">
                {editing.ignoreQuantity && qtyMode === 'simple' && (
                  <p className={`text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-xl ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    Consumo p/ Lote (12 Pr): {Math.round(Number(calcQty.replace(',', '.')) * 12)} {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                  </p>
                )}
                {editing.ignoreQuantity && (
                  <button 
                    onClick={() => {
                      const val = evaluate(calcQty);
                      setEditing(prev => ({ ...prev, quantity: val, ignoreQuantity: true }));
                      setCalcQty(val.toString().replace('.', ','));
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all mb-2"
                  >
                    <CheckCircle2 size={16} /> Usar este Valor (Consumo Manual)
                  </button>
                )}
               <div className={`p-6 rounded-[2rem] border-2 border-dashed flex items-center justify-between ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Consumo {editing.consumptionBasis === 'grade' ? '/ grade' : '/ par'}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-slate-700 dark:text-slate-200">
                        {evaluate(calcQty).toFixed(4).replace('.', ',')}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase">
                        {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                      </span>
                    </div>
                  </div>

               <div className="flex flex-col text-right">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Subtotal</span>
                 <div className="flex items-baseline justify-end gap-1">
                   <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$</span>
                   <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                     {(evaluate(calcQty) * evaluate(calcUnitVal)).toFixed(2).replace('.', ',')}
                   </span>
                 </div>
               </div>
            </div>
          </div>


             <CalculatorModal 
              isOpen={activeCalcField !== null}
              onClose={() => setActiveCalcField(null)}
              isDarkMode={isDarkMode}
              initialValue={evaluate(activeCalcField === 'qty' ? calcQty : calcUnitVal)}
              onResult={(val) => {
                const valStr = val.toString().replace('.', ',');
                if (activeCalcField === 'qty') {
                  setCalcQty(valStr);
                  updateQuantity(valStr, calcUnitVal);
                } else {
                  setCalcUnitVal(valStr);
                  setUnitValManualEdited(true);
                  updateQuantity(calcQty, valStr);
                }
                setActiveCalcField(null);
              }}
            />
          </div>
        )}

        {/* TABELA DE CONSUMO CALCULADO - SÓ PARA QUEM TEM FACA */}
        {needsTool && editing.toolId && editing.materialId && (() => {
          const tool = productionConfigs.find(t => t.id === editing.toolId);
          const material = productionConfigs.find(m => m.id === editing.materialId);
          const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
          if (!needsTool || !tool || !material || !productGrid) return null;

          const unit = productionConfigs.find(c => c.id === material.metadata?.unitId);
          const unitName = unit?.name || '';
          // MTL = Metro Linear, MT = Metro, also check common variations
          const isLinear = ['MT', 'MTL', 'ML'].includes(unitName.toUpperCase()) ||
            unitName.toUpperCase().includes('METRO') ||
            unitName.toUpperCase().includes('LINEAR');
          const width = Number(material.metadata?.width) || 1.4;
          const conjugation = tool.metadata?.conjugation || 1;
          const piecesPerPair = editing.piecesPerPair || 2;
          const sizeAreas = tool.metadata?.sizeAreas || {};

          // Calcular consumo por tamanho
          // IMPORTANT: sizeAreas values are already stored in m² (e.g. 0.045)
          const sizeConsumptions: { size: string; area: number; cons: number; hasArea: boolean }[] = productGrid.sizes.map(size => {
            const mappedSize = editing.toolMapping?.[size] || toolMapping?.[size] || size;
            const areaVal = sizeAreas[mappedSize] 
              ?? sizeAreas[String(mappedSize).trim()]
              ?? sizeAreas[size]
              ?? sizeAreas[String(size).trim()];
            const hasArea = areaVal !== undefined && areaVal !== null && Number(areaVal) > 0;
            const area = hasArea ? Number(areaVal) : 0;
            // area already in m² — for linear: divide by material width to get MT
            const cons = hasArea
              ? (isLinear ? (area / width) : area) * piecesPerPair / conjugation
              : 0;
            return { size, area, cons, hasArea };
          });

          const totalSum = sizeConsumptions.reduce((sum, s) => sum + s.cons, 0);
          const average = productGrid.sizes.length > 0
            ? totalSum / productGrid.sizes.length
            : 0;

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-[2.5rem] border-2 border-indigo-500 overflow-hidden shadow-2xl shadow-indigo-500/10 ${isDarkMode ? 'bg-indigo-950/20' : 'bg-white'}`}
            >
              {/* Header do card */}
              <div className={`px-5 py-4 flex items-center justify-between ${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-600'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center">
                    <Calculator size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-white">Consumo Real</h4>
                    <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Por Peças / Par — {unitName || (isLinear ? 'MTL' : 'M²')}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black text-indigo-200 uppercase tracking-widest">Média</span>
                  <span className="text-xl font-black text-white leading-none">{average.toFixed(4).replace('.', ',')}</span>
                  <span className="text-xs font-black text-indigo-200 uppercase">{unitName || (isLinear ? 'MTL' : 'M²')}</span>
                </div>
              </div>

              {/* Lista de consumos por grade */}
              <div className="flex flex-col divide-y divide-indigo-100 dark:divide-indigo-900/50">
                {sizeConsumptions.map(({ size, cons, hasArea }) => (
                  <div key={size} className={`flex items-center justify-between px-5 py-3.5 ${isDarkMode ? 'hover:bg-indigo-950/30' : 'hover:bg-indigo-50/50'} transition-colors`}>
                    {/* Label da grade */}
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base ${isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                        {size}
                      </div>
                      <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Tamanho</span>
                    </div>

                    {/* Valor do consumo */}
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xl font-black leading-none ${hasArea ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-300'}`}>
                        {hasArea ? cons.toFixed(4).replace('.', ',') : '---'}
                      </span>
                      <span className={`text-xs font-black uppercase ${hasArea ? 'text-indigo-500' : 'text-slate-300'}`}>
                        {unitName || (isLinear ? 'MT' : 'M²')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rodapé com a média destacada */}
              <div className={`px-5 py-4 flex items-center justify-between border-t-2 border-indigo-200 dark:border-indigo-800 ${isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
                <span className="text-xs font-black uppercase tracking-widest text-indigo-500">Média do Consumo</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-indigo-700'}`}>{average.toFixed(4).replace('.', ',')}</span>
                  <span className="text-sm font-black text-indigo-400 uppercase">{unitName || (isLinear ? 'MT' : 'M²')}</span>
                </div>
              </div>
            </motion.div>
          );
        })()}


        {/* Seleção de Material e Cor */}
        <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} space-y-8`}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <label htmlFor="material-select" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Material de Insumo</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-colors">Ignorar Cor</span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={editing.ignoreColor || false}
                      onChange={(e) => setEditing({ ...editing, ignoreColor: e.target.checked })}
                    />
                    <div className={`w-8 h-4 rounded-full transition-colors ${editing.ignoreColor ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${editing.ignoreColor ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 transition-colors">Ignorar Qtd/Par</span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={editing.ignoreQuantity || false}
                      onChange={(e) => {
                        const val = e.target.checked;
                        const tool = productionConfigs.find(t => t.id === editing.toolId);
                        const material = productionConfigs.find(m => m.id === editing.materialId);
                        const newQ = tool && material ? calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping, val) : editing.quantity;
                        setEditing({ ...editing, ignoreQuantity: val, quantity: newQ });
                        if (val) setCalcQty(newQ.toString());
                      }}
                    />
                    <div className={`w-8 h-4 rounded-full transition-colors ${editing.ignoreQuantity ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${editing.ignoreQuantity ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
              </div>
            </div>
            <div className="relative">
              <input 
                id="material-select"
                type="text" 
                placeholder="Escolher Material..."
                className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                value={materialSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaterialSearch(val);
                  if (val === '') handleMaterialChange('');
                  if (materials.length > 0) setShowMaterialSuggestions(true);
                }}
                onFocus={() => materials.length > 0 && setShowMaterialSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => {
                    setShowMaterialSuggestions(false);
                    const currentMat = productionConfigs.find(m => m.id === editing.materialId);
                    setMaterialSearch(currentMat?.name || '');
                  }, 200);
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {materialSearch.trim().length > 0 && onSaveConfigItem && !materials.some(m => m.name.toLowerCase() === materialSearch.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={openQuickAddMaterial}
                    title="Cadastrar como novo insumo"
                    className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors pointer-events-auto"
                  >
                    <Database size={18} />
                  </button>
                )}
                <ChevronDown size={18} className="text-slate-400 pointer-events-none" />
              </div>
              {showMaterialSuggestions && (filteredMaterials.length > 0 || materialSearch.trim().length > 0) && (
                <div className={`absolute z-50 mt-1 w-full rounded-2xl border-2 shadow-xl overflow-hidden max-h-60 overflow-y-auto ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} style={{ top: '100%', left: 0 }}>
                  {filteredMaterials.slice(0, 10).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={`w-full px-4 py-3 text-left text-sm font-bold transition-colors ${isDarkMode ? 'text-white hover:bg-slate-800' : 'text-slate-900 hover:bg-slate-100'}`}
                      onMouseDown={() => {
                        handleMaterialChange(m.id);
                        setMaterialSearch(m.name);
                        setShowMaterialSuggestions(false);
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                  {materialSearch.trim().length > 0 && onSaveConfigItem && !materials.some(m => m.name.toLowerCase() === materialSearch.trim().toLowerCase()) && (
                    <button
                      type="button"
                      className={`w-full px-4 py-3 text-left text-sm font-black flex items-center gap-3 transition-colors border-t ${isDarkMode ? 'text-emerald-400 hover:bg-slate-800 border-slate-700' : 'text-emerald-600 hover:bg-emerald-50 border-slate-100'}`}
                      onMouseDown={openQuickAddMaterial}
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Database size={16} />
                      </div>
                      <span>Cadastrar como novo insumo: "{materialSearch.trim()}"</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className={`flex flex-col gap-3 transition-all ${editing.ignoreColor ? 'opacity-50 pointer-events-none' : ''}`}>
                <label htmlFor="color-select" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                  Cor {editing.ignoreColor && <span className="text-[9px] text-indigo-500">(IGNORADO)</span>}
                </label>
                 <select 
                  id="color-select"
                  disabled={editing.ignoreColor}
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${!editing.colorId && !editing.ignoreColor ? 'border-rose-500/50 bg-rose-50/10' : ''} ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                  value={editing.ignoreColor ? '' : (editing.colorId || '')}
                  onChange={(e) => setEditing({ ...editing, colorId: e.target.value })}
                  title="Selecionar Cor"
                >
                  <option value="">{editing.ignoreColor ? 'N/A' : 'Cor Obrigatória...'}</option>
                  {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!editing.colorId && !editing.ignoreColor && (
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1 ml-2">Campo Obrigatório</span>
                )}
             </div>
             <div className={`flex flex-col gap-3 transition-all ${editing.ignoreQuantity ? 'opacity-50 pointer-events-none' : ''}`}>
                <label htmlFor="pieces-per-pair-input" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                  Peças / Par {editing.ignoreQuantity && <span className="text-[9px] text-indigo-500">(IGNORADO)</span>}
                </label>
                <input 
                  id="pieces-per-pair-input"
                  type="number" 
                  disabled={editing.ignoreQuantity}
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                  value={editing.ignoreQuantity ? 1 : (editing.piecesPerPair || 2)}
                  title="Número de Peças por Par"
                  onChange={(e) => {
                    const ppp = Number(e.target.value);
                    const tool = productionConfigs.find(t => t.id === editing.toolId);
                    const material = productionConfigs.find(m => m.id === editing.materialId);
                    if (tool && material) {
                      setEditing({ ...editing, piecesPerPair: ppp, quantity: calculateConsumption(tool, material, ppp, editing.toolMapping) });
                    } else {
                      setEditing({ ...editing, piecesPerPair: ppp });
                    }
                  }}
                />
             </div>
          </div>
        </div>

        {/* Serviços Terceirizados */}
        <div className={`p-4 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-amber-50/30 border-amber-100'} space-y-6 overflow-hidden`}>
           <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-amber-500" />
              <h4 className="text-xs font-black uppercase tracking-widest text-amber-600">Fluxo de Setores / Serviços</h4>
           </div>
           
           <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-7">
                <select 
                  id="sector-select"
                  className={`w-full border-2 rounded-2xl px-4 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                  value={newServiceId}
                  title="Selecionar Setor"
                  onChange={(e) => setNewServiceId(e.target.value)}
                >
                  <option value="">Setor...</option>
                  {sectors.sort((a,b) => a.order - b.order).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-8 sm:col-span-3">
                <input 
                  id="service-cost-input"
                  type="number" 
                  placeholder="R$ 0.00" 
                  className={`w-full border-2 rounded-2xl px-4 py-4 text-sm font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}
                  value={newServiceCost}
                  title="Custo do Serviço"
                  onChange={(e) => setNewServiceCost(e.target.value)}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <button 
                  onClick={() => {
                    if (!newServiceId) return;
                    const services = [...(editing.services || [])];
                    services.push({ serviceId: newServiceId, cost: Number(newServiceCost) || 0 });
                    setEditing({ ...editing, services });
                    setNewServiceId('');
                    setNewServiceCost(0);
                  }}
                  title="Adicionar Setor ao Fluxo"
                  className="w-full h-full min-h-[56px] rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Plus size={24} strokeWidth={3} />
                </button>
              </div>
           </div>

           <div className="space-y-2">
              {(editing.services || []).map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sectors.find(sec => sec.id === s.serviceId)?.color }} />
                    <span className="text-xs font-black uppercase">{sectors.find(sec => sec.id === s.serviceId)?.name || 'Setor'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-amber-600">R$ {s.cost.toFixed(2)}</span>
                    <button
                      onClick={() => setEditing({ ...editing, services: editing.services?.filter((_, i) => i !== idx) })}
                      title="Remover Setor"
                      className="text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
           </div>
        </div>

      </div>

      {/* Modal de Cadastro Rápido de Insumo */}
      <Modal
        isOpen={showQuickAddMaterial}
        onClose={() => setShowQuickAddMaterial(false)}
        title="Cadastrar Novo Insumo"
        maxWidth="max-w-md"
        zIndex={100000}
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Nome do Insumo *</label>
            <input
              type="text"
              value={quickAddMaterialName}
              onChange={(e) => setQuickAddMaterialName(e.target.value.toUpperCase())}
              placeholder="NOME DO MATERIAL"
              autoFocus
              className={`w-full px-4 py-3 rounded-2xl border-2 font-bold text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'}`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Categoria</label>
            <select
              value={quickAddCategory}
              onChange={(e) => setQuickAddCategory(e.target.value)}
              title="Categoria do Insumo"
              className={`w-full px-4 py-3 rounded-2xl border-2 font-bold text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            >
              <option value="">SELECIONAR...</option>
              {[...new Set([
                ...materials.map(m => m.metadata?.masterCategory).filter(Boolean) as string[],
                'SOLADOS', 'PALMILHAS', 'COURO/SINTÉTICO', 'FORROS', 'ADESIVOS', 'LINHAS', 'EMBALAGENS', 'OUTROS'
              ])].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Unidade</label>
              <select
                value={quickAddUnitId}
                onChange={(e) => setQuickAddUnitId(e.target.value)}
                title="Unidade de Medida"
                className={`w-full px-4 py-3 rounded-2xl border-2 font-bold text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              >
                <option value="">UN</option>
                {productionConfigs.filter(c => c.type === 'UNIT').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Custo Base</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={quickAddBaseCost}
                  onChange={(e) => setQuickAddBaseCost(e.target.value)}
                  placeholder="0,00"
                  className={`w-full pl-4 pr-11 py-3 rounded-2xl border-2 font-bold text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowQuickCostCalc(true)}
                  title="Abrir Calculadora"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Calculator size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Observação</label>
            <textarea
              value={quickAddObservacao}
              onChange={(e) => setQuickAddObservacao(e.target.value)}
              placeholder="Anotações para conferência posterior..."
              title="Observação sobre o insumo"
              rows={3}
              className={`w-full px-4 py-3 rounded-2xl border-2 font-medium text-sm outline-none transition-all resize-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'}`}
            />
          </div>

          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            * Outros detalhes podem ser completados no Catálogo de Insumos
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowQuickAddMaterial(false)}
              className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveQuickMaterial}
              disabled={!quickAddMaterialName.trim() || isSavingQuickMaterial}
              className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98]"
            >
              {isSavingQuickMaterial ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </Modal>

      <CalculatorModal
        isOpen={showQuickCostCalc}
        onClose={() => setShowQuickCostCalc(false)}
        isDarkMode={isDarkMode}
        initialValue={parseFloat(quickAddBaseCost.replace(',', '.')) || 0}
        zIndex={110000}
        onResult={(val) => {
          setQuickAddBaseCost(val.toString().replace('.', ','));
          setShowQuickCostCalc(false);
        }}
      />
    </motion.div>
  );
}
