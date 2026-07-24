// Cálculo de rota seguindo ruas de verdade (não linha reta) via OSRM (Open Source
// Routing Machine), demo público gratuito e sem chave — mesmo espírito do Nominatim já
// usado pra geocodificação. Devolve o traçado real (coordenadas seguindo as vias) e,
// opcionalmente, a lista de ruas percorridas em cada trecho (`steps[].streetName`).

export interface RoadRouteStep {
  streetName: string;
  distanceMeters: number;
  maneuver: string; // ex: "Siga em frente", "Vire à direita" — já traduzido pra pt-BR
}

export interface RoadRouteLeg {
  distanceMeters: number;
  durationSeconds: number;
  steps: RoadRouteStep[];
}

export interface RoadRouteResult {
  coordinates: { lat: number; lng: number }[]; // traçado completo seguindo as ruas
  legs: RoadRouteLeg[]; // um trecho por par origem->parada / parada->parada, em ordem
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

const MANEUVER_LABELS: Record<string, string> = {
  turn_left: 'Vire à esquerda',
  turn_right: 'Vire à direita',
  turn_straight: 'Siga em frente',
  'turn_slight left': 'Curva leve à esquerda',
  'turn_slight right': 'Curva leve à direita',
  'turn_sharp left': 'Curva fechada à esquerda',
  'turn_sharp right': 'Curva fechada à direita',
  turn_uturn: 'Retorne',
  depart: 'Siga',
  arrive: 'Chegou ao destino',
  roundabout: 'Entre na rotatória',
  merge: 'Entre na via',
  fork: 'Mantenha-se na via',
  'new name': 'Continue',
};

function describeManeuver(maneuver: { type: string; modifier?: string }): string {
  const key = maneuver.modifier ? `${maneuver.type}_${maneuver.modifier}` : maneuver.type;
  return MANEUVER_LABELS[key] || MANEUVER_LABELS[maneuver.type] || 'Siga';
}

export async function getRoadRoute(
  origin: { lat: number; lng: number },
  stops: { lat: number; lng: number }[]
): Promise<RoadRouteResult | null> {
  if (stops.length === 0) return null;

  const points = [origin, ...stops];
  const coordsParam = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao calcular a rota.');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;

  const route = data.routes[0];
  const coordinates: { lat: number; lng: number }[] = (route.geometry?.coordinates || []).map(
    ([lng, lat]: [number, number]) => ({ lat, lng })
  );

  const legs: RoadRouteLeg[] = (route.legs || []).map((leg: any) => ({
    distanceMeters: leg.distance || 0,
    durationSeconds: leg.duration || 0,
    steps: (leg.steps || [])
      .filter((step: any) => (step.distance || 0) > 0 || step.maneuver?.type === 'depart')
      .map((step: any) => ({
        streetName: step.name || 'via sem nome',
        distanceMeters: step.distance || 0,
        maneuver: describeManeuver(step.maneuver || { type: 'new name' }),
      })),
  }));

  return {
    coordinates,
    legs,
    totalDistanceMeters: route.distance || 0,
    totalDurationSeconds: route.duration || 0,
  };
}
