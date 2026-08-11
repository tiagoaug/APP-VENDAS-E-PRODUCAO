import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { firebaseService } from './firebaseService';
import { BlingConnection, BlingIgnoredProduct, BlingOrder, BlingProductMapping } from '../types';

const functions = getFunctions(app, 'us-central1');

const CONNECTION_PATH = 'blingConnections';
const MAPPINGS_PATH = 'blingProductMappings';
const IGNORED_PATH = 'blingIgnoredProducts';
const ORDERS_PATH = 'blingOrders';

// ─── Cloud Functions (lógica sensível/servidor — client_secret, tokens, chamadas à API do
// Bling) — mesma separação já usada em marketplaceService.ts pra Shopee: nada de credencial
// nem token passa perto do Firestore lido pelo cliente. ──────────────────────────────────

/** Salva Client ID/Secret do app Bling da própria empresa (cada conta Bling registra o seu,
 * diferente da Shopee que usa uma chave de parceiro única) — guardado só server-side. */
export async function saveBlingCredentials(clientId: string, clientSecret: string): Promise<{ ok: boolean }> {
  const fn = httpsCallable<{ clientId: string; clientSecret: string }, { ok: boolean }>(functions, 'blingSaveCredentials');
  const res = await fn({ clientId, clientSecret });
  return res.data;
}

export async function getBlingAuthUrl(callbackUrl: string): Promise<string> {
  const fn = httpsCallable<{ callbackUrl: string }, { url: string }>(functions, 'blingGetAuthUrl');
  const res = await fn({ callbackUrl });
  return res.data.url;
}

/** Desconecta a conta Bling (apaga o token, mantém Client ID/Secret salvos) — usado pra forçar
 * reautorização depois de mudar os escopos do app no portal do Bling, por exemplo. */
export async function disconnectBling(): Promise<{ ok: boolean }> {
  const fn = httpsCallable<void, { ok: boolean }>(functions, 'blingDisconnect');
  const res = await fn();
  return res.data;
}

export interface BlingRemoteProduct {
  id: string;
  nome: string;
  codigo?: string; // SKU no Bling
  gtin?: string;
  imagemUrl?: string;
  produtoPaiId?: string; // agrupa variações (cor/tamanho) do mesmo produto
}

/** Busca o catálogo completo do Bling (proxy server-side, usa o token salvo) — o algoritmo de
 * match em si roda no cliente (ver utils/blingReconciliation.ts), já que só precisa dessa
 * lista + o catálogo local, sem nada sensível envolvido. */
export async function fetchBlingProducts(): Promise<BlingRemoteProduct[]> {
  const fn = httpsCallable<void, { produtos: BlingRemoteProduct[] }>(functions, 'blingFetchProducts');
  const res = await fn();
  return res.data.produtos;
}

export async function syncBlingOrdersNow(): Promise<{ ok: boolean; message: string; ordersImported: number }> {
  const fn = httpsCallable<void, { ok: boolean; message: string; ordersImported: number }>(functions, 'blingSyncOrders');
  const res = await fn();
  return res.data;
}

export interface BlingEmissionResult {
  pedidoId: string;
  ok: boolean;
  notaFiscalId?: string;
  danfeUrl?: string;
  motivo?: string;
}

export async function emitBlingInvoice(pedidoId: string): Promise<BlingEmissionResult> {
  const fn = httpsCallable<{ pedidoId: string }, BlingEmissionResult>(functions, 'blingEmitInvoice');
  const res = await fn({ pedidoId });
  return res.data;
}

/** Sequencial no backend (não paralelo) — respeita rate limit do Bling e a numeração
 * sequencial da NF-e, mesma exigência já descrita na especificação original. */
export async function emitBlingInvoicesBatch(pedidoIds: string[]): Promise<BlingEmissionResult[]> {
  const fn = httpsCallable<{ pedidoIds: string[] }, { resultados: BlingEmissionResult[] }>(functions, 'blingEmitInvoicesBatch');
  const res = await fn({ pedidoIds });
  return res.data.resultados;
}

export interface BlingAbaterEstoqueItem {
  blingOrderId: string;
  blingProdutoId: string;
  quantidade: number;
}

/** Abate do estoque local os itens marcados como separados na Lista de Separação — cada item
 * vira `Variation.stock[tamanho] -= quantidade` (uma transação no servidor, ver
 * functions/src/bling/picking.ts) e é marcado `separado: true` dentro do pedido. */
export async function abaterEstoqueBling(items: BlingAbaterEstoqueItem[]): Promise<{ ok: boolean; message: string; itemsProcessed: number }> {
  const fn = httpsCallable<{ items: BlingAbaterEstoqueItem[] }, { ok: boolean; message: string; itemsProcessed: number }>(functions, 'blingAbaterEstoque');
  const res = await fn({ items });
  return res.data;
}

// ─── Firestore direto (dados não sensíveis — status de conexão, mapeamentos, pedidos) ───

export function subscribeToBlingConnection(callback: (connection: BlingConnection | null) => void) {
  return firebaseService.subscribeToCollection<BlingConnection>(CONNECTION_PATH, (all) => {
    callback(all.find((c) => c.id === 'bling') || null);
  });
}

export function subscribeToBlingMappings(callback: (mappings: BlingProductMapping[]) => void) {
  return firebaseService.subscribeToCollection<BlingProductMapping>(MAPPINGS_PATH, callback);
}

export async function saveBlingMapping(mapping: BlingProductMapping): Promise<void> {
  await firebaseService.saveDocument(MAPPINGS_PATH, mapping);
}

export async function deleteBlingMapping(id: string): Promise<void> {
  await firebaseService.deleteDocument(MAPPINGS_PATH, id);
}

export function subscribeToBlingIgnored(callback: (ignored: BlingIgnoredProduct[]) => void) {
  return firebaseService.subscribeToCollection<BlingIgnoredProduct>(IGNORED_PATH, callback);
}

export async function ignoreBlingProduct(entry: BlingIgnoredProduct): Promise<void> {
  await firebaseService.saveDocument(IGNORED_PATH, entry);
}

export async function unignoreBlingProduct(id: string): Promise<void> {
  await firebaseService.deleteDocument(IGNORED_PATH, id);
}

export function subscribeToBlingOrders(callback: (orders: BlingOrder[]) => void) {
  return firebaseService.subscribeToCollection<BlingOrder>(ORDERS_PATH, (all) => {
    callback([...all].sort((a, b) => b.createdAt - a.createdAt));
  });
}
