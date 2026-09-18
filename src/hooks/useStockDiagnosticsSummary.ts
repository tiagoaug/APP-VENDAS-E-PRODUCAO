import { useMemo, useState } from 'react';
import { Product, StockLot, ProductionLot, Sale } from '../types';
import { useStockLotDuplicates } from './useStockLotDuplicates';
import { buildSeparationReconcileGroups } from '../utils/separationReconcile';
import { buildOrphanedFinalizedKeyFixes } from '../utils/finalizedKeyRepair';
import { buildUndercreditGroups, UndercreditGroup } from '../utils/stockUndercreditFix';
import { buildOrphanedReservedLots, OrphanedReservedLot, ORPHANED_RESOLVED_STORAGE_KEY, readResolvedOrphanedLotKeys } from '../utils/stockOrphanedReservations';

export const UNDERCREDIT_RESOLVED_KEY = 'pcp_resolved_undercredit_v1';

// Fonte única de verdade das 6 categorias de "Diagnósticos e Correções" — extraído de
// StockDiagnosticsModal pra poder ser consultado de fora do modal (badge/contador nos menus
// de Vendas/PCP/Estoque e alerta no Dashboard), sem duplicar a lógica de detecção nem os
// critérios de "resolvido neste aparelho" (senão o badge e o modal podiam divergir).
export function useStockDiagnosticsSummary(products: Product[], stockLots: StockLot[], lots: ProductionLot[], sales: Sale[]) {
  const { duplicateStockLotGroups, duplicateStockByRefColor, markResolved: markStockDuplicatesResolved } = useStockLotDuplicates(stockLots, lots);

  const separationReconcileGroups = useMemo(() => buildSeparationReconcileGroups(stockLots), [stockLots]);
  const orphanedFinalizedKeyFixes = useMemo(() => buildOrphanedFinalizedKeyFixes(lots), [lots]);
  const allUndercreditGroups = useMemo(() => buildUndercreditGroups(products, stockLots), [products, stockLots]);

  const [undercreditResolved, setUndercreditResolved] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(UNDERCREDIT_RESOLVED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const dismissUndercreditGroup = (g: UndercreditGroup) => {
    setUndercreditResolved(prev => {
      const next = { ...prev, [g.key]: true };
      try { localStorage.setItem(UNDERCREDIT_RESOLVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const undercreditGroups = useMemo(
    () => allUndercreditGroups.filter(g => !undercreditResolved[g.key]),
    [allUndercreditGroups, undercreditResolved]
  );
  // Mesma ideia do dismiss individual (só esconde neste aparelho, não mexe em estoque) — bom
  // como último recurso, mas prefira "Descontar dos Lotes" quando disponível: aquele conserta
  // o dado de verdade (pra todo mundo), esse aqui só maquia a tela de quem clicou.
  const dismissAllUndercreditGroups = () => {
    setUndercreditResolved(prev => {
      const next = { ...prev };
      undercreditGroups.forEach(g => { next[g.key] = true; });
      try { localStorage.setItem(UNDERCREDIT_RESOLVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const allOrphanedLots = useMemo(() => buildOrphanedReservedLots(stockLots, sales, products), [stockLots, sales, products]);
  const [orphanedResolved, setOrphanedResolved] = useState<Record<string, boolean>>(readResolvedOrphanedLotKeys);
  const dismissOrphanedLot = (entry: OrphanedReservedLot) => {
    setOrphanedResolved(prev => {
      const next = { ...prev, [entry.key]: true };
      try { localStorage.setItem(ORPHANED_RESOLVED_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const orphanedLots = useMemo(
    () => allOrphanedLots.filter(e => !orphanedResolved[e.key]),
    [allOrphanedLots, orphanedResolved]
  );

  const pkgAllocIssuesCount = useMemo(() => {
    return products.reduce((count, product) => {
      const hasIssue = product.variations.some((v) => {
        const boxQty = v.stock?.['WHOLESALE'] ?? 0;
        const totalAlloc = (v.stockPkgAllocations || []).reduce((s, a) => s + a.qty, 0);
        return totalAlloc > boxQty;
      });
      return hasIssue ? count + 1 : count;
    }, 0);
  }, [products]);

  const total = pkgAllocIssuesCount + separationReconcileGroups.length + duplicateStockLotGroups.length +
    orphanedFinalizedKeyFixes.length + undercreditGroups.length + orphanedLots.length;

  return {
    total,
    pkgAllocIssuesCount,
    separationReconcileGroups,
    duplicateStockLotGroups, duplicateStockByRefColor, markStockDuplicatesResolved,
    orphanedFinalizedKeyFixes,
    allUndercreditGroups, undercreditGroups, dismissUndercreditGroup, dismissAllUndercreditGroups,
    allOrphanedLots, orphanedLots, dismissOrphanedLot,
  };
}
