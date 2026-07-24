import { useMemo, useState, useCallback } from 'react';
import { ProductionLot, StockLot } from '../types';
import { getSourceItemKey } from '../utils/productionRoute';

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
  // StockLots que a correção realmente apaga — normalmente "todos menos o mais antigo",
  // mas quando dá pra saber quanto a linha de produção pediu de verdade (expectedQty),
  // são só os que sobram ALÉM disso (pode manter mais de 1 legítimo — produção fracionada
  // em vários avanços não é duplicata). Ver comentário em `allGroups` abaixo.
  excessEntries: StockLot[];
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

// Prefere `sourceItemKey` (já resolve lineId/fração quando presentes — ver
// src/utils/productionRoute.ts) sobre a chave antiga baseada só em itemIdx, que colide
// entre frações irmãs do mesmo item (StockLot ainda não guardava fractionLabel).
// Sem `lotId` (StockLot sem produção vinculada, ex.: criado por "Fazer Balanço" — ver
// handleReconcileStockBalance em App.tsx), cai no próprio id: cada entrada de balanço é
// uma correção independente, nunca "o mesmo crédito duplicado", e sem essa saída TODAS as
// entradas de balanço do sistema (de produtos/cores diferentes) cairiam na mesma chave
// vazia (`::undefined`) e seriam sinalizadas como duplicatas umas das outras.
const dupGroupKey = (sl: StockLot) => sl.sourceItemKey || (sl.lotId ? `${sl.lotId}::${sl.productionOrderId || ''}::${sl.itemIdx ?? ''}` : sl.id);

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
// (lote + pedido de produção + item) e reporta grupos com excesso real, isto é, baixas
// duplicadas (mesma produção creditada de novo no estoque por um ciclo de "Dar Baixa"
// repetido). "Resolvido" é guardado por chave+contagem: se o usuário marcar como resolvido
// e DEPOIS aparecer uma nova duplicata pro mesmo lote/pedido/item (contagem mudou), o grupo
// volta a aparecer automaticamente.
//
// `lots` (opcional) permite saber quanto CADA linha de produção pediu de verdade
// (`sourceItem.qty`, resolvido pela mesma `getSourceItemKey` usada em toda a base) — mais
// de 1 StockLot na mesma origem deixa de ser automaticamente "duplicata": só é excesso o
// que ultrapassa esse total esperado. Sem isso, produção fracionada em vários avanços
// legítimos (confirmado no caso Preto/T599 nesta sessão) era confundida com duplicidade.
// Quando o Mapa/pedido original foi editado ou excluído, o total esperado some do mapa e
// o grupo cai no comportamento antigo (mantém só o mais antigo) — sem essa informação não
// tem como saber quanto era o esperado, então não dá pra fazer melhor do que isso.
export function useStockLotDuplicates(stockLots: StockLot[], lots: ProductionLot[] = []) {
  const [resolved, setResolved] = useState<Record<string, number>>(loadResolved);

  const expectedQtyByKey = useMemo(() => {
    const map = new Map<string, number>();
    (lots || []).forEach(lot => {
      const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
      sourceItems.forEach((si: any) => {
        const key = getSourceItemKey(si);
        map.set(key, (map.get(key) || 0) + (Number(si.qty) || 0));
      });
    });
    return map;
  }, [lots]);

  const allGroups = useMemo<DuplicateStockLotGroup[]>(() => {
    const groups = new Map<string, StockLot[]>();
    (stockLots || []).forEach(sl => {
      if (sl.status !== 'EM_ESTOQUE') return;
      const key = dupGroupKey(sl);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(sl);
    });
    return Array.from(groups.values())
      .filter(entries => entries.length > 1)
      .map(entries => {
        const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
        const first = sorted[0];
        const expectedQty = expectedQtyByKey.get(dupGroupKey(first));

        // Sem quantidade esperada conhecida: comportamento de sempre (mantém só o mais
        // antigo). Com ela: acumula do mais antigo pro mais novo até bater o total pedido
        // pela linha de produção — só o que sobra depois disso é excesso de verdade.
        const kept: StockLot[] = [];
        const excessEntries: StockLot[] = [];
        let cumulative = 0;
        sorted.forEach(e => {
          if (expectedQty === undefined) {
            if (kept.length === 0) { kept.push(e); return; }
            excessEntries.push(e);
            return;
          }
          if (cumulative + (e.totalPairs || 0) <= expectedQty) {
            kept.push(e);
            cumulative += e.totalPairs || 0;
          } else {
            excessEntries.push(e);
          }
        });
        if (excessEntries.length === 0) return null;

        const excessCount = excessEntries.length;
        // Soma o tamanho REAL de cada excedente — não pressupõe que todos os excedentes
        // têm o mesmo tamanho do primeiro (mais antigo), o que sub/superestimava o total
        // quando um excedente vinha de um split parcial (ex.: 1 cx) e o mantido era o lote
        // cheio original (ex.: 5 cx) — mostrava "5 cx a descontar" quando o certo era 1.
        const excessPairs = excessEntries.reduce((s, e) => s + (e.totalPairs || 0), 0);
        const excessBoxes = excessEntries.reduce((s, e) => s + (e.boxQty || 0), 0);
        return {
          key: dupGroupKey(first),
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
          excessEntries,
        };
      })
      .filter((g): g is DuplicateStockLotGroup => g !== null)
      .sort((a, b) => b.excessCount - a.excessCount);
  }, [stockLots, expectedQtyByKey]);

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
