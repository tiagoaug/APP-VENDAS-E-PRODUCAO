import { Product, StockLot } from '../types';
import { DuplicateStockByRefColor, DuplicateStockLotGroup } from '../hooks/useStockLotDuplicates';

export interface StockDuplicateFixPlan {
  // Produtos já clonados e com o estoque/embalagem ajustados — salvar via saveDocument.
  productWrites: Product[];
  // StockLots excedentes a apagar (mantém sempre o mais antigo de cada grupo).
  stockLotIdsToDelete: string[];
}

/**
 * Monta o plano de correção de uma duplicidade de estoque (StockDuplicateDiagnosticModal):
 * para cada grupo de StockLots duplicados (mesma origem de produção creditada mais de uma
 * vez — ver useStockLotDuplicates), desfaz o efeito dos excedentes (`g.excessEntries`, já
 * calculado lá — normalmente "todos menos o mais antigo", mas quando dá pra saber quanto a
 * linha de produção pediu de verdade, só o que ultrapassa esse total é excedente, mesmo que
 * isso mantenha mais de 1 registro legítimo) — descontando do contador de estoque do
 * produto exatamente o que cada um creditou, e marcando pra apagar o próprio registro
 * duplicado. Não faz nenhum write no Firestore — só monta o plano; quem chama aplica com
 * firebaseService.
 */
export function buildStockDuplicateFixPlan(
  group: DuplicateStockByRefColor,
  allGroups: DuplicateStockLotGroup[],
  products: Product[],
): StockDuplicateFixPlan {
  const keysSet = new Set(group.groupKeys.map(gk => gk.key));
  const matchedGroups = allGroups.filter(g => keysSet.has(g.key));
  const excessEntries: StockLot[] = matchedGroups.flatMap(g => g.excessEntries);

  const productUpdates = new Map<string, Product>();
  const getProd = (id: string): Product | null => {
    if (productUpdates.has(id)) return productUpdates.get(id)!;
    const p = products.find(pr => pr.id === id);
    if (!p) return null;
    const cloned: Product = JSON.parse(JSON.stringify(p));
    productUpdates.set(id, cloned);
    return cloned;
  };

  for (const sl of excessEntries) {
    const prod = getProd(sl.productId);
    if (!prod) continue;
    const variIdx = prod.variations.findIndex(v => v.id === sl.variationId);
    if (variIdx < 0) continue;
    const v = prod.variations[variIdx];
    const newStock: Record<string, number> = { ...(v.stock as any) };
    if (sl.boxQty !== undefined) {
      newStock['WHOLESALE'] = Math.max(0, (newStock['WHOLESALE'] || 0) - (sl.boxQty || 0));
      const allocations = (v.stockPkgAllocations || [])
        .map(a => a.pkgId === sl.pkgId ? { ...a, qty: Math.max(0, a.qty - (sl.boxQty || 0)) } : a)
        .filter(a => a.qty > 0);
      prod.variations[variIdx] = { ...v, stock: newStock as any, stockPkgAllocations: allocations };
    } else {
      Object.entries(sl.sizeBreakdown || {}).forEach(([size, qty]) => {
        newStock[size] = Math.max(0, (newStock[size] || 0) - (Number(qty) || 0));
      });
      prod.variations[variIdx] = { ...v, stock: newStock as any };
    }
  }

  return {
    productWrites: Array.from(productUpdates.values()),
    stockLotIdsToDelete: excessEntries.map(sl => sl.id),
  };
}
