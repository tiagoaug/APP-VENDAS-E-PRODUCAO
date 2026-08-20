import { useState, useMemo, useRef } from 'react';
import { Transaction, TransactionType, Category, Account, AccountType, Person, Purchase, PaymentStatus, PurchaseType, PaymentTerm, PaymentHistory, Sale, SaleStatus, Product, SaleType, ProductionLot, ProductionConfigItem, Collaborator, CompanyProfile, ServiceOrder, GeneralPurchaseItem } from '../types';
import { Search, TrendingUp, TrendingDown, DollarSign, Calendar, Wallet, User, Trash2, Edit, CheckCircle2, AlertCircle, Clock, RefreshCcw, ClipboardCheck, Package, History, Clipboard, Hash, ChevronDown, ChevronUp, Tag, FileText, Repeat, Send, FileDown, Image as ImageIcon, Hammer, Factory, X } from 'lucide-react';
import { exportCommission } from '../utils/commissionExport';
import { exportProviderOS } from '../utils/serviceOrderProviderExport';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TransactionModal from '../components/TransactionModal';
import ConfirmDialog from '../components/ConfirmDialog';
import FinancialQueryModal from '../components/FinancialQueryModal';
import PartialPaymentModal from '../components/PartialPaymentModal';
import BusinessOverviewCard from '../components/BusinessOverviewCard';
import { toast } from '../utils/toast';
import { firebaseService } from '../services/firebaseService';
import { getPeriodRange, computePeriodFinancials, computeSalesProfitInPeriod, computePendingReceivables, computePendingPayables, OverviewPeriodType } from '../utils/businessOverview';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';
import { generateId } from '../utils/id';

const STATS_PERIOD_LABELS: Record<OverviewPeriodType, string> = { MONTH: 'Mês', QUARTER: 'Trim', SEMESTER: 'Sem', YEAR: 'Ano' };
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
   * vendedor, pronto pra virar um título a pagar — ver handlePayCommission abaixo. */
  onPayCommission?: (params: { supplierId?: string; initialGeneralItems: { id: string; description: string; quantity: number; value: number; kind: 'general' }[]; initialDescription: string }) => void;
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

  // Comissão a Vendedores — soma Sale.commissionAmount (já "assado" na venda, ver SaleFormView)
  // por colaborador-vendedor, dentro do período escolhido abaixo. Só conta vendas de verdade
  // (não orçamento nem cancelada), igual ao resto das métricas de vendas desta tela.
  const [isCommissionExpanded, setIsCommissionExpanded] = useState(false);
  const [commissionPeriodType, setCommissionPeriodType] = useState<OverviewPeriodType>('MONTH');
  const [commissionPeriodDate, setCommissionPeriodDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const commissionDateInputRef = useRef<HTMLInputElement>(null);
  const openCommissionMonthPicker = () => {
    const el = commissionDateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };
  // Desligado = só conta comissão de pedidos já recebidos (paymentStatus PAID) no "total a
  // pagar" — ligado, soma junto o que ainda está pendente de recebimento do cliente.
  const [includeUnpaidCommission, setIncludeUnpaidCommission] = useState(false);
  const [expandedCommissionSellerId, setExpandedCommissionSellerId] = useState<string | null>(null);

  const sellerCommissions = useMemo(() => {
    const sellerCollaborators = collaborators.filter(c => c.isSeller);
    if (sellerCollaborators.length === 0) return [];
    const { start, end } = getPeriodRange(commissionPeriodType, commissionPeriodDate);
    const realSales = sales.filter(s => s.status !== SaleStatus.QUOTE && s.status !== SaleStatus.CANCELLED && s.isAccounting !== false && s.date >= start && s.date <= end);
    return sellerCollaborators
      .map(c => {
        const collabSales = realSales
          .filter(s => s.sellerId === c.id)
          .map(s => ({
            sale: s,
            paid: s.paymentStatus === PaymentStatus.PAID,
            commission: s.commissionAmount || 0,
          }))
          .sort((a, b) => b.sale.date - a.sale.date);
        const totalSales = collabSales.reduce((acc, s) => acc + s.sale.total, 0);
        const receivedCommission = collabSales.filter(s => s.paid).reduce((acc, s) => acc + s.commission, 0);
        const pendingCommission = collabSales.filter(s => !s.paid).reduce((acc, s) => acc + s.commission, 0);
        return {
          collaborator: c,
          salesCount: collabSales.length,
          totalSales,
          receivedCommission,
          pendingCommission,
          totalCommission: receivedCommission + pendingCommission,
          sales: collabSales,
        };
      })
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [collaborators, sales, commissionPeriodType, commissionPeriodDate]);
  const hasSellerCollaborators = useMemo(() => collaborators.some(c => c.isSeller), [collaborators]);

  // Total "a pagar" — segue o toggle acima: com ele desligado, só o que já foi recebido do
  // cliente entra na conta (comissão certa); ligado, soma também o que ainda está pendente.
  const totalCommissionOwed = sellerCommissions.reduce(
    (acc, s) => acc + s.receivedCommission + (includeUnpaidCommission ? s.pendingCommission : 0),
    0,
  );

  const commissionPeriodLabel = useMemo(
    () => format(new Date(commissionPeriodDate + '-01T12:00:00'), 'MMMM/yyyy', { locale: ptBR }),
    [commissionPeriodDate],
  );

  const handleCopyCommission = (sellerLabel: string, value: number) => {
    navigator.clipboard.writeText(`Comissão de ${sellerLabel} — ${commissionPeriodLabel}\nR$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    toast.show('Valor copiado!');
  };

  const handlePayCommission = (sc: (typeof sellerCommissions)[number]) => {
    const value = sc.receivedCommission + (includeUnpaidCommission ? sc.pendingCommission : 0);
    if (value <= 0) {
      toast.show('Nenhum valor de comissão a pagar nesse período.');
      return;
    }
    if (!onPayCommission) return;
    const description = `Comissão de Vendas — ${sc.collaborator.name} (${commissionPeriodLabel})`;
    // Tenta achar um Fornecedor já cadastrado com o mesmo nome do colaborador-vendedor —
    // Purchase exige um supplierId (Pessoa), e Collaborator não tem esse vínculo direto. Sem
    // achar, deixa em branco: o próprio formulário de Compra pede pra escolher/cadastrar.
    const matchedSupplier = people.find(p => p.isSupplier && p.name.trim().toLowerCase() === sc.collaborator.name.trim().toLowerCase());
    onPayCommission({
      supplierId: matchedSupplier?.id,
      initialGeneralItems: [{ id: generateId(), description, quantity: 1, value, kind: 'general' }],
      initialDescription: description,
    });
    if (!matchedSupplier) {
      toast.show('Não achei um fornecedor cadastrado com esse nome — escolha ou cadastre um na tela de Compra que abriu.');
    }
  };

  const handleExportCommission = (sc: (typeof sellerCommissions)[number], type: 'pdf' | 'jpg') => {
    exportCommission({
      sellerName: sc.collaborator.name,
      commissionPercent: sc.collaborator.commissionPercent,
      periodLabel: commissionPeriodLabel,
      sales: sc.sales.map(({ sale, paid, commission }) => ({
        orderNumber: sale.orderNumber,
        customerName: sale.customerName || 'Sem cliente',
        date: sale.date,
        total: sale.total,
        commission,
        paid,
      })),
      receivedCommission: sc.receivedCommission,
      pendingCommission: sc.pendingCommission,
      includeUnpaid: includeUnpaidCommission,
      companyProfile,
    }, type);
  };

  // Ordens de Serviço a Fornecedores — agrupa TODA ServiceOrder por providerName (mesmo estilo
  // do card de Comissão a Vendedores acima), mas com uma diferença importante: o Total em
  // Aberto de cada fornecedor é SEMPRE o acumulado de toda OS concluída ainda sem pagamento
  // (usa o vínculo real ServiceOrder.transactionId → Transaction.status, ver isOsPaid), não
  // fica preso ao período selecionado — o período aqui só filtra a lista "concluídas no
  // período" pra conferência, igual o resto da tela já faz com outras métricas. Ao contrário da
  // Comissão (sem trava contra pagar a mesma venda duas vezes), aqui cada item enviado pra
  // Compras carrega o id da OS de origem (ver handlePayProvider/GeneralPurchaseItem.serviceOrderId
  // abaixo) — assim que a Compra é totalmente paga, o saldo fecha sozinho.
  const isOsPaid = (os: ServiceOrder) => !!os.transactionId && transactions.find(t => t.id === os.transactionId)?.status === 'COMPLETED';

  const [isProviderOSExpanded, setIsProviderOSExpanded] = useState(false);
  const [providerOSPeriodType, setProviderOSPeriodType] = useState<OverviewPeriodType>('MONTH');
  const [providerOSPeriodDate, setProviderOSPeriodDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const providerOSDateInputRef = useRef<HTMLInputElement>(null);
  const openProviderOSMonthPicker = () => {
    const el = providerOSDateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };
  const [expandedProviderKey, setExpandedProviderKey] = useState<string | null>(null);
  const [providerOSSearch, setProviderOSSearch] = useState('');
  const [providerDetailTab, setProviderDetailTab] = useState<Record<string, 'open' | 'period'>>({});

  type ProviderOSGroup = {
    key: string;
    providerName: string;
    providerId?: string;
    openBalance: number;
    openOrders: ServiceOrder[];
    completedInPeriod: ServiceOrder[];
    completedInPeriodTotal: number;
    pendingCount: number;
  };

  const providerOSGroups = useMemo<ProviderOSGroup[]>(() => {
    if (serviceOrders.length === 0) return [];
    const { start, end } = getPeriodRange(providerOSPeriodType, providerOSPeriodDate);
    const map = new Map<string, ProviderOSGroup>();
    for (const os of serviceOrders) {
      const key = (os.providerName || '').trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) {
        const matchedPerson = os.providerId
          ? people.find(p => p.id === os.providerId)
          : people.find(p => (p.isServiceProvider || p.isSupplier) && p.name.trim().toLowerCase() === key);
        map.set(key, {
          key, providerName: os.providerName, providerId: os.providerId || matchedPerson?.id,
          openBalance: 0, openOrders: [], completedInPeriod: [], completedInPeriodTotal: 0, pendingCount: 0,
        });
      }
      const group = map.get(key)!;
      if (os.status === 'COMPLETED') {
        if (!isOsPaid(os)) {
          group.openBalance += Number(os.totalValue) || 0;
          group.openOrders.push(os);
        }
        if (os.finishedAt && os.finishedAt >= start && os.finishedAt <= end) {
          group.completedInPeriod.push(os);
          group.completedInPeriodTotal += Number(os.totalValue) || 0;
        }
      } else {
        group.pendingCount++;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.openBalance - a.openBalance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceOrders, transactions, people, providerOSPeriodType, providerOSPeriodDate]);

  const totalProviderOSOpenBalance = providerOSGroups.reduce((s, g) => s + g.openBalance, 0);
  const providerOSPeriodLabel = useMemo(
    () => format(new Date(providerOSPeriodDate + '-01T12:00:00'), 'MMMM/yyyy', { locale: ptBR }),
    [providerOSPeriodDate],
  );

  // Monta a descrição de uma OS pro item da Compra — sempre com o que foi feito (referência,
  // produto, cor, quantidade, setor, observações), mesmo pras "não contábeis" (valor zerado): o
  // fornecedor precisa ver o trabalho listado, não só um valor sem explicação.
  const describeServiceOrderItem = (os: ServiceOrder): string => {
    const reference = products.find(p => p.id === os.productId)?.reference;
    const productLabel = `${reference ? `${reference} ` : ''}${os.productName}${os.variationName ? ` (${os.variationName})` : ''}`;
    const parts = [os.osNumber, productLabel, `${os.quantity} par${os.quantity === 1 ? '' : 'es'}`, os.sectorName];
    const desc = parts.filter(Boolean).join(' — ');
    return os.notes ? `${desc}: ${os.notes}` : desc;
  };

  const handlePayProvider = (group: ProviderOSGroup) => {
    if (group.openOrders.length === 0) { toast.show('Nenhuma OS em aberto pra esse fornecedor.'); return; }
    if (!onPayProviderServiceOrders) return;
    // Todas as OS em aberto viram item — inclusive as de valor zerado ("não contábeis"), que
    // aparecem como R$ 0,00 mas sempre com a descrição do que foi feito (ver
    // describeServiceOrderItem acima).
    const initialGeneralItems: GeneralPurchaseItem[] = group.openOrders.map(os => ({
      id: generateId(),
      description: describeServiceOrderItem(os),
      quantity: 1,
      value: Number(os.totalValue) || 0,
      kind: 'general',
      serviceOrderId: os.id,
    }));
    const initialDescription = `Pagamento a Fornecedor — ${group.providerName} (${group.openOrders.length} OS)`;
    const matchedSupplier = group.providerId
      ? people.find(p => p.id === group.providerId)
      : people.find(p => (p.isServiceProvider || p.isSupplier) && p.name.trim().toLowerCase() === group.providerName.trim().toLowerCase());
    onPayProviderServiceOrders({ supplierId: matchedSupplier?.id, initialGeneralItems, initialDescription });
    if (!matchedSupplier) {
      toast.show('Não achei um fornecedor cadastrado com esse nome — escolha ou cadastre um na tela de Compra que abriu.');
    }
  };

  const handleCopyProviderOS = (group: ProviderOSGroup) => {
    const lines = [
      `Ordens de Serviço — ${group.providerName} (${providerOSPeriodLabel})`,
      ...group.openOrders.map(os => `${describeServiceOrderItem(os)} — R$ ${(Number(os.totalValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      `Total em Aberto: R$ ${group.openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.show('Lista copiada!');
  };

  const handleExportProviderOS = (group: ProviderOSGroup, type: 'pdf' | 'jpg') => {
    exportProviderOS({
      providerName: group.providerName,
      periodLabel: providerOSPeriodLabel,
      orders: group.openOrders.map(os => ({
        osNumber: os.osNumber,
        reference: products.find(p => p.id === os.productId)?.reference,
        productName: os.productName,
        variationName: os.variationName,
        quantity: os.quantity,
        total: Number(os.totalValue) || 0,
        paid: false,
      })),
      openBalance: group.openBalance,
      companyProfile,
    }, type);
  };

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
        onSettle={handleSettle}
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
        <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-gradient-to-br from-sky-100 via-blue-100 to-sky-200 border-sky-200 text-sky-900 shadow-sky-100'}`}>
          <div className="p-6 relative">
             <div className="absolute top-6 right-6">
                <button
                  onClick={() => setIsQueryModalOpen(true)}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-indigo-400 border border-slate-700' : 'bg-white/60 text-sky-700 backdrop-blur-md border border-sky-200 shadow-sm'}`}
                >
                  <ClipboardCheck size={22} strokeWidth={2.5} />
                  <span className="text-[7px] font-black tracking-[0.1em]">Consultas</span>
                </button>
             </div>
             <p className={`text-[10px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-sky-500'}`}>Lucro com Vendas {STATS_PERIOD_PHRASE[statsPeriodType]}</p>
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
                         statsPeriodType === pt ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-sky-700'
                       }`}
                     >
                       {STATS_PERIOD_LABELS[pt]}
                     </button>
                   ))}
                </div>
                <div
                  onClick={openStatsMonthPicker}
                  className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white/60 border-sky-200'}`}
                >
                  <Calendar size={12} className="text-sky-500 shrink-0" />
                  <input
                    ref={statsDateInputRef}
                    type="month"
                    value={statsPeriodDate}
                    onChange={(e) => setStatsPeriodDate(e.target.value)}
                    className={`flex-1 min-w-0 border-none bg-transparent px-0 py-0 text-[10px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-slate-300' : 'text-sky-700'}`}
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
                    !showPendingStats ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-sky-700'
                  }`}
                >
                  Sem valores a receber
                </button>
                <button
                  type="button"
                  onClick={() => setShowPendingStats(true)}
                  className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    showPendingStats ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-sky-700'
                  }`}
                >
                  Com valores a receber
                </button>
             </div>

             <div className={`grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/40 dark:border-slate-800 transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                <div>
                   <p className={`text-[8px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-sky-500'}`}>Receitas</p>
                   <p className={`text-sm font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                   <p className={`text-[8px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-sky-500'}`}>Despesas</p>
                   <p className={`text-sm font-bold ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`}>R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                   <p className={`text-[8px] font-black tracking-widest truncate ${isDarkMode ? 'text-slate-500' : 'text-sky-500'}`}>Receitas - Despesas</p>
                   <p className={`text-sm font-bold ${(totalReceitas - totalDespesas) >= 0 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : (isDarkMode ? 'text-rose-400' : 'text-rose-500')}`}>
                     R$ {(totalReceitas - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                </div>
             </div>

             {showPendingStats && (
               <div className={`grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/40 dark:border-slate-800 transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  <div>
                     <p className={`text-[8px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-sky-500'}`}>Vendas a Receber</p>
                     <p className={`text-sm font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>R$ {pendingReceivables.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                     <p className={`text-[8px] font-black tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-sky-500'}`}>Contas a Pagar</p>
                     <p className={`text-sm font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>R$ {pendingPayables.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
               </div>
             )}
          </div>

          {/* Cápsula de lançamento manual — substitui os antigos botões "+" flutuantes; agora
              do tamanho do card acima, com o nome de cada função, e confirma o que vai fazer
              antes de abrir o formulário (ver `manualEntryConfirmType`). */}
          <div className={`grid grid-cols-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-sky-200'}`}>
             <button
               type="button"
               onClick={() => setManualEntryConfirmType(TransactionType.INCOME)}
               className={`flex items-center justify-center gap-2 py-4 border-r font-black text-[10px] uppercase tracking-widest active:scale-[0.98] transition-all ${isDarkMode ? 'bg-emerald-900/30 text-emerald-400 border-slate-800' : 'bg-emerald-50 text-emerald-600 border-sky-200'}`}
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
          <div className={`p-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-sky-200'}`}>
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

        {/* Comissão a Vendedores — só aparece se algum colaborador estiver marcado como
            Vendedor (ver Collaborator.isSeller em Colaboradores). Soma Sale.commissionAmount,
            já calculado na hora de salvar cada venda (ver SaleFormView). */}
        {hasSellerCollaborators && (
          <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button
              type="button"
              onClick={() => setIsCommissionExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-3 p-6"
            >
              <div className="text-left min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comissão a Vendedores</p>
                <p className={`text-2xl font-black tracking-tighter mt-1 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  R$ {totalCommissionOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${isCommissionExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isCommissionExpanded && (
              <div className={`flex flex-col gap-4 px-6 pb-6 border-t pt-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                {/* Período — controla quais vendas entram na comissão abaixo */}
                <div className="flex items-center gap-1.5">
                  <div className={`flex gap-0.5 p-0.5 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    {(Object.keys(STATS_PERIOD_LABELS) as OverviewPeriodType[]).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setCommissionPeriodType(pt)}
                        className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                          commissionPeriodType === pt ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        {STATS_PERIOD_LABELS[pt]}
                      </button>
                    ))}
                  </div>
                  <div
                    onClick={openCommissionMonthPicker}
                    className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <Calendar size={12} className="text-indigo-500 shrink-0" />
                    <input
                      ref={commissionDateInputRef}
                      type="month"
                      value={commissionPeriodDate}
                      onChange={(e) => setCommissionPeriodDate(e.target.value)}
                      className={`flex-1 min-w-0 border-none bg-transparent px-0 py-0 text-[10px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                    />
                  </div>
                </div>

                {/* Toggle — some ou não a comissão de pedidos ainda não recebidos do cliente
                    no "total a pagar" (por padrão, só conta o que já é dinheiro na mão). */}
                <button
                  type="button"
                  onClick={() => setIncludeUnpaidCommission(v => !v)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-2xl text-left ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}
                >
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Incluir pedidos não recebidos</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">Soma comissão de vendas ainda pendentes de pagamento do cliente no total a pagar</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 shrink-0 ${includeUnpaidCommission ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${includeUnpaidCommission ? 'left-6' : 'left-1'}`} />
                  </div>
                </button>

                {sellerCommissions.every(s => s.salesCount === 0) && (
                  <p className="text-[10px] font-bold text-slate-400 text-center py-4">Nenhuma venda com comissão nesse período.</p>
                )}

                {sellerCommissions.map((sc) => {
                  const { collaborator, salesCount, totalSales, receivedCommission, pendingCommission } = sc;
                  const payableValue = receivedCommission + (includeUnpaidCommission ? pendingCommission : 0);
                  const isSellerExpanded = expandedCommissionSellerId === collaborator.id;
                  return (
                    <div key={collaborator.id} className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                      <button
                        type="button"
                        onClick={() => setExpandedCommissionSellerId(v => v === collaborator.id ? null : collaborator.id)}
                        className="w-full flex items-center justify-between gap-3 p-3.5 text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl shrink-0" style={{ backgroundColor: collaborator.colorHex }} />
                          <div className="min-w-0">
                            <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{collaborator.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {salesCount} {salesCount === 1 ? 'venda' : 'vendas'} · {collaborator.commissionPercent ?? 0}% · <span className={hidePrivacy ? PRIVACY_BLUR_CLASS : ''}>R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> vendido
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`text-sm font-black transition-all ${isDarkMode ? 'text-amber-400' : 'text-amber-600'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                            R$ {payableValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isSellerExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isSellerExpanded && (
                        <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar">
                            {sc.sales.map(({ sale, paid, commission }) => (
                              <button
                                key={sale.id}
                                type="button"
                                onClick={() => onOpenSale?.(sale.id)}
                                className={`flex items-center justify-between gap-2 p-2.5 rounded-xl text-left ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
                              >
                                <div className="min-w-0">
                                  <p className={`text-[10px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>#{sale.orderNumber} · {sale.customerName || 'Sem cliente'}</p>
                                  <p className={`text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>{format(sale.date, 'dd/MM/yyyy')} · venda R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-[11px] font-black ${paid ? 'text-rose-500' : (isDarkMode ? 'text-slate-300' : 'text-slate-600')} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                                    R$ {commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  <p className={`text-[7px] font-black uppercase tracking-widest ${paid ? 'text-rose-500' : 'text-slate-400'}`}>{paid ? 'Recebido' : 'Pendente'}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleCopyCommission(collaborator.name, payableValue)}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                            >
                              <Clipboard size={12} /> Copiar
                            </button>
                            {onPayCommission && (
                              <button
                                type="button"
                                onClick={() => handlePayCommission(sc)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white"
                              >
                                <Send size={12} /> Pagar Comissão
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleExportCommission(sc, 'pdf')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                            >
                              <FileDown size={12} /> Exportar PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportCommission(sc, 'jpg')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                            >
                              <ImageIcon size={12} /> Exportar JPG
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ordens de Serviço a Fornecedores — mesmo estilo do card de Comissão a Vendedores
            acima, mas o Total em Aberto é sempre o saldo acumulado (não fica preso ao período
            selecionado, ver providerOSGroups). Só aparece se existir alguma OS lançada. */}
        {providerOSGroups.length > 0 && (
          <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button
              type="button"
              onClick={() => setIsProviderOSExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-3 p-6"
            >
              <div className="text-left min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ordens de Serviço a Fornecedores</p>
                <p className={`text-2xl font-black tracking-tighter mt-1 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  R$ {totalProviderOSOpenBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${isProviderOSExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isProviderOSExpanded && (
              <div className={`flex flex-col gap-4 px-6 pb-6 border-t pt-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                {/* Busca por fornecedor/prestador — filtra só a lista de fornecedores abaixo,
                    não muda nenhum total. */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <Search size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={providerOSSearch}
                    onChange={(e) => setProviderOSSearch(e.target.value)}
                    placeholder="Buscar fornecedor/prestador..."
                    className={`flex-1 min-w-0 border-none bg-transparent outline-none text-xs font-bold ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`}
                  />
                  {providerOSSearch && (
                    <button type="button" onClick={() => setProviderOSSearch('')} className="text-slate-400 hover:text-slate-600 shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Período — só filtra a lista "concluídas no período" abaixo, não mexe no
                    Total em Aberto (esse é sempre acumulado, ver providerOSGroups). */}
                <div className="flex items-center gap-1.5">
                  <div className={`flex gap-0.5 p-0.5 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    {(Object.keys(STATS_PERIOD_LABELS) as OverviewPeriodType[]).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setProviderOSPeriodType(pt)}
                        className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                          providerOSPeriodType === pt ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        {STATS_PERIOD_LABELS[pt]}
                      </button>
                    ))}
                  </div>
                  <div
                    onClick={openProviderOSMonthPicker}
                    className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <Calendar size={12} className="text-indigo-500 shrink-0" />
                    <input
                      ref={providerOSDateInputRef}
                      type="month"
                      value={providerOSPeriodDate}
                      onChange={(e) => setProviderOSPeriodDate(e.target.value)}
                      className={`flex-1 min-w-0 border-none bg-transparent px-0 py-0 text-[10px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                    />
                  </div>
                </div>

                {(() => {
                  const filteredProviderOSGroups = providerOSGroups.filter(g => g.providerName.toLowerCase().includes(providerOSSearch.trim().toLowerCase()));
                  if (filteredProviderOSGroups.length === 0) {
                    return <p className="text-[10px] font-bold text-slate-400 text-center py-4">Nenhum fornecedor encontrado.</p>;
                  }
                  // Espaçamento maior entre cards de fornecedor (gap-6, separado do gap-4 dos
                  // controles acima) + efeito "3D" (sombra elevada + borda inferior grossa,
                  // mesmo recurso de miniCardCls em LabelPrintStudioView.tsx) pra cada card se
                  // destacar como um bloco próprio, em vez de se misturar com o de baixo.
                  return (
                    <div className="flex flex-col gap-6">
                    {filteredProviderOSGroups.map((group) => {
                  const isProviderExpanded = expandedProviderKey === group.key;
                  const detailTab = providerDetailTab[group.key] || 'open';
                  const detailList = detailTab === 'open' ? group.openOrders : group.completedInPeriod;
                  return (
                    <div key={group.key} className={`rounded-2xl overflow-hidden border-b-[3px] transition-shadow ${isDarkMode ? 'bg-gradient-to-b from-slate-800 to-slate-800/80 border-slate-950 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5)]' : 'bg-gradient-to-b from-white to-slate-50 border-slate-200 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.18)]'}`}>
                      <button
                        type="button"
                        onClick={() => setExpandedProviderKey(v => v === group.key ? null : group.key)}
                        className="w-full flex items-center justify-between gap-3 p-3.5 text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-white text-indigo-500'}`}>
                            <Factory size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{group.providerName}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {group.completedInPeriod.length} conc. no período · {group.pendingCount} a concluir
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`text-sm font-black transition-all ${isDarkMode ? 'text-amber-400' : 'text-amber-600'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                            R$ {group.openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProviderExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isProviderExpanded && (
                        <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                          <div className={`flex gap-0.5 p-0.5 rounded-xl w-fit ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                            <button
                              type="button"
                              onClick={() => setProviderDetailTab(prev => ({ ...prev, [group.key]: 'open' }))}
                              className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${detailTab === 'open' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                            >
                              Em aberto ({group.openOrders.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setProviderDetailTab(prev => ({ ...prev, [group.key]: 'period' }))}
                              className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${detailTab === 'period' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                            >
                              No período ({group.completedInPeriod.length})
                            </button>
                          </div>
                          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar">
                            {detailList.length === 0 && (
                              <p className="text-[9px] font-bold text-slate-400 text-center py-3">Nenhuma OS aqui.</p>
                            )}
                            {detailList.map((os) => {
                              const paid = isOsPaid(os);
                              const reference = products.find(p => p.id === os.productId)?.reference;
                              return (
                                <div key={os.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-xl text-left ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                                  <div className="min-w-0">
                                    <p className={`text-[10px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                      {os.osNumber} · {reference ? `${reference} ` : ''}{os.productName}
                                    </p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                      {os.sectorName} · Cor: {os.variationName || '—'} · Qtd: {os.quantity} · {os.finishedAt ? format(os.finishedAt, 'dd/MM/yyyy') : 'em produção'}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Total</p>
                                    <p className={`text-[11px] font-black ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''} ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                      R$ {(Number(os.totalValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className={`text-[7px] font-black uppercase tracking-widest ${os.status !== 'COMPLETED' ? 'text-amber-500' : paid ? 'text-emerald-500' : 'text-rose-500'}`}>
                                      {os.status !== 'COMPLETED' ? 'A concluir' : paid ? 'Pago' : 'Em aberto'}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleCopyProviderOS(group)}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                            >
                              <Clipboard size={12} /> Copiar
                            </button>
                            {onPayProviderServiceOrders && (
                              <button
                                type="button"
                                onClick={() => handlePayProvider(group)}
                                disabled={group.openOrders.length === 0}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
                              >
                                <Hammer size={12} /> Pagar Fornecedor
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleExportProviderOS(group, 'pdf')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                            >
                              <FileDown size={12} /> Exportar PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportProviderOS(group, 'jpg')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                            >
                              <ImageIcon size={12} /> Exportar JPG
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                    })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

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
            filtered.map((transaction) => {
            const category = categories.find(c => c.id === transaction.categoryId);
            const account = accounts.find(a => a.id === transaction.accountId);
            const isPending = transaction.status === 'PENDING';

            const relatedSale = sales.find(s => s.id === transaction.relatedId);
            const relatedPurchase = purchases.find(p => p.id === transaction.relatedId);
            const isPartialPayment = /pagto parcial/i.test(transaction.description || '');
            let displayTitle = transaction.description;
            if (relatedPurchase) {
              const baseLabel = relatedPurchase.type === PurchaseType.REPLENISHMENT
                ? 'Abastecimento de Estoque'
                : relatedPurchase.type === PurchaseType.SOLE
                ? 'Compra de Solados'
                : 'Compra Geral';
              displayTitle = isPartialPayment ? `Pagamento Parcial - ${baseLabel}` : baseLabel;
            } else if (relatedSale) {
              displayTitle = `Venda #${relatedSale.orderNumber}`;
            }
            const canNavigate = !!((relatedPurchase && onOpenPurchase) || (relatedSale && onOpenSale));

            return (
              <div
                key={transaction.id}
                onClick={canNavigate ? () => {
                  if (relatedPurchase && onOpenPurchase) onOpenPurchase(relatedPurchase.id);
                  else if (relatedSale && onOpenSale) onOpenSale(relatedSale.id);
                } : undefined}
                className={`p-4 rounded-3xl border shadow-sm flex flex-col gap-3 ${canNavigate ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              >
                {/* Linha do topo: título sempre visível por completo */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-black text-base uppercase tracking-tight leading-snug flex-1 min-w-0 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    {displayTitle}
                  </h3>
                  {relatedSale && (
                     <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 text-[9px] font-black tracking-widest shrink-0">Venda</span>
                  )}
                  {relatedPurchase && (
                     <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 text-[9px] font-black tracking-widest shrink-0">Compra</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${transaction.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                      {transaction.type === TransactionType.INCOME ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Sale Details if applicable */}
                      {(() => {
                        const sale = relatedSale;
                        if (sale) {
                          return (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <User size={10} className="text-indigo-400" />
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                  {sale.customerName || people.find(p => p.id === sale.customerId)?.name || 'Consumidor'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400 tracking-widest">
                                <span className="flex items-center gap-1">
                                  <Clipboard size={10} />
                                  Pedido #{sale.orderNumber}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Package size={10} />
                                  {(() => {
                                    const totalItems = sale.items.reduce((acc, item) => acc + item.quantity, 0);
                                    const firstItem = sale.items[0];
                                    const firstProduct = products.find(p => p.id === firstItem?.productId);
                                    if (sale.items.length === 1 && firstProduct) {
                                      return `${firstItem.quantity}x ${firstProduct.name}`;
                                    }
                                    if (sale.items.length > 1 && firstProduct) {
                                      return `${totalItems} Itens (${firstProduct.name}...)`;
                                    }
                                    return `${totalItems} Itens`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const purchase = relatedPurchase;
                        if (purchase) {
                          const supplier = people.find(p => p.id === purchase.supplierId);
                          return (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                  {supplier?.name || 'Fornecedor'}
                                </span>
                              </div>
                              {purchase.notes && (
                                <p className="text-[8px] font-bold text-slate-400 truncate max-w-[200px]">
                                  {purchase.notes}
                                </p>
                              )}
                            </div>
                          );
                        }

                        if (transaction.contactName) {
                          return (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 tracking-widest mt-0.5">
                              <User size={10} /> {transaction.contactName}
                            </div>
                          );
                        }

                        // Beneficiário/Prestador via personId (OS de corte, mão de obra)
                        const beneficiary = transaction.personId
                          ? people.find(p => p.id === transaction.personId)
                          : null;
                        if (beneficiary) {
                          return (
                            <div className="flex items-center gap-1 text-[9px] font-black text-indigo-500 dark:text-indigo-400 tracking-widest mt-0.5">
                              <User size={10} /> {beneficiary.name}
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {transaction.items && transaction.items.length > 0 && (
                        <div className="mt-3 space-y-1 pl-3 border-l-2 border-slate-100 dark:border-slate-800/50">
                          {transaction.items.map((item, idx) => (
                            <div key={item.id || idx} className="flex justify-between items-center text-[8px] font-bold text-slate-500 dark:text-slate-400 tracking-widest">
                              <span className="truncate max-w-[150px]">{item.description || 'Item sem descrição'}</span>
                              <span className="shrink-0 ml-2">R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-base tracking-tight transition-all ${transaction.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                      {transaction.type === TransactionType.INCOME ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest mt-1 ${isPending ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                      {isPending ? <Clock size={10} /> : <CheckCircle2 size={10} />}
                      {isPending ? 'Pendente' : 'Confirmado'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] text-indigo-400 dark:text-indigo-500 font-black uppercase tracking-widest flex items-center gap-1">
                      <Wallet size={10} />
                      {account?.name || 'Conta'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={10} />
                      {format(transaction.date, "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    {isPending && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSettle(transaction);
                        }}
                        disabled={settlingId === transaction.id}
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black tracking-widest shadow-xl transition-all active:scale-95 ${
                          settlingId === transaction.id 
                            ? 'bg-slate-200 text-slate-500 animate-pulse' 
                            : 'bg-emerald-500 text-white shadow-emerald-100 hover:bg-emerald-600'
                        }`}
                      >
                        {settlingId === transaction.id ? (
                          <> <RefreshCcw size={14} className="animate-spin" /> Processando... </>
                        ) : (
                          <> <CheckCircle2 size={16} strokeWidth={3} /> Dar Baixa </>
                        )}
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(transaction);
                      }} 
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-500 active:bg-indigo-50 transition-all"
                      title="Editar Lançamento"
                      aria-label="Editar Lançamento"
                    >
                      <Edit size={18} strokeWidth={2.5} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(transaction.id);
                      }}
                      disabled={deletingId === transaction.id}
                      className={`p-3 rounded-xl transition-all ${
                        deletingId === transaction.id
                          ? 'bg-slate-100 text-slate-300 animate-pulse'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 active:bg-rose-50'
                      }`}
                      title="Excluir Lançamento"
                      aria-label="Excluir Lançamento"
                    >
                      {deletingId === transaction.id ? (
                        <RefreshCcw size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

          {/* Lançamentos antigos e já liquidados não ficam carregados por padrão — busca sob demanda */}
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

          {filtered.length === 0 && filterType !== 'PAYABLE' && (
            <div className="text-center py-12">
              <AlertCircle size={48} className="mx-auto text-slate-100 dark:text-slate-800 mb-4" strokeWidth={1} />
              <p className="text-xs text-slate-300 dark:text-slate-700 font-bold tracking-widest italic">Nenhuma transação encontrada</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}


