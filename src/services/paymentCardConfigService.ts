import { firebaseService } from './firebaseService';

// Configuração de quais blocos aparecem no "Cartão de Pagamento" (PaymentCardModal.tsx) — o
// cartão visual gerado a partir de um Meio de Recebimento (Dashboard > Pix, Meios de Recebimento,
// ou anexado a uma Venda). Documento único no Firestore, mesmo padrão de labelElementsConfigService.ts.
export interface PaymentCardConfig {
  showName: boolean;
  showKey: boolean;
  showQr: boolean;
}

const PATH = 'paymentCardConfig';
const DOC_ID = 'main';

export const DEFAULT_PAYMENT_CARD_CONFIG: PaymentCardConfig = {
  showName: true,
  showKey: true,
  showQr: true,
};

export function subscribeToPaymentCardConfig(callback: (config: PaymentCardConfig) => void) {
  return firebaseService.subscribeToCollection<any>(PATH, (all) => {
    const found = all.find((d) => d.id === DOC_ID);
    callback(found ? {
      showName: found.showName ?? DEFAULT_PAYMENT_CARD_CONFIG.showName,
      showKey: found.showKey ?? DEFAULT_PAYMENT_CARD_CONFIG.showKey,
      showQr: found.showQr ?? DEFAULT_PAYMENT_CARD_CONFIG.showQr,
    } : DEFAULT_PAYMENT_CARD_CONFIG);
  });
}

export async function savePaymentCardConfig(config: Partial<PaymentCardConfig>): Promise<void> {
  await firebaseService.saveDocument(PATH, { id: DOC_ID, ...config });
}
