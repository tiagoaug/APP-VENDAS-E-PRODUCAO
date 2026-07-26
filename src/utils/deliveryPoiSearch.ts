// Busca de pontos de interesse (hospital, posto de gasolina, oficina) perto de um ponto
// via Overpass API (dados do OpenStreetMap) — gratuito, sem chave, mesma fonte de mapa/
// geocodificação já usada no resto do módulo de Entregas. Usado pela "Parada Manual" do
// Montar Rota, pra quando o motorista precisa passar por um local fora da rota normal.
import { haversineKm } from './deliveryRouteOptimizer';

export type POICategory = 'hospital' | 'fuel' | 'workshop';

export const POI_CATEGORY_LABELS: Record<POICategory, string> = {
  hospital: 'Hospital',
  fuel: 'Posto de Gasolina',
  workshop: 'Oficina Mecânica',
};

const CATEGORY_TAGS: Record<POICategory, [string, string]> = {
  hospital: ['amenity', 'hospital'],
  fuel: ['amenity', 'fuel'],
  workshop: ['shop', 'car_repair'],
};

export type POIResult = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
};

export async function searchNearbyPOI(
  category: POICategory,
  center: { lat: number; lng: number },
  radiusMeters = 8000,
): Promise<POIResult[]> {
  const [key, value] = CATEGORY_TAGS[category];
  const filter = `["${key}"="${value}"]`;
  const query = `[out:json][timeout:15];(node${filter}(around:${radiusMeters},${center.lat},${center.lng});way${filter}(around:${radiusMeters},${center.lat},${center.lng}););out center 30;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error('Falha ao buscar locais próximos.');

  const data = await res.json();
  const elements: any[] = data.elements || [];

  return elements
    .map((el): POIResult | null => {
      const name = el.tags?.name;
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (!name || lat === undefined || lng === undefined) return null;
      return { id: `${el.type}/${el.id}`, name, lat, lng, distanceKm: haversineKm(center, { lat, lng }) };
    })
    .filter((r): r is POIResult => r !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 15);
}
