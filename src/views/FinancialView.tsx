import { useState, useMemo, useRef } from 'react';
import { Transaction, TransactionType, Category, Account, AccountType, Person, Purchase, PaymentStatus, PurchaseType, PaymentTerm, PaymentHistory, Sale, SaleStatus, Product, SaleType, ProductionLot, ProductionConfigItem, Collaborator, CompanyProfile, ServiceOrder, GeneralPurchaseItem, CollaboratorLoan } from '../types';
import { Search, TrendingUp, TrendingDown, DollarSign, Calendar, Wallet, User, Trash2, Edit, CheckCircle2, AlertCircle, Clock, RefreshCcw, ClipboardCheck, Package, History, Clipboard, Hash, ChevronDown, ChevronUp, ChevronRight, Tag, FileText, Repeat, Send, FileDown, Image as ImageIcon, Hammer, Factory, X, Layers, Download, Upload } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TransactionModal from '../components/TransactionModal';
import ConfirmDialog from '../components/ConfirmDialog';
import FinancialQueryModal from '../components/FinancialQueryModal';
import PartialPaymentModal from '../components/PartialPaymentModal';
import BusinessOverviewCard from '../components/BusinessOverviewCard';
import { toast } from '../utils/toast';
import { firebaseService } from '../services/firebaseService';
import { getPeriodRange, computePeriodFinancials, computeSalesProfitInPeriod, computePendingReceivables, computePendingPayables, OverviewPeriodType, STATS_PERIOD_LABELS } from '../utils/businessOverview';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';
import CommissionToSellersCard from '../components/CommissionToSellersCard';
import TransactionListCard from '../components/TransactionListCard';
import ProviderServiceOrdersCard from '../components/ProviderServiceOrdersCard';

const STATS_PERIOD_PHRASE: Record<OverviewPeriodType, string> = { MONTH: 'no mês', QUARTER: 'no trimestre', SEMESTER: 'no semestre', YEAR: 'no ano' };

// Explica pra que serve cada lançamento manual antes de abrir o formulário — evita que alguém
// lance uma Entrada/Saída avulsa achando que está registrando uma Venda/Compra (que têm telas
// próprias e já mexem no financeiro sozinhas).
const MANUAL_ENTRY_INFO: Record<TransactionType, { title: string; message: string }> = {
  [TransactionType.INCOME]: {
    title: 'Nova Entrada Manual',
    message: 'Registra um valor recebido direto no financeiro, sem vínculo com uma Venda — use pra receitas avulsas (outros recebimentos, aportes, etc). Vendas já entram sozinhas ao serem fechadas.',
  },
  [TransactionType.EXPENSE]: {
    title: 'Nova Saída Manual',
    message: 'Registra uma despesa paga direto no financeiro, sem vínculo com uma Compra — use pra saídas avulsas (contas, taxas, retiradas, etc). Compras já entram sozinhas ao serem pagas.',
  },
};

interface FinancialViewProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  people: Person[];
  purchases: Purchase[];
  sales: Sale[];
  products: Product[];
  productionLots?: ProductionLot[];
  /** Padrões de embalagem (Grid tipo PACKAGING) — usado só pra prorratear o valor do
   * estoque Atacado por pares reais de cada padrão (ver getWholesaleValue). */
  productionConfigs?: ProductionConfigItem[];
  onSave: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  onEdit: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdatePurchase: (id: string, purchase: Partial<Purchase>) => Promise<void>;
  onUpdatePerson?: (id: string, updates: Partial<Person>) => Promise<void>;
  onOpenPurchase?: (id: string) => void;
  onOpenSale?: (id: string) => void;
  /** Abre o Lançamento de Compra (Compras Gerais) pré-preenchido com a comissão de um
   * vendedor, pronto pra virar um título a pagar — ver CommissionToSellersCard.tsx. */
  onPayCommission?: (params: { supplierId?: string; initialGeneralItems: { id: string; description: string; quantity: number; value: number; kind: 'general' }[]; initialDescription: string }) => void;
  /** % do salário/pró-labore pago no Adiantamento (RH → Configurações Globais) — ver
   * CommissionToSellersCard.tsx. */
  advancePercent?: number;
  /** Empréstimos ativos a colaboradores (RH → Empréstimos) — ver CommissionToSellersCard.tsx,
   * que abate o desconto mensal do Fechamento e registra o pagamento aqui. */
  loans?: CollaboratorLoan[];
  onSaveLoan?: (loan: CollaboratorLoan) => void | Promise<void>;
  isDarkMode: boolean;
  /** Colaboradores marcados como Vendedor (ver Collaborator.isSeller) — alimenta o painel
   * "Comissão a Vendedores" abaixo, somando Sale.commissionAmount de cada um. */
  collaborators?: Collaborator[];
  /** Identidade da empresa (Mais > Personalizar Empresa) — vai junto do PDF/JPG de comissão
   * exportado em "Comissão a Vendedores" quando configurada com cabeçalho/rodapé. */
  companyProfile?: CompanyProfile | null;
  /** Todas as Ordens de Serviço (terceirizadas) — alimenta o card "Ordens de Serviço a
   * Fornecedores" abaixo, agrupando por ServiceOrder.providerName. */
  serviceOrders?: ServiceOrder[];
  /** Mesmo mecanismo de onPayCommission: abre o Lançamento de Compra (Compras Gerais)
   * pré-preenchido, mas com UM ITEM POR OS (não consolidado) — cada item carrega
   * `serviceOrderId`, então quando essa Compra for totalmente paga, o transactionId volta
   * sozinho pra cada Ordem de Serviço (ver onPartialPay em PurchasesView.tsx e o pagamento à
   * vista em App.tsx), fechando o saldo "em aberto" sem risco de pagar a mesma OS duas vezes. */
  onPayProviderServiceOrders?: (params: { supplierId?: string; initialGeneralItems: GeneralPurchaseItem[]; initialDescription: string }) => void;
}

export default function FinancialView({
  transactions,
  categories,
  accounts,
  people,
  purchases,
  sales,
  products,
  productionLots = [],
  productionConfigs = [],
  onSave,
  onEdit,
  onDelete,
  onUpdatePurchase,
  onUpdatePerson,
  onOpenPurchase,
  onOpenSale,
  onPayCommission,
  isDarkMode,
  collaborators = [],
  companyProfile = null,
  serviceOrders = [],
  onPayProviderServiceOrders,
  advancePercent,
  loans,
  onSaveLoan,
}: FinancialViewProps) {
  const hidePrivacy = usePrivacyMode();
  const [filterType, setFilterType] = useState<TransactionType | 'ALL' | 'PAYABLE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Período das métricas de Receitas/Despesas do card "Saldo Confirmado" — independente do
  // saldo em si (esse é sempre o valor atual das contas, não filtra por período).
  const [statsPeriodType, setStatsPeriodType] = useState<OverviewPeriodType>('MONTH');
  const [statsPeriodDate, setStatsPeriodDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const statsDateInputRef = useRef<HTMLInputElement>(null);
  const openStatsMonthPicker = () => {
    const el = statsDateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };

  // Mostra (ou não) Vendas a Receber/Contas a Pagar junto das métricas do card — total em
  // aberto AGORA (não segue o filtro de período acima: "a receber" é sempre o saldo pendente
  // atual, não "quanto ficou pendente em junho").
  const [showPendingStats, setShowPendingStats] = useState(false);

  // Popup de explicação antes de abrir o lançamento manual de Entrada/Saída — guarda qual tipo
  // foi clicado (null = popup fechado).
  const [manualEntryConfirmType, setManualEntryConfirmType] = useState<TransactionType | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<TransactionType>(TransactionType.INCOME);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);

  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [paymentModalMode, setPaymentModalMode] = useState<'PAYMENT' | 'HISTORY'>('PAYMENT');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Renderiza uma linha de item do carrinho de uma compra (estoque/solados/geral)
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
            <span className="text-[11px] font-black uppercase tracking-tight truncate">
              {prod?.reference ? `${prod.reference} ` : ''}{prod?.name || 'Produto não encontrado'}
            </span>
            {vari && (
              <>
                <span className="text-[10px] text-slate-400 shrink-0">•</span>
                <span className="text-[11px] font-bold text-slate-500 truncate">{vari.colorName}{stockItem.size ? ` / ${stockItem.size}` : ''}</span>
              </>
            )}
          </div>
          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 shrink-0">{stockItem.quantity} {(stockItem.size || stockItem.saleType === SaleType.RETAIL || !stockItem.isBox) ? 'pares' : 'cx'}</span>
        </div>
      );
    }
    if (isSole) {
      const soleItem = item as any;
      const totalPairs = Object.values(soleItem.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
      const sizeEntries = Object.entries(soleItem.quantities || {}).filter(([, q]) => (q as number) > 0);
      return (
        <div key={idx} className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <Package size={12} className="text-indigo-500 shrink-0" />
            <span className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">{soleItem.moldName}</span>
            <span className="text-[10px] text-slate-400">•</span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">{soleItem.colorName}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sizeEntries.map(([size, qty]) => (
              <div key={size} className="flex flex-col items-center justify-center min-w-[36px] px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[9px] font-black text-slate-500 uppercase leading-none mb-0.5">{size}</span>
                <span className="text-sm font-black text-slate-900 dark:text-white leading-none">{qty as number}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
            <span className="text-[11px] font-black text-slate-900 dark:text-white">{totalPairs} <span className="text-[10px] font-bold text-slate-400 uppercase">pares</span></span>
            {soleItem.totalCost > 0 && (
              <span className="text-xs font-black text-rose-500 dark:text-rose-400">
                R$ {soleItem.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
      );
    }
    const genItem = item as any;
    const lineTotal = (genItem.value || 0) * (genItem.quantity || 1);
    const kindLabel = genItem.kind === 'person' ? 'Fornecedor' : genItem.kind === 'general' ? 'Geral' : 'Material';
    return (
      <div key={genItem.id || idx} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2 min-w-0">
          <Tag size={12} className="text-slate-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
            <span className="text-slate-400">{kindLabel} · </span>
            {genItem.description}
            {genItem.quantity ? <span className="text-slate-400"> · {genItem.quantity}{genItem.unit ? ` ${genItem.unit}` : ''}</span> : null}
          </span>
        </div>
        <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 shrink-0">
          R$ {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    );
  };

  const payableCount = useMemo(() =>
    purchases.filter(p => p.paymentTerm === PaymentTerm.INSTALLMENTS && p.paymentStatus !== PaymentStatus.PAID).length
  , [purchases]);

  // Lançamentos antigos e já liquidados não ficam carregados por padrão (ver App.tsx);
  // busca de uma só vez para a sessão atual quando o usuário pede o histórico completo.
  const [olderTransactions, setOlderTransactions] = useState<Transaction[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const handleLoadFullHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const all = await firebaseService.getCollection<Transaction>('transactions');
      setOlderTransactions(all);
    } finally {
      setIsLoadingHistory(false);
    }
  };
  const effectiveTransactions = useMemo(() => {
    if (!olderTransactions) return transactions;
    const merged = new Map(olderTransactions.map(t => [t.id, t]));
    transactions.forEach(t => merged.set(t.id, t));
    return Array.from(merged.values());
  }, [transactions, olderTransactions]);

  const filtered = effectiveTransactions
    .filter(t => !t.isPersonal && accounts.find(a => a.id === t.accountId)?.type !== AccountType.PERSONAL)
    // Mão de Obra de Ordens de Serviço (terceirizados) some da listagem — continua contando
    // normalmente em Despesas/Lucro (esse filtro só afeta a lista visual), e passa a ser
    // consultada pelo card "Consultas" em vez de poluir o dia a dia do Financeiro. Sem um
    // marcador estável no schema (ver ServiceOrderFormView.tsx), o único jeito de identificar
    // é pelo prefixo fixo da descrição gerada ao emitir a OS.
    .filter(t => !(t.description || '').startsWith('Mão de Obra - OS '))
    .filter(t => {
      const matchesFilter = filterType === 'ALL' || t.type === filterType;
      const desc = t.description || '';
      const contact = t.contactName || '';
      const matchesSearch = desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            contact.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    }).sort((a, b) => b.date - a.date);

  const businessAccounts = useMemo(() => accounts.filter(a => a.type !== AccountType.PERSONAL), [accounts]);
  const businessCategories = useMemo(() => categories.filter(c => !c.isPersonal), [categories]);

  // Soma de Receitas/Despesas da busca atual (ex.: nome de fornecedor/cliente) — some `filtered`
  // (já aplica o texto pesquisado), não a lista completa. Só aparece com busca preenchida — sem
  // texto, `filtered` é só o filtro de tipo (Tudo/Entradas/Saídas), não faria sentido resumir.
  const searchTotals = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const income = filtered.filter(t => t.type === TransactionType.INCOME).reduce((a, t) => a + t.amount, 0);
    const expenses = filtered.filter(t => t.type === TransactionType.EXPENSE).reduce((a, t) => a + t.amount, 0);
    return { income, expenses };
  }, [filtered, searchTerm]);

  // Receitas/Despesas do período escolhido no filtro do card (ver `statsPeriodType`/
  // `statsPeriodDate`) — usa `effectiveTransactions` (não só `transactions`, que só carrega
  // "recente ou em aberto") pra funcionar corretamente em períodos antigos, quando o histórico
  // completo já foi carregado (ver `handleLoadFullHistory`).
  const periodFinancials = useMemo(() => {
    const businessTransactions = effectiveTransactions.filter(t => !t.isPersonal && accounts.find(a => a.id === t.accountId)?.type !== AccountType.PERSONAL);
    const { start, end } = getPeriodRange(statsPeriodType, statsPeriodDate);
    return computePeriodFinancials(businessTransactions, start, end);
  }, [effectiveTransactions, accounts, statsPeriodType, statsPeriodDate]);

  // Lucro com Vendas — agora o destaque principal do card, no lugar do Saldo Confirmado (que
  // virou uma métrica secundária ao lado de Receitas/Despesas). Total cobrado nas vendas
  // fechadas do período menos o custo dos produtos vendidos (ver computeSalesProfitInPeriod).
  const periodSalesProfit = useMemo(() => {
    const { start, end } = getPeriodRange(statsPeriodType, statsPeriodDate);
    return computeSalesProfitInPeriod(sales, products, start, end);
  }, [sales, products, statsPeriodType, statsPeriodDate]);

  // Despesas Recorrentes — agrupa as ocorrências de cada série de Compra Recorrente (ver
  // Purchase.recurrenceGroupId, gerado em PurchaseFormView: uma Purchase por mês, cada uma com
  // seu próprio paymentStatus). "Parcelas restantes" cai sozinho conforme cada ocorrência é
  // quitada em Compras — não tem estado próprio aqui, é só COMPLETED/PAID contado de novo a
  // cada render.
  const recurringExpenseGroups = useMemo(() => {
    const groups = new Map<string, Purchase[]>();
    purchases.forEach(p => {
      if (!p.isRecurring || !p.recurrenceGroupId) return;
      const list = groups.get(p.recurrenceGroupId) || [];
      list.push(p);
      groups.set(p.recurrenceGroupId, list);
    });
    return Array.from(groups.entries())
      .map(([groupId, occs]) => {
        const sorted = [...occs].sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
        const first = sorted[0];
        const supplier = people.find(p => p.id === first.supplierId);
        const paidCount = sorted.filter(o => o.paymentStatus === PaymentStatus.PAID).length;
        const totalInstallments = first.totalInstallments || sorted.length;
        const nextDue = sorted.find(o => o.paymentStatus !== PaymentStatus.PAID) || null;
        const description = first.generalItems?.[0]?.description || first.notes || 'Compra recorrente';
        return {
          groupId,
          description,
          supplierName: supplier?.name || 'Fornecedor não informado',
          installmentValue: first.total,
          totalInstallments,
          paidCount,
          remainingCount: Math.max(0, totalInstallments - paidCount),
          nextDue,
          occurrences: sorted,
        };
      })
      .sort((a, b) => (a.nextDue?.dueDate || Infinity) - (b.nextDue?.dueDate || Infinity));
  }, [purchases, people]);

  const [isRecurringExpensesExpanded, setIsRecurringExpensesExpanded] = useState(false);
  const [recurringLookupMonth, setRecurringLookupMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const recurringMonthInputRef = useRef<HTMLInputElement>(null);
  const openRecurringMonthPicker = () => {
    const el = recurringMonthInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };
  // Quanto devo no mês escolhido — soma, em cada série, a ocorrência (se houver) cujo
  // vencimento cai naquele mês/ano, pago ou não (pergunta é "quanto é o compromisso do mês",
  // não "quanto falta pagar").
  const recurringMonthlyTotal = useMemo(() => {
    const [y, m] = recurringLookupMonth.split('-').map(Number);
    if (!y || !m) return 0;
    return recurringExpenseGroups.reduce((acc, g) => {
      const occ = g.occurrences.find(o => {
        const d = new Date(o.dueDate || o.date);
        return d.getFullYear() === y && d.getMonth() === m - 1;
      });
      return acc + (occ ? occ.total : 0);
    }, 0);
  }, [recurringExpenseGroups, recurringLookupMonth]);

  // Total em aberto AGORA — vendas fechadas ainda não totalmente pagas e compras a prazo ainda
  // não totalmente pagas (ver `showPendingStats`).
  const pendingReceivables = useMemo(() => computePendingReceivables(sales), [sales]);
  const pendingPayables = useMemo(() => computePendingPayables(purchases), [purchases]);

  // Receitas/Despesas exibidas — só somam o que ainda está em aberto (pendingReceivables/
  // pendingPayables) quando o filtro "mostrar a receber/a pagar" está ligado; do contrário é só
  // o que já foi confirmado no período (periodFinancials).
  const totalReceitas = periodFinancials.income + (showPendingStats ? pendingReceivables : 0);
  const totalDespesas = periodFinancials.expenses + (showPendingStats ? pendingPayables : 0);

  const handleAdd = (type: TransactionType) => {
    setModalInitialType(type);
    setEditingTransaction(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSettle = async (transaction: Transaction) => {
    try {
      setSettlingId(transaction.id);
      await onEdit(transaction.id, { status: 'COMPLETED' });
      setSettlingId(null);
    } catch (error: any) {
      setSettlingId(null);
      console.error('Error settling transaction:', error);
      toast.show('Erro ao dar baixa: ' + (error.message || error));
    }
  };

  const handleDeleteClick = (id: string) => {
    setIdToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!idToDelete) return;
    
    setIsConfirmOpen(false);
    try {
      setDeletingId(idToDelete);
      await onDelete(idToDelete);
      setDeletingId(null);
      setIdToDelete(null);
    } catch (error: any) {
      setDeletingId(null);
      setIdToDelete(null);
      console.error('Error deleting transaction:', error);
      toast.show('Erro ao excluir: ' + (error.message || error));
    }
  };

  const handlePartialPayment = (purchase: Purchase, mode: 'PAYMENT' | 'HISTORY' = 'PAYMENT') => {
    setSelectedPurchase(purchase);
    setPaymentModalMode(mode);
    setIsPaymentModalOpen(true);
  };

  const copyHistory = (purchase: Purchase) => {
    if (!purchase.paymentHistory || purchase.paymentHistory.length === 0) {
      toast.show('Nenhum pagamento registrado para copiar');
      return;
    }

    const supplier = people.find(s => s.id === purchase.supplierId);
    const text = purchase.paymentHistory
      .map(p => `${format(p.date, 'dd/MM/yyyy')} - R$ ${p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      .join('\n');
    
    const totalPaid = purchase.paymentHistory.reduce((acc, p) => acc + p.amount, 0);
    const remaining = Math.max(0, purchase.total - totalPaid);

    const summary = `Histórico de Pagamentos - Compra #${purchase.id.slice(-6).toUpperCase()}\nFornecedor: ${supplier?.name || '---'}\nTotal: R$ ${purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n${text}\n\nTotal Pago: R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nRestante: R$ ${remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    navigator.clipboard.writeText(summary);
    toast.show('Histórico de pagamentos copiado!');
  };

  const onPartialPay = async (amount: number, accountId: string, note: string) => {
    if (!selectedPurchase) return;

    const supplier = people.find(s => s.id === selectedPurchase.supplierId);
    
    // 1. Create Transaction
    await onSave({
      type: TransactionType.EXPENSE,
      categoryId: selectedPurchase.categoryId || '',
      accountId: accountId,
      amount: amount,
      date: Date.now(),
      description: `PAGTO PARCIAL COMPRA - ${supplier?.name || ''} ${note ? `(${note})` : ''}`,
      status: 'COMPLETED',
      contactId: selectedPurchase.supplierId,
      contactName: supplier?.name,
      relatedId: selectedPurchase.id
    });

    // 2. Prepare new history entry
    const newPayment: PaymentHistory = {
      id: crypto.randomUUID(),
      date: Date.now(),
      amount: amount,
      accountId: accountId,
      note: note
    };

    const currentHistory = selectedPurchase.paymentHistory || [];
    const updatedHistory = [...currentHistory, newPayment];
    const totalPaid = updatedHistory.reduce((acc, p) => acc + p.amount, 0);

    const isPaid = totalPaid >= selectedPurchase.total;
    
    // 3. Update Purchase
    await onUpdatePurchase(selectedPurchase.id, {
      paymentHistory: updatedHistory,
      paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING
    });

    // 4. Handle Credit if overpaid
    if (totalPaid > selectedPurchase.total && onUpdatePerson && supplier) {
      const overpaid = totalPaid - selectedPurchase.total;
      const currentCredit = supplier.credit || 0;
      await onUpdatePerson(supplier.id, { credit: currentCredit + overpaid });
      toast.show(`Sobrepagamento de R$ ${overpaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} adicionado como crédito ao fornecedor!`);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32 h-full overflow-y-auto overflow-x-hidden force-scrollbar">
      {selectedPurchase && (
        <PartialPaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPurchase(null);
          }}
          entity={selectedPurchase}
          accounts={accounts}
          entityLabel={people.find(s => s.id === selectedPurchase.supplierId)?.name}
          onPay={onPartialPay}
          isDarkMode={isDarkMode}
          initialMode={paymentModalMode}
        />
      )}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Excluir Lançamento?"
        message="Deseja realmente excluir este lançamento? Esta ação irá reverter qualquer saldo vinculado de forma definitiva."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsConfirmOpen(false);
          setIdToDelete(null);
        }}
        isDanger={true}
      />

        <TransactionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={async (data) => {
            try {
              if (editingTransaction) {
                await onEdit(editingTransaction.id, data);
              } else {
                await onSave(data);
              }
            } catch (error: any) {
              console.error('Error saving transaction:', error);
              toast.show('Erro ao salvar: ' + (error.message || error));
            }
          }}
          categories={businessCategories}
          accounts={businessAccounts}
          people={people}
          initialType={modalInitialType}
          transaction={editingTransaction}
          isDarkMode={isDarkMode}
        />

      <FinancialQueryModal
        isOpen={isQueryModalOpen}
        onClose={() => setIsQueryModalOpen(false)}
        people={people}
        transactions={transactions}
        purchases={purchases}
        sales={sales}
        products={products}
        accounts={businessAccounts}
        onSettle={handleSettle}
        onEdit={handleEdit}
        onDeleteClick={handleDeleteClick}
        onOpenPurchase={onOpenPurchase}
        onOpenSale={onOpenSale}
        settlingId={settlingId}
        deletingId={deletingId}
        isDarkMode={isDarkMode}
      />

      <div className="space-y-6">
        {/* Account Warning */}
        {accounts.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex items-center gap-3">
             <AlertCircle className="text-amber-500" size={20} />
             <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 tracking-widest leading-normal">
               Nenhuma conta bancária encontrada. Crie uma conta em "Contas" para gerenciar saldos.
             </p>
          </div>
        )}

        {/* Summary Card — Lucro com Vendas/Receitas/Despesas, lançamento manual e Visualização
            do Meu Negócio, tudo num card só (ver `embedded` em BusinessOverviewCard). */}
        <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200 text-black shadow-slate-200'}`}>
          <div className="p-6 relative">
             <p className={`text-[10px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-black'}`}>Lucro com Vendas {STATS_PERIOD_PHRASE[statsPeriodType]}</p>
             <h2 className={`text-3xl font-black mt-2 tracking-tighter transition-all ${periodSalesProfit >= 0 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : (isDarkMode ? 'text-rose-400' : 'text-rose-500')} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
               R$ {periodSalesProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </h2>

             {/* Filtro de período — controla o Lucro com Vendas acima e Receitas/Despesas
                 abaixo. */}
             <div className="flex items-center gap-1.5 mt-4">
                <div className={`flex gap-0.5 p-0.5 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-white/60'}`}>
                   {(Object.keys(STATS_PERIOD_LABELS) as OverviewPeriodType[]).map((pt) => (
                     <button
                       key={pt}
                       type="button"
                       onClick={() => setStatsPeriodType(pt)}
                       className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                         statsPeriodType === pt ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-700'
                       }`}
                     >
                       {STATS_PERIOD_LABELS[pt]}
                     </button>
                   ))}
                </div>
                <div
                  onClick={openStatsMonthPicker}
                  className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white/60 border-slate-200'}`}
                >
                  <Calendar size={12} className="text-slate-500 shrink-0" />
                  <input
                    ref={statsDateInputRef}
                    type="month"
                    value={statsPeriodDate}
                    onChange={(e) => setStatsPeriodDate(e.target.value)}
                    className={`flex-1 min-w-0 border-none bg-transparent px-0 py-0 text-[10px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                  />
                </div>
             </div>

             {/* Sem/Com valores a receber/a pagar — Receitas/Despesas/Receitas-Despesas abaixo
                 somam ou não o que ainda está em aberto (ver `showPendingStats`). */}
             <div className={`flex gap-0.5 p-0.5 rounded-xl mt-4 ${isDarkMode ? 'bg-slate-800' : 'bg-white/60'}`}>
                <button
                  type="button"
                  onClick={() => setShowPendingStats(false)}
                  className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    !showPendingStats ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-700'
                  }`}
                >
                  Sem valores a receber
                </button>
                <button
                  type="button"
                  onClick={() => setShowPendingStats(true)}
                  className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    showPendingStats ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-700'
                  }`}
                >
                  Com valores a receber
                </button>
             </div>

             <div className={`grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/40 dark:border-slate-800 transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                <div>
                   <p className={`text-[8px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-black'}`}>Receitas</p>
                   <p className={`text-sm font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                   <p className={`text-[8px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-black'}`}>Despesas</p>
                   <p className={`text-sm font-bold ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`}>R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                   <p className={`text-[8px] font-black tracking-widest truncate ${isDarkMode ? 'text-slate-500' : 'text-black'}`}>Receitas - Despesas</p>
                   <p className={`text-sm font-bold ${(totalReceitas - totalDespesas) >= 0 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : (isDarkMode ? 'text-rose-400' : 'text-rose-500')}`}>
                     R$ {(totalReceitas - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                </div>
             </div>

             {showPendingStats && (
               <div className={`grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/40 dark:border-slate-800 transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  <div>
                     <p className={`text-[8px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-black'}`}>Vendas a Receber</p>
                     <p className={`text-sm font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>R$ {pendingReceivables.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                     <p className={`text-[8px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-black'}`}>Contas a Pagar</p>
                     <p className={`text-sm font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>R$ {pendingPayables.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
               </div>
             )}
          </div>

          {/* Cápsula de lançamento manual — substitui os antigos botões "+" flutuantes; agora
              do tamanho do card acima, com o nome de cada função, e confirma o que vai fazer
              antes de abrir o formulário (ver `manualEntryConfirmType`). */}
          <div className={`grid grid-cols-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
             <button
               type="button"
               onClick={() => setManualEntryConfirmType(TransactionType.INCOME)}
               className={`flex items-center justify-center gap-2 py-4 border-r font-black text-[10px] uppercase tracking-widest active:scale-[0.98] transition-all ${isDarkMode ? 'bg-emerald-900/30 text-emerald-400 border-slate-800' : 'bg-emerald-50 text-emerald-600 border-slate-200'}`}
             >
               <TrendingUp size={16} strokeWidth={3} /> Nova Entrada
             </button>
             <button
               type="button"
               onClick={() => setManualEntryConfirmType(TransactionType.EXPENSE)}
               className={`flex items-center justify-center gap-2 py-4 font-black text-[10px] uppercase tracking-widest active:scale-[0.98] transition-all ${isDarkMode ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}
             >
               <TrendingDown size={16} strokeWidth={3} /> Nova Saída
             </button>
          </div>

          {/* Visualização do Meu Negócio — embutida no mesmo card (ver prop `embedded`), em vez
              de um card avulso separado abaixo. */}
          <div className={`p-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <BusinessOverviewCard
              isDarkMode={isDarkMode}
              products={products}
              productionLots={productionLots}
              productionConfigs={productionConfigs}
              accounts={accounts}
              sales={sales}
              transactions={transactions}
              purchases={purchases}
              people={people}
              categories={categories}
              onDeleteTransaction={onDelete}
              embedded
            />
          </div>
        </div>

        <ConfirmDialog
          isOpen={manualEntryConfirmType !== null}
          title={manualEntryConfirmType ? MANUAL_ENTRY_INFO[manualEntryConfirmType].title : ''}
          message={manualEntryConfirmType ? MANUAL_ENTRY_INFO[manualEntryConfirmType].message : ''}
          confirmLabel="Continuar"
          cancelLabel="Cancelar"
          isDanger={manualEntryConfirmType === TransactionType.EXPENSE}
          onConfirm={() => { if (manualEntryConfirmType) handleAdd(manualEntryConfirmType); setManualEntryConfirmType(null); }}
          onCancel={() => setManualEntryConfirmType(null)}
        />

        <div className="flex flex-col gap-4 sticky top-0 z-30 py-4 bg-[#fafafa] dark:bg-slate-950 -mx-4 px-4 border-b border-slate-100 dark:border-slate-900 shadow-sm">
          {/* Filters Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button 
              onClick={() => setFilterType('ALL')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${filterType === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Tudo
            </button>
            <button 
              onClick={() => setFilterType(TransactionType.INCOME)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${filterType === TransactionType.INCOME ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Entradas
            </button>
            <button 
              onClick={() => setFilterType(TransactionType.EXPENSE)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${filterType === TransactionType.EXPENSE ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Saídas
            </button>
            <button 
              onClick={() => setFilterType('PAYABLE')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${filterType === 'PAYABLE' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}
            >
              A Pagar
              {payableCount > 0 && (
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[8px] font-black ${filterType === 'PAYABLE' ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>
                  {payableCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar lançamento..."
                className={`w-full border rounded-2xl py-3 pl-11 pr-4 text-xs font-bold tracking-tight focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 text-slate-800 dark:text-slate-100 shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Soma da busca atual (ex.: nome de fornecedor/cliente) — some `filtered`, já
              restrito ao texto pesquisado e ao filtro de tipo (Tudo/Entradas/Saídas) acima. */}
          {searchTotals && (
            <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-indigo-50 border-indigo-100'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-indigo-400'}`}>Receitas na busca</p>
                <p className={`text-sm font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>R$ {searchTotals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`w-px h-8 shrink-0 ${isDarkMode ? 'bg-slate-700' : 'bg-indigo-200'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-indigo-400'}`}>Despesas na busca</p>
                <p className={`text-sm font-black ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`}>R$ {searchTotals.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {filterType === 'PAYABLE' ? (
            purchases
              .filter(p => p.paymentTerm === PaymentTerm.INSTALLMENTS && p.paymentStatus !== PaymentStatus.PAID)
              .filter(p => {
                const supplier = people.find(s => s.id === p.supplierId);
                const supplierName = supplier?.name || '';
                const notes = p.notes || '';
                return supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       notes.toLowerCase().includes(searchTerm.toLowerCase());
              })
              .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
              .map(purchase => {
                const supplier = people.find(s => s.id === purchase.supplierId);
                const daysUntil = purchase.dueDate ? differenceInDays(purchase.dueDate, new Date()) : null;
                const isLate = daysUntil !== null && daysUntil < 0;
                
                const totalPaid = (purchase.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
                const remaining = Math.max(0, purchase.total - totalPaid);

                const isExpanded = expandedIds.includes(purchase.id);
                const itemCount = purchase.type === PurchaseType.GENERAL
                  ? (purchase.generalItems?.length || 0)
                  : purchase.type === PurchaseType.SOLE
                  ? (purchase.soleItems?.length || 0)
                  : (purchase.items?.length || 0);
                const hasDetails = !!purchase.notes || itemCount > 0;

                return (
                  <div key={purchase.id} className={`p-4 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500 text-white text-[10px] font-black uppercase tracking-wide truncate max-w-full">
                            <User size={11} className="shrink-0" /> {supplier?.name || 'Fornecedor Desconhecido'}
                          </span>
                          <span className="font-black text-base tracking-tight text-rose-500 shrink-0">
                            R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                           <Package size={12} className={isDarkMode ? 'text-slate-400' : 'text-slate-400'} />
                           <h3 className={`font-black text-base uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              {purchase.type === PurchaseType.REPLENISHMENT ? 'Abastecimento de Estoque' : 'Compra Geral'}
                           </h3>
                           {totalPaid > 0 && <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-500">Parcial</span>}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 tracking-widest"><Hash size={11} /> ID: {purchase.batchNumber || purchase.id.slice(-6).toUpperCase()}</span>
                          {totalPaid > 0 ? (
                             <span className="text-[10px] font-bold text-slate-400 tracking-widest line-through">
                               Total: R$ {purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                          ) : (
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest ${isLate ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
                              {isLate ? <AlertCircle size={10} /> : <Clock size={10} />}
                              {isLate ? 'Vencido' : 'Pendente'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {hasDetails && (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(purchase.id)}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[10px] font-black tracking-[0.2em] uppercase transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                        >
                          <span className="flex items-center gap-2">
                            <FileText size={14} />
                            Descrição e Itens da Compra
                            {itemCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black normal-case tracking-normal">
                                {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                              </span>
                            )}
                          </span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {isExpanded && (
                          <div className="flex flex-col gap-2">
                            {purchase.notes && (
                              <p className={`text-xs font-semibold leading-relaxed p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                {purchase.notes}
                              </p>
                            )}
                            {purchase.type === PurchaseType.GENERAL
                              ? purchase.generalItems?.map((item, idx) => renderPurchaseItemRow(item, idx))
                              : purchase.type === PurchaseType.SOLE
                              ? purchase.soleItems?.map((item: any, idx) => renderPurchaseItemRow(item, idx))
                              : purchase.items?.map((item: any, idx) => renderPurchaseItemRow(item, idx))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        {purchase.dueDate && (
                          <span className={`text-[10px] font-bold tracking-widest flex items-center gap-1 ${isLate ? 'text-rose-500' : 'text-slate-400'}`}>
                            <Calendar size={11} />
                            Vence em: {format(purchase.dueDate, "dd/MM/yyyy")}
                          </span>
                        )}
                        {totalPaid > 0 && (
                          <span className="text-[10px] font-black tracking-widest px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                             PAGO: R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>

                      <button
                         type="button"
                         onClick={() => handlePartialPayment(purchase, 'PAYMENT')}
                         className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white text-[11px] font-black tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                      >
                        <DollarSign size={16} strokeWidth={3} />
                        Fazer Pagamento
                      </button>

                      {/* New Row: History and Copy */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePartialPayment(purchase, 'HISTORY')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-black tracking-[0.2em] transition-all hover:bg-slate-50 dark:hover:bg-slate-800 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-500'}`}
                        >
                          <History size={14} />
                          Ver Histórico
                        </button>
                        <button
                          onClick={() => copyHistory(purchase)}
                          className={`px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black tracking-[0.2em] transition-all ${isDarkMode ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/30' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}
                          title="Copiar Histórico de Pagamentos"
                        >
                          <Clipboard size={14} />
                          Copiar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
          ) : (
            // A listagem item a item de Tudo/Entradas/Saídas saiu daqui — o mesmo card completo
            // (com busca por cliente/fornecedor, filtro de status e período) agora vive só no
            // card "Consultas" acima de Ordens de Serviço a Fornecedores, pra não duplicar a
            // mesma lista em dois lugares da tela. Sem card de atalho aqui embaixo também
            // (pedido do usuário: ocupava espaço grande demais na tela à toa).
            null
        )}

          {/* Lançamentos antigos e já liquidados não ficam carregados por padrão — busca sob
              demanda. Continua aqui (independente da listagem acima ter virado um atalho pra
              Consultas) porque também alimenta os totais de Receitas/Despesas de períodos
              antigos no card do topo (ver `effectiveTransactions`/`periodFinancials`). */}
          {searchTerm.trim() && !olderTransactions && (
            <button
              type="button"
              onClick={handleLoadFullHistory}
              disabled={isLoadingHistory}
              className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}
            >
              {isLoadingHistory ? 'Carregando...' : 'Carregar lançamentos mais antigos'}
            </button>
          )}
        </div>

        <CommissionToSellersCard
          isDarkMode={isDarkMode}
          sales={sales}
          collaborators={collaborators}
          people={people}
          companyProfile={companyProfile}
          onPayCommission={onPayCommission}
          onOpenSale={onOpenSale}
          advancePercent={advancePercent}
          loans={loans}
          onSaveLoan={onSaveLoan}
        />
        <ProviderServiceOrdersCard
          isDarkMode={isDarkMode}
          serviceOrders={serviceOrders}
          transactions={transactions}
          people={people}
          products={products}
          companyProfile={companyProfile}
          onPayProviderServiceOrders={onPayProviderServiceOrders}
        />

        {/* Consultas — promovido do botão pequeno que ficava dentro do card "Lucro com Vendas"
            pra um card próprio aqui, mais visível. Abre o mesmo FinancialQueryModal de sempre
            (busca lançamentos por cliente/fornecedor, com baixa/edição/exclusão). */}
        <button
          type="button"
          onClick={() => setIsQueryModalOpen(true)}
          data-guide-anchor="financial.consultasAbrir"
          className={`w-full flex items-center gap-4 p-6 rounded-[2.5rem] border shadow-sm transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/50' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
            <ClipboardCheck size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Consultas</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Buscar lançamentos por cliente ou fornecedor</p>
          </div>
          <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
        </button>

        {/* Despesas Recorrentes — séries de Compra Recorrente (ver Purchase.recurrenceGroupId,
            gerada em PurchaseFormView). "Restantes" cai sozinho conforme cada parcela é quitada
            em Compras — não é um contador próprio, é recalculado a cada render a partir do
            paymentStatus de cada ocorrência. */}
        {recurringExpenseGroups.length > 0 && (
          <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button
              type="button"
              onClick={() => setIsRecurringExpensesExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-3 p-6"
            >
              <div className="flex items-center gap-3 text-left min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-cyan-900/20 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                  <Repeat size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Despesas Recorrentes</p>
                  <p className={`text-lg font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {recurringExpenseGroups.length} {recurringExpenseGroups.length === 1 ? 'série ativa' : 'séries ativas'}
                  </p>
                </div>
              </div>
              <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${isRecurringExpensesExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isRecurringExpensesExpanded && (
              <div className={`flex flex-col gap-4 px-6 pb-6 border-t pt-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                {/* Filtro de período — "quanto devo" num mês específico, inclusive futuro */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Quanto devo em...</p>
                  <div
                    onClick={openRecurringMonthPicker}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <Calendar size={13} className="text-cyan-500 shrink-0" />
                    <input
                      ref={recurringMonthInputRef}
                      type="month"
                      value={recurringLookupMonth}
                      onChange={(e) => setRecurringLookupMonth(e.target.value)}
                      className={`flex-1 min-w-0 border-none bg-transparent px-0 py-0 text-[11px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                    />
                  </div>
                  <p className={`text-xl font-black tracking-tighter mt-2 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                    R$ {recurringMonthlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {recurringExpenseGroups.map(g => (
                    <div key={g.groupId} className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                      <div className="min-w-0">
                        <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{g.description}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                          {g.supplierName} · <span className={`transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {g.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
                          {g.nextDue && ` · próx. ${format(g.nextDue.dueDate || g.nextDue.date, 'dd/MM/yyyy')}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black ${g.remainingCount > 0 ? (isDarkMode ? 'text-amber-400' : 'text-amber-600') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
                          {g.remainingCount} restantes
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">de {g.totalInstallments} · {g.paidCount} pagas</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}


