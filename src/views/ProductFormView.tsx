import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Product, Grid, GridType, Person, Variation, Category, CategoryType, SaleType, ProductStatus, ColorValue, ProductionConfigItem, TechSheetItem, ComponentConsumption, ComponentCategory, FlowTag, Sector, AppModulesConfig } from '../types';
import {
  Save, Plus, Trash2, Camera, ChevronRight, ChevronLeft, Package, User,
  ToggleLeft as Toggle, Calendar, DollarSign, Tag, Calculator, Info,
  FileText, PlusCircle, Layers, Ruler, ExternalLink, ArrowUpDown,
  Footprints, Scissors, Box, Droplets, Sparkles, Settings, CheckCircle2,
  AlertCircle, ChevronDown, ListFilter, Search, X, Copy, Factory
} from 'lucide-react';
import CalculatorModal from '../components/CalculatorModal';
import EngineeringEditor from '../components/EngineeringEditor';
import Modal from '../components/Modal';
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
  onSaveConfigItem?: (item: ProductionConfigItem) => Promise<void>;
  isDarkMode: boolean;
  sectors: Sector[];
  modulesConfig: AppModulesConfig;
  restrictedProductMode?: boolean;
  module?: 'SALES' | 'PRODUCTION';
}

export default function ProductFormView({ productId, products, grids, suppliers, categories, colors, productionConfigs, flowTags, onSave, onCancel, onSaveConfigItem, isDarkMode, sectors, modulesConfig, restrictedProductMode = false, module = 'SALES' }: ProductFormViewProps) {
  const existingProduct = useMemo(() => products.find(p => p.id === productId), [productId, products]);
  const productCategories = useMemo(() => categories.filter(c => c.type === CategoryType.PRODUCT), [categories]);
  const molds = useMemo(() => productionConfigs.filter(c => c.type === 'MOLD'), [productionConfigs]);
  const materials = useMemo(() => productionConfigs.filter(c => c.type === 'MATERIAL'), [productionConfigs]);
  const tools = useMemo(() => productionConfigs.filter(c => c.type === 'TOOL'), [productionConfigs]);

  const [name, setName] = useState(existingProduct?.name || '');
  const [reference, setReference] = useState(existingProduct?.reference || '');
  const [supplierId, setSupplierId] = useState(existingProduct?.supplierId || suppliers?.[0]?.id || '');
  const [categoryId, setCategoryId] = useState(existingProduct?.categoryId || productCategories?.[0]?.id || '');
  const formaGrids = useMemo(() => grids.filter(g => g.type === GridType.FORMA || !g.type), [grids]);

  const [defaultGridId, setDefaultGridId] = useState(existingProduct?.defaultGridId || formaGrids?.[0]?.id || grids?.[0]?.id || '');
  const [productionGridId, setProductionGridId] = useState(existingProduct?.productionGridId || formaGrids?.[0]?.id || grids?.[0]?.id || '');
  const [moldId, setMoldId] = useState(existingProduct?.moldId || '');
  const [soleMapping, setSoleMapping] = useState<{ [size: string]: string }>(existingProduct?.soleMapping || {});
  const [toolMapping, setToolMapping] = useState<{ [size: string]: string }>(existingProduct?.toolMapping || {});
  const [showSoleMapping, setShowSoleMapping] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [engineeringClipboard, setEngineeringClipboard] = useState<{
    consumptions: ComponentConsumption[];
    soleMapping: { [size: string]: string };
    sourceName: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('engineering_clipboard');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [showToolMapping, setShowToolMapping] = useState(false);
  const [type, setType] = useState<SaleType>(existingProduct?.type || SaleType.WHOLESALE);
  const [status, setStatus] = useState<ProductStatus>(existingProduct?.status || ProductStatus.ACTIVE);
  const [costPrice, setCostPrice] = useState<number | string>(existingProduct?.costPrice ?? 0);
  const [salePrice, setSalePrice] = useState<number | string>(existingProduct?.salePrice ?? 0);
  const [unitSalePrice, setUnitSalePrice] = useState<number | string>(existingProduct?.unitSalePrice ?? 0);
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
  const [productionRoute, setProductionRoute] = useState<string[]>(existingProduct?.productionRoute || []);
  const [sectorPrices, setSectorPrices] = useState<Record<string, number>>(existingProduct?.sectorPrices || {});
  const [photoUrl, setPhotoUrl] = useState<string>(existingProduct?.photoUrl || '');

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

  const toggleSectorInRoute = (sectorId: string) => {
    setProductionRoute(prev => {
      if (prev.includes(sectorId)) {
        setSectorPrices(p => { const n = { ...p }; delete n[sectorId]; return n; });
        return prev.filter(id => id !== sectorId);
      }
      if (prev.length >= 9) return prev;
      return [...prev, sectorId];
    });
  };

  const moveSectorInRoute = (index: number, direction: 'up' | 'down') => {
    const newRoute = [...productionRoute];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRoute.length) return;
    
    [newRoute[index], newRoute[targetIndex]] = [newRoute[targetIndex], newRoute[index]];
    setProductionRoute(newRoute);
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
      unitSalePrice: parseFloat(unitSalePrice as string) || 0,
      minStockInBoxes: parseInt(minStockInBoxes as string) || 0,
      priceAdjustmentDate: adjustmentDate ? new Date(adjustmentDate).getTime() : undefined,
      costPriceAdjustmentAmount: parseFloat(costPriceAdjustmentAmount as string) || 0,
      salePriceAdjustmentAmount: parseFloat(salePriceAdjustmentAmount as string) || 0,
      productionGridId: modulesConfig.production ? productionGridId : undefined,
      moldId: modulesConfig.production ? moldId : undefined,
      soleMapping: modulesConfig.production ? soleMapping : {},
      toolMapping: modulesConfig.production ? toolMapping : {},
      variations,
      productionRoute: modulesConfig.production ? productionRoute : undefined,
      sectorPrices: modulesConfig.production ? sectorPrices : undefined,
      photoUrl: photoUrl || undefined,
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

  const calculateConsumption = (tool: ProductionConfigItem, material: ProductionConfigItem, piecesPerPair: number = 2, localMapping?: { [size: string]: string }) => {
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
        const mappedSize = localMapping?.[size] || toolMapping?.[size] || size;
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
          newConsumptions[consumptionIdx].quantity = calculateConsumption(tool, material, pieces, current.toolMapping);
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
                  {modulesConfig.production && !restrictedProductMode && (
                    <button
                      onClick={() => setVarView('consumo')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${varView === 'consumo' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
                      Engenharia / Consumos
                    </button>
                  )}
                </div>
              </div>

              {varView === 'info' ? (
                <>
                  <div className="flex flex-col gap-6">
                    <div className={`p-6 rounded-[2rem] border flex flex-col gap-8 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Cor da Variante */}
                          <div className="flex flex-col gap-3">
                            <label htmlFor="variant-color-select" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Cor do Cabedal / Variante</label>
                            <div className="relative group">
                              <select
                                id="variant-color-select"
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
                          {modulesConfig.production && !restrictedProductMode && (
                            <div className="flex flex-col gap-3">
                              <label htmlFor="sole-color-select" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Cor do Solado (Matriz)</label>
                              <div className="relative group">
                                <select
                                  id="sole-color-select"
                                  className={`w-full appearance-none border-2 rounded-2xl px-6 py-4 pl-12 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                                  value={v.soleColorId || ''}
                                  onChange={(e) => updateVariation(activeVariationIndex, { soleColorId: e.target.value })}
                                >
                                  <option value="">Selecione a cor do solado…</option>
                                  {(() => {
                                    const selectedMold = molds.find(m => m.id === moldId);
                                    if (!selectedMold) return (
                                      <option disabled value="">Selecione uma matriz primeiro</option>
                                    );

                                    // Prioridade: colorVariations → colorIds → vazio
                                    const cvIds: string[] = selectedMold.metadata?.colorVariations?.map((cv: any) => cv.colorId).filter(Boolean) || [];
                                    const legacyIds: string[] = selectedMold.metadata?.colorIds || [];
                                    const allIds = cvIds.length > 0 ? cvIds : legacyIds;

                                    if (allIds.length === 0) return (
                                      <option disabled value="">Nenhuma cor cadastrada na matriz</option>
                                    );

                                    return colors
                                      .filter(c => allIds.includes(c.id))
                                      .map(c => (
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
                                <p className="text-[9px] text-amber-500 font-bold uppercase px-2">Nota: Esta matriz não possui cores vinculadas. Exibindo todas.</p>
                              )}
                            </div>
                          )}
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
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Valores por Tamanho</p>
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
                                  <label htmlFor={`sale-price-${size}`} className="text-[9px] font-black uppercase tracking-widest text-slate-400">Venda</label>
                                  <input
                                    id={`sale-price-${size}`}
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
                                  <label htmlFor={`stock-${size}`} className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estoque</label>
                                  <input
                                    id={`stock-${size}`}
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
                </>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Seção de Consumos */}
                  <div className="grid grid-cols-1 gap-6">
                    {/* Componentes do Cabedal (Peças de Corte) */}
                    <div className={`p-5 sm:p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Scissors size={24} />
                          </div>
                          <div>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Componentes do Cabedal</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Peças de Corte & Frequência</p>
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
                                     <div className="flex items-center gap-1.5 mt-0.5">
                                       <p className="text-[10px] font-bold text-slate-400 uppercase">{material?.name || '---'}</p>
                                       {item.colorId ? (
                                         <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                           <div 
                                             className="w-2 h-2 rounded-full border border-black/10" 
                                             style={{ backgroundColor: colors.find(c => c.id === item.colorId)?.hex || '#ccc' }}
                                           />
                                           <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500 dark:text-slate-400">
                                             {colors.find(c => c.id === item.colorId)?.name || 'Cor'}
                                           </span>
                                         </div>
                                       ) : (
                                         <span className="px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 text-[9px] font-black uppercase border border-rose-100 dark:border-rose-800">Falta Cor</span>
                                       )}
                                     </div>
                                   </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                     onClick={() => {
                                       setEditingConsumption(item);
                                       setConsumptionCategory('CUTTING_PIECE');
                                       setIsConsumptionModalOpen(true);
                                     }}
                                     title="Configurações"
                                     className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-colors"
                                   >
                                     <Settings size={16} />
                                   </button>
                                  <button
                                     onClick={() => {
                                       const newC = (v.consumptions || []).filter(c => c.id !== item.id);
                                       updateVariation(activeVariationIndex, { consumptions: newC });
                                     }}
                                     title="Excluir"
                                     className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors"
                                   >
                                     <Trash2 size={16} />
                                   </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-200/50 dark:border-slate-800/50">
                                <div className={`flex flex-col gap-1 transition-opacity ${item.ignoreQuantity ? 'opacity-30' : ''}`}>
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Peças/Pr</span>
                                  <span className="text-[14px] font-black">{item.ignoreQuantity ? '---' : (item.piecesPerPair || 2)}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Consumo</span>
                                  <span className="text-[14px] font-black text-indigo-600 dark:text-indigo-400">
                                    {item.quantity.toFixed(4).replace('.', ',')}
                                    <span className="text-[10px] ml-1">
                                      {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                                    </span>
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Faca</span>
                                  <span className="text-[12px] font-bold truncate max-w-[80px]">{tool?.name || '---'}</span>
                                </div>
                              </div>

                                <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-200/50 dark:border-slate-800/50">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Mat. R$</span>
                                  <span className="text-[14px] font-black">
                                    {(() => {
                                      const matBaseCost = material?.metadata?.baseCost;
                                      const unitVal = (item.unitValue && item.unitValue > 0) ? item.unitValue : ((material)?.metadata?.baseCost || 0);
                                      const result = item.quantity * unitVal;
                                      return result.toFixed(2).replace('.', ',');
                                    })()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Serv. R$</span>
                                  <span className="text-[14px] font-black text-emerald-600">
                                    {(item.services || []).reduce((acc, s) => acc + s.cost, 0).toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Total R$</span>
                                  <span className="text-[14px] font-black text-indigo-600 dark:text-indigo-400">
                                    {(() => {
                                      const matBaseCost = material?.metadata?.baseCost;
                                      const unitVal = (item.unitValue && item.unitValue > 0) ? item.unitValue : ((material)?.metadata?.baseCost || 0);
                                      const result = (item.quantity * unitVal) + (item.services || []).reduce((acc, s) => acc + s.cost, 0);
                                      return result.toFixed(2).replace('.', ',');
                                    })()}
                                  </span>
                                </div>
                              </div>

                              {item.services && item.services.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                                  {item.services.map(s => (
                                    <div key={s.serviceId} className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                                      {sectors.find(f => f.id === s.serviceId)?.name || 'Serviço'}
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
                              title={`Adicionar ${group.label}`}
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
                                    <div className="flex flex-col">
                                      <p className="text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate max-w-[120px]">{item.name || mat?.name}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {item.colorId ? (
                                          <div className="flex items-center gap-1 px-1 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                            <div 
                                              className="w-1.5 h-1.5 rounded-full border border-black/10" 
                                              style={{ backgroundColor: colors.find(c => c.id === item.colorId)?.hex || '#ccc' }}
                                            />
                                            <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500 dark:text-slate-400">
                                              {colors.find(c => c.id === item.colorId)?.name || 'Cor'}
                                            </span>
                                          </div>
                                        ) : !item.ignoreColor ? (
                                          <span className="px-1 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 text-[9px] font-black uppercase border border-rose-100 dark:border-rose-800">Falta Cor</span>
                                        ) : (
                                          <span className="px-1 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 text-[9px] font-black uppercase border border-indigo-100 dark:border-indigo-800">Sem Cor</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                       <button onClick={() => { setEditingConsumption(item); setConsumptionCategory(group.cat); setIsConsumptionModalOpen(true); }} title="Configurações do Item" className="p-1.5 text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"><Settings size={14} /></button>
                                       <button onClick={() => { const newC = (v.consumptions || []).filter(c => c.id !== item.id); updateVariation(activeVariationIndex, { consumptions: newC }); }} title="Excluir Item" className="p-1.5 text-rose-500 bg-rose-50 dark:bg-rose-900/30 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"><Trash2 size={14} /></button>
                                     </div>
                                  </div>
                                  <div className="flex flex-col pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Consumo:</span>
                                      <span className="text-[10px] font-black text-slate-900 dark:text-slate-200 uppercase">
                                        {item.consumptionBasis === 'grade'
                                          ? `${Math.round(item.quantity < 1 ? 1 : item.quantity)} /grade`
                                          : `${item.quantity.toFixed(4).replace('.', ',')} /par`
                                        } {productionConfigs.find(u => u.id === mat?.metadata?.unitId)?.name || 'UN'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Custo:</span>
                                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                                        R$ {(() => {
                                          const matBaseCost = mat?.metadata?.baseCost;
                                          const unitVal = (item.unitValue && item.unitValue > 0) ? item.unitValue : ((mat)?.metadata?.baseCost || 0);
                                          return (item.quantity * unitVal).toFixed(2).replace('.', ',');
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {(v.consumptions || []).filter(c => c.category === group.cat).length === 0 && (
                              <p className="text-[10px] text-slate-300 font-bold uppercase text-center py-4 italic">Nenhum item</p>
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
                              const mat = productionConfigs.find(c => c.id === item.materialId);
                              const unitVal = (item.unitValue && item.unitValue > 0) ? item.unitValue : ((mat)?.metadata?.baseCost || 0);
                              const matCost = (item.quantity * unitVal);
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

              <div className="grid grid-cols-2 gap-3 mt-8">
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
                  className={`bg-indigo-600/10 text-indigo-600 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all hover:bg-indigo-600 hover:text-white`}
                >
                  {activeVariationIndex === variations.length - 1 ? 'Voltar Lista' : 'Próxima Cor'} <ChevronRight size={14} />
                </button>
                <button
                  onClick={handleSave}
                  className={`bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center justify-center gap-2 transform transition-transform active:scale-95`}
                >
                  <Save size={14} /> Salvar Tudo
                </button>
              </div>
            </motion.div>
          ) : (
            <EngineeringEditor
              key="editor"
              isDarkMode={isDarkMode}
              consumption={editingConsumption!}
              onCancel={() => setIsConsumptionModalOpen(false)}
              productionConfigs={productionConfigs}
              colors={colors}
              sectors={sectors}
              grids={grids}
              productionGridId={productionGridId}
              defaultGridId={defaultGridId}
              toolMapping={toolMapping}
              activeVariationColor={activeVariationIndex !== null ? { 
                name: variations[activeVariationIndex].colorName, 
                hex: variations[activeVariationIndex].color 
              } : undefined}
              onSaveConfigItem={onSaveConfigItem}
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
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 pb-60 px-2 sm:px-4 pt-4 min-h-screen">
        <div className={`p-4 sm:p-6 rounded-[2rem] border flex flex-col gap-6 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>

          {/* Foto do produto */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group" title="Toque para adicionar foto do produto">
              <div className={`w-24 h-24 rounded-3xl overflow-hidden border-2 flex items-center justify-center transition-all ${photoUrl ? 'border-indigo-300 dark:border-indigo-600' : 'border-dashed border-slate-200 dark:border-slate-700'} ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                {photoUrl
                  ? <img src={photoUrl} alt="Foto do produto" className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-1">
                      <Camera size={28} className="text-slate-300 dark:text-slate-600" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Foto</span>
                    </div>
                }
              </div>
              {/* Botão de remover foto */}
              {photoUrl && (
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); setPhotoUrl(''); }}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600 transition-all"
                  title="Remover foto"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              )}
              {/* Overlay de câmera ao hover */}
              <div className="absolute inset-0 rounded-3xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={22} className="text-white" />
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const result = ev.target?.result as string;
                    // Resize to max 400px to keep base64 small
                    const img = new Image();
                    img.onload = () => {
                      const maxSide = 400;
                      const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
                      const canvas = document.createElement('canvas');
                      canvas.width  = img.width  * ratio;
                      canvas.height = img.height * ratio;
                      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                      setPhotoUrl(canvas.toDataURL('image/jpeg', 0.82));
                    };
                    img.src = result;
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {module === 'SALES' && (
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
          )}

          {module === 'SALES' && (
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status === ProductStatus.ACTIVE ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  <Toggle className={status === ProductStatus.ACTIVE ? '' : 'rotate-180'} size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">{status === ProductStatus.ACTIVE ? 'Em Uso' : 'Inativo'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Bloqueia compra/venda se inativo</p>
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
          )}

          <div className="space-y-6">
            {module === 'PRODUCTION' && (
              <div className="flex flex-col gap-1 mb-2 px-1">
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{name || 'Novo Modelo'}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reference || 'S/ Ref'}</p>
              </div>
            )}

            {module === 'SALES' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-1.5 block tracking-wider">Referência Interna</label>
                  <input
                    type="text"
                    placeholder="Ex: SNK-102"
                    className={`w-full border rounded-2xl px-5 py-4 text-xs font-bold transition-all outline-none focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50 text-white focus:ring-indigo-500/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:ring-indigo-500/5'}`}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-1.5 block tracking-wider">Nome do Modelo</label>
                  <input
                    type="text"
                    placeholder="Ex: Tênis Runner Air"
                    className={`w-full border rounded-2xl px-5 py-4 text-xs font-bold transition-all outline-none focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50 text-white focus:ring-indigo-500/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:ring-indigo-500/5'}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            )}


            {module === 'PRODUCTION' && (
              <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
                <label className="text-[10px] uppercase font-black text-slate-900 dark:text-white mb-4 block tracking-widest flex items-center gap-2">
                  <Factory size={14} className="text-indigo-500" /> Configurações de Produção
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block">Grade de Produção (Escalonamento)</label>
                    <div className="relative group">
                      <select
                        className={`w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-3 text-[10px] font-bold text-slate-900 dark:text-slate-100 pr-10 transition-all outline-none group-hover:border-indigo-500/30`}
                        value={productionGridId}
                        title="Grade de Produção"
                        onChange={(e) => setProductionGridId(e.target.value)}
                      >
                        <option value="">Selecione uma grade...</option>
                        {formaGrids.map(g => (
                          <option key={g.id} value={g.id}>{g.name} ({g.sizes.join('-')})</option>
                        ))}
                      </select>
                      <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 rotate-90" size={18} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block">Matriz de Solado (Base)</label>
                    <div className="relative group">
                      <ComboBox
                        options={[{ id: '', name: 'Nenhuma' }, ...molds.map(m => ({ id: m.id, name: m.name }))]}
                        value={moldId}
                        onChange={setMoldId}
                        placeholder="Selecionar solado..."
                        isDarkMode={isDarkMode}
                        icon={<Layers size={14} />}
                      />
                    </div>
                  </div>
                </div>

                {/* Mapeamento de Grade de Solados — Card dedicado */}
                <div className={`mt-6 rounded-[2rem] border-2 overflow-hidden ${isDarkMode ? 'border-emerald-500/20' : 'border-emerald-100'}`}>
                  <button
                    type="button"
                    onClick={() => setShowSoleMapping(true)}
                    className={`w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left transition-colors ${isDarkMode ? 'bg-slate-800/20 hover:bg-emerald-900/20' : 'bg-emerald-50/30 hover:bg-emerald-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                        <Footprints size={18} />
                      </div>
                      <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          Mapeamento de Solados por Numeração
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {Object.values(soleMapping).some(v => v)
                            ? `${Object.keys(soleMapping).filter(k => soleMapping[k]).length} numerações mapeadas · clique para editar`
                            : 'Vincule cada tamanho cabedal ao número da sola'}
                        </p>
                      </div>
                    </div>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                      <ChevronRight size={14} className="rotate-0" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {module === 'SALES' && (
              <div className={`p-5 sm:p-6 rounded-3xl border shadow-sm transition-all duration-500 ${saleTypes.includes(SaleType.WHOLESALE) ? 'bg-amber-50/40 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20 shadow-amber-100/20' : 'bg-indigo-50/40 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/20 shadow-indigo-100/20'}`}>
                <div className="flex items-center gap-4 mb-8">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform duration-500 ${saleTypes.includes(SaleType.WHOLESALE) ? 'bg-amber-500 rotate-3 text-white' : 'bg-indigo-500 -rotate-3 text-white'}`}>
                    {saleTypes.includes(SaleType.WHOLESALE) ? <Package size={24} strokeWidth={2.5} /> : <Tag size={24} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <h4 className={`text-[11px] font-black uppercase tracking-[0.2em] ${saleTypes.includes(SaleType.WHOLESALE) ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                      Configurações de {saleTypes.length > 1 ? 'Venda Híbrida' : saleTypes.includes(SaleType.WHOLESALE) ? 'Atacado' : 'Varejo'}
                    </h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                      {saleTypes.includes(SaleType.WHOLESALE) ? 'Precificação por grade fechada' : 'Precificação por par individual'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="group">
                    <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest leading-none group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
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
                    <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest leading-none group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
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

                  {type === SaleType.WHOLESALE && (
                    <div className="col-span-1 sm:col-span-2 group">
                      <label className="text-[10px] uppercase font-black text-sky-600 dark:text-sky-400 px-1 mb-2 block tracking-widest leading-none">
                        Venda Unitária por Par (R$)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          className={`w-full border-2 rounded-2xl px-6 py-4 pl-12 text-sm font-black transition-all outline-none focus:ring-0 ${isDarkMode ? 'bg-sky-900/10 border-sky-800 text-sky-300 focus:border-sky-500' : 'bg-sky-50 border-sky-200 text-sky-700 focus:border-sky-500'}`}
                          value={unitSalePrice}
                          aria-label="Preço unitário por par"
                          title="Preço de Venda por Par"
                          placeholder="0.00"
                          onChange={(e) => setUnitSalePrice(e.target.value)}
                        />
                        <DollarSign size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-400" />
                        <button
                          type="button"
                          onClick={() => setCalcModal({ isOpen: true, field: 'unitSalePrice', value: parseFloat(unitSalePrice as string) || 0 })}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600 p-2 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-xl transition-all"
                          aria-label="Abrir calculadora para o preço unitário por par"
                          title="Calculadora"
                        >
                          <Calculator size={16} />
                        </button>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 mt-1.5">
                        Usado no cálculo de embalagens menores no Pedido de Produção
                      </p>
                    </div>
                  )}

                  {saleTypes.includes(SaleType.RETAIL) && (
                    <div className="col-span-1 sm:col-span-2 p-5 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-indigo-100 dark:border-indigo-900/30">
                      <div className="flex items-center gap-3 mb-4">
                        <Info size={16} className="text-indigo-400" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Configuração de Volume (Varejo)</p>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest">Grade de Tamanhos Padrão</label>
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
                    <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest leading-none">
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
            )}

            {module === 'SALES' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block tracking-wider">Fornecedor Principal</label>
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
                    <label className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-200 px-1 mb-1 block tracking-wider">Categoria do Produto</label>
                    <ComboBox
                      options={[{ id: '', name: 'Nenhum' }, ...categories.filter(c => !c.isPersonal).map(c => ({ id: c.id, name: c.name }))]}
                      value={categoryId}
                      onChange={setCategoryId}
                      placeholder="Selecionar categoria..."
                      isDarkMode={isDarkMode}
                      icon={<Tag size={18} />}
                    />
                  </div>
                </div>

                {/* Seção de Agendamento de Reajuste */}
                <div className="p-5 sm:p-6 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Agendar Reajuste de Preço</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Programar alteração automática de valores</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest">Data da Aplicação</label>
                      <input
                        type="date"
                        title="Data de aplicação do ajuste de preço"
                        aria-label="Data de aplicação"
                        className={`w-full border-2 rounded-2xl px-5 py-4 text-xs font-black transition-all outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                        value={adjustmentDate}
                        onChange={(e) => setAdjustmentDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest">Ajuste Custo (R$)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          className={`w-full border-2 rounded-2xl px-5 py-4 pl-12 text-xs font-black transition-all outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-amber-500 focus:border-amber-500' : 'bg-white border-slate-100 text-amber-600 focus:border-amber-500'}`}
                          value={costPriceAdjustmentAmount}
                          placeholder="0.00"
                          onChange={(e) => setCostPriceAdjustmentAmount(e.target.value)}
                        />
                        <DollarSign size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-200 px-1 mb-2 block tracking-widest">Ajuste Venda (R$)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          className={`w-full border-2 rounded-2xl px-5 py-4 pl-12 text-xs font-black transition-all outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-emerald-500 focus:border-emerald-500' : 'bg-white border-slate-100 text-emerald-600 focus:border-emerald-500'}`}
                          value={salePriceAdjustmentAmount}
                          placeholder="0.00"
                          onChange={(e) => setSalePriceAdjustmentAmount(e.target.value)}
                        />
                        <DollarSign size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Roteiro de Produção */}
          {modulesConfig.production && !restrictedProductMode && (
            <div className={`mt-8 p-6 sm:p-8 rounded-[2.5rem] border-2 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Factory size={24} />
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Roteiro de Produção (Mapa de Setores)</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Defina a sequência de fabricação para este modelo (Máx. 9)</p>
                </div>
              </div>

              <div className="flex flex-col gap-8">
                {/* Setores Disponíveis */}
                <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Setores Disponíveis (Toque para adicionar)</label>
                  <div className="flex flex-wrap gap-2">
                    {sectors.map(sector => {
                      const isActive = productionRoute.includes(sector.id);
                      return (
                        <button
                          key={sector.id}
                          onClick={() => toggleSectorInRoute(sector.id)}
                          className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-95' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-indigo-300'}`}
                        >
                          {sector.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fluxo Ordenado */}
                <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Sequência de Produção</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {productionRoute.map((sectorId, index) => {
                      const sector = sectors.find(s => s.id === sectorId);
                      return (
                        <div
                          key={sectorId}
                          className={`p-4 rounded-2xl border-2 flex flex-col gap-3 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-indigo-500/50' : 'bg-slate-50/50 border-slate-100 shadow-sm hover:border-indigo-200'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400">
                                {index + 1}
                              </div>
                              <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">{sector?.name || '---'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveSectorInRoute(index, 'up')}
                                disabled={index === 0}
                                title="Mover para cima"
                                aria-label="Mover este setor para cima no fluxo de produção"
                                className="p-2 text-slate-400 hover:text-indigo-500 disabled:opacity-20"
                              >
                                <ChevronLeft size={16} className="rotate-90" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveSectorInRoute(index, 'down')}
                                disabled={index === productionRoute.length - 1}
                                title="Mover para baixo"
                                aria-label="Mover este setor para baixo no fluxo de produção"
                                className="p-2 text-slate-400 hover:text-indigo-500 disabled:opacity-20"
                              >
                                <ChevronDown size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleSectorInRoute(sectorId)}
                                title="Remover do Fluxo"
                                aria-label="Remover este setor do fluxo de produção"
                                className="p-2 text-rose-400 hover:text-rose-600 ml-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">R$/par</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={sector?.defaultServiceValue ? sector.defaultServiceValue.toFixed(2) : '0.00'}
                              value={sectorPrices[sectorId] ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                setSectorPrices(prev => {
                                  if (val === '' || val === null) { const n = { ...prev }; delete n[sectorId]; return n; }
                                  return { ...prev, [sectorId]: parseFloat(val) || 0 };
                                });
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-all outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {productionRoute.length === 0 && (
                      <div className="col-span-full py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nenhum roteiro definido. O lote seguirá a ordem padrão dos setores.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>



        {/* CARD DEDICADO PARA CORES E VARIAÇÕES */}
        <section className={`mt-6 p-4 sm:p-6 rounded-3xl border-2 shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Cores e Variações</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gerencie as combinações deste modelo</p>
            </div>
            <button
              onClick={addVariation}
              className="flex items-center justify-center gap-2 text-[10px] bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              aria-label="Adicionar nova variação de cor"
              title="Adicionar Cor"
            >
              <Plus size={16} strokeWidth={3} /> Adicionar Cor
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {variations.map((v, i) => (
              <div key={v.id} className={`group relative p-4 rounded-2xl border-2 flex flex-col gap-6 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-indigo-500/50' : 'bg-slate-50/50 border-slate-100 hover:border-indigo-200'}`}>
                {/* Header: Info + Delete Button */}
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isDarkMode ? 'bg-slate-900 text-indigo-400' : 'bg-white text-indigo-600'}`}>
                      <Package size={28} />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-base font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none mb-2">{v.colorName || 'Nova Variação'}</p>
                      <div className="flex flex-wrap gap-2">
                        {modulesConfig.production && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <Layers size={12} className="text-indigo-500" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              {(v.consumptions || []).length} Itens na Ficha
                            </span>
                          </div>
                        )}
                        {modulesConfig.production && Object.keys(v.soleMapping || {}).length > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <Footprints size={12} className="text-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Mapeado</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteVariation(i)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm ${isDarkMode ? 'bg-slate-900 text-rose-500 hover:bg-rose-900/20' : 'bg-white text-rose-500 hover:bg-rose-50 border border-slate-100'}`}
                    aria-label={`Excluir variação ${v.colorName}`}
                    title="Excluir Variação"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Actions: Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex flex-1 gap-3">
                    {/* Botão de Copiar (Aparece se houver conteúdo e produção ativa) */}
                    {modulesConfig.production && (v.consumptions || []).length > 0 && (
                      <button
                        onClick={() => {
                          const clip = {
                            consumptions: JSON.parse(JSON.stringify(v.consumptions || [])),
                            soleMapping: JSON.parse(JSON.stringify(v.soleMapping || {})),
                            sourceName: v.colorName
                          };
                          setEngineeringClipboard(clip);
                          try { localStorage.setItem('engineering_clipboard', JSON.stringify(clip)); } catch {}
                          setCopySuccess(`Engenharia de "${v.colorName}" COPIADA!`);
                          setTimeout(() => setCopySuccess(null), 2000);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400 hover:bg-indigo-900/40' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                        title="Copiar toda a engenharia desta cor"
                        aria-label={`Copiar engenharia da cor ${v.colorName}`}
                      >
                        <Copy size={14} /> Copiar
                      </button>
                    )}

                    {/* Botão de Colar — sempre disponível enquanto houver clipboard, inclusive para sobrescrever */}
                    {modulesConfig.production && engineeringClipboard && engineeringClipboard.sourceName !== v.colorName && (
                      <button
                        onClick={() => {
                          const hasExisting = (v.consumptions || []).length > 0;
                          if (hasExisting && !confirm(`Substituir a ficha atual de "${v.colorName}" pela de "${engineeringClipboard.sourceName}"?`)) return;
                          const newVariations = [...variations];
                          newVariations[i] = {
                            ...newVariations[i],
                            consumptions: JSON.parse(JSON.stringify(engineeringClipboard.consumptions)),
                            soleMapping: JSON.parse(JSON.stringify(engineeringClipboard.soleMapping))
                          };
                          setVariations(newVariations);
                          setCopySuccess(`Ficha de "${engineeringClipboard.sourceName}" colada em "${v.colorName}"!`);
                          setTimeout(() => setCopySuccess(null), 3000);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          (v.consumptions || []).length === 0
                            ? `animate-pulse ${isDarkMode ? 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`
                            : isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        title={`Colar ficha de ${engineeringClipboard.sourceName}`}
                        aria-label={`Colar engenharia de ${engineeringClipboard.sourceName} nesta variação`}
                      >
                        <Sparkles size={14} /> Colar de {engineeringClipboard.sourceName}
                      </button>
                    )}
                  </div>

                  {module === 'PRODUCTION' && (
                    <button
                      onClick={() => setActiveVariationIndex(i)}
                      className="sm:flex-[1.5] flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                      aria-label={`Editar ficha técnica ${v.colorName}`}
                      title="Editar Engenharia"
                    >
                      Editar Engenharia <ChevronRight size={16} />
                    </button>
                  )}
                  {module === 'SALES' && (
                    <button
                      onClick={() => setActiveVariationIndex(i)}
                      className="sm:flex-[1.5] flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                      aria-label={`Editar variação ${v.colorName}`}
                      title="Editar Cor"
                    >
                      Editar Cor <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {variations.length === 0 && (
              <div className={`text-center py-12 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Plus size={32} className="text-slate-300" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nenhuma cor adicionada</p>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={onCancel}
            title="Cancelar"
            aria-label="Cancelar edição e voltar"
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
            if (calcModal.field === 'unitSalePrice') setUnitSalePrice(res.toString());
            if (calcModal.field === 'costPriceAdjustmentAmount') setCostPriceAdjustmentAmount(res.toString());
            if (calcModal.field === 'salePriceAdjustmentAmount') setSalePriceAdjustmentAmount(res.toString());
            if (calcModal.field === 'quantity' && editingConsumption) {
              setEditingConsumption({ ...editingConsumption, quantity: res });
            }
          }}
        />
        <Modal
          isOpen={showSoleMapping}
          onClose={() => setShowSoleMapping(false)}
          title="Mapeamento de Solados"
          maxWidth="max-w-4xl"
        >
          {(() => {
            const cabedal = grids.find(g => g.id === productionGridId);
            const mold = molds.find(m => m.id === moldId);
            const moldSizes = mold?.metadata?.sizes || [];

            if (!cabedal?.sizes?.length) {
              return (
                <div className="text-center py-6 text-[10px] font-bold text-amber-500 uppercase tracking-widest border-2 border-dashed border-amber-100 dark:border-amber-900/30 rounded-2xl">
                  Selecione uma Grade de Produção primeiro.
                </div>
              );
            }

            if (!moldId) {
              return (
                <div className="text-center py-6 text-[10px] font-bold text-amber-500 uppercase tracking-widest border-2 border-dashed border-amber-100 dark:border-amber-900/30 rounded-2xl">
                  Selecione uma Matriz de Solado primeiro.
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-6">
                <div className={`flex items-center gap-3 p-4 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-emerald-50'}`}>
                  <Footprints size={16} className="text-emerald-500 shrink-0" />
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-relaxed">
                    Cruzando: <span className="text-slate-700 dark:text-slate-300 font-black">{cabedal.name}</span>
                    {' '}x <span className="text-emerald-600 dark:text-emerald-400 font-black">{mold?.name}</span>
                    {moldSizes.length === 0 && (
                      <span className="text-amber-500 font-black"> — Matriz sem grade definida, insira manualmente.</span>
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {cabedal.sizes.map(cabedalSize => (
                    <div key={cabedalSize} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 focus-within:border-emerald-500' : 'bg-white border-slate-100 shadow-sm focus-within:border-emerald-400'}`}>
                      <div className="text-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Cabedal</span>
                        <span className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{cabedalSize}</span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                        <ArrowUpDown size={14} />
                      </div>
                      <div className={`w-full rounded-xl border-2 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700 focus-within:border-emerald-500' : 'bg-emerald-50 border-emerald-100 focus-within:border-emerald-400'}`}>
                        <div className="flex items-center px-3 py-2 gap-1">
                          <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest shrink-0">Sola</span>
                          {moldSizes.length > 0 ? (
                            <select
                              value={soleMapping[cabedalSize] || ''}
                              onChange={(e) => setSoleMapping({ ...soleMapping, [cabedalSize]: e.target.value })}
                              className="w-full bg-transparent border-none text-right text-sm font-black text-slate-900 dark:text-white outline-none p-0 cursor-pointer appearance-none"
                              title={`Numeração da sola para o cabedal ${cabedalSize}`}
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
                              className="w-full bg-transparent border-none text-right text-sm font-black text-slate-900 dark:text-white outline-none p-0"
                              placeholder="Num."
                              title={`Numeração da sola para o cabedal ${cabedalSize}`}
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
        </Modal>

        <AnimatePresence>
          {copySuccess && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[30000] px-8 py-4 bg-emerald-600 text-white rounded-[2rem] shadow-2xl flex items-center gap-3 border-2 border-emerald-400/30 backdrop-blur-md"
            >
              <CheckCircle2 size={24} className="text-emerald-200" />
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest leading-none">Sucesso!</span>
                <span className="text-[10px] font-bold text-emerald-100 mt-1 uppercase tracking-wider">{copySuccess}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
