import { useState, useMemo, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sale, Purchase, Product, CompanyCheck, Transaction, TransactionType, Account, AccountType, SaleStatus, PaymentStatus, Person, ViewType, Category, DashboardConfig } from "../types";
import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingBag,
  History,
  CreditCard,
  CheckCircle2,
  Clock,
  DollarSign,
  Wallet,
  Boxes,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  X,
  RefreshCcw,
  AlertCircle,
  Hash,
  Calendar,
  Copy,
  FileDown,
  Clipboard,
  Landmark,
  User
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DashboardViewProps {
  sales: Sale[];
  purchases: Purchase[];
  products: Product[];
  transactions: Transaction[];
  accounts: Account[];
  people: Person[];
  categories: Category[];
  onAddSale: () => void;
  onUpdateCheckStatus: (
    purchaseId: string,
    checkId: string,
    newStatus: "PENDING" | "CLEARED" | "OVERDUE",
  ) => void;
  onNavigate: (view: ViewType, id?: string | null, search?: string) => void;
  isDarkMode: boolean;
  dashboardConfig: DashboardConfig;
}

export default function DashboardView({
  sales,
  purchases,
  products,
  transactions,
  accounts,
  people,
  categories,
  onAddSale,
  onUpdateCheckStatus,
  onNavigate,
  isDarkMode,
  dashboardConfig,
}: DashboardViewProps) {
  const [checksSearch, setChecksSearch] = useState("");
  const [lowStockSearch, setLowStockSearch] = useState("");
  const [customerDebtsSearch, setCustomerDebtsSearch] = useState("");
  const [supplierDebtsSearch, setSupplierDebtsSearch] = useState("");
  const [checksStatusFilter, setChecksStatusFilter] = useState<'ALL' | 'PENDING' | 'CLEARED' | 'OVERDUE'>('PENDING');
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
  const [isRecentActivityExpanded, setIsRecentActivityExpanded] = useState(false);
  
  const [customerDashboardTab, setCustomerDashboardTab] = useState<'DEBITS' | 'CREDITS'>('DEBITS');
  const [supplierDashboardTab, setSupplierDashboardTab] = useState<'DEBITS' | 'CREDITS'>('DEBITS');

  // Filtros para o novo card de Dívidas
  const [debtSupplierFilter, setDebtSupplierFilter] = useState("");
  const [debtCategoryFilter, setDebtCategoryFilter] = useState("");
  const [debtStartDate, setDebtStartDate] = useState("");
  const [debtEndDate, setDebtEndDate] = useState("");
  const [debtStatusFilter, setDebtStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('PENDING');
  const [isDebtFiltersExpanded, setIsDebtFiltersExpanded] = useState(false);

  // Filtros para o card de Lucro Detalhado
  const [profitPeriodType, setProfitPeriodType] = useState<'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR'>('MONTH');
  const [profitPeriodDate, setProfitPeriodDate] = useState(format(new Date(), 'yyyy-MM'));
  const [profitCompPeriodType, setProfitCompPeriodType] = useState<'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR'>('MONTH');
  const [profitCompPeriodDate, setProfitCompPeriodDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() - 1), 'yyyy-MM'));
  const [isProfitFiltersExpanded, setIsProfitFiltersExpanded] = useState(false);
  const [profitComparisonMode, setProfitComparisonMode] = useState<'AUTO' | 'MANUAL'>('AUTO');

  const customersWithCredits = useMemo(() => {
    return people
      .filter(p => p.isCustomer && (p.credit || 0) > 0.01)
      .filter(p => p.name.toLowerCase().includes(customerDebtsSearch.toLowerCase()))
      .sort((a, b) => (b.credit || 0) - (a.credit || 0));
  }, [people, customerDebtsSearch]);

  const suppliersWithCredits = useMemo(() => {
    return people
      .filter(p => p.isSupplier && (p.credit || 0) > 0.01)
      .filter(p => p.name.toLowerCase().includes(supplierDebtsSearch.toLowerCase()))
      .sort((a, b) => (b.credit || 0) - (a.credit || 0));
  }, [people, supplierDebtsSearch]);


  const statusMap: Record<string, { label: string, color: string }> = {
    'PENDING': { label: 'PENDENTE', color: 'text-amber-500' },
    'CLEARED': { label: 'LIQUIDADO', color: 'text-emerald-500' },
    'OVERDUE': { label: 'VENCIDO', color: 'text-rose-500' }
  };

  const downloadChecksPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(63, 81, 181);
    doc.text('Relatório de Cheques', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    
    const tableData = filteredChecks.map(c => [
      c.number,
      c.supplierName,
      format(c.dueDate, 'dd/MM/yyyy'),
      statusMap[c.status]?.label || c.status,
      `R$ ${c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nº Cheque', 'Fornecedor', 'Bom Para', 'Situação', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8, cellPadding: 3 }
    });

    doc.save(`relatorio_cheques_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  const suppliersWithDebts = useMemo(() => {
    const debtsBySupplier: Record<string, { person: Person, totalDebt: number, pendingCount: number }> = {};

    purchases.forEach(purchase => {
      if (purchase.generateTransaction === false) return; // Do not include "Não Contábil"
      if (purchase.paymentStatus === PaymentStatus.PAID) return; // Skip paid purchases
      
      const totalPaid = (purchase.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
      const debt = purchase.total - totalPaid;
      if (debt > 0.01) {
        if (!debtsBySupplier[purchase.supplierId || ""]) {
          const person = people.find(p => p.id === purchase.supplierId);
          if (person) {
            debtsBySupplier[purchase.supplierId!] = { person, totalDebt: 0, pendingCount: 0 };
          }
        }
        if (debtsBySupplier[purchase.supplierId || ""]) {
          debtsBySupplier[purchase.supplierId!].totalDebt += debt;
          debtsBySupplier[purchase.supplierId!].pendingCount += 1;
        }
      }
    });

    return Object.values(debtsBySupplier)
      .filter(item => item.person.name.toLowerCase().includes(supplierDebtsSearch.toLowerCase()))
      .sort((a, b) => b.totalDebt - a.totalDebt);
  }, [purchases, people, supplierDebtsSearch]);

  const pendingPurchases = useMemo(() => {
    return purchases
      .filter(p => {
        if (p.generateTransaction === false) return false;
        if (p.paymentStatus === PaymentStatus.PAID) return false;

        const totalPaid = (p.paymentHistory || []).reduce((acc, ph) => acc + ph.amount, 0);
        const debt = p.total - totalPaid;
        const matchesSearch = people.find(person => person.id === p.supplierId)?.name.toLowerCase().includes(supplierDebtsSearch.toLowerCase()) || 
                             p.batchNumber?.toLowerCase().includes(supplierDebtsSearch.toLowerCase());
        return debt > 0.01 && matchesSearch;
      })
      .map(p => ({
        ...p,
        supplierName: people.find(person => person.id === p.supplierId)?.name || "Fornecedor",
        debt: p.total - (p.paymentHistory || []).reduce((acc, ph) => acc + ph.amount, 0)
      }))
      .sort((a, b) => b.date - a.date);
  }, [purchases, people, supplierDebtsSearch]);

  const customersWithDebts = useMemo(() => {
    const debtsByCustomer: Record<string, { person: Person, totalDebt: number, pendingCount: number }> = {};

    sales.forEach(sale => {
      if (sale.status === SaleStatus.CANCELLED) return;
      if (sale.paymentStatus === PaymentStatus.PAID) return;

      const totalPaid = (sale.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
      const debt = sale.total - totalPaid;
      if (debt > 0.01) {
        if (!debtsByCustomer[sale.customerId || ""]) {
          const person = people.find(p => p.id === sale.customerId);
          if (person) {
            debtsByCustomer[sale.customerId!] = { person, totalDebt: 0, pendingCount: 0 };
          }
        }
        if (debtsByCustomer[sale.customerId || ""]) {
          debtsByCustomer[sale.customerId!].totalDebt += debt;
          debtsByCustomer[sale.customerId!].pendingCount += 1;
        }
      }
    });

    return Object.values(debtsByCustomer)
      .filter(item => item.person.name.toLowerCase().includes(customerDebtsSearch.toLowerCase()))
      .sort((a, b) => b.totalDebt - a.totalDebt);
  }, [sales, people, customerDebtsSearch]);

  const stats = useMemo(() => {
    const businessAccounts = accounts.filter(a => a.type !== AccountType.PERSONAL);
    const businessTransactions = transactions.filter(t => !t.isPersonal && accounts.find(a => a.id === t.accountId)?.type !== AccountType.PERSONAL);

    // Balanço unificado pelas contas comerciais
    const consolidatedBalance = businessAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);
    
    // Movimentação mensal pelas transações confirmadas (comerciais)
    const now = new Date();
    
    const monthlyIncome = businessTransactions
      .filter(t => t.status === 'COMPLETED' && t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + t.amount, 0);
      
    const monthlyExpenses = businessTransactions
      .filter(t => t.status === 'COMPLETED' && t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + t.amount, 0);

    const lowStockProducts = products.filter(p => {
      return p.variations.some(
        (v) =>
          Object.values(v.stock).reduce((sum, s) => sum + s, 0) < (v.minStock || 0),
      );
    });

    const lowStockAlerts = lowStockProducts.length;

    const stockSummary = products.reduce((acc, p) => {
      let totalQty = 0;
      p.variations.forEach(v => {
        const qty = Object.values(v.stock || {}).reduce((sum, s) => sum + Number(s || 0), 0);
        totalQty += qty;
        
        // Group by color
        const colorName = v.colorName || 'Sem Cor';
        acc.stockByColor[colorName] = (acc.stockByColor[colorName] || 0) + qty;
      });

      acc.totalCostValue += totalQty * (p.costPrice || 0);
      acc.totalSaleValue += totalQty * (p.salePrice || 0);
      acc.estimatedProfit += totalQty * ((p.salePrice || 0) - (p.costPrice || 0));
      
      return acc;
    }, { totalCostValue: 0, totalSaleValue: 0, estimatedProfit: 0, stockByColor: {} as Record<string, number> });

    // Sort colors by quantity
    const topColors = Object.entries(stockSummary.stockByColor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const pendingReceivables = sales
      .filter(s => s.status !== SaleStatus.CANCELLED && s.paymentStatus !== PaymentStatus.PAID)
      .reduce((acc, sale) => {
        const totalPaid = (sale.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
        return acc + Math.max(0, sale.total - totalPaid);
      }, 0);

    return { 
      consolidatedBalance, 
      monthlyIncome, 
      monthlyExpenses, 
      lowStockAlerts, 
      lowStockProducts,
      totalStockCostValue: stockSummary.totalCostValue,
      totalStockSaleValue: stockSummary.totalSaleValue,
      estimatedStockProfit: stockSummary.estimatedProfit,
      topColors,
      pendingReceivables
    };
  }, [transactions, accounts, products, sales]);

  const recentActivity = useMemo(() => {
    const businessTransactions = transactions.filter(t => !t.isPersonal && accounts.find(a => a.id === t.accountId)?.type !== AccountType.PERSONAL);
    const combined = [
      ...sales
        .filter(s => s.status !== SaleStatus.CANCELLED) // Ocultando canceladas do resumo de atividade do dashboard (opcional, ou podemos mostrar como canceladas)
        .map((s) => ({ ...s, activityType: "sale" as const })),
      ...purchases.map((p) => ({ ...p, activityType: "purchase" as const })),
      ...businessTransactions.map((t) => ({ ...t, activityType: "transaction" as const, total: t.amount, activityStatus: t.status })),
    ].sort((a, b) => b.date - a.date);
    return combined.slice(0, 10);
  }, [sales, purchases, transactions, accounts]);

  const filteredChecks = useMemo(() => {
    const checks: (CompanyCheck & {
      purchaseId: string;
      supplierId: string;
      supplierName: string;
    })[] = [];
    
    purchases.forEach((p) => {
      const supplier = people.find(s => s.id === p.supplierId);
      if (p.checks && p.checks.length > 0) {
        checks.push(
          ...p.checks.map((c) => ({
            ...c,
            purchaseId: p.id,
            supplierId: p.supplierId,
            supplierName: supplier?.name || "Desconhecido",
          })),
        );
      }
    });

    return checks
      .filter(c => {
        const num = c.number || "";
        const sup = c.supplierName || "";
        const matchesSearch = num.toLowerCase().includes(checksSearch.toLowerCase()) || 
                             sup.toLowerCase().includes(checksSearch.toLowerCase());
        const matchesStatus = checksStatusFilter === 'ALL' || c.status === checksStatusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.dueDate - b.dueDate);
  }, [purchases, people, checksSearch, checksStatusFilter]);

  const profitAnalysis = useMemo(() => {
    const getStatsForPeriod = (start: number, end: number) => {
      const periodTransactions = transactions.filter(t => 
        !t.isPersonal && 
        t.status === 'COMPLETED' && 
        t.date >= start && 
        t.date <= end
      );

      const income = periodTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((acc, t) => acc + t.amount, 0);

      const expenses = periodTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => acc + t.amount, 0);

      return { income, expenses, profit: income - expenses };
    };

    const getRange = (type: 'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR', dateStr: string) => {
      const date = new Date(dateStr + '-01T12:00:00');
      let start: Date;
      let end: Date;

      switch(type) {
        case 'QUARTER':
          const qMonth = Math.floor(date.getMonth() / 3) * 3;
          start = new Date(date.getFullYear(), qMonth, 1);
          end = new Date(date.getFullYear(), qMonth + 3, 0, 23, 59, 59);
          break;
        case 'SEMESTER':
          const sMonth = Math.floor(date.getMonth() / 6) * 6;
          start = new Date(date.getFullYear(), sMonth, 1);
          end = new Date(date.getFullYear(), sMonth + 6, 0, 23, 59, 59);
          break;
        case 'YEAR':
          start = new Date(date.getFullYear(), 0, 1);
          end = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
          break;
        default: // MONTH
          start = new Date(date.getFullYear(), date.getMonth(), 1);
          end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      }
      return { start: start.getTime(), end: end.getTime() };
    };

    const currentRange = getRange(profitPeriodType, profitPeriodDate);
    
    let previousStart: number;
    let previousEnd: number;

    if (profitComparisonMode === 'AUTO') {
      const duration = currentRange.end - currentRange.start;
      previousStart = currentRange.start - duration - 1000; // Small buffer to avoid overlap
      previousEnd = currentRange.start - 1;
    } else {
      const compRange = getRange(profitCompPeriodType, profitCompPeriodDate);
      previousStart = compRange.start;
      previousEnd = compRange.end;
    }

    const current = getStatsForPeriod(currentRange.start, currentRange.end);
    const previous = getStatsForPeriod(previousStart, previousEnd);

    const profitDiff = previous.profit === 0 ? (current.profit > 0 ? 100 : 0) : ((current.profit - previous.profit) / Math.abs(previous.profit)) * 100;

    return { current, previous, profitDiff, previousStart, previousEnd, currentStart: currentRange.start, currentEnd: currentRange.end };
  }, [transactions, profitPeriodType, profitPeriodDate, profitCompPeriodType, profitCompPeriodDate, profitComparisonMode]);

  const filteredDebtData = useMemo(() => {
    let list = purchases
      .filter(p => p.generateTransaction !== false)
      .map(p => {
        const totalPaid = (p.paymentHistory || []).reduce((acc, ph) => acc + ph.amount, 0);
        const debt = Math.max(0, p.total - totalPaid);
        const supplier = people.find(person => person.id === p.supplierId);
        const category = categories.find(cat => cat.id === p.categoryId);
        
        return {
          ...p,
          supplierName: supplier?.name || "Fornecedor",
          categoryName: category?.name || "Sem Categoria",
          debt
        };
      });

    if (debtSupplierFilter) {
      list = list.filter(p => p.supplierName.toLowerCase().includes(debtSupplierFilter.toLowerCase()));
    }

    if (debtCategoryFilter) {
      list = list.filter(p => p.categoryId === debtCategoryFilter);
    }

    if (debtStatusFilter === 'PENDING') {
      list = list.filter(p => p.debt > 0.01);
    } else if (debtStatusFilter === 'PAID') {
      list = list.filter(p => p.debt <= 0.01);
    }

    if (debtStartDate) {
      const start = new Date(debtStartDate).getTime();
      list = list.filter(p => p.date >= start);
    }
    if (debtEndDate) {
      const end = new Date(debtEndDate).getTime();
      list = list.filter(p => p.date <= end);
    }

    const bySupplier: Record<string, { name: string, total: number, count: number }> = {};
    const byCategory: Record<string, { name: string, total: number, count: number }> = {};
    let totalDebt = 0;

    list.forEach(p => {
      if (p.debt > 0.01) {
        totalDebt += p.debt;
        
        const sKey = p.supplierId || 'unknown';
        if (!bySupplier[sKey]) bySupplier[sKey] = { name: p.supplierName, total: 0, count: 0 };
        bySupplier[sKey].total += p.debt;
        bySupplier[sKey].count += 1;

        const cKey = p.categoryId || 'unknown';
        if (!byCategory[cKey]) byCategory[cKey] = { name: p.categoryName, total: 0, count: 0 };
        byCategory[cKey].total += p.debt;
        byCategory[cKey].count += 1;
      }
    });

    return {
      list: list.sort((a, b) => b.date - a.date),
      totalDebt,
      bySupplier: Object.values(bySupplier).sort((a, b) => b.total - a.total),
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total)
    };
  }, [purchases, people, categories, debtSupplierFilter, debtCategoryFilter, debtStatusFilter, debtStartDate, debtEndDate]);

  const sortedCards = useMemo(() => {
    return [...dashboardConfig.cards].sort((a, b) => a.order - b.order);
  }, [dashboardConfig]);

  return (
    <div className="flex-1 overflow-y-auto force-scrollbar flex flex-col gap-4 pb-40 px-4 bg-[#fafafa] dark:bg-slate-950 min-h-screen pt-4">
      {sortedCards.map((card) => {
        if (!card.visible) return null;

        switch (card.id) {
          case "balance":
            return (
              <div
                key="balance"
                onClick={() => onNavigate(ViewType.FINANCIAL)}
                className={`cursor-pointer p-6 rounded-[1.5rem] border shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex justify-between items-center ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Saldo Consolidado
                  </p>
                  <p className={`text-3xl font-black tracking-tight leading-none ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    R$ {stats.consolidatedBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-500">
                  <Wallet size={28} strokeWidth={2.5} />
                </div>
              </div>
            );

          case "cash_flow":
            return (
              <div
                key="cash_flow"
                onClick={() => onNavigate(ViewType.FINANCIAL)}
                className={`cursor-pointer p-6 rounded-[1.5rem] border shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex justify-between items-center ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Balanço Mensal (Liquidados)
                  </p>
                  <p className={`text-2xl font-black tracking-tight leading-none ${stats.monthlyIncome - stats.monthlyExpenses >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    R$ {(stats.monthlyIncome - stats.monthlyExpenses).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stats.monthlyIncome - stats.monthlyExpenses >= 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                  <TrendingUp size={24} strokeWidth={2.5} />
                </div>
              </div>
            );

          case "receivables":
            return (
              <div
                key="receivables"
                onClick={() => onNavigate(ViewType.FINANCIAL)}
                className={`cursor-pointer p-6 rounded-[1.5rem] border shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex justify-between items-center ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    A Receber (Pendente)
                  </p>
                  <p className={`text-2xl font-black tracking-tight leading-none ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    R$ {stats.pendingReceivables.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-500">
                  <DollarSign size={24} strokeWidth={2.5} />
                </div>
              </div>
            );

          case "stock_alerts":
            return (
              <div key="stock_alerts" className={`p-6 rounded-[1.5rem] border shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col gap-4 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                      Alertas de Estoque
                      {stats.lowStockAlerts > 0 && (
                        <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] pb-[1px]">
                          {stats.lowStockAlerts}
                        </span>
                      )}
                    </p>
                  </div>
                  <button onClick={() => onNavigate(ViewType.STOCK)} className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-600 dark:text-indigo-400">
                    Ver tudo
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={14} />
                  <input
                    type="text"
                    placeholder="BUSCAR PRODUTO..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-black uppercase tracking-widest placeholder:text-slate-300 dark:placeholder:text-slate-700"
                    value={lowStockSearch}
                    onChange={(e) => setLowStockSearch(e.target.value)}
                  />
                </div>
                <div className="h-[200px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
                  {stats.lowStockProducts.filter(p => p.name.toLowerCase().includes(lowStockSearch.toLowerCase())).map((product) => (
                    product.variations
                      .filter(v => Object.values(v.stock).reduce((sum: number, s: any) => sum + Number(s || 0), 0) < (v.minStock || 0))
                      .map((variation, vIdx) => (
                        <div key={`${product.id}-${vIdx}`} className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{product.name}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            Cor: {variation.colorName || 'Padrão'} | Qtd: <span className="text-rose-500 font-bold">{Object.values(variation.stock).reduce((sum: number, s: any) => sum + Number(s || 0), 0)}</span>
                          </p>
                        </div>
                      ))
                  ))}
                  {stats.lowStockProducts.filter(p => p.name.toLowerCase().includes(lowStockSearch.toLowerCase())).flatMap(p => p.variations.filter(v => Object.values(v.stock).reduce((sum: number, s: any) => sum + Number(s || 0), 0) < (v.minStock || 0))).length === 0 && (
                    <p className="text-[10px] text-center text-slate-400 py-4">Nenhum produto baixo encontrado.</p>
                  )}
                </div>
              </div>
            );

          case "customers":
            return (
              <div key="customers" className={`p-6 rounded-[1.5rem] border shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col gap-4 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Relacionamento Clientes</p>
                <div className="flex justify-between items-center">
                  <div className={`flex border p-0.5 rounded-xl shadow-sm dark:shadow-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <button onClick={() => setCustomerDashboardTab('DEBITS')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${customerDashboardTab === 'DEBITS' ? 'bg-slate-500 dark:bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                      DÉBITOS {customersWithDebts.length > 0 && <span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white items-center justify-center text-[8px] font-bold">{customersWithDebts.length}</span></span>}
                    </button>
                    <button onClick={() => setCustomerDashboardTab('CREDITS')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${customerDashboardTab === 'CREDITS' ? 'bg-slate-500 dark:bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                      CRÉDITOS {customersWithCredits.length > 0 && <span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white items-center justify-center text-[8px] font-bold">{customersWithCredits.length}</span></span>}
                    </button>
                  </div>
                  <button onClick={() => onNavigate(ViewType.SALES)} className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-600 dark:text-indigo-400">Ver tudo</button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={14} />
                  <input type="text" placeholder="BUSCAR CLIENTE..." className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-black uppercase tracking-widest placeholder:text-slate-300 dark:placeholder:text-slate-700" value={customerDebtsSearch} onChange={(e) => setCustomerDebtsSearch(e.target.value)} />
                </div>
                <div className="h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {customerDashboardTab === 'DEBITS' ? (
                    <>
                      {customersWithDebts.map((item, idx) => (
                        <div key={`cust-debt-${item.person.id}-${idx}`} onClick={() => onNavigate(ViewType.SALES, null, item.person.name)} className={`p-3 rounded-xl border cursor-pointer transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{item.person.name}</p>
                            <p className="text-[11px] font-black text-rose-500">R$ {item.totalDebt.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <p className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-widest">{item.pendingCount} {item.pendingCount === 1 ? 'venda pendente' : 'vendas pendentes'}</p>
                        </div>
                      ))}
                      {customersWithDebts.length === 0 && <p className="text-[10px] text-center text-slate-400 py-4">Nenhum cliente com débito.</p>}
                    </>
                  ) : (
                    <>
                      {customersWithCredits.map((person, idx) => (
                        <div key={`cust-cred-${person.id}-${idx}`} className={`p-3 rounded-xl border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{person.name}</p>
                            <p className="text-[11px] font-black text-emerald-500">R$ {(person.credit || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      ))}
                      {customersWithCredits.length === 0 && <p className="text-[10px] text-center text-slate-400 py-4">Nenhum cliente com crédito.</p>}
                    </>
                  )}
                </div>

                {/* Footer com Somas */}
                <div className={`mt-2 pt-3 border-t flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total do Período</p>
                  <p className={`text-[13px] font-black ${customerDashboardTab === 'DEBITS' ? 'text-rose-500' : 'text-emerald-500'}`}>
                    R$ {(customerDashboardTab === 'DEBITS' 
                      ? customersWithDebts.reduce((acc, item) => acc + item.totalDebt, 0)
                      : customersWithCredits.reduce((acc, person) => acc + (person.credit || 0), 0)
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            );

          case "suppliers":
            return (
              <div key="suppliers" className={`p-6 rounded-[1.5rem] border shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col gap-4 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Relacionamento Fornecedores</p>
                <div className="flex justify-between items-center">
                  <div className={`flex border p-0.5 rounded-xl shadow-sm dark:shadow-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <button onClick={() => setSupplierDashboardTab('DEBITS')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${supplierDashboardTab === 'DEBITS' ? 'bg-slate-500 dark:bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                      PENDENTES {pendingPurchases.length > 0 && <span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white items-center justify-center text-[8px] font-bold">{pendingPurchases.length}</span></span>}
                    </button>
                    <button onClick={() => setSupplierDashboardTab('CREDITS')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${supplierDashboardTab === 'CREDITS' ? 'bg-slate-500 dark:bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                      CRÉDITOS {suppliersWithCredits.length > 0 && <span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white items-center justify-center text-[8px] font-bold">{suppliersWithCredits.length}</span></span>}
                    </button>
                  </div>
                  <button onClick={() => onNavigate(ViewType.PURCHASES)} className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-600 dark:text-indigo-400">Ver tudo</button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={14} />
                  <input type="text" placeholder="BUSCAR FORNECEDOR..." className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-black uppercase tracking-widest placeholder:text-slate-300 dark:placeholder:text-slate-700" value={supplierDebtsSearch} onChange={(e) => setSupplierDebtsSearch(e.target.value)} />
                </div>
                <div className="h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {supplierDashboardTab === 'DEBITS' ? (
                    <>
                      {pendingPurchases.map((purchase, idx) => (
                        <div key={`sup-pending-${purchase.id}-${idx}`} onClick={() => onNavigate(ViewType.PURCHASE_FORM, purchase.id)} className={`p-3 rounded-xl border cursor-pointer transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{purchase.supplierName}</p>
                            <p className="text-[11px] font-black text-rose-500">R$ {purchase.debt.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{format(purchase.date, 'dd/MM/yyyy')}</p>
                            {purchase.batchNumber && <p className="text-[8px] text-indigo-500 dark:text-indigo-400 font-black uppercase tracking-widest">#{purchase.batchNumber}</p>}
                          </div>
                        </div>
                      ))}
                      {pendingPurchases.length === 0 && <p className="text-[10px] text-center text-slate-400 py-4">Nenhuma compra pendente.</p>}
                    </>
                  ) : (
                    <>
                      {suppliersWithCredits.map((person, idx) => (
                        <div key={`sup-cred-${person.id}-${idx}`} className={`p-3 rounded-xl border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{person.name}</p>
                            <p className="text-[11px] font-black text-emerald-500">R$ {(person.credit || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      ))}
                      {suppliersWithCredits.length === 0 && <p className="text-[10px] text-center text-slate-400 py-4">Nenhum crédito com fornecedor.</p>}
                    </>
                  )}
                </div>

                {/* Footer com Somas */}
                <div className={`mt-2 pt-3 border-t flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total do Período</p>
                  <p className={`text-[13px] font-black ${supplierDashboardTab === 'DEBITS' ? 'text-rose-500' : 'text-emerald-500'}`}>
                    R$ {(supplierDashboardTab === 'DEBITS' 
                      ? pendingPurchases.reduce((acc, p) => acc + p.debt, 0)
                      : suppliersWithCredits.reduce((acc, p) => acc + (p.credit || 0), 0)
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            );

          case "debt_management":
            return (
              <div key="debt_management" className={`p-6 rounded-[2rem] border shadow-[0_8px_30px_-10px_rgba(244,63,94,0.15)] flex flex-col gap-4 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center text-rose-500">
                      <AlertCircle size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-0.5">Controle de Dívidas</p>
                      <h4 className={`text-2xl font-black tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>R$ {filteredDebtData.totalDebt.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                    </div>
                  </div>
                  <button 
                    title="Filtrar"
                    aria-label="Abrir filtros de dívidas"
                    onClick={() => setIsDebtFiltersExpanded(!isDebtFiltersExpanded)} 
                    className={`p-2.5 rounded-xl transition-all ${isDebtFiltersExpanded ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-50 text-slate-400 dark:bg-slate-800'}`}
                  >
                    <Filter size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <AnimatePresence>
                  {isDebtFiltersExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Fornecedor</p>
                          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="BUSCAR..." className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-rose-500/20 transition-all" value={debtSupplierFilter} onChange={(e) => setDebtSupplierFilter(e.target.value)} /></div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</p>
                          <select 
                            title="Selecionar Categoria"
                            aria-label="Filtrar por categoria"
                            className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest appearance-none focus:ring-2 focus:ring-rose-500/20 transition-all" 
                            value={debtCategoryFilter} 
                            onChange={(e) => setDebtCategoryFilter(e.target.value)}
                          >
                            <option value="">TODAS</option>
                            {categories.filter(c => !c.isPersonal).map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Período Início</p>
                          <input 
                            title="Data Inicial"
                            aria-label="Data de início do período"
                            type="date" 
                            className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase focus:ring-2 focus:ring-rose-500/20 transition-all" 
                            value={debtStartDate} 
                            onChange={(e) => setDebtStartDate(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Período Fim</p>
                          <input 
                            title="Data Final"
                            aria-label="Data de fim do período"
                            type="date" 
                            className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase focus:ring-2 focus:ring-rose-500/20 transition-all" 
                            value={debtEndDate} 
                            onChange={(e) => setDebtEndDate(e.target.value)} 
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-950 rounded-xl">
                        {[{ id: 'ALL', label: 'Tudo' }, { id: 'PENDING', label: 'Pendentes' }, { id: 'PAID', label: 'Pagas' }].map(s => (
                          <button key={s.id} onClick={() => setDebtStatusFilter(s.id as any)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${debtStatusFilter === s.id ? 'bg-white dark:bg-slate-800 shadow-sm text-rose-500' : 'text-slate-400'}`}>{s.label}</button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Top Devedores</p><div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 ml-4"></div></div>
                    <div className="flex flex-col gap-3 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                      {filteredDebtData.bySupplier.map((item, idx) => (
                        <div key={`debt-sup-${idx}`} className="flex items-center justify-between group"><div className="flex flex-col flex-1 mr-4"><span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase truncate">{item.name}</span><div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (item.total / (filteredDebtData.totalDebt || 1)) * 100)}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full bg-rose-500" /></div></div><div className="text-right shrink-0"><p className={`text-[11px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{item.count} títulos</p></div></div>
                      ))}
                      {filteredDebtData.bySupplier.length === 0 && <div className="flex flex-col items-center justify-center py-6"><CheckCircle2 size={24} className="text-emerald-500 mb-2 opacity-20" /><p className="text-[10px] text-slate-400 uppercase font-black">Nenhuma pendência</p></div>}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Por Categoria</p><div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 ml-4"></div></div>
                    <div className="grid grid-cols-2 gap-3">
                      {filteredDebtData.byCategory.slice(0, 4).map((item, idx) => (
                        <div key={`debt-cat-${idx}`} className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'}`}><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate mb-1.5">{item.name}</p><p className="text-sm font-black text-rose-500">R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-[7px] font-bold text-slate-400 uppercase mt-1">{((item.total / (filteredDebtData.totalDebt || 1)) * 100).toFixed(0)}% do total</p></div>
                      ))}
                      {filteredDebtData.byCategory.length === 0 && <div className="col-span-2 py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl"><p className="text-[9px] font-black text-slate-300 uppercase">Sem dados</p></div>}
                    </div>
                  </div>
                </div>
                {filteredDebtData.list.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Títulos Recentes</p>
                    <div className="space-y-2">
                      {filteredDebtData.list.slice(0, 3).map((p, i) => (
                        <div key={`recent-debt-${i}`} onClick={() => onNavigate(ViewType.PURCHASE_FORM, p.id)} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all hover:translate-x-1 ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-rose-500/30' : 'bg-white border-slate-50 hover:border-rose-200'}`}><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.debt > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>{p.debt > 0 ? <Clock size={14} /> : <CheckCircle2 size={14} />}</div><div><p className="text-[10px] font-black uppercase text-current leading-none">{p.supplierName}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">{format(p.date, 'dd MMM yyyy', { locale: ptBR })} • {p.categoryName}</p></div></div><p className={`text-[10px] font-black ${p.debt > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>R$ {p.debt.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );

          case "stock_value":
            return (
              <div
                key="stock_value"
                onClick={() => onNavigate(ViewType.STOCK)}
                className={`cursor-pointer p-6 rounded-[2rem] border shadow-[0_4px_20px_-6px_rgba(0,0,0,0.1)] flex flex-col justify-center min-h-[140px] ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Patrimônio em Estoque</p>
                    <div className="flex items-baseline gap-2"><span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">CUSTO:</span><p className={`text-2xl font-black tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>R$ {stats.totalStockCostValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                    <div className="mt-2 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Venda: R$ {stats.totalStockSaleValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isDarkMode ? 'bg-amber-900/20 text-amber-500 shadow-amber-900/10' : 'bg-amber-50 text-amber-600 shadow-amber-100/50'}`}><Boxes size={32} strokeWidth={2.5} /></div>
                </div>
              </div>
            );

          case "estimated_profit":
            return (
              <div key="estimated_profit" className={`p-6 rounded-[2rem] border shadow-[0_8px_30px_-10px_rgba(79,70,229,0.15)] flex flex-col gap-5 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <div className="flex justify-between items-start">
                  <div><p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">Lucro Total Estimado</p><h4 className={`text-3xl font-black tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>R$ {(stats.estimatedStockProfit + stats.pendingReceivables + stats.consolidatedBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">* Estimativa baseada no estoque e pendências</p></div>
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30"><TrendingUp size={24} strokeWidth={3} /></div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className={`flex items-center justify-between p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><Package size={14} /></div><div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Lucro em Estoque</span><p className="text-[8px] font-bold text-emerald-500/80 uppercase tracking-widest mt-0.5">Margem: {stats.totalStockCostValue > 0 ? ((stats.estimatedStockProfit / stats.totalStockCostValue) * 100).toFixed(1) : 0}%</p></div></div><span className="text-[11px] font-black text-emerald-500">+ R$ {stats.estimatedStockProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className={`flex items-center justify-between p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center"><DollarSign size={14} /></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendas a Receber</span></div><span className="text-[11px] font-black text-amber-500">+ R$ {stats.pendingReceivables.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className={`flex items-center justify-between p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center"><Wallet size={14} /></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo em Contas</span></div><span className="text-[11px] font-black text-indigo-500">+ R$ {stats.consolidatedBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                </div>
              </div>
            );

          case "checks":
            return (
              <section key="checks" className="mt-2">
                <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                  <div className="p-6 pb-2">
                    <div className="flex items-center justify-between mb-6"><div><h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}>Relatório de Cheques</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão Unificada de Documentos</p></div><div className="flex items-center gap-2"><div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-amber-900/20 text-amber-500' : 'bg-amber-50 text-amber-600'}`}><CreditCard size={20} strokeWidth={2.5} /></div></div></div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Clipboard size={14} className="text-indigo-500" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total: {filteredChecks.length} cheques</span></div><div className="flex items-center gap-2"><button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all border border-slate-100 dark:border-slate-700 active:scale-95" onClick={() => { const summary = filteredChecks.map(c => `${c.number} - R$ ${c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${format(c.dueDate, 'dd/MM/yyyy')}`).join('\n'); navigator.clipboard.writeText(summary); alert('Lista de cheques copiada!'); }}><Copy size={12} />Copiar</button><button onClick={downloadChecksPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 dark:border-indigo-900/50 active:scale-95"><FileDown size={14} />PDF</button></div></div>
                      <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={16} /><input type="text" placeholder="BUSCAR POR NÚMERO OU FORNECEDOR..." className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-2xl pl-12 pr-4 py-3.5 text-[11px] font-black uppercase tracking-widest placeholder:text-slate-300 dark:placeholder:text-slate-800 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-800 dark:text-white" value={checksSearch} onChange={(e) => setChecksSearch(e.target.value)} />{checksSearch && (<button onClick={() => setChecksSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" title="Limpar busca"><X size={14} /></button>)}</div>
                      <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-x-auto no-scrollbar">{(['PENDING', 'OVERDUE', 'CLEARED', 'ALL'] as const).map((status) => (<button key={status} onClick={() => setChecksStatusFilter(status)} className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${checksStatusFilter === status ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-700'}`}>{status === 'PENDING' ? 'A Vencer' : status === 'CLEARED' ? 'Compensados' : status === 'OVERDUE' ? 'Vencidos' : 'Todos'}</button>))}</div>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    {filteredChecks.length > 0 ? (
                      filteredChecks.map((check) => {
                        const daysUntil = differenceInDays(check.dueDate, new Date());
                        const isLate = check.status === "PENDING" && daysUntil < 0;
                        const isToday = check.status === "PENDING" && daysUntil === 0;
                        const isExpanded = expandedCheckId === check.id;
                        return (
                          <div key={check.id} className={`p-5 rounded-3xl border-2 border-dashed transition-all ${isExpanded ? (isDarkMode ? 'bg-slate-800/50 border-indigo-500/50' : 'bg-slate-50/50 border-indigo-200') : (isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-100')}`}>
                            <button onClick={() => setExpandedCheckId(isExpanded ? null : check.id)} className="w-full text-left group"><div className="flex items-center justify-between mb-4 pb-4 border-b border-dashed border-slate-200 dark:border-slate-800"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300 group-hover:scale-110 group-active:scale-95 ${isDarkMode ? 'bg-amber-950/40 text-amber-500 border border-amber-800/30' : 'bg-amber-50 text-amber-500 border border-amber-100'} ${!isExpanded && check.status === 'PENDING' ? 'animate-pulse ring-4 ring-amber-500/20' : ''}`}><Hash size={18} strokeWidth={3} /></div><div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nº do Cheque</p><div className="flex items-center gap-2"><p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{check.number}</p>{isLate && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}</div></div></div><div className="text-right"><p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Valor</p><p className="text-sm font-black tracking-tight text-indigo-600 dark:text-indigo-400">R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div></div><div className="grid grid-cols-2 gap-y-4"><div className="flex items-center gap-3"><Calendar size={14} className="text-slate-300 dark:text-slate-600" /><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Bom Para</p><p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{format(check.dueDate, 'dd/MM/yyyy')}</p>{check.status === 'PENDING' && (<p className={`text-[8px] font-bold mt-0.5 uppercase ${isLate ? 'text-rose-500' : isToday ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>{isLate ? `${Math.abs(daysUntil)} dias vencidos` : isToday ? 'Vence hoje' : `Faltam ${daysUntil} dias`}</p>)}</div></div><div className="flex items-center gap-3"><AlertCircle size={14} className="text-slate-300 dark:text-slate-600" /><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p><p className={`text-[10px] font-bold uppercase ${statusMap[check.status]?.color || 'text-slate-600'}`}>{statusMap[check.status]?.label || check.status}</p></div></div></div></button>
                            {isExpanded && (<div className="mt-6 pt-6 border-t border-dashed border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-4 duration-500"><div className="mb-4 bg-white dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><User size={12} className="text-slate-400" /><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</p></div><p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{check.supplierName}</p></div><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Landmark size={12} className="text-slate-400" /><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Empresa</p></div><p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tight leading-none">Vendas Pro</p></div></div><div className="flex gap-2">{check.status !== 'CLEARED' ? (<><button onClick={(e) => { e.stopPropagation(); onUpdateCheckStatus(check.purchaseId, check.id, "CLEARED"); }} className="flex-1 py-3 rounded-2xl bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"><CheckCircle2 size={16} strokeWidth={3} />Liquidar</button><button onClick={(e) => { e.stopPropagation(); onUpdateCheckStatus(check.purchaseId, check.id, "OVERDUE"); }} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 active:scale-95 ${check.status === 'OVERDUE' ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-500/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}><AlertCircle size={16} />Vencido</button></>) : (<button onClick={(e) => { e.stopPropagation(); onUpdateCheckStatus(check.purchaseId, check.id, "PENDING"); }} className="w-full py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/50 active:scale-95 transition-all flex items-center justify-center gap-3"><RefreshCcw size={16} strokeWidth={3} />Reverter Liquidação</button>)}</div></div>)}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 bg-slate-50/50 dark:bg-slate-950/50 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-3"><Filter className="text-slate-200 dark:text-slate-800" size={32} strokeWidth={1.5} /><p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-[0.2em] italic">Nenhum cheque encontrado</p></div>
                    )}
                  </div>
                </div>
              </section>
            );

          case "monthly_profit_detailed":
            return (
              <div key="monthly_profit_detailed" className={`p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-6 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? "bg-emerald-900/30 text-emerald-500" : "bg-emerald-50 text-emerald-600"}`}>
                      <TrendingUp size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-0.5">Análise de Lucro</p>
                      <h4 className={`text-2xl font-black tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>R$ {profitAnalysis.current.profit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                    </div>
                  </div>
                  <button 
                    title="Filtrar Período"
                    onClick={() => setIsProfitFiltersExpanded(!isProfitFiltersExpanded)} 
                    className={`p-2.5 rounded-xl transition-all ${isProfitFiltersExpanded ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-50 text-slate-400 dark:bg-slate-800'}`}
                  >
                    <Calendar size={18} strokeWidth={2.5} />
                  </button>
                </div>

                <AnimatePresence>
                  {isProfitFiltersExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-4">
                      <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-950 rounded-xl mt-2">
                        <button 
                          onClick={() => setProfitComparisonMode('AUTO')}
                          className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${profitComparisonMode === 'AUTO' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600' : 'text-slate-400'}`}
                        >
                          Auto (Anterior)
                        </button>
                        <button 
                          onClick={() => setProfitComparisonMode('MANUAL')}
                          className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${profitComparisonMode === 'MANUAL' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600' : 'text-slate-400'}`}
                        >
                          Manual (Comparar)
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Período Atual</p>
                            <div className="flex gap-2">
                              <select 
                                title="Tipo Período"
                                className="bg-slate-50 dark:bg-slate-950 border-none rounded-xl px-2 py-2.5 text-[9px] font-bold uppercase"
                                value={profitPeriodType}
                                onChange={(e) => setProfitPeriodType(e.target.value as any)}
                              >
                                <option value="MONTH">Mês</option>
                                <option value="QUARTER">Trimestre</option>
                                <option value="SEMESTER">Semestre</option>
                                <option value="YEAR">Ano</option>
                              </select>
                              <input 
                                type="month" 
                                title="Data Referência"
                                className="flex-1 bg-slate-50 dark:bg-slate-950 border-none rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase" 
                                value={profitPeriodDate} 
                                onChange={(e) => setProfitPeriodDate(e.target.value)} 
                              />
                            </div>
                          </div>
                          
                          {profitComparisonMode === 'MANUAL' && (
                            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-1.5">
                              <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest px-1">Comparar com</p>
                              <div className="flex gap-2">
                                <select 
                                  title="Tipo Período Comp"
                                  className="bg-indigo-50 dark:bg-indigo-900/30 border-none rounded-xl px-2 py-2.5 text-[9px] font-bold uppercase text-indigo-600 dark:text-indigo-400"
                                  value={profitCompPeriodType}
                                  onChange={(e) => setProfitCompPeriodType(e.target.value as any)}
                                >
                                  <option value="MONTH">Mês</option>
                                  <option value="QUARTER">Trimestre</option>
                                  <option value="SEMESTER">Semestre</option>
                                  <option value="YEAR">Ano</option>
                                </select>
                                <input 
                                  type="month" 
                                  title="Data Referência Comp"
                                  className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 border-none rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400" 
                                  value={profitCompPeriodDate} 
                                  onChange={(e) => setProfitCompPeriodDate(e.target.value)} 
                                />
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 flex flex-col gap-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Receitas</p>
                    <p className="text-sm font-black text-emerald-500">R$ {profitAnalysis.current.income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 flex flex-col gap-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Despesas</p>
                    <p className="text-sm font-black text-rose-500">R$ {profitAnalysis.current.expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 flex flex-col gap-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Comparativo</p>
                    <div className="flex items-center gap-1">
                      {profitAnalysis.profitDiff >= 0 ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-rose-500" />}
                      <p className={`text-sm font-black ${profitAnalysis.profitDiff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {profitAnalysis.profitDiff > 0 ? "+" : ""}{profitAnalysis.profitDiff.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border-2 border-dashed ${isDarkMode ? "border-slate-800" : "border-slate-50"} flex flex-col gap-3`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {profitComparisonMode === 'AUTO' ? 'Período Anterior Automático' : 'Comparação Manual Selecionada'}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col gap-1">
                        <p className="text-[8px] font-bold text-indigo-400 uppercase">
                          {format(new Date(profitAnalysis.previousStart), profitCompPeriodType === 'YEAR' ? 'yyyy' : 'MM/yy')} 
                          {profitCompPeriodType === 'QUARTER' ? ' (Trim)' : profitCompPeriodType === 'SEMESTER' ? ' (Sem)' : ''}
                        </p>
                        <p className={`text-xs font-black ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>R$ {profitAnalysis.previous.profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <p className="text-[8px] font-bold text-emerald-500 uppercase">
                          {format(new Date(profitAnalysis.currentStart), profitPeriodType === 'YEAR' ? 'yyyy' : 'MM/yy')}
                        </p>
                        <p className={`text-xs font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>R$ {profitAnalysis.current.profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-indigo-400/30 dark:bg-indigo-900/50" 
                        style={{ width: `${Math.max(5, Math.min(95, (Math.abs(profitAnalysis.previous.profit) / (Math.abs(profitAnalysis.current.profit) + Math.abs(profitAnalysis.previous.profit) || 1)) * 100))}%` }} 
                      />
                      <div 
                        className="h-full bg-emerald-500" 
                        style={{ width: `${Math.max(5, Math.min(95, (Math.abs(profitAnalysis.current.profit) / (Math.abs(profitAnalysis.current.profit) + Math.abs(profitAnalysis.previous.profit) || 1)) * 100))}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            );

          case "activity":
            return (
              <section key="activity">
                <button onClick={() => setIsRecentActivityExpanded(!isRecentActivityExpanded)} className="flex items-center justify-between w-full mb-4 px-1"><div><h2 className={`text-[13px] font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}>Atividade</h2><p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Recentes</p></div><div className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} text-slate-500`}>{isRecentActivityExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div></button>
                {isRecentActivityExpanded && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {recentActivity.map((activity: any) => (
                      <div key={activity.id} className={`flex items-center gap-4 p-3 border rounded-2xl shadow-sm dark:shadow-none hover:border-slate-200 dark:hover:border-slate-700 transition-colors ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}><div className={`flex items-center justify-center p-2 rounded-xl ${activity.activityType === "sale" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30" : activity.activityType === "purchase" ? "bg-slate-50 text-slate-400 dark:bg-slate-800" : (activity.type === TransactionType.INCOME) ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" : "bg-rose-50 text-rose-600 dark:bg-rose-900/30"}`}>{activity.activityType === "sale" ? (<ShoppingBag size={20} strokeWidth={2.5} />) : activity.activityType === "purchase" ? (<TrendingDown size={20} strokeWidth={2.5} />) : activity.type === TransactionType.INCOME ? (<TrendingUp size={20} strokeWidth={2.5} />) : (<TrendingDown size={20} strokeWidth={2.5} />)}</div><div className="flex-1 min-w-0"><p className={`text-[12px] font-black truncate uppercase tracking-tight leading-none ${isDarkMode ? "text-white" : "text-slate-800"}`}>{activity.activityType === "sale" ? "Venda" : activity.activityType === "purchase" ? "Compra" : (activity.description || "Lançamento")}</p><p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1.5 ">{format(activity.date || Date.now(), "dd MMM, HH:mm", { locale: ptBR })}</p></div><div className="text-right"><p className={`text-[13px] font-black tracking-tight ${activity.activityType === "sale" || (activity.activityType === "transaction" && activity.type === TransactionType.INCOME) ? "text-emerald-500" : "text-rose-500"}`}>{(activity.activityType === "sale" || (activity.activityType === "transaction" && activity.type === TransactionType.INCOME)) ? "+" : "-"} R$ {Number(activity.total || activity.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><div className="flex items-center gap-1 justify-end mt-1"><span className={`text-[7px] px-1.5 py-0.5 rounded-lg uppercase font-black tracking-widest ${(activity.status === 'PENDING' || activity.activityStatus === 'PENDING') ? "bg-amber-100 text-amber-600" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>{(activity.status === 'PENDING' || activity.activityStatus === 'PENDING') ? "Pendente" : "OK"}</span></div></div></div>
                    ))}
                    {recentActivity.length === 0 && (<div className="text-center py-20 bg-slate-50/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center"><History size={40} className="text-slate-200 dark:text-slate-800 mb-2" strokeWidth={1} /><p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-[0.2em] italic">Vazio histórico</p></div>)}
                  </div>
                )}
              </section>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
