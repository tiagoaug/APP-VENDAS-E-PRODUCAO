import { useState, useMemo } from 'react';
import { ProductionConfigItem, ColorValue, WeighingRecord, SoleStockEntry } from '../types';
import { 
  Scale, ChevronLeft, Package, Calculator, Weight, ArrowLeft, X, Info, Palette, 
  ChevronDown, Save, Clock, Trash2, Warehouse, CheckCircle2, Plus, 
  Calculator as CalcIcon, DollarSign, Replace, PlusCircle 
} from 'lucide-react';
import CalculatorModal from '../components/CalculatorModal';
import { firebaseService } from '../services/firebaseService';

interface WeighingViewProps {
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  stockEntries: SoleStockEntry[];
  onBack: () => void;
  onNavigateToStock?: () => void;
  isDarkMode: boolean;
  existingRecords?: WeighingRecord[];
}

export default function WeighingView({ productionConfigs, colors, stockEntries, onBack, onNavigateToStock, isDarkMode, existingRecords = [] }: WeighingViewProps) {
  const molds = useMemo(() => productionConfigs.filter(c => c.type === 'MOLD'), [productionConfigs]);
  const [selectedMoldId, setSelectedMoldId] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColorId, setSelectedColorId] = useState<string>('');
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [records, setRecords] = useState<WeighingRecord[]>(existingRecords);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmStockRecord, setConfirmStockRecord] = useState<WeighingRecord | null>(null);
  const [editingStockCost, setEditingStockCost] = useState<number>(0);
  const [updateMode, setUpdateMode] = useState<'ADD' | 'OVERWRITE'>('ADD');
  const [showStockSuccess, setShowStockSuccess] = useState(false);
  const [pendingRecords, setPendingRecords] = useState<Omit<WeighingRecord, 'id'>[]>([]);
  const [accumulatedWeight, setAccumulatedWeight] = useState<string>('');
  const [isAccumulating, setIsAccumulating] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [accumulationHistory, setAccumulationHistory] = useState<string[]>([]);
  const [customUnitWeight, setCustomUnitWeight] = useState<string>('');

  const selectedMold = molds.find(m => m.id === selectedMoldId);
  
  const availableColors = useMemo(() => {
    if (!colors || colors.length === 0) return [];
    return colors.slice(0, 20);
  }, [colors]);

  const hasColorWeights = selectedMold && (Object.keys(selectedMold.metadata?.colorWeights || {}).length > 0 || Object.keys(selectedMold.metadata?.colorSizeWeights || {}).length > 0);
  const hasColorSizeWeights = selectedMold && selectedColorId && selectedMold.metadata?.colorSizeWeights?.[selectedColorId];
  
  const gridAverageWeight = useMemo(() => {
    if (!selectedMold) return 0;
    if (selectedMold.metadata?.averageWeight) return selectedMold.metadata.averageWeight;
    const weights = Object.values(selectedMold.metadata?.sizeWeights || {}).filter((w: any) => w > 0);
    if (weights.length > 0) return weights.reduce((a, b) => a + b, 0) / weights.length;
    return 0;
  }, [selectedMold]);

  const getBaseUnitWeight = (): number => {
    if (!selectedMold) return 0;
    
    let unitWeight = 0;

    if (selectedColorId && selectedSize && selectedSize !== 'MIXED' && hasColorSizeWeights) {
      unitWeight = selectedMold.metadata?.colorSizeWeights?.[selectedColorId]?.[selectedSize] || 0;
    }

    if (unitWeight <= 0 && selectedColorId && hasColorWeights) {
      unitWeight = selectedMold.metadata?.colorWeights?.[selectedColorId] || 0;
    }

    if (unitWeight <= 0) {
      if (selectedSize && selectedSize !== 'MIXED') {
        unitWeight = selectedMold.metadata?.sizeWeights?.[selectedSize] || gridAverageWeight || 0;
      } else if (selectedSize === 'MIXED') {
        const sizes = selectedMold.metadata?.sizes || [];
        const sizeWeights = selectedMold.metadata?.sizeWeights || {};
        const weights = sizes.map(s => sizeWeights[s]).filter(w => w > 0);
        if (weights.length > 0) {
          unitWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
        } else {
          unitWeight = gridAverageWeight || 0;
        }
      } else {
        unitWeight = gridAverageWeight || 0;
      }
    }

    return unitWeight;
  };

  const baseUnitWeight = getBaseUnitWeight();
  const unitWeight = customUnitWeight !== '' ? (parseFloat(customUnitWeight) || 0) : baseUnitWeight;

  const calculateQuantity = () => {
    if (!selectedMold || !weight) return 0;
    const weightKg = parseFloat(weight);
    if (isNaN(weightKg) || weightKg <= 0) return 0;
    if (unitWeight <= 0) return 0;
    return Math.floor((weightKg * 1000) / unitWeight);
  };

  const quantity = calculateQuantity();

  const availableSizes = selectedMold?.metadata?.sizes || [];
  const hasSizeWeights = selectedMold && Object.keys(selectedMold.metadata?.sizeWeights || {}).length > 0;
  const hasAverageWeight = !!selectedMold?.metadata?.averageWeight;

  const handleAddToPending = () => {
    if (!selectedMold || !weight || quantity <= 0) return;
    
    const colorName = selectedColorId ? colors.find(c => c.id === selectedColorId)?.name : undefined;
    const newRecord: Omit<WeighingRecord, 'id'> = {
      moldId: selectedMold.id,
      moldName: selectedMold.name,
      colorId: selectedColorId || undefined,
      colorName,
      size: selectedSize || undefined,
      weightKg: parseFloat(weight),
      quantity,
      unitWeight,
      date: Date.now()
    };
    
    setPendingRecords(prev => [...prev, newRecord]);
    setWeight('');
    setSelectedSize('');
    setAccumulatedWeight('');
    setAccumulationHistory([]);
    setIsAccumulating(false);
  };

  const handleAccumulateWeight = () => {
    if (!selectedMold || !weight || quantity <= 0) return;
    
    const currentWeight = parseFloat(accumulatedWeight) || 0;
    const addedWeight = parseFloat(weight);
    const newWeight = currentWeight + addedWeight;
    setAccumulatedWeight(newWeight.toFixed(3));
    setAccumulationHistory(prev => [...prev, `${addedWeight.toFixed(3)}kg`]);
    
    const newQuantity = Math.floor((newWeight * 1000) / unitWeight);
    setQuantityDisplay(newQuantity);
    setWeight('');
  };

  const setQuantityDisplay = (qty: number) => {
    const displayElement = document.getElementById('quantity-display');
    if (displayElement) {
      displayElement.textContent = qty.toString();
    }
  };

  const handleFinalizeAccumulated = () => {
    if (!selectedMold || !accumulatedWeight || parseFloat(accumulatedWeight) <= 0) return;
    
    const totalWeight = parseFloat(accumulatedWeight);
    const totalQuantity = Math.floor((totalWeight * 1000) / unitWeight);
    
    const colorName = selectedColorId ? colors.find(c => c.id === selectedColorId)?.name : undefined;
    const newRecord: Omit<WeighingRecord, 'id'> = {
      moldId: selectedMold.id,
      moldName: selectedMold.name,
      colorId: selectedColorId || undefined,
      colorName,
      size: selectedSize || undefined,
      weightKg: totalWeight,
      quantity: totalQuantity,
      unitWeight,
      date: Date.now()
    };
    
    setPendingRecords(prev => [...prev, newRecord]);
    setWeight('');
    setSelectedSize('');
    setAccumulatedWeight('');
    setAccumulationHistory([]);
    setIsAccumulating(false);
  };

  const handleCancelAccumulate = () => {
    setAccumulatedWeight('');
    setAccumulationHistory([]);
    setIsAccumulating(false);
  };

  const handleSaveAllRecords = async () => {
    if (pendingRecords.length === 0) return;
    
    setIsSaving(true);
    try {
      const savedRecords: WeighingRecord[] = [];
      for (const record of pendingRecords) {
        const id = await firebaseService.saveDocument('weighingRecords', record);
        savedRecords.push({ ...record, id } as WeighingRecord);
      }
      
      setRecords(prev => [...savedRecords, ...prev]);
      setPendingRecords([]);
      alert(`${savedRecords.length} pesagem(s) salva(s) com sucesso!`);
    } catch (err) {
      console.error('Erro ao salvar pesagens:', err);
      alert('Erro ao salvar pesagens');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePending = (index: number) => {
    setPendingRecords(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pesagem?')) return;
    
    try {
      await firebaseService.deleteDocument('weighingRecords', id);
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  const handleUpdateStock = (record: WeighingRecord) => {
    const mold = productionConfigs.find(m => m.id === record.moldId);
    setEditingStockCost(mold?.metadata?.unitCost || 0);
    setUpdateMode('ADD');
    setConfirmStockRecord(record);
  };

  const currentStockValue = useMemo(() => {
    if (!confirmStockRecord) return 0;
    const entries = stockEntries.filter(e => 
      e.moldId === confirmStockRecord.moldId && 
      e.colorId === (confirmStockRecord.colorId || '')
    );
    
    let total = 0;
    const sizeKey = confirmStockRecord.size || 'GERAL';
    entries.forEach(entry => {
      total += entry.stock[sizeKey] || 0;
    });
    return total;
  }, [stockEntries, confirmStockRecord]);

  const confirmUpdateStock = async () => {
    if (!confirmStockRecord) return;
    
    const record = confirmStockRecord;
    setConfirmStockRecord(null);
    
    const quantityToSave = updateMode === 'ADD' 
      ? record.quantity 
      : record.quantity - currentStockValue;

    if (quantityToSave === 0 && updateMode === 'OVERWRITE') {
      alert('O estoque já está com este valor.');
      setConfirmStockRecord(null);
      return;
    }
    
    try {
      const stockEntry: Omit<SoleStockEntry, 'id'> = {
        moldId: record.moldId,
        moldName: record.moldName,
        colorId: record.colorId || '',
        colorName: record.colorName || 'Sem Cor',
        supplierId: '',
        supplierName: '',
        stock: { [record.size || 'GERAL']: quantityToSave },
        totalPairs: quantityToSave,
        unitCost: editingStockCost,
        totalCost: quantityToSave * editingStockCost,
        purchaseDate: Date.now(),
        sourceRecordId: record.id,
        source: 'weighing',
        notes: updateMode === 'OVERWRITE' ? 'Ajuste via Balanço de Pesagem' : 'Entrada via Pesagem'
      };
      
      await firebaseService.saveDocument('soleStock', stockEntry);
      
      setShowStockSuccess(true);
      setTimeout(() => setShowStockSuccess(false), 2000);
      if (onNavigateToStock) onNavigateToStock();
    } catch (err) {
      console.error('Erro ao atualizar estoque:', err);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full pb-44 px-1 overflow-y-auto overflow-x-hidden force-scrollbar">
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={onBack}
          title="Voltar"
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className={`text-[13px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Pesagem e Contagem</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Conferência de solados por peso</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'new' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
              : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
          }`}
        >
          Nova Pesagem
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            activeTab === 'history' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
              : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <Clock size={14} /> Histórico
        </button>
      </div>

      {activeTab === 'new' && (
      <div className="space-y-6">
        <div className={`p-6 rounded-[2.5rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Scale size={24} />
            </div>
            <div>
              <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Selecione a Matriz
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                Escolha o solado para pesar
              </p>
            </div>
          </div>

          <div className="relative">
            <select
              value={selectedMoldId}
              onChange={(e) => {
                setSelectedMoldId(e.target.value);
                setSelectedSize('');
                setWeight('');
              }}
              className={`w-full appearance-none border-2 rounded-2xl px-6 py-4 pl-12 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
            >
              <option value="">Selecione uma matriz...</option>
              {molds.map(mold => {
                const hasWeights = mold.metadata?.averageWeight || Object.keys(mold.metadata?.sizeWeights || {}).length > 0 || Object.keys(mold.metadata?.colorWeights || {}).length > 0;
                return (
                  <option key={mold.id} value={mold.id} disabled={!hasWeights}>
                    {mold.name} {!hasWeights ? '(sem peso cadastrado)' : ''}
                  </option>
                );
              })}
            </select>
            <Package size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {selectedMold && (
          <>
            {availableColors.length > 0 && (
              <div className={`p-6 rounded-[2.5rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Palette size={24} />
                  </div>
                  <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Cor do Solado
                    </h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      {hasColorWeights ? 'Selecione para usar peso específico da cor' : 'Use para identificar a cor (sem peso específico)'}
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={selectedColorId}
                    onChange={(e) => setSelectedColorId(e.target.value)}
                    className={`w-full appearance-none border-2 rounded-2xl px-6 py-4 pl-12 text-sm font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-violet-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-violet-600'}`}
                  >
                    <option value="">Sem cor específica</option>
                    {availableColors.map(color => {
                      const colorSizeWeights = selectedMold?.metadata?.colorSizeWeights?.[color.id];
                      const hasSizeWeights = colorSizeWeights && Object.keys(colorSizeWeights).length > 0;
                      const hasColorWeight = selectedMold?.metadata?.colorWeights?.[color.id];
                      const weightInfo = hasSizeWeights 
                        ? `${Object.keys(colorSizeWeights).length} tam` 
                        : hasColorWeight 
                          ? `${hasColorWeight}g` 
                          : 's/peso';
                      return (
                        <option key={color.id} value={color.id}>
                          {color.name} ({weightInfo})
                        </option>
                      );
                    })}
                  </select>
                  <Palette size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {selectedColorId && hasColorWeights && (
                  <div className="mt-4 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-500/30">
                    <p className="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest text-center">
                      ✓ Peso específico por cor será usado
                    </p>
                  </div>
                )}
              </div>
            )}

            {hasSizeWeights && availableSizes.length > 0 && (
              <div className={`p-6 rounded-[2.5rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Calculator size={24} />
                  </div>
                  <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Tamanho Específico
                    </h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      Deixe vazio para cálculo médio
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(!isAccumulating || selectedSize === '') && (
                    <button
                      onClick={() => setSelectedSize('')}
                      disabled={isAccumulating}
                      className={`min-w-[70px] h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${
                        selectedSize === '' 
                          ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' 
                          : isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-slate-500 border border-slate-200 shadow-sm'
                      } ${isAccumulating ? 'opacity-100' : ''}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">Média</span>
                      {gridAverageWeight > 0 && <span className={`text-[8px] font-bold uppercase ${selectedSize === '' ? 'text-indigo-200' : 'text-slate-400'}`}>{gridAverageWeight.toFixed(1)}g</span>}
                    </button>
                  )}

                  {availableSizes.map(size => {
                    const sizeWeight = selectedMold.metadata?.sizeWeights?.[size];
                    const isVisible = !isAccumulating || selectedSize === size;
                    if (!isVisible) return null;

                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        disabled={!sizeWeight || isAccumulating}
                        className={`min-w-[70px] h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${
                          selectedSize === size 
                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 scale-105' 
                            : sizeWeight 
                              ? isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 shadow-sm'
                              : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                        } ${isAccumulating ? 'opacity-100' : ''}`}
                      >
                        <span className={`text-sm font-black ${selectedSize === size ? 'text-white' : isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{size}</span>
                        {sizeWeight && <span className={`text-[8px] font-bold uppercase ${selectedSize === size ? 'text-indigo-200' : 'text-slate-400'}`}>{sizeWeight}g</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={`p-6 rounded-[2.5rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Weight size={24} />
                </div>
                <div>
                  <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Peso do Montante
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    Digite o peso total em kg (lido na balança)
                  </p>
                </div>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0,000"
                  className={`w-full border-2 rounded-2xl px-6 py-4 pl-12 pr-24 text-2xl font-black transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-600'}`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-sm font-black text-slate-400 uppercase">kg</span>
                  <button
                    onClick={() => setShowCalculator(true)}
                    title="Abrir Calculadora de Peso"
                    className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    <CalcIcon size={18} />
                  </button>
                </div>
                <Weight size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-emerald-900/50 to-slate-900 border-emerald-500/30' : 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'}`}>
              <div className="text-center">
                <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  Quantidade de Pares
                </p>
                <p className={`text-7xl font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {quantity || '0'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
                  pares de solados
                </p>
              </div>
              
              {unitWeight > 0 && (
                <div className={`mt-6 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  {selectedColorId && selectedSize && selectedSize !== 'MIXED' && hasColorSizeWeights && (
                    <div className="flex justify-between items-center text-[10px] mb-2">
                      <span className="text-violet-400 font-bold uppercase">Peso cor+tam:</span>
                      <span className="text-violet-500 font-black">
                        {selectedMold.metadata?.colorSizeWeights?.[selectedColorId]?.[selectedSize]?.toFixed(2)}g
                      </span>
                    </div>
                  )}
                  {selectedColorId && hasColorWeights && !hasColorSizeWeights && (
                    <div className="flex justify-between items-center text-[10px] mb-2">
                      <span className="text-violet-400 font-bold uppercase">Peso por cor:</span>
                      <span className="text-violet-500 font-black">
                        {selectedMold.metadata?.colorWeights?.[selectedColorId]?.toFixed(2)}g
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-bold uppercase">Peso unitário:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={customUnitWeight}
                        placeholder={baseUnitWeight.toFixed(2)}
                        onChange={(e) => setCustomUnitWeight(e.target.value)}
                        className={`w-20 text-right font-black bg-transparent border-b ${isDarkMode ? 'border-emerald-500/30 text-emerald-400' : 'border-emerald-200 text-emerald-600'} outline-none focus:border-emerald-500 transition-colors`}
                      />
                      <span className="text-emerald-500 font-black">g</span>
                      {customUnitWeight && (
                        <button 
                          onClick={() => setCustomUnitWeight('')}
                          className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                          title="Restaurar peso original"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedSize === 'MIXED' && hasSizeWeights && !selectedColorId && (
                    <div className="flex justify-between items-center text-[10px] mt-2">
                      <span className="text-slate-400 font-bold uppercase">Média calculada:</span>
                      <span className="text-emerald-500 font-black">
                        {(Object.values(selectedMold.metadata?.sizeWeights || {}).reduce((a, b) => a + b, 0) / Object.keys(selectedMold.metadata?.sizeWeights || {}).length).toFixed(2)}g
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleAddToPending}
                  disabled={!selectedMold || !weight || quantity <= 0}
                  title="Adicionar pesagem à lista"
                  aria-label="Adicionar pesagem atual à lista de registros pendentes"
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    selectedMold && weight && quantity > 0
                      ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-500/20' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Plus size={16} />
                  Adicionar
                </button>
                <button
                  onClick={() => setIsAccumulating(true)}
                  disabled={!selectedMold || !weight || quantity <= 0}
                  title="Iniciar modo de acúmulo de peso"
                  aria-label="Iniciar modo de acúmulo de peso para somar várias pesagens"
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    selectedMold && weight && quantity > 0
                      ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-500/20' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Calculator size={16} />
                  Acumular
                </button>
              </div>

              {isAccumulating && (
                <div className={`p-4 rounded-2xl border-2 border-amber-500 ${isDarkMode ? 'bg-slate-900' : 'bg-amber-50'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-amber-600 uppercase">
                      Acumulando pesos
                    </p>
                    <button 
                      onClick={handleCancelAccumulate} 
                      title="Cancelar acúmulo"
                      aria-label="Cancelar modo de acúmulo e limpar pesos"
                      className="text-slate-400 p-1 hover:text-slate-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">
                    Peso acumulado: <span className="font-black text-amber-600">{accumulatedWeight || '0'} kg</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-3">
                    Total de pares: <span className="text-amber-600 font-black">{Math.floor((parseFloat(accumulatedWeight || '0') * 1000) / unitWeight) || 0}</span>
                  </p>
                  
                  {accumulationHistory.length > 0 && (
                    <div className={`mb-4 p-3 rounded-xl border border-dashed ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Histórico de Acúmulo</p>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {accumulationHistory.map((w, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{w}</span>
                            {i < accumulationHistory.length - 1 && <Plus size={8} className="text-slate-400" />}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleAccumulateWeight}
                    disabled={!weight || quantity <= 0}
                    title="Somar peso atual ao acumulado"
                    aria-label="Somar peso atual ao total acumulado"
                    className="w-full py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase mb-2 shadow-sm active:scale-95 transition-all"
                  >
                    + Adicionar peso atual ({weight || 0} kg)
                  </button>
                  <button
                    onClick={handleFinalizeAccumulated}
                    disabled={!accumulatedWeight || parseFloat(accumulatedWeight) <= 0}
                    className="w-full py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase"
                  >
                    Finalizar e adicionar à lista
                  </button>
                </div>
              )}

              {pendingRecords.length > 0 && (
                <div className={`mt-4 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase">
                      {pendingRecords.length} pesagem(s) pendente(s)
                    </p>
                    <button
                      onClick={handleSaveAllRecords}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Todas'}
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                    {pendingRecords.map((record, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-3 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-emerald-500">{record.moldName}</p>
                          <p className="text-[11px] font-black text-slate-800 dark:text-white">
                            <span className="text-indigo-500">{record.quantity}</span> pares
                          </p>
                          <div className="flex items-center gap-1.5 text-[8px] text-slate-400 mt-0.5">
                            <span className="font-bold">{record.weightKg.toFixed(3)}kg</span>
                            {record.colorName && (
                              <>
                                <span>•</span>
                                <span className="text-violet-500 font-bold uppercase">{record.colorName}</span>
                              </>
                            )}
                            {record.size && (
                              <>
                                <span>•</span>
                                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-black text-[9px]">
                                  {record.size}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePending(idx)}
                          title="Remover da lista"
                          aria-label={`Remover pesagem de ${record.moldName} da lista pendente`}
                          className="p-2 text-red-400 hover:text-red-500 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      )}

      {activeTab === 'history' && (
        <div className="flex flex-col gap-4">
          <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border`}>
            <h3 className={`text-[11px] font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Histórico de Pesagens
            </h3>
            
            {records.length === 0 ? (
              <div className="text-center py-8">
                <Scale size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Nenhuma pesagem registrada
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
                {records.map(record => (
                  <div key={record.id} className={`p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {record.moldName}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          {formatDate(record.date)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {record.size && record.size !== 'MIXED' && (
                          <button
                            onClick={() => handleUpdateStock(record)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                          >
                            <Warehouse size={10} /> Atualizar Estoque
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          title="Excluir Registro de Pesagem"
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Peso</p>
                        <p className="text-sm font-black text-emerald-500">{record.weightKg.toFixed(3)}kg</p>
                      </div>
                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Pares</p>
                        <p className="text-sm font-black text-indigo-500">{record.quantity}</p>
                      </div>
                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Unit.</p>
                        <p className="text-sm font-black text-violet-500">{record.unitWeight.toFixed(1)}g</p>
                      </div>
                    </div>
                    
                    {(record.colorName || record.size) && (
                      <div className="mt-2 flex gap-2">
                        {record.colorName && (
                          <span className="px-2 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-[8px] font-black text-violet-600 dark:text-violet-400 uppercase">
                            {record.colorName}
                          </span>
                        )}
                        {record.size && (
                          <span className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase border border-amber-200 dark:border-amber-500/30">
                            TAM {record.size}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmStockRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmStockRecord(null)}>
          <div className={`p-8 rounded-[3rem] shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300 w-full max-w-sm ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 mb-4">
              <Warehouse size={32} />
            </div>
            <p className={`text-lg font-black uppercase tracking-widest text-center ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Atualizar Estoque?
            </p>
            <p className={`text-sm font-bold text-center mt-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {confirmStockRecord.quantity} pares de <span className="text-emerald-500">{confirmStockRecord.moldName}</span>
              {confirmStockRecord.size && <><br/>Tamanho: <span className="text-violet-500">{confirmStockRecord.size}</span></>}
              {confirmStockRecord.colorName && <><br/>Cor: <span className="text-violet-500">{confirmStockRecord.colorName}</span></>}
            </p>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-full mt-6">
              <button
                onClick={() => setUpdateMode('ADD')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${updateMode === 'ADD' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
              >
                <PlusCircle size={14} /> Somar
              </button>
              <button
                onClick={() => setUpdateMode('OVERWRITE')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${updateMode === 'OVERWRITE' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400'}`}
              >
                <Replace size={14} /> Substituir
              </button>
            </div>

            <div className={`mt-4 w-full p-4 rounded-2xl border-2 border-dashed ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Estoque Atual</span>
                <span className="text-sm font-black text-slate-500">{currentStockValue} pares</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Novo Total</span>
                <span className={`text-sm font-black ${updateMode === 'OVERWRITE' ? 'text-amber-500' : 'text-indigo-500'}`}>
                  {updateMode === 'ADD' ? currentStockValue + confirmStockRecord.quantity : confirmStockRecord.quantity} pares
                </span>
              </div>
            </div>

            <div className="mt-6 w-full space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Custo por Par (R$)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingStockCost || ''}
                  onChange={(e) => setEditingStockCost(parseFloat(e.target.value) || 0)}
                  className={`w-full border-2 rounded-2xl px-5 py-4 pl-12 text-sm font-black outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-emerald-600'}`}
                  placeholder="0,00"
                />
                <DollarSign size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6 w-full">
              <button
                onClick={() => setConfirmStockRecord(null)}
                className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmUpdateStock}
                className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showStockSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`p-8 rounded-[3rem] shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 size={32} />
            </div>
            <p className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Estoque Atualizado!
            </p>
          </div>
        </div>
      )}

      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowInfo(false)}>
          <div 
            className={`w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
              <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Como Usar</h2>
              <button 
                onClick={() => setShowInfo(false)} 
                className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black shrink-0">1</div>
                <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Selecione a matriz de solado que deseja pesar
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-black shrink-0">2</div>
                <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Digite o peso total do montante em gramas
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs font-black shrink-0">3</div>
                <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  O sistema calculará automaticamente a quantidade de pares
                </p>
              </div>
              <div className={`mt-4 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Observação</p>
                <p className="text-[10px] text-slate-500">
                  Para resultados precisos, cadastre os pesos por numeração nas configurações da matriz de solado.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCalculator && (
        <CalculatorModal
          isOpen={showCalculator}
          onClose={() => setShowCalculator(false)}
          onResult={(val: number) => {
            setWeight(val.toString());
            setShowCalculator(false);
          }}
          initialValue={parseFloat(weight) || 0}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

