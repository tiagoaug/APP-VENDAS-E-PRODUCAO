import { useState, useMemo, useEffect, useRef, type RefObject } from 'react';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, TransactionType, Category, Account, AccountType, Person, Purchase, PurchaseType, Sale, SaleStatus, Product, SaleType, ProductionLot, ProductionConfigItem } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Wallet, CheckCircle2, AlertCircle, Package, ChevronDown, Tag, Factory, X, ShoppingBag, Landmark, Boxes, Calendar, Banknote, Footprints } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '../utils/toast';
import {
  getPeriodRange,
  computeStockProfit,
  computeStockValue,
  computeProductionProfit,
  computeAccountBalance,
  computePendingReceivables,
  computeMonthlySettledBalance,
  computePeriodFinancials,
  computeProducedPairs,
  OverviewPeriodType,
} from '../utils/businessOverview';
import {
  subscribeToBusinessOverviewConfig,
  saveBusinessOverviewConfig,
  DEFAULT_BUSINESS_OVERVIEW_CONFIG,
  BusinessOverviewConfig,
  OverviewComparisonMode,
} from '../services/businessOverviewService';

interface BusinessOverviewCardProps {
  isDarkMode: boolean;
  products: Product[];
  productionLots: ProductionLot[];
  /** Padrões de embalagem (Grid tipo PACKAGING) — usado só pra prorratear o valor do
   * estoque Atacado por pares reais de cada padrão (ver getWholesaleValue). */
  productionConfigs?: ProductionConfigItem[];
  accounts: Account[];
  sales: Sale[];
  transactions: Transaction[];
  purchases: Purchase[];
  people: Person[];
  categories: Category[];
  onDeleteTransaction: (id: string) => Promise<void> | void;
  /** Quando true, não desenha o próprio cartão (borda/fundo/sombra) — usado quando o card já
   * fica dentro de outro container (ver FinancialView, que agrupa isso junto do "Lucro com
   * Vendas" num card só). Default false mantém o comportamento normal (card avulso). */
  embedded?: boolean;
}

const OVERVIEW_SOURCE_COLORS: Record<string, { chip: string; icon: string; iconBg: string; solid: string; ring: string }> = {
  emerald: { chip: 'text-emerald-600 dark:text-emerald-400', icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-900/30', solid: 'bg-emerald-500', ring: 'border-emerald-300 dark:border-emerald-700' },
  sky: { chip: 'text-sky-600 dark:text-sky-400', icon: 'text-sky-600 dark:text-sky-400', iconBg: 'bg-sky-50 dark:bg-sky-900/30', solid: 'bg-sky-500', ring: 'border-sky-300 dark:border-sky-700' },
  violet: { chip: 'text-violet-600 dark:text-violet-400', icon: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-900/30', solid: 'bg-violet-500', ring: 'border-violet-300 dark:border-violet-700' },
  amber: { chip: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-900/30', solid: 'bg-amber-500', ring: 'border-amber-300 dark:border-amber-700' },
  teal: { chip: 'text-teal-600 dark:text-teal-400', icon: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-50 dark:bg-teal-900/30', solid: 'bg-teal-500', ring: 'border-teal-300 dark:border-teal-700' },
  indigo: { chip: 'text-indigo-600 dark:text-indigo-400', icon: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-900/30', solid: 'bg-indigo-500', ring: 'border-indigo-300 dark:border-indigo-700' },
  cyan: { chip: 'text-cyan-600 dark:text-cyan-400', icon: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-50 dark:bg-cyan-900/30', solid: 'bg-cyan-500', ring: 'border-cyan-300 dark:border-cyan-700' },
};

const OVERVIEW_PERIOD_LABELS: Record<OverviewPeriodType, string> = {
  MONTH: 'Mês', QUARTER: 'Trimestre', SEMESTER: 'Semestre', YEAR: 'Ano',
};

// Renderiza uma linha de item do carrinho de uma compra (estoque/solados/geral) —
// cópia da mesma lógica usada em FinancialView.tsx/PurchasesView.tsx.
function renderPurchaseItemRow(item: any, idx: number, products: Product[]) {
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
}

export default function BusinessOverviewCard({
  isDarkMode,
  products,
  productionLots,
  productionConfigs = [],
  accounts,
  sales,
  transactions,
  purchases,
  people,
  categories,
  onDeleteTransaction,
  embedded = false,
}: BusinessOverviewCardProps) {
  const hidePrivacy = usePrivacyMode();
  const businessAccounts = useMemo(() => accounts.filter(a => a.type !== AccountType.PERSONAL), [accounts]);

  // <input type="month"> só abre o seletor nativo quando o toque acerta o ícone de calendário
  // do próprio input — na cápsula/pill em volta dele (ícone + texto), tocar fora do ícone só
  // foca sem abrir nada. `showPicker()` abre o seletor a partir de qualquer clique na cápsula.
  const periodDateInputRef = useRef<HTMLInputElement>(null);
  const compPeriodDateInputRef = useRef<HTMLInputElement>(null);
  const openMonthPicker = (ref: RefObject<HTMLInputElement | null>) => {
    const el = ref.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };

  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [isResumoExpanded, setIsResumoExpanded] = useState(true);
  const [overviewConfig, setOverviewConfig] = useState<BusinessOverviewConfig>(DEFAULT_BUSINESS_OVERVIEW_CONFIG);

  useEffect(() => {
    const unsub = subscribeToBusinessOverviewConfig(setOverviewConfig);
    return () => unsub();
  }, []);

  const setOverviewPeriod = (periodType: OverviewPeriodType) => {
    const next = { ...overviewConfig, periodType };
    setOverviewConfig(next);
    saveBusinessOverviewConfig(next);
  };

  const setPeriodDate = (periodDate: string) => {
    const next = { ...overviewConfig, periodDate };
    setOverviewConfig(next);
    saveBusinessOverviewConfig(next);
  };

  const setComparisonMode = (comparisonMode: OverviewComparisonMode) => {
    const next = { ...overviewConfig, comparisonMode };
    setOverviewConfig(next);
    saveBusinessOverviewConfig(next);
  };

  const setCompPeriodType = (compPeriodType: OverviewPeriodType) => {
    const next = { ...overviewConfig, compPeriodType };
    setOverviewConfig(next);
    saveBusinessOverviewConfig(next);
  };

  const setCompPeriodDate = (compPeriodDate: string) => {
    const next = { ...overviewConfig, compPeriodDate };
    setOverviewConfig(next);
    saveBusinessOverviewConfig(next);
  };

  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const selectedAccountIdsResolved = useMemo(
    () => overviewConfig.selectedAccountIds ?? businessAccounts.map(a => a.id),
    [overviewConfig.selectedAccountIds, businessAccounts]
  );

  const toggleAccountInSelection = (accountId: string) => {
    const current = selectedAccountIdsResolved;
    const next = current.includes(accountId) ? current.filter(id => id !== accountId) : [...current, accountId];
    const nextConfig = { ...overviewConfig, selectedAccountIds: next };
    setOverviewConfig(nextConfig);
    saveBusinessOverviewConfig(nextConfig);
  };

  const setAllAccountsSelection = (all: boolean) => {
    const nextConfig = { ...overviewConfig, selectedAccountIds: all ? businessAccounts.map(a => a.id) : [] };
    setOverviewConfig(nextConfig);
    saveBusinessOverviewConfig(nextConfig);
  };

  // Compras de Solados/Palmilhas marcadas "Não Contábil" que, por um bug já
  // corrigido no salvamento, geraram uma despesa mesmo assim — infla Despesas
  // do Período indevidamente. Detecta e oferece corrigir (reaproveita o mesmo
  // onDeleteTransaction que já reverte o saldo da conta corretamente).
  const nonAccountingLeaks = useMemo(() => {
    const leakedPurchaseIds = new Set(
      purchases.filter(p => (p.type === PurchaseType.SOLE || p.type === PurchaseType.PALMILHA) && p.generateTransaction === false).map(p => p.id)
    );
    return transactions.filter(t => t.type === TransactionType.EXPENSE && t.relatedId && leakedPurchaseIds.has(t.relatedId));
  }, [purchases, transactions]);

  const [showLeakConfirm, setShowLeakConfirm] = useState(false);
  const [isFixingLeaks, setIsFixingLeaks] = useState(false);

  const handleFixLeaks = async () => {
    setIsFixingLeaks(true);
    try {
      for (const t of nonAccountingLeaks) {
        await onDeleteTransaction(t.id);
      }
      toast.show(`${nonAccountingLeaks.length} despesa(s) indevida(s) corrigida(s)!`);
      setShowLeakConfirm(false);
    } catch (err: any) {
      toast.show('Erro ao corrigir: ' + (err.message || err));
    } finally {
      setIsFixingLeaks(false);
    }
  };

  // Detalhamento de "Despesas do Período" — Despesas soma TODAS as transações
  // de saída no período (não só Compras: também lançamentos manuais, pagamentos
  // avulsos de OS/prestador etc.), então pode ser maior que uma soma manual de
  // só "Compras Contábeis". Isso deixa visível item a item, pra conferir.
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  const [selectedPurchaseForCart, setSelectedPurchaseForCart] = useState<Purchase | null>(null);

  const periodExpenseBreakdown = useMemo(() => {
    const { start, end } = getPeriodRange(overviewConfig.periodType, overviewConfig.periodDate);
    const items = transactions.filter(t => !t.isPersonal && t.status === 'COMPLETED' && t.type === TransactionType.EXPENSE && t.date >= start && t.date <= end);
    const linkedToPurchase = items.filter(t => !!t.relatedId).reduce((a, t) => a + t.amount, 0);
    const other = items.filter(t => !t.relatedId).reduce((a, t) => a + t.amount, 0);
    return { items: [...items].sort((a, b) => b.amount - a.amount), linkedToPurchase, other };
  }, [transactions, overviewConfig.periodType, overviewConfig.periodDate]);

  // Detalhamento de "Receitas Totais (Transações)" — mesma lógica da de Despesas,
  // só que pro lado de entrada, pra conferir item a item o que compõe a soma.
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);

  const periodIncomeBreakdown = useMemo(() => {
    const { start, end } = getPeriodRange(overviewConfig.periodType, overviewConfig.periodDate);
    const items = transactions.filter(t => !t.isPersonal && t.status === 'COMPLETED' && t.type === TransactionType.INCOME && t.date >= start && t.date <= end);
    const linkedToSale = items.filter(t => !!t.relatedId).reduce((a, t) => a + t.amount, 0);
    const other = items.filter(t => !t.relatedId).reduce((a, t) => a + t.amount, 0);
    return { items: [...items].sort((a, b) => b.amount - a.amount), linkedToSale, other };
  }, [transactions, overviewConfig.periodType, overviewConfig.periodDate]);

  const packagingItems = useMemo(() => productionConfigs.filter(c => c.type === 'PACKAGING'), [productionConfigs]);

  const resumo = useMemo(() => ({
    // Respeita a mesma seleção de contas do popup "Escolher Contas" (ver showAccountPicker,
    // aberto a partir deste card) — antes somava sempre todas as contas do negócio.
    consolidatedBalance: computeAccountBalance(accounts, overviewConfig.selectedAccountIds),
    pendingReceivables: computePendingReceivables(sales),
    monthlyBalance: computeMonthlySettledBalance(transactions, accounts),
    stockValue: computeStockValue(products, packagingItems),
  }), [accounts, sales, transactions, products, packagingItems, overviewConfig.selectedAccountIds]);

  const accountsDesc = overviewConfig.selectedAccountIds
    ? `${overviewConfig.selectedAccountIds.length} de ${businessAccounts.length} contas selecionadas`
    : 'Todas as contas do negócio — toque pra escolher';

  // Lucro Real = Receitas Totais (todas as transações confirmadas no período) − Despesas do
  // período. Estoque/Produção ficam só como referência informativa (não entram na conta) —
  // Saldo em Conta e Vendas a Receber saíram daqui de vez, por já aparecerem no Resumo
  // Financeiro abaixo (Saldo Consolidado / A Receber), evitando mostrar o mesmo número duas
  // vezes com rótulos diferentes.
  const businessOverview = useMemo(() => {
    const { start, end } = getPeriodRange(overviewConfig.periodType, overviewConfig.periodDate);
    const { income, expenses } = computePeriodFinancials(transactions, start, end);

    const stockProfit = computeStockProfit(products, packagingItems);
    const productionProfit = computeProductionProfit(products, productionLots);

    const infoSources = [
      { label: 'Lucro em Estoque', desc: 'Venda − custo de tudo que está pronto (informativo)', value: stockProfit, color: 'emerald', icon: Package },
      { label: 'Lucro em Produção', desc: 'Pares em andamento × lucro unitário cadastrado (informativo)', value: productionProfit, color: 'violet', icon: Factory },
    ];

    const profit = income - expenses;
    const margin = income > 0 ? (profit / income) * 100 : 0;

    // Lucro por Par — mesmo cálculo do card "Análise de Lucro" do Dashboard: (Receitas −
    // Despesas) do período ÷ pares realmente finalizados na produção (Mapas com finishedAt)
    // no mesmo período.
    const producedPairs = computeProducedPairs(productionLots, start, end).total;
    const profitPerPair = producedPairs > 0 ? profit / producedPairs : null;

    // Preço médio de venda (todos os modelos vendidos no período) — receita total das vendas
    // fechadas ÷ total de pares vendidos, pra dar uma referência de ticket médio junto do
    // Lucro por Par (que usa pares PRODUZIDOS, não vendidos — números propositalmente
    // diferentes, um mede fábrica, o outro mede venda).
    const periodSales = sales.filter(s => s.status === SaleStatus.SALE && s.isAccounting !== false && s.date >= start && s.date <= end);
    let totalPairsSold = 0;
    let totalRevenueSold = 0;
    for (const sale of periodSales) {
      for (const item of sale.items || []) totalPairsSold += item.quantity || 0;
      totalRevenueSold += sale.total;
    }
    const avgSalePricePerPair = totalPairsSold > 0 ? totalRevenueSold / totalPairsSold : null;

    let comparison: { profit: number; delta: number; label: string } | null = null;
    if (overviewConfig.comparisonMode !== 'NONE') {
      let compStart: number, compEnd: number, label: string;
      if (overviewConfig.comparisonMode === 'AUTO') {
        const duration = end - start;
        compStart = start - duration - 1000;
        compEnd = start - 1;
        label = 'Período anterior (automático)';
      } else {
        const r = getPeriodRange(overviewConfig.compPeriodType, overviewConfig.compPeriodDate);
        compStart = r.start;
        compEnd = r.end;
        label = format(new Date(overviewConfig.compPeriodDate + '-01T12:00:00'), 'MMM/yy', { locale: ptBR });
      }
      const compFin = computePeriodFinancials(transactions, compStart, compEnd);
      const compProfit = compFin.income - compFin.expenses;
      const delta = compProfit === 0 ? (profit > 0 ? 100 : profit < 0 ? -100 : 0) : ((profit - compProfit) / Math.abs(compProfit)) * 100;
      comparison = { profit: compProfit, delta, label };
    }

    return { infoSources, expenses, income, profit, margin, comparison, producedPairs, profitPerPair, avgSalePricePerPair, totalPairsSold };
  }, [overviewConfig, products, productionLots, packagingItems, transactions, sales]);

  const cashFlowTrend = useMemo(() => {
    const months: { label: string; profit: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const dateStr = format(d, 'yyyy-MM');
      const { start, end } = getPeriodRange('MONTH', dateStr);
      const { income, expenses } = computePeriodFinancials(transactions, start, end);
      months.push({ label: format(d, 'MMM', { locale: ptBR }).toUpperCase(), profit: income - expenses });
    }
    return months;
  }, [transactions]);

  return (
    <div className={embedded ? 'flex flex-col gap-5' : `rounded-[2.5rem] border shadow-sm p-6 flex flex-col gap-5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <button
        type="button"
        onClick={() => setIsOverviewExpanded((v) => !v)}
        data-guide-anchor="dash.overview.expandir"
        className="flex items-center justify-center gap-2 w-full"
        aria-expanded={isOverviewExpanded}
      >
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-[11px] font-black uppercase tracking-tight text-indigo-600 dark:text-indigo-400">
          <TrendingUp size={13} /> Visualização do Meu Negócio
        </span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
          <ChevronDown size={16} className={`transition-transform ${isOverviewExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOverviewExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex flex-col gap-5 overflow-hidden"
          >
            <div className={`flex items-start gap-2.5 p-3.5 rounded-2xl border-2 ${isDarkMode ? 'bg-rose-950/30 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-[10.5px] font-bold leading-relaxed">
                Preço de Venda e Lucro em Vendas aqui vêm do que está cadastrado em cada produto — são métricas obtidas de acordo com o preço de venda e o preço de compra (custo) cadastrados. Use este card pra ter uma noção da saúde do negócio, mas mantenha sempre atualizados os preços de matéria-prima, mão de obra, custo e compra dos produtos: se ficarem desatualizados, os cálculos se afastam do real.
              </p>
            </div>

            <div className="flex gap-1.5 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl">
              {(Object.keys(OVERVIEW_PERIOD_LABELS) as OverviewPeriodType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOverviewPeriod(p)}
                  data-guide-anchor="dash.overview.periodo"
                  className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    overviewConfig.periodType === p ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                  }`}
                >
                  {OVERVIEW_PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            <div
              onClick={() => openMonthPicker(periodDateInputRef)}
              data-guide-anchor="dash.overview.mesEscolhido"
              className={`flex items-center gap-2 rounded-xl px-3 py-2 border-2 cursor-pointer ${isDarkMode ? 'bg-orange-900/20 border-orange-800/40' : 'bg-orange-50 border-orange-200'}`}
            >
              <Calendar size={13} className="text-orange-500 shrink-0" />
              <input
                ref={periodDateInputRef}
                type="month"
                value={overviewConfig.periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
                className={`flex-1 border-none bg-transparent px-0 py-0 text-[10px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Comparar com</p>
              <div className="flex gap-1.5 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                {([
                  ['NONE', 'Sem comparação'],
                  ['AUTO', 'Automático'],
                  ['MANUAL', 'Período específico'],
                ] as [OverviewComparisonMode, string][]).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setComparisonMode(mode)}
                    data-guide-anchor="dash.overview.modoComparacao"
                    className={`flex-1 py-2 rounded-xl text-[8.5px] font-black uppercase tracking-widest transition-all ${
                      overviewConfig.comparisonMode === mode ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {overviewConfig.comparisonMode === 'MANUAL' && (
                <div className="flex gap-2">
                  <select
                    title="Tipo do período de comparação"
                    value={overviewConfig.compPeriodType}
                    onChange={(e) => setCompPeriodType(e.target.value as OverviewPeriodType)}
                    className={`rounded-xl px-2 py-2.5 text-[9px] font-bold border-none outline-none ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
                  >
                    {(Object.keys(OVERVIEW_PERIOD_LABELS) as OverviewPeriodType[]).map((p) => (
                      <option key={p} value={p}>{OVERVIEW_PERIOD_LABELS[p]}</option>
                    ))}
                  </select>
                  <div
                    onClick={() => openMonthPicker(compPeriodDateInputRef)}
                    data-guide-anchor="dash.overview.mesComparacao"
                    className={`flex-1 flex items-center rounded-xl cursor-pointer ${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50'}`}
                  >
                    <input
                      ref={compPeriodDateInputRef}
                      type="month"
                      title="Mês/ano de referência da comparação"
                      value={overviewConfig.compPeriodDate}
                      onChange={(e) => setCompPeriodDate(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2.5 text-[10px] font-bold border-none bg-transparent outline-none pointer-events-none ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lucro real agora</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <h2 className={`text-3xl font-black tracking-tighter transition-all ${businessOverview.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  R$ {businessOverview.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                {businessOverview.comparison && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${businessOverview.comparison.delta >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                    {businessOverview.comparison.delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(businessOverview.comparison.delta).toFixed(1).replace('.', ',')}%
                  </span>
                )}
              </div>
              {businessOverview.comparison && (
                <div className="mt-2">
                  <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    <span className={hidePrivacy ? PRIVACY_BLUR_CLASS : ''}>{businessOverview.comparison.label}: R$ {businessOverview.comparison.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span>Agora</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 gap-0.5">
                    <div
                      className="bg-indigo-300 dark:bg-indigo-700"
                      style={{ width: `${Math.max(5, Math.min(95, (Math.abs(businessOverview.comparison.profit) / (Math.abs(businessOverview.comparison.profit) + Math.abs(businessOverview.profit) || 1)) * 100))}%` }}
                    />
                    <div
                      className={businessOverview.profit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}
                      style={{ width: `${Math.max(5, Math.min(95, (Math.abs(businessOverview.profit) / (Math.abs(businessOverview.comparison.profit) + Math.abs(businessOverview.profit) || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="text-[10px] font-bold text-slate-400 mt-2 leading-relaxed">
                Fontes marcadas abaixo (valor de agora) − despesas do período selecionado.
              </p>
              <div className="flex gap-3 mt-4">
                <div className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
                  <p className="text-[8px] font-black text-slate-400 tracking-widest">Margem s/ receita</p>
                  <p className={`text-sm font-black mt-0.5 ${businessOverview.margin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{businessOverview.margin.toFixed(1).replace('.', ',')}%</p>
                </div>
                <button type="button" onClick={() => setShowExpenseBreakdown(true)} data-guide-anchor="dash.overview.despesasDetalhe" className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 text-left">
                  <p className="text-[8px] font-black text-slate-400 tracking-widest flex items-center gap-1">
                    Despesas do período
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500/10 animate-pulse-indigo-ring">
                      <ChevronDown size={9} className="rotate-[-90deg] text-indigo-500" />
                    </span>
                  </p>
                  <p className={`text-sm font-black mt-0.5 text-rose-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {businessOverview.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </button>
              </div>

              <div className="mt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Receitas Totais × Despesas do Período</p>
                <div className="flex flex-col gap-2.5">
                  <div>
                    <div className="flex justify-between items-baseline text-[9px] font-black mb-1">
                      <span className="text-emerald-500 uppercase tracking-widest">Receitas totais</span>
                      <span className={`text-emerald-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {businessOverview.income.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max(3, Math.min(100, (Math.abs(businessOverview.income) / (Math.max(Math.abs(businessOverview.income), businessOverview.expenses) || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline text-[9px] font-black mb-1">
                      <span className="text-rose-500 uppercase tracking-widest">Despesas</span>
                      <span className={`text-rose-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {businessOverview.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all"
                        style={{ width: `${Math.max(3, Math.min(100, (businessOverview.expenses / (Math.max(Math.abs(businessOverview.income), businessOverview.expenses) || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[8.5px] font-bold text-slate-400 leading-relaxed">Lucro Real = Receitas Totais (todas as transações confirmadas no período) − Despesas do período.</p>
                </div>
              </div>

              {nonAccountingLeaks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowLeakConfirm(true)}
                  data-guide-anchor="dash.overview.corrigirDespesas"
                  className="w-full flex items-center gap-3 mt-3 p-3 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-left"
                >
                  <AlertCircle size={18} className="text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                      {nonAccountingLeaks.length} despesa(s) indevida(s) de compras "Não Contábil" — <span className={hidePrivacy ? PRIVACY_BLUR_CLASS : ''}>R$ {nonAccountingLeaks.reduce((a, t) => a + t.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </p>
                    <p className="text-[9px] font-bold text-amber-600/80 dark:text-amber-500/80 mt-0.5">Toque pra ver e corrigir</p>
                  </div>
                </button>
              )}
            </div>

            <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'}`}>
              <button
                type="button"
                onClick={() => setIsResumoExpanded((v) => !v)}
                data-guide-anchor="dash.overview.resumoExpandir"
                className="w-full flex items-center justify-between p-3.5"
                aria-expanded={isResumoExpanded}
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Resumo Financeiro</p>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isResumoExpanded ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {isResumoExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2 px-3 pb-3.5">
                      <button
                        type="button"
                        onClick={() => setShowAccountPicker(true)}
                        data-guide-anchor="dash.overview.saldoConsolidadoAbrir"
                        className={`p-3 rounded-2xl text-left ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
                      >
                        <p className="text-[8px] font-black text-slate-400 tracking-widest flex items-center gap-1">
                          <Landmark size={10} /> Saldo Consolidado
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-500/10 animate-pulse-indigo-ring">
                            <ChevronDown size={9} className="rotate-[-90deg] text-indigo-500" />
                          </span>
                        </p>
                        <p className={`text-sm font-black mt-0.5 ${resumo.consolidatedBalance >= 0 ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-rose-500'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                          R$ {resumo.consolidatedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[8.5px] font-bold text-slate-400 mt-1 leading-relaxed">{accountsDesc} (contas de uso Pessoal não entram).</p>
                      </button>

                      <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <p className="text-[8px] font-black text-slate-400 tracking-widest flex items-center gap-1"><DollarSign size={10} /> A Receber (Pendente)</p>
                        <p className={`text-sm font-black mt-0.5 text-amber-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {resumo.pendingReceivables.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-[8.5px] font-bold text-slate-400 mt-1 leading-relaxed">Vendas já fechadas (não orçamento, não cancelada) que ainda não foram pagas por completo: total do pedido menos o que já foi pago.</p>
                      </div>

                      <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <p className="text-[8px] font-black text-slate-400 tracking-widest flex items-center gap-1"><TrendingUp size={10} /> Balanço do Mês (Liquidados)</p>
                        <p className={`text-sm font-black mt-0.5 ${resumo.monthlyBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {resumo.monthlyBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-[8.5px] font-bold text-slate-400 mt-1 leading-relaxed">Receitas menos despesas já confirmadas (liquidadas) desde o dia 1º deste mês até agora — sempre o mês calendário atual, independente do período escolhido acima.</p>
                      </div>

                      <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <p className="text-[8px] font-black text-slate-400 tracking-widest flex items-center gap-1"><Boxes size={10} /> Patrimônio em Estoque</p>
                        <p className={`text-[11px] font-black mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>Custo: R$ {resumo.stockValue.costValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        <p className={`text-[9px] font-bold text-emerald-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>Venda: R$ {resumo.stockValue.saleValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        <p className="text-[8.5px] font-bold text-slate-400 mt-1 leading-relaxed">Custo e valor de venda de tudo que está pronto no estoque agora, pelo preço de custo/venda cadastrado em cada modelo × quantidade em estoque.</p>
                      </div>

                      <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        <p className="text-[8px] font-black text-slate-400 tracking-widest flex items-center gap-1"><Footprints size={10} /> Lucro por Par</p>
                        <p className={`text-sm font-black mt-0.5 ${businessOverview.profitPerPair === null ? 'text-slate-400' : businessOverview.profitPerPair >= 0 ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-rose-500'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                          {businessOverview.profitPerPair === null ? '—' : `R$ ${businessOverview.profitPerPair.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </p>
                        <p className="text-[8.5px] font-bold text-slate-400 mt-1 leading-relaxed">Mesmo cálculo do card "Análise de Lucro": (Receitas − Despesas) ÷ {businessOverview.producedPairs} {businessOverview.producedPairs === 1 ? 'par produzido' : 'pares produzidos'} no período selecionado acima.</p>
                        <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                          <p className={`text-[11px] font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-700'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                            {businessOverview.avgSalePricePerPair === null ? '—' : `R$ ${businessOverview.avgSalePricePerPair.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Preço Médio de Venda (todos os modelos)</span>
                          </p>
                          <p className="text-[8.5px] font-bold text-slate-400 mt-0.5 leading-relaxed">Receita das vendas fechadas ÷ {businessOverview.totalPairsSold} {businessOverview.totalPairsSold === 1 ? 'par vendido' : 'pares vendidos'} no período — média de todos os modelos, não os pares produzidos.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Base do Lucro Real</p>
              <button
                type="button"
                onClick={() => setShowIncomeBreakdown(true)}
                data-guide-anchor="dash.overview.receitasTotais"
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${OVERVIEW_SOURCE_COLORS.cyan.ring} ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${OVERVIEW_SOURCE_COLORS.cyan.iconBg} ${OVERVIEW_SOURCE_COLORS.cyan.icon}`}>
                  <Banknote size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black flex items-center gap-1">
                    Receitas Totais (Transações)
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/10 animate-pulse-indigo-ring shrink-0">
                      <ChevronDown size={10} className="rotate-[-90deg] text-indigo-500" />
                    </span>
                  </p>
                  <p className="text-[9px] font-bold text-slate-400">Soma de toda entrada confirmada em Financeiro no período — venda ou não. Único valor usado no Lucro Real.</p>
                </div>
                <p className={`text-[12px] font-black shrink-0 ${OVERVIEW_SOURCE_COLORS.cyan.chip} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  R$ {businessOverview.income.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </button>

              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1 mt-2">Outras Métricas (Informativo — não entram no Lucro Real)</p>
              {businessOverview.infoSources.map((s) => {
                const colors = OVERVIEW_SOURCE_COLORS[s.color];
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    data-guide-anchor="dash.overview.metricaInformativa"
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.iconBg} ${colors.icon}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black">{s.label}</p>
                      <p className="text-[9px] font-bold text-slate-400">{s.desc}</p>
                    </div>
                    <p className={`text-[12px] font-black shrink-0 ${colors.chip} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                      R$ {s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Receita − Despesas — últimos 6 meses</p>
              <div className="flex items-end gap-2" style={{ height: 90 }}>
                {cashFlowTrend.map((m, idx) => {
                  const maxAbs = Math.max(...cashFlowTrend.map((x) => Math.abs(x.profit)), 1);
                  const heightPct = Math.max(6, (Math.abs(m.profit) / maxAbs) * 100);
                  const isNow = idx === cashFlowTrend.length - 1;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                      <div className="w-full flex items-end" style={{ height: 64 }}>
                        <div
                          className={`w-full rounded-t-md ${
                            m.profit >= 0 ? (isNow ? 'bg-emerald-500' : 'bg-emerald-200 dark:bg-emerald-900/40') : (isNow ? 'bg-rose-500' : 'bg-rose-200 dark:bg-rose-900/40')
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className={`text-[8px] font-black uppercase ${isNow ? 'text-slate-700 dark:text-white' : 'text-slate-400'}`}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[9px] font-bold text-slate-400 leading-relaxed px-1">
              Estoque, produção e saldo em conta são sempre o valor de agora (não têm histórico salvo); despesas seguem o período selecionado acima. O lucro por par usado em "Lucro em Produção" vem do preço unitário já cadastrado em cada modelo.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {showAccountPicker && createPortal(
        <div className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAccountPicker(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[2rem] shadow-2xl flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Contas Incluídas</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Escolha quais contas somam em "Saldos em Conta"</p>
              </div>
              <button type="button" onClick={() => setShowAccountPicker(false)} data-guide-anchor="dash.overview.contasFechar" className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex gap-2 px-6 pt-4">
              <button
                type="button"
                onClick={() => setAllAccountsSelection(true)}
                data-guide-anchor="dash.overview.contasTodas"
                className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
              >
                Selecionar todas
              </button>
              <button
                type="button"
                onClick={() => setAllAccountsSelection(false)}
                data-guide-anchor="dash.overview.contasNenhuma"
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
              >
                Nenhuma
              </button>
            </div>

            <div className="flex flex-col gap-2 p-6">
              {businessAccounts.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 text-center py-6">Nenhuma conta do negócio cadastrada.</p>
              )}
              {businessAccounts.map((acc) => {
                const checked = selectedAccountIdsResolved.includes(acc.id);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggleAccountInSelection(acc.id)}
                    data-guide-anchor="dash.overview.contaItem"
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                      checked ? 'border-sky-300 dark:border-sky-700' : isDarkMode ? 'border-slate-800' : 'border-slate-100'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${checked ? 'bg-sky-500' : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      {checked && <CheckCircle2 size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{acc.name}</p>
                    </div>
                    <p className={`text-[11px] font-black shrink-0 ${(acc.balance || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      R$ {(acc.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="p-6 pt-2">
              <button
                type="button"
                onClick={() => setShowAccountPicker(false)}
                data-guide-anchor="dash.overview.contasConcluir"
                className="w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showLeakConfirm && createPortal(
        <div className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !isFixingLeaks && setShowLeakConfirm(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[2rem] shadow-2xl flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Corrigir Despesas Indevidas</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Compras "Não Contábil" que geraram título por engano</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowLeakConfirm(false)} data-guide-anchor="dash.overview.corrigirFechar" className={`p-2 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex flex-col gap-2 p-6">
              {nonAccountingLeaks.map((t) => {
                const purchase = purchases.find(p => p.id === t.relatedId);
                const supplier = purchase ? people.find(p => p.id === purchase.supplierId)?.name : undefined;
                return (
                  <div key={t.id} className={`flex items-center gap-3 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{supplier || t.description}</p>
                      <p className="text-[9px] font-bold text-slate-400">{format(t.date, 'dd/MM/yyyy')} · {purchase?.type === PurchaseType.SOLE ? 'Solados' : 'Palmilhas'}</p>
                    </div>
                    <p className={`text-[11px] font-black text-rose-500 shrink-0 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                );
              })}
            </div>

            <div className={`px-6 py-4 mx-6 mb-2 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold text-slate-400 leading-relaxed">
                Vamos excluir esse(s) lançamento(s) de Despesa e devolver o valor pro saldo da(s) conta(s) que foi(ram) debitada(s) — a compra em si não é alterada, só a parte financeira que não deveria ter sido gerada.
              </p>
            </div>

            <div className="p-6 pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeakConfirm(false)}
                disabled={isFixingLeaks}
                data-guide-anchor="dash.overview.corrigirCancelar"
                className={`flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-50 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleFixLeaks}
                disabled={isFixingLeaks}
                data-guide-anchor="dash.overview.corrigirConfirmar"
                className="flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-amber-500 text-white disabled:opacity-60"
              >
                {isFixingLeaks ? 'Corrigindo...' : 'Confirmar Correção'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showExpenseBreakdown && createPortal(
        <div className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowExpenseBreakdown(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[2rem] shadow-2xl flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Despesas do Período</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{periodExpenseBreakdown.items.length} lançamento(s) — {OVERVIEW_PERIOD_LABELS[overviewConfig.periodType]} atual</p>
              </div>
              <button type="button" onClick={() => setShowExpenseBreakdown(false)} data-guide-anchor="dash.overview.despesasFechar" className={`p-2 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex gap-3 px-6 pt-4">
              <div className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
                <p className="text-[8px] font-black text-slate-400 tracking-widest">Vinculadas a compras</p>
                <p className={`text-sm font-black mt-0.5 text-rose-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {periodExpenseBreakdown.linkedToPurchase.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
                <p className="text-[8px] font-black text-slate-400 tracking-widest">Outros lançamentos</p>
                <p className={`text-sm font-black mt-0.5 text-rose-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {periodExpenseBreakdown.other.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 p-6">
              {periodExpenseBreakdown.items.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 text-center py-6">Nenhuma despesa nesse período.</p>
              )}
              {periodExpenseBreakdown.items.map((t) => {
                const categoryName = categories.find(c => c.id === t.categoryId)?.name;
                const linkedPurchase = t.relatedId ? purchases.find(p => p.id === t.relatedId) : undefined;
                return (
                  <div key={t.id} className={`flex items-center gap-3 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.description || categoryName || 'Despesa'}</p>
                      <p className="text-[9px] font-bold text-slate-400">
                        {format(t.date, 'dd/MM/yyyy')}{categoryName ? ` · ${categoryName}` : ''}{t.relatedId ? ' · vinculada a compra' : ''}
                      </p>
                    </div>
                    <p className={`text-[11px] font-black text-rose-500 shrink-0 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    {linkedPurchase && (
                      <button
                        type="button"
                        onClick={() => setSelectedPurchaseForCart(linkedPurchase)}
                        data-guide-anchor="dash.overview.despesaVerCompra"
                        title="Ver itens da compra"
                        aria-label="Ver itens da compra"
                        className={`p-1.5 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-400 border border-slate-200'}`}
                      >
                        <ChevronDown size={13} className="rotate-[-90deg]" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-6 pt-2">
              <button
                type="button"
                onClick={() => setShowExpenseBreakdown(false)}
                data-guide-anchor="dash.overview.despesasConcluir"
                className="w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showIncomeBreakdown && createPortal(
        <div className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowIncomeBreakdown(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[2rem] shadow-2xl flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Receitas do Período</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{periodIncomeBreakdown.items.length} lançamento(s) — {OVERVIEW_PERIOD_LABELS[overviewConfig.periodType]} atual</p>
              </div>
              <button type="button" onClick={() => setShowIncomeBreakdown(false)} data-guide-anchor="dash.overview.receitasFechar" className={`p-2 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex gap-3 px-6 pt-4">
              <div className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
                <p className="text-[8px] font-black text-slate-400 tracking-widest">Vinculadas a venda</p>
                <p className={`text-sm font-black mt-0.5 text-emerald-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {periodIncomeBreakdown.linkedToSale.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
                <p className="text-[8px] font-black text-slate-400 tracking-widest">Outros lançamentos</p>
                <p className={`text-sm font-black mt-0.5 text-emerald-500 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {periodIncomeBreakdown.other.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 p-6">
              {periodIncomeBreakdown.items.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 text-center py-6">Nenhuma receita nesse período.</p>
              )}
              {periodIncomeBreakdown.items.map((t) => {
                const categoryName = categories.find(c => c.id === t.categoryId)?.name;
                return (
                  <div key={t.id} className={`flex items-center gap-3 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.description || categoryName || 'Receita'}</p>
                      <p className="text-[9px] font-bold text-slate-400">
                        {format(t.date, 'dd/MM/yyyy')}{categoryName ? ` · ${categoryName}` : ''}{t.contactName ? ` · ${t.contactName}` : ''}{t.relatedId ? ' · vinculada a venda' : ''}
                      </p>
                    </div>
                    <p className={`text-[11px] font-black text-emerald-500 shrink-0 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-6 pt-2">
              <button
                type="button"
                onClick={() => setShowIncomeBreakdown(false)}
                data-guide-anchor="dash.overview.receitasConcluir"
                className="w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedPurchaseForCart && createPortal(
        <div className="fixed inset-0 z-[65010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPurchaseForCart(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[80vh] flex flex-col rounded-[2rem] p-6 shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Carrinho de Compras</h3>
                {(() => {
                  const count = selectedPurchaseForCart.type === PurchaseType.GENERAL
                    ? (selectedPurchaseForCart.generalItems?.length || 0)
                    : selectedPurchaseForCart.type === PurchaseType.SOLE
                    ? (selectedPurchaseForCart.soleItems?.length || 0)
                    : (selectedPurchaseForCart.items?.length || 0);
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
                onClick={() => setSelectedPurchaseForCart(null)}
                data-guide-anchor="dash.overview.carrinhoFechar"
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            {selectedPurchaseForCart.notes && (
              <p className={`text-[10px] font-bold mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{selectedPurchaseForCart.notes}</p>
            )}
            <div className="flex flex-col gap-2 overflow-y-auto">
              {selectedPurchaseForCart.type === PurchaseType.GENERAL
                ? selectedPurchaseForCart.generalItems?.map((item: any, idx) => renderPurchaseItemRow(item, idx, products))
                : selectedPurchaseForCart.type === PurchaseType.SOLE
                ? selectedPurchaseForCart.soleItems?.map((item: any, idx) => renderPurchaseItemRow(item, idx, products))
                : selectedPurchaseForCart.items?.map((item: any, idx) => renderPurchaseItemRow(item, idx, products))}
            </div>
            <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
              <h3 className={`font-black text-base tracking-tight text-rose-500 dark:text-rose-400 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                R$ {selectedPurchaseForCart.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
