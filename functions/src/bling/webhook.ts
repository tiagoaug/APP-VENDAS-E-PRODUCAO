import type { firestore } from "firebase-admin";
import { syncBlingOrders } from "./sync";

export interface WebhookHandleResult {
  status: number;
  body: string;
}

/**
 * Processa uma notificação do Bling. AO CONTRÁRIO do webhook da Shopee (assinatura HMAC
 * verificada), o esquema de assinatura/payload das notificações do Bling não foi verificado
 * contra a doc oficial (SPA que não retorna conteúdo em fetch simples, ver comentário em
 * blingClient.ts) — em vez de inventar uma verificação que não existe de verdade, esta função
 * usa uma abordagem conservadora: a URL do webhook que o usuário cadastra no painel do Bling
 * já inclui `?uid=...` (gerado nesta mesma tela de conexão), e QUALQUER POST recebido nessa URL
 * simplesmente dispara uma resincronização completa dos pedidos daquele uid — sem tentar
 * interpretar o payload. Menos eficiente que reagir ao evento específico, mas correto e sem
 * depender de um esquema de segurança não confirmado.
 */
export async function handleBlingWebhook(db: firestore.Firestore, uid: string | undefined): Promise<WebhookHandleResult> {
  if (!uid) return { status: 400, body: "uid ausente na URL do webhook" };

  const indexSnap = await db.collection("blingWebhookIndex").doc(uid).get();
  if (!indexSnap.exists) return { status: 200, body: "uid não vinculado — ignorado" };

  try {
    await syncBlingOrders(db, uid);
    return { status: 200, body: "sincronizado" };
  } catch (err: any) {
    console.error("[blingWebhook] erro ao sincronizar:", err?.message || err);
    return { status: 200, body: "erro registrado" };
  }
}
