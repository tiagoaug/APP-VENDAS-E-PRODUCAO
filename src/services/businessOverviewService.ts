import { firebaseService } from './firebaseService';
import { OverviewPeriodType } from '../utils/businessOverview';

export interface BusinessOverviewConfig {
  includeStock: boolean;
  includeAccounts: boolean;
  includeProduction: boolean;
  includeReceivables: boolean;
  includeSalesProfit: boolean;
  periodType: OverviewPeriodType;
  // undefined/null = todas as contas do negócio (padrão); array = seleção explícita
  // (pode ser [] pra "nenhuma conta", de propósito).
  selectedAccountIds?: string[] | null;
}

const PATH = 'businessOverviewConfig';
const DOC_ID = 'main';

export const DEFAULT_BUSINESS_OVERVIEW_CONFIG: BusinessOverviewConfig = {
  includeStock: true,
  includeAccounts: true,
  includeProduction: true,
  includeReceivables: false,
  includeSalesProfit: true,
  periodType: 'MONTH',
};

export function subscribeToBusinessOverviewConfig(callback: (config: BusinessOverviewConfig) => void) {
  return firebaseService.subscribeToCollection<any>(PATH, (all) => {
    const found = all.find((d) => d.id === DOC_ID);
    callback(found ? { ...DEFAULT_BUSINESS_OVERVIEW_CONFIG, ...found } : DEFAULT_BUSINESS_OVERVIEW_CONFIG);
  });
}

export async function saveBusinessOverviewConfig(config: BusinessOverviewConfig): Promise<void> {
  await firebaseService.saveDocument(PATH, { id: DOC_ID, ...config });
}
