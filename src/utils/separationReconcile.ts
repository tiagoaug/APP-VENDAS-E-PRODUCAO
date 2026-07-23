import { Product, StockLot } from '../types';

export interface SeparationReconcileGroup {
  key: string;
  productId: string;
  productName: string;
  productReference?: string;
  variationId: string;
  variationName: string;
  isWholesale: boolean;
  totalToDeduct: number; // caixas (atacado) ou pares (varejo)
  sizeBreakdown: Record<string, number>; // só varejo
  lotIds: string[];
}

export interface SeparationReconcileFixPlan {
  productWrite: Product | null;
  lotIds: string[];
}

/**
 * Agrupa por produto+cor todo StockLot que foi reservado via "Separar Caixas"/"Expedir
 * Venda" (pool-pick do estoque geral, `reservedViaSeparation: true`) mas ainda não teve o
 * desconto correspondente aplicado no contador de estoque do produto
 * (`stockDeductionApplied`) — período com bug em que a reserva não descontava o contador.
 */
export function buildSeparationReconcileGroups(stockLots: StockLot[]): SeparationReconcileGroup[] {
  const affected = stockLots.filter(sl => sl.reservedViaSeparation === true && !sl.stockDeductionApplied);
  const groups = new Map<string, SeparationReconcileGroup>();
  affected.forEach(sl => {
    const key = `${sl.productId}::${sl.variationId}`;
    const isWholesale = sl.boxQty !== undefined;
    let g = groups.get(key);
    if (!g) {
      g = { key, productId: sl.productId, productName: sl.productName, productReference: sl.productReference, variationId: sl.variationId, variationName: sl.variationName, isWholesale, totalToDeduct: 0, sizeBreakdown: {}, lotIds: [] };
      groups.set(key, g);
    }
    if (isWholesale) {
      g.totalToDeduct += sl.boxQty || 0;
    } else {
      Object.entries(sl.sizeBreakdown || {}).forEach(([size, qty]) => {
        g.sizeBreakdown[size] = (g.sizeBreakdown[size] || 0) + (Number(qty) || 0);
      });
      g.totalToDeduct += sl.totalPairs || 0;
    }
    g.lotIds.push(sl.id);
  });
  return Array.from(groups.values());
}

/** Monta o plano de correção de um grupo — não escreve nada, só calcula. */
export function buildSeparationReconcileFixPlan(group: SeparationReconcileGroup, products: Product[]): SeparationReconcileFixPlan {
  const prod = products.find(p => p.id === group.productId);
  if (!prod) return { productWrite: null, lotIds: group.lotIds };
  const variIdx = prod.variations.findIndex(v => v.id === group.variationId);
  if (variIdx < 0) return { productWrite: null, lotIds: group.lotIds };

  const v = prod.variations[variIdx];
  const newStock: Record<string, number> = { ...(v.stock as any) };
  let stockPkgAllocations = v.stockPkgAllocations;

  if (group.isWholesale) {
    newStock['WHOLESALE'] = Math.max(0, (newStock['WHOLESALE'] || 0) - group.totalToDeduct);
    const allocsBefore = (v.stockPkgAllocations || []).map(a => ({ ...a }));
    const totalAlloc = allocsBefore.reduce((s, a) => s + a.qty, 0);
    if (newStock['WHOLESALE'] < totalAlloc) {
      let excess = totalAlloc - newStock['WHOLESALE'];
      const trimmed = allocsBefore.map(a => ({ ...a }));
      for (let i = trimmed.length - 1; i >= 0 && excess > 0; i--) {
        const cut = Math.min(trimmed[i].qty, excess);
        trimmed[i].qty -= cut;
        excess -= cut;
      }
      stockPkgAllocations = trimmed.filter(a => a.qty > 0);
    }
  } else {
    Object.entries(group.sizeBreakdown).forEach(([size, qty]) => {
      newStock[size] = Math.max(0, (newStock[size] || 0) - qty);
    });
  }

  const updatedVariations = prod.variations.map((vv, idx) => idx === variIdx ? { ...vv, stock: newStock as any, ...(group.isWholesale ? { stockPkgAllocations } : {}) } : vv);
  return { productWrite: { ...prod, variations: updatedVariations }, lotIds: group.lotIds };
}
