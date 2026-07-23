import { ProductionLot } from '../types';
import { getSourceItemKey } from './productionRoute';

export interface OrphanedFinalizedKeyFix {
  lotId: string;
  orderSectors: Record<string, string>;
  fixedCount: number;
}

/**
 * Repara o efeito colateral do backfill "Atribuir ID de rastreio": adicionar `lineId` a um
 * sourceItem que já tinha uma marcação em `metadata.orderSectors` (ex.: ORDER_FINALIZED)
 * gravada sob a chave ANTIGA (orderId::itemIdx) fazia essa marcação ficar órfã, porque
 * `getSourceItemKey` passa a preferir `lineId` assim que ele existe — o item "perdia" o
 * status de finalizado e reaparecia como se ainda estivesse em produção, mesmo já tendo
 * creditado estoque. Reconstrói a chave antiga de cada sourceItem com `lineId` e migra a
 * marcação órfã (se existir) pra chave nova, sem mexer em estoque algum.
 *
 * Função pura — só calcula o que precisa mudar por Mapa; quem chama aplica os writes.
 * Idempotente: um Mapa já corrigido não aparece de novo no resultado.
 */
export function buildOrphanedFinalizedKeyFixes(lots: ProductionLot[]): OrphanedFinalizedKeyFix[] {
  const fixes: OrphanedFinalizedKeyFix[] = [];
  for (const lot of lots) {
    const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
    if (sourceItems.length === 0) continue;
    const orderSectors: Record<string, string> = { ...(lot as any).metadata?.orderSectors };
    let fixedCount = 0;
    sourceItems.forEach((si: any) => {
      if (!si.lineId) return;
      const oldBase = si.itemIdx !== undefined
        ? `${si.orderId}::${si.itemIdx}`
        : `${si.orderId}::${si.productId || ''}-${si.variationId || ''}`;
      const oldKey = si.fractionLabel ? `${oldBase}::frac-${si.fractionLabel}` : oldBase;
      const newKey = getSourceItemKey(si);
      if (oldKey === newKey) return;
      if (orderSectors[oldKey] !== undefined && orderSectors[newKey] === undefined) {
        orderSectors[newKey] = orderSectors[oldKey];
        delete orderSectors[oldKey];
        fixedCount++;
      }
    });
    if (fixedCount > 0) {
      fixes.push({ lotId: lot.id, orderSectors, fixedCount });
    }
  }
  return fixes;
}
