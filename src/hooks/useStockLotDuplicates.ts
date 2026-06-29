import { useMemo, useState, useCallback } from 'react';
import { StockLot } from '../types';

export interface DuplicateStockLotGroup {
  key: string;
  lotOrderNumber: string;
  productName: string;
  productReference: string;
  variationName: string;
  gradeLabel: string;
  count: number;
  excessCount: number;
  eachPairs: number;
  eachBoxes: number;
  excessPairs: number;
  excessBoxes: number;
  entries: StockLot[];
}

export interface DuplicateStockByRefColor {
  productReference: string;
  productName: string;
  variationName: string;
  excessBoxes: number;
  excessPairs: number;
  lotOrderNumbers: string[];
  groupKeys: { key: string; count: number }[];
}

const RESOLVED_KEY = 'pcp_resolved_stock_duplicates_v1';

function loadResolved(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RESOLVED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveResolved(map: Record<string, number>) {
  try { localStorage.setItem(RESOLVED_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

// Compartilhado entre PCP e Estoques — agrupa StockLots "EM_ESTOQUE" pela mesma origem
// (lote + pedido de produção + item) e reporta grupos com mais de 1 entrada, isto é,
// baixas duplicadas (mesma produção creditada de novo no estoque por um ciclo de "Dar
// Baixa" repetido). "Resolvido" é guardado por chave+contagem: se o usuário marcar como
// resolvido e DEPOIS aparecer uma nova duplicata pro mesmo lote/pedido/item (contagem
// mudou), o grupo volta a aparecer automaticamente.
export function useStockLotDuplicates(stockLots: StockLot[]) {
  const [resolved, setResolved] = useState<Record<string, number>>(loadResolved);

  const allGroups = useMemo<DuplicateStockLotGroup[]>(() => {
    const groups = new Map<string, StockLot[]>();
    (stockLots || []).forEach(sl => {
      if (sl.status !== 'EM_ESTOQUE') return;
      const key = `${sl.lotId}::${sl.productionOrderId || ''}::${sl.itemIdx ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(sl);
    });
    return Array.from(groups.values())
      .filter(entries => entries.length > 1)
      .map(entries => {
        const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
        const first = sorted[0];
        const excessCount = sorted.length - 1;
        const excessPairs = excessCount * (first.totalPairs || 0);
        const excessBoxes = excessCount * (first.boxQty || 0);
        return {
          key: `${first.lotId}::${first.productionOrderId || ''}::${first.itemIdx ?? ''}`,
          lotOrderNumber: first.lotOrderNumber || '—',
          productName: first.productName,
          productReference: first.productReference || '',
          variationName: first.variationName,
          gradeLabel: first.gradeLabel,
          count: sorted.length,
          excessCount,
          eachPairs: first.totalPairs || 0,
          eachBoxes: first.boxQty || 0,
          excessPairs,
          excessBoxes,
          entries: sorted,
        };
      })
      .sort((a, b) => b.excessCount - a.excessCount);
  }, [stockLots]);

  const duplicateStockLotGroups = useMemo(
    () => allGroups.filter(g => resolved[g.key] !== g.count),
    [allGroups, resolved]
  );

  // Soma o excesso de todos os mapas/pedidos duplicados pela MESMA referência+cor —
  // o número final que importa pra corrigir o estoque (não interessa de quantos mapas
  // diferentes veio a duplicidade, só o total a descontar daquela referência/cor).
  const duplicateStockByRefColor = useMemo<DuplicateStockByRefColor[]>(() => {
    const groups = new Map<string, DuplicateStockByRefColor & { lotOrderNumberSet: Set<string> }>();
    duplicateStockLotGroups.forEach(g => {
      const key = `${g.productReference}::${g.variationName}`;
      let entry = groups.get(key);
      if (!entry) {
        entry = {
          productReference: g.productReference, productName: g.productName, variationName: g.variationName,
          excessBoxes: 0, excessPairs: 0, lotOrderNumbers: [], lotOrderNumberSet: new Set(), groupKeys: [],
        };
        groups.set(key, entry);
      }
      entry.excessBoxes += g.excessBoxes;
      entry.excessPairs += g.excessPairs;
      entry.lotOrderNumberSet.add(g.lotOrderNumber);
      entry.groupKeys.push({ key: g.key, count: g.count });
    });
    return Array.from(groups.values())
      .map(({ lotOrderNumberSet, ...e }) => ({ ...e, lotOrderNumbers: Array.from(lotOrderNumberSet).sort() }))
      .sort((a, b) => (b.excessBoxes + b.excessPairs) - (a.excessBoxes + a.excessPairs));
  }, [duplicateStockLotGroups]);

  const markResolved = useCallback((groupKeys: { key: string; count: number }[]) => {
    setResolved(prev => {
      const next = { ...prev };
      groupKeys.forEach(({ key, count }) => { next[key] = count; });
      saveResolved(next);
      return next;
    });
  }, []);

  return { duplicateStockLotGroups, duplicateStockByRefColor, markResolved };
}
