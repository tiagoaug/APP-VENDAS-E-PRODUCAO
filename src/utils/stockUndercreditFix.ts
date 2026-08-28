import { Product, StockLot } from '../types';
import { pickWholesaleStockLots } from './stockLotPicker';

// Detecta produção que creditou um StockLot (status EM_ESTOQUE — prova de que a caixa/par
// existe fisicamente, com Mapa/OP registrados) mas cujo contador agregado do produto
// (variation.stock) nunca somou aquele crédito — bug antigo de gravação não-atômica em
// applyExpedicaoStockUpdate (já corrigido pra não acontecer mais, ver PCPView.tsx), mas que
// deixou estoque real "escondido" em muitos produtos/cores. Diferente da duplicidade
// (useStockLotDuplicates, que SUBTRAI o excesso), aqui a correção é sempre aditiva — por
// isso não precisa de estado "resolvido": assim que o contador alcança a soma dos StockLots,
// a discrepância some sozinha do cálculo.
export interface UndercreditGroup {
  key: string;
  productId: string;
  productName: string;
  productReference: string;
  variationId: string;
  variationName: string;
  isWholesale: boolean;
  missingBoxes?: number;
  missingSizes?: Record<string, number>;
  lots: StockLot[];
}

export function buildUndercreditGroups(products: Product[], stockLots: StockLot[]): UndercreditGroup[] {
  const byKey = new Map<string, StockLot[]>();
  (stockLots || []).forEach(sl => {
    if (sl.status !== 'EM_ESTOQUE') return;
    const key = `${sl.productId}::${sl.variationId}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(sl);
  });

  const groups: UndercreditGroup[] = [];
  for (const [key, lots] of byKey.entries()) {
    const [productId, variationId] = key.split('::');
    const product = products.find(p => p.id === productId);
    const variation = product?.variations.find(v => v.id === variationId);
    if (!product || !variation) continue;

    const wholesaleLots = lots.filter(l => l.boxQty !== undefined && l.boxQty !== null);
    const retailLots = lots.filter(l => l.boxQty === undefined || l.boxQty === null);

    if (wholesaleLots.length > 0) {
      const sum = wholesaleLots.reduce((s, l) => s + (l.boxQty || 0), 0);
      const actual = (variation.stock as any)?.WHOLESALE || 0;
      if (actual < sum) {
        groups.push({
          key: `${key}::wholesale`, productId, productName: product.name, productReference: product.reference,
          variationId, variationName: variation.colorName, isWholesale: true,
          missingBoxes: sum - actual, lots: wholesaleLots,
        });
      }
    }

    if (retailLots.length > 0) {
      const sizeSum: Record<string, number> = {};
      retailLots.forEach(l => {
        Object.entries(l.sizeBreakdown || {}).forEach(([size, qty]) => {
          sizeSum[size] = (sizeSum[size] || 0) + (Number(qty) || 0);
        });
      });
      const missingSizes: Record<string, number> = {};
      Object.entries(sizeSum).forEach(([size, expected]) => {
        const actual = (variation.stock as any)?.[size] || 0;
        if (actual < expected) missingSizes[size] = expected - actual;
      });
      if (Object.keys(missingSizes).length > 0) {
        groups.push({
          key: `${key}::retail`, productId, productName: product.name, productReference: product.reference,
          variationId, variationName: variation.colorName, isWholesale: false,
          missingSizes, lots: retailLots,
        });
      }
    }
  }
  return groups.sort((a, b) =>
    (b.missingBoxes || Object.values(b.missingSizes || {}).reduce((s, q) => s + q, 0)) -
    (a.missingBoxes || Object.values(a.missingSizes || {}).reduce((s, q) => s + q, 0))
  );
}

export interface UndercreditFixPlan {
  productWrite: Product | null;
}

// Soma a diferença faltante no contador (nunca subtrai). Pra Atacado, reconstrói
// stockPkgAllocations distribuindo exatamente `missingBoxes` entre os pkgId dos lotes
// envolvidos (do mais antigo pro mais novo, até fechar a conta) — garante que a soma das
// alocações sobe pelo MESMO tanto que o contador, mesmo que algum lote do grupo já
// estivesse parcialmente refletido nas alocações antes desta correção.
export function buildUndercreditFixPlan(group: UndercreditGroup, products: Product[]): UndercreditFixPlan {
  const product = products.find(p => p.id === group.productId);
  if (!product) return { productWrite: null };
  const cloned: Product = JSON.parse(JSON.stringify(product));
  const variIdx = cloned.variations.findIndex(v => v.id === group.variationId);
  if (variIdx < 0) return { productWrite: null };
  const v = cloned.variations[variIdx];
  const newStock: Record<string, number> = { ...(v.stock as any) };

  if (group.isWholesale && group.missingBoxes) {
    newStock['WHOLESALE'] = (newStock['WHOLESALE'] || 0) + group.missingBoxes;

    const allocations = [...(v.stockPkgAllocations || [])];
    let remaining = group.missingBoxes;
    const sortedLots = [...group.lots].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    for (const lot of sortedLots) {
      if (remaining <= 0) break;
      if (!lot.pkgId || !lot.boxQty) continue;
      const add = Math.min(remaining, lot.boxQty);
      const idx = allocations.findIndex(a => a.pkgId === lot.pkgId);
      if (idx >= 0) allocations[idx] = { ...allocations[idx], qty: allocations[idx].qty + add };
      else allocations.push({ pkgId: lot.pkgId, qty: add });
      remaining -= add;
    }
    cloned.variations[variIdx] = { ...v, stock: newStock as any, stockPkgAllocations: allocations };
  } else if (group.missingSizes) {
    Object.entries(group.missingSizes).forEach(([size, qty]) => {
      newStock[size] = (newStock[size] || 0) + qty;
    });
    cloned.variations[variIdx] = { ...v, stock: newStock as any };
  }

  return { productWrite: cloned };
}

export interface UndercreditTrimPlan {
  // id do StockLot -> campos novos a gravar (lote sobrevive, só encolhe).
  stockLotWrites: Record<string, { sizeBreakdown: Record<string, number>; totalPairs: number; gradeLabel: string; boxQty?: number; boxIds?: string[] }>;
  // ids de StockLot que zeraram por completo — apagar.
  stockLotDeleteIds: string[];
}

const buildGradeLabelFromSizes = (pairs: Record<string, number>): string =>
  Object.entries(pairs).filter(([, q]) => q > 0).map(([sz, q]) => `${sz}x${q}`).join('-');

// Contra-parte de buildUndercreditFixPlan: em vez de somar a diferença no contador do
// produto (pra quando a produção de fato nunca foi creditada), aqui a gente assume o
// contrário — o contador já está certo e sobrou StockLot "fantasma" (residual do bug antigo
// de gravação não-atômica, já corrigido, que não chegou a ser limpo na época). Desconta o
// excesso direto dos StockLots (mais antigos primeiro), igual ao Diagnóstico de Estoque
// Duplicado — nunca toca em `products`/`variation.stock`.
export function buildUndercreditTrimPlan(group: UndercreditGroup): UndercreditTrimPlan {
  const stockLotWrites: UndercreditTrimPlan['stockLotWrites'] = {};
  const stockLotDeleteIds: string[] = [];

  if (group.isWholesale) {
    const plan = pickWholesaleStockLots(group.lots, group.missingBoxes || 0);
    plan.fullyConsumed.forEach(lot => stockLotDeleteIds.push(lot.id));
    plan.splitConsumed.forEach(({ original, remainder }) => {
      stockLotWrites[original.id] = {
        sizeBreakdown: remainder.sizeBreakdown, totalPairs: remainder.totalPairs,
        gradeLabel: remainder.gradeLabel, boxQty: remainder.boxQty, boxIds: remainder.boxIds,
      };
    });
    return { stockLotWrites, stockLotDeleteIds };
  }

  // Varejo: uma grade cheia (StockLot) pode ter várias numerações — processa uma numeração
  // de cada vez sobre uma cópia local da composição de cada lote, senão a segunda numeração
  // sobrescreveria o corte já feito pela primeira no mesmo doc.
  const working = new Map<string, { sizeBreakdown: Record<string, number>; createdAt: number }>();
  group.lots.forEach(l => working.set(l.id, { sizeBreakdown: { ...(l.sizeBreakdown || {}) }, createdAt: l.createdAt || 0 }));

  Object.entries(group.missingSizes || {}).forEach(([size, amount]) => {
    let remaining = amount;
    const candidates = Array.from(working.entries())
      .filter(([, w]) => (w.sizeBreakdown[size] || 0) > 0)
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    for (const [, w] of candidates) {
      if (remaining <= 0) break;
      const avail = w.sizeBreakdown[size] || 0;
      const take = Math.min(avail, remaining);
      w.sizeBreakdown[size] = avail - take;
      if (w.sizeBreakdown[size] <= 0) delete w.sizeBreakdown[size];
      remaining -= take;
    }
  });

  group.lots.forEach(original => {
    const w = working.get(original.id);
    if (!w) return;
    const totalLeft = Object.values(w.sizeBreakdown).reduce((s, q) => s + (q || 0), 0);
    if (totalLeft <= 0) { stockLotDeleteIds.push(original.id); return; }
    if (JSON.stringify(original.sizeBreakdown || {}) !== JSON.stringify(w.sizeBreakdown)) {
      stockLotWrites[original.id] = {
        sizeBreakdown: w.sizeBreakdown, totalPairs: totalLeft,
        gradeLabel: buildGradeLabelFromSizes(w.sizeBreakdown),
      };
    }
  });

  return { stockLotWrites, stockLotDeleteIds };
}
