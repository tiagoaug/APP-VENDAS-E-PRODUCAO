import React, { useState, useEffect } from 'react';
import { 
  X, Scissors, Box, Calculator, Sparkles, Plus, 
  ArrowUpDown, Trash2, Info, ChevronLeft, Save,
  CheckCircle2, ChevronRight, Footprints, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ProductionConfigItem, ComponentConsumption, Sector, 
  ColorValue, Grid 
} from '../types';

interface EngineeringEditorProps {
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
  const [showToolMapping, setShowToolMapping] = useState(true);

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
    
    const unitId = material?.metadata?.unitId;
    const isLinear = unitId?.toUpperCase().includes('MT') || unitId?.toUpperCase().includes('LINEAR');
    const width = material?.metadata?.width || 1400;

    const calculateSingleSize = (area: number) => {
      if (!area || isNaN(area) || area <= 0) return 0;
      if (isLinear) return (area / width) / 1000;
      return area / 1000000;
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
    const material = productionConfigs.find(m => m.id === materialId);
    const tool = productionConfigs.find(t => t.id === editing.toolId);
    
    if (material && tool) {
      const qty = calculateConsumption(tool, material, editing.piecesPerPair || 2, editing.toolMapping);
      setEditing({ ...editing, materialId, quantity: qty });
    } else {
      setEditing({ ...editing, materialId });
    }
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
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em]">Configurar Engenharia</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Componentes do Cabedal</p>
          </div>
        </div>
        <button 
          onClick={() => onSave(editing)}
          disabled={!editing.materialId}
          className={`px-6 py-3 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 ${isDarkMode ? 'bg-indigo-600 shadow-indigo-900/40' : 'bg-slate-900 shadow-slate-900/20 text-white'}`}
        >
          <Save size={16} /> Confirmar
        </button>
      </div>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        
        {/* Card de Faca e Matriz de Área */}
        <div className={`p-8 rounded-[3rem] border-2 shadow-xl space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-100 shadow-indigo-500/5'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Scissors size={28} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Faca / Molde Técnica</label>
              <select 
                className={`w-full bg-transparent border-none text-sm font-black outline-none appearance-none cursor-pointer ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                value={editing.toolId || ''}
                onChange={(e) => handleToolChange(e.target.value)}
              >
                <option value="">Selecionar Faca...</option>
                {productionConfigs.filter(c => c.type === 'TOOL').map(t => (
                  <option key={t.id} value={t.id} className="text-slate-900">{t.name}</option>
                ))}
              </select>
            </div>
          </div>


          {editing.toolId && (
              <div className={`rounded-[2.5rem] border-2 overflow-hidden transition-all duration-300 ${showToolMapping ? (isDarkMode ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/30') : (isDarkMode ? 'border-slate-800 bg-slate-800/20' : 'border-slate-100 bg-slate-50/50')}`}>
                <button 
                  onClick={() => setShowToolMapping(!showToolMapping)}
                  className={`w-full flex items-center justify-between p-5 transition-all ${showToolMapping ? (isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-100/50') : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${showToolMapping ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-white text-indigo-600 shadow-sm'}`}>
                      <ArrowUpDown size={20} />
                    </div>
                    <div className="text-left">
                      <h4 className={`text-[11px] font-black uppercase tracking-widest ${showToolMapping ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Mapeamento e Matriz de Áreas</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ajuste fino de facas por numeração</p>
                    </div>
                  </div>
                  <ChevronDown size={20} className={`text-slate-400 transition-transform duration-500 ${showToolMapping ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showToolMapping && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-5 pt-0 space-y-6">
                        <div className="grid grid-cols-1 gap-2">
                          {(() => {
                            const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
                            const tool = productionConfigs.find(t => t.id === editing.toolId);
                            if (!productGrid || !tool) return null;

                            const toolSizes = tool.metadata?.sizes || [];

                            return productGrid.sizes.map(size => {
                              const currentMap = editing.toolMapping?.[size] || toolMapping?.[size] || size;
                              
                              return (
                                <div key={size} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-slate-100 shadow-sm'}`}>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Grade</span>
                                    <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 drop-shadow-sm">{size}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faca:</span>
                                    <div className="relative">
                                      <select 
                                        className={`pl-4 pr-10 py-2.5 rounded-xl text-xs font-black outline-none appearance-none cursor-pointer border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                                        value={currentMap}
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
                                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        <div className={`pt-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} space-y-4`}>
                          <div className="flex items-center gap-2 px-1">
                            <Calculator size={16} className="text-slate-400" />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Matriz de Área Resultante (mm²)</span>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
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
                                  <div key={size} className={`flex flex-col items-center p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-white border-slate-200 shadow-md'}`}>
                                    <div className="flex flex-col items-center gap-1 mb-2">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Grade</span>
                                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{size}</span>
                                      <div className="flex items-center gap-2 mt-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg">
                                        <ChevronDown size={10} className="text-indigo-400" />
                                        <span className="text-[11px] font-black text-emerald-500">{mappedSize}</span>
                                      </div>
                                    </div>
                                    <span className={`text-[16px] font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                      {hasValue ? Number(areaVal).toFixed(4).replace('.', ',') : '---'}
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
          )}
        </div>

        {/* Consumo Corrigido (Somente após escolher o material) */}
        {editing.toolId && editing.materialId && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-8 rounded-[3rem] border-2 border-indigo-500 bg-indigo-50/30 dark:bg-indigo-500/5 space-y-6 shadow-2xl shadow-indigo-500/10`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center">
                  <Calculator size={20} />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Consumo Real Corrigido</h4>
                  <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Cálculo por Peças / Par</p>
                </div>
              </div>
              <div className="px-4 py-2 rounded-full bg-indigo-500 text-white text-[11px] font-black shadow-lg shadow-indigo-500/20">
                Média: {editing.quantity.toFixed(4)}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(() => {
                const tool = productionConfigs.find(t => t.id === editing.toolId);
                const material = productionConfigs.find(m => m.id === editing.materialId);
                const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
                if (!tool || !material || !productGrid) return null;
                
                const width = material.metadata?.width || 1400;
                const isLinear = material.metadata?.unitId?.toUpperCase().includes('MT');

                return productGrid.sizes.map(size => {
                  const mappedSize = editing.toolMapping?.[size] || toolMapping?.[size] || size;
                  const areaVal = tool.metadata?.sizeAreas?.[mappedSize] ?? tool.metadata?.sizeAreas?.[String(mappedSize).trim()] ?? tool.metadata?.sizeAreas?.[size];
                  const hasArea = areaVal !== undefined && areaVal !== null;
                  const area = hasArea ? Number(areaVal) : 0;
                  const cons = hasArea ? (isLinear ? ((area/width)/1000) : (area/1000000)) * (editing.piecesPerPair || 2) / (tool.metadata?.conjugation || 1) : 0;
                  
                  return (
                    <div key={size} className="flex flex-col items-center p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Grade</span>
                        <span className="text-[11px] font-black text-indigo-500">{size}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[13px] font-black text-slate-900 dark:text-white leading-none">
                          {hasArea ? cons.toFixed(4).replace('.', ',') : '---'}
                        </span>
                        <span className="text-[8px] font-black text-indigo-400 uppercase mt-1">{isLinear ? 'MT' : 'M²'}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </motion.div>
        )}

        {/* Seleção de Material e Cor */}
        <div className={`p-8 rounded-[3rem] border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'} space-y-8`}>
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Material de Insumo</label>
            <select 
              className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-600'}`}
              value={editing.materialId || ''}
              onChange={(e) => handleMaterialChange(e.target.value)}
            >
              <option value="">Escolher Material...</option>
              {productionConfigs.filter(c => c.type === 'MATERIAL').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Cor</label>
                <select 
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                  value={editing.colorId || ''}
                  onChange={(e) => setEditing({ ...editing, colorId: e.target.value })}
                >
                  <option value="">Cor...</option>
                  {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
             <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Peças / Par</label>
                <input 
                  type="number" 
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                  value={editing.piecesPerPair || 2}
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
        <div className={`p-8 rounded-[3rem] border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-amber-50/20 border-amber-100/50'} space-y-6`}>
           <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600">Fluxo de Setores / Serviços</h4>
           </div>
           
           <div className="flex gap-3">
              <select 
                className={`flex-1 border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}
                value={newServiceId}
                onChange={(e) => setNewServiceId(e.target.value)}
              >
                <option value="">Setor...</option>
                {sectors.sort((a,b) => a.order - b.order).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input 
                type="number" 
                placeholder="R$ 0.00" 
                className={`w-28 border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}
                value={newServiceCost}
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
                    <span className="text-[10px] font-black uppercase">{sectors.find(sec => sec.id === s.serviceId)?.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-amber-600">R$ {s.cost.toFixed(2)}</span>
                    <button onClick={() => setEditing({ ...editing, services: editing.services?.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-rose-500 transition-colors">
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
