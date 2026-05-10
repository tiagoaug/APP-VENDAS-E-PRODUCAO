import { useState, useMemo } from 'react';
import { ProductionConfigItem, ColorValue, SoleStockEntry } from '../types';
import { 
  ArrowLeft, Package, Palette, Scale, Plus, Trash2, Save, 
  ChevronDown, Search, Edit2, CheckCircle2, X, Calculator
} from 'lucide-react';
import { firebaseService } from '../services/firebaseService';

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
  const [isEditing, setIsEditing] = useState(false);

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
        stock[key].sizes[size] = (stock[key].sizes[size] || 0) + qty;
        stock[key].total += qty;
      });
    });
    
    return Object.values(stock);
  }, [stockEntries]);

  const filteredStock = useMemo(() => {
    return aggregatedStock.filter(item => {
      const matchesSearch = !search || 
        item.moldName.toLowerCase().includes(search.toLowerCase()) ||
        item.colorName.toLowerCase().includes(search.toLowerCase());
      const matchesMold = !selectedMoldId || item.moldId === selectedMoldId;
      return matchesSearch && matchesMold;
    });
  }, [aggregatedStock, search, selectedMoldId]);

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
    <div className="flex flex-col h-full pb-44 px-1 overflow-y-auto force-scrollbar">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className={`text-[13px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Estoque de Solados</h2>
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
        <select
          value={selectedMoldId}
          onChange={(e) => setSelectedMoldId(e.target.value)}
          className={`border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
        >
          <option value="">Todos</option>
          {molds.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            if (filteredStock.length > 0) {
              const firstItem = filteredStock[0];
              setEditingEntry({
                id: `${firstItem.moldId}-${firstItem.colorId}`,
                moldId: firstItem.moldId,
                moldName: firstItem.moldName,
                colorId: firstItem.colorId,
                colorName: firstItem.colorName,
                supplierId: '',
                supplierName: '',
                stock: firstItem.sizes,
                totalPairs: firstItem.total,
                unitCost: 0,
                totalCost: 0,
                purchaseDate: Date.now()
              });
              setIsEditing(true);
            } else {
              alert('Nenhum item em estoque para ajustar');
            }
          }}
          className="py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-violet-600 text-white flex items-center justify-center gap-2"
        >
          <Edit2 size={14} /> Editar
        </button>
        
        {filteredStock.length > 0 && (
          <select
            value={editingEntry ? `${editingEntry.moldId}-${editingEntry.colorId}` : ''}
            onChange={(e) => {
              const [moldId, colorId] = e.target.value.split('-');
              const item = filteredStock.find(i => i.moldId === moldId && i.colorId === colorId);
              if (item) {
                setEditingEntry({
                  id: `${item.moldId}-${item.colorId}`,
                  moldId: item.moldId,
                  moldName: item.moldName,
                  colorId: item.colorId,
                  colorName: item.colorName,
                  supplierId: '',
                  supplierName: '',
                  stock: item.sizes,
                  totalPairs: item.total,
                  unitCost: 0,
                  totalCost: 0,
                  purchaseDate: Date.now()
                });
                setIsEditing(true);
              }
            }}
            className={`flex-1 border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
          >
            {filteredStock.map((item, idx) => (
              <option key={idx} value={`${item.moldId}-${item.colorId}`}>
                {item.moldName} - {item.colorName} ({item.total} pares)
              </option>
            ))}
          </select>
        )}
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
              <div key={index} className={`p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      {item.moldName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Palette size={12} className="text-violet-500" />
                      <span className="text-[10px] font-bold text-violet-500 uppercase">{item.colorName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-500">{item.total}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">pares</p>
                  </div>
                </div>
                
                {sizes.length > 0 && (
                  <div className="mt-3">
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 mb-1">
                      {sizes.map(([size]) => (
                        <div key={`label-${size}`} className="text-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase">{size}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                      {sizes.map(([size, qty]) => (
                        <div key={size} className={`py-2 rounded-lg text-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                          <span className="text-xs font-black text-emerald-500">{qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {filteredStock.length > 0 && (
        <div className={`p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black text-slate-400 uppercase">Total Geral</p>
            <p className="text-xl font-black text-emerald-500">{totalGeral} pares</p>
          </div>
        </div>
      )}

      {isEditing && editingEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="p-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
              <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Ajuste de Estoque
              </h2>
              <button 
                onClick={() => { setIsEditing(false); setEditingEntry(null); }} 
                className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className={`p-4 rounded-2xl mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <p className="text-sm font-black text-white">{editingEntry.moldName}</p>
                <p className="text-xs font-bold text-violet-400 uppercase">{editingEntry.colorName}</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {moldSizes.map(size => (
                  <div key={size} className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase text-center">{size}</label>
                    <input
                      type="number"
                      min="0"
                      value={editingEntry.stock?.[size] || 0}
                      onChange={(e) => {
                        const newStock = { ...editingEntry.stock, [size]: parseInt(e.target.value) || 0 };
                        const total = Object.values(newStock).reduce((a, b) => a + b, 0);
                        setEditingEntry({ ...editingEntry, stock: newStock, totalPairs: total });
                      }}
                      className={`px-2 py-2 rounded-lg font-black text-xs text-center outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-emerald-600 uppercase">Total:</span>
                  <span className="text-xl font-black text-emerald-500">
                    {Object.values(editingEntry.stock || {}).reduce((a, b) => a + b, 0)} pares
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-50 dark:border-slate-800">
              <button
                onClick={() => updateStockEntry(editingEntry)}
                className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Save size={18} /> Salvar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
