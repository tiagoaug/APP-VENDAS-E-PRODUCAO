import { useState, useMemo, useEffect } from 'react';
import { ProductionConfigItem, ColorValue, Person, SolePurchaseItem, PurchaseType } from '../types';
import { 
  ArrowLeft, Plus, Trash2, ShoppingCart, Package, Palette, 
  ChevronDown, Save, X, DollarSign, Calculator, CheckCircle2
} from 'lucide-react';
import { firebaseService } from '../services/firebaseService';

interface SolePurchaseViewProps {
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  people: Person[];
  accounts: { id: string; name: string; balance: number }[];
  onBack: () => void;
  onNavigateToStock?: () => void;
  isDarkMode: boolean;
  initialParams?: any;
}

export default function SolePurchaseView(props: SolePurchaseViewProps) {
  const { productionConfigs, colors, people, accounts, onBack, onNavigateToStock, isDarkMode, initialParams } = props;
  const molds = useMemo(() => productionConfigs.filter(c => c.type === 'MOLD'), [productionConfigs]);
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [items, setItems] = useState<SolePurchaseItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const suppliers = useMemo(() => {
    const supplierIds = new Set(molds.map(m => m.metadata?.supplierId).filter(Boolean));
    return people.filter(p => p.isSupplier && supplierIds.has(p.id));
  }, [molds, people]);

  const availableMolds = useMemo(() => {
    if (!selectedSupplierId) return [];
    const supplierMolds = molds.filter(m => m.metadata?.supplierId === selectedSupplierId);
    
    // Always include the requested mold in available options if it exists
    if (initialParams?.moldId) {
      const requestedMold = molds.find(m => m.id === initialParams.moldId || m.name === initialParams.moldId);
      if (requestedMold && !supplierMolds.find(m => m.id === requestedMold.id)) {
        return [...supplierMolds, requestedMold];
      }
    }
    return supplierMolds;
  }, [molds, selectedSupplierId, initialParams]);

  const addItem = (moldId: string, existingColorId?: string) => {
    const mold = molds.find(m => m.id === moldId);
    if (!mold) return;
    
    const availableColors = colors.slice(0, 10).map(c => ({
      colorId: c.id,
      colorName: c.name,
      colorHex: c.hex
    }));

    const usedColorIds = items.filter(i => i.moldId === moldId).map(i => i.colorId);
    const nextAvailableColor = availableColors.find(c => !usedColorIds.includes(c.colorId));

    const defaultUnitCost = mold.metadata?.unitCost || 0;

    const resolvedColor = existingColorId 
      ? (colors.find(c => c.id === existingColorId || c.name.toLowerCase() === String(existingColorId).toLowerCase()) || colors[0])
      : (nextAvailableColor ? colors.find(c => c.id === nextAvailableColor.colorId) : colors[0]);

    // Pre-fill quantities if this matches the initial request (checking both ID and Name)
    const isRequestedMold = initialParams?.moldId && 
      (initialParams.moldId === mold.id || initialParams.moldId === mold.name);
    
    const initialQuantities = isRequestedMold ? (initialParams.initialGrid || {}) : {};

    setItems(prev => [...prev, {
      moldId: mold.id,
      moldName: mold.name,
      colorId: resolvedColor?.id || '',
      colorName: resolvedColor?.name || '',
      quantities: initialQuantities,
      unitCost: defaultUnitCost,
      totalCost: Object.values(initialQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0) * defaultUnitCost
    }]);
  };

  const addColorToMold = (moldId: string) => {
    addItem(moldId);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<SolePurchaseItem>) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      let newItem = { ...item, ...updates };
      
      if (updates.moldId) {
        const mold = molds.find(m => m.id === updates.moldId);
        if (mold) {
          newItem.moldName = mold.name;
          if (newItem.unitCost === 0 || newItem.unitCost === item.unitCost) {
            newItem.unitCost = mold.metadata?.unitCost || 0;
          }
          // Se mudou para o molde inicial da solicitação, preenche a grade automaticamente
          if (initialParams?.moldId === updates.moldId && initialParams.initialGrid) {
            newItem.quantities = initialParams.initialGrid;
            const totalPairs = Object.values(newItem.quantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            newItem.totalCost = totalPairs * newItem.unitCost;
          }
        }
      }
      
      if (updates.quantities) {
        const totalPairs = Object.values(newItem.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        newItem.totalCost = totalPairs * newItem.unitCost;
      }
      if (updates.unitCost !== undefined) {
        const totalPairs = Object.values(newItem.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        newItem.totalCost = totalPairs * newItem.unitCost;
      }
      return newItem;
    }));
  };

  // Pre-filling and auto-add logic from initialParams
  useEffect(() => {
    if (!initialParams?.moldId || items.length > 0) return;

    const mold = molds.find(m => m.id === initialParams.moldId || m.name === initialParams.moldId);
    if (!mold) return;

    const supplierId = mold.metadata?.supplierId;
    
    // Auto-select supplier if mold has one
    if (supplierId && !selectedSupplierId) {
      setSelectedSupplierId(supplierId);
      return; // Wait for next effect cycle after state update
    }

    // If a supplier is selected, auto-add the item
    if (selectedSupplierId) {
      addItem(mold.id, initialParams.colorId);
    }
  }, [initialParams, selectedSupplierId, molds, colors]);

  const totalGeral = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalCost, 0);
  }, [items]);

  const handleSave = async () => {
    const itemsWithQuantity = items.filter(item => {
      const qtyValues = Object.values(item.quantities || {}).map(v => Number(v) || 0);
      return qtyValues.some(q => q > 0);
    });

    if (!selectedSupplierId || itemsWithQuantity.length === 0) {
      alert('Adicione pelo menos uma quantidade em algum item');
      return;
    }

    setIsSaving(true);
    try {
      const supplier = people.find(p => p.id === selectedSupplierId);
      
      const purchase: any = {
        id: `PUR-${Date.now()}`,
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'Fornecedor',
        date: Date.now(),
        type: PurchaseType.GENERAL,
        status: 'COMPLETED',
        soleItems: itemsWithQuantity.map((item: any) => ({
          ...item,
          totalPairs: Object.values(item.quantities || {}).reduce((a: any, b: any) => a + (Number(b) || 0), 0)
        })),
        total: totalGeral,
        notes: notes || undefined,
        paymentStatus: 'PAID'
      };

      console.log('Salvando compra:', purchase);
      await firebaseService.saveDocument('solePurchases', purchase);
      console.log('Compra salva com sucesso');
      
      let stockEntriesCount = 0;
      for (const item of purchase.soleItems) {
        const sizes = Object.keys(item.quantities || {}).filter(s => Number(item.quantities[s]) > 0);
        console.log('Item:', item.moldName, 'Tamanhos com quantidade:', sizes);
        
        for (const size of sizes) {
          const qty = Number(item.quantities[size]) || 0;
          if (qty <= 0) continue;
          
          const stockEntry = {
            moldId: item.moldId,
            moldName: item.moldName,
            colorId: item.colorId,
            colorName: item.colorName,
            supplierId: selectedSupplierId,
            supplierName: supplier?.name || '',
            stock: { [size]: qty },
            totalPairs: qty,
            unitCost: item.unitCost || 0,
            totalCost: qty * (item.unitCost || 0),
            purchaseDate: Date.now(),
            updatedAt: Date.now()
          };
          
          console.log('Salvando stock entry:', stockEntry);
          await firebaseService.saveDocument('soleStock', stockEntry);
          stockEntriesCount++;
        }
      }
      
      console.log('Total de entradas de estoque salvas:', stockEntriesCount);

      if (initialParams?.requestId) {
        await firebaseService.updateDocument('purchaseRequests', initialParams.requestId, {
          status: 'IN_PROGRESS',
          updatedAt: Date.now()
        });
      }

      setShowSuccess(true);

    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar compra: ' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full pb-44 px-1 overflow-y-auto overflow-x-hidden force-scrollbar">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className={`text-[13px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Entrada de Solados</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Compra de solados por fornecedor</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Form Context Info */}
        {initialParams?.moldId && items.length === 0 && (
          <div className={`p-5 rounded-[2rem] border-2 border-dashed flex items-center gap-5 ${
            isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'
          }`}>
            <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
              <ShoppingCart size={28} />
            </div>
            <div>
              <h3 className="font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-xs mb-1">Solicitação de Compra Pendente</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-snug">
                Pedido de <strong>{initialParams.description || 'solados'}</strong> identificado. 
                {!selectedSupplierId ? ' Por favor, selecione o fornecedor para carregar os dados automaticamente.' : ' O item foi adicionado com sucesso!'}
              </p>
            </div>
          </div>
        )}

        <div className={`p-6 rounded-[2.5rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Fornecedor
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                Selecione o fornecedor dos solados
              </p>
            </div>
          </div>

          <div className="relative">
            <select
              value={selectedSupplierId}
              onChange={(e) => {
                setSelectedSupplierId(e.target.value);
                setItems([]);
              }}
              className={`w-full appearance-none border-2 rounded-2xl px-6 py-4 pl-12 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-cyan-600'}`}
            >
              <option value="">Selecione um fornecedor...</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <Package size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {suppliers.length === 0 && (
            <p className="text-[10px] text-amber-500 font-bold uppercase mt-3">
              Nenhum fornecedor encontrado para solados. Cadastre o fornecedor na matriz de solado.
            </p>
          )}
        </div>

        {selectedSupplierId && (
          <>
            <div className="flex justify-between items-center">
              <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Itens da Compra
              </h3>
              <button
                onClick={() => {
                  const usedMoldColorCombos = items.map(i => `${i.moldId}-${i.colorId}`);
                  for (const mold of availableMolds) {
                    const availableColors = colors.slice(0, 10);
                    for (const color of availableColors) {
                      const combo = `${mold.id}-${color.id}`;
                      if (!usedMoldColorCombos.includes(combo)) {
                        addItem(mold.id, color.id);
                        return;
                      }
                    }
                  }
                }}
                disabled={items.length >= availableMolds.length * Math.min(10, colors.length)}
                className={`py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                  items.length >= availableMolds.length * Math.min(10, colors.length)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-cyan-600 text-white hover:bg-cyan-700'
                }`}
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {items.length === 0 ? (
                <div className={`p-8 rounded-3xl text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border`}>
                  <Package size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    Adicione modelos de solado
                  </p>
                </div>
              ) : (
                items.map((item, index) => {
                  const mold = molds.find(m => m.id === item.moldId);
                  const sizes = mold?.metadata?.sizes || [];
                  const totalPairs = Object.values(item.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

                  return (
                    <div key={index} className={`p-5 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <select
                            value={item.moldId}
                            onChange={(e) => updateItem(index, { moldId: e.target.value, moldName: molds.find(m => m.id === e.target.value)?.name || '' })}
                            className={`w-full appearance-none border-2 rounded-xl px-4 py-2 text-xs font-black transition-all outline-none mb-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                          >
                            {availableMolds.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          
                          <div className="flex items-center gap-2">
                            <Palette size={14} className="text-violet-500" />
                            <select
                              value={item.colorId}
                              onChange={(e) => {
                                const color = colors.find(c => c.id === e.target.value);
                                updateItem(index, { colorId: e.target.value, colorName: color?.name || '' });
                              }}
                              className={`flex-1 appearance-none border-2 rounded-xl px-3 py-2 text-xs font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                            >
                              {colors.slice(0, 10).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => addColorToMold(item.moldId)}
                            title="Adicionar outra cor"
                            className="p-2 rounded-xl text-cyan-500 hover:text-cyan-400 transition-colors"
                          >
                            <Plus size={18} />
                          </button>
                          <button
                            onClick={() => removeItem(index)}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      {sizes.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Quantidade por Tamanho</p>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {sizes.map(size => (
                              <div key={size} className="flex flex-col gap-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase text-center">{size}</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.quantities[size] || ''}
                                  onChange={(e) => updateItem(index, { 
                                    quantities: { ...item.quantities, [size]: parseInt(e.target.value) || 0 } 
                                  })}
                                  className={`px-2 py-2 rounded-lg font-black text-xs text-center outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                  placeholder="0"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Custo por Par (R$)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitCost || ''}
                              onChange={(e) => updateItem(index, { unitCost: parseFloat(e.target.value) || 0 })}
                              className={`w-full border-2 rounded-xl px-4 py-3 pl-10 text-sm font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                              placeholder={mold?.metadata?.unitCost ? mold.metadata.unitCost.toFixed(2) : "0,00"}
                            />
                            <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>
                        <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <p className="text-[8px] font-black text-slate-400 uppercase">Total</p>
                          <p className="text-lg font-black text-emerald-500">R$ {item.totalCost.toFixed(2)}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{totalPairs} pares</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={`p-5 rounded-[2rem] border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione observações sobre esta compra..."
                className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none resize-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                rows={3}
              />
            </div>

            <div className={`p-6 rounded-[3rem] border-2 shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-cyan-900/50 to-slate-900 border-cyan-500/30' : 'bg-gradient-to-br from-cyan-50 to-white border-cyan-200'}`}>
              <div className="flex justify-between items-center mb-4">
                <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  Total da Compra
                </p>
                <p className="text-3xl font-black text-emerald-500">
                  R$ {totalGeral.toFixed(2)}
                </p>
              </div>
              
              <button
                onClick={handleSave}
                disabled={!selectedSupplierId || items.length === 0 || totalGeral <= 0 || isSaving}
                className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  selectedSupplierId && items.length > 0 && totalGeral > 0 && !isSaving
                    ? 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-lg shadow-cyan-500/20' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <Save size={18} />
                {isSaving ? 'Salvando...' : 'Confirmar Entrada'}
              </button>
            </div>
          </>
        )}
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => {
          setShowSuccess(false);
          setItems([]);
          setNotes('');
          setSelectedSupplierId('');
        }}>
          <div className={`p-8 rounded-[3rem] shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 size={40} />
            </div>
            <p className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Compra Salva!
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 mb-6">
              Estoque atualizado automaticamente
            </p>
            
            <div className="flex flex-col gap-3 w-full">
              {onNavigateToStock && (
                <button
                  onClick={() => {
                    setShowSuccess(false);
                    setItems([]);
                    setNotes('');
                    setSelectedSupplierId('');
                    onNavigateToStock();
                  }}
                  className="w-full py-3 px-6 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700"
                >
                  <Package size={16} /> Ver Estoque de Solados
                </button>
              )}
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setItems([]);
                  setNotes('');
                  setSelectedSupplierId('');
                }}
                className="w-full py-3 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Plus size={16} /> Nova Entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

