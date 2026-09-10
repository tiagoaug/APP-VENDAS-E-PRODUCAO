import { firebaseService } from './firebaseService';

// Configuração de quais campos aparecem no elemento "Dados da OS" da etiqueta (ver
// LabelDataBinding 'osdata' em types.ts e resolveLabelBinding em labelFieldResolvers.ts) — antes
// era um texto fixo (Número | Fornecedor | Valor), agora o usuário escolhe quais desses campos
// quer ver impressos. Documento único no Firestore, mesmo padrão de productionScheduleService.
export interface OsDataFieldsConfig {
  osNumber: boolean;
  providerName: boolean;
  totalValue: boolean;
  quantity: boolean;
  valuePerPair: boolean;
  sectorName: boolean;
  type: boolean;
  createdAt: boolean;
  notes: boolean;
}

export interface LabelElementsConfig {
  osDataFields: OsDataFieldsConfig;
  // Prefixo de texto opcional pros elementos "Cliente"/"Destinatário"/"Embalagem" (ex.:
  // "Cliente: " na frente do nome) — vazio = comportamento de sempre, só o valor puro.
  customerPrefix: string;
  recipientPrefix: string;
  packagingPrefix: string;
}

const PATH = 'labelElementsConfig';
const DOC_ID = 'main';

export const DEFAULT_OS_DATA_FIELDS: OsDataFieldsConfig = {
  osNumber: true,
  providerName: true,
  totalValue: true,
  quantity: false,
  valuePerPair: false,
  sectorName: false,
  type: false,
  createdAt: false,
  notes: false,
};

export const DEFAULT_LABEL_ELEMENTS_CONFIG: LabelElementsConfig = {
  osDataFields: DEFAULT_OS_DATA_FIELDS,
  customerPrefix: '',
  recipientPrefix: '',
  packagingPrefix: '',
};

export function subscribeToLabelElementsConfig(callback: (config: LabelElementsConfig) => void) {
  return firebaseService.subscribeToCollection<any>(PATH, (all) => {
    const found = all.find((d) => d.id === DOC_ID);
    callback(found ? {
      osDataFields: { ...DEFAULT_OS_DATA_FIELDS, ...(found.osDataFields || {}) },
      customerPrefix: found.customerPrefix ?? DEFAULT_LABEL_ELEMENTS_CONFIG.customerPrefix,
      recipientPrefix: found.recipientPrefix ?? DEFAULT_LABEL_ELEMENTS_CONFIG.recipientPrefix,
      packagingPrefix: found.packagingPrefix ?? DEFAULT_LABEL_ELEMENTS_CONFIG.packagingPrefix,
    } : DEFAULT_LABEL_ELEMENTS_CONFIG);
  });
}

// Aceita atualização parcial — saveDocument grava com merge:true, então salvar só o campo que
// mudou (ex.: só customerPrefix) nunca apaga o resto do documento (ex.: osDataFields).
export async function saveLabelElementsConfig(config: Partial<LabelElementsConfig>): Promise<void> {
  await firebaseService.saveDocument(PATH, { id: DOC_ID, ...config });
}
