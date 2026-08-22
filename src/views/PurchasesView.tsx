import { useState, useMemo } from "react";
import { Purchase, Person, Product, PurchaseType, PaymentStatus, PaymentTerm, SaleType, GeneralPurchaseItem, ProductionConfigItem, Account, Transaction, TransactionType, PaymentHistory, Collaborator } from "../types";
import { canEditTask } from "../utils/collaborators";
import {
  ShoppingCart,
  Plus,
  Package,
  Calendar,
  History,
  Trash2,
  Edit2,
  X,
  Search,
  Clipboard,
  Hash,
  Lightbulb,
  Tag,
  Filter,
  ChevronDown,
  ChevronUp,
  Share2,
  DollarSign,
  Repeat,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ConfirmDialog from "../components/ConfirmDialog";
import ChecksModal from "../components/ChecksModal";
import ExportNoteModal from "../components/ExportNoteModal";
import AddPurchaseEntriesModal from "../components/AddPurchaseEntriesModal";
import PartialPaymentModal from "../components/PartialPaymentModal";
import { exportPurchase } from "../utils/purchaseExport";
import { toast } from '../utils/toast';
import { firebaseService } from '../services/firebaseService';

// Persiste filtros/visualização de Compras entre navegações e recarregamentos —
// sem isso, sair e voltar para a tela resetava as escolhas (Tipo, Período, Cards,
// Mostrar Itens) para o padrão.
function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? (JSON.parse(saved) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const setPersisted = (v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  return [value, setPersisted];
}


interface PurchasesViewProps {
  purchases: Purchase[];
  suppliers: Person[];
  // Lista COMPLETA de pessoas (não só `suppliers`, que é filtrada a isSupplier) — itens
  // "Fornecedor/Terceirizado" da Compra Geral podem apontar pra uma pessoa marcada só como
  // prestador de serviço (isServiceProvider), que `suppliers` não inclui.
  people: Person[];
  products: Product[];
  productionConfigs: ProductionConfigItem[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (purchase: Purchase) => void;
  isDarkMode: boolean;
  initialSearchQuery?: string;
  // Área de Pagamentos (quitação total / parcial da notinha) — sincroniza com o Financeiro
  // (cria Transaction de despesa) e atualiza paymentHistory/paymentStatus da compra, igual ao
  // fluxo já existente em "Financeiro > Contas a Pagar" (ver FinancialView/PartialPaymentModal).
  accounts: Account[];
  // Devolve o id da transação criada — usado em onPartialPay pra gravar de volta em
  // ServiceOrder.transactionId quando a Compra tem itens vindos de Ordens de Serviço (ver
  // GeneralPurchaseItem.serviceOrderId), fechando o saldo "em aberto" daquele fornecedor
  // sozinho assim que a Compra é totalmente paga.
  onSaveTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<string>;
  onUpdatePurchase: (id: string, updates: Partial<Purchase>) => Promise<void>;
  onUpdatePerson?: (id: string, updates: Partial<Person>) => Promise<void>;
  activeCollaborator?: Collaborator | null;
}

export default function PurchasesView({
  purchases,
  suppliers,
  people,
  products,
  productionConfigs,
  onAdd,
  onEdit,
  onDelete,
  onUpdate,
  isDarkMode,
  initialSearchQuery = '',
  accounts,
  onSaveTransaction,
  onUpdatePurchase,
  onUpdatePerson,
  activeCollaborator = null,
}: PurchasesViewProps) {
  const canLancarPedidos = canEditTask(activeCollaborator, 'compras', 'lancar_pedidos');
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  // Compras antigas e já pagas não ficam carregadas por padrão (ver App.tsx); busca de
  // uma só vez para a sessão atual quando a busca/período não encontra nada em memória.
  const [olderPurchases, setOlderPurchases] = useState<Purchase[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const handleLoadFullHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const all = await firebaseService.getCollection<Purchase>('purchases');
      setOlderPurchases(all);
    } finally {
      setIsLoadingHistory(false);
    }
  };
  const effectivePurchases = useMemo(() => {
    if (!olderPurchases) return purchases;
    const merged = new Map(olderPurchases.map(p => [p.id, p]));
    purchases.forEach(p => merged.set(p.id, p));
    return Array.from(merged.values());
  }, [purchases, olderPurchases]);

  // `suppliers` (prop) só traz quem tem isSupplier — uma Compra pode ter supplierId apontando
  // pra alguém cadastrado só como Prestador de Serviço (ex.: vinda de "Pagar Fornecedor" em
  // Financeiro), aí suppliers.find nunca acha e o card mostra o texto genérico "Fornecedor" em
  // vez do nome real. Mesma correção já feita em PurchaseFormView.tsx.
  const availableThirdParties = useMemo(
    () => people.filter(p => p.isSupplier || p.isServiceProvider),
    [people],
  );
  const [typeFilter, setTypeFilter] = usePersistedState<'ALL' | PurchaseType>('purchasesView_typeFilter', 'ALL');
  const [periodFilter, setPeriodFilter] = usePersistedState<string>('purchasesView_periodFilter', ''); // YYYY-MM
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCards, setExpandedCards] = usePersistedState<boolean>('purchasesView_expandedCards', true);
  const [showItems, setShowItems] = usePersistedState<boolean>('purchasesView_showItems', true);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const [selectedPurchaseForChecks, setSelectedPurchaseForChecks] = useState<Purchase | null>(null);
  const [isChecksModalOpen, setIsChecksModalOpen] = useState(false);
  const [selectedPurchaseForItems, setSelectedPurchaseForItems] = useState<Purchase | null>(null);
  const [exportModal, setExportModal] = useState<{ isOpen: boolean; purchase?: Purchase; format: 'pdf' | 'jpg' }>({ isOpen: false, format: 'pdf' });
  const [addEntryPurchase, setAddEntryPurchase] = useState<Purchase | null>(null);

  // Área de Pagamentos — quitação total/parcial da notinha direto no card, sem precisar ir
  // até Financeiro > Contas a Pagar (ver PartialPaymentModal, reaproveitado de lá).
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null);
  const [paymentModalMode, setPaymentModalMode] = useState<'PAYMENT' | 'HISTORY'>('PAYMENT');
  const [paymentPresetAmount, setPaymentPresetAmount] = useState<number | undefined>(undefined);

  const handlePartialPayment = (purchase: Purchase, mode: 'PAYMENT' | 'HISTORY' = 'PAYMENT', presetAmount?: number) => {
    setPaymentPurchase(purchase);
    setPaymentModalMode(mode);
    setPaymentPresetAmount(presetAmount);
  };

  const onPartialPay = async (amount: number, accountId: string, note: string) => {
    if (!paymentPurchase) return;
    const supplier = people.find(s => s.id === paymentPurchase.supplierId);

    const newTransactionId = await onSaveTransaction({
      type: TransactionType.EXPENSE,
      categoryId: paymentPurchase.categoryId || '',
      accountId,
      amount,
      date: Date.now(),
      description: `PAGTO PARCIAL COMPRA - ${supplier?.name || ''} ${note ? `(${note})` : ''}`,
      status: 'COMPLETED',
      contactId: paymentPurchase.supplierId,
      contactName: supplier?.name,
      relatedId: paymentPurchase.id,
    });

    const newPayment: PaymentHistory = {
      id: crypto.randomUUID(),
      date: Date.now(),
      amount,
      accountId,
      note,
    };
    const currentHistory = paymentPurchase.paymentHistory || [];
    const updatedHistory = [...currentHistory, newPayment];
    const totalPaid = updatedHistory.reduce((acc, p) => acc + p.amount, 0);
    const isPaid = totalPaid >= paymentPurchase.total;

    await onUpdatePurchase(paymentPurchase.id, {
      paymentHistory: updatedHistory,
      paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
    });

    // Compra vinda de "Ordens de Serviço a Fornecedores" (Financeiro) — cada item carrega o id
    // da OS de origem (ver GeneralPurchaseItem.serviceOrderId). Só grava de volta quando a
    // Compra fica TOTALMENTE paga (isPaid): pagamento parcial não deve marcar a OS como quitada.
    if (isPaid && newTransactionId) {
      const linkedItems = (paymentPurchase.generalItems || []).filter(item => item.serviceOrderId);
      for (const item of linkedItems) {
        try {
          await firebaseService.updateDocument('serviceOrders', item.serviceOrderId!, { transactionId: newTransactionId, updatedAt: Date.now() });
        } catch (err: any) {
          console.error('Erro ao vincular transação à Ordem de Serviço:', item.serviceOrderId, err);
        }
      }
    }

    if (totalPaid > paymentPurchase.total && onUpdatePerson && supplier) {
      const overpaid = totalPaid - paymentPurchase.total;
      const currentCredit = supplier.credit || 0;
      await onUpdatePerson(supplier.id, { credit: currentCredit + overpaid });
      toast.show(`Sobrepagamento de R$ ${overpaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} adicionado como crédito ao fornecedor!`);
    }
  };

  const handleConfirmAddEntries = (newItems: GeneralPurchaseItem[]) => {
    if (!addEntryPurchase) return;
    const addedTotal = newItems.reduce((acc, item) => acc + (item.value || 0) * (item.quantity || 1), 0);
    onUpdate({
      ...addEntryPurchase,
      generalItems: [...(addEntryPurchase.generalItems || []), ...newItems],
      total: addEntryPurchase.total + addedTotal,
    });
    toast.show('Lançamento adicionado à compra!');
    setAddEntryPurchase(null);
  };

  const handleOpenExport = (e: React.MouseEvent, purchase: Purchase, format: 'pdf' | 'jpg') => {
    e.stopPropagation();
    setExportModal({ isOpen: true, purchase, format });
  };

  const handleConfirmExport = async (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupMode: 'none' | 'ref_color' | 'ref', _pcpTotalGrid?: boolean, _showMaterials?: boolean, showItemGrid?: boolean) => {
    if (!exportModal.purchase) return;

    try {
      await exportPurchase({
        purchase: exportModal.purchase,
        suppliers: availableThirdParties,
        products,
        additionalNote: note,
        isDarkMode,
        showFinancialValues,
        grouped: groupMode !== 'none',
        showItemGrid: !!showItemGrid
      }, format);
      setExportModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error('Export error:', error);
      toast.show('Erro ao exportar compra.');
    }
  };

  const filteredPurchases = useMemo(() => {
    return effectivePurchases.filter(purchase => {
      // Filter by type
      if (typeFilter !== 'ALL' && purchase.type !== typeFilter) return false;

      // Filter by period
      if (periodFilter && purchase.date) {
        const pDate = new Date(purchase.date);
        if (!isNaN(pDate.getTime())) {
          const filterStr = format(pDate, 'yyyy-MM');
          if (filterStr !== periodFilter) return false;
        } else {
          return false;
        }
      }

      // Filter by supplier / search
      if (searchQuery.trim()) {
        const supplier = availableThirdParties.find((s) => s.id === purchase.supplierId);
        const lowerSearch = searchQuery.toLowerCase();

        const supplierMatch = supplier?.name.toLowerCase().includes(lowerSearch);
        const noteMatch = purchase.notes?.toLowerCase().includes(lowerSearch);

        if (!supplierMatch && !noteMatch) return false;
      }

      return true;
    }).sort((a, b) => b.date - a.date);
  }, [effectivePurchases, availableThirdParties, typeFilter, periodFilter, searchQuery]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (periodFilter) count++;
    if (!expandedCards) count++;
    if (!showItems) count++;
    return count;
  }, [periodFilter, expandedCards, showItems]);

  // Generate available months from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    purchases.forEach(p => {
      if (p.date) {
        const d = new Date(p.date);
        if (!isNaN(d.getTime())) {
          months.add(format(d, 'yyyy-MM'));
        }
      }
    });
    return Array.from(months).sort().reverse(); // newest first
  }, [purchases]);

  // Soma do saldo pendente das compras a prazo (não quitadas), exibida no topo da página —
  // usa filteredPurchases (não purchases) pra refletir só o que está sendo exibido no
  // momento (busca por fornecedor/nota, período, tipo), em vez do total geral fixo.
  const totalPendingTermPurchases = useMemo(() => {
    return filteredPurchases.reduce((acc, p) => {
      if (p.paymentStatus !== PaymentStatus.PENDING) return acc;
      if (p.paymentTerm === PaymentTerm.CASH) return acc;
      const totalPaid = (p.paymentHistory || []).reduce((a, h) => a + h.amount, 0);
      return acc + Math.max(0, p.total - totalPaid);
    }, 0);
  }, [filteredPurchases]);

  // Visão Geral de Pagamentos Recorrentes — agrupa as ocorrências de cada série (ver
  // Purchase.recurrenceGroupId, gerado no momento de salvar em PurchaseFormView) e resume
  // progresso/próximo vencimento. Usa `effectivePurchases` (não filteredPurchases) pra mostrar
  // a série inteira independente do filtro de tipo/período/busca ativo no momento.
  const recurringGroups = useMemo(() => {
    const groups = new Map<string, Purchase[]>();
    effectivePurchases.forEach(p => {
      if (!p.isRecurring || !p.recurrenceGroupId) return;
      const list = groups.get(p.recurrenceGroupId) || [];
      list.push(p);
      groups.set(p.recurrenceGroupId, list);
    });
    return Array.from(groups.entries())
      .map(([groupId, occs]) => {
        const sorted = [...occs].sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
        const first = sorted[0];
        const supplier = availableThirdParties.find(s => s.id === first.supplierId);
        const paidCount = sorted.filter(o => o.paymentStatus === PaymentStatus.PAID).length;
        const totalValue = sorted.reduce((acc, o) => acc + o.total, 0);
        const remainingValue = sorted.filter(o => o.paymentStatus !== PaymentStatus.PAID).reduce((acc, o) => acc + o.total, 0);
        const nextDue = sorted.find(o => o.paymentStatus !== PaymentStatus.PAID) || null;
        const description = first.generalItems?.[0]?.description || first.notes || 'Compra recorrente';
        return {
          groupId,
          supplierName: supplier?.name || 'Fornecedor não informado',
          description,
          totalInstallments: first.totalInstallments || sorted.length,
          paidCount,
          totalValue,
          remainingValue,
          nextDue,
        };
      })
      .sort((a, b) => (a.nextDue?.dueDate || Infinity) - (b.nextDue?.dueDate || Infinity));
  }, [effectivePurchases, availableThirdParties]);
  const [isRecurringOverviewExpanded, setIsRecurringOverviewExpanded] = useState(false);

  // Renderiza uma linha de item do carrinho (compartilhada entre o preview do card e o popup completo)
  const renderPurchaseItemRow = (item: any, idx: number) => {
    const isSole = 'moldId' in item;
    const isStockItem = !isSole && 'productId' in item;
    if (isStockItem) {
      const stockItem = item as any;
      const prod = products.find(p => p.id === stockItem.productId);
      const vari = prod?.variations.find(v => v.id === stockItem.variationId);
      return (
        <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-2 min-w-0">
            <Package size={12} className="text-indigo-500 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-tight truncate">
              {prod?.reference ? `${prod.reference} ` : ''}{prod?.name || 'Produto não encontrado'}
            </span>
            {vari && (
              <>
                <span className="text-[9px] text-slate-400 shrink-0">•</span>
                <span className="text-[10px] font-bold text-slate-500 truncate">{vari.colorName}{stockItem.size ? ` / ${stockItem.size}` : ''}</span>
              </>
            )}
          </div>
          <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 shrink-0">{stockItem.quantity} {(stockItem.size || stockItem.saleType === SaleType.RETAIL || !stockItem.isBox) ? 'pares' : 'cx'}</span>
        </div>
      );
    }
    if (isSole) {
      const soleItem = item as any;
      const totalPairs = Object.values(soleItem.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
      const sizeEntries = Object.entries(soleItem.quantities || {})
        .filter(([, q]) => (q as number) > 0)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b));
      return (
        <div key={idx} className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
          {/* Cabeçalho: modelo + cor */}
          <div className="flex items-center gap-2">
            <Package size={12} className="text-indigo-500 shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-tight text-slate-900 dark:text-white">{soleItem.moldName}</span>
            <span className="text-[9px] text-slate-400">•</span>
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">{soleItem.colorName}</span>
          </div>
          {/* Grade de tamanhos */}
          <div className="flex flex-wrap gap-1.5">
            {sizeEntries.map(([size, qty]) => (
              <div key={size} className="flex flex-col items-center justify-center min-w-[36px] px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[8px] font-black text-slate-500 uppercase leading-none mb-0.5">{size}</span>
                <span className="text-[13px] font-black text-slate-900 dark:text-white leading-none">{qty as number}</span>
              </div>
            ))}
          </div>
          {/* Total pares + valor */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
            <span className="text-[10px] font-black text-slate-900 dark:text-white">{totalPairs} <span className="text-[9px] font-bold text-slate-400 uppercase">pares</span></span>
            {soleItem.totalCost > 0 && (
              <span className="text-[11px] font-black text-rose-500 dark:text-rose-400">
                R$ {soleItem.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
      );
    }
    const genItem = item as any;
    return (
      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Tag size={12} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{genItem.description}</span>
        </div>
        <span className="text-[9px] font-black text-slate-400">{genItem.quantity} un</span>
      </div>
    );
  };

  // Renderiza uma linha de item de Compra Geral (tipo + descrição + qtd/unidade + valor)
  const generalItemKindLabel = (kind?: string) =>
    kind === 'person' ? 'Fornecedor' : kind === 'general' ? 'Geral' : 'Material';

  const renderGeneralItemRow = (item: any, idx: number) => {
    const lineTotal = (item.value || 0) * (item.quantity || 1);
    // Item "Fornecedor/Terceirizado": mostra o nome da pessoa cadastrada (via personId),
    // não a palavra genérica "Fornecedor" — `description` é um campo de texto livre
    // separado (motivo/serviço), não o nome do fornecedor.
    const personName = item.kind === 'person' ? people.find(p => p.id === item.personId)?.name : undefined;
    return (
      <div key={item.id || idx} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2 min-w-0">
          <Tag size={12} className="text-slate-400 shrink-0" />
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">
            <span className="text-slate-400">{personName || generalItemKindLabel(item.kind)} · </span>
            {item.description}
            {item.quantity ? <span className="text-slate-400"> · {item.quantity}{item.unit ? ` ${item.unit}` : ''}</span> : null}
          </span>
        </div>
        <span className="text-[9px] font-black text-rose-500 dark:text-rose-400 shrink-0">
          R$ {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-24 px-4 bg-[#fafafa] dark:bg-slate-950 min-h-screen">
      <ConfirmDialog
        isOpen={!!itemToDelete}
        title="Excluir Compra?"
        message="Deseja realmente excluir esta compra e reverter os lançamentos financeiros/estoque? Esta ação não pode ser desfeita."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={() => {
          if (itemToDelete) {
            onDelete(itemToDelete);
            setItemToDelete(null);
          }
        }}
        onCancel={() => setItemToDelete(null)}
        isDanger={true}
      />

      {paymentPurchase && (
        <PartialPaymentModal
          isOpen={!!paymentPurchase}
          onClose={() => setPaymentPurchase(null)}
          entity={paymentPurchase}
          accounts={accounts}
          entityLabel={people.find(s => s.id === paymentPurchase.supplierId)?.name}
          onPay={onPartialPay}
          isDarkMode={isDarkMode}
          initialMode={paymentModalMode}
          initialAmount={paymentPresetAmount}
        />
      )}

      {/* Note Modal */}
      {selectedNote && (
        <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedNote(null)}
          />
          <div className="relative m-auto w-[90%] max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white">Observação</h3>
              <button
                title="Fechar"
                aria-label="Fechar observação"
                onClick={() => setSelectedNote(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-line">
              {selectedNote}
            </p>
          </div>
        </div>
      )}

      {/* Carrinho Completo Modal */}
      {selectedPurchaseForItems && (
        <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedPurchaseForItems(null)}
          />
          <div className="relative m-auto w-[90%] max-w-sm max-h-[80vh] flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Carrinho de Compras</h3>
                {(() => {
                  const count = selectedPurchaseForItems.type === PurchaseType.GENERAL
                    ? (selectedPurchaseForItems.generalItems?.length || 0)
                    : selectedPurchaseForItems.type === PurchaseType.SOLE
                      ? (selectedPurchaseForItems.soleItems?.length || 0)
                      : (selectedPurchaseForItems.items?.length || 0);
                  return (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {count} {count === 1 ? 'item' : 'itens'}
                    </p>
                  );
                })()}
              </div>
              <button
                type="button"
                title="Fechar"
                aria-label="Fechar carrinho de compras"
                onClick={() => setSelectedPurchaseForItems(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {selectedPurchaseForItems.type === PurchaseType.GENERAL
                ? selectedPurchaseForItems.generalItems?.map((item, idx) => renderGeneralItemRow(item, idx))
                : selectedPurchaseForItems.type === PurchaseType.SOLE
                  ? selectedPurchaseForItems.soleItems?.map((item: any, idx) => renderPurchaseItemRow(item, idx))
                  : selectedPurchaseForItems.items?.map((item: any, idx) => renderPurchaseItemRow(item, idx))}
            </div>
            <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
              <h3 className="font-black text-base tracking-tight text-rose-500 dark:text-rose-400">
                R$ {selectedPurchaseForItems.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Compras
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Histórico de entradas
          </p>
          {totalPendingTermPurchases > 0 && (
            <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg w-fit bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <span className="text-[8px] font-black uppercase tracking-widest">Pendente a prazo</span>
              <span className="text-[11px] font-black tracking-tight">
                R$ {totalPendingTermPurchases.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
        {canLancarPedidos && (
          <button
            onClick={onAdd}
            title="Nova Compra"
            aria-label="Adicionar nova compra"
            data-guide-anchor="purchases.novaCompra"
            className="bg-blue-600 text-white p-3 rounded-[1rem] shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer hover:bg-blue-700"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Tipo de Compra — sempre visível no topo, em vez de escondido no popup de Filtros */}
      <div className={`flex p-1 rounded-2xl border gap-1 mt-3 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
        {(['ALL', PurchaseType.GENERAL, PurchaseType.SOLE, PurchaseType.REPLENISHMENT] as const).map((v) => (
          <button key={v} type="button" onClick={() => setTypeFilter(v)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all ${typeFilter === v ? 'bg-indigo-600 text-white shadow-sm' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
            {v === 'ALL' ? 'Todos' : v === PurchaseType.GENERAL ? 'Geral' : v === PurchaseType.SOLE ? 'Solados' : 'Estoque'}
          </button>
        ))}
      </div>

      {/* Visão Geral de Pagamentos Recorrentes — só aparece se houver alguma série de compra
          recorrente (ver Purchase.isRecurring/recurrenceGroupId, gerada em PurchaseFormView). */}
      {recurringGroups.length > 0 && (
        <div className={`rounded-[2rem] border shadow-sm overflow-hidden mt-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <button
            type="button"
            onClick={() => setIsRecurringOverviewExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-3 p-4"
          >
            <div className="flex items-center gap-3 text-left min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-cyan-900/20 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                <Repeat size={18} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pagamentos Recorrentes</p>
                <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {recurringGroups.length} {recurringGroups.length === 1 ? 'série ativa' : 'séries ativas'}
                </p>
              </div>
            </div>
            <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isRecurringOverviewExpanded ? 'rotate-180' : ''}`} />
          </button>
          {isRecurringOverviewExpanded && (
            <div className={`flex flex-col gap-2 px-4 pb-4 border-t pt-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              {recurringGroups.map(g => (
                <div key={g.groupId} className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <div className="min-w-0">
                    <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{g.description}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                      {g.supplierName} · {g.paidCount}/{g.totalInstallments} pagas
                      {g.nextDue && ` · próx. ${format(g.nextDue.dueDate || g.nextDue.date, 'dd/MM/yyyy')}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${g.remainingValue > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      R$ {g.remainingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">restante</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 mt-2">
        {/* Search Input + Configurar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar fornecedor ou nota..."
              title="Pesquisar"
              className={`w-full pl-10 pr-4 py-3 rounded-2xl text-[13px] font-bold outline-none transition-all ${isDarkMode ? "bg-slate-900 text-white placeholder-slate-500 focus:ring-2 focus:ring-slate-700" : "bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-slate-200 shadow-sm border border-slate-100"}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center transition-all relative bg-rose-500 text-white shadow-sm"
            title="Filtros e Configurações"
            aria-label="Abrir filtros e configurações"
          >
            <Filter size={18} strokeWidth={2.5} />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Compras antigas e já pagas não ficam carregadas por padrão — busca de uma vez sob demanda */}
        {(searchQuery.trim() || periodFilter) && filteredPurchases.length === 0 && !olderPurchases && (
          <button
            type="button"
            onClick={handleLoadFullHistory}
            disabled={isLoadingHistory}
            className={`w-full mt-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}
          >
            {isLoadingHistory ? 'Carregando...' : 'Carregar histórico completo de compras'}
          </button>
        )}
      </div>

      {/* Filter Popup */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowFilters(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className={`relative w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className={`text-[13px] font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Filtros e Configurações</h3>
              <button type="button" onClick={() => setShowFilters(false)} title="Fechar" aria-label="Fechar filtros" className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Período */}
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Período</p>
              <select
                className={`w-full px-4 py-3 rounded-2xl text-[11px] font-bold tracking-wider outline-none border ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-800"} focus:ring-2 focus:ring-indigo-500`}
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                title="Filtrar por Período"
              >
                <option value="">Todos os Meses</option>
                {availableMonths.map(month => {
                  const [y, m] = month.split('-');
                  const date = new Date(parseInt(y), parseInt(m) - 1);
                  return (
                    <option key={month} value={month}>
                      {format(date, 'MMM yy', { locale: ptBR })}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Visualização */}
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Visualização</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setExpandedCards(v => !v)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${expandedCards ? 'bg-indigo-600 text-white border-transparent shadow-sm' : isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  {expandedCards ? 'Cards Expandidos' : 'Cards Compactos'}
                </button>
                <button type="button" onClick={() => setShowItems(v => !v)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${showItems ? 'bg-indigo-600 text-white border-transparent shadow-sm' : isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  {showItems ? 'Mostrar Itens' : 'Ocultar Itens'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setTypeFilter('ALL'); setPeriodFilter(''); setExpandedCards(true); setShowItems(true); }}
              className="mt-1 w-full py-3 rounded-2xl text-[10px] font-black tracking-widest text-rose-500 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8 mt-2">
        {filteredPurchases.map((purchase) => {
          const supplier = availableThirdParties.find((s) => s.id === purchase.supplierId);
          const itemCount = purchase.type === PurchaseType.GENERAL
            ? (purchase.generalItems?.length || 0)
            : purchase.type === PurchaseType.SOLE
              ? (purchase.soleItems?.length || 0)
              : (purchase.items?.length || 0);

          const isLate = purchase.dueDate && new Date(purchase.dueDate) < new Date() && purchase.paymentStatus !== PaymentStatus.PAID;
          const isExpanded = expandedCards || expandedIds.includes(purchase.id);

          return (
            <div
              key={purchase.id}
              onClick={() => onEdit(purchase.id)}
              className={`p-5 rounded-[1.5rem] border flex flex-col gap-4 relative overflow-hidden group cursor-pointer transition-all ${isDarkMode ? "bg-slate-900 border-slate-800 shadow-[0_6px_0_0_rgba(0,0,0,0.45)]" : "bg-white border-slate-200 shadow-[0_6px_0_0_rgba(148,163,184,0.35)]"}`}
            >
              {/* Linha 1: nome no topo + info/total/badges abaixo */}
              <div className="flex flex-col gap-3 z-10">
                <h3 className={`font-black text-[15px] uppercase tracking-tight leading-snug flex items-center justify-between gap-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  <span className="truncate">{supplier?.name || "Fornecedor"}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {purchase.notes && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedNote(purchase.notes || ""); }}
                        title="Ver Observações"
                        aria-label="Ver Observações"
                        className="relative w-6 h-6 flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-500"
                      >
                        <Lightbulb size={13} strokeWidth={2.5} className="animate-pulse" />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 border border-white dark:border-slate-900 rounded-full animate-pulse" />
                      </button>
                    )}
                    {purchase.generateTransaction === false ? (
                      <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black tracking-wider shrink-0">Não Contábil</span>
                    ) : purchase.paymentTerm === PaymentTerm.CASH ? (
                      <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black tracking-wider shrink-0">Quitada</span>
                    ) : (
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-wider shrink-0 ${purchase.paymentStatus === PaymentStatus.PAID ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'animate-pulse-orange-yellow'}`}>
                        {purchase.paymentStatus === PaymentStatus.PAID ? 'Quitada' : 'Pendente'}
                      </span>
                    )}
                    {purchase.type === PurchaseType.REPLENISHMENT ? (
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30">
                        <Package size={13} strokeWidth={2.5} className="text-indigo-500" />
                      </span>
                    ) : (
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800">
                        <ShoppingCart size={13} strokeWidth={2.5} className="text-slate-400 dark:text-slate-500" />
                      </span>
                    )}
                  </div>
                </h3>

                <div className="flex flex-col gap-1.5">
                  {/* Linha 1: data + venc + expandir */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 min-w-0">
                      <Calendar size={12} strokeWidth={3} />
                      {purchase.date ? (
                        (() => {
                          const d = new Date(purchase.date);
                          return isNaN(d.getTime()) ? "Data Inválida" : format(d, "dd MMM yyyy", { locale: ptBR }).toUpperCase();
                        })()
                      ) : "Sem Data"}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {purchase.dueDate && purchase.paymentStatus === PaymentStatus.PENDING && (
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wider ${isLate ? 'bg-rose-50 text-rose-500' : 'animate-pulse-orange-yellow'}`}>
                          Venc: {format(new Date(purchase.dueDate), "dd/MM/yy")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(purchase.id); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-slate-500 text-white"
                        title={isExpanded ? "Recolher" : "Expandir"}
                        aria-label={isExpanded ? "Recolher detalhes da compra" : "Expandir detalhes da compra"}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Linha 2: lote */}
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 min-w-0">
                    <Hash size={12} strokeWidth={3} />
                    #{purchase.batchNumber || purchase.id.slice(-6).toUpperCase()}
                  </div>

                  {/* Linha 3: badges extras */}
                  {(purchase.sellerName || (!isExpanded && itemCount > 0)) && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {purchase.sellerName && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md leading-none tracking-wider bg-indigo-600 text-white shadow-sm w-fit">
                          {purchase.sellerName}
                        </span>
                      )}
                      {!isExpanded && itemCount > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider">
                          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Conteúdo: cheques + itens */}
              {isExpanded && (
                <div className="flex flex-col z-10 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                  {purchase.checks && purchase.checks.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPurchaseForChecks(purchase);
                        setIsChecksModalOpen(true);
                      }}
                      title="Ver Histórico de Cheques"
                      aria-label="Ver Histórico de Cheques"
                      className={`py-2 px-3 rounded-xl border flex items-center gap-2 text-xs font-black tracking-widest transition-all active:scale-[0.98] w-fit ${isDarkMode
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                          : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100 shadow-sm'
                        }`}
                    >
                      <Clipboard size={14} strokeWidth={3} />
                      Histórico de Cheques
                    </button>
                  )}

                  {showItems && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPurchaseForItems(purchase);
                      }}
                      title="Ver carrinho de compras completo"
                      aria-label="Ver carrinho de compras completo"
                      className={`flex flex-col gap-1.5 text-left rounded-2xl p-2 transition-colors active:scale-[0.99] ${isDarkMode ? 'bg-slate-950/40 hover:bg-slate-800/60' : 'bg-slate-50/80 hover:bg-slate-100'}`}
                    >
                      {purchase.type === PurchaseType.GENERAL
                        ? purchase.generalItems?.slice(0, 5).map((item, idx) => renderGeneralItemRow(item, idx))
                        : purchase.type === PurchaseType.SOLE
                          ? purchase.soleItems?.slice(0, 5).map((item: any, idx) => renderPurchaseItemRow(item, idx))
                          : purchase.items?.slice(0, 5).map((item: any, idx) => renderPurchaseItemRow(item, idx))}
                      {itemCount > 5 && (
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 italic">
                          + {itemCount - 5} outros itens
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Área de Pagamentos — só compras "a prazo" ainda pendentes (mesma condição
                  de "Financeiro > Contas a Pagar") ganham o atalho de pagamento aqui no card.
                  Uma única cápsula: o formulário completo (valor pago/restante, quitação
                  total, parcial, histórico) mora dentro do PartialPaymentModal. */}
              {purchase.paymentTerm === PaymentTerm.INSTALLMENTS && purchase.paymentStatus !== PaymentStatus.PAID && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePartialPayment(purchase, 'PAYMENT'); }}
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-full border text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] z-10 ${isDarkMode ? 'bg-slate-950/40 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 animate-[pulse_0.7s_cubic-bezier(0.4,0,0.6,1)_infinite] shrink-0">
                    <DollarSign size={14} strokeWidth={3} className="text-white" />
                  </span>
                  Clique para Adicionar Pagamento
                </button>
              )}

              {/* Action Bar (Footer) */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800/50 z-10">
                <div className="flex items-center gap-3">
                  {/* Total Geral */}
                  <div className="flex flex-col">
                    <h3 className="font-black text-base text-rose-500 dark:text-rose-400 leading-none">
                      R$ {purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {purchase.type === PurchaseType.REPLENISHMENT ? 'Reposição' : purchase.type === PurchaseType.SOLE ? 'Solados' : 'Geral'}
                    </span>
                  </div>
                </div>

                {/* Actions Group (Floating Island) */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 shadow-sm backdrop-blur-md relative">
                  {/* Add Entry Button — só compras Gerais têm essa opção; Produção e
                      Solados exigem escolher produto/molde e grade, fora do escopo deste
                      atalho rápido. */}
                  {purchase.type === PurchaseType.GENERAL && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAddEntryPurchase(purchase); }}
                      className="w-10 h-10 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                      title="Adicionar Lançamento"
                      aria-label="Adicionar novo lançamento a esta compra"
                    >
                      <Plus size={18} strokeWidth={3} />
                    </button>
                  )}

                  {/* Share Button */}
                  <button
                    type="button"
                    onClick={(e) => handleOpenExport(e, purchase, 'jpg')}
                    className="w-10 h-10 flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                    title="Compartilhar"
                    aria-label="Compartilhar compra"
                  >
                    <Share2 size={18} />
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit(purchase.id); }}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-blue-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setItemToDelete(purchase.id); }}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-rose-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                    title="Excluir"
                    aria-label="Excluir compra"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

            </div>
          );
        })}

        {filteredPurchases.length === 0 && (
          <div
            className={`flex flex-col items-center justify-center p-8 border rounded-[1rem] ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
          >
            <History size={40} className="mb-3 opacity-20 text-slate-400" />
            <p className="text-slate-500 text-sm">
              Nenhuma entrada encontrada.
            </p>
          </div>
        )}
      </div>

      {(() => {
        const p = selectedPurchaseForChecks;
        if (!p) return null;
        return (
          <ChecksModal
            isOpen={isChecksModalOpen}
            onClose={() => {
              setIsChecksModalOpen(false);
              setSelectedPurchaseForChecks(null);
            }}
            purchase={p}
            supplier={availableThirdParties.find(s => s.id === p.supplierId)}
            isDarkMode={isDarkMode}
            onUpdateCheque={(chequeId, newStatus) => {
              if (!p.checks) return;

              const updatedChecks = p.checks.map(c =>
                c.id === chequeId ? { ...c, status: newStatus } : c
              );

              const updatedPurchase = {
                ...p,
                checks: updatedChecks
              };

              onUpdate(updatedPurchase);
              setSelectedPurchaseForChecks(updatedPurchase);
            }}
          />
        );
      })()}

      <ExportNoteModal
        isOpen={exportModal.isOpen}
        onClose={() => setExportModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmExport}
        isDarkMode={isDarkMode}
        initialFormat={exportModal.format}
        title="Exportar Compra"
        showValuesToggle
        showGroupingToggle
        showItemGridToggle
        itemGridLabel="Mostrar Grade da Compra"
        itemGridDescription="Itens aparecem em grade por cor (tamanhos no varejo, caixas no atacado), somando quantidades repetidas"
      />

      <AddPurchaseEntriesModal
        isOpen={!!addEntryPurchase}
        onClose={() => setAddEntryPurchase(null)}
        onConfirm={handleConfirmAddEntries}
        isDarkMode={isDarkMode}
        people={people}
        productionConfigs={productionConfigs}
      />
    </div>
  );
}

