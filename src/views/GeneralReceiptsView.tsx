import React, { useState, useMemo } from 'react';
import { Purchase, Person, ProductionConfigItem, PurchaseRequest, PurchaseType, PaymentTerm, PaymentStatus, SoleStockEntry } from '../types';
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
  soleStockEntries?: SoleStockEntry[];
  onEditPurchase?: (id: string) => void;
}

export default function GeneralReceiptsView({
  purchases,
  suppliers,
  productionConfigs,
  purchaseRequests,
  onBack,
  isDarkMode,
  soleStockEntries,
  onEditPurchase,
}: GeneralReceiptsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  
  // Track received quantities. Key: `${purchaseId}-${itemIndex}` -> number
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  
  const [loadingPurchaseId, setLoadingPurchaseId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showReceived, setShowReceived] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [revertModal, setRevertModal] = useState<{ purchase: Purchase; soleItems: any[] } | null>(null);
  const [revertQtys, setRevertQtys] = useState<Record<string, number>>({});
  const [successToast, setSuccessToast] = useState<{ message: string; details?: string[] } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const handleDelete = async (purchaseId: string) => {
    try {
      const purchase = purchases.find(p => p.id === purchaseId);
      if (purchase) {
        // Reverse any received sole stock before deleting
        const soleItems: any[] = (purchase as any).soleItems || (purchase as any).items?.filter((i: any) => i.moldId) || [];
        for (const item of soleItems) {
          // Use totalReceivedQtys if available (partial receipts), otherwise use quantities if fully received
          const qtyToReverse: Record<string, number> = item.totalReceivedQtys || (purchase.registerAsReceived ? item.quantities : {});
          const hasReceived = Object.values(qtyToReverse).some((v: any) => Number(v) > 0);
          if (!hasReceived) continue;
          const existing = (soleStockEntries || []).find((s: any) => s.moldId === item.moldId && s.colorId === item.colorId);
          if (existing) {
            const updatedStock = { ...existing.stock };
            Object.entries(qtyToReverse).forEach(([size, qty]: [string, any]) => {
              updatedStock[size] = Math.max(0, (updatedStock[size] || 0) - (Number(qty) || 0));
            });
            const totalPairs = Object.values(updatedStock).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            await firebaseService.updateDocument('soleStock', existing.id, { stock: updatedStock, totalPairs, updatedAt: Date.now() });
          }
        }
      }
      await firebaseService.deleteDocument('purchases', purchaseId);
      setConfirmDeleteId(null);
    } catch {
      setErrorToast('Erro ao excluir compra.');
    }
  };

  const handleRevertReceipt = async (purchase: Purchase) => {
    setRevertingId(purchase.id);
    try {
      // Reverse stock for GENERAL purchases
      for (const item of purchase.generalItems || []) {
        if (item.materialId && (item.quantity || 0) > 0) {
          const material = productionConfigs.find(c => c.id === item.materialId);
          if (material) {
            const currentStock = material.metadata?.stock || 0;
            await firebaseService.saveDocument('productionConfigs', {
              ...material,
              metadata: { ...material.metadata, stock: Math.max(0, currentStock - (item.quantity || 0)) }
            });
          }
        }
      }
      // Reverse stock for sole purchases — usa apenas totalReceivedQtys (novas compras)
      // Para compras antigas sem totalReceivedQtys, não toca no estoque para evitar inconsistências
      const soleItems: any[] = (purchase as any).soleItems || (purchase as any).items?.filter((i: any) => i.moldId) || [];
      let stockReversed = false;
      for (const item of soleItems) {
        const receivedQtys: Record<string, number> = item.totalReceivedQtys || {};
        const hasReceivedData = Object.values(receivedQtys).some((v: any) => Number(v) > 0);
        if (!hasReceivedData) continue; // compra antiga sem dados de recebimento — não reverte estoque
        const existing = (soleStockEntries || []).find((s: any) => s.moldId === item.moldId && s.colorId === item.colorId);
        if (existing) {
          const updatedStock = { ...existing.stock };
          Object.entries(receivedQtys).forEach(([size, qty]: [string, any]) => {
            updatedStock[size] = Math.max(0, (updatedStock[size] || 0) - (Number(qty) || 0));
          });
          const totalPairs = Object.values(updatedStock).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
          await firebaseService.updateDocument('soleStock', existing.id, { stock: updatedStock, totalPairs, updatedAt: Date.now() });
          stockReversed = true;
        }
      }
      // Restaura quantidades originais (totalReceivedQtys → de volta para quantities)
      const isSoleType = !!(purchase as any).soleItems;
      const restoredItems = soleItems.map((item: any) => {
        const received: Record<string, number> = item.totalReceivedQtys || {};
        const remaining: Record<string, number> = { ...(item.quantities || {}) };
        Object.entries(received).forEach(([size, qty]: [string, any]) => {
          remaining[size] = (remaining[size] || 0) + Number(qty);
        });
        return { ...item, quantities: remaining, totalReceivedQtys: {} };
      });
      await firebaseService.saveDocument('purchases', {
        ...purchase,
        ...(isSoleType ? { soleItems: restoredItems } : { items: restoredItems }),
        registerAsReceived: false,
      });
      setSuccessToast({ message: 'Recebimento revertido. Compra volta para pendentes.', details: stockReversed ? ['Estoque ajustado.'] : ['Nenhuma alteração de estoque (compra antiga).'] });
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err) {
      setErrorToast('Erro ao reverter recebimento.');
    } finally {
      setRevertingId(null);
    }
  };

  const receivedCount = useMemo(() => purchases.filter(p => {
    if (p.registerAsReceived === true) return true;
    const soleItems: any[] = (p as any).soleItems || (p as any).items?.filter((i: any) => i.moldId) || [];
    return soleItems.some((item: any) => item.totalReceivedQtys && Object.values(item.totalReceivedQtys).some((v: any) => Number(v) > 0));
  }).length, [purchases]);

  // Filter purchases: General / Sole pending receipt
  const pendingPurchases = useMemo(() => {
    return purchases
      .filter((p) => {
        // GENERAL: always eligible for receiving
        if (p.type === PurchaseType.GENERAL) { /* continue */ }
        // SOLE (new tab in PurchaseFormView): always eligible
        else if (p.type === PurchaseType.SOLE) { /* continue */ }
        // REPLENISHMENT: only if it contains sole items (moldId), not product items
        else if (p.type === PurchaseType.REPLENISHMENT) {
          const rawItems: any[] = (p as any).items || [];
          const hasSoleItems = rawItems.some((i: any) => i.moldId);
          const hasSoleItemsField = ((p as any).soleItems || []).length > 0;
          if (!hasSoleItems && !hasSoleItemsField) return false;
        } else {
          return false; // exclude all other types
        }
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
      // Initialize sole item quantities to 0 — user enters what they receive NOW
      const soleItems: any[] = (purchase as any).soleItems || (purchase as any).items?.filter((i: any) => i.moldId) || [];
      soleItems.forEach((item: any, idx: number) => {
        Object.entries(item.quantities || {}).forEach(([size]: [string, any]) => {
          const key = `${purchase.id}-sole-${idx}-${size}`;
          newQuantities[key] = 0; // always reset to 0 when expanding
        });
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

  const openRevertModal = (p: Purchase) => {
    const soleItems: any[] = (p as any).soleItems || (p as any).items?.filter((i: any) => i.moldId) || [];
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

      // Reverse soleStock
      for (let idx = 0; idx < soleItems.length; idx++) {
        const item = soleItems[idx];
        if (!item.moldId) continue;
        const existing = (soleStockEntries || []).find((s: any) => s.moldId === item.moldId && s.colorId === item.colorId);
        if (existing) {
          const updatedStock = { ...existing.stock };
          const prevReceived: Record<string, number> = item.totalReceivedQtys || item.quantities || {};
          Object.keys(prevReceived).forEach(size => {
            const toRevert = revertQtys[`${idx}-${size}`] ?? 0;
            updatedStock[size] = Math.max(0, (updatedStock[size] || 0) - toRevert);
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

      // Handle sole purchases (REPLENISHMENT or SOLE) — support partial receipt
      if (purchase.type === PurchaseType.REPLENISHMENT || purchase.type === PurchaseType.SOLE) {
        const soleItems: any[] = (purchase as any).soleItems || (purchase as any).items?.filter((i: any) => i.moldId) || [];
        const updatedSoleItems: any[] = [];
        let hasRemainingQty = false;

        for (let idx = 0; idx < soleItems.length; idx++) {
          const item = soleItems[idx];
          if (!item.moldId) { updatedSoleItems.push(item); continue; }

          // Build received quantities per size using user-edited inputs
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

          // Accumulate total received quantities across partial receipts
          const prevReceived: Record<string, number> = item.totalReceivedQtys || {};
          const newTotalReceived: Record<string, number> = {};
          Object.keys(receivedQtys).forEach(size => {
            newTotalReceived[size] = (prevReceived[size] || 0) + (receivedQtys[size] || 0);
          });
          updatedSoleItems.push({ ...item, quantities: remainingQtys, totalReceivedQtys: newTotalReceived });
        }

        // If partial receipt: update purchase with remaining quantities and keep pending
        // If full receipt: mark as fully received
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
        setLoadingPurchaseId(null);
        setExpandedPurchaseId(null);
        return;
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

        {/* HISTÓRICO POPUP */}
        {showReceived && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowReceived(false)} />
            <div className={`relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">Histórico de Recebimentos</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Clique em Reverter para desfazer uma baixa</p>
                </div>
                <button type="button" onClick={() => setShowReceived(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" aria-label="Fechar histórico">
                  <X size={18} />
                </button>
              </div>
              {/* List */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {purchases
                  .filter(p => {
                    if (p.registerAsReceived === true) return true;
                    // Include partial receipts (soleItems with totalReceivedQtys)
                    const soleItems: any[] = (p as any).soleItems || (p as any).items?.filter((i: any) => i.moldId) || [];
                    return soleItems.some((item: any) =>
                      item.totalReceivedQtys && Object.values(item.totalReceivedQtys).some((v: any) => Number(v) > 0)
                    );
                  })
                  .sort((a, b) => b.date - a.date)
                  .map(p => {
                    const sup = suppliers.find(s => s.id === p.supplierId);
                    const soleItems: any[] = (p as any).soleItems || (p as any).items?.filter((i: any) => i.moldId) || [];
                    const generalItems = p.generalItems || [];
                    const formattedDate = p.date ? format(new Date(p.date), 'dd/MM/yyyy', { locale: ptBR }) : '---';
                    return (
                      <div key={p.id} className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        {/* Header */}
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
                            {onEditPurchase && (
                              <button type="button" onClick={() => { setShowReceived(false); onEditPurchase(p.id); }} className="p-2 rounded-xl text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 active:scale-95 transition-all" title="Editar" aria-label="Editar compra">
                                <Pencil size={16} />
                              </button>
                            )}
                            <button type="button" onClick={() => openRevertModal(p)}
                              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-900/20 text-rose-500 border border-rose-100 dark:border-rose-800/40 hover:bg-rose-100 active:scale-95 transition-all flex items-center gap-2"
                              title="Reverter recebimento" aria-label="Reverter recebimento"
                            >
                              <RefreshCw size={13} />
                              Reverter
                            </button>
                          </div>
                        </div>

                        {/* Sole items received quantities */}
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

                        {/* General items */}
                        {generalItems.length > 0 && (
                          <div className={`mx-3 mb-3 p-3 rounded-xl ${isDarkMode ? 'bg-slate-900/50' : 'bg-white border border-slate-100'}`}>
                            {generalItems.map((item, idx) => (
                              <div key={idx} className={`flex items-center justify-between ${idx > 0 ? 'mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800' : ''}`}>
                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 truncate flex-1">{item.description || item.materialId}</span>
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 ml-2">{item.quantity} {item.unit || 'UN'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {purchases.filter(p => p.registerAsReceived === true).length === 0 && (
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
              Compras Aguardando Recebimento ({pendingPurchases.length})
            </h3>
          </div>

          {pendingPurchases.length > 0 ? (
            pendingPurchases.map((purchase) => {
              const supplier = suppliers.find((s) => s.id === purchase.supplierId);
              const isExpanded = expandedPurchaseId === purchase.id;
              const soleItemsList: any[] = (purchase as any).soleItems || (purchase as any).items?.filter((i: any) => i.moldId) || [];
              const generalItemsList = purchase.generalItems || [];
              const hasItems = generalItemsList.length > 0 || soleItemsList.length > 0;
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
                            {generalItemsList.length + soleItemsList.length} ITENS
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
                              const itemName = configMaterial?.name || item.description || 'Item Sem Descrição';

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

                            {(purchase.type === PurchaseType.REPLENISHMENT || purchase.type === PurchaseType.SOLE) && soleItemsList.map((item: any, idx: number) => {
                              const remainingTotal = Object.values(item.quantities || {}).reduce((a: number, b: any) => a + Number(b), 0);
                              const receivedTotal = Object.keys(item.quantities || {}).reduce((a: number, size: string) => {
                                const key = `${purchase.id}-sole-${idx}-${size}`;
                                return a + (receivedQuantities[key] ?? 0);
                              }, 0);
                              const isPartial = receivedTotal < remainingTotal;
                              const orderedTotal = remainingTotal; // alias for clarity
                              return (
                                <div key={idx} className={`p-3 rounded-xl border ${isPartial ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">{item.moldName}</p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-bold text-violet-500 uppercase">{item.colorName}</span>
                                      {isPartial && <span className="text-[8px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-md uppercase">Parcial</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                      Faltando: <span className="text-amber-600 dark:text-amber-400 font-black">{remainingTotal} pares</span>
                                      {receivedTotal > 0 && <> — Recebendo agora: <span className="text-emerald-600 dark:text-emerald-400 font-black">{receivedTotal} pares</span></>}
                                    </p>
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
                                      className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline"
                                    >
                                      Receber tudo
                                    </button>
                                  </div>
                                  <div className="flex flex-col gap-3 mt-1">
                                    {Object.entries(item.quantities || {}).sort(([a], [b]) => parseFloat(a) - parseFloat(b)).map(([size, remaining]: [string, any]) => {
                                      const key = `${purchase.id}-sole-${idx}-${size}`;
                                      const val = receivedQuantities[key] ?? 0;
                                      const max = Number(remaining);
                                      return (
                                        <div key={size} className="flex items-center justify-between gap-3">
                                          <div className="flex flex-col gap-0.5 w-24">
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">{size}</span>
                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{remaining} faltando</span>
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
                                  <p className="text-[9px] text-slate-400 mt-2 text-right">Custo un.: R$ {Number(item.unitCost || 0).toFixed(2)}</p>
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
