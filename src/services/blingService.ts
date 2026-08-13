import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { firebaseService } from './firebaseService';
import { BlingConnection, BlingIgnoredProduct, BlingOrder, BlingProductMapping, BlingNotesCounter, BlingNoteAdjustment, BlingDevolucao, BlingSalesLedgerEntry } from '../types';

const functions = getFunctions(app, 'us-central1');

const CONNECTION_PATH = 'blingConnections';
const MAPPINGS_PATH = 'blingProductMappings';
const IGNORED_PATH = 'blingIgnoredProducts';
const ORDERS_PATH = 'blingOrders';
const NOTES_COUNTER_PATH = 'blingNotesCounter';
const NOTE_ADJUSTMENTS_PATH = 'blingNoteAdjustments';
const DEVOLUCOES_PATH = 'blingDevolucoes';
const SALES_LEDGER_PATH = 'blingSalesLedger';

// ─── Cloud Functions (lógica sensível/servidor — client_secret, tokens, chamadas à API do
// Bling) — nada de credencial nem token passa perto do Firestore lido pelo cliente. ──────

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

/** `intervalMinutes: null` desliga a sincronização automática (só manual). */
export async function setBlingAutoSyncInterval(intervalMinutes: number | null): Promise<{ ok: boolean }> {
  const fn = httpsCallable<{ intervalMinutes: number | null }, { ok: boolean }>(functions, 'blingSetAutoSyncInterval');
  const res = await fn({ intervalMinutes });
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

/** Só busca/atualiza número, DANFE, PDF e etiqueta de transporte de uma nota já gerada — sem
 * reenviar pra autorização. Usado pra "preencher" pedidos autorizados antes desses campos
 * existirem no app, e pra atualizar pedidos que ainda estavam em processamento. */
export async function refreshBlingInvoiceDetails(pedidoId: string): Promise<BlingEmissionResult> {
  const fn = httpsCallable<{ pedidoId: string }, BlingEmissionResult>(functions, 'blingRefreshInvoice');
  const res = await fn({ pedidoId });
  return res.data;
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

/** Ajuste manual do saldo de "notas de terceiros" — passe `delta` (soma/subtrai) OU `setTo`
 * (fixa um valor absoluto, usado no cadastro inicial do talão). */
export async function adjustBlingNotes(input: { delta?: number; setTo?: number; motivo?: string }): Promise<BlingNotesCounter> {
  const fn = httpsCallable<typeof input, BlingNotesCounter>(functions, 'blingAdjustNotes');
  const res = await fn(input);
  return res.data;
}

export interface BlingRegisterDevolucaoInput {
  productId: string;
  variationId: string;
  size?: string;
  quantidade: number;
}

/** Devolução avulsa (por referência/tamanho/quantidade) — restitui o estoque e devolve o saldo
 * de notas de terceiros correspondente. */
export async function registerBlingDevolucao(input: BlingRegisterDevolucaoInput): Promise<{ ok: boolean; message: string }> {
  const fn = httpsCallable<BlingRegisterDevolucaoInput, { ok: boolean; message: string }>(functions, 'blingRegisterDevolucao');
  const res = await fn(input);
  return res.data;
}

/** Devolução "só nota" — sem produto/estoque envolvido, só devolve a quantidade pro saldo de
 * notas de terceiros. */
export async function registerNotesOnlyReturn(input: { quantidade: number; motivo?: string }): Promise<BlingNotesCounter> {
  const fn = httpsCallable<typeof input, BlingNotesCounter>(functions, 'blingRegisterNotesOnlyReturn');
  const res = await fn(input);
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

export function subscribeToBlingNotesCounter(callback: (counter: BlingNotesCounter | null) => void) {
  return firebaseService.subscribeToCollection<BlingNotesCounter>(NOTES_COUNTER_PATH, (all) => {
    callback(all.find((c) => c.id === 'counter') || null);
  });
}

export function subscribeToBlingNoteAdjustments(callback: (adjustments: BlingNoteAdjustment[]) => void) {
  return firebaseService.subscribeToCollection<BlingNoteAdjustment>(NOTE_ADJUSTMENTS_PATH, (all) => {
    callback([...all].sort((a, b) => b.createdAt - a.createdAt));
  });
}

export function subscribeToBlingDevolucoes(callback: (devolucoes: BlingDevolucao[]) => void) {
  return firebaseService.subscribeToCollection<BlingDevolucao>(DEVOLUCOES_PATH, (all) => {
    callback([...all].sort((a, b) => b.createdAt - a.createdAt));
  });
}

/** Registro por pedido com NF-e autorizada/emitida — fonte confiável de "pares vendidos" pro
 * Painel de Saúde, ver comentário completo em functions/src/bling/sync.ts. */
export function subscribeToBlingSalesLedger(callback: (entries: BlingSalesLedgerEntry[]) => void) {
  return firebaseService.subscribeToCollection<BlingSalesLedgerEntry>(SALES_LEDGER_PATH, (all) => {
    callback([...all].sort((a, b) => b.createdAt - a.createdAt));
  });
}
