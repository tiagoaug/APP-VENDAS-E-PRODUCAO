import type { firestore } from "firebase-admin";
import { verifyShopeePushSignature } from "./shopeeClient";
import { importShopeeOrder, revertMarketplaceOrderReturn } from "./sync";

export interface WebhookHandleResult {
  status: number;
  body: string;
}

/**
 * Processa um push recebido da Shopee (Webhook v2). `pushUrl` precisa ser exatamente a URL
 * pública configurada no painel da Shopee (Push Config) — entra na assinatura.
 *
 * IMPORTANTE: os valores de `code` abaixo (tipo de push) e o formato exato de `data` variam
 * conforme a versão/região da API configurada na conta real — os usados aqui seguem a
 * convenção mais comum da doc pública da Shopee Open Platform v2, mas devem ser conferidos
 * e ajustados no primeiro teste real com a conta do usuário (ver `firebase functions:log`
 * pra ver o payload cru que a Shopee de fato manda).
 */
export async function handleShopeeWebhook(
  db: firestore.Firestore,
  partnerId: string,
  partnerKey: string,
  pushUrl: string,
  rawBody: string,
  signatureHeader: string | undefined
): Promise<WebhookHandleResult> {
  if (!signatureHeader || !verifyShopeePushSignature(pushUrl, rawBody, signatureHeader, partnerKey)) {
    return { status: 401, body: "assinatura inválida" };
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "corpo inválido" };
  }

  const shopId = String(payload?.shop_id || "");
  if (!shopId) return { status: 400, body: "shop_id ausente" };

  const indexSnap = await db.collection("shopeeShopIndex").doc(shopId).get();
  if (!indexSnap.exists) return { status: 200, body: "loja não vinculada — ignorado" };
  const { uid } = indexSnap.data() as { uid: string };

  const code = payload?.code;
  const data = payload?.data || {};

  try {
    // code 3 = atualização de status de pedido (convenção mais comum da doc pública) —
    // importa quando o pedido está pronto pra separar (evita importar um pedido que o
    // comprador ainda pode cancelar antes de pagar).
    if (code === 3 && data.ordersn && ["READY_TO_SHIP", "COMPLETED"].includes(data.status)) {
      await importShopeeOrder(db, uid, partnerId, partnerKey, data.ordersn);
      return { status: 200, body: "pedido importado" };
    }

    // Push de devolução/reembolso — a Shopee referencia o pedido original por ordersn;
    // busca o MarketplaceOrder já importado com esse externalOrderId e reverte.
    if (data.ordersn && ["RETURNED", "REFUNDED", "CANCELLED_AFTER_SHIP"].includes(data.status)) {
      const snap = await db
        .collection("users")
        .doc(uid)
        .collection("marketplaceOrders")
        .where("channel", "==", "SHOPEE")
        .where("externalOrderId", "==", data.ordersn)
        .limit(1)
        .get();
      if (!snap.empty && snap.docs[0].data().status === "STOCK_DEBITED") {
        await revertMarketplaceOrderReturn(db, uid, snap.docs[0].id);
      }
      return { status: 200, body: "devolução processada" };
    }

    return { status: 200, body: "push recebido, sem ação pro tipo/status atual" };
  } catch (err: any) {
    // Responde 200 mesmo em erro de negócio (item sem mapeamento, etc.) pra Shopee não
    // ficar reenviando o mesmo push em loop — o erro fica registrado no log e no próprio
    // MarketplaceOrder (campo errorReason) pro usuário ver e corrigir na tela.
    console.error("[shopeeWebhook] erro ao processar push:", err?.message || err);
    return { status: 200, body: "erro registrado" };
  }
}
