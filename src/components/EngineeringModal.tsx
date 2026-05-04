import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Scissors, Box, Calculator, Sparkles, Plus, 
  ArrowUpDown, Trash2, Info
} from 'lucide-react';
import { 
  ProductionConfigItem, ComponentConsumption, Sector, 
  ColorValue, Grid, ComponentCategory 
} from '../types';

interface EngineeringModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  consumption: ComponentConsumption;
  onSave: (consumption: ComponentConsumption) => void;
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  sectors: Sector[];
  grids: Grid[];
  productionGridId: string;
  defaultGridId: string;
}

export default function EngineeringModal({
  isOpen,
  onClose,
  isDarkMode,
  consumption,
  onSave,
  productionConfigs,
  colors,
  sectors,
  grids,
  productionGridId,
  defaultGridId
}: EngineeringModalProps) {
  const [editing, setEditing] = useState<ComponentConsumption>({ ...consumption });
  const [newServiceId, setNewServiceId] = useState('');
  const [newServiceCost, setNewServiceCost] = useState<number | string>(0);

  if (!isOpen) return null;

  const calculateConsumption = (tool: ProductionConfigItem, material: ProductionConfigItem, piecesPerPair: number = 2) => {
    if (!tool || !tool.metadata) return 0;

    const sizeAreas = tool.metadata.sizeAreas || {};
    const conjugation = tool.metadata.conjugation || 1;
    const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
    
    const unitId = material.metadata?.unitId;
    const isLinear = unitId?.toUpperCase().includes('MT') || unitId?.toUpperCase().includes('LINEAR');
    const width = material.metadata?.width || 1400;

    const calculateSingleSize = (area: number) => {
      if (isLinear) return (area / width) / 1000;
      return area / 1000000;
    };

    let baseConsumption = 0;
    if (productGrid && Object.keys(sizeAreas).length > 0) {
      let totalCons = 0;
      let count = 0;
      productGrid.sizes.forEach(size => {
        if (sizeAreas[size]) {
          totalCons += calculateSingleSize(sizeAreas[size]);
          count++;
        }
      });
      if (count > 0) baseConsumption = totalCons / count;
      else baseConsumption = calculateSingleSize(Object.values(sizeAreas)[0] as number || 0);
    } else {
      baseConsumption = calculateSingleSize(Object.values(sizeAreas)[0] as number || 0);
    }

    return (baseConsumption / conjugation) * piecesPerPair;
  };

  const handleMaterialChange = (materialId: string) => {
    const material = productionConfigs.find(m => m.id === materialId);
    const tool = productionConfigs.find(t => t.id === editing.toolId);
    
    if (material && tool) {
      const qty = calculateConsumption(tool, material, editing.piecesPerPair || 2);
      setEditing({ ...editing, materialId, quantity: qty });
    } else {
      setEditing({ ...editing, materialId });
    }
  };

  const handleToolChange = (toolId: string) => {
    const tool = productionConfigs.find(t => t.id === toolId);
    const material = productionConfigs.find(m => m.id === editing.materialId);
    
    if (tool && material) {
      const qty = calculateConsumption(tool, material, editing.piecesPerPair || 2);
      setEditing({ ...editing, toolId, quantity: qty });
    } else {
      setEditing({ ...editing, toolId });
    }
  };

  const handlePPPChange = (ppp: number) => {
    const tool = productionConfigs.find(t => t.id === editing.toolId);
    const material = productionConfigs.find(m => m.id === editing.materialId);
    
    if (tool && material) {
      const qty = calculateConsumption(tool, material, ppp);
      setEditing({ ...editing, piecesPerPair: ppp, quantity: qty });
    } else {
      setEditing({ ...editing, piecesPerPair: ppp });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[3rem] shadow-2xl border-4 flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-white'}`}>
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              {editing.category === 'CUTTING_PIECE' ? <Scissors size={24} /> : <Box size={24} />}
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">
                Configuração de Peça
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Engenharia de Componente</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all active:scale-90">
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {/* Material Selector */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white px-1">Material / Insumo Base</label>
            <div className="relative">
              <select 
                className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-black transition-all outline-none appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                value={editing.materialId || ''}
                onChange={(e) => handleMaterialChange(e.target.value)}
              >
                <option value="">Escolher Material...</option>
                {productionConfigs.filter(c => c.type === 'MATERIAL').map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <Plus size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Color Selector */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white px-1">Cor da Peça</label>
            <select 
              className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-black transition-all outline-none appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
              value={editing.colorId || ''}
              onChange={(e) => setEditing({ ...editing, colorId: e.target.value })}
            >
              <option value="">Cor...</option>
              {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Grid Consumption Details */}
          {editing.toolId && (
            <div className="p-6 rounded-[2rem] bg-indigo-50/30 dark:bg-indigo-900/5 border border-indigo-100 dark:border-indigo-900/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={16} className="text-indigo-500" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Consumo Detalhado por Grade</h4>
                </div>
                {!editing.materialId ? (
                   <div className="flex items-center gap-2 text-[8px] font-black text-amber-500 uppercase bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full">
                      <Info size={10} /> Selecione o Material
                   </div>
                ) : (
                  <div className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-[9px] font-black text-indigo-600">
                    Média: {editing.quantity.toFixed(4)}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(() => {
                  const tool = productionConfigs.find(t => t.id === editing.toolId);
                  const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
                  if (!tool || !productGrid) return null;

                  const material = productionConfigs.find(m => m.id === editing.materialId);
                  const width = material?.metadata?.width || 1400;
                  const isLinear = material?.metadata?.unitId?.toUpperCase().includes('MT');

                  return productGrid.sizes.map(size => {
                    const area = tool.metadata?.sizeAreas?.[size] || 0;
                    if (area === 0) return null;

                    let consStr = area.toString();
                    let unitLabel = "mm²";

                    if (material) {
                       const cons = (isLinear ? ((area/width)/1000) : (area/1000000)) * (editing.piecesPerPair || 2) / (tool.metadata?.conjugation || 1);
                       consStr = cons.toFixed(4);
                       unitLabel = isLinear ? "MT" : "M²";
                    }

                    return (
                      <div key={size} className="flex flex-col items-center p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <span className="text-[8px] font-black text-slate-400">{size}</span>
                        <div className="flex flex-col items-center">
                           <span className="text-[10px] font-black text-slate-900 dark:text-white leading-none">{consStr}</span>
                           <span className="text-[6px] font-bold text-slate-400 uppercase">{unitLabel}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Outsourced Services */}
          <div className="p-6 rounded-[2rem] bg-amber-50/30 dark:bg-amber-900/5 border border-amber-100 dark:border-amber-900/20 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Serviços Terceirizados</h4>
            </div>
            <div className="flex items-center gap-3">
              <select 
                className={`flex-1 border-2 rounded-xl px-4 py-2.5 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100'}`}
                value={newServiceId}
                onChange={(e) => setNewServiceId(e.target.value)}
              >
                <option value="">Setor...</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input 
                type="number" 
                placeholder="0.00" 
                className={`w-24 border-2 rounded-xl px-4 py-2.5 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100'}`}
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
                className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {(editing.services || []).map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sectors.find(sec => sec.id === s.serviceId)?.color }} />
                    <span className="text-[10px] font-black uppercase">{sectors.find(sec => sec.id === s.serviceId)?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-amber-600">R$ {s.cost.toFixed(2)}</span>
                    <button onClick={() => setEditing({ ...editing, services: editing.services?.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-rose-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Tool Selection */}
          <div className="p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
             <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Faca / Molde Técnica</label>
                <select 
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100'}`}
                  value={editing.toolId || ''}
                  onChange={(e) => handleToolChange(e.target.value)}
                >
                  <option value="">...</option>
                  {productionConfigs.filter(c => c.type === 'TOOL').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
             </div>
             <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Peças por Par</label>
                <input 
                  type="number" 
                  className={`w-full border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100'}`}
                  value={editing.piecesPerPair || 2}
                  onChange={(e) => handlePPPChange(Number(e.target.value))}
                />
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <button 
            disabled={!editing.materialId}
            onClick={() => onSave(editing)}
            className={`w-full py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.3em] shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${isDarkMode ? 'bg-indigo-600 text-white shadow-indigo-900/40' : 'bg-slate-900 text-white shadow-slate-900/20'}`}
          >
            Confirmar Engenharia
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
