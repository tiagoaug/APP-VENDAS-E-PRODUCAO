import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { firebaseService } from './firebaseService';
import { MarketplaceConnection, MarketplaceOrder, MarketplaceSkuMapping } from '../types';

const functions = getFunctions(app, 'us-central1');

const CONNECTIONS_PATH = 'marketplaceConnections';
const ORDERS_PATH = 'marketplaceOrders';
const MAPPINGS_PATH = 'marketplaceSkuMappings';

// ─── Cloud Functions (lógica sensível/servidor — token, assinatura, chamadas à Shopee) ───

export async function getShopeeAuthUrl(callbackUrl: string): Promise<string> {
  const fn = httpsCallable<{ callbackUrl: string }, { url: string }>(functions, 'shopeeGetAuthUrl');
  const res = await fn({ callbackUrl });
  return res.data.url;
}

export async function syncShopeeStockNow(): Promise<{ ok: boolean; message: string; itemsUpdated: number }> {
  const fn = httpsCallable<void, { ok: boolean; message: string; itemsUpdated: number }>(functions, 'shopeeSyncStockNow');
  const res = await fn();
  return res.data;
}

export async function importShopeeOrderManually(orderSn: string): Promise<{ ok: boolean; message: string; marketplaceOrderId?: string; status?: string }> {
  const fn = httpsCallable<{ orderSn: string }, { ok: boolean; message: string; marketplaceOrderId?: string; status?: string }>(functions, 'shopeeImportOrderManually');
  const res = await fn({ orderSn });
  return res.data;
}

export async function revertShopeeOrderReturn(marketplaceOrderId: string): Promise<{ ok: boolean; message: string }> {
  const fn = httpsCallable<{ marketplaceOrderId: string }, { ok: boolean; message: string }>(functions, 'shopeeRevertOrderReturn');
  const res = await fn({ marketplaceOrderId });
  return res.data;
}

// ─── Firestore direto (dados não sensíveis — status de conexão, mapeamentos, pedidos) ───

export function subscribeToMarketplaceConnection(callback: (connection: MarketplaceConnection | null) => void) {
  return firebaseService.subscribeToCollection<MarketplaceConnection>(CONNECTIONS_PATH, (all) => {
    callback(all.find((c) => c.id === 'SHOPEE') || null);
  });
}

export function subscribeToMarketplaceOrders(callback: (orders: MarketplaceOrder[]) => void) {
  return firebaseService.subscribeToCollection<MarketplaceOrder>(ORDERS_PATH, (all) => {
    callback([...all].sort((a, b) => b.createdAt - a.createdAt));
  });
}

export function subscribeToSkuMappings(callback: (mappings: MarketplaceSkuMapping[]) => void) {
  return firebaseService.subscribeToCollection<MarketplaceSkuMapping>(MAPPINGS_PATH, callback);
}

export async function saveSkuMapping(mapping: MarketplaceSkuMapping): Promise<void> {
  await firebaseService.saveDocument(MAPPINGS_PATH, mapping);
}

export async function deleteSkuMapping(id: string): Promise<void> {
  await firebaseService.deleteDocument(MAPPINGS_PATH, id);
}
