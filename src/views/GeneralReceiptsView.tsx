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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { firebaseService } from '../services/firebaseService';

interface GeneralReceiptsViewProps {
  purchases: Purchase[];
  suppliers: Person[];
  productionConfigs: ProductionConfigItem[];
  purchaseRequests: PurchaseRequest[];
  onBack: () => void;
  isDarkMode: boolean;
}

export default function GeneralReceiptsView({
  purchases,
  suppliers,
  productionConfigs,
  purchaseRequests,
  onBack,
  isDarkMode,
}: GeneralReceiptsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  
  // Track received quantities. Key: `${purchaseId}-${itemIndex}` -> number
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  
  const [loadingPurchaseId, setLoadingPurchaseId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ message: string; details?: string[] } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Filter purchases: General, not received yet
  const pendingPurchases = useMemo(() => {
    return purchases
      .filter((p) => {
        // Must be GENERAL type
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
      
      // 2. Loop through general items to update production config stocks
      for (let i = 0; i < itemsToReceive.length; i++) {
        const item = itemsToReceive[i];
        const key = `${purchase.id}-${i}`;
        const receivedQty = receivedQuantities[key] ?? (item.quantity || 0);

        if (item.materialId && receivedQty > 0) {
          const material = productionConfigs.find((c) => c.id === item.materialId);
          if (material) {
            const currentStock = material.metadata?.stock || 0;
            const updatedStock = currentStock + receivedQty;
            
            // Update stock in productionConfigs
            await firebaseService.saveDocument('productionConfigs', {
              ...material,
              metadata: {
                ...material.metadata,
                stock: updatedStock,
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

  return (
    <div className={`flex flex-col min-h-screen pb-20 ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Premium Header */}
      <header className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/40 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
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
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Search Box */}
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

          {/* Supplier Dropdown */}
          <div className="relative">
            <select
              className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl px-5 py-4 text-xs font-black placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all text-slate-800 dark:text-white uppercase tracking-widest cursor-pointer appearance-none"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              aria-label="Filtrar por fornecedor"
              title="Fornecedor"
            >
              <option value="ALL">TODOS OS FORNECEDORES</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
              <ChevronDown size={16} className="text-indigo-400" strokeWidth={3} />
            </div>
          </div>
        </section>

        {/* Purchases List */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">
              Compras Aguardando Recebimento ({pendingPurchases.length})
            </h3>
          </div>

          {pendingPurchases.length > 0 ? (
            pendingPurchases.map((purchase) => {
              const supplier = suppliers.find((s) => s.id === purchase.supplierId);
              const isExpanded = expandedPurchaseId === purchase.id;
              const hasItems = purchase.generalItems && purchase.generalItems.length > 0;
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
                            {purchase.generalItems?.length || 0} ITENS
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
                      
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-indigo-400 dark:text-indigo-500">
                        {isExpanded ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}
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
                              
                              const unitName = configMaterial?.metadata?.unitId || item.unit || 'UN';
                              
                              return (
                                <div
                                  key={idx}
                                  className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                  
                                  {/* Item Meta info */}
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100/30">
                                      <ClipboardList size={18} />
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                        {item.description || configMaterial?.name || 'Item Sem Descrição'}
                                      </h5>
                                      <div className="flex items-center gap-2 mt-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>COMPRADO: {item.quantity} {unitName}</span>
                                        <span>•</span>
                                        <span className="text-indigo-400 dark:text-indigo-500">
                                          ESTOQUE ATUAL: {configMaterial?.metadata?.stock || 0} {unitName}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quantity Receivers Controls */}
                                  <div className="flex items-center gap-3 self-end md:self-center">
                                    
                                    {/* Fast Receive Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleReceiveAll(purchase, idx)}
                                      className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                                        receivedQty === item.quantity
                                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-400'
                                      }`}
                                      aria-label="Receber tudo"
                                      title="Receber quantidade total"
                                    >
                                      Receber Tudo
                                    </button>

                                    {/* Stepper controls */}
                                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1 shadow-sm">
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQty(purchase.id, idx, -1)}
                                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 active:scale-90 transition-all"
                                        aria-label="Diminuir quantidade"
                                        title="Diminuir 1"
                                      >
                                        <Minus size={14} strokeWidth={3} />
                                      </button>
                                      
                                      <input
                                        type="number"
                                        className="w-12 text-center border-none p-0 text-xs font-black text-slate-800 dark:text-white focus:ring-0 appearance-none bg-transparent"
                                        value={receivedQty}
                                        onChange={(e) => handleSetQty(purchase.id, idx, parseFloat(e.target.value) || 0)}
                                        aria-label="Quantidade recebida"
                                        title="Quantidade"
                                      />
                                      
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQty(purchase.id, idx, 1)}
                                        className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 active:scale-90 transition-all"
                                        aria-label="Aumentar quantidade"
                                        title="Aumentar 1"
                                      >
                                        <Plus size={14} strokeWidth={3} />
                                      </button>
                                    </div>
                                    
                                    <span className="text-[10px] font-black uppercase text-slate-400 w-6">
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
                                <>
                                  <RefreshCw size={14} className="animate-spin" />
                                  REGISTRANDO...
                                </>
                              ) : (
                                <>
                                  <Check size={14} strokeWidth={3} />
                                  Confirmar Recebimento
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-[0.2em] italic">
                            Esta compra não possui itens cadastrados.
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
