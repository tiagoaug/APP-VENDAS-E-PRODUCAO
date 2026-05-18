import { useState, useMemo } from 'react';
import {
  Sale, Product, ProductionOrder, ProductionOrderItem,
  ProductionLot, SaleType, Sector, Grid
} from '../types';
import {
  X, Factory, Package, CheckCircle2, Layers,
  ArrowRight, Warehouse, Wrench, Calendar, User, AlertCircle
} from 'lucide-react';

interface StockDeduction {
  productId: string;
  variationId: string;
  size?: string;
  quantity: number;
}

interface ProductionOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  products: Product[];
  grids: Grid[];
  sectors: Sector[];
  existingOrdersCount: number;
  existingLotsCount: number;
  isDarkMode: boolean;
  onConfirm: (
    order: ProductionOrder,
    lots: ProductionLot[],
    deductions: StockDeduction[]
  ) => Promise<void>;
}

type Mode = 'FULL' | 'PARTIAL';

export default function ProductionOrderModal({
  isOpen, onClose, sale, products, grids, sectors,
  existingOrdersCount, existingLotsCount,
  isDarkMode, onConfirm
}: ProductionOrderModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode>('FULL');
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const [deliveryDate, setDeliveryDate] = useState<string>(
    sale.deliveryDate
      ? new Date(sale.deliveryDate).toISOString().split('T')[0]
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedItems = useMemo(() => {
    const map = new Map<string, {
      productId: string;
      productName: string;
      variationId: string;
      variationName: string;
      saleType: SaleType;
      sizeItems: Array<{ size?: string; qty: number }>;
      stock: Record<string, number>;
      totalQty: number;
    }>();

    sale.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variation = product?.variations.find(v => v.id === item.variationId);
      if (!product || !variation) return;

      const key = `${item.productId}-${item.variationId}`;
      if (!map.has(key)) {
        const stock: Record<string, number> = {};
        if (item.saleType === SaleType.RETAIL) {
          Object.entries(variation.stock).forEach(([s, q]) => {
            if (s !== 'WHOLESALE') stock[s] = q;
          });
        } else {
          stock['__all__'] = variation.stock['WHOLESALE'] || 0;
        }
        map.set(key, {
          productId: item.productId,
          productName: product.name,
          variationId: item.variationId,
          variationName: variation.colorName,
          saleType: item.saleType,
          sizeItems: [],
          stock,
          totalQty: 0
        });
      }
      const g = map.get(key)!;
      g.sizeItems.push({ size: item.size, qty: item.quantity });
      g.totalQty += item.quantity;
    });

    return Array.from(map.values());
  }, [sale.items, products]);

  const computed = useMemo(() => {
    return groupedItems.map(g => {
      const sizesResult: Record<string, { total: number; fromStock: number; toProduction: number }> = {};
      let fromStockQty = 0;
      let toProductionQty = 0;

      if (g.saleType === SaleType.RETAIL) {
        g.sizeItems.forEach(({ size, qty }) => {
          const k = `${g.productId}-${g.variationId}-${size}`;
          const alloc = mode === 'FULL' ? 0 : Math.min(allocation[k] || 0, qty);
          const toProd = qty - alloc;
          sizesResult[size!] = { total: qty, fromStock: alloc, toProduction: toProd };
          fromStockQty += alloc;
          toProductionQty += toProd;
        });
      } else {
        const k = `${g.productId}-${g.variationId}-__all__`;
        const alloc = mode === 'FULL' ? 0 : Math.min(allocation[k] || 0, g.totalQty);
        const toProd = g.totalQty - alloc;
        sizesResult['__all__'] = { total: g.totalQty, fromStock: alloc, toProduction: toProd };
        fromStockQty = alloc;
        toProductionQty = toProd;
      }

      return { ...g, sizesResult, fromStockQty, toProductionQty };
    });
  }, [groupedItems, allocation, mode]);

  const totalToProduction = useMemo(
    () => computed.reduce((s, g) => s + g.toProductionQty, 0),
    [computed]
  );

  const handleConfirm = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const orderId = Math.random().toString(36).substr(2, 9);
      const orderNum = `OP #${String(existingOrdersCount + 1).padStart(3, '0')}`;

      const items: ProductionOrderItem[] = computed.map(g => ({
        productId: g.productId,
        productName: g.productName,
        variationId: g.variationId,
        variationName: g.variationName,
        saleType: g.saleType,
        sizes: g.sizesResult,
        totalQuantity: g.totalQty,
        fromStockQty: g.fromStockQty,
        toProductionQty: g.toProductionQty
      }));

      const lots: ProductionLot[] = [];
      computed.forEach(g => {
        if (g.toProductionQty <= 0) return;
        const product = products.find(p => p.id === g.productId);
        const route = product?.productionRoute || sectors.map(s => s.id);

        let lotPairs: { [size: string]: number } = {};
        let totalPairs = g.toProductionQty;
        let gradesQty: number | undefined = undefined;

        if (g.saleType === SaleType.WHOLESALE) {
          const gridId = product?.productionGridId || product?.defaultGridId;
          const grid = grids.find(gr => gr.id === gridId);
          const pairsPerGrade = grid ? Object.values(grid.configuration).reduce((a, b) => a + b, 0) : 12;
          totalPairs = g.toProductionQty * pairsPerGrade;
          gradesQty = g.toProductionQty;

          if (grid) {
            Object.entries(grid.configuration).forEach(([size, qty]) => {
              if (qty > 0) {
                lotPairs[size] = qty * g.toProductionQty;
              }
            });
          }
        } else {
          // Retail: g.sizesResult has size breakdown
          Object.entries(g.sizesResult).forEach(([size, res]) => {
            if (res.toProduction > 0 && size !== '__all__') {
              lotPairs[size] = res.toProduction;
            }
          });
        }

        const lot: ProductionLot = {
          id: Math.random().toString(36).substr(2, 9),
          orderNumber: `Lote #${String(existingLotsCount + lots.length + 1).padStart(3, '0')}`,
          saleId: sale.id,
          productionOrderId: orderId,
          saleOrderNumber: sale.orderNumber,
          customerName: sale.customerName || 'Avulso',
          deliveryDate: new Date(deliveryDate).getTime(),
          productId: g.productId,
          variationId: g.variationId,
          quantity: totalPairs,
          pairs: lotPairs,
          gradesQty,
          route,
          currentSectorIndex: 0,
          prioridade: sale.prioridade || 'NORMAL',
          history: [{
            sectorId: route[0] || '',
            statusId: '',
            timestamp: Date.now(),
            notes: `Criado via ${orderNum} — Pedido #${sale.orderNumber}`
          }],
          createdAt: Date.now()
        };
        lots.push(lot);
      });

      const order: ProductionOrder = {
        id: orderId,
        orderNumber: orderNum,
        saleId: sale.id,
        saleOrderNumber: sale.orderNumber,
        customerId: sale.customerId,
        customerName: sale.customerName || 'Avulso',
        orderDate: sale.date,
        deliveryDate: new Date(deliveryDate).getTime(),
        items,
        status: lots.length > 0 ? 'PENDING' : 'COMPLETED',
        lotIds: lots.map(l => l.id),
        createdAt: Date.now()
      };

      const deductions: StockDeduction[] = [];
      if (mode === 'PARTIAL') {
        computed.forEach(g => {
          if (g.fromStockQty <= 0) return;
          if (g.saleType === SaleType.RETAIL) {
            g.sizeItems.forEach(({ size, qty }) => {
              const alloc = Math.min(allocation[`${g.productId}-${g.variationId}-${size}`] || 0, qty);
              if (alloc > 0) {
                deductions.push({ productId: g.productId, variationId: g.variationId, size, quantity: alloc });
              }
            });
          } else {
            if (g.fromStockQty > 0) {
              deductions.push({ productId: g.productId, variationId: g.variationId, quantity: g.fromStockQty });
            }
          }
        });
      }

      if (lots.length === 0) {
        setError('Nenhum lote para criar. Verifique as quantidades para produção.');
        return;
      }

      console.log('[OP] Criando pedido:', order.orderNumber, '| Lotes:', lots.length, '| Deduções:', deductions.length);
      await onConfirm(order, lots, deductions);
      console.log('[OP] Pedido criado com sucesso.');
    } catch (err: any) {
      console.error('[OP] Erro ao criar pedido:', err);
      setError(err?.message || 'Erro ao salvar. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const allocateMax = () => {
    const newAlloc: Record<string, number> = {};
    groupedItems.forEach(g => {
      if (g.saleType === SaleType.RETAIL) {
        g.sizeItems.forEach(({ size, qty }) => {
          const available = g.stock[size!] || 0;
          newAlloc[`${g.productId}-${g.variationId}-${size}`] = Math.min(available, qty);
        });
      } else {
        const available = g.stock['__all__'] || 0;
        newAlloc[`${g.productId}-${g.variationId}-__all__`] = Math.min(available, g.totalQty);
      }
    });
    setAllocation(newAlloc);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full sm:max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>

        {/* Header */}
        <div className={`px-6 py-5 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Factory size={20} className="text-white" />
            </div>
            <div>
              <h2 className={`text-sm font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Pedido de Produção
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Pedido #{sale.orderNumber} • {sale.customerName || 'Avulso'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Step 1 — Choose mode */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className={`text-xs font-black uppercase tracking-widest text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Como deseja atender este pedido?
              </p>

              <button
                onClick={() => { setMode('FULL'); setStep(2); }}
                className={`p-6 rounded-[2rem] border-2 flex items-center gap-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500' : 'bg-slate-50 border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/30'}`}
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                  <Wrench size={26} className="text-white" />
                </div>
                <div>
                  <p className={`text-sm font-black uppercase tracking-tight leading-none mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Produzir Inteiro
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                    Todo o pedido vai para produção, ignorando o estoque disponível.
                  </p>
                </div>
                <ArrowRight size={20} className="text-slate-300 ml-auto shrink-0" />
              </button>

              <button
                onClick={() => { setMode('PARTIAL'); setStep(2); }}
                className={`p-6 rounded-[2rem] border-2 flex items-center gap-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-emerald-500' : 'bg-slate-50 border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/30'}`}
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                  <Warehouse size={26} className="text-white" />
                </div>
                <div>
                  <p className={`text-sm font-black uppercase tracking-tight leading-none mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Abater Estoque
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                    Usa o estoque disponível e produz somente o restante.
                  </p>
                </div>
                <ArrowRight size={20} className="text-slate-300 ml-auto shrink-0" />
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <button
                onClick={() => setStep(1)}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 self-start flex items-center gap-1.5"
              >
                ← Voltar
              </button>

              {/* Delivery date */}
              <div className={`p-4 rounded-2xl flex items-center gap-3 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <Calendar size={16} className="text-indigo-500 shrink-0" />
                <div className="flex-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Data de Entrega Combinada
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className={`w-full bg-transparent font-black text-sm outline-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                  />
                </div>
              </div>

              {/* Mode indicator */}
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${mode === 'FULL' ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                {mode === 'FULL'
                  ? <Wrench size={14} className="text-indigo-600" />
                  : <Warehouse size={14} className="text-emerald-600" />}
                <span className={`text-[10px] font-black uppercase tracking-widest ${mode === 'FULL' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                  {mode === 'FULL' ? 'Produção Integral' : 'Abate de Estoque + Produção'}
                </span>
                {mode === 'PARTIAL' && (
                  <button
                    onClick={allocateMax}
                    className="ml-auto text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-lg"
                  >
                    Alocar Máximo
                  </button>
                )}
              </div>

              {/* Items */}
              <div className="flex flex-col gap-3">
                {computed.map(g => (
                  <div
                    key={`${g.productId}-${g.variationId}`}
                    className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        <Package size={16} className="text-slate-400" />
                      </div>
                      <div>
                        <p className={`text-xs font-black uppercase leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{g.productName}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{g.variationName}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Pedido</p>
                        <p className={`text-lg font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{g.totalQty}</p>
                      </div>
                    </div>

                    {mode === 'PARTIAL' && g.saleType === SaleType.RETAIL ? (
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-4 gap-1 px-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase">TAM</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase text-center">PEDIDO</span>
                          <span className="text-[8px] font-black text-emerald-500 uppercase text-center">ESTOQUE</span>
                          <span className="text-[8px] font-black text-indigo-500 uppercase text-center">ALOCAR</span>
                        </div>
                        {g.sizeItems.map(({ size, qty }) => {
                          const available = g.stock[size!] || 0;
                          const k = `${g.productId}-${g.variationId}-${size}`;
                          const alloc = Math.min(allocation[k] || 0, qty);
                          const toProd = qty - alloc;
                          return (
                            <div key={size} className={`grid grid-cols-4 gap-1 items-center p-2 rounded-xl ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                              <span className="text-[10px] font-black text-slate-500">{size}</span>
                              <span className="text-[10px] font-black text-center text-slate-600 dark:text-slate-300">{qty}</span>
                              <span className={`text-[10px] font-black text-center ${available > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{available}</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={Math.min(available, qty)}
                                  value={alloc || ''}
                                  placeholder="0"
                                  onChange={e => setAllocation(prev => ({
                                    ...prev,
                                    [k]: Math.min(Math.max(0, parseInt(e.target.value) || 0), Math.min(available, qty))
                                  }))}
                                  className={`w-full text-center font-black text-[10px] rounded-lg px-1 py-1 outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                                />
                                {toProd > 0 && (
                                  <span className="text-[8px] font-black text-indigo-400 whitespace-nowrap">+{toProd}p</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : mode === 'PARTIAL' ? (
                      <div className={`p-3 rounded-xl flex items-center gap-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Em Estoque (grades)</p>
                          <p className={`text-lg font-black ${g.stock['__all__'] > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{g.stock['__all__'] || 0}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-indigo-500 uppercase mb-1">Alocar do Estoque</p>
                          <input
                            type="number"
                            min={0}
                            max={Math.min(g.stock['__all__'] || 0, g.totalQty)}
                            value={allocation[`${g.productId}-${g.variationId}-__all__`] || ''}
                            placeholder="0"
                            onChange={e => setAllocation(prev => ({
                              ...prev,
                              [`${g.productId}-${g.variationId}-__all__`]: Math.min(
                                Math.max(0, parseInt(e.target.value) || 0),
                                Math.min(g.stock['__all__'] || 0, g.totalQty)
                              )
                            }))}
                            className={`w-full text-center font-black text-sm rounded-xl px-3 py-2 outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-amber-500 uppercase mb-1">Para Produção</p>
                          <p className="text-lg font-black text-amber-500">{g.toProductionQty}</p>
                        </div>
                      </div>
                    ) : (
                      /* FULL mode: just summary */
                      <div className="flex gap-3">
                        {Object.entries(g.sizesResult).filter(([k]) => k !== '__all__').map(([size, v]) => (
                          <div key={size} className={`flex-1 p-2 rounded-xl text-center ${isDarkMode ? 'bg-slate-700/50' : 'bg-indigo-50'}`}>
                            <p className="text-[8px] font-black text-slate-400 uppercase">{size}</p>
                            <p className="text-base font-black text-indigo-600">{v.total}</p>
                          </div>
                        ))}
                        {g.saleType !== SaleType.RETAIL && (
                          <div className={`flex-1 p-2 rounded-xl text-center ${isDarkMode ? 'bg-slate-700/50' : 'bg-indigo-50'}`}>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Total</p>
                            <p className="text-base font-black text-indigo-600">{g.totalQty}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {mode === 'PARTIAL' && (
                      <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-[9px] font-black text-emerald-500 uppercase">Do estoque: {g.fromStockQty}</span>
                        <span className="text-[9px] font-black text-indigo-500 uppercase">Produzir: {g.toProductionQty}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary card */}
              <div className="rounded-[2rem] overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <Layers size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Lotes a criar</p>
                        <p className="text-[10px] font-bold text-indigo-200">Total para produção</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-white leading-none">{totalToProduction}</p>
                      <p className="text-[9px] font-black text-indigo-200 uppercase mt-0.5">unidades</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <User size={12} className="text-indigo-200" />
                    <span className="text-[10px] font-bold text-indigo-200">{sale.customerName || 'Avulso'}</span>
                    <span className="text-indigo-400 mx-1">•</span>
                    <Calendar size={12} className="text-indigo-200" />
                    <span className="text-[10px] font-bold text-indigo-200">
                      Entrega: {deliveryDate ? new Date(deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div className={`px-6 py-4 border-t flex flex-col gap-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800">
                <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-relaxed">{error}</p>
              </div>
            )}
            {computed.length === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-relaxed">
                  Nenhum item encontrado. Verifique se os produtos da venda estão cadastrados no sistema.
                </p>
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={isSaving || totalToProduction === 0}
              className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                isSaving || totalToProduction === 0
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 active:scale-[0.99]'
              }`}
            >
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Gerando...</>
              ) : totalToProduction === 0 ? (
                'Nenhum item para produção'
              ) : (
                <><CheckCircle2 size={16} /> Confirmar e Gerar {computed.filter(g => g.toProductionQty > 0).length} Lote(s)</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
