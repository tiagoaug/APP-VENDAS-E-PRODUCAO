import { Product, ProductionLot, Sale, Account, AccountType, Transaction, TransactionType, SaleStatus, SaleType } from '../types';
import { getActiveProductionUnits } from './productionRoute';
import { getStockValue } from './stockPools';

export type OverviewPeriodType = 'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR';

// Mesma lógica de "getRange" da Análise de Lucro do Dashboard — mantém as duas
// telas consistentes sobre o que significa "este trimestre/semestre/ano".
// `dateStr` no formato "yyyy-MM" (mesmo valor de um <input type="month">).
export function getPeriodRange(type: OverviewPeriodType, dateStr: string): { start: number; end: number } {
  const date = new Date(dateStr + '-01T12:00:00');
  let start: Date;
  let end: Date;

  switch (type) {
    case 'QUARTER': {
      const qMonth = Math.floor(date.getMonth() / 3) * 3;
      start = new Date(date.getFullYear(), qMonth, 1);
      end = new Date(date.getFullYear(), qMonth + 3, 0, 23, 59, 59);
      break;
    }
    case 'SEMESTER': {
      const sMonth = Math.floor(date.getMonth() / 6) * 6;
      start = new Date(date.getFullYear(), sMonth, 1);
      end = new Date(date.getFullYear(), sMonth + 6, 0, 23, 59, 59);
      break;
    }
    case 'YEAR':
      start = new Date(date.getFullYear(), 0, 1);
      end = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
      break;
    default: // MONTH
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  }
  return { start: start.getTime(), end: end.getTime() };
}

// Custo e venda total do estoque pronto (mesma base do card "Patrimônio em
// Estoque" do Dashboard) — profit = saleValue - costValue.
export function computeStockValue(products: Product[]): { costValue: number; saleValue: number; profit: number } {
  let costValue = 0;
  let saleValue = 0;
  for (const p of products) {
    for (const v of p.variations || []) {
      const val = getStockValue(p, v);
      costValue += val.costValue;
      saleValue += val.saleValue;
    }
  }
  return { costValue, saleValue, profit: saleValue - costValue };
}

// Lucro parado em estoque pronto (venda - custo de tudo que já saiu da produção).
export function computeStockProfit(products: Product[]): number {
  return computeStockValue(products).profit;
}

// Lucro represado em pares ainda em produção (mapas ativos, sem contar o que já
// levou baixa pra Expedição) — usa o mesmo par preço de custo/venda por par que
// já é cadastrado em cada modelo (unitCostPrice/unitSalePrice, ou costPrice/
// salePrice direto pra produtos de varejo puro, onde já são por par).
export function computeProductionProfit(products: Product[], productionLots: ProductionLot[]): number {
  const units = getActiveProductionUnits(productionLots);
  let profit = 0;
  for (const unit of units) {
    const product = products.find(p => p.id === unit.productId);
    if (!product) continue;
    const perPairCost = product.unitCostPrice ?? product.costPrice ?? 0;
    const perPairSale = product.unitSalePrice ?? product.salePrice ?? 0;
    profit += unit.quantity * (perPairSale - perPairCost);
  }
  return profit;
}

// Soma dos saldos das contas do negócio (exclui contas de uso Pessoal). Se
// `accountIds` for informado, soma só essas contas (permite escolher quais
// contas entram no cálculo); undefined/null soma todas as contas do negócio.
export function computeAccountBalance(accounts: Account[], accountIds?: string[] | null): number {
  const businessAccounts = accounts.filter(a => a.type !== AccountType.PERSONAL);
  const filtered = accountIds ? businessAccounts.filter(a => accountIds.includes(a.id)) : businessAccounts;
  return filtered.reduce((acc, a) => acc + (a.balance || 0), 0);
}

// Vendas fechadas e ainda não totalmente pagas — mesmo cálculo do card
// "Lucro Total Estimado" do Dashboard.
export function computePendingReceivables(sales: Sale[]): number {
  return sales
    // Mesmo filtro do "A Receber" da tela de Vendas — exclui orçamento (QUOTE,
    // ainda não é venda fechada) e cancelada, pra bater com o número que o
    // usuário já vê lá, em vez de outra conta divergente aqui.
    .filter(s => s.status !== SaleStatus.QUOTE && s.status !== SaleStatus.CANCELLED && s.isAccounting !== false)
    .reduce((acc, sale) => {
      const totalPaid = (sale.paymentHistory || []).reduce((a, p) => a + p.amount, 0);
      return acc + Math.max(0, sale.total - totalPaid);
    }, 0);
}

// Lucro realizado nas vendas fechadas dentro do período (total cobrado − custo
// dos produtos vendidos) — diferente de "Lucro em Estoque" (parado, do agora) e
// de "Vendas a Receber" (valor ainda não recebido): aqui é a margem já ganha ao
// vender, esteja o dinheiro na conta ou ainda pendente.
export function computeSalesProfitInPeriod(sales: Sale[], products: Product[], start: number, end: number): number {
  const periodSales = sales.filter(s => s.status === SaleStatus.SALE && s.isAccounting !== false && s.date >= start && s.date <= end);
  let profit = 0;
  for (const sale of periodSales) {
    let itemsCost = 0;
    for (const item of sale.items || []) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      const unitCost = item.saleType === SaleType.WHOLESALE ? (product.costPrice || 0) : (product.unitCostPrice ?? product.costPrice ?? 0);
      itemsCost += unitCost * item.quantity;
    }
    profit += sale.total - itemsCost;
  }
  return profit;
}

// Receita e despesa de um período, a partir das transações confirmadas — mesmo
// filtro usado na Análise de Lucro do Dashboard.
export function computePeriodFinancials(transactions: Transaction[], start: number, end: number): { income: number; expenses: number } {
  const periodTx = transactions.filter(t => !t.isPersonal && t.status === 'COMPLETED' && t.date >= start && t.date <= end);
  const income = periodTx.filter(t => t.type === TransactionType.INCOME).reduce((a, t) => a + t.amount, 0);
  const expenses = periodTx.filter(t => t.type === TransactionType.EXPENSE).reduce((a, t) => a + t.amount, 0);
  return { income, expenses };
}

// Balanço do mês corrente (liquidados) — mesmo cálculo do card "Balanço Mensal"
// do Dashboard: só transações COMPLETED do mês calendário atual (não segue o
// período selecionado no card, sempre "este mês").
export function computeMonthlySettledBalance(transactions: Transaction[], accounts: Account[]): number {
  const businessTx = transactions.filter(t => !t.isPersonal && accounts.find(a => a.id === t.accountId)?.type !== AccountType.PERSONAL);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = now.getTime();
  const periodTx = businessTx.filter(t => t.status === 'COMPLETED' && t.date >= monthStart && t.date <= monthEnd);
  const income = periodTx.filter(t => t.type === TransactionType.INCOME).reduce((a, t) => a + t.amount, 0);
  const expenses = periodTx.filter(t => t.type === TransactionType.EXPENSE).reduce((a, t) => a + t.amount, 0);
  return income - expenses;
}
