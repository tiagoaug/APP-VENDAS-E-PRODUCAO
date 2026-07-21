import { Product, ProductionLot, ProductionOrder, SaleType, StockLot } from '../types';
import { getOrderEffectiveSector, getSourceItemKey, ORDER_FINALIZED, stockLotMatchesSourceItem } from './productionRoute';

export interface StockRepairSummary {
  /** StockLots ATACADO sem boxQty preenchido (bug antigo de conversão pares→caixas). */
  missingBoxQty: number;
  /** Pedidos marcados finalizados sem StockLot correspondente, resolvíveis automaticamente. */
  missingStockLot: number;
  /** Mesma situação acima, mas sem dados suficientes para resolver produto/variação — precisa investigação manual. */
  unresolved: number;
}

/**
 * Mesma varredura de `buildStockRepairItems` (PCPView), só que resumida em contagens —
 * usada pra alimentar avisos fora do PCP (ex.: Vendas) sem duplicar toda a lógica de
 * montagem dos itens corrigíveis, que só faz sentido dentro do modal "Reparar Caixas".
 */
export function summarizeStockRepairIssues(
  lots: ProductionLot[],
  stockLots: StockLot[],
  productionOrders: ProductionOrder[],
  products: Product[],
): StockRepairSummary {
  let missingBoxQty = 0;
  for (const sl of stockLots) {
    if (sl.status !== 'EM_ESTOQUE') continue;
    if (sl.repairAcknowledged) continue;
    if (sl.boxQty != null && sl.boxQty > 0) continue;
    const prod = products.find(p => p.id === sl.productId);
    if (!prod) continue;
    if ((prod.type ?? SaleType.WHOLESALE) !== SaleType.WHOLESALE) continue;
    missingBoxQty++;
  }

  let missingStockLot = 0;
  let unresolved = 0;
  for (const lot of lots) {
    const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
    if (sourceItems.length === 0) continue;
    const repairAcknowledged: Record<string, boolean> = (lot as any).metadata?.repairAcknowledged || {};
    const seenSIKeysThisLot = new Set<string>();
    for (const si of sourceItems) {
      if (getOrderEffectiveSector(lot, si.orderId, si) !== ORDER_FINALIZED) continue;
      const siKey = getSourceItemKey(si);
      if (seenSIKeysThisLot.has(siKey)) continue;
      seenSIKeysThisLot.add(siKey);
      if (repairAcknowledged[siKey]) continue;
      const hasStockLot = stockLots.some(sl => stockLotMatchesSourceItem(sl, si, lot.id));
      if (hasStockLot) continue;

      const prodOrder = productionOrders.find(o => o.id === si.orderId);
      const ordItem: any = prodOrder
        ? (si.itemIdx !== undefined
          ? prodOrder.items[si.itemIdx]
          : prodOrder.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId))
        : undefined;
      if (!ordItem && !(si.productId && si.variationId)) { unresolved++; continue; }
      const prod = products.find(p => p.id === (si.productId || ordItem?.productId));
      if (!prod) { unresolved++; continue; }
      const vari = prod.variations.find(v => v.id === (si.variationId || ordItem?.variationId));
      if (!vari) { unresolved++; continue; }

      missingStockLot++;
    }
  }

  return { missingBoxQty, missingStockLot, unresolved };
}
