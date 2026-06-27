import { useState, useMemo } from 'react';
import { ProductionConfigItem, ColorValue, SoleStockEntry, ProductionLot, Product, Person, PurchaseRequest, Purchase } from '../types';
import {
  ArrowLeft, Package, Palette, Clock, Plus, Trash2, Save,
  ChevronDown, ChevronUp, Search, Edit2, CheckCircle2, X, Calculator, Tag,
  Share2, FileText, Image, Info, ClipboardList, ShoppingCart, SlidersHorizontal
} from 'lucide-react';
import { firebaseService } from '../services/firebaseService';
import PrintSoleLabelModal from '../components/PrintSoleLabelModal';
import CalculatorModal from '../components/CalculatorModal';
import { exportSoleStockReport, StockShareItem } from '../utils/soleStockExport';
import { computeSoleMapaReservations, computeSolePendingOrders } from '../utils/soleNeeds';
import { toast } from '../utils/toast';

interface SoleStockViewProps {
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  stockEntries: SoleStockEntry[];
  productionLots?: ProductionLot[];
  products?: Product[];
  people?: Person[];
  purchaseRequests?: PurchaseRequest[];
  purchases?: Purchase[];
  onBack: () => void;
  onNavigateToWeighing?: () => void;
  onNavigateToWeighingHistory?: () => void;
  onFormularPedido?: (items: { moldId: string; colorId?: string; initialGrid?: Record<string, number> }[]) => void;
  isDarkMode: boolean;
}

export default function SoleStockView({
  productionConfigs, colors, stockEntries, productionLots, products, people, purchaseRequests, purchases,
  onBack, onNavigateToWeighing, onNavigateToWeighingHistory, onFormularPedido, isDarkMode
}: SoleStockViewProps) {
  const molds = useMemo(() => productionConfigs.filter(c => c.type === 'MOLD'), [productionConfigs]);
  
  const [search, setSearch] = useState('');
  const [selectedMoldId, setSelectedMoldId] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<SoleStockEntry | null>(null);
  const [isBalanceMode, setIsBalanceMode] = useState(false);
  const [balanceData, setBalanceData] = useState<Record<string, Record<string, number | string>>>({});
  const [balanceCalculatorTarget, setBalanceCalculatorTarget] = useState<{ itemKey: string; size: string; currentVal: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);;
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<any>(null);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [entryMoldId, setEntryMoldId] = useState('');
  const [entryColorId, setEntryColorId] = useState('');
  const [entryGrade, setEntryGrade] = useState<Record<string, string>>({});
  const [calculatorTargetSize, setCalculatorTargetSize] = useState<string | null>(null);
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  // Reservas de mapas (Parte A)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showInfoBanner, setShowInfoBanner] = useState(
    () => localStorage.getItem('soleStockReservationInfoDismissed') !== 'true'
  );
  const [showDetailFilter, setShowDetailFilter] = useState(false);
  const [detailFieldVisibility, setDetailFieldVisibility] = useState<{ mapas: boolean; falta: boolean; restante: boolean; pedido: boolean }>(() => {
    try {
      const saved = localStorage.getItem('soleStockDetailFieldVisibility');
      if (saved) return { mapas: true, falta: true, restante: true, pedido: true, ...JSON.parse(saved) };
    } catch {}
    return { mapas: true, falta: true, restante: true, pedido: true };
  });
  const toggleDetailField = (field: keyof typeof detailFieldVisibility) => {
    setDetailFieldVisibility(prev => {
      const next = { ...prev, [field]: !prev[field] };
      localStorage.setItem('soleStockDetailFieldVisibility', JSON.stringify(next));
      return next;
    });
  };

  // Formular Pedido (Parte B)
  const [isFormularPedidoMode, setIsFormularPedidoMode] = useState(false);
  const [formularSupplierId, setFormularSupplierId] = useState('');
  const [orderQuantities, setOrderQuantities] = useState<Record<string, Record<string, string>>>({});
  const [orderCalculatorTarget, setOrderCalculatorTarget] = useState<{ itemKey: string; size: string; currentVal: number } | null>(null);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);

  const [showShareCenter, setShowShareCenter] = useState(false);
  const [shareFilterMoldId, setShareFilterMoldId] = useState('');
  const [shareFilterColorId, setShareFilterColorId] = useState('');
  const [shareObservations, setShareObservations] = useState('');
  const [isExportingShare, setIsExportingShare] = useState<'pdf' | 'jpg' | null>(null);

  const entryMold = useMemo(() => molds.find(m => m.id === entryMoldId) || null, [molds, entryMoldId]);

  const entryAvailableColors = useMemo(() => {
    if (!entryMold) return [];
    const registeredColorIds = new Set((entryMold.metadata?.colorVariations || []).map((cv: any) => cv.colorId));
    return colors.filter(c => registeredColorIds.has(c.id));
  }, [entryMold, colors]);

  const entryAvailableSizes: string[] = useMemo(() => entryMold?.metadata?.sizes || [], [entryMold]);

  const entryGradeTotal = useMemo(() => {
    return Object.values(entryGrade).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  }, [entryGrade]);

  const resetEntryForm = () => {
    setEntryMoldId('');
    setEntryColorId('');
    setEntryGrade({});
  };

  const handleCloseEntryModal = () => {
    setShowAddEntryModal(false);
    resetEntryForm();
  };

  const handleSaveManualEntry = async () => {
    const mold = molds.find(m => m.id === entryMoldId);
    const color = colors.find(c => c.id === entryColorId);
    if (!mold || !color) return;

    const stock: Record<string, number> = {};
    Object.entries(entryGrade).forEach(([size, value]) => {
      const qty = parseInt(value) || 0;
      if (qty > 0) stock[size] = qty;
    });
    const totalPairs = Object.values(stock).reduce((a, b) => a + b, 0);
    if (totalPairs <= 0) return;

    setIsSavingEntry(true);
    try {
      await firebaseService.saveDocument('soleStock', {
        moldId: mold.id,
        moldName: mold.name,
        colorId: color.id,
        colorName: color.name,
        supplierId: '',
        supplierName: 'Entrada Manual',
        stock,
        totalPairs,
        unitCost: 0,
        totalCost: 0,
        purchaseDate: Date.now(),
        notes: 'Entrada manual de estoque'
      });

      handleCloseEntryModal();
    } catch (err) {
      console.error(err);
      toast.show('Erro ao salvar entrada de estoque');
    } finally {
      setIsSavingEntry(false);
    }
  };

  const reservations = useMemo(
    () => computeSoleMapaReservations(productionLots || [], products || [], stockEntries),
    [productionLots, products, stockEntries]
  );

  const pendingOrders = useMemo(
    () => computeSolePendingOrders(purchaseRequests || [], purchases || []),
    [purchaseRequests, purchases]
  );

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

    // Garante que solados sem nenhum estoque cadastrado, mas com mapas reservados ou pedidos
    // de compra pendentes, também ganhem um card — para essas informações nunca ficarem "órfãs".
    [...Object.values(reservations), ...Object.values(pendingOrders)].forEach(({ moldId, colorId }) => {
      const key = `${moldId}-${colorId}`;
      if (stock[key]) return;
      const mold = molds.find(m => m.id === moldId);
      if (!mold) return;
      const color = colors.find(c => c.id === colorId);
      stock[key] = {
        moldId,
        moldName: mold.name,
        colorId,
        colorName: color?.name || '',
        sizes: {},
        total: 0
      };
    });

    return Object.values(stock);
  }, [stockEntries, reservations, pendingOrders, molds, colors]);

  const dismissInfoBanner = () => {
    localStorage.setItem('soleStockReservationInfoDismissed', 'true');
    setShowInfoBanner(false);
  };

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

  // Formular Pedido (Parte B) - fornecedores e moldes disponíveis
  const moldSupplierIds = useMemo(() => {
    const ids = new Set<string>();
    molds.forEach(m => { if (m.metadata?.supplierId) ids.add(m.metadata.supplierId); });
    return ids;
  }, [molds]);

  const formularSuppliers = useMemo(() => {
    return (people || []).filter(p => p.isSupplier && moldSupplierIds.has(p.id));
  }, [people, moldSupplierIds]);

  const formularMoldIds = useMemo(() => {
    if (!formularSupplierId) return new Set<string>();
    return new Set(molds.filter(m => m.metadata?.supplierId === formularSupplierId).map(m => m.id));
  }, [molds, formularSupplierId]);

  const formularStock = useMemo(() => {
    if (!isFormularPedidoMode || !formularSupplierId) return [];
    return aggregatedStock.filter(item => formularMoldIds.has(item.moldId));
  }, [aggregatedStock, isFormularPedidoMode, formularSupplierId, formularMoldIds]);

  const displayedStock = isFormularPedidoMode ? formularStock : filteredStock;

  const hasAnyOrderQty = useMemo(() => {
    return Object.values(orderQuantities).some(sizes =>
      Object.values(sizes).some(v => (parseInt(v) || 0) > 0)
    );
  }, [orderQuantities]);

  const startFormularPedido = () => {
    setShowSupplierPicker(true);
  };

  const selectFormularSupplier = (supplierId: string) => {
    setFormularSupplierId(supplierId);
    setIsFormularPedidoMode(true);
    setShowSupplierPicker(false);
    setOrderQuantities({});
  };

  const cancelFormularPedido = () => {
    setIsFormularPedidoMode(false);
    setFormularSupplierId('');
    setOrderQuantities({});
  };

  const handleFazerCompra = () => {
    const items: { moldId: string; colorId?: string; initialGrid?: Record<string, number> }[] = [];
    formularStock.forEach(item => {
      const itemKey = `${item.moldId}-${item.colorId}`;
      const sizes = orderQuantities[itemKey];
      if (!sizes) return;
      const initialGrid: Record<string, number> = {};
      let total = 0;
      Object.entries(sizes).forEach(([size, val]) => {
        const qty = parseInt(val) || 0;
        if (qty > 0) {
          initialGrid[size] = qty;
          total += qty;
        }
      });
      if (total > 0) {
        items.push({ moldId: item.moldId, colorId: item.colorId, initialGrid });
      }
    });

    if (items.length === 0) return;

    onFormularPedido?.(items);

    setIsFormularPedidoMode(false);
    setFormularSupplierId('');
    setOrderQuantities({});
  };

  const shareAvailableColors = useMemo(() => {
    if (!shareFilterMoldId) return colors;
    const mold = molds.find(m => m.id === shareFilterMoldId);
    if (!mold) return colors;
    const registeredColorIds = new Set((mold.metadata?.colorVariations || []).map((cv: any) => cv.colorId));
    return colors.filter(c => registeredColorIds.has(c.id));
  }, [shareFilterMoldId, molds, colors]);

  const shareItems: StockShareItem[] = useMemo(() => {
    return aggregatedStock
      .filter(item => {
        const matchesMold = !shareFilterMoldId || item.moldId === shareFilterMoldId;
        const matchesColor = !shareFilterColorId || item.colorId === shareFilterColorId;
        return matchesMold && matchesColor && item.total > 0;
      })
      .map(item => {
        const mold = molds.find(m => m.id === item.moldId);
        const registeredSizes: string[] = mold?.metadata?.sizes || [];
        const sizeLabels = registeredSizes.length > 0 ? registeredSizes : Object.keys(item.sizes);
        return {
          moldName: item.moldName,
          colorName: item.colorName,
          sizes: sizeLabels.map(size => ({ size, qty: item.sizes[size] || 0 })),
          total: item.total
        };
      });
  }, [aggregatedStock, shareFilterMoldId, shareFilterColorId, molds]);

  const shareTotalGeral = useMemo(() => shareItems.reduce((sum, i) => sum + i.total, 0), [shareItems]);

  const handleCloseShareCenter = () => {
    setShowShareCenter(false);
    setShareFilterMoldId('');
    setShareFilterColorId('');
    setShareObservations('');
  };

  const handleExportShare = async (formatType: 'pdf' | 'jpg') => {
    if (shareItems.length === 0 || isExportingShare) return;
    setIsExportingShare(formatType);
    try {
      const today = new Date();
      const stamp = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
      await exportSoleStockReport({ items: shareItems, observations: shareObservations }, formatType, `Estoque_Solados_${stamp}`);
    } finally {
      setIsExportingShare(null);
    }
  };

  const handleClearAllStock = async () => {
    for (const entry of stockEntries) {
      await firebaseService.deleteDocument('soleStock', entry.id);
    }
    setShowClearConfirm(false);
  };

  return (
    <div className="flex flex-col h-full pb-44 px-1 overflow-y-auto overflow-x-hidden force-scrollbar">

      {showClearConfirm && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)} />
          <div className="relative m-auto w-[90%] max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <h3 className="font-black text-slate-800 dark:text-white text-base mb-2 uppercase tracking-tight">Zerar Estoque?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Todos os registros de estoque de solados serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAllStock}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 active:scale-95 transition-all shadow-sm"
              >
                Zerar Tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddEntryModal && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleCloseEntryModal} />
          <div className="relative m-auto w-[92%] max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">Entrada Manual</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Adicione pares ao estoque de solados</p>
              </div>
              <button
                type="button"
                onClick={handleCloseEntryModal}
                title="Fechar"
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="entry-mold-select" className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Modelo</label>
                <select
                  id="entry-mold-select"
                  value={entryMoldId}
                  onChange={(e) => { setEntryMoldId(e.target.value); setEntryColorId(''); setEntryGrade({}); }}
                  className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                >
                  <option value="">Selecione o modelo...</option>
                  {molds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="entry-color-select" className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Cor</label>
                <select
                  id="entry-color-select"
                  value={entryColorId}
                  onChange={(e) => setEntryColorId(e.target.value)}
                  disabled={!entryMold}
                  className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none disabled:opacity-50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                >
                  <option value="">{entryMold ? 'Selecione a cor...' : 'Selecione um modelo primeiro'}</option>
                  {entryAvailableColors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {entryMold && entryAvailableColors.length === 0 && (
                  <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1.5">Nenhuma cor cadastrada para esta matriz</p>
                )}
              </div>

              {entryMold && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Grade de Tamanhos</label>
                    {entryGradeTotal > 0 && (
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{entryGradeTotal} pares</span>
                    )}
                  </div>
                  {entryAvailableSizes.length === 0 ? (
                    <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1">Esta matriz não possui grade de tamanhos cadastrada</p>
                  ) : (
                    <div className={`grid gap-2 ${
                      entryAvailableSizes.length <= 2 ? 'grid-cols-2' :
                      entryAvailableSizes.length === 3 ? 'grid-cols-3' :
                      entryAvailableSizes.length === 4 ? 'grid-cols-4' :
                      entryAvailableSizes.length === 5 ? 'grid-cols-5' :
                      'grid-cols-6'
                    }`}>
                      {entryAvailableSizes.map(size => (
                        <div
                          key={size}
                          className={`relative flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                        >
                          <button
                            type="button"
                            onClick={() => setCalculatorTargetSize(size)}
                            title={`Abrir calculadora para o tamanho ${size}`}
                            className="absolute top-1 right-1 p-1.5 rounded-lg bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95 transition-all"
                          >
                            <Calculator size={14} strokeWidth={2.5} />
                          </button>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight leading-none">{size}</span>
                          <input
                            type="number"
                            min="0"
                            value={entryGrade[size] ?? ''}
                            onChange={(e) => setEntryGrade(prev => ({ ...prev, [size]: e.target.value }))}
                            placeholder="0"
                            className={`w-full bg-transparent text-center font-black outline-none text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'text-emerald-400 placeholder:text-slate-600' : 'text-emerald-600 placeholder:text-slate-300'}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveManualEntry}
              disabled={!entryMoldId || !entryColorId || entryGradeTotal <= 0 || isSavingEntry}
              className="w-full mt-6 py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {isSavingEntry ? 'Salvando...' : 'Salvar Entrada'}
            </button>
          </div>
        </div>
      )}

      {showShareCenter && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleCloseShareCenter} />
          <div className="relative m-auto w-[92%] max-w-md max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                  <Share2 size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">Central de Compartilhamento</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Exporte o estoque em JPG ou PDF</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseShareCenter}
                title="Fechar"
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="share-mold-select" className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Filtrar Modelo</label>
                  <select
                    id="share-mold-select"
                    value={shareFilterMoldId}
                    onChange={(e) => { setShareFilterMoldId(e.target.value); setShareFilterColorId(''); }}
                    className={`w-full border-2 rounded-2xl px-3 py-3 text-[10px] font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                  >
                    <option value="">Todos os modelos</option>
                    {molds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="share-color-select" className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Filtrar Cor</label>
                  <select
                    id="share-color-select"
                    value={shareFilterColorId}
                    onChange={(e) => setShareFilterColorId(e.target.value)}
                    className={`w-full border-2 rounded-2xl px-3 py-3 text-[10px] font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                  >
                    <option value="">Todas as cores</option>
                    {shareAvailableColors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Pré-visualização</label>
                  {shareItems.length > 0 && (
                    <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">{shareItems.length} {shareItems.length === 1 ? 'item' : 'itens'} • {shareTotalGeral} pares</span>
                  )}
                </div>

                {shareItems.length === 0 ? (
                  <div className={`rounded-2xl border py-8 px-4 text-center ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <Package size={22} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum item encontrado para os filtros selecionados</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {shareItems.map((item, idx) => (
                      <div key={idx} className={`rounded-2xl border p-3.5 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Tag size={11} className="text-sky-500 shrink-0" />
                            <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.moldName} • {item.colorName}</p>
                          </div>
                          <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest shrink-0 ml-2">{item.total} pares</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.sizes.map(s => (
                            <div key={s.size} className={`flex flex-col items-center justify-center px-3.5 py-2.5 rounded-xl border min-w-[56px] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                              <span className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">{s.size}</span>
                              <span className={`text-[15px] font-black leading-none ${s.qty > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>{s.qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="share-observations" className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Observações</label>
                <textarea
                  id="share-observations"
                  value={shareObservations}
                  onChange={(e) => setShareObservations(e.target.value)}
                  placeholder="Digite aqui observações para constar no documento exportado..."
                  rows={3}
                  className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-medium outline-none resize-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-900 placeholder:text-slate-300'}`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => handleExportShare('jpg')}
                disabled={shareItems.length === 0 || !!isExportingShare}
                className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Image size={16} /> {isExportingShare === 'jpg' ? 'Gerando...' : 'Exportar JPG'}
              </button>
              <button
                type="button"
                onClick={() => handleExportShare('pdf')}
                disabled={shareItems.length === 0 || !!isExportingShare}
                className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 hover:bg-rose-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText size={16} /> {isExportingShare === 'pdf' ? 'Gerando...' : 'Exportar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {calculatorTargetSize && (
        <CalculatorModal
          isOpen={!!calculatorTargetSize}
          onClose={() => setCalculatorTargetSize(null)}
          onResult={(val: number) => {
            setEntryGrade(prev => ({ ...prev, [calculatorTargetSize]: Math.max(0, Math.round(val)).toString() }));
            setCalculatorTargetSize(null);
          }}
          initialValue={parseInt(entryGrade[calculatorTargetSize] || '') || 0}
          isDarkMode={isDarkMode}
          zIndex={300}
        />
      )}

      {balanceCalculatorTarget && (
        <CalculatorModal
          isOpen={!!balanceCalculatorTarget}
          onClose={() => setBalanceCalculatorTarget(null)}
          onResult={(val: number) => {
            const { itemKey, size } = balanceCalculatorTarget;
            const newVal = Math.round(val);
            setBalanceData(prev => {
              const item = aggregatedStock.find(s => `${s.moldId}-${s.colorId}` === itemKey);
              return {
                ...prev,
                [itemKey]: {
                  ...(prev[itemKey] || item?.sizes || {}),
                  [size]: newVal
                }
              };
            });
            setBalanceCalculatorTarget(null);
          }}
          initialValue={balanceCalculatorTarget.currentVal}
          isDarkMode={isDarkMode}
          zIndex={300}
        />
      )}

      {orderCalculatorTarget && (
        <CalculatorModal
          isOpen={!!orderCalculatorTarget}
          onClose={() => setOrderCalculatorTarget(null)}
          onResult={(val: number) => {
            const { itemKey, size } = orderCalculatorTarget;
            const newVal = Math.max(0, Math.round(val));
            setOrderQuantities(prev => ({
              ...prev,
              [itemKey]: { ...(prev[itemKey] || {}), [size]: String(newVal) }
            }));
            setOrderCalculatorTarget(null);
          }}
          initialValue={orderCalculatorTarget.currentVal}
          isDarkMode={isDarkMode}
          zIndex={300}
        />
      )}

      {showDetailFilter && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowDetailFilter(false)} />
          <div className="relative m-auto w-[90%] max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <h3 className="font-black text-slate-800 dark:text-white text-base mb-1 uppercase tracking-tight">Filtrar detalhamento</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Escolha o que aparece em cada tamanho</p>
            <div className="flex flex-col gap-2">
              {([
                { key: 'mapas', label: 'Mapas (reservado)' },
                { key: 'falta', label: 'Falta' },
                { key: 'restante', label: 'Restante' },
                { key: 'pedido', label: 'Comprado' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDetailField(key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-tight transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                >
                  {label}
                  <span className={`w-10 h-6 rounded-full p-0.5 transition-all ${detailFieldVisibility[key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`block w-5 h-5 rounded-full bg-white shadow transition-all ${detailFieldVisibility[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowDetailFilter(false)}
              className="w-full mt-4 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showSupplierPicker && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowSupplierPicker(false)} />
          <div className="relative m-auto w-[90%] max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <h3 className="font-black text-slate-800 dark:text-white text-base mb-1 uppercase tracking-tight">Formular Pedido</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Selecione o fornecedor</p>
            {formularSuppliers.length === 0 ? (
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Nenhum fornecedor de solados cadastrado</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {formularSuppliers.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectFormularSupplier(p.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-tight transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white hover:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-800 hover:border-emerald-400'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowSupplierPicker(false)}
              className="w-full mt-4 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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

      {showInfoBanner && (
        <div className={`mb-4 p-4 rounded-2xl border flex items-start gap-3 ${isDarkMode ? 'bg-amber-900/20 border-amber-700/40' : 'bg-amber-50 border-amber-200'}`}>
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <Info size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-amber-200' : 'text-amber-800'}`}>
              Novidade: Reservas de Mapas
            </p>
            <p className={`text-[10px] font-bold mt-1 leading-relaxed ${isDarkMode ? 'text-amber-300/80' : 'text-amber-700'}`}>
              Agora cada card mostra a quantidade de pares já reservada pelos mapas de produção ativos (em âmbar)
              e o quanto ainda falta comprar para cobrir essa demanda (em vermelho). Toque no card para abrir o
              detalhamento por numeração.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissInfoBanner}
            title="Dispensar aviso"
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? 'text-amber-300 hover:bg-amber-800/40' : 'text-amber-600 hover:bg-amber-100'}`}
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>
      )}

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

      <div className="flex flex-col gap-1.5 mb-4">
        <button
          type="button"
          disabled={isFormularPedidoMode}
          onClick={() => {
            if (isBalanceMode) {
              setIsBalanceMode(false);
              setBalanceData({});
            } else {
              const initialData: Record<string, Record<string, number>> = {};
              aggregatedStock.forEach(item => {
                initialData[`${item.moldId}-${item.colorId}`] = { ...item.sizes };
              });
              setBalanceData(initialData);
              setIsBalanceMode(true);
            }
          }}
          className={`w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            isBalanceMode
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
              : 'bg-slate-600 text-white hover:bg-slate-700'
          }`}
        >
          {isBalanceMode ? <X size={14} strokeWidth={3} /> : <Calculator size={14} />}
          {isBalanceMode ? 'Cancelar Balanço' : 'Balanço'}
        </button>

        <select
          value={selectedMoldId}
          onChange={(e) => setSelectedMoldId(e.target.value)}
          title="Filtrar por modelo"
          className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
        >
          <option value="">Todos os Modelos</option>
          {molds.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {isBalanceMode && stockEntries.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-500 active:scale-95 transition-all flex items-center gap-2.5 border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10"
            title="Zerar todo o estoque de solados"
          >
            <Trash2 size={15} strokeWidth={2.5} /> Zerar Estoque
          </button>
        )}

        {isBalanceMode && stockEntries.length > 0 && (
          <p className={`text-[9px] font-bold flex items-center gap-1 px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className="text-rose-400">⚠</span>
            Zerar apaga todo o histórico de entradas e define o estoque como zero. Ação irreversível.
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowAddEntryModal(true)}
          className={`w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Plus size={14} strokeWidth={2.5} className="text-emerald-500" /> Entrada Manual
        </button>

        <button
          type="button"
          onClick={() => onNavigateToWeighingHistory ? onNavigateToWeighingHistory() : (onNavigateToWeighing ? onNavigateToWeighing() : onBack())}
          className={`w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Clock size={14} className="text-indigo-500" /> Histórico de Pesagem
        </button>

        <button
          type="button"
          onClick={() => setShowShareCenter(true)}
          className={`w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Share2 size={14} strokeWidth={2.5} className="text-sky-500" /> Compartilhar
        </button>

        <button
          type="button"
          onClick={() => setShowDetailFilter(true)}
          className={`w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <SlidersHorizontal size={14} strokeWidth={2.5} className="text-violet-500" /> Filtrar Detalhamento
        </button>

        {people && onFormularPedido && (
          <button
            type="button"
            onClick={isFormularPedidoMode ? cancelFormularPedido : startFormularPedido}
            className={`w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 border active:scale-95 transition-all ${
              isFormularPedidoMode
                ? 'bg-rose-500 border-rose-500 text-white'
                : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50')
            }`}
          >
            {isFormularPedidoMode ? <X size={14} strokeWidth={2.5} /> : <ClipboardList size={14} strokeWidth={2.5} className="text-emerald-500" />}
            {isFormularPedidoMode ? 'Cancelar Pedido' : 'Formular Pedido'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {displayedStock.length === 0 ? (
          <div className={`p-8 rounded-3xl text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border`}>
            <Package size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              {isFormularPedidoMode ? 'Nenhum solado em estoque para este fornecedor' : 'Nenhum solado em estoque'}
            </p>
          </div>
        ) : (
          displayedStock.map((item, index) => {
            const itemKey = `${item.moldId}-${item.colorId}`;
            const reservationKey = `${String(item.moldId).trim()}_${String(item.colorId || '').trim() || 'default'}`;
            const reservedByGrade = reservations[reservationKey]?.reservedByGrade || {};
            const totalReserved = Object.values(reservedByGrade).reduce((a, b) => a + b, 0);
            const pendingByGrade = pendingOrders[reservationKey]?.pendingByGrade || {};
            const pendingSourcesByGrade = pendingOrders[reservationKey]?.sourcesByGrade || {};

            const allSizeKeys = Array.from(new Set([...Object.keys(item.sizes), ...Object.keys(reservedByGrade), ...Object.keys(pendingByGrade)]))
              .sort((a, b) => parseFloat(a) - parseFloat(b));

            const sizes: [string, number][] = allSizeKeys.map(size => [size, item.sizes[size] || 0]);

            const sizeBreakdown = allSizeKeys.map(size => {
              const stockQty = item.sizes[size] || 0;
              const reservedQty = reservedByGrade[size] || 0;
              const missingQty = Math.max(0, reservedQty - stockQty);
              const pendingQty = pendingByGrade[size] || 0;
              const pendingSources = pendingSourcesByGrade[size] || [];
              return { size, stockQty, reservedQty, missingQty, pendingQty, pendingSources };
            });

            const totalMissing = sizeBreakdown.reduce((sum, s) => sum + s.missingQty, 0);
            const totalPending = sizeBreakdown.reduce((sum, s) => sum + s.pendingQty, 0);
            const isExpanded = !!expandedCards[itemKey];
            const orderSizeKeys = allSizeKeys.length > 0
              ? allSizeKeys
              : (molds.find(m => m.id === item.moldId)?.metadata?.sizes || []);

            const displayTotal = (isBalanceMode
              ? (Object.values(balanceData[itemKey] || item.sizes).reduce<number>((sum, v) => sum + (typeof v === 'number' ? v : (parseInt(v as string) || 0)), 0))
              : item.total) as number;
            const saldoFuturoTotal = (displayTotal + totalPending) - totalReserved;

            return (
              <div key={index} className={`p-5 rounded-3xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {item.moldName}
                      </p>
                      {item.colorName && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700/40">
                          <Palette size={11} className="text-sky-500" />
                          <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">{item.colorName}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-1">
                      * Saldo futuro = saldo quando chegar todas as compras em estoque
                    </p>
                  </div>
                  <div className="flex items-start gap-3 flex-wrap justify-end">
                    <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-2xl min-w-[80px] border ${
                      saldoFuturoTotal < 0
                        ? 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-700/40'
                        : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700/40'
                    }`}>
                      <p className={`text-xl font-black leading-none ${
                        saldoFuturoTotal < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {saldoFuturoTotal}
                      </p>
                      <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center ${
                        saldoFuturoTotal < 0 ? 'text-rose-500 dark:text-rose-400/70' : 'text-emerald-500 dark:text-emerald-400/70'
                      }`}>saldo futuro*</p>
                    </div>
                  </div>
                </div>

                {/* Grade de tamanhos */}
                {sizes.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {sizes.map(([size, qty]) => {
                      const itemKey = `${item.moldId}-${item.colorId}`;
                      const currentVal = isBalanceMode ? (balanceData[itemKey]?.[size] ?? qty) : qty;
                      const reservedQty = reservedByGrade[size] || 0;
                      const restanteQty = qty - reservedQty;
                      const pendingQty = pendingByGrade[size] || 0;
                      const futureQty = (typeof currentVal === 'number' ? currentVal : (parseInt(currentVal as string) || 0)) + pendingQty - reservedQty;

                      return (
                        <div
                          key={size}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                            isBalanceMode
                              ? (isDarkMode ? 'bg-indigo-900/20 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200')
                              : (isDarkMode ? 'bg-slate-800 border border-transparent' : 'bg-slate-50 border border-transparent')
                          }`}
                        >
                          <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight w-12 shrink-0">
                            {size}
                          </span>
                          {isBalanceMode ? (
                            <>
                              <input
                                type="number"
                                title={`Quantidade do tamanho ${size}`}
                                value={currentVal}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  let parsedVal: number | string;
                                  if (rawVal === '' || rawVal === '-') {
                                    parsedVal = rawVal;
                                  } else {
                                    parsedVal = parseInt(rawVal);
                                    if (isNaN(parsedVal)) parsedVal = 0;
                                  }
                                  setBalanceData(prev => ({
                                    ...prev,
                                    [itemKey]: {
                                      ...(prev[itemKey] || item.sizes),
                                      [size]: parsedVal
                                    }
                                  }));
                                }}
                                className="flex-1 bg-transparent text-right font-black text-indigo-600 dark:text-indigo-400 outline-none text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const numericVal = typeof currentVal === 'number' ? currentVal : (parseInt(currentVal) || 0);
                                  setBalanceCalculatorTarget({ itemKey, size, currentVal: numericVal });
                                }}
                                title={`Abrir calculadora para o tamanho ${size}`}
                                className="shrink-0 p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all"
                              >
                                <Calculator size={14} strokeWidth={2.5} />
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 ml-auto">
                              <span className={`font-black leading-none text-xl ${
                                futureQty < 0 ? 'text-rose-500 dark:text-rose-450' : 'text-emerald-500 dark:text-emerald-450'
                              }`}>
                                {futureQty}
                              </span>
                              {pendingQty > 0 ? (
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">
                                  (+{pendingQty} compras)
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">
                                  (sem compras)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Detalhamento de reservas de mapas (Parte A) */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setExpandedCards(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <span>Detalhamento por numeração (mapas)</span>
                    {isExpanded ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}
                  </button>

                  {isExpanded && (
                    <>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className={`flex flex-col items-center justify-center py-2 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                          <p className="text-base font-black text-blue-500 leading-none">{displayTotal}</p>
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Pares</p>
                        </div>
                        <div className={`flex flex-col items-center justify-center py-2 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                          <p className="text-base font-black text-amber-500 leading-none">{totalReserved}</p>
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Reservado</p>
                        </div>
                        <div className={`flex flex-col items-center justify-center py-2 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                          <p className="text-base font-black text-rose-500 leading-none">{totalMissing}</p>
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Faltando</p>
                        </div>
                        <div className={`flex flex-col items-center justify-center py-2 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                          <p className="text-base font-black text-sky-500 leading-none">{totalPending}</p>
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Comprado</p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-col gap-2">
                        {sizeBreakdown.map(({ size, stockQty, reservedQty, missingQty, pendingQty, pendingSources }) => {
                          const futureTotal = stockQty + pendingQty - reservedQty;
                          return (
                            <div
                              key={size}
                              className={`p-4 rounded-3xl border flex flex-col gap-3 transition-all ${
                                isDarkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-100'
                              } shadow-sm`}
                            >
                              {/* Top Row: Size Badge & Help Icon */}
                              <div className="flex items-center justify-between">
                                <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                                  isDarkMode ? 'bg-slate-800 text-slate-350' : 'bg-slate-50 text-slate-655'
                                } border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
                                  Tamanho {size}
                                </span>
                                
                                {/* Help Icon with Tooltip */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-help"
                                    title="Como são feitos os cálculos?"
                                  >
                                    ?
                                  </button>
                                  {/* Tooltip on hover */}
                                  <div className={`absolute right-0 bottom-8 z-[60] w-64 p-3.5 rounded-2xl shadow-2xl text-[10px] font-bold leading-relaxed border transition-all scale-0 group-hover:scale-100 origin-bottom-right duration-200 ${
                                    isDarkMode
                                      ? 'bg-slate-950 border-slate-800 text-slate-400'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}>
                                    <p className="font-black text-slate-800 dark:text-white uppercase mb-1.5 tracking-tight">Cálculo de Estoque Futuro</p>
                                    <p className="mb-2.5">O estoque final da numeração é projetado somando o estoque atual às compras pendentes e subtraindo a necessidade dos mapas ativos:</p>
                                    <div className={`p-2.5 rounded-xl border font-mono text-[9px] font-bold ${
                                      isDarkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-slate-50 border-slate-150'
                                    }`}>
                                      (<span className="text-emerald-500">Estoque Real</span> + <span className="text-blue-500">Comprado</span>) - <span className="text-orange-500">Mapas</span> = <span className={futureTotal < 0 ? 'text-rose-500' : 'text-emerald-500'}>Estoque Futuro</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Main Grid: Real Stock, Map Lot Necessity, Purchased Total, Future Total */}
                              <div className="grid grid-cols-4 gap-2">
                                {/* Estoque Real */}
                                <div className={`p-2.5 rounded-xl flex flex-col items-center justify-center border ${
                                  isDarkMode ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50/50 border-slate-100'
                                }`}>
                                  <span className={`text-sm font-black ${
                                    stockQty < 0 ? 'text-rose-500 dark:text-rose-450' : 'text-emerald-500 dark:text-emerald-450'
                                  }`}>
                                    {stockQty}
                                  </span>
                                  <span className="text-[7.5px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest mt-0.5 text-center">Estoque Real</span>
                                </div>

                                {/* Comprado */}
                                <div className={`p-2.5 rounded-xl flex flex-col items-center justify-center border ${
                                  isDarkMode ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50/50 border-slate-100'
                                }`}>
                                  <span className="text-sm font-black text-blue-500 dark:text-blue-400">
                                    {pendingQty}
                                  </span>
                                  <span className="text-[7.5px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest mt-0.5 text-center">Comprado</span>
                                </div>

                                {/* Mapas (Necessidade) */}
                                <div className={`p-2.5 rounded-xl flex flex-col items-center justify-center border ${
                                  isDarkMode ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50/50 border-slate-100'
                                }`}>
                                  <span className="text-sm font-black text-orange-500 dark:text-orange-400">
                                    {reservedQty}
                                  </span>
                                  <span className="text-[7.5px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest mt-0.5 text-center">Mapas</span>
                                </div>

                                {/* Estoque Futuro (Resultado) */}
                                <div className={`p-2.5 rounded-xl flex flex-col items-center justify-center border ${
                                  futureTotal < 0
                                    ? 'bg-rose-50/30 border-rose-100/50 dark:bg-rose-950/20 dark:border-rose-900/30'
                                    : 'bg-emerald-50/30 border-emerald-100/50 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                                }`}>
                                  <span className={`text-sm font-black ${
                                    futureTotal < 0
                                      ? 'text-rose-500 dark:text-rose-455'
                                      : 'text-emerald-500 dark:text-emerald-450'
                                  }`}>
                                    {futureTotal}
                                  </span>
                                  <span className="text-[7.5px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest mt-0.5 text-center">Saldo Final</span>
                                </div>
                              </div>

                              {/* Calculation Summary Row (Inline Equation) */}
                              <div className={`py-2 px-3 rounded-xl text-center border border-dashed text-[10px] font-bold ${
                                isDarkMode
                                  ? 'bg-slate-950/20 border-slate-800 text-slate-400'
                                  : 'bg-slate-50/30 border-slate-200 text-slate-500'
                              }`}>
                                <span className={stockQty < 0 ? 'text-rose-500' : 'text-emerald-500'}>{stockQty}</span> (Estoque) + <span className="text-blue-500">{pendingQty}</span> (Comprado) - <span className="text-orange-500">{reservedQty}</span> (Mapas) = <span className={futureTotal < 0 ? 'text-rose-500' : 'text-emerald-500'}>{futureTotal}</span>
                              </div>

                              {/* Detail of individual purchase orders on the line below */}
                              {pendingSources.length > 0 && (
                                <div className={`p-3 rounded-2xl border flex flex-col gap-1.5 ${
                                  isDarkMode ? 'bg-slate-950/30 border-slate-800/80' : 'bg-slate-50/30 border-slate-100'
                                }`}>
                                  <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">
                                    Detalhamento de Compras (de todas as compras):
                                  </p>
                                  <div className="flex flex-col gap-1">
                                    {pendingSources.map((src, idx) => (
                                      <div key={`${src.id}-${idx}`} className="flex items-center justify-between text-[10px] font-bold text-slate-650 dark:text-slate-404">
                                        <span className="truncate">{src.label}</span>
                                        <span className="text-sky-500 font-extrabold shrink-0">+{src.qty} pares</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Grade de quantidade a pedir (Parte B - Formular Pedido) */}
                {isFormularPedidoMode && orderSizeKeys.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      Quantidade a pedir
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {orderSizeKeys.map(size => {
                        const orderVal = orderQuantities[itemKey]?.[size] ?? '';
                        return (
                          <div key={size} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-emerald-50 border-emerald-100'}`}>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight w-12 shrink-0">{size}</span>
                            <input
                              type="number"
                              min="0"
                              value={orderVal}
                              onChange={(e) => {
                                const v = e.target.value;
                                setOrderQuantities(prev => ({
                                  ...prev,
                                  [itemKey]: { ...(prev[itemKey] || {}), [size]: v }
                                }));
                              }}
                              placeholder="0"
                              className={`flex-1 bg-transparent text-right font-black outline-none text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'text-emerald-400 placeholder:text-slate-600' : 'text-emerald-600 placeholder:text-slate-300'}`}
                            />
                            <button
                              type="button"
                              onClick={() => setOrderCalculatorTarget({ itemKey, size, currentVal: parseInt(orderVal) || 0 })}
                              title={`Abrir calculadora para o tamanho ${size}`}
                              className="shrink-0 p-1.5 rounded-lg bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95 transition-all"
                            >
                              <Calculator size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isFormularPedidoMode && (
        <div className="fixed bottom-24 left-4 right-4 z-50">
          <button
            onClick={handleFazerCompra}
            disabled={!hasAnyOrderQty}
            className="w-full py-5 rounded-[2rem] bg-emerald-600 text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/40 flex items-center justify-center gap-3 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={20} /> Fazer a Compra
          </button>
        </div>
      )}

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

                  const cleanStock: Record<string, number> = {};
                  Object.entries(stock).forEach(([size, val]) => {
                    cleanStock[size] = typeof val === 'number' ? val : (parseInt(val as string) || 0);
                  });
                  const totalPairs = Object.values(cleanStock).reduce((a, b) => a + b, 0);
                  
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
                    stock: cleanStock,
                    totalPairs,
                    unitCost: 0,
                    totalCost: 0,
                    purchaseDate: Date.now(),
                    notes: 'Ajuste de Balanço'
                  });
                }
                
                toast.show('Balanço salvo com sucesso!');
                setIsBalanceMode(false);
                setBalanceData({});
              } catch (err) {
                console.error(err);
                toast.show('Erro ao salvar balanço');
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

