import { Product, ProductionLot, ProductionOrder, Sale, Sector, ServiceOrder } from '../types';

export type SectorAdvanceResult = {
  /** Index in `route` the lot should move to. */
  nextIndex: number;
  /** True when there is no further active sector — the lot is finished. */
  isFinished: boolean;
  /** Names of sectors skipped because they aren't part of the product's registered route. */
  skippedSectorNames: string[];
};

/**
 * Finds the next sector after `fromIndex` in `route` that is still part of the
 * product's currently registered production route (`product.productionRoute`).
 *
 * Lots keep a frozen copy of the route from when they were created, so a sector
 * the product no longer uses (e.g. unchecked later in "Roteiro de Produção") can
 * still be present in `route`. Such sectors are skipped here so the lot always
 * follows what's currently registered for the product, landing directly on the
 * corresponding next active sector.
 */
export function resolveNextActiveSector(
  route: string[],
  fromIndex: number,
  product: Product | undefined,
  sectors: Sector[],
): SectorAdvanceResult {
  const activeRoute = product?.productionRoute && product.productionRoute.length > 0
    ? product.productionRoute
    : null;

  const skippedSectorNames: string[] = [];
  let idx = fromIndex + 1;
  if (activeRoute) {
    while (idx < route.length && !activeRoute.includes(route[idx])) {
      skippedSectorNames.push(sectors.find(s => s.id === route[idx])?.name || route[idx]);
      idx++;
    }
  }

  return {
    nextIndex: idx,
    isFinished: idx >= route.length,
    skippedSectorNames,
  };
}

/** Builds a human-readable explanation for sectors auto-skipped during a transfer, or null if none were skipped. */
export function buildSkippedSectorsMessage(skippedSectorNames: string[], destinationName: string): string | null {
  if (skippedSectorNames.length === 0) return null;
  const isPlural = skippedSectorNames.length > 1;
  const sectorList = skippedSectorNames.map(n => `"${n}"`).join(', ');
  return `O${isPlural ? 's setores' : ' setor'} ${sectorList} não ${isPlural ? 'estão cadastrados' : 'está cadastrado'} no roteiro de produção deste modelo e ${isPlural ? 'foram pulados' : 'foi pulado'} automaticamente. O mapa foi movido direto para "${destinationName}".`;
}

/**
 * Determines the sector a SPECIFIC product should go to next, given it is currently
 * at `currentSectorId` — independent of any lot's frozen `route`.
 *
 * `resolveNextActiveSector` walks a given route array and skips entries the product
 * doesn't use, but it can never "land" on a sector that isn't present in that array.
 * That breaks down for multi-model lots: a lot's frozen route is copied from a single
 * "main" product at creation time, so it may not even contain a sector another bundled
 * model needs (e.g. a lot created from model 300 — whose route skips "BORDADO" — has no
 * "BORDADO" entry at all, so resolving model 290's next sector within that frozen route
 * can never produce "BORDADO", even though 290's own registered route requires it).
 *
 * This walks the canonical sector order (sorted by `Sector.order`, the same order used
 * to seed a lot's route) and picks the first sector after the current one that belongs
 * to the product's own `productionRoute` — giving the product's true next stop.
 *
 * Also reports `skippedSectorNames` — canonical-order sectors between `currentSectorId`
 * and the resolved stop that this product's own route doesn't use — so callers can keep
 * showing the "sectors X were skipped automatically" explanation that existed before
 * this function took over next-sector resolution for OS completion.
 */
export function resolveCorrectSectorForProduct(
  currentSectorId: string,
  product: Product | undefined,
  allSectors: Sector[],
): { sectorId: string; isFinished: boolean; skippedSectorNames: string[] } {
  const canonicalOrder = [...allSectors].sort((a, b) => a.order - b.order).map(s => s.id);
  const activeRoute = product?.productionRoute && product.productionRoute.length > 0
    ? product.productionRoute
    : canonicalOrder;

  const currentIdx = canonicalOrder.indexOf(currentSectorId);
  const startIdx = currentIdx === -1 ? 0 : currentIdx + 1;

  const skippedSectorNames: string[] = [];
  for (let i = startIdx; i < canonicalOrder.length; i++) {
    if (activeRoute.includes(canonicalOrder[i])) {
      return { sectorId: canonicalOrder[i], isFinished: false, skippedSectorNames };
    }
    skippedSectorNames.push(allSectors.find(s => s.id === canonicalOrder[i])?.name || canonicalOrder[i]);
  }
  return { sectorId: '', isFinished: true, skippedSectorNames };
}

/** Special value in `metadata.orderSectors[orderId/itemKey]` meaning this order/item has
 * already received "baixa" from Expedição individually and left the production flow. */
export const ORDER_FINALIZED = '__FINALIZADO__';

/**
 * Stable per-item key for `metadata.orderSectors` overrides. A single order/pedido can
 * contribute multiple `sourceItems` to a lot (e.g. several colors of the same model) —
 * keying overrides by this composite key lets each of those move independently, instead
 * of an override on one item affecting every item that shares the same `orderId`.
 */
export function getSourceItemKey(si: { orderId: string; itemIdx?: number; productId?: string; variationId?: string }): string {
  if (si.itemIdx !== undefined) return `${si.orderId}::${si.itemIdx}`;
  return `${si.orderId}::${si.productId || ''}-${si.variationId || ''}`;
}

/**
 * Resolves the sector an individual order/item within a lot is currently in: its
 * per-item `metadata.orderSectors` override (when `si` is given), falling back to a
 * legacy order-level override (`orderSectors[orderId]`, from before per-item overrides
 * existed), and finally to the lot's anchor sector (`route[currentSectorIndex]`).
 */
export function getOrderEffectiveSector(
  lot: Pick<ProductionLot, 'route' | 'currentSectorIndex' | 'metadata'>,
  orderId: string,
  si?: { itemIdx?: number; productId?: string; variationId?: string },
): string {
  const orderSectors = (lot.metadata as any)?.orderSectors || {};
  if (si) {
    const itemKey = getSourceItemKey({ orderId, ...si });
    if (orderSectors[itemKey] !== undefined) return orderSectors[itemKey];
  }
  return orderSectors[orderId] || lot.route?.[lot.currentSectorIndex] || '';
}

/**
 * Groups a lot's non-finalized `sourceItems` by their effective sector
 * (`getOrderEffectiveSector`). Used to determine which Kanban columns a lot
 * should appear in, and how its quantity/grade splits across them.
 */
export function getLotPendingSectorGroups(lot: ProductionLot): Map<string, any[]> {
  const sourceItems: any[] = (lot as any).metadata?.sourceItems
    || [{ orderId: lot.productionOrderId || lot.id, itemIdx: 0, qty: lot.quantity }];
  const groups = new Map<string, any[]>();
  sourceItems.forEach(si => {
    const sec = getOrderEffectiveSector(lot, si.orderId, si);
    if (sec === ORDER_FINALIZED) return;
    if (!groups.has(sec)) groups.set(sec, []);
    groups.get(sec)!.push(si);
  });
  return groups;
}

/**
 * Returns `route` with `sectorId` guaranteed to be present, inserted at the
 * position matching the global canonical sector order if it isn't already there.
 *
 * Used for manual sector overrides: the automatic "next sector" computation can
 * get confused when a lot bundles models with different routes or has orders
 * spread across sectors ("pedidos adiantados"), occasionally landing far ahead
 * of where it should. A manual pick must always be applicable — even to a sector
 * the lot's frozen route doesn't contain — so `currentSectorIndex = route.indexOf(...)`
 * keeps working afterwards.
 */
export function ensureSectorInRoute(route: string[], sectorId: string, allSectors: Sector[]): string[] {
  if (route.includes(sectorId)) return route;
  const canonicalOrder = [...allSectors].sort((a, b) => a.order - b.order).map(s => s.id);
  const targetCanonicalIdx = canonicalOrder.indexOf(sectorId);
  let insertAt = route.length;
  if (targetCanonicalIdx !== -1) {
    for (let i = 0; i < route.length; i++) {
      const idx = canonicalOrder.indexOf(route[i]);
      if (idx !== -1 && idx > targetCanonicalIdx) { insertAt = i; break; }
    }
  }
  const newRoute = [...route];
  newRoute.splice(insertAt, 0, sectorId);
  return newRoute;
}

export type RouteDivergenceInfo = {
  /** Set when bundled models disagree about their correct next sector — advancing the whole lot would misroute at least one of them. */
  routeDivergence: { productName: string; sectorName: string }[] | null;
  /**
   * When `routeDivergence` is set, this lists each affected order with the exact
   * sector it should be individually redirected to — enough to perform the
   * redirect right away (e.g. write `metadata.orderSectors`) instead of just
   * describing the problem and leaving the user to find the buttons elsewhere.
   */
  divergentOrders: { orderId: string; productName: string; targetSectorId: string; targetSectorName: string }[] | null;
};

/**
 * Detects whether a bundle of orders (each tied to a model/product, via the lot's
 * `metadata.sourceItems`) disagree about which sector they should go to next from
 * `currentSectorId`. Used by every flow that can move a multi-model lot forward —
 * completing an OS, manually advancing a lot, mass-advance, "baixa automática" —
 * so the lock applies consistently no matter how the move is triggered or which
 * sector the lot is currently in.
 */
export function detectBundledRouteDivergence(
  currentSectorId: string,
  bundledOrderIds: string[],
  sourceItems: { orderId: string; productId?: string }[],
  products: Product[],
  sectors: Sector[],
): RouteDivergenceInfo {
  const bundledProductIds = Array.from(new Set(
    bundledOrderIds
      .map(oid => sourceItems.find(si => si.orderId === oid)?.productId)
      .filter((pid): pid is string => !!pid),
  ));

  if (bundledProductIds.length <= 1) {
    return { routeDivergence: null, divergentOrders: null };
  }

  const targets = bundledProductIds.map(pid => {
    const prod = products.find(p => p.id === pid);
    const resolved = resolveCorrectSectorForProduct(currentSectorId, prod, sectors);
    return {
      productId: pid,
      productName: prod?.name || pid,
      sectorId: resolved.sectorId,
      sectorName: resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === resolved.sectorId)?.name || resolved.sectorId),
    };
  });

  if (new Set(targets.map(t => t.sectorId || '__finished__')).size <= 1) {
    return { routeDivergence: null, divergentOrders: null };
  }

  const routeDivergence = targets.map(t => ({ productName: t.productName, sectorName: t.sectorName }));

  // Since the lot does NOT advance as a whole when locked (every model disagrees
  // about "the" next sector), EVERY bundled order needs an explicit individual
  // redirect to its own model's correct sector — relying on a generic lot advance
  // would leave whichever model "matched" stranded in the current sector.
  const divergentOrders = bundledOrderIds
    .map(orderId => {
      const productId = sourceItems.find(si => si.orderId === orderId)?.productId;
      const target = targets.find(t => t.productId === productId);
      if (!target || !target.sectorId) return null;
      return {
        orderId,
        productName: target.productName,
        targetSectorId: target.sectorId,
        targetSectorName: target.sectorName,
      };
    })
    .filter((d): d is { orderId: string; productName: string; targetSectorId: string; targetSectorName: string } => !!d);

  return { routeDivergence, divergentOrders };
}

export type OSAdvanceOutcome = {
  /** Sector the OS (and the lot) is currently in. */
  currentSectorId: string;
  /** Sector the lot would move to if advanced as a whole. */
  nextSectorId: string;
  nextSectorName: string;
  isFinished: boolean;
  skippedSectorNames: string[];
  /** Set when bundled models in this OS disagree about their correct next sector — advancing the whole lot would misroute at least one of them. */
  routeDivergence: { productName: string; sectorName: string }[] | null;
  /**
   * When `routeDivergence` is set, this lists each affected order with the exact
   * sector it should be individually redirected to — enough to perform the
   * redirect right away (e.g. write `metadata.orderSectors`) instead of just
   * describing the problem and leaving the user to find the buttons elsewhere.
   */
  divergentOrders: { orderId: string; productName: string; targetSectorId: string; targetSectorName: string }[] | null;
};

/**
 * Computes what completing `os` would do to its lot: the resolved next sector for
 * the lot as a whole, plus — for OSes that bundle multiple models — whether those
 * models actually agree on where they should go next (`routeDivergence`).
 *
 * The next sector is resolved from the registered route of the OS's OWN model
 * (via `resolveCorrectSectorForProduct`), not the lot's frozen `route`/"main" product.
 * A lot's `route` is a snapshot copied from whichever product created it — for
 * "pedidos adiantados" (bundles where part of the order is ahead of another in the
 * flow), that snapshot can have a different shape than what another bundled model is
 * actually registered to follow, so walking it produced wrong jumps (e.g. model 300
 * landing on EXPEDIÇÃO straight from BORDADO because the lot's frozen route — copied
 * from a different model — has nothing registered in between for it to stop at).
 * Resolving against the OS's own model's `productionRoute` over the canonical sector
 * order makes every model land on its own true next stop, matching what's registered
 * in "Roteiro de Produção" for that specific model — independent of the lot's snapshot.
 *
 * Centralizing this keeps the "preview" shown before completing an OS (e.g. via QR
 * scan) consistent with what `handleCompleteOS` actually decides and executes.
 */
export function computeOSAdvanceOutcome(
  os: ServiceOrder,
  lot: ProductionLot,
  products: Product[],
  sectors: Sector[],
): OSAdvanceOutcome {
  const route = lot.route || [];
  const currentSectorId = os.sectorId || (route[lot.currentSectorIndex] ?? '');

  const sourceItems: { orderId: string; productId?: string }[] = (lot as any).metadata?.sourceItems || [];
  const bundledOrderIds = os.sourceOrderIds && os.sourceOrderIds.length > 0
    ? os.sourceOrderIds
    : (lot.productionOrderId ? [lot.productionOrderId] : []);

  // Picks whichever bundled order resolves to a known product — for single-model OSes
  // (the overwhelming majority) this is simply that model; for multi-model OSes that
  // don't diverge (handled below) any of them yields the same answer; for ones that DO
  // diverge, this value is never used to move the lot (the divergence branch redirects
  // each order individually instead), so picking "the first one" is harmless there too.
  const osProductId = bundledOrderIds
    .map(oid => sourceItems.find(si => si.orderId === oid)?.productId)
    .find((pid): pid is string => !!pid) || lot.productId;
  const osProduct = products.find(p => p.id === osProductId);

  const resolved = resolveCorrectSectorForProduct(currentSectorId, osProduct, sectors);
  const nextSectorId = resolved.isFinished ? '' : resolved.sectorId;
  const nextSectorName = resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === nextSectorId)?.name || nextSectorId);

  const { routeDivergence, divergentOrders } = detectBundledRouteDivergence(currentSectorId, bundledOrderIds, sourceItems, products, sectors);

  return {
    currentSectorId,
    nextSectorId,
    nextSectorName,
    isFinished: resolved.isFinished,
    skippedSectorNames: resolved.skippedSectorNames,
    routeDivergence,
    divergentOrders,
  };
}

/**
 * Whether a sale's linked production has already progressed past creation —
 * i.e. at least one of its Mapas (`ProductionLot`s) has moved through a
 * sector ("baixa"), is past its starting sector, or has finished.
 *
 * Once this is true, the sale can no longer be deleted/estornada normally:
 * production keeps running, so deleting it would orphan the Mapa. Instead it
 * should only be cancelled (with estorno) — `applyExpedicaoStockUpdate`
 * (PCPView) already redirects boxes produced for a `CANCELLED` sale to the
 * general stock instead of reserving them for it.
 *
 * Returns `false` when no Mapa exists yet for the sale's Pedido de Produção —
 * in that case the sale (and its still-untouched Pedido de Produção/Mapas, if
 * any) can be deleted and reverted normally.
 */
export function saleProductionHasProgressed(
  sale: Pick<Sale, 'productionOrderId'>,
  productionOrders: ProductionOrder[],
  lots: ProductionLot[],
): boolean {
  if (!sale.productionOrderId) return false;
  const po = productionOrders.find(p => p.id === sale.productionOrderId);
  if (!po || po.lotIds.length === 0) return false;
  const poLots = lots.filter(l => po.lotIds.includes(l.id));
  return poLots.some(l => (l.history && l.history.length > 0) || l.currentSectorIndex > 0 || !!l.finishedAt);
}
