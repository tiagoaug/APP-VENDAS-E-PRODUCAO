import { DeliveryStop } from '../types';

// Otimização de rota 100% local (sem API paga): nearest-neighbor + 2-opt por distância
// haversine, com a prioridade como camada FIXA — toda parada URGENT sai antes de toda
// parada NORMAL; a otimização de distância acontece só dentro de cada camada.

export type Point = { lat: number; lng: number };

export function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestNeighborOrder<T extends Point>(start: Point, points: T[]): T[] {
  const remaining = [...points];
  const ordered: T[] = [];
  let current = start;
  while (remaining.length) {
    let bestIdx = 0, bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(current, p);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

function twoOpt<T extends Point>(start: Point, order: T[]): T[] {
  let best = [...order];
  const routeLength = (seq: T[]) => {
    if (seq.length === 0) return 0;
    let d = haversineKm(start, seq[0]);
    for (let i = 0; i < seq.length - 1; i++) d += haversineKm(seq[i], seq[i + 1]);
    return d;
  };
  let bestLen = routeLength(best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const len = routeLength(candidate);
        if (len < bestLen - 1e-9) { best = candidate; bestLen = len; improved = true; }
      }
    }
  }
  return best;
}

export function optimizeRoute(origin: Point, stops: (DeliveryStop & Point)[]): DeliveryStop[] {
  const urgent = stops.filter(s => s.priority === 'URGENT');
  const normal = stops.filter(s => s.priority !== 'URGENT');

  const urgentOrdered = twoOpt(origin, nearestNeighborOrder(origin, urgent));
  const tierBoundary = urgentOrdered.length ? urgentOrdered[urgentOrdered.length - 1] : origin;
  const normalOrdered = twoOpt(tierBoundary, nearestNeighborOrder(tierBoundary, normal));

  return [...urgentOrdered, ...normalOrdered].map((s, i) => ({ ...s, order: i }));
}
