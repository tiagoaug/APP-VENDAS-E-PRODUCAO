import { useState, useMemo } from 'react';
import { ProductionConfigItem, ColorValue, PalmilhaStockEntry, ProductionLot, Product, Person, PurchaseRequest, Purchase } from '../types';
import {
  ArrowLeft, Footprints, Package, Palette, Plus, Save,
  ChevronDown, ChevronUp, Search, CheckCircle2, X, ClipboardList, ShoppingCart
} from 'lucide-react';
import { firebaseService } from '../services/firebaseService';
import { computePalmilhaMapaReservations, computePalmilhaPendingOrders } from '../utils/palmilhaNeeds';
import { toast } from '../utils/toast';

interface PalmilhaStockViewProps {
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  stockEntries: PalmilhaStockEntry[];
  productionLots?: ProductionLot[];
  products?: Product[];
  people?: Person[];
  purchaseRequests?: PurchaseRequest[];
  purchases?: Purchase[];
  onBack: () => void;
  onFormularPedido?: (items: { toolId: string; toolName: string; subtype: 'MONTAGEM' | 'ACABAMENTO'; colorId?: string; colorName?: string; initialGrid?: Record<string, number> }[]) => void;
  isDarkMode: boolean;
}

type AggregatedItem = {
  toolId: string;
  toolName: string;
  subtype: 'MONTAGEM' | 'ACABAMENTO';
  colorId: string;
  colorName: string;
  sizes: Record<string, number>;
  total: number;
};

export default function PalmilhaStockView({
  productionConfigs, colors, stockEntries, productionLots, products, people, purchaseRequests, purchases,
  onBack, onFormularPedido, isDarkMode
}: PalmilhaStockViewProps) {
  const palmilhaTools = useMemo(
    () => productionConfigs.filter(c => c.type === 'TOOL' && !!c.metadata?.palmilha),
    [productionConfigs]
  );

  const [search, setSearch] = useState('');
  const [selectedToolId, setSelectedToolId] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [entryToolId, setEntryToolId] = useState('');
  const [entryColorId, setEntryColorId] = useState('');
  const [entryGrade, setEntryGrade] = useState<Record<string, string>>({});
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const [isFormularPedidoMode, setIsFormularPedidoMode] = useState(false);
  const [formularSupplierId, setFormularSupplierId] = useState('');
  const [orderQuantities, setOrderQuantities] = useState<Record<string, Record<string, string>>>({});
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);

  const entryTool = useMemo(() => palmilhaTools.find(t => t.id === entryToolId) || null, [palmilhaTools, entryToolId]);

  const entryAvailableColors = useMemo(() => {
    if (!entryTool) return [];
    const registeredColorIds = new Set((entryTool.metadata?.palmilha?.colorVariations || []).map(cv => cv.colorId));
    return colors.filter(c => registeredColorIds.has(c.id));
  }, [entryTool, colors]);

  const entryAvailableSizes: string[] = useMemo(() => entryTool?.metadata?.sizes || [], [entryTool]);

  const entryGradeTotal = useMemo(() => {
    return Object.values(entryGrade).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  }, [entryGrade]);

  const resetEntryForm = () => {
    setEntryToolId('');
    setEntryColorId('');
    setEntryGrade({});
  };

  const handleCloseEntryModal = () => {
    setShowAddEntryModal(false);
    resetEntryForm();
  };

  const handleSaveManualEntry = async () => {
    const tool = palmilhaTools.find(t => t.id === entryToolId);
    const palmilha = tool?.metadata?.palmilha;
    if (!tool || !palmilha) return;

    const color = colors.find(c => c.id === entryColorId);
    const colorVariation = (palmilha.colorVariations || []).find(cv => cv.colorId === entryColorId);

    const stock: Record<string, number> = {};
    Object.entries(entryGrade).forEach(([size, value]) => {
      const qty = parseInt(value) || 0;
      if (qty > 0) stock[size] = qty;
    });
    const totalPairs = Object.values(stock).reduce((a, b) => a + b, 0);
    if (totalPairs <= 0) return;

    setIsSavingEntry(true);
    try {
      await firebaseService.saveDocument('palmilhaStock', {
        toolId: tool.id,
        toolName: tool.name,
        subtype: palmilha.subtype,
        colorId: entryColorId,
        colorName: colorVariation?.colorName || color?.name || '',
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
    () => computePalmilhaMapaReservations(productionLots || [], products || [], productionConfigs, stockEntries),
    [productionLots, products, productionConfigs, stockEntries]
  );

  const pendingOrders = useMemo(
    () => computePalmilhaPendingOrders(purchaseRequests || [], purchases || []),
    [purchaseRequests, purchases]
  );

  const aggregatedStock = useMemo(() => {
    const stock: Record<string, AggregatedItem> = {};

    palmilhaTools.forEach(tool => {
      const palmilha = tool.metadata?.palmilha;
      if (!palmilha) return;
      const variations = (palmilha.colorVariations || []).length > 0
        ? palmilha.colorVariations
        : [{ colorId: '', colorName: '' }];
      variations.forEach(cv => {
        const key = `${tool.id}-${cv.colorId || ''}`;
        stock[key] = {
          toolId: tool.id,
          toolName: tool.name,
          subtype: palmilha.subtype,
          colorId: cv.colorId || '',
          colorName: cv.colorName || '',
          sizes: {},
          total: 0
        };
      });
    });

    stockEntries.forEach(entry => {
      const key = `${entry.toolId}-${entry.colorId}`;
      if (!stock[key]) {
        stock[key] = {
          toolId: entry.toolId,
          toolName: entry.toolName,
          subtype: entry.subtype,
          colorId: entry.colorId,
          colorName: entry.colorName,
          sizes: {},
          total: 0
        };
      }
      Object.entries(entry.stock || {}).forEach(([grade, qty]) => {
        stock[key].sizes[grade] = (stock[key].sizes[grade] || 0) + qty;
        stock[key].total += qty;
      });
    });

    return Object.values(stock);
  }, [palmilhaTools, stockEntries]);

  const filteredStock = useMemo(() => {
    return aggregatedStock.filter(item => {
      const matchesSearch = !search ||
        item.toolName.toLowerCase().includes(search.toLowerCase()) ||
        item.colorName.toLowerCase().includes(search.toLowerCase());
      const matchesTool = !selectedToolId || item.toolId === selectedToolId;
      return matchesSearch && matchesTool;
    });
  }, [aggregatedStock, search, selectedToolId]);

  // Formular Pedido - fornecedores e facas disponíveis
  const toolSupplierIds = useMemo(() => {
    const ids = new Set<string>();
    palmilhaTools.forEach(t => { if (t.metadata?.supplierId) ids.add(t.metadata.supplierId); });
    return ids;
  }, [palmilhaTools]);

  const formularSuppliers = useMemo(() => {
    return (people || []).filter(p => p.isSupplier && toolSupplierIds.has(p.id));
  }, [people, toolSupplierIds]);

  const formularToolIds = useMemo(() => {
    if (!formularSupplierId) return new Set<string>();
    return new Set(palmilhaTools.filter(t => t.metadata?.supplierId === formularSupplierId).map(t => t.id));
  }, [palmilhaTools, formularSupplierId]);

  const formularStock = useMemo(() => {
    if (!isFormularPedidoMode || !formularSupplierId) return [];
    return aggregatedStock.filter(item => formularToolIds.has(item.toolId));
  }, [aggregatedStock, isFormularPedidoMode, formularSupplierId, formularToolIds]);

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

  const handleFazerPedido = () => {
    const items: { toolId: string; toolName: string; subtype: 'MONTAGEM' | 'ACABAMENTO'; colorId?: string; colorName?: string; initialGrid?: Record<string, number> }[] = [];
    formularStock.forEach(item => {
      const itemKey = `${item.toolId}-${item.colorId}`;
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
        items.push({ toolId: item.toolId, toolName: item.toolName, subtype: item.subtype, colorId: item.colorId, colorName: item.colorName, initialGrid });
      }
    });

    if (items.length === 0) return;

    onFormularPedido?.(items);

    setIsFormularPedidoMode(false);
    setFormularSupplierId('');
    setOrderQuantities({});
  };

  const renderCard = (item: AggregatedItem, index: number) => {
    const itemKey = `${item.toolId}-${item.colorId}`;
    const reservationKey = `${item.toolId}_${item.colorId || 'default'}`;
    const reservedByGrade = reservations[reservationKey]?.reservedByGrade || {};
    const totalReserved = Object.values(reservedByGrade).reduce((a, b) => a + b, 0);
    const pendingByGrade = pendingOrders[reservationKey]?.pendingByGrade || {};

    const tool = palmilhaTools.find(t => t.id === item.toolId);
    const registeredSizes: string[] = tool?.metadata?.sizes || [];

    const allSizeKeys = Array.from(new Set([
      ...registeredSizes,
      ...Object.keys(item.sizes),
      ...Object.keys(reservedByGrade),
      ...Object.keys(pendingByGrade)
    ]));

    const sizeBreakdown = allSizeKeys.map(size => {
      const stockQty = item.sizes[size] || 0;
      const reservedQty = reservedByGrade[size] || 0;
      const missingQty = Math.max(0, reservedQty - stockQty);
      const pendingQty = pendingByGrade[size] || 0;
      const restanteQty = Math.max(0, stockQty - reservedQty);
      return { size, stockQty, reservedQty, missingQty, pendingQty, restanteQty };
    });

    const totalMissing = sizeBreakdown.reduce((sum, s) => sum + s.missingQty, 0);
    const paresRestantesTotal = Math.max(0, item.total - totalReserved);
    const isExpanded = !!expandedCards[itemKey];

    return (
      <div key={`${item.toolId}-${item.colorId}-${index}`} className={`p-5 rounded-3xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {item.toolName}
            </p>
            {item.colorName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/40">
                <Palette size={11} className="text-rose-500" />
                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">{item.colorName}</span>
              </span>
            )}
          </div>
          <div className="flex flex-col items-center justify-center px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700/40 min-w-[56px]">
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
              {paresRestantesTotal}
            </p>
            <p className="text-[8px] font-black text-emerald-500 dark:text-emerald-400/70 uppercase tracking-widest mt-0.5">restante</p>
          </div>
        </div>

        {sizeBreakdown.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {sizeBreakdown.map(({ size, stockQty, reservedQty, restanteQty, pendingQty }) => (
              <div key={size} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight w-12 shrink-0">{size}</span>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="font-black text-slate-900 dark:text-white leading-none text-xl">{restanteQty}</span>
                  {pendingQty > 0 && (
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">
                      +{pendingQty} = {Math.max(0, stockQty + pendingQty - reservedQty)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

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
              <div className={`flex items-stretch rounded-xl border mt-2 overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex-1 flex flex-col items-center justify-center py-2">
                  <p className="text-base font-black text-blue-500 leading-none">{item.total}</p>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Pares</p>
                </div>
                <div className={`w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                <div className="flex-1 flex flex-col items-center justify-center py-2">
                  <p className="text-base font-black text-amber-500 leading-none">{totalReserved}</p>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Reservado</p>
                </div>
                <div className={`w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                <div className="flex-1 flex flex-col items-center justify-center py-2">
                  <p className="text-base font-black text-rose-500 leading-none">{totalMissing}</p>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Faltando</p>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-1.5">
                {sizeBreakdown.map(({ size, stockQty, reservedQty, missingQty, pendingQty }) => (
                  <div key={size} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight w-12 shrink-0">{size}</span>
                    <span className="text-base font-black text-slate-900 dark:text-white w-8 text-center shrink-0">{stockQty}</span>
                    <div className="flex items-center gap-3 flex-wrap justify-end ml-auto">
                      {reservedQty > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">Mapas</span>
                          <span className="text-[11px] font-black text-amber-500 leading-none">{reservedQty}</span>
                        </div>
                      )}
                      {missingQty > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">Falta</span>
                          <span className="text-[11px] font-black text-rose-500 leading-none">{missingQty}</span>
                        </div>
                      )}
                      {pendingQty > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">Comprado</span>
                          <span className="text-[11px] font-black text-blue-500 leading-none">{pendingQty}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {isFormularPedidoMode && registeredSizes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Quantidade a pedir
            </p>
            <div className="flex flex-col gap-1.5">
              {registeredSizes.map(size => {
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
                      title={`Quantidade a pedir do tamanho ${size}`}
                      className={`flex-1 bg-transparent text-right font-black outline-none text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'text-emerald-400 placeholder:text-slate-600' : 'text-emerald-600 placeholder:text-slate-300'}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const montagemStock = displayedStock.filter(i => i.subtype === 'MONTAGEM');
  const acabamentoStock = displayedStock.filter(i => i.subtype === 'ACABAMENTO');

  return (
    <div className="flex flex-col h-full pb-44 px-1 overflow-y-auto overflow-x-hidden force-scrollbar">

      {showAddEntryModal && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleCloseEntryModal} />
          <div className="relative m-auto w-[92%] max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">Entrada Manual</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Adicione pares ao estoque de palmilhas</p>
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
                <label htmlFor="entry-tool-select" className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Faca / Palmilha</label>
                <select
                  id="entry-tool-select"
                  value={entryToolId}
                  onChange={(e) => { setEntryToolId(e.target.value); setEntryColorId(''); setEntryGrade({}); }}
                  className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                >
                  <option value="">Selecione a palmilha...</option>
                  {palmilhaTools.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.metadata?.palmilha?.subtype === 'MONTAGEM' ? 'Montagem' : 'Acabamento'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="entry-color-select" className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Cor</label>
                <select
                  id="entry-color-select"
                  value={entryColorId}
                  onChange={(e) => setEntryColorId(e.target.value)}
                  disabled={!entryTool}
                  className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none disabled:opacity-50 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                >
                  <option value="">{entryTool ? 'Selecione a cor...' : 'Selecione uma palmilha primeiro'}</option>
                  {entryAvailableColors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {entryTool && entryAvailableColors.length === 0 && (
                  <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1.5">Nenhuma cor cadastrada para esta palmilha</p>
                )}
              </div>

              {entryTool && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Grade de Tamanhos</label>
                    {entryGradeTotal > 0 && (
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{entryGradeTotal} pares</span>
                    )}
                  </div>
                  {entryAvailableSizes.length === 0 ? (
                    <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1">Esta faca não possui grade de tamanhos cadastrada</p>
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
                          className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                        >
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight leading-none">{size}</span>
                          <input
                            type="number"
                            min="0"
                            value={entryGrade[size] ?? ''}
                            onChange={(e) => setEntryGrade(prev => ({ ...prev, [size]: e.target.value }))}
                            placeholder="0"
                            title={`Quantidade do tamanho ${size}`}
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
              disabled={!entryToolId || !entryColorId || entryGradeTotal <= 0 || isSavingEntry}
              className="w-full mt-6 py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {isSavingEntry ? 'Salvando...' : 'Salvar Entrada'}
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
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Nenhum fornecedor de palmilhas cadastrado</p>
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
          <h2 className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Estoque de Palmilhas</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Montagem e Acabamento, por faca e cor</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar palmilha ou cor..."
            className={`w-full border-2 rounded-2xl px-6 py-3 pl-10 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
          />
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        <select
          value={selectedToolId}
          onChange={(e) => setSelectedToolId(e.target.value)}
          title="Filtrar por faca"
          className={`w-full border-2 rounded-2xl px-4 py-3 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
        >
          <option value="">Todas as Palmilhas</option>
          {palmilhaTools.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowAddEntryModal(true)}
          className={`w-full py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
        >
          <Plus size={14} strokeWidth={2.5} className="text-emerald-500" /> Entrada Manual
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

      <div className="flex flex-col gap-6 mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Footprints size={16} className="text-rose-500" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Palmilha de Montagem</h3>
          </div>
          {montagemStock.length === 0 ? (
            <div className={`p-6 rounded-3xl text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border`}>
              <Package size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                {isFormularPedidoMode ? 'Nenhuma palmilha de montagem para este fornecedor' : 'Nenhuma palmilha de montagem cadastrada'}
              </p>
            </div>
          ) : (
            montagemStock.map((item, index) => renderCard(item, index))
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <CheckCircle2 size={16} className="text-rose-500" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Palmilha de Acabamento</h3>
          </div>
          {acabamentoStock.length === 0 ? (
            <div className={`p-6 rounded-3xl text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border`}>
              <Package size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                {isFormularPedidoMode ? 'Nenhuma palmilha de acabamento para este fornecedor' : 'Nenhuma palmilha de acabamento cadastrada'}
              </p>
            </div>
          ) : (
            acabamentoStock.map((item, index) => renderCard(item, index))
          )}
        </div>
      </div>

      {isFormularPedidoMode && (
        <div className="fixed bottom-24 left-4 right-4 z-50">
          <button
            onClick={handleFazerPedido}
            disabled={!hasAnyOrderQty}
            className="w-full py-5 rounded-[2rem] bg-emerald-600 text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/40 flex items-center justify-center gap-3 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={20} /> Fazer o Pedido
          </button>
        </div>
      )}
    </div>
  );
}
