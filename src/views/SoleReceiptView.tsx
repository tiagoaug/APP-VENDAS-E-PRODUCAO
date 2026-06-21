import React, { useState, useMemo } from 'react';
import { Purchase, Person, PurchaseType, SoleStockEntry, ProductionLot, Product } from '../types';
import { computeSoleMapaReservations } from '../utils/soleNeeds';
import {
  Search,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Plus,
  Minus,
  Check,
  RefreshCw,
  X,
  History as HistoryIcon,
  Footprints,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { firebaseService } from '../services/firebaseService';

interface SoleReceiptViewProps {
  purchases: Purchase[];
  suppliers: Person[];
  soleStockEntries?: SoleStockEntry[];
  productionLots?: ProductionLot[];
  products?: Product[];
  onBack: () => void;
  isDarkMode: boolean;
}

// Compras de solados: tipo SOLE (aba "Solados" de Compras) ou REPLENISHMENT
// com itens de molde (fluxo legado de "Lançamento de Compra" de solados).
const isSolePurchase = (p: Purchase): boolean => {
  if (p.type === PurchaseType.SOLE) return true;
  if (p.type === PurchaseType.REPLENISHMENT) {
    const rawItems: any[] = (p as any).items || [];
    const hasSoleItems = rawItems.some((i: any) => i.moldId);
    const hasSoleItemsField = ((p as any).soleItems || []).length > 0;
    return hasSoleItems || hasSoleItemsField;
  }
  return false;
};

const getSoleItems = (p: Purchase): any[] =>
  (p as any).soleItems || (p as any).items?.filter((i: any) => i.moldId) || [];

export default function SoleReceiptView({
  purchases,
  suppliers,
  soleStockEntries,
  productionLots,
  products,
  onBack,
  isDarkMode,
}: SoleReceiptViewProps) {
  const reservations = useMemo(
    () => computeSoleMapaReservations(productionLots || [], products || [], soleStockEntries || []),
    [productionLots, products, soleStockEntries]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  // Quantidades sendo recebidas agora. Chave: `${purchaseId}-sole-${itemIdx}-${size}` -> number
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  const [loadingPurchaseId, setLoadingPurchaseId] = useState<string | null>(null);
  const [showReceived, setShowReceived] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [revertModal, setRevertModal] = useState<{ purchase: Purchase; soleItems: any[] } | null>(null);
  const [revertQtys, setRevertQtys] = useState<Record<string, number>>({});
  const [successToast, setSuccessToast] = useState<{ message: string; details?: string[] } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const openRevertModal = (p: Purchase) => {
    const soleItems = getSoleItems(p);
    const initQtys: Record<string, number> = {};
    soleItems.forEach((item: any, idx: number) => {
      const qtys: Record<string, number> = item.totalReceivedQtys || item.quantities || {};
      Object.entries(qtys).forEach(([size, qty]: [string, any]) => {
        if (Number(qty) > 0) initQtys[`${idx}-${size}`] = Number(qty);
      });
    });
    setRevertQtys(initQtys);
    setRevertModal({ purchase: p, soleItems });
  };

  const handlePartialRevert = async () => {
    if (!revertModal) return;
    const { purchase, soleItems } = revertModal;
    setRevertingId(purchase.id);
    try {
      const updatedSoleItems = soleItems.map((item: any, idx: number) => {
        const prevReceived: Record<string, number> = item.totalReceivedQtys || item.quantities || {};
        const newTotalReceived: Record<string, number> = {};
        const newRemaining: Record<string, number> = { ...(item.quantities || {}) };
        Object.keys(prevReceived).forEach(size => {
          const toRevert = revertQtys[`${idx}-${size}`] ?? 0;
          const wasThere = Number(prevReceived[size]) || 0;
          newTotalReceived[size] = Math.max(0, wasThere - toRevert);
          newRemaining[size] = (Number(newRemaining[size]) || 0) + toRevert;
        });
        return { ...item, totalReceivedQtys: newTotalReceived, quantities: newRemaining };
      });

      // Reverte soleStock
      for (let idx = 0; idx < soleItems.length; idx++) {
        const item = soleItems[idx];
        if (!item.moldId) continue;
        const existing = (soleStockEntries || []).find((s: any) => s.moldId === item.moldId && s.colorId === item.colorId);
        if (existing) {
          const updatedStock = { ...existing.stock };
          const prevReceived: Record<string, number> = item.totalReceivedQtys || item.quantities || {};
          Object.keys(prevReceived).forEach(size => {
            const toRevert = revertQtys[`${idx}-${size}`] ?? 0;
            updatedStock[size] = (updatedStock[size] || 0) - toRevert;
          });
          const totalPairs = Object.values(updatedStock).reduce((a: number, b: any) => a + Number(b), 0);
          await firebaseService.updateDocument('soleStock', existing.id, { stock: updatedStock, totalPairs, updatedAt: Date.now() });
        }
      }

      const allReverted = updatedSoleItems.every((item: any) =>
        Object.values(item.totalReceivedQtys || {}).every((v: any) => Number(v) === 0)
      );
      const isSoleType = !!(purchase as any).soleItems;
      await firebaseService.saveDocument('purchases', {
        ...purchase,
        ...(isSoleType ? { soleItems: updatedSoleItems } : { items: updatedSoleItems }),
        registerAsReceived: !allReverted && purchase.registerAsReceived ? false : purchase.registerAsReceived && !allReverted,
      });

      setSuccessToast({ message: allReverted ? 'Reversão total concluída.' : 'Reversão parcial concluída.', details: [] });
      setTimeout(() => setSuccessToast(null), 3000);
      setRevertModal(null);
    } catch {
      setErrorToast('Erro ao reverter.');
    } finally {
      setRevertingId(null);
    }
  };

  const receivedCount = useMemo(() => purchases.filter(p => {
    if (!isSolePurchase(p)) return false;
    if (p.registerAsReceived === true) return true;
    return getSoleItems(p).some((item: any) => item.totalReceivedQtys && Object.values(item.totalReceivedQtys).some((v: any) => Number(v) > 0));
  }).length, [purchases]);

  const historyList = useMemo(() => purchases
    .filter(p => {
      if (!isSolePurchase(p)) return false;
      if (p.registerAsReceived === true) return true;
      return getSoleItems(p).some((item: any) => item.totalReceivedQtys && Object.values(item.totalReceivedQtys).some((v: any) => Number(v) > 0));
    })
    .sort((a, b) => b.date - a.date), [purchases]);

  // Compras de solados pendentes de recebimento
  const pendingPurchases = useMemo(() => {
    return purchases
      .filter((p) => {
        if (!isSolePurchase(p)) return false;
        if (p.registerAsReceived === true) return false;

        const supplier = suppliers.find((s) => s.id === p.supplierId);
        const lowerSearch = searchQuery.toLowerCase();

        if (supplierFilter !== 'ALL' && p.supplierId !== supplierFilter) return false;

        if (searchQuery.trim()) {
          const supplierMatch = supplier?.name.toLowerCase().includes(lowerSearch);
          const notesMatch = p.notes?.toLowerCase().includes(lowerSearch);
          const batchMatch = p.batchNumber?.toLowerCase().includes(lowerSearch);
          const idMatch = p.id.toLowerCase().includes(lowerSearch);

          if (!supplierMatch && !notesMatch && !batchMatch && !idMatch) return false;
        }

        return true;
      })
      .sort((a, b) => b.date - a.date);
  }, [purchases, suppliers, supplierFilter, searchQuery]);

  // Inicializa os campos de recebimento ao expandir uma compra
  const handleToggleExpand = (purchase: Purchase) => {
    if (expandedPurchaseId === purchase.id) {
      setExpandedPurchaseId(null);
    } else {
      setExpandedPurchaseId(purchase.id);

      const newQuantities = { ...receivedQuantities };
      getSoleItems(purchase).forEach((item: any, idx: number) => {
        Object.entries(item.quantities || {}).forEach(([size]: [string, any]) => {
          const key = `${purchase.id}-sole-${idx}-${size}`;
          newQuantities[key] = 0; // sempre começa do zero — o usuário informa o que está recebendo agora
        });
      });
      setReceivedQuantities(newQuantities);
    }
  };

  // Confirma o recebimento (total ou parcial) e atualiza o estoque de solados
  const handleConfirmReceipt = async (purchase: Purchase) => {
    const verifiedPurchase = purchases.find((p) => p.id === purchase.id);
    if (!verifiedPurchase) {
      setErrorToast('Erro: Esta compra não foi encontrada no sistema. O recebimento foi cancelado.');
      setTimeout(() => setErrorToast(null), 5000);
      return;
    }

    setLoadingPurchaseId(purchase.id);
    setErrorToast(null);

    try {
      const soleItems = getSoleItems(purchase);
      const updatedSoleItems: any[] = [];
      const stockSuccessList: string[] = [];
      let hasRemainingQty = false;

      for (let idx = 0; idx < soleItems.length; idx++) {
        const item = soleItems[idx];
        if (!item.moldId) { updatedSoleItems.push(item); continue; }

        const receivedQtys: Record<string, number> = {};
        const remainingQtys: Record<string, number> = {};
        Object.entries(item.quantities || {}).forEach(([size, ordered]: [string, any]) => {
          const key = `${purchase.id}-sole-${idx}-${size}`;
          const received = Math.min(receivedQuantities[key] ?? Number(ordered), Number(ordered));
          receivedQtys[size] = received;
          remainingQtys[size] = Number(ordered) - received;
          if (remainingQtys[size] > 0) hasRemainingQty = true;
        });

        const totalReceived = Object.values(receivedQtys).reduce((a: number, b: number) => a + b, 0);
        if (totalReceived > 0) {
          const existingEntry = (soleStockEntries || []).find(
            (s: any) => s.moldId === item.moldId && s.colorId === item.colorId
          );
          if (existingEntry) {
            const updatedStock = { ...existingEntry.stock };
            Object.entries(receivedQtys).forEach(([size, qty]) => {
              updatedStock[size] = (updatedStock[size] || 0) + qty;
            });
            const totalPairs = Object.values(updatedStock).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0);
            await firebaseService.updateDocument('soleStock', existingEntry.id, {
              stock: updatedStock, totalPairs,
              unitCost: item.unitCost,
              totalCost: totalPairs * (Number(item.unitCost) || 0),
              updatedAt: Date.now()
            });
          } else {
            await firebaseService.saveDocument('soleStock', {
              moldId: item.moldId, moldName: item.moldName || '',
              colorId: item.colorId || '', colorName: item.colorName || '',
              stock: receivedQtys, totalPairs: totalReceived,
              unitCost: Number(item.unitCost) || 0,
              totalCost: totalReceived * (Number(item.unitCost) || 0),
              updatedAt: Date.now()
            });
          }
          stockSuccessList.push(`${item.moldName || 'Solado'} ${item.colorName || ''}: +${totalReceived} PAR`);
        }

        const prevReceived: Record<string, number> = item.totalReceivedQtys || {};
        const newTotalReceived: Record<string, number> = {};
        Object.keys(receivedQtys).forEach(size => {
          newTotalReceived[size] = (prevReceived[size] || 0) + (receivedQtys[size] || 0);
        });
        updatedSoleItems.push({ ...item, quantities: remainingQtys, totalReceivedQtys: newTotalReceived });
      }

      const isSoleType = !!(purchase as any).soleItems;
      const updatedPurchase: any = {
        ...purchase,
        ...(isSoleType ? { soleItems: updatedSoleItems } : { items: updatedSoleItems }),
        registerAsReceived: !hasRemainingQty,
      };
      await firebaseService.saveDocument('purchases', updatedPurchase);

      if (hasRemainingQty) {
        setSuccessToast({ message: 'Recebimento parcial registrado!', details: ['Os itens restantes continuam pendentes de entrega.'] });
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setSuccessToast({ message: 'Recebimento total confirmado!', details: stockSuccessList });
        setTimeout(() => setSuccessToast(null), 3000);
      }
      setExpandedPurchaseId(null);
    } catch (err) {
      console.error('Error during sole receipt confirmation:', err);
      setErrorToast('Ocorreu um erro ao registrar o recebimento. Tente novamente.');
    } finally {
      setLoadingPurchaseId(null);
    }
  };

  return (
    <div className={`flex flex-col min-h-screen pb-20 ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      {/* Revert Modal */}
      {revertModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRevertModal(null)} />
          <div className={`relative w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">Reverter Recebimento</h3>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Ajuste as quantidades a reverter</p>
            </div>
            <div className="p-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
              {revertModal.soleItems.map((item: any, idx: number) => {
                const receivedQtys: Record<string, number> = item.totalReceivedQtys || item.quantities || {};
                const sizesWithQty = Object.entries(receivedQtys).filter(([, qty]) => Number(qty) > 0);
                if (sizesWithQty.length === 0) return null;
                return (
                  <div key={idx} className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-slate-700 dark:text-slate-200">{item.moldName}</p>
                      <span className="text-[9px] font-bold text-violet-500 uppercase">{item.colorName}</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {sizesWithQty.map(([size, max]: [string, any]) => {
                        const key = `${idx}-${size}`;
                        const val = revertQtys[key] ?? Number(max);
                        return (
                          <div key={size} className="flex items-center justify-between gap-2">
                            <div className="w-20">
                              <p className="text-sm font-black text-slate-700 dark:text-slate-200">{size}</p>
                              <p className="text-[9px] text-slate-400 font-bold">Recebido: {max}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-1 justify-end">
                              <button type="button" title="Diminuir" onClick={() => setRevertQtys(p => ({ ...p, [key]: Math.max(0, val - 1) }))} className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center active:scale-95 transition-all"><Minus size={12} /></button>
                              <input
                                type="number" min={0} max={Number(max)}
                                value={val}
                                title={`Reverter tamanho ${size}`}
                                aria-label={`Reverter tamanho ${size}`}
                                onChange={e => setRevertQtys(p => ({ ...p, [key]: Math.min(Number(max), Math.max(0, parseInt(e.target.value) || 0)) }))}
                                className={`w-14 text-center text-sm font-black rounded-lg border-2 py-1.5 outline-none ${val > 0 ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-600' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400'}`}
                              />
                              <button type="button" title="Aumentar" onClick={() => setRevertQtys(p => ({ ...p, [key]: Math.min(Number(max), val + 1) }))} className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center active:scale-95 transition-all"><Plus size={12} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 pb-4 flex gap-3">
              <button type="button" onClick={() => setRevertModal(null)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all">Cancelar</button>
              <button
                type="button"
                disabled={revertingId === revertModal.purchase.id}
                onClick={handlePartialRevert}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {revertingId === revertModal.purchase.id ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/40 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 flex items-center justify-center text-slate-400 hover:text-cyan-500 hover:border-cyan-500/20 active:scale-95 transition-all shadow-sm"
            aria-label="Voltar"
            title="Voltar"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider leading-none text-slate-800 dark:text-white">
              Conferência de Compras (Solas)
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
              <Footprints size={12} className="text-cyan-500" />
              Recebimento e conferência de solados comprados
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-5xl w-full mx-auto flex-1 flex flex-col gap-6">

        {/* Toast Alerts */}
        {successToast && (
          <div className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 animate-in fade-in slide-in-from-top-4 flex gap-4">
            <CheckCircle2 size={24} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
            <div className="flex-1">
              <h4 className="text-xs font-black uppercase tracking-wider">{successToast.message}</h4>
              {successToast.details && successToast.details.length > 0 && (
                <ul className="mt-2 text-[10px] font-bold uppercase tracking-wide list-disc list-inside space-y-1 opacity-90">
                  {successToast.details.map((detail, dIdx) => (
                    <li key={dIdx}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-[10px] font-black uppercase tracking-widest hover:text-emerald-500"
            >
              Fechar
            </button>
          </div>
        )}

        {errorToast && (
          <div className="p-5 rounded-3xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 animate-in fade-in slide-in-from-top-4 flex gap-4">
            <AlertCircle size={24} className="text-rose-500 shrink-0" strokeWidth={2.5} />
            <div className="flex-1">
              <h4 className="text-xs font-black uppercase tracking-wider">Erro no Recebimento</h4>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90">{errorToast}</p>
            </div>
            <button
              onClick={() => setErrorToast(null)}
              className="text-[10px] font-black uppercase tracking-widest hover:text-rose-500"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Filters Panel */}
        <section className="flex flex-col gap-3">

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 dark:text-cyan-500" size={18} strokeWidth={3} />
            <input
              type="text"
              placeholder="BUSCAR POR FORNECEDOR OU LOTE..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-4 focus:ring-cyan-500/5 focus:border-cyan-500 transition-all text-slate-800 dark:text-white uppercase tracking-widest"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Pesquisar recebimentos de solados"
              title="Pesquisar"
            />
          </div>

          {/* Supplier Dropdown + Histórico */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl pl-5 pr-10 py-4 text-xs font-black focus:ring-4 focus:ring-cyan-500/5 focus:border-cyan-500 transition-all text-slate-800 dark:text-white uppercase tracking-widest cursor-pointer appearance-none truncate"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                aria-label="Filtrar por fornecedor"
                title="Fornecedor"
              >
                <option value="ALL">TODOS OS FORNECEDORES</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                <ChevronDown size={16} className="text-cyan-400" strokeWidth={3} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowReceived(true)}
              className="relative shrink-0 w-14 h-14 sm:w-auto sm:px-5 sm:h-auto sm:py-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:from-cyan-400 hover:to-indigo-500 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
              title="Ver histórico de recebimentos"
              aria-label="Abrir histórico de recebimentos"
            >
              <HistoryIcon size={18} strokeWidth={2.5} />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Histórico</span>
              {receivedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 shadow-md shadow-amber-400/40 border-2 border-white dark:border-slate-900" />
              )}
            </button>
          </div>
        </section>

        {/* HISTÓRICO POPUP */}
        {showReceived && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowReceived(false)} />
            <div className={`relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">Histórico de Recebimentos</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Clique em Reverter para desfazer uma baixa</p>
                </div>
                <button type="button" onClick={() => setShowReceived(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" aria-label="Fechar histórico">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {historyList.map(p => {
                  const sup = suppliers.find(s => s.id === p.supplierId);
                  const soleItems = getSoleItems(p);
                  const formattedDate = p.date ? format(new Date(p.date), 'dd/MM/yyyy', { locale: ptBR }) : '---';
                  return (
                    <div key={p.id} className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white truncate">{sup?.name || 'Fornecedor'}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{formattedDate} · {p.batchNumber} · R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            {p.registerAsReceived
                              ? <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md uppercase tracking-widest">Total</span>
                              : <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md uppercase tracking-widest">Parcial</span>
                            }
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => openRevertModal(p)}
                            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-900/20 text-rose-500 border border-rose-100 dark:border-rose-800/40 hover:bg-rose-100 active:scale-95 transition-all flex items-center gap-2"
                            title="Reverter recebimento" aria-label="Reverter recebimento"
                          >
                            <RefreshCw size={13} />
                            Reverter
                          </button>
                        </div>
                      </div>

                      {soleItems.length > 0 && (
                        <div className={`mx-3 mb-3 p-3 rounded-xl ${isDarkMode ? 'bg-slate-900/50' : 'bg-white border border-slate-100'}`}>
                          {soleItems.map((item: any, idx: number) => {
                            const receivedQtys: Record<string, number> = item.totalReceivedQtys || item.quantities || {};
                            const totalRec = Object.values(receivedQtys).reduce((a: number, b: any) => a + Number(b), 0);
                            return (
                              <div key={idx} className={idx > 0 ? 'mt-3 pt-3 border-t border-slate-100 dark:border-slate-800' : ''}>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">{item.moldName}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-violet-500 uppercase">{item.colorName}</span>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">{totalRec} PAR</span>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {Object.entries(receivedQtys).filter(([, qty]) => Number(qty) > 0).map(([size, qty]: [string, any]) => (
                                    <div key={size} className="flex items-center justify-between">
                                      <span className="text-sm font-black text-slate-600 dark:text-slate-300">{size}</span>
                                      <span className="text-sm font-black text-slate-800 dark:text-white">{qty} pares</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {historyList.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-10">Nenhum recebimento registrado ainda.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Purchases List */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">
              Compras de Solados Aguardando Recebimento ({pendingPurchases.length})
            </h3>
          </div>

          {pendingPurchases.length > 0 ? (
            pendingPurchases.map((purchase) => {
              const supplier = suppliers.find((s) => s.id === purchase.supplierId);
              const isExpanded = expandedPurchaseId === purchase.id;
              const soleItemsList = getSoleItems(purchase);
              const formattedDate = purchase.date
                ? format(new Date(purchase.date), 'dd/MM/yyyy', { locale: ptBR })
                : '---';

              return (
                <div
                  key={purchase.id}
                  className={`rounded-[2rem] border transition-all ${
                    isExpanded
                      ? 'bg-white dark:bg-slate-900 border-cyan-500/30 shadow-xl shadow-cyan-500/5'
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/80 shadow-sm'
                  }`}
                >
                  {/* Card Header Row */}
                  <div
                    onClick={() => handleToggleExpand(purchase)}
                    className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/20 text-cyan-500 flex items-center justify-center border border-cyan-100/40 dark:border-cyan-900/30 shrink-0">
                        <Footprints size={22} strokeWidth={2} />
                      </div>

                      <div>
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-500 border border-amber-100/50 dark:border-amber-900/20">
                          <Clock size={10} />
                          AGUARDANDO CONFERÊNCIA
                        </span>

                        <h4 className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-white mt-1">
                          {supplier?.name || 'Fornecedor Desconhecido'}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-cyan-400" />
                            {formattedDate}
                          </span>
                          {purchase.batchNumber && (
                            <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800">
                              LOTE: {purchase.batchNumber}
                            </span>
                          )}
                          <span>
                            {soleItemsList.length} ITENS
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 dark:border-slate-800/60 pt-3 md:pt-0">
                      <div className="text-right">
                        <p className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest leading-none mb-1">
                          Total da Compra
                        </p>
                        <p className="text-sm font-black text-slate-800 dark:text-white leading-none">
                          R$ {purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-cyan-400 dark:text-cyan-500">
                        {isExpanded ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Item Receipt List */}
                  {isExpanded && (
                    <div className="px-5 pb-6 border-t border-slate-50 dark:border-slate-800/60 mt-2 pt-4">
                      {soleItemsList.length > 0 ? (
                        <div className="flex flex-col gap-4">

                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2.5">
                            <AlertCircle size={16} className="text-cyan-400 shrink-0" strokeWidth={2.5} />
                            <span>Confirme as quantidades recebidas abaixo antes de registrar no estoque.</span>
                          </div>

                          <div className="flex flex-col gap-3">
                            {soleItemsList.map((item: any, idx: number) => {
                              const remainingTotal = Object.values(item.quantities || {}).reduce((a: number, b: any) => a + Number(b), 0);
                              const receivedTotal = Object.keys(item.quantities || {}).reduce((a: number, size: string) => {
                                const key = `${purchase.id}-sole-${idx}-${size}`;
                                return a + (receivedQuantities[key] ?? 0);
                              }, 0);
                              const isPartial = receivedTotal < remainingTotal;
                              return (
                                <div key={idx} className={`p-3 rounded-xl border ${isPartial ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">{item.moldName}</p>
                                    <span className="text-[9px] font-bold text-violet-500 uppercase">{item.colorName}</span>
                                  </div>
                                  <div className="mb-2">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                      Faltando: <span className="text-amber-600 dark:text-amber-400 font-black">{remainingTotal} pares</span>
                                      {receivedTotal > 0 && <> — Recebendo agora: <span className="text-emerald-600 dark:text-emerald-400 font-black">{receivedTotal} pares</span></>}
                                    </p>
                                  </div>
                                  <div className="flex flex-col gap-3 mt-1">
                                    {Object.entries(item.quantities || {}).sort(([a], [b]) => parseFloat(a) - parseFloat(b)).map(([size, remaining]: [string, any]) => {
                                      const key = `${purchase.id}-sole-${idx}-${size}`;
                                      const val = receivedQuantities[key] ?? 0;
                                      const max = Number(remaining);
                                      return (
                                        <div key={size} className="flex items-center justify-between gap-3">
                                          <div className="flex flex-col gap-0.5 w-28">
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">{size}</span>
                                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-tight">{remaining} pendente de entrega</span>
                                          </div>
                                          <div className="flex items-center gap-2 flex-1 justify-end">
                                            <button type="button" title="Diminuir" aria-label="Diminuir" onClick={() => setReceivedQuantities(p => ({ ...p, [key]: Math.max(0, val - 1) }))} className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black active:scale-95 transition-all"><Minus size={14} /></button>
                                            <input
                                              type="number" min={0} max={max}
                                              title={`Receber tamanho ${size}`}
                                              aria-label={`Receber tamanho ${size}`}
                                              value={val}
                                              onChange={e => setReceivedQuantities(p => ({ ...p, [key]: Math.min(max, Math.max(0, parseInt(e.target.value) || 0)) }))}
                                              className={`w-16 text-center text-base font-black rounded-xl border-2 py-2 outline-none transition-all ${val > 0 ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}
                                            />
                                            <button type="button" title="Aumentar" aria-label="Aumentar" onClick={() => setReceivedQuantities(p => ({ ...p, [key]: Math.min(max, val + 1) }))} className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black active:scale-95 transition-all"><Plus size={14} /></button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex flex-col items-stretch gap-2 mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/50">
                                    <button
                                      type="button"
                                      title="Receber parcial"
                                      onClick={() => {
                                        const updates: Record<string, number> = {};
                                        Object.entries(item.quantities || {}).forEach(([size]: [string, any]) => {
                                          updates[`${purchase.id}-sole-${idx}-${size}`] = 0;
                                        });
                                        setReceivedQuantities(p => ({ ...p, ...updates }));
                                      }}
                                      className="w-full text-center py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 active:scale-[0.98] transition-all"
                                    >
                                      Receber parcial
                                    </button>
                                    <button
                                      type="button"
                                      title="Receber tudo"
                                      onClick={() => {
                                        const updates: Record<string, number> = {};
                                        Object.entries(item.quantities || {}).forEach(([size, qty]: [string, any]) => {
                                          updates[`${purchase.id}-sole-${idx}-${size}`] = Number(qty);
                                        });
                                        setReceivedQuantities(p => ({ ...p, ...updates }));
                                      }}
                                      className="w-full text-center py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 active:scale-[0.98] transition-all"
                                    >
                                      Receber tudo
                                    </button>
                                    <button
                                      type="button"
                                      title="Receber as quantidades que faltam nos mapas"
                                      onClick={() => {
                                        const reservedByGrade = reservations[`${item.moldId}_${item.colorId || 'default'}`]?.reservedByGrade || {};
                                        const stockEntry = (soleStockEntries || []).find((s: any) => s.moldId === item.moldId && s.colorId === item.colorId);
                                        const currentStock = stockEntry?.stock || {};
                                        const updates: Record<string, number> = {};
                                        Object.entries(item.quantities || {}).forEach(([size, qty]: [string, any]) => {
                                          const deficit = Math.max(0, (reservedByGrade[size] || 0) - (Number(currentStock[size]) || 0));
                                          updates[`${purchase.id}-sole-${idx}-${size}`] = Math.min(Number(qty), deficit);
                                        });
                                        setReceivedQuantities(p => ({ ...p, ...updates }));
                                      }}
                                      className="w-full text-center py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 active:scale-[0.98] transition-all"
                                    >
                                      Receber o que falta nos mapas
                                    </button>
                                    <p className="text-[9px] text-slate-400 text-right">Custo un.: R$ {Number(item.unitCost || 0).toFixed(2)}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-end gap-3 mt-4 border-t border-slate-50 dark:border-slate-800/60 pt-4">
                            <button
                              type="button"
                              onClick={() => setExpandedPurchaseId(null)}
                              className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 dark:text-slate-500 transition-colors"
                              aria-label="Cancelar recebimento"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={loadingPurchaseId === purchase.id}
                              onClick={() => handleConfirmReceipt(purchase)}
                              className="px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-cyan-600/10 flex items-center gap-2 active:scale-95 transition-all"
                              aria-label="Confirmar recebimento de itens"
                              title="Registrar recebimento no estoque"
                            >
                              {loadingPurchaseId === purchase.id ? (
                                <><RefreshCw size={14} className="animate-spin" /> REGISTRANDO...</>
                              ) : (
                                <><Check size={14} strokeWidth={3} /> Confirmar Recebimento</>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-[0.2em] italic">
                            Esta compra não possui itens detalhados.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-24 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40 rounded-[3rem] flex flex-col items-center justify-center p-6 shadow-sm">
              <CheckCircle2
                size={48}
                className="text-cyan-400 dark:text-cyan-500 mb-4"
                strokeWidth={1.5}
              />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
                Tudo Recebido!
              </h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mt-2 max-w-sm leading-relaxed">
                Nenhuma compra de solados pendente de recebimento foi encontrada. Tudo o que foi comprado já está conferido no estoque.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
