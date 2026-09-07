import { firebaseService } from './firebaseService';

// Configuração de "dias trabalhados" — usada pra dividir a produção do período por dia de
// verdade (excluindo fins de semana, quando a fábrica não produz) em vez de diluir pelos dias
// corridos do calendário. Documento único no Firestore, mesmo padrão de businessOverviewService.
export interface ProductionScheduleConfig {
  // true = a Média de Pares/Dia (card "Pares Produzidos" do Dashboard e barra de estatísticas
  // do PCP Monitor) conta só segunda a sexta; false = conta todos os dias corridos do período.
  excludeWeekends: boolean;
  // Só tem efeito com excludeWeekends=true — duas opções mutuamente exclusivas de COMO contar
  // os dias úteis do denominador (ver computeProducedPairs em utils/businessOverview.ts):
  // 'FULL_PERIOD' = todos os dias úteis do período inteiro escolhido, mesmo os que ainda não
  // chegaram (ex.: resto do mês atual) — é o comportamento de sempre.
  // 'ELAPSED' = só os dias úteis já passados até agora dentro do período — mostra o ritmo real
  // de produção "até o momento", sem diluir a média por dias futuros que ainda não produziram.
  averageMode: 'FULL_PERIOD' | 'ELAPSED';
}

const PATH = 'productionScheduleConfig';
const DOC_ID = 'main';

export const DEFAULT_PRODUCTION_SCHEDULE_CONFIG: ProductionScheduleConfig = {
  excludeWeekends: true,
  // 'ELAPSED' é o recomendado (ver "Recomendado" nos botões de SettingsView.tsx) — mostra o
  // ritmo real de produção até agora, sem diluir pelos dias que ainda faltam no período.
  averageMode: 'ELAPSED',
};

export function subscribeToProductionScheduleConfig(callback: (config: ProductionScheduleConfig) => void) {
  return firebaseService.subscribeToCollection<any>(PATH, (all) => {
    const found = all.find((d) => d.id === DOC_ID);
    callback(found ? { ...DEFAULT_PRODUCTION_SCHEDULE_CONFIG, ...found } : DEFAULT_PRODUCTION_SCHEDULE_CONFIG);
  });
}

export async function saveProductionScheduleConfig(config: ProductionScheduleConfig): Promise<void> {
  await firebaseService.saveDocument(PATH, { id: DOC_ID, ...config });
}
