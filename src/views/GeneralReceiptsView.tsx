import React, { useState, useMemo } from 'react';
import { Purchase, Person, ProductionConfigItem, PurchaseRequest, PurchaseType, PaymentTerm, PaymentStatus } from '../types';
import {
  Package,
  Calendar,
  Search,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  DollarSign,
  Plus,
  Minus,
  Check,
  ClipboardList,
  RefreshCw,
  Trash2,
  X,
  Pencil,
  History as HistoryIcon,
  Footprints,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { firebaseService } from '../services/firebaseService';
import DatePicker from '../components/DatePicker';

interface GeneralReceiptsViewProps {
  purchases: Purchase[];
  suppliers: Person[];
  productionConfigs: ProductionConfigItem[];
  purchaseRequests: PurchaseRequest[];
  onBack: () => void;
  isDarkMode: boolean;
  onEditPurchase?: (id: string) => void;
  onOpenSoleReceipt?: () => void;
}

export default function GeneralReceiptsView({
  purchases,
  suppliers,
  productionConfigs,
  purchaseRequests,
  onBack,
  isDarkMode,
  onEditPurchase,
  onOpenSoleReceipt,
}: GeneralReceiptsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  // Track received quantities. Key: `${purchaseId}-${itemIndex}` -> number
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  const [loadingPurchaseId, setLoadingPurchaseId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [showReceived, setShowReceived] = useState(false);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [confirmItemRevert, setConfirmItemRevert] = useState<{ purchaseId: string; itemIdx: number } | null>(null);
  const [revertingItemKey, setRevertingItemKey] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ message: string; details?: string[] } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const handleDelete = async (purchaseId: string) => {
    try {
      await firebaseService.deleteDocument('purchases', purchaseId);
      setConfirmDeleteId(null);
    } catch {
      setErrorToast('Erro ao excluir compra.');
    }
  };

  const receivedCount = useMemo(() => purchases.filter(p =>
    p.type === PurchaseType.GENERAL && p.registerAsReceived === true
  ).length, [purchases]);

  // Filter purchases: General materials pending receipt
  const pendingPurchases = useMemo(() => {
    return purchases
      .filter((p) => {
        if (p.type !== PurchaseType.GENERAL) return false;
        // Must NOT be registered as received yet
        if (p.registerAsReceived === true) return false;

        const supplier = suppliers.find((s) => s.id === p.supplierId);
        const lowerSearch = searchQuery.toLowerCase();

        // Filter by supplier selector
        if (supplierFilter !== 'ALL' && p.supplierId !== supplierFilter) return false;

        // Search filter
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

  // Initializing received quantities for a purchase when expanded
  const handleToggleExpand = (purchase: Purchase) => {
    if (expandedPurchaseId === purchase.id) {
      setExpandedPurchaseId(null);
    } else {
      setExpandedPurchaseId(purchase.id);

      // Initialize inputs to the purchase's general items quantity
      const newQuantities = { ...receivedQuantities };
      purchase.generalItems?.forEach((item, idx) => {
        const key = `${purchase.id}-${idx}`;
        if (newQuantities[key] === undefined) {
          newQuantities[key] = item.quantity || 0;
        }
      });
      setReceivedQuantities(newQuantities);
    }
  };

  // Adjust quantity handlers
  const handleSetQty = (purchaseId: string, itemIdx: number, val: number) => {
    const key = `${purchaseId}-${itemIdx}`;
    setReceivedQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  const handleAdjustQty = (purchaseId: string, itemIdx: number, delta: number) => {
    const key = `${purchaseId}-${itemIdx}`;
    const current = receivedQuantities[key] || 0;
    setReceivedQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, current + delta),
    }));
  };

  const handleReceiveAll = (purchase: Purchase, itemIdx: number) => {
    const key = `${purchase.id}-${itemIdx}`;
    const originalQty = purchase.generalItems?.[itemIdx].quantity || 0;
    setReceivedQuantities((prev) => ({
      ...prev,
      [key]: originalQty,
    }));
  };

  // Confirm receipt action
  const handleConfirmReceipt = async (purchase: Purchase) => {
    // 1. Dependency Validation Check: Verify that this purchase record still exists in the system
    const verifiedPurchase = purchases.find((p) => p.id === purchase.id);
    if (!verifiedPurchase) {
      setErrorToast('Erro: Esta compra não foi encontrada no sistema. O recebimento foi cancelado.');
      setTimeout(() => setErrorToast(null), 5000);
      return;
    }

    setLoadingPurchaseId(purchase.id);
    setErrorToast(null);
    
    try {
      const itemsToReceive = purchase.generalItems || [];
      const stockSuccessList: string[] = [];

      // Mapa local para acumular estoque de materiais que aparecem mais de uma vez
      // na mesma compra (ex: mesma etiqueta em cores diferentes). Sem isso, cada
      // iteração leria o valor desatualizado do estado React e a última escrita
      // sobrescreveria todas as anteriores com o total errado.
      const localStock = new Map<string, { stock: number; stockByColor: Record<string, number> }>();

      // 2. Loop through general items to update production config stocks
      for (let i = 0; i < itemsToReceive.length; i++) {
        const item = itemsToReceive[i];
        const key = `${purchase.id}-${i}`;
        const receivedQty = receivedQuantities[key] ?? (item.quantity || 0);

        if (item.materialId && receivedQty > 0) {
          const material = productionConfigs.find((c) => c.id === item.materialId);
          if (material) {
            // Inicializa o acumulador local na primeira vez que esse material aparece
            if (!localStock.has(item.materialId)) {
              localStock.set(item.materialId, {
                stock: material.metadata?.stock || 0,
                stockByColor: { ...(material.metadata?.stockByColor || {}) },
              });
            }

            const local = localStock.get(item.materialId)!;
            local.stock += receivedQty;
            if (item.colorId) {
              local.stockByColor[item.colorId] = (local.stockByColor[item.colorId] || 0) + receivedQty;
            }

            await firebaseService.saveDocument('productionConfigs', {
              ...material,
              metadata: {
                ...material.metadata,
                stock: local.stock,
                stockByColor: local.stockByColor,
              },
            });

            stockSuccessList.push(`${material.name}: +${receivedQty} ${material.metadata?.unitId || 'UN'}`);
          }
        }
      }

      // 3. Update the Purchase request itself to mark as received
      const updatedPurchase: Purchase = {
        ...purchase,
        registerAsReceived: true,
      };
      await firebaseService.saveDocument('purchases', updatedPurchase);

      // 4. Update the PurchaseRequest if this purchase is linked to one
      if (purchase.requestId) {
        const req = purchaseRequests.find((r) => r.id === purchase.requestId);
        if (req) {
          const totalReceivedQty = itemsToReceive.reduce((sum, _, idx) => {
            const k = `${purchase.id}-${idx}`;
            return sum + (receivedQuantities[k] ?? 0);
          }, 0);
          
          const newReceivedQty = (req.receivedQty || 0) + totalReceivedQty;
          const isFullyReceived = newReceivedQty >= req.requiredQty;
          
          await firebaseService.updateDocument('purchaseRequests', req.id, {
            receivedQty: newReceivedQty,
            status: isFullyReceived ? 'RECEIVED' : 'ORDERED',
            updatedAt: Date.now(),
          });
          
          stockSuccessList.push(`Solicitação de Compra atualizada (${newReceivedQty}/${req.requiredQty})`);
        }
      } else {
        // Fallback: If no explicit requestId but purchase contains materials matching an open request, update it
        for (let i = 0; i < itemsToReceive.length; i++) {
          const item = itemsToReceive[i];
          if (item.materialId) {
            const key = `${purchase.id}-${i}`;
            const receivedQty = receivedQuantities[key] ?? 0;
            
            if (receivedQty > 0) {
              const matchingReq = purchaseRequests.find(
                (r) => r.materialId === item.materialId && (r.status === 'PENDING' || r.status === 'IN_PROGRESS' || r.status === 'ORDERED')
              );
              
              if (matchingReq) {
                const newReceivedQty = (matchingReq.receivedQty || 0) + receivedQty;
                const isFullyReceived = newReceivedQty >= matchingReq.requiredQty;
                
                await firebaseService.updateDocument('purchaseRequests', matchingReq.id, {
                  receivedQty: newReceivedQty,
                  status: isFullyReceived ? 'RECEIVED' : 'ORDERED',
                  updatedAt: Date.now(),
                });
                
                stockSuccessList.push(`Solicitação de "${matchingReq.name}" vinculada e atualizada`);
              }
            }
          }
        }
      }

      // Success feedback
      setSuccessToast({
        message: 'Recebimento de estoque registrado com sucesso!',
        details: stockSuccessList,
      });
      
      // Auto-close success toast
      setTimeout(() => setSuccessToast(null), 7000);
      
      // Close detail view and clear inputs
      setExpandedPurchaseId(null);
      
    } catch (err) {
      console.error('Error during receipt confirmation:', err);
      setErrorToast('Ocorreu um erro ao registrar o recebimento. Tente novamente.');
    } finally {
      setLoadingPurchaseId(null);
    }
  };

  // Reverter recebimento: desfaz a baixa feita na conferência — devolve o estoque
  // (total e por cor) de cada item, devolve a solicitação vinculada e marca a compra
  // como pendente novamente, voltando para a lista de "Aguardando Recebimento".
  // Observação: como a conferência não guarda a quantidade recebida por item, a
  // reversão usa a quantidade comprada (item.quantity) — coerente com "Receber Tudo".
  const handleRevertReceipt = async (purchase: Purchase) => {
    setRevertingId(purchase.id);
    setErrorToast(null);
    try {
      const items = purchase.generalItems || [];
      const revertedList: string[] = [];

      // Mesmo acumulador local do confirm: evita que múltiplos itens do mesmo
      // material leiam o estado React congelado e se sobrescrevam mutuamente.
      const localStock = new Map<string, { stock: number; stockByColor: Record<string, number> }>();

      for (const item of items) {
        const qty = item.quantity || 0;
        if (item.materialId && qty > 0) {
          const material = productionConfigs.find(c => c.id === item.materialId);
          if (material) {
            if (!localStock.has(item.materialId)) {
              localStock.set(item.materialId, {
                stock: material.metadata?.stock || 0,
                stockByColor: { ...(material.metadata?.stockByColor || {}) },
              });
            }

            const local = localStock.get(item.materialId)!;
            local.stock = Math.max(0, local.stock - qty);
            if (item.colorId) {
              local.stockByColor[item.colorId] = Math.max(0, (local.stockByColor[item.colorId] || 0) - qty);
            }

            await firebaseService.saveDocument('productionConfigs', {
              ...material,
              metadata: {
                ...material.metadata,
                stock: local.stock,
                stockByColor: local.stockByColor,
              },
            });

            revertedList.push(`${material.name}: -${qty} ${material.metadata?.unitId || 'UN'}`);
          }
        }
      }

      // Devolve a quantidade na solicitação de compra vinculada, se houver.
      const totalQty = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
      if (purchase.requestId) {
        const req = purchaseRequests.find(r => r.id === purchase.requestId);
        if (req) {
          const newReceivedQty = Math.max(0, (req.receivedQty || 0) - totalQty);
          await firebaseService.updateDocument('purchaseRequests', req.id, {
            receivedQty: newReceivedQty,
            status: newReceivedQty >= req.requiredQty ? 'RECEIVED' : (newReceivedQty > 0 ? 'ORDERED' : 'IN_PROGRESS'),
            updatedAt: Date.now(),
          });
        }
      }

      // Marca a compra como pendente de recebimento de novo.
      await firebaseService.saveDocument('purchases', { ...purchase, registerAsReceived: false });

      setConfirmRevertId(null);
      setSuccessToast({
        message: 'Recebimento revertido com sucesso!',
        details: revertedList.length ? revertedList : undefined,
      });
      setTimeout(() => setSuccessToast(null), 7000);
    } catch (err) {
      console.error('Error during receipt revert:', err);
      setErrorToast('Ocorreu um erro ao reverter o recebimento. Tente novamente.');
    } finally {
      setRevertingId(null);
    }
  };

  // Reversão parcial: desfaz apenas um item específico da compra, sem alterar o status da compra
  const handleRevertItem = async (purchase: Purchase, itemIdx: number) => {
    const itemKey = `${purchase.id}-${itemIdx}`;
    setRevertingItemKey(itemKey);
    setErrorToast(null);
    try {
      const item = (purchase.generalItems || [])[itemIdx];
      if (!item || !item.materialId) return;
      const qty = item.quantity || 0;
      if (qty <= 0) return;

      const material = productionConfigs.find(c => c.id === item.materialId);
      if (!material) return;

      const updatedStock = Math.max(0, (material.metadata?.stock || 0) - qty);
      const stockByColor = item.colorId
        ? { ...(material.metadata?.stockByColor || {}), [item.colorId]: Math.max(0, ((material.metadata?.stockByColor || {})[item.colorId] || 0) - qty) }
        : material.metadata?.stockByColor;

      await firebaseService.saveDocument('productionConfigs', {
        ...material,
        metadata: { ...material.metadata, stock: updatedStock, ...(stockByColor ? { stockByColor } : {}) },
      });

      setConfirmItemRevert(null);
      setSuccessToast({ message: `Estoque de "${material.name}" revertido: -${qty} ${material.metadata?.unitId || 'UN'}` });
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err) {
      console.error('Error reverting item:', err);
      setErrorToast('Erro ao reverter item. Tente novamente.');
    } finally {
      setRevertingItemKey(null);
    }
  };

  return (
    <div className={`flex flex-col min-h-screen pb-20 ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      {/* Premium Header */}
      <header className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/40 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-500/20 active:scale-95 transition-all shadow-sm"
            aria-label="Voltar ao menu de estoques"
            title="Voltar"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider leading-none text-slate-800 dark:text-white">
              Recebimento de Estoques Gerais
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
              <Package size={12} className="text-indigo-500" />
              Dê entrada nos materiais comprados pendentes de recebimento
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
              type="button"
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
              type="button"
              onClick={() => setErrorToast(null)}
              className="text-[10px] font-black uppercase tracking-widest hover:text-rose-500"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Filters Panel */}
        <section className="flex flex-col gap-3">

          {/* Search Box — full width */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 dark:text-indigo-500" size={18} strokeWidth={3} />
            <input
              type="text"
              placeholder="BUSCAR POR FORNECEDOR, NOTAS OU LOTE..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all text-slate-800 dark:text-white uppercase tracking-widest"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Pesquisar recebimentos"
              title="Pesquisar"
            />
          </div>

          {/* Supplier Dropdown + Histórico — supplier takes all remaining space */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl pl-5 pr-10 py-4 text-xs font-black focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all text-slate-800 dark:text-white uppercase tracking-widest cursor-pointer appearance-none truncate"
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
                <ChevronDown size={16} className="text-indigo-400" strokeWidth={3} />
              </div>
            </div>

            {/* Histórico: colorido com badge de contagem */}
            <button
              type="button"
              onClick={() => setShowReceived(true)}
              className="relative shrink-0 w-14 h-14 sm:w-auto sm:px-5 sm:h-auto sm:py-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:from-indigo-400 hover:to-violet-500 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
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

        {/* HISTÓRICO POPUP — refeito do zero */}
        {showReceived && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              aria-label="Fechar histórico"
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
              onClick={() => { setShowReceived(false); setConfirmRevertId(null); setConfirmItemRevert(null); setExpandedReceiptId(null); }}
            />
            <div className={`relative w-full max-w-lg h-[88vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}>

              {/* Cabeçalho do popup */}
              <div className={`shrink-0 px-4 pt-4 pb-3 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                      <HistoryIcon size={15} />
                    </div>
                    <div className="min-w-0">
                      <h2 className={`text-[13px] font-black uppercase tracking-wide leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Histórico de Recebimentos
                      </h2>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {receivedCount} recebimento(s)
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setShowReceived(false); setExpandedReceiptId(null); }}
                    className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    aria-label="Fechar">
                    <X size={16} />
                  </button>
                </div>

                {/* Filtros: busca + data */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input type="text" placeholder="Fornecedor ou nº de identificação..."
                      value={receiptSearch} onChange={e => setReceiptSearch(e.target.value)}
                      className={`w-full pl-9 pr-8 py-2 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                    />
                    {receiptSearch && (
                      <button type="button" onClick={() => setReceiptSearch('')} title="Limpar" aria-label="Limpar busca"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <DatePicker
                      value={filterDate}
                      onChange={setFilterDate}
                      className={`w-[140px] px-2.5 py-2 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Lista rolável */}
              <div className={`flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-950/30' : 'bg-slate-50'}`}>
                {(() => {
                  const term = receiptSearch.trim().toLowerCase();
                  const allReceived = purchases.filter(p => p.type === PurchaseType.GENERAL && p.registerAsReceived === true);
                  const list = allReceived
                    .filter(p => {
                      if (term) {
                        const sup = suppliers.find(s => s.id === p.supplierId);
                        const hay = `${sup?.name || ''} ${p.batchNumber || ''} ${p.id || ''}`.toLowerCase();
                        if (!hay.includes(term)) return false;
                      }
                      if (filterDate && p.date && format(new Date(p.date), 'yyyy-MM-dd') !== filterDate) return false;
                      return true;
                    })
                    .sort((a, b) => b.date - a.date);

                  if (allReceived.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
                          <HistoryIcon size={22} className="text-slate-400" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nenhum recebimento registrado</p>
                      </div>
                    );
                  }

                  if (list.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <Search size={20} className="text-slate-300 dark:text-slate-600" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center px-6">
                          {filterDate ? `Nada em ${format(new Date(filterDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}` : `Sem resultados para "${receiptSearch}"`}
                        </p>
                        <button type="button" onClick={() => { setReceiptSearch(''); setFilterDate(''); }}
                          className="mt-1 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:underline">
                          Limpar filtros
                        </button>
                      </div>
                    );
                  }

                  return list.map(p => {
                    const sup = suppliers.find(s => s.id === p.supplierId);
                    const items = p.generalItems || [];
                    const dateLabel = p.date ? format(new Date(p.date), 'dd/MM/yyyy', { locale: ptBR }) : '---';
                    const isOpen = expandedReceiptId === p.id;
                    const isConfirmingAll = confirmRevertId === p.id;
                    const isRevertingAll = revertingId === p.id;

                    return (
                      <div key={p.id} className={`shrink-0 rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>

                        {/* Cabeçalho do card: fornecedor + lote + valor */}
                        <div className="px-3.5 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[12px] font-black uppercase leading-tight min-w-0 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {sup?.name || 'Fornecedor não informado'}
                            </p>
                            {p.batchNumber && (
                              <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                {p.batchNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] font-semibold text-slate-400">
                              {dateLabel} · {items.length} {items.length === 1 ? 'item' : 'itens'}
                            </span>
                            <span className={`text-[13px] font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                              R$ {(p.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Barra de ações — cores suaves */}
                        <div className={`px-2.5 py-2 flex items-center justify-between gap-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                          <button type="button" onClick={() => setExpandedReceiptId(isOpen ? null : p.id)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all active:scale-95 ${isOpen ? (isDarkMode ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600') : (isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}`}>
                            <ChevronDown size={12} strokeWidth={3} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                            {isOpen ? 'Fechar' : 'Ver itens'}
                          </button>

                          <div className="flex items-center gap-1.5">
                            {onEditPurchase && (
                              <button type="button" onClick={() => { setShowReceived(false); onEditPurchase(p.id); }}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                <Pencil size={11} /> Editar
                              </button>
                            )}
                            {isConfirmingAll ? (
                              <div className="flex items-center gap-1.5">
                                <button type="button" onClick={() => setConfirmRevertId(null)} disabled={isRevertingAll}
                                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                  Não
                                </button>
                                <button type="button" onClick={() => handleRevertReceipt(p)} disabled={isRevertingAll}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all active:scale-95 ${isDarkMode ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>
                                  {isRevertingAll ? <RefreshCw size={11} className="animate-spin" /> : <><RefreshCw size={11} /> Confirmar</>}
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => { setConfirmRevertId(p.id); setConfirmItemRevert(null); }}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all active:scale-95 ${isDarkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-500'}`}>
                                <RefreshCw size={11} /> Reverter tudo
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Acordeão: itens com reversão individual */}
                        {isOpen && (
                          <div className={`border-t ${isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'}`}>
                            {items.length === 0 && (
                              <p className="px-3.5 py-3 text-[10px] font-semibold text-slate-400 italic">Nenhum item vinculado</p>
                            )}
                            {items.map((item, idx) => {
                              const mat = productionConfigs.find(c => c.id === item.materialId);
                              const matName = mat?.name || item.description || '—';
                              const itemKey = `${p.id}-${idx}`;
                              const isConfirmingItem = confirmItemRevert?.purchaseId === p.id && confirmItemRevert?.itemIdx === idx;
                              const isRevertingItem = revertingItemKey === itemKey;

                              return (
                                <div key={idx} className={`px-3.5 py-2 flex items-center justify-between gap-3 ${idx > 0 ? (isDarkMode ? 'border-t border-slate-800/70' : 'border-t border-slate-200/70') : ''}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] font-bold uppercase leading-snug ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                      {matName}
                                    </p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                                      {item.quantity ?? '—'} {item.unit || 'UN'}
                                      {(item as any).colorName ? ` · ${(item as any).colorName}` : ''}
                                    </p>
                                  </div>
                                  {item.materialId && (
                                    isConfirmingItem ? (
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button type="button" onClick={() => setConfirmItemRevert(null)} disabled={isRevertingItem}
                                          className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                          Não
                                        </button>
                                        <button type="button" onClick={() => handleRevertItem(p, idx)} disabled={isRevertingItem}
                                          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all active:scale-95 ${isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-600'}`}>
                                          {isRevertingItem ? <RefreshCw size={10} className="animate-spin" /> : <><RefreshCw size={10} /> Sim</>}
                                        </button>
                                      </div>
                                    ) : (
                                      <button type="button" onClick={() => { setConfirmItemRevert({ purchaseId: p.id, itemIdx: idx }); setConfirmRevertId(null); }}
                                        className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all active:scale-95 ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                                        <RefreshCw size={10} /> Reverter
                                      </button>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                      </div>
                    );
                  });
                })()}
              </div>

            </div>
          </div>
        )}

        {/* Card de atalho para a Conferência de Solados (tela própria já existente) */}
        {onOpenSoleReceipt && (
          <button
            type="button"
            onClick={onOpenSoleReceipt}
            className={`w-full flex items-center justify-between gap-4 p-5 rounded-[2rem] border shadow-sm transition-all active:scale-[0.99] ${
              isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-cyan-700/60' : 'bg-white border-slate-100 hover:border-cyan-300'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border border-cyan-100/50 dark:border-cyan-900/30">
                <Footprints size={22} strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-white">Conferência de Solados</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Conferir e dar entrada de solados comprados</p>
              </div>
            </div>
            <ChevronRight size={22} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
          </button>
        )}

        {/* Purchases List */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">
              Materiais Aguardando Recebimento ({pendingPurchases.length})
            </h3>
          </div>

          {pendingPurchases.length > 0 ? (
            pendingPurchases.map((purchase) => {
              const supplier = suppliers.find((s) => s.id === purchase.supplierId);
              const isExpanded = expandedPurchaseId === purchase.id;
              const generalItemsList = purchase.generalItems || [];
              const hasItems = generalItemsList.length > 0;
              const formattedDate = purchase.date
                ? format(new Date(purchase.date), 'dd/MM/yyyy', { locale: ptBR })
                : '---';

              return (
                <div
                  key={purchase.id}
                  className={`rounded-[2rem] border transition-all ${
                    isExpanded
                      ? 'bg-white dark:bg-slate-900 border-indigo-500/30 shadow-xl shadow-indigo-500/5'
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/80 shadow-sm'
                  }`}
                >
                  
                  {/* Card Header Row */}
                  <div
                    onClick={() => handleToggleExpand(purchase)}
                    className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 flex items-center justify-center border border-indigo-100/40 dark:border-indigo-900/30 shrink-0">
                        <Package size={22} strokeWidth={2} />
                      </div>
                      
                      <div>
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-500 border border-amber-100/50 dark:border-amber-900/20">
                          <Clock size={10} />
                          AGUARDANDO PRODUTOS
                        </span>
                        
                        <h4 className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-white mt-1">
                          {supplier?.name || 'Fornecedor Desconhecido'}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-indigo-400" />
                            {formattedDate}
                          </span>
                          {purchase.batchNumber && (
                            <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800">
                              LOTE: {purchase.batchNumber}
                            </span>
                          )}
                          <span>
                            {generalItemsList.length} ITENS
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
                      
                      <div className="flex items-center gap-2">
                        {confirmDeleteId === purchase.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-400"
                              title="Cancelar exclusão"
                            >
                              Não
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(purchase.id)}
                              className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-rose-500 text-white"
                              title="Confirmar exclusão"
                            >
                              Excluir
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(purchase.id); }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-rose-50 hover:text-rose-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 transition-all"
                            title="Excluir compra"
                            aria-label="Excluir esta compra"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-indigo-400 dark:text-indigo-500">
                          {isExpanded ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Item Receipt List */}
                  {isExpanded && (
                    <div className="px-5 pb-6 border-t border-slate-50 dark:border-slate-800/60 mt-2 pt-4">
                      {hasItems ? (
                        <div className="flex flex-col gap-4">
                          
                          {/* Instructions */}
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/20 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2.5">
                            <AlertCircle size={16} className="text-indigo-400 shrink-0" strokeWidth={2.5} />
                            <span>Confirme as quantidades recebidas abaixo antes de registrar no estoque.</span>
                          </div>

                          {/* Items Grid */}
                          <div className="flex flex-col gap-3">
                            {purchase.generalItems?.map((item, idx) => {
                              const configMaterial = productionConfigs.find((c) => c.id === item.materialId);
                              const key = `${purchase.id}-${idx}`;
                              const receivedQty = receivedQuantities[key] ?? (item.quantity || 0);
                              
                              const rawUnit = item.unit || '';
                              const unitName = rawUnit.length > 0 && rawUnit.length <= 6 ? rawUnit.toUpperCase() : 'UN';
                              const colorSuffix = item.colorName ? ` - COR: ${item.colorName}` : '';
                              const itemName = (configMaterial?.name || item.description || 'Item Sem Descrição') + colorSuffix;

                              return (
                                <div
                                  key={idx}
                                  className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col gap-3"
                                >
                                  {/* Item Meta info */}
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100/30">
                                      <ClipboardList size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">
                                        {itemName}
                                      </h5>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>COMPRADO: {item.quantity} {unitName}</span>
                                        <span className="text-indigo-400 dark:text-indigo-500">
                                          ESTOQUE ATUAL: {configMaterial?.metadata?.stock || 0} {unitName}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quantity Controls - full width row */}
                                  <div className="flex items-center gap-2 w-full">
                                    <button
                                      type="button"
                                      onClick={() => handleReceiveAll(purchase, idx)}
                                      className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all shrink-0 ${
                                        receivedQty === item.quantity
                                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-400'
                                      }`}
                                      aria-label="Receber tudo"
                                      title="Receber quantidade total"
                                    >
                                      Receber Tudo
                                    </button>

                                    <div className="flex items-center flex-1 justify-end bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1 shadow-sm">
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQty(purchase.id, idx, -1)}
                                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-90 transition-all shrink-0"
                                        aria-label="Diminuir quantidade"
                                        title="Diminuir 1"
                                      >
                                        <Minus size={14} strokeWidth={3} />
                                      </button>

                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        className="w-14 text-center border-none p-0 text-sm font-black text-slate-800 dark:text-white focus:ring-0 appearance-none bg-transparent"
                                        value={receivedQty === 0 ? '' : receivedQty}
                                        onFocus={e => e.target.select()}
                                        onChange={(e) => handleSetQty(purchase.id, idx, parseFloat(e.target.value) || 0)}
                                        aria-label="Quantidade recebida"
                                        title="Quantidade"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQty(purchase.id, idx, 1)}
                                        className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center active:scale-90 transition-all shrink-0"
                                        aria-label="Aumentar quantidade"
                                        title="Aumentar 1"
                                      >
                                        <Plus size={14} strokeWidth={3} />
                                      </button>
                                    </div>

                                    <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 w-8 text-center">
                                      {unitName}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Form Footer Action */}
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
                              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/10 flex items-center gap-2 active:scale-95 transition-all"
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
                className="text-indigo-400 dark:text-indigo-500 mb-4"
                strokeWidth={1.5}
              />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
                Tudo Recebido!
              </h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mt-2 max-w-sm leading-relaxed">
                Nenhuma compra geral pendente de recebimento foi encontrada. Todas as compras cadastradas já estão com o estoque regularizado.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
