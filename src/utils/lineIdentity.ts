import { SaleType } from '../types';
import { generateId } from './id';

export interface LineIdentityOldItem {
  productId: string;
  variationId: string;
  saleType?: SaleType;
  lineId?: string;
  boxIds?: string[];
}

export interface LineIdentityNewKey {
  productId: string;
  variationId: string;
  saleType?: SaleType;
  boxCount: number;
}

export interface LineIdentityResult {
  lineId: string;
  boxIds?: string[];
}

const lineKey = (it: { productId: string; variationId: string; saleType?: SaleType }) =>
  `${it.productId}::${it.variationId}::${it.saleType || ''}`;

/**
 * Reconcilia `lineId`/`boxIds` entre o que já existia salvo (`oldItems`, do pedido antes da
 * edição) e as linhas que o formulário está prestes a salvar (`newKeys`). Compras/Vendas
 * reconstroem seus itens do zero a partir do estado local a cada save — gerar um ID novo
 * direto no loop de push criaria um ID diferente a cada vez, órfão de qualquer Mapa que já
 * referencie o ID anterior. Esta função garante que a MESMA linha lógica (mesmo
 * productId+variationId+saleType) mantenha o mesmo `lineId`/`boxIds` entre edições, só
 * gerando IDs novos para linhas genuinamente novas ou para caixas adicionadas a uma linha
 * existente (boxIds só cresce aqui — truncar com segurança exige saber se a caixa já está
 * vinculada a um Mapa, o que só `mergeProductionOrderItems` sabe).
 */
export function reconcileLineIds(
  oldItems: LineIdentityOldItem[] | undefined,
  newKeys: LineIdentityNewKey[],
): Map<string, LineIdentityResult> {
  const byKey = new Map<string, LineIdentityOldItem>();
  (oldItems || []).forEach(it => {
    if (!it.lineId) return;
    const key = lineKey(it);
    if (!byKey.has(key)) byKey.set(key, it);
  });

  const result = new Map<string, LineIdentityResult>();
  newKeys.forEach(nk => {
    const key = lineKey(nk);
    if (result.has(key)) return; // já resolvido (múltiplas linhas de varejo por tamanho compartilham a chave)
    const old = byKey.get(key);
    const isWholesale = nk.saleType === SaleType.WHOLESALE;
    if (old) {
      let boxIds = isWholesale ? [...(old.boxIds || [])] : undefined;
      if (isWholesale && boxIds && nk.boxCount > boxIds.length) {
        const missing = nk.boxCount - boxIds.length;
        for (let i = 0; i < missing; i++) boxIds.push(generateId());
      }
      result.set(key, { lineId: old.lineId!, boxIds });
    } else {
      result.set(key, {
        lineId: generateId(),
        boxIds: isWholesale ? Array.from({ length: Math.max(0, nk.boxCount) }, () => generateId()) : undefined,
      });
    }
  });
  return result;
}
