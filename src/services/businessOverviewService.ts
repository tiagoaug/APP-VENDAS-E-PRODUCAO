import { firebaseService } from './firebaseService';
import { OverviewPeriodType } from '../utils/businessOverview';

export type OverviewComparisonMode = 'NONE' | 'AUTO' | 'MANUAL';

export interface BusinessOverviewConfig {
  includeStock: boolean;
  includeAccounts: boolean;
  includeProduction: boolean;
  includeReceivables: boolean;
  includeReceivedSalesRevenue: boolean;
  periodType: OverviewPeriodType;
  periodDate: string; // "yyyy-MM" — mês/ano de referência do período selecionado
  comparisonMode: OverviewComparisonMode;
  compPeriodType: OverviewPeriodType;
  compPeriodDate: string; // "yyyy-MM"
  // undefined/null = todas as contas do negócio (padrão); array = seleção explícita
  // (pode ser [] pra "nenhuma conta", de propósito).
  selectedAccountIds?: string[] | null;
}

const PATH = 'businessOverviewConfig';
const DOC_ID = 'main';

function currentMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

function previousMonthStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export const DEFAULT_BUSINESS_OVERVIEW_CONFIG: BusinessOverviewConfig = {
  includeStock: true,
  includeAccounts: true,
  includeProduction: true,
  includeReceivables: false,
  includeReceivedSalesRevenue: false,
  periodType: 'MONTH',
  periodDate: currentMonthStr(),
  comparisonMode: 'AUTO',
  compPeriodType: 'MONTH',
  compPeriodDate: previousMonthStr(),
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
