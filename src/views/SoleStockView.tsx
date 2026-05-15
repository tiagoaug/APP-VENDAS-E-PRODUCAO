import { useState, useMemo } from 'react';
import { ProductionConfigItem, ColorValue, SoleStockEntry } from '../types';
import { 
  ArrowLeft, Package, Palette, Scale, Plus, Trash2, Save, 
  ChevronDown, Search, Edit2, CheckCircle2, X, Calculator, Tag
} from 'lucide-react';
import { firebaseService } from '../services/firebaseService';
import PrintSoleLabelModal from '../components/PrintSoleLabelModal';

interface SoleStockViewProps {
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  stockEntries: SoleStockEntry[];
  onBack: () => void;
  onNavigateToWeighing?: () => void;
  isDarkMode: boolean;
}

export default function SoleStockView({ 
  productionConfigs, colors, stockEntries, onBack, onNavigateToWeighing, isDarkMode 
}: SoleStockViewProps) {
  const molds = useMemo(() => productionConfigs.filter(c => c.type === 'MOLD'), [productionConfigs]);
  
  const [search, setSearch] = useState('');
  const [selectedMoldId, setSelectedMoldId] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<SoleStockEntry | null>(null);
  const [isBalanceMode, setIsBalanceMode] = useState(false);
  const [balanceData, setBalanceData] = useState<Record<string, Record<string, number>>>({});
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<any>(null);

  const aggregatedStock = useMemo(() => {
    const stock: Record<string, { moldId: string; moldName: string; colorId: string; colorName: string; sizes: Record<string, number>; total: number }> = {};
    
    stockEntries.forEach(entry => {
      const key = `${entry.moldId}-${entry.colorId}`;
      if (!stock[key]) {
        stock[key] = {
          moldId: entry.moldId,
          moldName: entry.moldName,
          colorId: entry.colorId,
          colorName: entry.colorName,
          sizes: {},
          total: 0
        };
      }
      
      Object.entries(entry.stock || {}).forEach(([size, qty]) => {
        if (size === 'pesagem' || size === 'GERAL' || size === 'MIXED') return;
        stock[key].sizes[size] = (stock[key].sizes[size] || 0) + qty;
        stock[key].total += qty;
      });
    });
    
    return Object.values(stock);
  }, [stockEntries]);

  const filteredStock = useMemo(() => {
    if (isBalanceMode && selectedMoldId) {
      const mold = molds.find(m => m.id === selectedMoldId);
      if (!mold) return [];
      
      return colors.map(color => {
        const existing = aggregatedStock.find(s => s.moldId === selectedMoldId && s.colorId === color.id);
        return existing || {
          moldId: selectedMoldId,
          moldName: mold.name,
          colorId: color.id,
          colorName: color.name,
          sizes: {},
          total: 0
        };
      }).filter(item => {
        // Still allow searching within the colors of the mold
        return !search || item.colorName.toLowerCase().includes(search.toLowerCase());
      });
    }

    return aggregatedStock.filter(item => {
      const matchesSearch = !search || 
        item.moldName.toLowerCase().includes(search.toLowerCase()) ||
        item.colorName.toLowerCase().includes(search.toLowerCase());
      const matchesMold = !selectedMoldId || item.moldId === selectedMoldId;
      return matchesSearch && matchesMold;
    });
  }, [aggregatedStock, search, selectedMoldId, isBalanceMode, molds, colors]);

  const totalGeral = useMemo(() => {
    return filteredStock.reduce((sum, item) => sum + item.total, 0);
  }, [filteredStock]);

  const updateStockEntry = async (entry: SoleStockEntry) => {
    try {
      await firebaseService.saveDocument('soleStock', entry);
      setIsEditing(false);
      setEditingEntry(null);
    } catch (err) {
      console.error('Erro ao atualizar estoque:', err);
      alert('Erro ao atualizar estoque');
    }
  };

  const deleteStockEntry = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta entrada de estoque?')) return;
    try {
      await firebaseService.deleteDocument('soleStock', id);
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  const handleBalance = () => {
    if (!editingEntry) {
      alert('Selecione um item para fazer o balanço');
      return;
    }
    setIsEditing(true);
  };

  const moldSizes = useMemo(() => {
    if (!editingEntry?.moldId) return [];
    const mold = molds.find(m => m.id === editingEntry.moldId);
    return mold?.metadata?.sizes || [];
  }, [editingEntry, molds]);

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
          <h2 className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Estoque de Solados</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Controle de estoque por modelo e cor</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar solado ou cor..."
            className={`w-full border-2 rounded-2xl px-6 py-3 pl-10 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
          />
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            if (isBalanceMode) {
              setIsBalanceMode(false);
              setBalanceData({});
            } else {
              // Initialize balance data with current aggregated stock
              const initialData: Record<string, Record<string, number>> = {};
              aggregatedStock.forEach(item => {
                initialData[`${item.moldId}-${item.colorId}`] = { ...item.sizes };
              });
              setBalanceData(initialData);
              setIsBalanceMode(true);
            }
          }}
          className={`py-3 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
            isBalanceMode 
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
              : 'bg-slate-600 text-white hover:bg-slate-700'
          }`}
        >
          {isBalanceMode ? <X size={14} strokeWidth={3} /> : <Calculator size={14} />}
          {isBalanceMode ? 'Cancelar' : 'Balanço'}
        </button>

        <select
          value={selectedMoldId}
          onChange={(e) => setSelectedMoldId(e.target.value)}
          className={`flex-1 border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
        >
          <option value="">Todos os Modelos</option>
          {molds.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => onNavigateToWeighing ? onNavigateToWeighing() : onBack()}
          className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white flex items-center justify-center gap-2"
        >
          <Scale size={14} /> Pesagem e Contagem
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {filteredStock.length === 0 ? (
          <div className={`p-8 rounded-3xl text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border`}>
            <Package size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              Nenhum solado em estoque
            </p>
          </div>
        ) : (
          filteredStock.map((item, index) => {
            const sizes = Object.entries(item.sizes).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
            
            return (
              <div key={index} className={`p-5 rounded-3xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      {item.moldName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Palette size={13} className="text-slate-500" />
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{item.colorName}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => {
                        const mold = molds.find(m => m.id === item.moldId);
                        if (mold) {
                          setSelectedStockItem({
                            mold,
                            color: { id: item.colorId, name: item.colorName },
                            stock: item.sizes
                          });
                          setIsPrintModalOpen(true);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all border border-indigo-100/50 dark:border-indigo-500/20"
                      title="Imprimir Etiquetas"
                    >
                      <Tag size={13} strokeWidth={3} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Imprimir</span>
                    </button>
                    <div className="flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-100 min-w-[64px]">
                      <p className="text-3xl font-black text-blue-600 leading-none">
                        {isBalanceMode 
                          ? Object.values(balanceData[`${item.moldId}-${item.colorId}`] || item.sizes).reduce((a, b) => a + b, 0)
                          : item.total
                        }
                      </p>
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-0.5">pares</p>
                    </div>
                  </div>
                </div>

                {/* Grade de tamanhos */}
                {sizes.length > 0 && (
                  <div className={`grid gap-2 ${
                    sizes.length <= 2 ? 'grid-cols-2' :
                    sizes.length === 3 ? 'grid-cols-3' :
                    sizes.length === 4 ? 'grid-cols-4' :
                    sizes.length === 5 ? 'grid-cols-5' :
                    'grid-cols-6'
                  }`}>
                    {sizes.map(([size, qty]) => {
                      const itemKey = `${item.moldId}-${item.colorId}`;
                      const currentVal = isBalanceMode ? (balanceData[itemKey]?.[size] ?? qty) : qty;
                      
                      return (
                        <div
                          key={size}
                          className={`flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl transition-all ${
                            isBalanceMode 
                              ? (isDarkMode ? 'bg-indigo-900/20 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200')
                              : (isDarkMode ? 'bg-slate-800 border border-transparent' : 'bg-slate-50 border border-transparent')
                          }`}
                        >
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight leading-none">
                            {size}
                          </span>
                          {isBalanceMode ? (
                            <input
                              type="number"
                              value={currentVal}
                              onChange={(e) => {
                                const newVal = parseInt(e.target.value) || 0;
                                setBalanceData(prev => ({
                                  ...prev,
                                  [itemKey]: {
                                    ...(prev[itemKey] || item.sizes),
                                    [size]: newVal
                                  }
                                }));
                              }}
                              className="w-full bg-transparent text-center font-black text-indigo-600 dark:text-indigo-400 outline-none text-base"
                            />
                          ) : (
                            <span className={`font-black text-slate-700 dark:text-slate-200 leading-none ${sizes.length <= 4 ? 'text-xl' : 'text-base'}`}>
                              {qty}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isBalanceMode && (
        <div className="fixed bottom-24 left-4 right-4 z-50">
          <button
            onClick={async () => {
              const entriesToUpdate = Object.entries(balanceData);
              if (entriesToUpdate.length === 0) {
                setIsBalanceMode(false);
                return;
              }

              if (!confirm(`Deseja salvar o balanço de ${entriesToUpdate.length} itens?`)) return;

              try {
                // For each modified item, we create/update a master soleStock document
                // To keep it simple and consistent with how Editar worked, we use the key as ID
                for (const [key, stock] of entriesToUpdate) {
                  const [moldId, colorId] = key.split('-');
                  const mold = molds.find(m => m.id === moldId);
                  const color = colors.find(c => c.id === colorId);
                  
                  if (!mold || !color) continue;

                  const totalPairs = Object.values(stock).reduce((a, b) => a + b, 0);
                  
                  // Delete existing entries for this mold/color to avoid duplicates if they had different IDs
                  // Actually, if we just use the key as ID, it will create/overwrite ONE document.
                  // But there might be other documents in soleStock with different IDs for same mold/color.
                  // For a TRUE balance, we should probably clear them.
                  const existingDocs = stockEntries.filter(s => s.moldId === moldId && s.colorId === colorId);
                  for (const doc of existingDocs) {
                    if (doc.id !== key) {
                      await firebaseService.deleteDocument('soleStock', doc.id);
                    }
                  }

                  await firebaseService.saveDocument('soleStock', {
                    id: key,
                    moldId,
                    moldName: mold.name,
                    colorId,
                    colorName: color.name,
                    supplierId: '',
                    supplierName: 'Balanço de Estoque',
                    stock,
                    totalPairs,
                    unitCost: 0,
                    totalCost: 0,
                    purchaseDate: Date.now(),
                    notes: 'Ajuste de Balanço'
                  });
                }
                
                alert('Balanço salvo com sucesso!');
                setIsBalanceMode(false);
                setBalanceData({});
              } catch (err) {
                console.error(err);
                alert('Erro ao salvar balanço');
              }
            }}
            className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40 flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <Save size={20} /> Salvar Balanço Total
          </button>
        </div>
      )}

      {filteredStock.length > 0 && !isBalanceMode && (
        <div className="rounded-3xl overflow-hidden mb-2 shadow-lg">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Package size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest">Valor Total de Pares</p>
                  <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wide">em estoque agora</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-blue-200 leading-none">{totalGeral}</p>
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mt-0.5">pares</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStockItem && (
        <PrintSoleLabelModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setSelectedStockItem(null);
          }}
          mold={selectedStockItem.mold}
          color={selectedStockItem.color}
          currentStock={selectedStockItem.stock}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

