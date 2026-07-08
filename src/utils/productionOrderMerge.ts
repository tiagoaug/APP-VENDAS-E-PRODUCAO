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
  if (!existingOrder) {
    return { items: newItemsFromForm, keptLinkedRemovals: [] };
  }

  const pending = new Map<string, ProductionOrderItem>();
  newItemsFromForm.forEach(it => pending.set(itemIdentityKey(it), it));

  const items: ProductionOrderItem[] = [];
  const keptLinkedRemovals: { productName: string; variationName: string }[] = [];

  existingOrder.items.forEach((oldItem, idx) => {
    const key = itemIdentityKey(oldItem);
    const match = pending.get(key);
    if (match) {
      items.push(match);
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
