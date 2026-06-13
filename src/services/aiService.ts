import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

const functions = getFunctions(app, 'us-central1');

export type AIChatRole = 'user' | 'assistant';

export type AIChatImage = {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
};

export type AIChatMessage = {
  role: AIChatRole;
  content: string;
  images?: AIChatImage[];
};

export type AIPersonProposalData = {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
  observations?: string;
};

export type AIPurchaseItemProposalData = {
  description: string;
  quantity?: number;
  unit?: string;
  value?: number;
};

export type AIPurchaseProposalData = {
  supplierId?: string;
  supplierName?: string;
  items: AIPurchaseItemProposalData[];
  notes?: string;
};

export type AISolePurchaseItemProposalData = {
  moldId: string;
  moldName: string;
  colorId?: string;
  colorName: string;
  supplierId?: string;
  supplierName?: string;
  grid: Record<string, number>;
};

export type AISolePurchaseProposalData = {
  items: AISolePurchaseItemProposalData[];
  notes?: string;
};

export type AIProviderServiceOrderItem = {
  productName: string;
  reference?: string;
  colorName?: string;
  quantity: number;
};

export type AIProviderServiceOrder = {
  osNumber: string;
  sectorName: string;
  status: 'PENDING' | 'COMPLETED';
  paymentStatus: 'PENDING' | 'COMPLETED';
  quantity: number;
  valuePerPair: number;
  totalValue: number;
  finishedAt?: number;
  items: AIProviderServiceOrderItem[];
};

export type AIProviderServiceReportData = {
  providerName: string;
  fromDate?: string;
  toDate?: string;
  totalPairs: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  orders: AIProviderServiceOrder[];
};

export type AIFormProposal =
  | { type: 'person'; data: AIPersonProposalData }
  | { type: 'purchase'; data: AIPurchaseProposalData }
  | { type: 'sole_purchase'; data: AISolePurchaseProposalData }
  | { type: 'provider_service_report'; data: AIProviderServiceReportData };

export type AIChatResponse = {
  text: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  formProposal?: AIFormProposal;
};

export async function sendAIChatMessage(messages: AIChatMessage[]): Promise<AIChatResponse> {
  const aiChat = httpsCallable<{ messages: AIChatMessage[] }, AIChatResponse>(functions, 'aiChat');
  const result = await aiChat({ messages });
  return result.data;
}
