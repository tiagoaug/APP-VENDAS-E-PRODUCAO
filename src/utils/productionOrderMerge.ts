import { ProductionLot, ProductionOrder, ProductionOrderItem } from '../types';
import { isOrderItemLinkedToLot } from './productionRoute';

export interface MergeProductionOrderItemsResult {
  items: ProductionOrderItem[];
  /** Linhas que o usuário tentou remover no formulário mas já estão em produção (vinculadas
   * a um Mapa) — a posição foi preservada com quantidade zerada em vez de sumir do array,
   * pra não invalidar o `itemIdx` que o Mapa já referencia. Use pra avisar o usuário. */
  keptLinkedRemovals: { productName: string; variationName: string }[];
}

const itemIdentityKey = (it: Pick<ProductionOrderItem, 'productId' | 'variationId' | 'saleType'>) =>
  `${it.productId}::${it.variationId}::${it.saleType}`;

// Soma dois ProductionOrderItem que colidiram na mesma chave produto+cor+modalidade — hoje
// isso acontece quando o formulário tem dois blocos para o mesmo produto/cor (ex.: bloco
// duplicado via "Duplicar" e depois editado), cada um gerando seu próprio push. Sem essa
// soma, um dos dois era descartado em silêncio (o Map ficava só com o último), perdendo
// pares que o usuário via corretamente somados na Compra/Venda mas que nunca chegavam a
// virar produção. `lineId`/`boxIds` são idênticos nos dois lados por construção (mesma
// chave já foi resolvida uma única vez em reconcileLineIds antes de chegar aqui).
const sumProductionOrderItems = (a: ProductionOrderItem, b: ProductionOrderItem): ProductionOrderItem => {
  const sizes: ProductionOrderItem['sizes'] = { ...a.sizes };
  Object.entries(b.sizes).forEach(([sz, s]) => {
    const cur = sizes[sz] || { total: 0, fromStock: 0, toProduction: 0 };
    sizes[sz] = { total: cur.total + s.total, fromStock: cur.fromStock + s.fromStock, toProduction: cur.toProduction + s.toProduction };
  });
  return {
    ...a,
    sizes,
    totalQuantity: a.totalQuantity + b.totalQuantity,
    fromStockQty: a.fromStockQty + b.fromStockQty,
    toProductionQty: a.toProductionQty + b.toProductionQty,
    notes: [a.notes, b.notes].filter(Boolean).join('\n') || undefined,
    lineId: a.lineId || b.lineId,
    boxIds: a.boxIds || b.boxIds,
  };
};

/**
 * Monta o array final de `ProductionOrder.items` ao editar uma Compra/Venda já vinculada a
 * uma OP, preservando a POSIÇÃO original de qualquer item que um Mapa já referencia por
 * `itemIdx`. Editar o pedido (adicionar/remover/reordenar linha no formulário) reconstruía
 * esse array do zero antes — bastava tirar ou adicionar uma linha pra todo índice depois
 * dela deslocar, e um Mapa criado antes da edição passava a apontar pro item errado (ou
 * pra fora do array), perdendo silenciosamente a baixa de estoque/solado dele.
 *
 * Regras:
 *  - Pedido novo (sem `existingOrder`): nenhum Mapa pode referenciar índice ainda — usa a
 *    ordem calculada a partir do formulário sem restrição.
 *  - Item que já existia no pedido E ainda está presente no formulário: mantém a MESMA
 *    posição do array original, só atualiza a quantidade/grade.
 *  - Item que já existia mas o usuário removeu a linha no formulário: se algum Mapa já o
 *    referencia por índice, a posição é preservada com `toProductionQty`/grade zerados
 *    (marca "nada mais a produzir" sem invalidar o índice); se nenhum Mapa o referencia,
 *    é removido normalmente.
 *  - Item novo (não existia no pedido original): entra no final, depois de todos os antigos.
 */
export function mergeProductionOrderItems(
  existingOrder: ProductionOrder | undefined,
  newItemsFromForm: ProductionOrderItem[],
  orderId: string,
  lots: ProductionLot[],
): MergeProductionOrderItemsResult {
  const pending = new Map<string, ProductionOrderItem>();
  newItemsFromForm.forEach(it => {
    const key = itemIdentityKey(it);
    const cur = pending.get(key);
    pending.set(key, cur ? sumProductionOrderItems(cur, it) : it);
  });

  if (!existingOrder) {
    return { items: Array.from(pending.values()), keptLinkedRemovals: [] };
  }

  const items: ProductionOrderItem[] = [];
  const keptLinkedRemovals: { productName: string; variationName: string }[] = [];

  existingOrder.items.forEach((oldItem, idx) => {
    const key = itemIdentityKey(oldItem);
    const match = pending.get(key);
    if (match) {
      // Nunca encolhe boxIds de um item já vinculado a um Mapa — uma caixa que já entrou em
      // produção não pode perder seu ID só porque o formulário foi salvo de novo com uma
      // quantidade menor. A grade/quantidade refletem a redução normalmente; o ID da caixa
      // permanece rastreável (ver "Reparar Caixas" / sourceItemKey em PCPView.tsx).
      if (isOrderItemLinkedToLot(orderId, idx, lots) && (oldItem.boxIds?.length || 0) > (match.boxIds?.length || 0)) {
        items.push({ ...match, boxIds: oldItem.boxIds });
      } else {
        items.push(match);
      }
      pending.delete(key);
      return;
    }
    if (isOrderItemLinkedToLot(orderId, idx, lots)) {
      const zeroedSizes = Object.fromEntries(
        Object.entries(oldItem.sizes || {}).map(([sz, s]) => [sz, { ...s, toProduction: 0 }])
      );
      items.push({ ...oldItem, toProductionQty: 0, sizes: zeroedSizes });
      keptLinkedRemovals.push({ productName: oldItem.productName, variationName: oldItem.variationName });
      return;
    }
    // Não vinculado a nenhum Mapa — seguro remover de verdade.
  });

  pending.forEach(it => items.push(it));

  return { items, keptLinkedRemovals };
}
