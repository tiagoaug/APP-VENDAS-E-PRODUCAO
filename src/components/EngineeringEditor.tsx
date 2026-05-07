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
  toolMapping
}: EngineeringEditorProps) {
  const [editing, setEditing] = useState<ComponentConsumption>({ ...consumption });
  const [newServiceId, setNewServiceId] = useState('');
  const [newServiceCost, setNewServiceCost] = useState<number | string>(0);
  const [showToolMapping, setShowToolMapping] = useState(false);
  const [calcExpression, setCalcExpression] = useState(consumption.quantity ? consumption.quantity.toString().replace('.', ',') : '');
  const [calcQty, setCalcQty] = useState(consumption.quantity ? consumption.quantity.toString().replace('.', ',') : '1');
  const [calcUnitVal, setCalcUnitVal] = useState('0');
  const [activeCalcField, setActiveCalcField] = useState<'qty' | 'unit' | null>(null);

  const material = productionConfigs.find(m => m.id === editing.materialId);
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

  // Recalcular quantidade quando o mapeamento mudar (global ou local)
  useEffect(() => {
    const tool = productionConfigs.find(t => t.id === editing.toolId);
    const material = productionConfigs.find(m => m.id === editing.materialId);
    if (tool && material) {
      const newQty = calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping);
      if (Math.abs(newQty - editing.quantity) > 0.0001) {
        setEditing(prev => ({ ...prev, quantity: newQty }));
      }
    }
  }, [toolMapping, productionConfigs, editing.toolId, editing.materialId, editing.piecesPerPair, editing.toolMapping]);

  const calculateConsumption = (tool: ProductionConfigItem, material: ProductionConfigItem, piecesPerPair: number = 2, localMapping?: { [size: string]: string }) => {
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

    const res = (baseConsumption / conjugation) * piecesPerPair;
    return isNaN(res) ? 0 : res;
  };

  const handleMaterialChange = (materialId: string) => {
    const mat = productionConfigs.find(m => m.id === materialId);
    
    setEditing(prev => {
      const tool = productionConfigs.find(t => t.id === prev.toolId);
      let newQuantity = prev.quantity;

      if (mat) {
        const mc = mat?.metadata?.masterCategory?.toUpperCase() || '';
        const noToolCats = ['AVIAMENTOS', 'QUIMICOS', 'EMBALAGENS', 'LINHAS', 'MATERIAL DE CONSUMO', 'ADESIVOS', 'COLA', 'METAIS'];
        const isNoTool = prev.category !== 'CUTTING_PIECE' || noToolCats.some(cat => mc.includes(cat));
        
        if (isNoTool) {
          const cost = mat.metadata?.baseCost || 0;
          setCalcUnitVal(cost.toString().replace('.', ','));
          // A quantidade permanece a mesma, o que muda é o preço de referência no card
        } else if (tool) {
          newQuantity = calculateConsumption(tool, mat, prev.piecesPerPair || 2, prev.toolMapping);
        }
      }

      return { ...prev, materialId, quantity: newQuantity };
    });
  };

  const handleToolChange = (toolId: string) => {
    const tool = productionConfigs.find(t => t.id === toolId);
    const material = productionConfigs.find(m => m.id === editing.materialId);
    
    if (tool && material) {
      const qty = calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping);
      setEditing({ ...editing, toolId, quantity: qty });
    } else {
      setEditing({ ...editing, toolId });
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
            {editing.name && editing.name.length < 25 && !editing.name.includes('-') && (
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Componente: <span className="text-slate-600 dark:text-slate-300">{editing.name}</span>
              </p>
            )}
          </div>
        </div>
        <button 
          onClick={() => onSave(editing)}
          disabled={!editing.materialId}
          className={`px-6 py-3 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 ${isDarkMode ? 'bg-indigo-600 shadow-indigo-900/40' : 'bg-slate-900 shadow-slate-900/20 text-white'}`}
        >
          <Save size={16} /> Confirmar
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-8 max-w-3xl mx-auto">
        
        {/* NOME DA PEÇA */}
        <div className={`p-5 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50/50 border-indigo-100'}`}>
          <div className="flex flex-col gap-3">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 px-1">Nome do Componente / Peça</label>
            <input 
              type="text" 
              placeholder="Ex: Lateral, Gáspea, Biqueira..."
              className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-white focus:border-indigo-400 shadow-sm'}`}
              value={editing.name || ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
        </div>

        {/* Card de Faca ou Calculadora de Consumo */}
        {needsTool ? (
          <div className={`p-5 sm:p-8 rounded-[2.5rem] border-2 shadow-xl space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                <Scissors size={28} />
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="tool-select" className="text-xs font-black uppercase tracking-widest text-slate-400">Faca / Molde Técnica</label>
                <select 
                  id="tool-select"
                  className={`w-full bg-transparent border-none text-sm font-black outline-none appearance-none cursor-pointer ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                  value={editing.toolId || ''}
                  onChange={(e) => handleToolChange(e.target.value)}
                  title="Selecionar Faca"
                >
                  <option value="">Selecionar Faca...</option>
                  {productionConfigs.filter(c => c.type === 'TOOL').map(t => (
                    <option key={t.id} value={t.id} className="text-slate-900">{t.name}</option>
                  ))}
                </select>
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
          <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-2xl space-y-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            {/* MATERIAL FIELD */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Material</label>
              <div className="relative group">
                <div className={`w-full px-6 py-4 rounded-2xl font-black text-sm border-2 flex items-center justify-between ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                  <span>{material.name}</span>
                </div>
              </div>
            </div>

            {/* UNID. DISPLAY */}
            <div className="flex flex-col gap-3 text-center">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unid.</label>
              <div className={`mx-auto w-full max-w-[280px] py-6 rounded-2xl border-2 flex items-center justify-center text-2xl font-black ${isDarkMode ? 'bg-slate-950/50 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}>
                {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
              </div>
            </div>

            {/* QTY & UNIT VAL FIELDS */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <label htmlFor="quantity-input" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Quantidade</label>
                <div className="relative">
                  <input 
                    id="quantity-input"
                    type="text" 
                    value={calcQty} 
                    onChange={(e) => { setCalcQty(e.target.value); updateQuantity(e.target.value, calcUnitVal); }}
                    className={`w-full px-6 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <button 
                      onClick={() => setActiveCalcField('qty')} 
                      title="Abrir Calculadora de Quantidade"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      <Calculator size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label htmlFor="unit-val-input" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Valor Unitário</label>
                <div className="relative">
                  <input 
                    id="unit-val-input"
                    type="text" 
                    value={calcUnitVal} 
                    onChange={(e) => { setCalcUnitVal(e.target.value); updateQuantity(calcQty, e.target.value); }}
                    className={`w-full px-6 py-5 rounded-2xl font-black text-sm outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
                  />
                  <button 
                    onClick={() => setActiveCalcField('unit')} 
                    title="Abrir Calculadora de Valor Unitário"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    <Calculator size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* RESUMO TÉCNICO E FINANCEIRO (DIRETO) */}
            <div className={`p-6 rounded-[2rem] border-2 border-dashed flex items-center justify-between ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
               <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Consumo</span>
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
        <div className={`p-5 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} space-y-8`}>
          <div className="flex flex-col gap-3">
            <label htmlFor="material-select" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">Material de Insumo</label>
            <select 
              id="material-select"
              className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
              value={editing.materialId || ''}
              onChange={(e) => handleMaterialChange(e.target.value)}
              title="Selecionar Material"
            >
              <option value="">Escolher Material...</option>
              {productionConfigs.filter(c => c.type === 'MATERIAL').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-3">
                <label htmlFor="color-select" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">Cor</label>
                <select 
                  id="color-select"
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                  value={editing.colorId || ''}
                  onChange={(e) => setEditing({ ...editing, colorId: e.target.value })}
                  title="Selecionar Cor"
                >
                  <option value="">Cor...</option>
                  {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
             <div className="flex flex-col gap-3">
                <label htmlFor="pieces-per-pair-input" className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">Peças / Par</label>
                <input 
                  id="pieces-per-pair-input"
                  type="number" 
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                  value={editing.piecesPerPair || 2}
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
        <div className={`p-5 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-amber-50/30 border-amber-100'} space-y-6`}>
           <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-amber-500" />
              <h4 className="text-xs font-black uppercase tracking-widest text-amber-600">Fluxo de Setores / Serviços</h4>
           </div>
           
           <div className="flex gap-3">
              <select 
                id="sector-select"
                className={`flex-1 border-2 rounded-2xl px-5 py-4 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                value={newServiceId}
                title="Selecionar Setor"
                onChange={(e) => setNewServiceId(e.target.value)}
              >
                <option value="">Setor...</option>
                {sectors.sort((a,b) => a.order - b.order).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input 
                id="service-cost-input"
                type="number" 
                placeholder="R$ 0.00" 
                className={`w-28 border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}
                value={newServiceCost}
                title="Custo do Serviço"
                onChange={(e) => setNewServiceCost(e.target.value)}
              />
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
                className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20"
              >
                <Plus size={24} />
              </button>
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
    </motion.div>
  );
}
