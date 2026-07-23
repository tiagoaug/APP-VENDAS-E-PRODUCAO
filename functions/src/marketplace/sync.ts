import type { firestore } from "firebase-admin";
import { shopeeCall } from "./shopeeClient";
import { getValidShopeeAccessToken } from "./auth";

const ORDER_DETAIL_PATH = "/api/v2/order/get_order_detail";
const UPDATE_STOCK_PATH = "/api/v2/product/update_stock";

interface ShopeeMapping {
  id: string;
  externalItemId: string;
  externalModelId?: string;
  productId: string;
  variationId: string;
  size?: string;
  saleType: "RETAIL" | "WHOLESALE";
}

const mappingKey = (itemId: string, modelId?: string) => `${itemId}::${modelId || ""}`;

const stockKeyFor = (saleType: string, size?: string) => (saleType === "WHOLESALE" ? "WHOLESALE" : size || "WHOLESALE");

async function loadMappings(db: firestore.Firestore, uid: string): Promise<Map<string, ShopeeMapping>> {
  const snap = await db.collection("users").doc(uid).collection("marketplaceSkuMappings").where("channel", "==", "SHOPEE").get();
  const map = new Map<string, ShopeeMapping>();
  snap.forEach((doc) => {
    const m = doc.data() as ShopeeMapping;
    map.set(mappingKey(m.externalItemId, m.externalModelId), m);
  });
  return map;
}

/** Gera "MKT #0001" etc a partir de um contador simples em users/{uid}/counters/marketplaceOrders
 * — mesmo mecanismo de sequência já usado pra Pedidos de Produção no app (getNextSequence),
 * reimplementado aqui porque essa função roda no servidor, sem acesso ao client SDK. */
async function nextMarketplaceOrderNumber(db: firestore.Firestore, uid: string): Promise<string> {
  const ref = db.collection("users").doc(uid).collection("counters").doc("marketplaceOrders");
  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data()?.value as number) || 0 : 0;
    const value = current + 1;
    tx.set(ref, { value });
    return value;
  });
  return `MKT #${String(next).padStart(4, "0")}`;
}

export interface ImportOrderResult {
  ok: boolean;
  message: string;
  marketplaceOrderId?: string;
  status?: string;
}

/**
 * Importa um pedido da Shopee (`orderSn`) pro Firestore e desconta o estoque local — tudo
 * numa única transação atômica (mesmo padrão de segurança que handleCancelSaleWithRevert já
 * usa no client pra reverter vendas: ler tudo antes, escrever tudo junto). Idempotente: se o
 * pedido já foi importado e debitado antes, não desconta de novo.
 *
 * Se algum item do pedido ainda não tem mapeamento de SKU, o pedido fica com status
 * PARTIALLY_MAPPED e NENHUM item é debitado (evita debitar só parte do pedido) — o usuário
 * mapeia o item que falta e chama de novo.
 */
export async function importShopeeOrder(
  db: firestore.Firestore,
  uid: string,
  partnerId: string,
  partnerKey: string,
  orderSn: string
): Promise<ImportOrderResult> {
  const ordersRef = db.collection("users").doc(uid).collection("marketplaceOrders");

  const existingSnap = await ordersRef.where("channel", "==", "SHOPEE").where("externalOrderId", "==", orderSn).limit(1).get();
  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0];
    if (existing.data().status === "STOCK_DEBITED" || existing.data().status === "RETURNED") {
      return { ok: true, message: "Pedido já importado anteriormente.", marketplaceOrderId: existing.id, status: existing.data().status };
    }
  }

  const { accessToken, shopId } = await getValidShopeeAccessToken(db, uid, partnerId, partnerKey);

  const detail = await shopeeCall<{ response: { order_list: any[] } }>({
    partnerId,
    partnerKey,
    path: ORDER_DETAIL_PATH,
    accessToken,
    shopId,
    query: { order_sn_list: orderSn },
  });

  const order = detail?.response?.order_list?.[0];
  if (!order) {
    return { ok: false, message: `Pedido ${orderSn} não encontrado na Shopee.` };
  }

  const mappings = await loadMappings(db, uid);
  const items = (order.item_list || []).map((it: any) => {
    const mapping = mappings.get(mappingKey(String(it.item_id), it.model_id ? String(it.model_id) : undefined));
    return {
      externalItemId: String(it.item_id),
      externalModelId: it.model_id ? String(it.model_id) : undefined,
      externalName: it.item_name || it.model_name || "Item Shopee",
      quantity: Number(it.model_quantity_purchased || it.quantity_purchased || 0),
      price: Number(it.model_discounted_price || it.model_original_price || 0),
      ...(mapping
        ? { mapping: { productId: mapping.productId, variationId: mapping.variationId, size: mapping.size, saleType: mapping.saleType } }
        : {}),
    };
  });

  const allMapped = items.every((it: any) => !!it.mapping);
  const now = Date.now();

  const docRef = existingSnap.empty ? ordersRef.doc() : existingSnap.docs[0].ref;
  const orderNumber = existingSnap.empty ? await nextMarketplaceOrderNumber(db, uid) : existingSnap.docs[0].data().orderNumber;

  if (!allMapped) {
    await docRef.set(
      {
        id: docRef.id,
        channel: "SHOPEE",
        externalOrderId: orderSn,
        orderNumber,
        status: "PARTIALLY_MAPPED",
        buyerName: order.buyer_username,
        items,
        total: Number(order.total_amount || 0),
        errorReason: "Um ou mais itens sem mapeamento de SKU — mapeie e importe de novo.",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    return { ok: true, message: "Pedido salvo, mas tem item sem mapeamento — estoque NÃO foi debitado ainda.", marketplaceOrderId: docRef.id, status: "PARTIALLY_MAPPED" };
  }

  // Debita o estoque de todos os itens numa única transação — lê todos os produtos
  // envolvidos antes de escrever qualquer coisa (regra do Firestore: toda leitura numa
  // transação vem antes de qualquer escrita).
  await db.runTransaction(async (tx) => {
    const productIds: string[] = Array.from(new Set(items.map((it: any) => it.mapping.productId as string)));
    const productSnaps = await Promise.all(productIds.map((id) => tx.get(db.collection("users").doc(uid).collection("products").doc(id))));
    const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as any]));

    for (const it of items as any[]) {
      const prod = products.get(it.mapping.productId);
      if (!prod) continue;
      const variIdx = prod.variations.findIndex((v: any) => v.id === it.mapping.variationId);
      if (variIdx < 0) continue;
      const key = stockKeyFor(it.mapping.saleType, it.mapping.size);
      const v = prod.variations[variIdx];
      v.stock = { ...(v.stock || {}) };
      v.stock[key] = Math.max(0, (v.stock[key] || 0) - it.quantity);
    }

    for (const [id, prod] of products.entries()) {
      tx.set(db.collection("users").doc(uid).collection("products").doc(id), prod, { merge: true });
    }

    tx.set(
      docRef,
      {
        id: docRef.id,
        channel: "SHOPEE",
        externalOrderId: orderSn,
        orderNumber,
        status: "STOCK_DEBITED",
        buyerName: order.buyer_username,
        items,
        total: Number(order.total_amount || 0),
        errorReason: null,
        createdAt: now,
        updatedAt: now,
        importedAt: now,
      },
      { merge: true }
    );

    tx.set(db.collection("users").doc(uid).collection("marketplaceConnections").doc("SHOPEE"), { lastOrderSyncAt: now }, { merge: true });
  });

  return { ok: true, message: "Pedido importado e estoque debitado.", marketplaceOrderId: docRef.id, status: "STOCK_DEBITED" };
}

/**
 * Devolução/reembolso de um pedido já debitado: repõe o estoque de cada item mapeado
 * (espelho do débito acima) e marca o pedido como RETURNED. Só age sobre pedidos que
 * realmente chegaram a debitar estoque — evita repor algo que nunca foi descontado.
 */
export async function revertMarketplaceOrderReturn(db: firestore.Firestore, uid: string, marketplaceOrderId: string): Promise<ImportOrderResult> {
  const docRef = db.collection("users").doc(uid).collection("marketplaceOrders").doc(marketplaceOrderId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw new Error("Pedido de marketplace não encontrado.");
    const order = snap.data() as any;
    if (order.status !== "STOCK_DEBITED") {
      throw new Error(`Pedido está com status "${order.status}" — só é possível devolver um pedido com estoque já debitado.`);
    }

    const items = (order.items || []).filter((it: any) => !!it.mapping);
    const productIds: string[] = Array.from(new Set(items.map((it: any) => it.mapping.productId as string)));
    const productSnaps = await Promise.all(productIds.map((id) => tx.get(db.collection("users").doc(uid).collection("products").doc(id))));
    const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as any]));

    for (const it of items as any[]) {
      const prod = products.get(it.mapping.productId);
      if (!prod) continue;
      const variIdx = prod.variations.findIndex((v: any) => v.id === it.mapping.variationId);
      if (variIdx < 0) continue;
      const key = stockKeyFor(it.mapping.saleType, it.mapping.size);
      const v = prod.variations[variIdx];
      v.stock = { ...(v.stock || {}) };
      v.stock[key] = (v.stock[key] || 0) + it.quantity;
    }

    for (const [id, prod] of products.entries()) {
      tx.set(db.collection("users").doc(uid).collection("products").doc(id), prod, { merge: true });
    }

    tx.set(docRef, { status: "RETURNED", returnedAt: Date.now(), updatedAt: Date.now() }, { merge: true });
  });

  return { ok: true, message: "Devolução processada — estoque restaurado.", marketplaceOrderId };
}

export interface PushStockResult {
  ok: boolean;
  message: string;
  itemsUpdated: number;
}

/**
 * "Sincronizar Agora": envia o estoque local atual (só dos itens mapeados) pra Shopee.
 * Agrupa por externalItemId (a Shopee atualiza estoque por item, com uma lista de
 * model_id+stock quando o item tem variação) — checar contra a doc da conta real o limite
 * de itens por chamada (histórico da API v2: geralmente até 50 por lote).
 */
export async function pushStockToShopee(db: firestore.Firestore, uid: string, partnerId: string, partnerKey: string): Promise<PushStockResult> {
  const { accessToken, shopId } = await getValidShopeeAccessToken(db, uid, partnerId, partnerKey);
  const mappingsSnap = await db.collection("users").doc(uid).collection("marketplaceSkuMappings").where("channel", "==", "SHOPEE").get();
  if (mappingsSnap.empty) return { ok: true, message: "Nenhum SKU mapeado ainda.", itemsUpdated: 0 };

  const mappings = mappingsSnap.docs.map((d) => d.data() as ShopeeMapping);
  const productIds = Array.from(new Set(mappings.map((m) => m.productId)));
  const productSnaps = await Promise.all(productIds.map((id) => db.collection("users").doc(uid).collection("products").doc(id).get()));
  const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as any]));

  const byItem = new Map<string, { model_id?: number; seller_stock: { stock: number } }[]>();
  for (const m of mappings) {
    const prod = products.get(m.productId);
    const vari = prod?.variations?.find((v: any) => v.id === m.variationId);
    if (!vari) continue;
    const qty = vari.stock?.[stockKeyFor(m.saleType, m.size)] || 0;
    const list = byItem.get(m.externalItemId) || [];
    list.push({ ...(m.externalModelId ? { model_id: Number(m.externalModelId) } : {}), seller_stock: { stock: qty } });
    byItem.set(m.externalItemId, list);
  }

  let itemsUpdated = 0;
  for (const [itemId, stockList] of byItem.entries()) {
    await shopeeCall({
      partnerId,
      partnerKey,
      path: UPDATE_STOCK_PATH,
      method: "POST",
      accessToken,
      shopId,
      body: { item_id: Number(itemId), stock_list: stockList },
    });
    itemsUpdated++;
  }

  await db
    .collection("users")
    .doc(uid)
    .collection("marketplaceConnections")
    .doc("SHOPEE")
    .set({ lastStockPushAt: Date.now() }, { merge: true });

  return { ok: true, message: `Estoque enviado pra Shopee — ${itemsUpdated} item(ns) atualizado(s).`, itemsUpdated };
}
