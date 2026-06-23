import { format } from 'date-fns';
import {
  Sale, Purchase, ProductionOrder, ProductionLot, ServiceOrder, Transaction,
  Product, Person, SaleStatus, PaymentStatus, TransactionType, MonthlySnapshot,
} from '../types';

const TOP_N = 10;

export function getCutoffMs(intervalMonths: number): number {
  return Date.now() - intervalMonths * 30 * 24 * 60 * 60 * 1000;
}

// Critério de elegibilidade por entidade — em caso de dúvida, favorece deixar o
// registro "vivo" (nunca arquiva algo ainda pendente/aberto, mesmo que antigo).
export function isSaleEligible(sale: Sale, cutoffMs: number): boolean {
  if (sale.date >= cutoffMs) return false;
  if (sale.status === SaleStatus.CANCELLED || sale.status === SaleStatus.QUOTE) return true;
  return sale.paymentStatus !== PaymentStatus.PENDING;
}

export function isPurchaseEligible(purchase: Purchase, cutoffMs: number): boolean {
  return purchase.date < cutoffMs && purchase.paymentStatus !== PaymentStatus.PENDING;
}

export function isProductionOrderEligible(order: ProductionOrder, cutoffMs: number): boolean {
  return order.orderDate < cutoffMs && order.status === 'COMPLETED';
}

export function isServiceOrderEligible(os: ServiceOrder, cutoffMs: number): boolean {
  return os.createdAt < cutoffMs && os.status === 'COMPLETED';
}

export function isProductionLotEligible(lot: ProductionLot, cutoffMs: number): boolean {
  return lot.createdAt < cutoffMs && !!lot.finishedAt;
}

interface RankedEntry { id: string; name: string; total: number; count: number }
interface ProductEntry { id: string; name: string; colorName: string; quantity: number; total: number }

export interface MonthAccumulator {
  totalPairsProduced: number;
  salesTotal: number;
  salesCount: number;
  purchasesTotal: number;
  purchasesCount: number;
  financialIncome: number;
  financialExpense: number;
  customers: Map<string, RankedEntry>;
  productsMap: Map<string, ProductEntry>;
  suppliers: Map<string, RankedEntry>;
}

function emptyAccumulator(): MonthAccumulator {
  return {
    totalPairsProduced: 0, salesTotal: 0, salesCount: 0, purchasesTotal: 0, purchasesCount: 0,
    financialIncome: 0, financialExpense: 0,
    customers: new Map(), productsMap: new Map(), suppliers: new Map(),
  };
}

// Agrupa os registros elegíveis (já filtrados pelas funções acima) por mês e replica as
// fórmulas de ReportDetailedView.tsx (clientes que mais compram, produtos mais vendidos,
// balanço financeiro) — sem reinventar a lógica de negócio.
export function computeMonthlyContributions(params: {
  sales: Sale[];
  purchases: Purchase[];
  lots: ProductionLot[];
  transactions: Transaction[];
  people: Person[];
  products: Product[];
}): Map<string, MonthAccumulator> {
  const { sales, purchases, lots, transactions, people, products } = params;
  const byMonth = new Map<string, MonthAccumulator>();
  const getAcc = (month: string) => {
    if (!byMonth.has(month)) byMonth.set(month, emptyAccumulator());
    return byMonth.get(month)!;
  };

  sales.forEach(s => {
    const acc = getAcc(format(s.date, 'yyyy-MM'));
    if (s.status !== SaleStatus.SALE) return; // só vendas efetivadas entram nos totais/rankings
    acc.salesTotal += s.total;
    acc.salesCount += 1;

    const cid = s.customerId || 'unknown';
    const name = s.customerName || people.find(p => p.id === cid)?.name || 'Avulso';
    const cur = acc.customers.get(cid) || { id: cid, name, total: 0, count: 0 };
    cur.total += s.total;
    cur.count += 1;
    acc.customers.set(cid, cur);

    s.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const variation = prod?.variations.find(v => v.id === item.variationId);
      const key = `${item.productId}-${item.variationId}`;
      const curP = acc.productsMap.get(key) || { id: key, name: prod?.name || '?', colorName: variation?.colorName || '?', quantity: 0, total: 0 };
      curP.quantity += item.quantity;
      curP.total += item.quantity * item.price;
      acc.productsMap.set(key, curP);
    });
  });

  purchases.forEach(p => {
    const acc = getAcc(format(p.date, 'yyyy-MM'));
    acc.purchasesTotal += p.total;
    acc.purchasesCount += 1;

    const sid = p.supplierId || 'unknown';
    const name = people.find(pe => pe.id === sid)?.name || 'Desconhecido';
    const cur = acc.suppliers.get(sid) || { id: sid, name, total: 0, count: 0 };
    cur.total += p.total;
    cur.count += 1;
    acc.suppliers.set(sid, cur);
  });

  lots.forEach(l => {
    const acc = getAcc(format(l.finishedAt || l.createdAt, 'yyyy-MM'));
    acc.totalPairsProduced += l.quantity || 0;
  });

  transactions.forEach(t => {
    const acc = getAcc(format(t.date, 'yyyy-MM'));
    if (t.type === TransactionType.INCOME) acc.financialIncome += t.amount;
    if (t.type === TransactionType.EXPENSE) acc.financialExpense += t.amount;
  });

  return byMonth;
}

function topN<T extends { total: number }>(map: Map<string, T>): T[] {
  return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, TOP_N);
}

export function accumulatorToSnapshotPatch(month: string, acc: MonthAccumulator): Omit<MonthlySnapshot, 'id' | 'generatedAt'> {
  return {
    month,
    totalPairsProduced: acc.totalPairsProduced,
    salesTotal: acc.salesTotal,
    salesCount: acc.salesCount,
    purchasesTotal: acc.purchasesTotal,
    purchasesCount: acc.purchasesCount,
    financialIncome: acc.financialIncome,
    financialExpense: acc.financialExpense,
    topCustomers: topN(acc.customers),
    topProducts: topN(acc.productsMap),
    supplierTotals: topN(acc.suppliers),
  };
}

function mergeRankedLists<T extends { id: string; total: number }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  [...a, ...b].forEach(item => {
    const cur = map.get(item.id);
    if (!cur) { map.set(item.id, { ...item }); return; }
    map.set(item.id, { ...cur, ...mergeNumericFields(cur, item) });
  });
  return Array.from(map.values()).sort((x, y) => y.total - x.total).slice(0, TOP_N);
}

function mergeNumericFields(a: any, b: any) {
  const out: any = { total: a.total + b.total };
  if ('count' in a) out.count = (a.count || 0) + (b.count || 0);
  if ('quantity' in a) out.quantity = (a.quantity || 0) + (b.quantity || 0);
  return out;
}

// Soma aditivamente nos totais existentes — usado quando um mês já tinha um snapshot de
// uma rodada de arquivamento anterior (ex: um registro daquele mês só ficou elegível mais
// tarde, por ter ficado pendente por mais tempo).
export function mergeIntoSnapshot(existing: MonthlySnapshot | undefined, patch: Omit<MonthlySnapshot, 'id' | 'generatedAt'>): MonthlySnapshot {
  if (!existing) {
    return { id: patch.month, generatedAt: Date.now(), ...patch };
  }
  return {
    ...existing,
    generatedAt: Date.now(),
    totalPairsProduced: existing.totalPairsProduced + patch.totalPairsProduced,
    salesTotal: existing.salesTotal + patch.salesTotal,
    salesCount: existing.salesCount + patch.salesCount,
    purchasesTotal: existing.purchasesTotal + patch.purchasesTotal,
    purchasesCount: existing.purchasesCount + patch.purchasesCount,
    financialIncome: existing.financialIncome + patch.financialIncome,
    financialExpense: existing.financialExpense + patch.financialExpense,
    topCustomers: mergeRankedLists(existing.topCustomers, patch.topCustomers),
    topProducts: mergeRankedLists(existing.topProducts, patch.topProducts),
    supplierTotals: mergeRankedLists(existing.supplierTotals, patch.supplierTotals),
  };
}
