import { ProductionLot, Product, Variation, SoleStockEntry, PurchaseRequest, Purchase, SolePurchaseItem } from '../types';
import { getActiveProductionUnits } from './productionRoute';

export type SoleReservation = {
  moldId: string;
  colorId: string; // '' = sem soleColorId (bucket 'default')
  reservedByGrade: Record<string, number>; // gradeKey -> total de pares reservados
};

export type SoleReservationsMap = Record<string, SoleReservation>; // key = `${moldId}_${colorId || 'default'}`

export type SoleConsumption = {
  moldId: string;
  colorId: string; // '' = sem soleColorId (bucket 'default')
  gradeQuantities: Record<string, number>; // gradeKey -> pares consumidos
};

// Resolve, para um produto/variação + grade de pares (cabedal), quantos pares de
// sola são consumidos por molde/cor/numeração (grade do soleStock). Usado tanto
// para calcular reservas de mapas ativos (computeSoleMapaReservations) quanto para
// dar baixa real no estoque de solados quando um pedido conclui na Expedição.
export function resolveSoleConsumption(
  product: Product,
  variation: Variation,
  pairs: Record<string, number>,
  unitQty: number,
  soleStock: SoleStockEntry[]
): SoleConsumption | null {
  const resolvedMoldId = String(product.moldId || '').trim();
  if (!resolvedMoldId) return null;

  const stockEntries = soleStock.filter(s => String(s.moldId).trim() === resolvedMoldId);
  const hasStockEntries = stockEntries.length > 0;
  const sizeToGrade: Record<string, string> = {};
  stockEntries.forEach(entry => {
    Object.keys(entry.stock).forEach(k => {
      const key = String(k).trim();
      if (key === 'pesagem' || key === 'total') return;
      const parts = key.split('-').map(p => Math.round(parseFloat(p.trim())));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        for (let i = parts[0]; i <= parts[1]; i++) {
          sizeToGrade[String(i)] = key;
        }
        sizeToGrade[key] = key;
      } else {
        sizeToGrade[key] = key;
      }
    });
  });
  const getGradeForSize = (size: string): string | null => {
    if (sizeToGrade[size]) return sizeToGrade[size];
    if (hasStockEntries) return null;
    return size;
  };

  const variationMapping: Record<string, string> | null =
    (variation.soleMapping && Object.keys(variation.soleMapping).length > 0) ? variation.soleMapping : null;
  const productMapping: Record<string, string> | null =
    (product.soleMapping && Object.keys(product.soleMapping).length > 0) ? product.soleMapping : null;

  const isMappingUsable = (m: Record<string, string> | null) =>
    !!m && Object.values(m).some(v => getGradeForSize(String(v).trim()));

  let sizeMapping: Record<string, string> | null = null;
  if (isMappingUsable(variationMapping)) {
    sizeMapping = variationMapping;
  } else if (isMappingUsable(productMapping)) {
    sizeMapping = productMapping;
  }

  const effectivePairs: Record<string, number> = { ...(pairs || {}) };
  if (Object.keys(effectivePairs).length === 0 && unitQty > 0) {
    let sizesToMap: string[];
    if (sizeMapping) {
      sizesToMap = Object.keys(sizeMapping);
    } else {
      const validSizes = new Set<string>();
      stockEntries.forEach(e => {
        Object.keys(e.stock).forEach(k => {
          const key = String(k).trim();
          if (key === 'pesagem' || key === 'total') return;
          const parts = key.split('-').map(p => Math.round(parseFloat(p.trim())));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            for (let n = parts[0]; n <= parts[1]; n++) validSizes.add(String(n));
          } else if (parts.length === 1 && !isNaN(parts[0])) {
            validSizes.add(key);
          }
        });
      });
      sizesToMap = Array.from(validSizes);
    }

    if (sizesToMap.length > 0) {
      const qtyPerSize = Math.floor(unitQty / sizesToMap.length);
      const remainder = unitQty % sizesToMap.length;
      sizesToMap.forEach((size, idx) => {
        effectivePairs[size] = qtyPerSize + (idx < remainder ? 1 : 0);
      });
    }
  }

  const colorId = String(variation.soleColorId || '').trim();
  const gradeQuantities: Record<string, number> = {};
  Object.entries(effectivePairs).forEach(([cabedalSize, qty]) => {
    if (qty <= 0) return;
    const soleSize = (sizeMapping?.[cabedalSize] ? String(sizeMapping[cabedalSize]).trim() : '') || cabedalSize;
    const gradeKey = getGradeForSize(soleSize);
    if (!gradeKey) return;
    gradeQuantities[gradeKey] = (gradeQuantities[gradeKey] || 0) + qty;
  });

  return { moldId: resolvedMoldId, colorId, gradeQuantities };
}

// Subconjunto SOLE/LOTS de PCPView.buildPurchaseNeeds (src/views/PCPView.tsx, linhas ~252, ~409-756):
// calcula apenas a quantidade de pares de sola já reservada pelos mapas de produção ativos,
// por molde + cor + grade de numeração, sem considerar materiais ou pedidos pendentes.
// A varredura de "quanto falta produzir por Mapa ativo" vem de `getActiveProductionUnits`
// (fonte única compartilhada com computePalmilhaMapaReservations e PCPView.buildPurchaseNeeds).
export function computeSoleMapaReservations(
  lots: ProductionLot[],
  products: Product[],
  soleStock: SoleStockEntry[]
): SoleReservationsMap {
  const units = getActiveProductionUnits(lots);

  const result: SoleReservationsMap = {};

  units.forEach(({ productId, variationId, pairs: groupPairs, quantity: unitQty }) => {
    const groupProduct = products.find(p => p.id === productId);
    const variation = groupProduct?.variations.find(v => v.id === variationId);
    if (!groupProduct || !variation) return;

    const consumption = resolveSoleConsumption(groupProduct, variation, groupPairs, unitQty, soleStock);
    if (!consumption) return;

    const key = `${consumption.moldId}_${consumption.colorId || 'default'}`;
    if (!result[key]) {
      result[key] = { moldId: consumption.moldId, colorId: consumption.colorId, reservedByGrade: {} };
    }
    Object.entries(consumption.gradeQuantities).forEach(([gradeKey, qty]) => {
      result[key].reservedByGrade[gradeKey] = (result[key].reservedByGrade[gradeKey] || 0) + qty;
    });
  });

  return result;
}

export type SolePendingOrderSource = {
  id: string;
  label: string; // ex.: "Pedido de compra - 10/06/2026"
  qty: number;
};

export type SolePendingOrder = {
  moldId: string;
  colorId: string; // '' = sem soleColorId (bucket 'default')
  pendingByGrade: Record<string, number>; // gradeKey -> quantidade de pares já comprados e ainda não recebidos
  sourcesByGrade: Record<string, SolePendingOrderSource[]>; // gradeKey -> origens que compõem o total
};

export type SolePendingOrdersMap = Record<string, SolePendingOrder>; // key = `${moldId}_${colorId || 'default'}`

const addPending = (result: SolePendingOrdersMap, moldId: string, colorId: string, size: string, qty: number, source: { id: string; label: string }) => {
  const mId = String(moldId || '').trim();
  if (!mId || qty <= 0) return;
  const cId = String(colorId || '').trim();
  const sz = String(size || '').trim();
  if (!sz) return;
  const key = `${mId}_${cId || 'default'}`;
  if (!result[key]) result[key] = { moldId: mId, colorId: cId, pendingByGrade: {}, sourcesByGrade: {} };
  result[key].pendingByGrade[sz] = (result[key].pendingByGrade[sz] || 0) + qty;
  if (!result[key].sourcesByGrade[sz]) result[key].sourcesByGrade[sz] = [];
  result[key].sourcesByGrade[sz].push({ id: source.id, label: source.label, qty });
};

// SolePurchaseModal salva a compra com type: PurchaseType.REPLENISHMENT e os itens de sola
// dentro do campo genérico `items` (não `soleItems`) — ver App.tsx handleSaveSolePurchase
// (`purchaseToSave = { ...purchase, items: soleItems }`). Por isso identificamos os itens de
// sola pelo formato (moldId + quantities), em `items` OU `soleItems`, independente de `type`.
const extractSoleItems = (p: Purchase): SolePurchaseItem[] => {
  const candidates = [...(p.soleItems || []), ...((p.items as unknown as SolePurchaseItem[]) || [])];
  return candidates.filter((it): it is SolePurchaseItem =>
    !!it && typeof (it as any).moldId === 'string' && (it as any).moldId.length > 0 && !!(it as any).quantities
  );
};

// Soma, por molde + cor + grade de numeração, as quantidades de solas já compradas e ainda
// não recebidas no estoque, a partir das Purchase com itens de sola (moldId + quantities) e
// registerAsReceived !== true (compra registrada, mas ainda não deu entrada no estoque — ex.:
// pedidos formulados direto do Estoque de Solados ou via Compras > Solados).
//
// PurchaseRequest do tipo SOLE com status 'ORDERED' ("Pedido Feito") NÃO entram nessa soma:
// esse status indica que o pedido já foi colocado, e o pedido em si é representado por uma
// Purchase (fonte acima). Somar os dois contaria o mesmo pedido em dobro, já que marcar a
// necessidade como "Pedido Feito" não cria automaticamente uma Purchase vinculada.
export function computeSolePendingOrders(purchaseRequests: PurchaseRequest[], purchases: Purchase[]): SolePendingOrdersMap {
  const result: SolePendingOrdersMap = {};

  purchases
    .filter(p => p.registerAsReceived !== true)
    .forEach(p => {
      const dateLabel = p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '';
      extractSoleItems(p).forEach(item => {
        Object.entries(item.quantities || {}).forEach(([size, qty]) => {
          addPending(result, item.moldId, item.colorId || '', size, Number(qty) || 0, {
            id: p.id,
            label: `Pedido de compra${dateLabel ? ` - ${dateLabel}` : ''}`
          });
        });
      });
    });

  return result;
}
