import { StockLot } from '../types';

// Fatia de um StockLot original que fica com o pai (remanescente, continua EM_ESTOQUE) —
// campos a escrever de volta no doc original.
export interface StockLotRemainder {
  sizeBreakdown: Record<string, number>;
  totalPairs: number;
  gradeLabel: string;
  boxQty?: number;
  boxIds?: string[];
}

// Fatia consumida de um split — vira um StockLot NOVO (o chamador ainda precisa
// adicionar id/status/saleId/etc antes de salvar; aqui só a composição física).
export interface StockLotConsumedSlice {
  sizeBreakdown: Record<string, number>;
  totalPairs: number;
  gradeLabel: string;
  boxQty?: number;
  boxIds?: string[];
  lineId?: string;
  splitFromLotId: string;
}

export interface StockLotSplitConsumed {
  original: StockLot;
  remainder: StockLotRemainder;
  consumed: StockLotConsumedSlice;
}

export interface StockLotPickPlan {
  // Lotes tomados inteiros — o próprio doc muda de status, sem criar/encolher nada.
  fullyConsumed: StockLot[];
  // Lotes parcialmente tomados — original encolhe pro remanescente, uma fatia nova nasce.
  splitConsumed: StockLotSplitConsumed[];
  // Total efetivamente coberto por StockLots reais (caixas para atacado, pares para varejo).
  totalPicked: number;
  // O que não deu pra cobrir com StockLots (pool insuficiente) — cai no fallback de contador.
  shortfall: number;
}

const buildGradeLabel = (pairs: Record<string, number>): string =>
  Object.entries(pairs)
    .filter(([, q]) => q > 0)
    .map(([sz, q]) => `${sz}x${q}`)
    .join('-');

function sortByCreatedAtAsc(lots: StockLot[]): StockLot[] {
  return [...lots].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Seleciona, em ordem FIFO (mais antigo primeiro), StockLots EM_ESTOQUE de um produto+cor
 * ATACADO suficientes para cobrir `requestedBoxes` caixas. Quando o último lote necessário
 * tem mais caixas do que falta, fatia proporcionalmente (mesmo padrão de fatiamento
 * sequencial de boxIds/sizeBreakdown já usado em buildFractionSourceItem, PCPView.tsx) em
 * vez de tomar o lote inteiro (evitaria separar mais do que o pedido) ou pular pro próximo
 * (fragmentaria o estoque sem necessidade).
 */
export function pickWholesaleStockLots(candidates: StockLot[], requestedBoxes: number): StockLotPickPlan {
  const fullyConsumed: StockLot[] = [];
  const splitConsumed: StockLotSplitConsumed[] = [];
  let remaining = Math.max(0, requestedBoxes);
  let totalPicked = 0;

  for (const lot of sortByCreatedAtAsc(candidates)) {
    if (remaining <= 0) break;
    const boxQty = lot.boxQty || 0;
    if (boxQty <= 0) continue; // sem contagem de caixa confiável — não arrisca consumir

    if (boxQty <= remaining) {
      fullyConsumed.push(lot);
      totalPicked += boxQty;
      remaining -= boxQty;
      continue;
    }

    // Fatia: `remaining` caixas saem deste lote, o resto fica como remanescente.
    const take = remaining;
    const keep = boxQty - take;
    const boxIds = lot.boxIds && lot.boxIds.length === boxQty ? lot.boxIds : undefined;
    const consumedBoxIds = boxIds ? boxIds.slice(0, take) : undefined;
    const remainderBoxIds = boxIds ? boxIds.slice(take) : undefined;

    const consumedPairs: Record<string, number> = {};
    const remainderPairs: Record<string, number> = {};
    Object.entries(lot.sizeBreakdown || {}).forEach(([size, qty]) => {
      const perBox = qty / boxQty;
      const consumedQty = Math.round(perBox * take);
      consumedPairs[size] = consumedQty;
      remainderPairs[size] = Math.max(0, qty - consumedQty);
    });

    splitConsumed.push({
      original: lot,
      remainder: {
        sizeBreakdown: remainderPairs,
        totalPairs: Object.values(remainderPairs).reduce((s, q) => s + q, 0),
        gradeLabel: buildGradeLabel(remainderPairs),
        boxQty: keep,
        boxIds: remainderBoxIds,
      },
      consumed: {
        sizeBreakdown: consumedPairs,
        totalPairs: Object.values(consumedPairs).reduce((s, q) => s + q, 0),
        gradeLabel: buildGradeLabel(consumedPairs),
        boxQty: take,
        boxIds: consumedBoxIds,
        lineId: lot.lineId,
        splitFromLotId: lot.id,
      },
    });
    totalPicked += take;
    remaining = 0;
  }

  return { fullyConsumed, splitConsumed, totalPicked, shortfall: remaining };
}

/**
 * Mesma ideia que `pickWholesaleStockLots`, mas para VAREJO — cobre `requestedPairs` pares
 * de UM tamanho específico. Um StockLot de varejo pode conter vários tamanhos (grade
 * inteira); tomar só um tamanho quase sempre é um split (o lote sobrevive com os tamanhos
 * restantes), exceto quando esse é o único tamanho do lote e é tomado por inteiro — nesse
 * caso degenera para "lote inteiro consumido" (sem criar remanescente vazio).
 */
export function pickRetailStockLots(candidates: StockLot[], size: string, requestedPairs: number): StockLotPickPlan {
  const fullyConsumed: StockLot[] = [];
  const splitConsumed: StockLotSplitConsumed[] = [];
  let remaining = Math.max(0, requestedPairs);
  let totalPicked = 0;

  for (const lot of sortByCreatedAtAsc(candidates)) {
    if (remaining <= 0) break;
    const avail = lot.sizeBreakdown?.[size] || 0;
    if (avail <= 0) continue;

    const take = Math.min(avail, remaining);
    const isWholeLot = take === avail && Object.keys(lot.sizeBreakdown || {}).length === 1;

    if (isWholeLot) {
      fullyConsumed.push(lot);
      totalPicked += take;
      remaining -= take;
      continue;
    }

    const remainderPairs: Record<string, number> = { ...lot.sizeBreakdown };
    remainderPairs[size] = Math.max(0, avail - take);
    if (remainderPairs[size] === 0) delete remainderPairs[size];
    const consumedPairs: Record<string, number> = { [size]: take };

    splitConsumed.push({
      original: lot,
      remainder: {
        sizeBreakdown: remainderPairs,
        totalPairs: Object.values(remainderPairs).reduce((s, q) => s + q, 0),
        gradeLabel: buildGradeLabel(remainderPairs),
      },
      consumed: {
        sizeBreakdown: consumedPairs,
        totalPairs: take,
        gradeLabel: buildGradeLabel(consumedPairs),
        lineId: lot.lineId,
        splitFromLotId: lot.id,
      },
    });
    totalPicked += take;
    remaining -= take;
  }

  return { fullyConsumed, splitConsumed, totalPicked, shortfall: remaining };
}
