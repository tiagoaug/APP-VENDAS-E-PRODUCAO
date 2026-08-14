import { Product, Sale, StockLot } from '../types';

// Detecta StockLots RESERVADO "órfãos" — presos numa venda que ou já foi excluída, ou não
// referencia mais aquele lote em nenhum item (separatedStockLotIds). Isso deixa uma caixa
// real presa como reservada pra sempre, sem nunca ser entregue nem liberada — sintoma do
// bug de concorrência da separação de caixas (duas separações/reversões tocando o mesmo
// StockLot quase ao mesmo tempo, já corrigido com transação real em handleSepararCaixas/
// handlePartialRevertSeparacao, ver App.tsx). Diferente de "Estoque Não Creditado"
// (stockUndercreditFix.ts) e "Duplicidade" (useStockLotDuplicates), que só olham StockLots
// EM_ESTOQUE — aqui o problema é especificamente em lotes RESERVADO.
export interface OrphanedReservedLot {
  key: string;
  lot: StockLot;
  productName: string;
  productReference: string;
  variationName: string;
  reason: 'sale_missing' | 'not_referenced';
  saleOrderNumber?: string;
  customerName?: string;
}

// Chave do localStorage onde ficam os "Já Resolvi Manualmente" (ver dismissOrphanedLot em
// StockView.tsx). Compartilhada aqui pra que outras telas que só mostram a CONTAGEM (ex.:
// banner de SalesView) também descontem os já resolvidos, em vez de reimplementar a leitura
// e ficar mostrando o aviso pra sempre depois do usuário dispensar.
export const ORPHANED_RESOLVED_STORAGE_KEY = 'pcp_resolved_orphaned_lots_v1';

export function readResolvedOrphanedLotKeys(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(ORPHANED_RESOLVED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function buildOrphanedReservedLots(stockLots: StockLot[], sales: Sale[], products: Product[]): OrphanedReservedLot[] {
  const saleById = new Map(sales.map(s => [s.id, s]));
  const out: OrphanedReservedLot[] = [];
  for (const lot of stockLots) {
    if (lot.status !== 'RESERVADO' || !lot.saleId) continue;
    const product = products.find(p => p.id === lot.productId);
    const variation = product?.variations.find(v => v.id === lot.variationId);
    const productName = product?.name || lot.productName;
    const productReference = product?.reference || '';
    const variationName = variation?.colorName || lot.variationName;

    const sale = saleById.get(lot.saleId);
    if (!sale) {
      out.push({ key: lot.id, lot, productName, productReference, variationName, reason: 'sale_missing', saleOrderNumber: lot.saleOrderNumber });
      continue;
    }
    const referenced = (sale.items || []).some(it => (it.separatedStockLotIds || []).includes(lot.id));
    if (!referenced) {
      out.push({ key: lot.id, lot, productName, productReference, variationName, reason: 'not_referenced', saleOrderNumber: sale.orderNumber, customerName: sale.customerName });
    }
  }
  return out.sort((a, b) => (a.lot.createdAt || 0) - (b.lot.createdAt || 0));
}

export interface ReleaseOrphanedLotPlan {
  productWrite: Product | null;
  lotId: string;
}

// Devolve a caixa/par pro estoque geral disponível (EM_ESTOQUE) e soma de volta no
// contador do produto — o inverso exato de uma separação normal. Só usado quando a caixa
// não está coberta por nenhum recount/Balanço manual já feito (ver dismiss "Já Resolvi
// Manualmente" na tela) — senão somaria em duplicidade com o que a recontagem já corrigiu.
export function buildReleaseOrphanedLotPlan(entry: OrphanedReservedLot, products: Product[]): ReleaseOrphanedLotPlan {
  const lot = entry.lot;
  const product = products.find(p => p.id === lot.productId);
  if (!product) return { productWrite: null, lotId: lot.id };
  const cloned: Product = JSON.parse(JSON.stringify(product));
  const variIdx = cloned.variations.findIndex(v => v.id === lot.variationId);
  if (variIdx < 0) return { productWrite: null, lotId: lot.id };
  const v = cloned.variations[variIdx];
  const newStock: Record<string, number> = { ...(v.stock as any) };

  if (lot.boxQty !== undefined && lot.boxQty !== null) {
    newStock['WHOLESALE'] = (newStock['WHOLESALE'] || 0) + lot.boxQty;
    const allocations = [...(v.stockPkgAllocations || [])];
    if (lot.pkgId) {
      const idx = allocations.findIndex(a => a.pkgId === lot.pkgId);
      if (idx >= 0) allocations[idx] = { ...allocations[idx], qty: allocations[idx].qty + lot.boxQty };
      else allocations.push({ pkgId: lot.pkgId, qty: lot.boxQty });
    }
    cloned.variations[variIdx] = { ...v, stock: newStock as any, stockPkgAllocations: allocations };
  } else {
    Object.entries(lot.sizeBreakdown || {}).forEach(([size, qty]) => {
      newStock[size] = (newStock[size] || 0) + (Number(qty) || 0);
    });
    cloned.variations[variIdx] = { ...v, stock: newStock as any };
  }

  return { productWrite: cloned, lotId: lot.id };
}
