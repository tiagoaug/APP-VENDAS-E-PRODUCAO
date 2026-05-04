import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Product, Grid, GridType, Person, Variation, Category, CategoryType, SaleType, ProductStatus, ColorValue, ProductionConfigItem, TechSheetItem, ComponentConsumption, ComponentCategory, FlowTag } from '../types';
import { 
  Save, Plus, Trash2, Camera, ChevronRight, ChevronLeft, Package, User, 
  ToggleLeft as Toggle, Calendar, DollarSign, Tag, Calculator, Info, 
  FileText, PlusCircle, Layers, Ruler, ExternalLink, ArrowUpDown, 
  Footprints, Scissors, Box, Droplets, Sparkles, Settings, CheckCircle2,
  AlertCircle, ChevronDown, ListFilter, Search, X
} from 'lucide-react';
import CalculatorModal from '../components/CalculatorModal';
import EngineeringEditor from '../components/EngineeringEditor';
import ComboBox from '../components/ComboBox';
import { SIZES } from '../constants';

interface ProductFormViewProps {
  productId: string | null;
  products: Product[];
  grids: Grid[];
  suppliers: Person[];
  categories: Category[];
  colors: ColorValue[];
  productionConfigs: ProductionConfigItem[];
  flowTags: FlowTag[];
  onSave: (product: Product) => void;
  onCancel: () => void;
  isDarkMode: boolean;
  sectors: Sector[];
}

export default function ProductFormView({ productId, products, grids, suppliers, categories, colors, productionConfigs, flowTags, onSave, onCancel, isDarkMode, sectors }: ProductFormViewProps) {
  const existingProduct = useMemo(() => products.find(p => p.id === productId), [productId, products]);
  const productCategories = useMemo(() => categories.filter(c => c.type === CategoryType.PRODUCT), [categories]);
  const molds = useMemo(() => productionConfigs.filter(c => c.type === 'MOLD'), [productionConfigs]);
  const materials = useMemo(() => productionConfigs.filter(c => c.type === 'MATERIAL'), [productionConfigs]);
  const tools = useMemo(() => productionConfigs.filter(c => c.type === 'TOOL'), [productionConfigs]);

  const [name, setName] = useState(existingProduct?.name || '');
  const [reference, setReference] = useState(existingProduct?.reference || '');
  const [supplierId, setSupplierId] = useState(existingProduct?.supplierId || suppliers[0]?.id || '');
  const [categoryId, setCategoryId] = useState(existingProduct?.categoryId || productCategories[0]?.id || '');
  const formaGrids = useMemo(() => grids.filter(g => g.type === GridType.FORMA || !g.type), [grids]);

  const [defaultGridId, setDefaultGridId] = useState(existingProduct?.defaultGridId || formaGrids[0]?.id || grids[0]?.id || '');
  const [productionGridId, setProductionGridId] = useState(existingProduct?.productionGridId || formaGrids[0]?.id || grids[0]?.id || '');
  const [moldId, setMoldId] = useState(existingProduct?.moldId || '');
  const [soleMapping, setSoleMapping] = useState<{ [size: string]: string }>(existingProduct?.soleMapping || {});
  const [toolMapping, setToolMapping] = useState<{ [size: string]: string }>(existingProduct?.toolMapping || {});
  const [showSoleMapping, setShowSoleMapping] = useState(false);
  const [showToolMapping, setShowToolMapping] = useState(false);
  const [type, setType] = useState<SaleType>(existingProduct?.type || SaleType.WHOLESALE);
  const [status, setStatus] = useState<ProductStatus>(existingProduct?.status || ProductStatus.ACTIVE);
  const [costPrice, setCostPrice] = useState<number | string>(existingProduct?.costPrice ?? 0);
  const [salePrice, setSalePrice] = useState<number | string>(existingProduct?.salePrice ?? 0);
  const [minStockInBoxes, setMinStockInBoxes] = useState<number | string>(existingProduct?.minStockInBoxes ?? 0);
  const [adjustmentDate, setAdjustmentDate] = useState(existingProduct?.priceAdjustmentDate ? new Date(existingProduct.priceAdjustmentDate).toISOString().split('T')[0] : '');
  const [costPriceAdjustmentAmount, setCostPriceAdjustmentAmount] = useState<number | string>(existingProduct?.costPriceAdjustmentAmount ?? 0);
  const [salePriceAdjustmentAmount, setSalePriceAdjustmentAmount] = useState<number | string>(existingProduct?.salePriceAdjustmentAmount ?? 0);
  const [variations, setVariations] = useState<Variation[]>(existingProduct?.variations || []);
  
  // Consumption UI state
  const [activeVariationIndex, setActiveVariationIndex] = useState<number | null>(null);
  const [varView, setVarView] = useState<'info' | 'consumo'>('info');
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
  const [editingConsumption, setEditingConsumption] = useState<ComponentConsumption | null>(null);
  const [newServiceId, setNewServiceId] = useState('');
  const [newServiceCost, setNewServiceCost] = useState<number | string>(0);
  const [consumptionCategory, setConsumptionCategory] = useState<ComponentCategory>('CUTTING_PIECE');
  const [saleTypes, setSaleTypes] = useState<SaleType[]>(existingProduct?.saleTypes || (existingProduct?.type ? [existingProduct.type] : [SaleType.WHOLESALE]));

  // Scroll to top when variation is opened or modal toggled
  useEffect(() => {
    const resetScroll = () => {
      // Tenta resetar o scroll em todos os containers possíveis do sistema
      const selectors = ['.overflow-y-auto', '.custom-scrollbar', 'main', '.fixed'];
      selectors.forEach(selector => {
        const containers = document.querySelectorAll(selector);
        containers.forEach(c => {
          c.scrollTo({ top: 0, behavior: 'auto' });
        });
      });
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    if (activeVariationIndex !== null || isConsumptionModalOpen) {
      // Executa imediatamente e também após um pequeno delay para garantir o render
      resetScroll();
      const timer = setTimeout(resetScroll, 150);
      return () => clearTimeout(timer);
    }
  }, [activeVariationIndex, isConsumptionModalOpen]);


  // Auto-initialize sole mapping and variation stock when grid changes
  useEffect(() => {
    const selectedGrid = grids.find(g => g.id === productionGridId);
    const selectedMold = molds.find(m => m.id === moldId);
    const moldSizes = selectedMold?.metadata?.sizes || [];

    if (selectedGrid) {
      // Initialize Sole Mapping for new sizes
      setSoleMapping(prev => {
        const newMapping = { ...prev };
        let changed = false;
        
        selectedGrid.sizes.forEach(size => {
          // If we don't have a mapping for this size yet
          if (newMapping[size] === undefined || newMapping[size] === '') {
            // If the mold has the same size, map it 1:1
            if (moldSizes.includes(size)) {
              newMapping[size] = size;
              changed = true;
            } else if (moldSizes.length > 0) {
              // If not 1:1, maybe try to find the closest size? 
              // For now, leave it empty if no exact match, unless it was previously mapped
              // and the previous value is still in moldSizes
            } else {
              // Fallback to 1:1 if no mold sizes are defined (legacy or manual input)
              newMapping[size] = size;
              changed = true;
            }
          } else {
            // If we have a mapping, but it's no longer in the new mold's sizes,
            // we might want to clear it or keep it? 
            // User said "pulls the grid from registry", so if the mapping is invalid for the new mold, maybe clear it.
            if (moldSizes.length > 0 && !moldSizes.includes(newMapping[size])) {
              // Only clear if it was an auto-mapping or if it's clearly invalid
              // For now, let's keep it to avoid data loss, but the UI select will show it as empty or invalid.
            }
          }
        });
        return changed ? newMapping : prev;
      });

      // Ensure all variations have the grid sizes in their stock object
      setVariations(prev => {
        let changed = false;
        const next = prev.map(v => {
          const newStock = { ...v.stock };
          let varChanged = false;
          selectedGrid.sizes.forEach(size => {
            if (newStock[size] === undefined) {
              newStock[size] = 0;
              varChanged = true;
            }
          });
          if (varChanged) {
            changed = true;
            return { ...v, stock: newStock };
          }
          return v;
        });
        return changed ? next : prev;
      });
    }
  }, [productionGridId, moldId, grids, molds]);

  const [calcModal, setCalcModal] = useState<{ isOpen: boolean; field: string; value: number } | null>(null);

  const addVariation = () => {
    let selectedColor = colors.find(c => !variations.some(v => v.colorName === c.name));
    if (!selectedColor) {
        selectedColor = colors[0] || { id: 'default', name: 'Nova Cor', hex: '#000000' } as ColorValue;
    }
    const newVar: Variation = {
      id: Math.random().toString(36).substr(2, 9),
      color: selectedColor.hex,
      colorName: selectedColor.name,
      minStock: 5,
      stock: {}
    };
    setVariations([...variations, newVar]);
    setActiveVariationIndex(variations.length);
  };

  const updateVariation = (index: number, updates: Partial<Variation>) => {
    const newVars = [...variations];
    newVars[index] = { ...newVars[index], ...updates };
    setVariations(newVars);
  };

  const deleteVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
    if (activeVariationIndex === index) setActiveVariationIndex(null);
  };

  const handleSave = () => {
    if (!name || !reference) {
      alert('Por favor preencha nome e referência.');
      return;
    }
    
    const productData: Product = {
      id: existingProduct?.id || Math.random().toString(36).substr(2, 9),
      name,
      reference,
      supplierId,
      categoryId,
      defaultGridId,
      type: saleTypes[0] || SaleType.WHOLESALE,
      saleTypes,
      status,
      costPrice: parseFloat(costPrice as string) || 0,
      salePrice: parseFloat(salePrice as string) || 0,
      minStockInBoxes: parseInt(minStockInBoxes as string) || 0,
      priceAdjustmentDate: adjustmentDate ? new Date(adjustmentDate).getTime() : undefined,
      costPriceAdjustmentAmount: parseFloat(costPriceAdjustmentAmount as string) || 0,
      salePriceAdjustmentAmount: parseFloat(salePriceAdjustmentAmount as string) || 0,
      productionGridId,
      moldId,
      soleMapping,
      toolMapping,
      variations,
      createdAt: existingProduct?.createdAt || Date.now()
    };

    onSave(productData);
  };
  
  // Migration logic: move techSheet to consumptions if empty
  useEffect(() => {
    if (activeVariationIndex !== null) {
      const v = variations[activeVariationIndex];
      if ((!v.consumptions || v.consumptions.length === 0) && (v.techSheet && v.techSheet.length > 0)) {
        const migrated: ComponentConsumption[] = v.techSheet.map(ts => {
          const material = productionConfigs.find(c => c.id === ts.configItemId);
          return {
            id: ts.id || Math.random().toString(36).substr(2, 9),
            category: 'TRIMMING', // Default to trimming for legacy
            name: material?.name || 'Item Migrado',
            materialId: ts.configItemId,
            quantity: ts.quantity,
          };
        });
        updateVariation(activeVariationIndex, { consumptions: migrated });
      }
    }
  }, [activeVariationIndex]);

  const calculateConsumption = (tool: ProductionConfigItem, material: ProductionConfigItem, piecesPerPair: number = 2) => {
    if (!tool || !tool.metadata) return 0;

    const sizeAreas = tool.metadata.sizeAreas || {};
    const conjugation = tool.metadata.conjugation || 1;
    const productGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
    
    // Check material unit
    const unitId = material.metadata?.unitId;
    const isLinear = unitId?.toUpperCase().includes('MT') || unitId?.toUpperCase().includes('LINEAR');
    const width = material.metadata?.width || 1400; // Default 1.4m width if not specified

    const calculateSingleSize = (area: number) => {
      if (isLinear) {
        // Area is in mm2, width is in mm. Result in linear mm.
        // Convert to linear meters per piece.
        return (area / width) / 1000;
      }
      // Area is in mm2. Convert to M2.
      return area / 1000000;
    };

    let baseConsumption = 0;
    if (productGrid && Object.keys(sizeAreas).length > 0) {
      let totalCons = 0;
      let count = 0;
      productGrid.sizes.forEach(size => {
        const mappedSize = toolMapping?.[size] || size;
        const area = sizeAreas[mappedSize] || sizeAreas[String(mappedSize).trim()] || sizeAreas[size] || 0;
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

    return (baseConsumption / conjugation) * piecesPerPair;
  };

  const updateConsumption = (variationIdx: number, consumptionIdx: number, updates: Partial<ComponentConsumption>) => {
    const v = variations[variationIdx];
    const newConsumptions = [...(v.consumptions || [])];
    const current = newConsumptions[consumptionIdx];
    newConsumptions[consumptionIdx] = { ...current, ...updates };
    
    // Auto-calculate if toolId or piecesPerPair or materialId changed
    if (updates.toolId || updates.piecesPerPair !== undefined || updates.materialId) {
      const toolId = updates.toolId || newConsumptions[consumptionIdx].toolId;
      const matId = updates.materialId || newConsumptions[consumptionIdx].materialId;
      const pieces = updates.piecesPerPair !== undefined ? updates.piecesPerPair : newConsumptions[consumptionIdx].piecesPerPair;
      
      if (toolId && matId) {
        const tool = productionConfigs.find(t => t.id === toolId);
        const material = productionConfigs.find(m => m.id === matId);
        if (tool && material) {
           newConsumptions[consumptionIdx].quantity = calculateConsumption(tool, material, pieces);
        }
      }
    }

    updateVariation(variationIdx, { consumptions: newConsumptions });
  };

  if (activeVariationIndex !== null) {
    const v = variations[activeVariationIndex];
    const selectedGrid = grids.find(g => g.id === (productionGridId || defaultGridId));
    const availableSizes = selectedGrid?.sizes || [];

    return (
      <div className={`w-full ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <AnimatePresence mode="wait">
        {!isConsumptionModalOpen ? (
          <motion.div 
            key="var-list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col gap-6"
          >
        <div className="flex items-center justify-between mb-2 px-2">
          <button 
            onClick={() => setActiveVariationIndex(null)} 
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400"
          >
            <ChevronLeft size={16} /> Voltar
          </button>
          <div className="flex gap-2">
            <button 
               onClick={() => setVarView('info')}
               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${varView === 'info' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
             >
               Cores & Info
             </button>
             <button 
               onClick={() => setVarView('consumo')}
               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${varView === 'consumo' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
             >
               Engenharia / Consumos
             </button>
          </div>
        </div>

        {varView === 'info' ? (
          <div className="flex flex-col gap-6">
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-8 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cor da Variante */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Cor do Cabedal / Variante</label>
                    <div className="relative group">
                      <select 
                        className={`w-full appearance-none border-2 rounded-2xl px-6 py-4 pl-12 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                        value={v.colorName}
                        onChange={(e) => {
                          const selectedColor = colors.find(c => c.name === e.target.value);
                          if (selectedColor) {
                            // Check if color is already used
                            const isUsed = variations.some((v, idx) => idx !== activeVariationIndex && v.colorName === selectedColor.name);
                            if (!isUsed) {
                              updateVariation(activeVariationIndex, { colorName: selectedColor.name, color: selectedColor.hex });
                            }
                          }
                        }}
                      >
                        <option value="">Selecione uma cor...</option>
                        {colors.map(c => {
                          const isUsed = variations.some((variation, idx) => idx !== activeVariationIndex && variation.colorName === c.name);
                          return (
                            <option key={c.id} value={c.name} disabled={isUsed}>
                              {c.name} {isUsed ? '(Já utilizada)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: v.color }} />
                      <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Cor Sincronizada (Sola) */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Cor do Solado (Matriz)</label>
                    <div className="relative group">
                      <select 
                        className={`w-full appearance-none border-2 rounded-2xl px-6 py-4 pl-12 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                        value={v.soleColorId || ''}
                        onChange={(e) => updateVariation(activeVariationIndex, { soleColorId: e.target.value })}
                      >
                        <option value="">MESMA COR DO CABEDAL</option>
                        {(() => {
                           const selectedMold = molds.find(m => m.id === moldId);
                           const moldColorIds = selectedMold?.metadata?.colorIds || [];
                           
                           // If mold has specific colors, filter them. Otherwise show all.
                           const availableColors = moldColorIds.length > 0 
                              ? colors.filter(c => moldColorIds.includes(c.id))
                              : colors;
                              
                           return availableColors.map(c => (
                             <option key={c.id} value={c.id}>{c.name}</option>
                           ));
                        })()}
                      </select>
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-black/10 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                        {v.soleColorId ? (
                          <div className="w-full h-full rounded-full" style={{ backgroundColor: colors.find(c => c.id === v.soleColorId)?.hex }} />
                        ) : (
                          <div className="w-full h-full rounded-full" style={{ backgroundColor: v.color }} />
                        )}
                      </div>
                      <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    {moldId && molds.find(m => m.id === moldId)?.metadata?.colorIds?.length === 0 && (
                       <p className="text-[8px] text-amber-500 font-bold uppercase px-2">Nota: Esta matriz não possui cores vinculadas. Exibindo todas.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {/* Sub-Ref */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Sub-Ref</label>
                    <input 
                      type="text"
                      placeholder="EX: A"
                      className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                      value={v.subRef || ''}
                      onChange={(e) => updateVariation(activeVariationIndex, { subRef: e.target.value.toUpperCase() })}
                    />
                  </div>

                  {/* SKU / EAN */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">SKU / Código EAN</label>
                    <input 
                      type="text"
                      placeholder="SKU-VAR-001"
                      className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                      value={v.sku || ''}
                      onChange={(e) => updateVariation(activeVariationIndex, { sku: e.target.value.toUpperCase() })}
                    />
                  </div>

                  {/* Est. Minimo */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Estoque Mínimo</label>
                    <input 
                      type="number"
                      placeholder="0"
                      className={`w-full border-2 rounded-2xl px-6 py-4 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                      value={v.minStock || 0}
                      onChange={(e) => updateVariation(activeVariationIndex, { minStock: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Configuração de Preços / Stock (Se for Varejo) */}
            {saleTypes.includes(SaleType.RETAIL) && (
              <div className={`p-8 rounded-[2.5rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Tabela de Preços e Grade (Varejo)</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Valores por Tamanho</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {availableSizes.map(size => (
                    <div key={size} className={`p-4 rounded-3xl border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-black text-slate-400">{size}</span>
                         <Footprints size={14} className="text-slate-300" />
                      </div>
                      <div className="flex flex-col gap-3">
                         <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Venda</span>
                            <input 
                              type="number"
                              className="w-full bg-transparent border-none p-0 text-sm font-black text-emerald-600 dark:text-emerald-400 outline-none"
                              value={v.sizePrices?.[size]?.sale || salePrice}
                              onChange={(e) => {
                                const newPrices = { ...(v.sizePrices || {}) };
                                newPrices[size] = { 
                                  cost: v.sizePrices?.[size]?.cost || (typeof costPrice === 'string' ? parseFloat(costPrice) : costPrice), 
                                  sale: parseFloat(e.target.value) || 0 
                                };
                                updateVariation(activeVariationIndex, { sizePrices: newPrices });
                              }}
                            />
                         </div>
                         <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Estoque</span>
                            <input 
                              type="number"
                              className="w-full bg-transparent border-none p-0 text-sm font-black text-slate-900 dark:text-white outline-none"
                              value={v.stock[size] || 0}
                              onChange={(e) => {
                                const newStock = { ...v.stock };
                                newStock[size] = parseInt(e.target.value) || 0;
                                updateVariation(activeVariationIndex, { stock: newStock });
                              }}
                            />
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Seção de Consumos */}
            <div className="grid grid-cols-1 gap-6">
              {/* Componentes do Cabedal (Peças de Corte) */}
              <div className={`p-8 rounded-[2.5rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <Scissors size={24} />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Componentes do Cabedal</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Peças de Corte & Frequência</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setConsumptionCategory('CUTTING_PIECE');
                      setEditingConsumption({
                        id: Math.random().toString(36).substr(2, 9),
                        category: 'CUTTING_PIECE',
                        name: '',
                        materialId: '',
                        quantity: 0,
                        piecesPerPair: 2
                      });
                      setIsConsumptionModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus size={14} strokeWidth={3} /> Nova Peça
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(v.consumptions || []).filter(c => c.category === 'CUTTING_PIECE').map((item, idx) => {
                    const material = productionConfigs.find(m => m.id === item.materialId);
                    const tool = productionConfigs.find(t => t.id === item.toolId);
                    return (
                      <div key={item.id} className={`p-5 rounded-3xl border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600">
                               <Scissors size={20} />
                             </div>
                             <div>
                               <p className="text-xs font-black uppercase text-slate-900 dark:text-white">{item.name}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">{material?.name || '---'}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingConsumption(item);
                                setConsumptionCategory('CUTTING_PIECE');
                                setIsConsumptionModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-500"
                            >
                              <Settings size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                const newC = (v.consumptions || []).filter(c => c.id !== item.id);
                                updateVariation(activeVariationIndex, { consumptions: newC });
                              }}
                              className="p-2 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-200/50 dark:border-slate-800/50">
                           <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-black text-slate-400 uppercase">Peças/Pr</span>
                              <span className="text-[11px] font-black">{item.piecesPerPair || 2}</span>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-black text-slate-400 uppercase">Consumo</span>
                              <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{item.quantity.toFixed(4)} <span className="text-[9px]">{material?.metadata?.unitId || 'M2'}</span></span>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-black text-slate-400 uppercase">Faca</span>
                              <span className="text-[10px] font-bold truncate max-w-[80px]">{tool?.name || '---'}</span>
                           </div>
                        </div>
                        
                        {item.services && item.services.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                             {item.services.map(s => (
                               <div key={s.serviceId} className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                                  {flowTags.find(f => f.id === s.serviceId)?.name || 'Serviço'}
                               </div>
                             ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(v.consumptions || []).filter(c => c.category === 'CUTTING_PIECE').length === 0 && (
                    <div className="col-span-full py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-3">
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nenhuma peça de corte adicionada</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Outros Consumos (Embalagem, Químicos, Aviamentos) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { cat: 'PACKAGING' as ComponentCategory, label: 'Embalagens', icon: <Box size={22} />, color: 'bg-emerald-600', textColor: 'text-emerald-600' },
                  { cat: 'CHEMICAL' as ComponentCategory, label: 'Químicos', icon: <Droplets size={22} />, color: 'bg-blue-600', textColor: 'text-blue-600' },
                  { cat: 'TRIMMING' as ComponentCategory, label: 'Aviamentos', icon: <Sparkles size={22} />, color: 'bg-amber-600', textColor: 'text-amber-600' },
                ].map(group => (
                  <div key={group.cat} className={`p-6 rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${group.color} text-white flex items-center justify-center shadow-lg opacity-80`}>
                          {group.icon}
                        </div>
                        <h3 className={`text-[10px] font-black uppercase tracking-widest ${group.textColor} dark:opacity-80`}>{group.label}</h3>
                      </div>
                      <button 
                         onClick={() => {
                           setConsumptionCategory(group.cat);
                           setEditingConsumption({
                             id: Math.random().toString(36).substr(2, 9),
                             category: group.cat,
                             name: '',
                             materialId: '',
                             quantity: 0
                           });
                           setIsConsumptionModalOpen(true);
                         }}
                         className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600"
                      >
                         <Plus size={16} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {(v.consumptions || []).filter(c => c.category === group.cat).map(item => {
                        const mat = productionConfigs.find(m => m.id === item.materialId);
                        return (
                          <div key={item.id} className={`p-4 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                             <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate max-w-[120px]">{item.name || mat?.name}</p>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => { setEditingConsumption(item); setConsumptionCategory(group.cat); setIsConsumptionModalOpen(true); }} className="p-1 text-slate-300 hover:text-indigo-500"><Settings size={14} /></button>
                                  <button onClick={() => { const newC = (v.consumptions || []).filter(c => c.id !== item.id); updateVariation(activeVariationIndex, { consumptions: newC }); }} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                </div>
                             </div>
                             <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                                <span className="text-[8px] font-black text-slate-400 uppercase">Qtd: <span className="text-slate-900 dark:text-slate-200">{item.quantity}</span></span>
                                <span className="text-[8px] font-black text-slate-400 uppercase">{mat?.metadata?.unitId || 'UN'}</span>
                             </div>
                          </div>
                        );
                      })}
                      {(v.consumptions || []).filter(c => c.category === group.cat).length === 0 && (
                        <p className="text-[8px] text-slate-300 font-bold uppercase text-center py-4 italic">Nenhum item</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Resumo de Custos da Engenharia */}
            <div className="mt-4 p-6 bg-slate-900 dark:bg-indigo-600 rounded-[2.5rem] shadow-xl flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                     <Calculator size={28} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em]">Engenharia do Modelo</p>
                    <p className="text-2xl font-black text-white leading-none mt-1">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        (v.consumptions || []).reduce((acc, item) => {
                          const material = productionConfigs.find(c => c.id === item.materialId);
                          const matCost = (item.quantity * (material?.metadata?.baseCost || 0));
                          const serviceCost = (item.services || []).reduce((sAcc, s) => sAcc + s.cost, 0);
                          return acc + matCost + serviceCost;
                        }, 0)
                      )}
                    </p>
                  </div>
               </div>
               <CheckCircle2 className="text-white/20" size={40} />
            </div>
          </div>
        )}

            <button 
          onClick={() => {
            const nextIndex = activeVariationIndex + 1;
            if (nextIndex < variations.length) {
                setActiveVariationIndex(nextIndex);
                setVarView('info');
            } else {
                setActiveVariationIndex(null);
            }
          }}
          className={`bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 mt-8 ${isDarkMode ? 'shadow-none' : 'shadow-indigo-200'}`}
        >
          {activeVariationIndex === variations.length - 1 ? 'Concluir Engenharia' : 'Próxima Variação'} <ChevronRight size={16}/>
        </button>
      </motion.div>
        ) : (
          <EngineeringEditor 
            key="editor"
            isDarkMode={isDarkMode}
            consumption={editingConsumption!}
            onCancel={() => setIsConsumptionModalOpen(false)}
            onSave={(updated) => {
              if (activeVariationIndex !== null) {
                const currentConsumptions = variations[activeVariationIndex].consumptions || [];
                const exists = currentConsumptions.findIndex(c => c.id === updated.id);
                let newC = [...currentConsumptions];
                if (exists >= 0) {
                  newC[exists] = updated;
                } else {
                  newC.push(updated);
                }
                updateVariation(activeVariationIndex, { consumptions: newC });
                setIsConsumptionModalOpen(false);
              }
            }}
            productionConfigs={productionConfigs}
            colors={colors}
            sectors={sectors}
            grids={grids}
            productionGridId={productionGridId}
            defaultGridId={defaultGridId}
            toolMapping={toolMapping}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

  return (
    <div className="flex flex-col gap-6 pb-60 px-4 pt-4 min-h-screen">
      <div className={`p-6 rounded-[2rem] border flex flex-col gap-6 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
           <button 
             onClick={() => {
                if (saleTypes.includes(SaleType.WHOLESALE)) {
                   if (saleTypes.length > 1) setSaleTypes(saleTypes.filter(t => t !== SaleType.WHOLESALE));
                } else {
                   setSaleTypes([...saleTypes, SaleType.WHOLESALE]);
                }
             }}
             className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${saleTypes.includes(SaleType.WHOLESALE) ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
           >
             <Package size={14} /> Atacado
           </button>
           <button 
             onClick={() => {
                if (saleTypes.includes(SaleType.RETAIL)) {
                   if (saleTypes.length > 1) setSaleTypes(saleTypes.filter(t => t !== SaleType.RETAIL));
                } else {
                   setSaleTypes([...saleTypes, SaleType.RETAIL]);
                }
             }}
             className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${saleTypes.includes(SaleType.RETAIL) ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
           >
             <Tag size={14} /> Varejo
           </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
           <div className="flex items-center gap-3">
             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status === ProductStatus.ACTIVE ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
               <Toggle className={status === ProductStatus.ACTIVE ? '' : 'rotate-180'} size={20} />
             </div>
             <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">{status === ProductStatus.ACTIVE ? 'Em Uso' : 'Inativo'}</p>
               <p className="text-[9px] text-slate-400 dark:text-slate-500">Bloqueia compra/venda se inativo</p>
             </div>
           </div>
           <button 
             type="button"
             onClick={() => setStatus(status === ProductStatus.ACTIVE ? ProductStatus.INACTIVE : ProductStatus.ACTIVE)}
             className={`w-12 h-6 rounded-full relative transition-colors ${status === ProductStatus.ACTIVE ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
             aria-label={status === ProductStatus.ACTIVE ? "Inativar produto" : "Ativar produto"}
             title={status === ProductStatus.ACTIVE ? "Inativar" : "Ativar"}
           >
             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${status === ProductStatus.ACTIVE ? 'left-7' : 'left-1'}`} />
           </button>
        </div>

         <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-1.5 block tracking-wider">Referência Interna</label>
               <input 
                 type="text" 
                 placeholder="Ex: SNK-102"
                 className={`w-full border rounded-2xl px-5 py-4 text-xs font-bold transition-all outline-none focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50 text-white focus:ring-indigo-500/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:ring-indigo-500/5'}`}
                 value={reference}
                 onChange={(e) => setReference(e.target.value)}
               />
             </div>

             <div>
               <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-1.5 block tracking-wider">Nome do Modelo</label>
               <input 
                 type="text" 
                 placeholder="Ex: Tênis Runner Air"
                 className={`w-full border rounded-2xl px-5 py-4 text-xs font-bold transition-all outline-none focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50 text-white focus:ring-indigo-500/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:ring-indigo-500/5'}`}
                 value={name}
                 onChange={(e) => setName(e.target.value)}
               />
             </div>
           </div>

           {/* Configurações de Produção */}
           <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-all duration-500 ${isDarkMode ? 'bg-slate-800/20 border-slate-700/50' : 'bg-slate-50 border-slate-100 shadow-indigo-100/10'}`}>
             <div className="flex items-center gap-4 mb-8">
               <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                 <Calculator size={24} strokeWidth={2.5} />
               </div>
               <div>
                 <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                   Configurações de Produção
                 </h4>
                 <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Grade, Solados e Facas
                 </p>
               </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div>
                 <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest leading-none">
                   Grade de Produção
                 </label>
                  <div className="relative group">
                    <select
                      title="Grade de Producao"
                      aria-label="Selecionar grade de tamanhos"
                      className={`w-full border-2 rounded-2xl px-6 py-4 pl-12 appearance-none text-sm font-black transition-all outline-none focus:ring-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                      value={productionGridId}
                      onChange={(e) => setProductionGridId(e.target.value)}
                    >
                      {formaGrids.map(g => (
                        <option key={g.id} value={g.id} className="dark:bg-slate-900">
                          {g.name} ({g.sizes.join("/")})
                        </option>
                      ))}
                    </select>
                    <Ruler size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 rotate-90" size={18} />
                  </div>
                </div>

               <div>
                 <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest leading-none">
                   Matriz de Solado
                 </label>
                 <div className="relative group">
                    <ComboBox
                      options={[{ id: '', name: 'Nenhuma' }, ...molds.map(m => ({ id: m.id, name: m.name }))]}
                      value={moldId}
                      onChange={setMoldId}
                      placeholder="Selecionar solado..."
                      isDarkMode={isDarkMode}
                      icon={<Layers size={18} />}
                    />
                  </div>
                </div>
              </div>

              {/* Mapeamento de Grade de Solados — Card dedicado */}
              <div className={`mt-6 rounded-[2rem] border-2 overflow-hidden ${isDarkMode ? 'border-emerald-500/20' : 'border-emerald-100'}`}>
                {/* Header clicável */}
                <button
                  type="button"
                  onClick={() => setShowSoleMapping(!showSoleMapping)}
                  className={`w-full flex items-center justify-between px-6 py-4 text-left transition-colors ${showSoleMapping ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50') : (isDarkMode ? 'bg-slate-800/20' : 'bg-emerald-50/30')}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showSoleMapping ? 'bg-emerald-500 text-white shadow-lg' : isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                      <Footprints size={18} />
                    </div>
                    <div>
                      <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        Mapeamento de Solados por Numeração
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {Object.values(soleMapping).some(v => v)
                          ? `${Object.keys(soleMapping).filter(k => soleMapping[k]).length} numerações mapeadas · toque para editar`
                          : 'Vincule cada tamanho cabedal ao número da sola'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showSoleMapping ? 'bg-emerald-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                    <ChevronRight size={14} className={`transition-transform ${showSoleMapping ? 'rotate-[270deg]' : 'rotate-90'}`} />
                  </div>
                </button>

                {/* Conteúdo expandido */}

                {/* Conteudo expandido */}
                {showSoleMapping && (() => {
                  const cabedal = grids.find(g => g.id === productionGridId);
                  const mold = molds.find(m => m.id === moldId);
                  const moldSizes = mold?.metadata?.sizes || [];

                  if (!cabedal?.sizes?.length) {
                    return (
                      <div className={`px-6 pb-6 pt-4 border-t-2 ${isDarkMode ? 'border-emerald-500/10 bg-slate-900/30' : 'border-emerald-100 bg-white/50'}`}>
                        <div className="text-center py-6 text-[10px] font-bold text-amber-500 uppercase tracking-widest border-2 border-dashed border-amber-100 dark:border-amber-900/30 rounded-2xl">
                          Selecione uma Grade de Producao acima para mapear as numeracoes.
                        </div>
                      </div>
                    );
                  }

                  if (!moldId) {
                    return (
                      <div className={`px-6 pb-6 pt-4 border-t-2 ${isDarkMode ? 'border-emerald-500/10 bg-slate-900/30' : 'border-emerald-100 bg-white/50'}`}>
                        <div className="text-center py-6 text-[10px] font-bold text-amber-500 uppercase tracking-widest border-2 border-dashed border-amber-100 dark:border-amber-900/30 rounded-2xl">
                          Selecione uma Matriz de Solado acima para ativar o mapeamento.
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className={`px-6 pb-6 pt-4 border-t-2 animate-in fade-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'border-emerald-500/10 bg-slate-900/30' : 'border-emerald-100 bg-white/50'}`}>
                      <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-emerald-50'}`}>
                        <Footprints size={14} className="text-emerald-500 shrink-0" />
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-relaxed">
                          Cruzando: <span className="text-slate-700 dark:text-slate-300 font-black">{cabedal.name}</span>
                          {' '}x <span className="text-emerald-600 dark:text-emerald-400 font-black">{mold?.name}</span>
                          {moldSizes.length === 0 && (
                            <span className="text-amber-500 font-black"> — Matriz sem grade definida, insira manualmente.</span>
                          )}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {cabedal.sizes.map(cabedalSize => (
                          <div key={cabedalSize} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 focus-within:border-emerald-500' : 'bg-white border-slate-100 shadow-sm focus-within:border-emerald-400'}`}>
                            <div className="text-center">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Cabedal</span>
                              <span className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{cabedalSize}</span>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                              <ArrowUpDown size={13} />
                            </div>
                            <div className={`w-full rounded-xl border-2 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700 focus-within:border-emerald-500' : 'bg-emerald-50 border-emerald-100 focus-within:border-emerald-400'}`}>
                              <div className="flex items-center px-2 py-1.5 gap-1">
                                <span className="text-[7px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest shrink-0">Sola</span>
                                {moldSizes.length > 0 ? (
                                  <select
                                    value={soleMapping[cabedalSize] || ''}
                                    onChange={(e) => setSoleMapping({ ...soleMapping, [cabedalSize]: e.target.value })}
                                    className="w-full bg-transparent border-none text-right text-xs font-black text-slate-900 dark:text-white outline-none p-0 cursor-pointer appearance-none"
                                    title={`Numeracao da sola para o cabedal ${cabedalSize}`}
                                  >
                                    <option value="">--</option>
                                    {moldSizes.map(s => (
                                      <option key={s} value={s} className="dark:bg-slate-900">{s}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={soleMapping[cabedalSize] || ''}
                                    onChange={(e) => setSoleMapping({ ...soleMapping, [cabedalSize]: e.target.value })}
                                    className="w-full bg-transparent border-none text-right text-xs font-black text-slate-900 dark:text-white outline-none p-0"
                                    placeholder="Num."
                                    title={`Numeracao da sola para o cabedal ${cabedalSize}`}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Mapeamento de Facas por Numeração (Igual ao solado, mas global) */}
              <div className={`mt-4 rounded-3xl border shadow-sm overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-indigo-50/30 border-indigo-100/50'}`}>
                <button
                  type="button"
                  onClick={() => setShowToolMapping(!showToolMapping)}
                  className={`w-full flex items-center justify-between px-6 py-4 text-left transition-colors ${showToolMapping ? (isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50') : (isDarkMode ? 'bg-slate-800/20' : 'bg-indigo-50/30')}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showToolMapping ? 'bg-indigo-500 text-white shadow-lg' : isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                      <Scissors size={18} />
                    </div>
                    <div>
                      <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                        Mapeamento de Facas por Numeração
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {Object.values(toolMapping).some(v => v)
                          ? `${Object.keys(toolMapping).filter(k => toolMapping[k]).length} numerações mapeadas · toque para editar`
                          : 'Vincule cada tamanho cabedal ao número da faca'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showToolMapping ? 'bg-indigo-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                    <ChevronRight size={14} className={`transition-transform ${showToolMapping ? 'rotate-[270deg]' : 'rotate-90'}`} />
                  </div>
                </button>

                {showToolMapping && (() => {
                  const cabedal = grids.find(g => g.id === productionGridId);
                  
                  if (!cabedal?.sizes?.length) {
                    return (
                      <div className={`px-6 pb-6 pt-4 border-t-2 ${isDarkMode ? 'border-indigo-50/10 bg-slate-900/30' : 'border-indigo-100 bg-white/50'}`}>
                        <div className="text-center py-6 text-[10px] font-bold text-amber-500 uppercase tracking-widest border-2 border-dashed border-amber-100 dark:border-amber-900/30 rounded-2xl">
                          Selecione uma Grade de Producao acima para mapear as numeracoes.
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className={`px-6 pb-6 pt-4 border-t-2 animate-in fade-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'border-indigo-50/10 bg-slate-900/30' : 'border-indigo-100 bg-white/50'}`}>
                      <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-indigo-50'}`}>
                        <Scissors size={14} className="text-indigo-500 shrink-0" />
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-relaxed">
                          Mapeamento Global de Facas para a Grade: <span className="text-indigo-600 dark:text-indigo-400 font-black">{cabedal.name}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {cabedal.sizes.map(cabedalSize => (
                          <div key={cabedalSize} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 focus-within:border-indigo-500' : 'bg-white border-slate-100 shadow-sm focus-within:border-indigo-400'}`}>
                            <div className="text-center">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Cabedal</span>
                              <span className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{cabedalSize}</span>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                              <ArrowUpDown size={13} />
                            </div>
                            <div className={`w-full rounded-xl border-2 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700 focus-within:border-indigo-500' : 'bg-indigo-50 border-indigo-100 focus-within:border-indigo-400'}`}>
                              <div className="flex items-center px-2 py-1.5 gap-1">
                                <span className="text-[7px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest shrink-0">Faca</span>
                                <input
                                  type="text"
                                  value={toolMapping[cabedalSize] || ''}
                                  onChange={(e) => setToolMapping({ ...toolMapping, [cabedalSize]: e.target.value })}
                                  className="w-full bg-transparent border-none text-right text-xs font-black text-slate-900 dark:text-white outline-none p-0"
                                  placeholder="Num."
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

           <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-all duration-500 ${saleTypes.includes(SaleType.WHOLESALE) ? 'bg-amber-50/40 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20 shadow-amber-100/20' : 'bg-indigo-50/40 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/20 shadow-indigo-100/20'}`}>
             <div className="flex items-center gap-4 mb-8">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform duration-500 ${saleTypes.includes(SaleType.WHOLESALE) ? 'bg-amber-500 rotate-3 text-white' : 'bg-indigo-500 -rotate-3 text-white'}`}>
                  {saleTypes.includes(SaleType.WHOLESALE) ? <Package size={24} strokeWidth={2.5} /> : <Tag size={24} strokeWidth={2.5} />}
                </div>
                <div>
                   <h4 className={`text-[11px] font-black uppercase tracking-[0.2em] ${saleTypes.includes(SaleType.WHOLESALE) ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                     Configurações de {saleTypes.length > 1 ? 'Venda Híbrida' : saleTypes.includes(SaleType.WHOLESALE) ? 'Atacado' : 'Varejo'}
                   </h4>
                   <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                     {saleTypes.includes(SaleType.WHOLESALE) ? 'Precificação por grade fechada' : 'Precificação por par individual'}
                   </p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div className="group">
                 <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest leading-none group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                   {type === SaleType.WHOLESALE ? 'Custo por Caixa (R$)' : 'Custo Unitário (R$)'}
                 </label>
                 <div className="relative">
                   <input 
                     type="number" 
                     step="0.01"
                     className={`w-full border-2 rounded-2xl px-6 py-4.5 pl-12 text-sm font-black transition-all outline-none focus:ring-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                     value={costPrice}
                     aria-label="Preço de custo"
                     title="Preço de Custo"
                     onChange={(e) => setCostPrice(e.target.value)}
                   />
                   <DollarSign size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                   <button 
                     type="button" 
                     onClick={() => setCalcModal({ isOpen: true, field: 'costPrice', value: parseFloat(costPrice as string) || 0 })} 
                     className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                     aria-label="Abrir calculadora para o preço de custo"
                     title="Calculadora"
                   >
                     <Calculator size={16} />
                   </button>
                 </div>
               </div>

               <div className="group">
                 <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest leading-none group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                   {type === SaleType.WHOLESALE ? 'Venda por Caixa (R$)' : 'Venda Unitária (R$)'}
                 </label>
                 <div className="relative">
                   <input 
                     type="number" 
                     step="0.01"
                     className={`w-full border-2 rounded-2xl px-6 py-4.5 pl-12 text-sm font-black transition-all outline-none focus:ring-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-indigo-400 focus:border-indigo-500 text-lg' : 'bg-white border-slate-100 text-indigo-600 focus:border-indigo-500 text-lg'}`}
                     value={salePrice}
                     aria-label="Preço de venda"
                     title="Preço de Venda"
                     onChange={(e) => setSalePrice(e.target.value)}
                   />
                   <DollarSign size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400" />
                   <button 
                     type="button" 
                     onClick={() => setCalcModal({ isOpen: true, field: 'salePrice', value: parseFloat(salePrice as string) || 0 })} 
                     className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                     aria-label="Abrir calculadora para o preço de venda"
                     title="Calculadora"
                   >
                     <Calculator size={16} />
                   </button>
                 </div>
               </div>

               {saleTypes.includes(SaleType.RETAIL) && (
                 <div className="col-span-1 sm:col-span-2 p-5 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-3 mb-4">
                       <Info size={16} className="text-indigo-400" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Configuração de Volume (Varejo)</p>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest">Grade de Tamanhos Padrão</label>
                      <div className="relative">
                        <select 
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-xs font-black appearance-none cursor-pointer text-slate-700 dark:text-slate-300 pr-10"
                          value={defaultGridId}
                          title="Selecionar grade de tamanhos padrão"
                          onChange={(e) => setDefaultGridId(e.target.value)}
                        >
                          {grids.map(g => <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name} ({g.sizes.join('/')})</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 rotate-90" size={18} />
                      </div>
                    </div>
                 </div>
               )}

               <div className={type === SaleType.WHOLESALE ? "col-span-1 sm:col-span-2" : "col-span-1"}>
                 <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest leading-none">
                   {type === SaleType.WHOLESALE ? 'Estoque Mínimo (Caixas)' : 'Estoque Mín. Global'}
                 </label>
                 <div className="relative">
                    <input 
                      type="number" 
                      className={`w-full border-2 rounded-2xl px-6 py-4.5 pl-12 text-sm font-black transition-all outline-none focus:ring-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                      value={minStockInBoxes}
                      aria-label="Estoque mínimo global"
                      title="Estoque Mínimo"
                      onChange={(e) => setMinStockInBoxes(e.target.value)}
                    />
                    <Package size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                 </div>
               </div>
             </div>
           </div>
         </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block tracking-wider">Fornecedor</label>
            <ComboBox
              options={suppliers.map(s => ({ id: s.id, name: s.name }))}
              value={supplierId}
              onChange={setSupplierId}
              placeholder="Selecionar fornecedor..."
              isDarkMode={isDarkMode}
              icon={<User size={18} />}
            />
          </div>
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block tracking-wider">Categoria</label>
            <ComboBox
              options={[{ id: '', name: 'Nenhum' }, ...productCategories.map(c => ({ id: c.id, name: c.name }))]}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Selecionar categoria..."
              isDarkMode={isDarkMode}
              icon={<Tag size={18} />}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
           <label className="text-[10px] uppercase font-black text-slate-900 dark:text-white mb-4 block tracking-widest flex items-center gap-2">
             <Calendar size={14} className="text-indigo-500" /> Agendar Reajuste de Preço
           </label>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                 <label className="text-[8px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block">A partir de</label>
                 <input 
                   type="date"
                   className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-3 text-[10px] font-bold text-slate-900 dark:text-slate-100"
                   value={adjustmentDate}
                   title="Data de reajuste"
                   onChange={(e) => setAdjustmentDate(e.target.value)}
                 />
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[8px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block">Reajuste Custo (R$)</label>
                    <div className="relative">
                        <input 
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-3 text-[10px] font-bold text-slate-900 dark:text-slate-100 pl-8"
                        value={costPriceAdjustmentAmount}
                        onChange={(e) => setCostPriceAdjustmentAmount(e.target.value)}
                        placeholder="0.00"
                        />
                        <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <button 
                          type="button" 
                          onClick={() => setCalcModal({ isOpen: true, field: 'costPriceAdjustmentAmount', value: parseFloat(costPriceAdjustmentAmount as string) || 0 })} 
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                          title="Calculadora"
                          aria-label="Abrir calculadora para reajuste de custo"
                        >
                          <Calculator size={12} />
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-[8px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block">Reajuste Venda (R$)</label>
                    <div className="relative">
                        <input 
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-3 text-[10px] font-bold text-slate-900 dark:text-slate-100 pl-8"
                        value={salePriceAdjustmentAmount}
                        onChange={(e) => setSalePriceAdjustmentAmount(e.target.value)}
                        placeholder="0.00"
                        />
                        <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                        <button 
                          type="button" 
                          onClick={() => setCalcModal({ isOpen: true, field: 'salePriceAdjustmentAmount', value: parseFloat(salePriceAdjustmentAmount as string) || 0 })} 
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                          title="Calculadora"
                          aria-label="Abrir calculadora para reajuste de venda"
                        >
                          <Calculator size={12} />
                        </button>
                    </div>
                </div>
              </div>
           </div>
        </div>
      </div>

      <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 dark:text-slate-100">Cores e Variações</h3>
            <button 
              onClick={addVariation} 
              className="flex items-center gap-2 text-[10px] bg-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-sm transition-all"
              aria-label="Adicionar nova variação de cor"
              title="Adicionar Cor"
            >
              <Plus size={14} strokeWidth={3} /> Adicionar Cor
            </button>
          </div>

          <div className="space-y-2">
            {variations.map((v, i) => (
              <div key={v.id} className={`p-3 rounded-xl border flex items-center justify-between shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 shadow-sm ring-2 ring-slate-50 dark:ring-slate-800">
                    <Package size={20} className="text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-900 dark:text-white tracking-tight">{v.colorName}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-100 dark:border-slate-700">
                        <Layers size={10} className="text-indigo-400" />
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                          {(v.techSheet || []).length} Materiais
                        </span>
                      </div>
                      {Object.keys(soleMapping).length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-100 dark:border-emerald-900/30">
                          <Footprints size={10} className="text-emerald-500" />
                          <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">
                            Mapeado
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setActiveVariationIndex(i)} 
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
                    aria-label={`Editar variação ${v.colorName}`}
                    title="Editar Variação"
                  >
                    Editar Ficha <ChevronRight size={14} />
                  </button>
                  <button 
                    onClick={() => deleteVariation(i)} 
                    className="p-2 text-rose-300 dark:text-rose-700 hover:text-rose-500 transition-colors"
                    aria-label={`Excluir variação ${v.colorName}`}
                    title="Excluir Variação"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {variations.length === 0 && (
              <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-300 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">
                Nenhuma variação adicionada.
              </div>
            )}
          </div>
      </section>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <button 
          onClick={onCancel}
          className="py-3.5 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 transition-all font-sans cursor-pointer"
        >
          Cancelar
        </button>
        <button 
          onClick={handleSave}
          className={`bg-slate-900 dark:bg-indigo-600 text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-xl transform transition-transform active:scale-95 cursor-pointer ${isDarkMode ? 'shadow-none' : 'shadow-slate-200'}`}
          aria-label="Salvar alterações do produto"
          title="Salvar Produto"
        >
          <Save size={14} /> Salvar Produto
        </button>
      </div>
      <CalculatorModal
        isOpen={!!calcModal}
        onClose={() => setCalcModal(null)}
        isDarkMode={isDarkMode}
        initialValue={calcModal?.value || 0}
        onResult={(res) => {
            if (!calcModal) return;
            if (calcModal.field === 'costPrice') setCostPrice(res.toString());
            if (calcModal.field === 'salePrice') setSalePrice(res.toString());
            if (calcModal.field === 'costPriceAdjustmentAmount') setCostPriceAdjustmentAmount(res.toString());
            if (calcModal.field === 'salePriceAdjustmentAmount') setSalePriceAdjustmentAmount(res.toString());
            if (calcModal.field === 'quantity' && editingConsumption) {
              setEditingConsumption({ ...editingConsumption, quantity: res });
            }
        }}
      />

    </div>
  );
}
