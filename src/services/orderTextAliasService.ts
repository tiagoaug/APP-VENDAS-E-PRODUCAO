import { firebaseService } from './firebaseService';
import { OrderTextAlias } from '../types';

// Persiste as correspondências "ensinadas" pelo usuário no Colar Pedido Digitado (ver
// src/utils/orderTextParser.ts e src/components/PasteOrderModal.tsx) — mesmo formato de
// blingService.ts (subscribe/save/delete numa coleção só), coleção separada porque não tem
// nenhuma relação com a integração Bling.
const ALIASES_PATH = 'orderTextAliases';

export function subscribeToOrderTextAliases(callback: (aliases: OrderTextAlias[]) => void) {
  return firebaseService.subscribeToCollection<OrderTextAlias>(ALIASES_PATH, callback);
}

export async function saveOrderTextAlias(alias: OrderTextAlias): Promise<void> {
  await firebaseService.saveDocument(ALIASES_PATH, alias);
}

export async function deleteOrderTextAlias(id: string): Promise<void> {
  await firebaseService.deleteDocument(ALIASES_PATH, id);
}
