import { firebaseService } from './firebaseService';

// Configuração de "dias trabalhados" — usada pra dividir a produção do período por dia de
// verdade (excluindo fins de semana, quando a fábrica não produz) em vez de diluir pelos dias
// corridos do calendário. Documento único no Firestore, mesmo padrão de businessOverviewService.
export interface ProductionScheduleConfig {
  // true = a Média de Pares/Dia (card "Pares Produzidos" do Dashboard e barra de estatísticas
  // do PCP Monitor) conta só segunda a sexta; false = conta todos os dias corridos do período.
  excludeWeekends: boolean;
}

const PATH = 'productionScheduleConfig';
const DOC_ID = 'main';

export const DEFAULT_PRODUCTION_SCHEDULE_CONFIG: ProductionScheduleConfig = {
  excludeWeekends: true,
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
