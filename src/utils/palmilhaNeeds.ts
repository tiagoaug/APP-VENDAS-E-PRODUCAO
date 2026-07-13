import { ProductionLot, Product, ProductionConfigItem, PalmilhaStockEntry, PurchaseRequest, Purchase, PalmilhaPurchaseItem } from '../types';
import { getActiveProductionUnits } from './productionRoute';

export type PalmilhaReservation = {
  toolId: string;
  toolName: string;
  subtype: 'MONTAGEM' | 'ACABAMENTO';
  colorId: string; // '' = sem cor (bucket 'default')
  reservedByGrade: Record<string, number>; // grade (tamanho da faca) -> total de pares reservados
  silkCostPerPair?: number; // custo do serviço de SILK (ACABAMENTO), de cons.services
};

export type PalmilhaReservationsMap = Record<string, PalmilhaReservation>; // key = `${toolId}_${colorId || 'default'}`

// Mirror de computeSoleMapaReservations (src/utils/soleNeeds.ts), porém mais simples: a grade de
// estoque da palmilha é sempre o tamanho exato da faca (sem parsing de faixas "38-39"), mapeado
// via ComponentConsumption.toolMapping (já existente, usado hoje só pelo EngineeringEditor).
// A varredura de "quanto falta produzir por Mapa ativo" vem de `getActiveProductionUnits`
// (fonte única compartilhada com computeSoleMapaReservations e PCPView.buildPurchaseNeeds).
export function computePalmilhaMapaReservations(
  lots: ProductionLot[],
  products: Product[],
  productionConfigs: ProductionConfigItem[],
  palmilhaStock: PalmilhaStockEntry[]
): PalmilhaReservationsMap {
  const units = getActiveProductionUnits(lots);

  const result: PalmilhaReservationsMap = {};

  units.forEach(({ productId, variationId, pairs }) => {
    const product = products.find(p => p.id === productId);
    const variation = product?.variations.find(v => v.id === variationId);
    if (!variation) return;

    (variation.consumptions || []).forEach(cons => {
      if (!cons.toolId) return;
      const tool = productionConfigs.find(c => c.id === cons.toolId && c.type === 'TOOL' && c.metadata?.palmilha);
      if (!tool?.metadata?.palmilha) return;

      const colorId = cons.ignoreColor ? '' : String(cons.colorId || '').trim();
      const key = `${tool.id}_${colorId || 'default'}`;
      if (!result[key]) {
        const silkCostPerPair = tool.metadata.palmilha.subtype === 'ACABAMENTO'
          ? (cons.services || []).reduce((sum, s) => sum + (Number(s.cost) || 0), 0)
          : undefined;
        result[key] = { toolId: tool.id, toolName: tool.name, subtype: tool.metadata.palmilha.subtype, colorId, reservedByGrade: {}, silkCostPerPair };
      }

      Object.entries(pairs).forEach(([size, qty]) => {
        const n = Number(qty) || 0;
        if (n <= 0) return;
        const grade = cons.toolMapping?.[size] || size;
        result[key].reservedByGrade[grade] = (result[key].reservedByGrade[grade] || 0) + n;
      });
    });
  });

  return result;
}

export type PalmilhaPendingOrderSource = {
  id: string;
  label: string; // ex.: "Pedido de compra - 10/06/2026"
  qty: number;
};

export type PalmilhaPendingOrder = {
  toolId: string;
  colorId: string; // '' = sem cor (bucket 'default')
  pendingByGrade: Record<string, number>; // grade -> quantidade de pares já comprados e ainda não recebidos
  sourcesByGrade: Record<string, PalmilhaPendingOrderSource[]>; // grade -> origens que compõem o total
};

export type PalmilhaPendingOrdersMap = Record<string, PalmilhaPendingOrder>; // key = `${toolId}_${colorId || 'default'}`

const addPending = (result: PalmilhaPendingOrdersMap, toolId: string, colorId: string, grade: string, qty: number, source: { id: string; label: string }) => {
  const tId = String(toolId || '').trim();
  if (!tId || qty <= 0) return;
  const cId = String(colorId || '').trim();
  const g = String(grade || '').trim();
  if (!g) return;
  const key = `${tId}_${cId || 'default'}`;
  if (!result[key]) result[key] = { toolId: tId, colorId: cId, pendingByGrade: {}, sourcesByGrade: {} };
  result[key].pendingByGrade[g] = (result[key].pendingByGrade[g] || 0) + qty;
  if (!result[key].sourcesByGrade[g]) result[key].sourcesByGrade[g] = [];
  result[key].sourcesByGrade[g].push({ id: source.id, label: source.label, qty });
};

// Mirror de extractSoleItems: itens de palmilha podem vir em `palmilhaItems` ou no campo
// genérico `items`, identificados pelo formato (toolId + quantities).
const extractPalmilhaItems = (p: Purchase): PalmilhaPurchaseItem[] => {
  const candidates = [...(p.palmilhaItems || []), ...((p.items as unknown as PalmilhaPurchaseItem[]) || [])];
  return candidates.filter((it): it is PalmilhaPurchaseItem =>
    !!it && typeof (it as any).toolId === 'string' && (it as any).toolId.length > 0 && !!(it as any).quantities
  );
};

// Mirror de computeSolePendingOrders: soma, por faca + cor + grade, as quantidades de palmilhas
// já compradas/produzidas e ainda não recebidas no estoque (registerAsReceived !== true).
export function computePalmilhaPendingOrders(purchaseRequests: PurchaseRequest[], purchases: Purchase[]): PalmilhaPendingOrdersMap {
  const result: PalmilhaPendingOrdersMap = {};

  purchases
    .filter(p => p.registerAsReceived !== true)
    .forEach(p => {
      const dateLabel = p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '';
      extractPalmilhaItems(p).forEach(item => {
        Object.entries(item.quantities || {}).forEach(([grade, qty]) => {
          addPending(result, item.toolId, item.colorId || '', grade, Number(qty) || 0, {
            id: p.id,
            label: `Pedido de compra${dateLabel ? ` - ${dateLabel}` : ''}`
          });
        });
      });
    });

  return result;
}
