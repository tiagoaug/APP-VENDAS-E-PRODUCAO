import * as crypto from "crypto";
import type { firestore } from "firebase-admin";
import { shopeeCall } from "./shopeeClient";

// Confirmado via doc oficial (open.shopee.com/documents, seção "GetAccessToken",
// tabela "Request Address", 2026-07-22): apesar do título da doc ser
// "v2.public.get_access_token", o caminho real da API é /api/v2/auth/token/get —
// o mesmo em todos os ambientes/regiões (só o host muda).
const TOKEN_GET_PATH = "/api/v2/auth/token/get";
const NONCE_TTL_MS = 15 * 60 * 1000; // 15 min pra completar o fluxo de OAuth

// Geração do link de autorização: a Shopee documenta (open.shopee.com/documents?module=87
// &type=2&id=58, seção "Gerando o link de Autorização") um método NOVO, separado da API
// v2 assinada com HMAC — é uma URL fixa por região/ambiente + parâmetros simples (sem
// partner_key, sem timestamp, sem sign). Confirmado via doc oficial em pt-BR em 2026-07-22.
// A doc lista um host "Brasil (BR)" específico (open.sandbox.test-stable.shopee.com.br),
// mas esse domínio não resolve via DNS (testado em 2026-07-22 — provável erro/desatualização
// na doc). O host "Global" (sem o .br) resolve normalmente e foi o usado aqui.
const AUTH_LINK_HOST = "https://open.sandbox.test-stable.shopee.com";
const AUTH_LINK_PATH = "/auth";

/**
 * Gera a URL de autorização da loja na Shopee e grava um nonce temporário (state -> uid)
 * pra o callback (que chega sem contexto de usuário nenhum, é um endpoint público) saber
 * de quem é aquela autorização. `callbackUrl` é a URL pública da própria Cloud Function
 * `shopeeOAuthCallback` (só existe depois do primeiro deploy).
 */
export async function getShopeeAuthUrl(
  db: firestore.Firestore,
  uid: string,
  partnerId: string,
  _partnerKey: string,
  callbackUrl: string
): Promise<string> {
  const nonce = crypto.randomBytes(24).toString("hex");
  await db.collection("shopeeAuthNonces").doc(nonce).set({ uid, createdAt: Date.now() });

  const params = new URLSearchParams({
    partner_id: partnerId,
    auth_type: "seller",
    redirect_uri: callbackUrl,
    response_type: "code",
    state: nonce,
  });
  return `${AUTH_LINK_HOST}${AUTH_LINK_PATH}?${params.toString()}`;
}

export interface OAuthCallbackResult {
  ok: boolean;
  message: string;
}

/**
 * Processa o retorno da Shopee depois que o usuário autoriza a loja: resolve o uid pelo
 * nonce (`state`), troca `code` por access/refresh token, grava os tokens em
 * users/{uid}/shopeeIntegration/tokens (Admin SDK, nunca chega ao client — ver
 * firestore.rules), atualiza o índice global shopId->uid (usado pelo webhook depois) e o
 * doc de status (client-readable, sem token nenhum).
 */
export async function handleShopeeOAuthCallback(
  db: firestore.Firestore,
  partnerId: string,
  partnerKey: string,
  query: { code?: string; shop_id?: string; state?: string }
): Promise<OAuthCallbackResult> {
  const { code, shop_id: shopId, state } = query;
  if (!code || !shopId || !state) {
    return { ok: false, message: "Retorno da Shopee incompleto (faltou code, shop_id ou state)." };
  }

  const nonceSnap = await db.collection("shopeeAuthNonces").doc(state).get();
  if (!nonceSnap.exists) {
    return { ok: false, message: "Sessão de conexão expirada ou inválida — tente conectar novamente." };
  }
  const { uid, createdAt } = nonceSnap.data() as { uid: string; createdAt: number };
  await nonceSnap.ref.delete();
  if (Date.now() - createdAt > NONCE_TTL_MS) {
    return { ok: false, message: "Sessão de conexão expirada — tente conectar novamente." };
  }

  const tokenResp = await shopeeCall<{
    access_token: string;
    refresh_token: string;
    expire_in: number;
    shop_id_list?: number[];
    error?: string;
  }>({
    partnerId,
    partnerKey,
    path: TOKEN_GET_PATH,
    method: "POST",
    body: { code, partner_id: Number(partnerId) },
  });

  const now = Date.now();
  await db
    .collection("users")
    .doc(uid)
    .collection("shopeeIntegration")
    .doc("tokens")
    .set({
      shopId,
      accessToken: tokenResp.access_token,
      refreshToken: tokenResp.refresh_token,
      expiresAt: now + tokenResp.expire_in * 1000,
      updatedAt: now,
    });

  await db.collection("shopeeShopIndex").doc(shopId).set({ uid, updatedAt: now });

  await db
    .collection("users")
    .doc(uid)
    .collection("marketplaceConnections")
    .doc("SHOPEE")
    .set(
      {
        id: "SHOPEE",
        channel: "SHOPEE",
        shopId,
        connected: true,
        connectedAt: now,
      },
      { merge: true }
    );

  return { ok: true, message: "Loja Shopee conectada com sucesso." };
}

/** Garante um access_token válido pra `uid`, renovando via refresh_token se estiver perto
 * de expirar (margem de 5 min). Lança erro se não houver conexão. */
export async function getValidShopeeAccessToken(
  db: firestore.Firestore,
  uid: string,
  partnerId: string,
  partnerKey: string
): Promise<{ accessToken: string; shopId: string }> {
  const ref = db.collection("users").doc(uid).collection("shopeeIntegration").doc("tokens");
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Loja Shopee não conectada.");
  const data = snap.data() as { shopId: string; accessToken: string; refreshToken: string; expiresAt: number };

  if (Date.now() < data.expiresAt - 5 * 60 * 1000) {
    return { accessToken: data.accessToken, shopId: data.shopId };
  }

  // ATENÇÃO: caminho não verificado contra a doc atual ainda (só get_access_token foi
  // confirmado, ver comentário acima de TOKEN_GET_PATH) — testar quando o primeiro token
  // realmente precisar renovar (expira em 4h) e corrigir se der "Wrong sign"/404 também.
  const REFRESH_PATH = "/api/v2/auth/access_token/get";
  const refreshResp = await shopeeCall<{ access_token: string; refresh_token: string; expire_in: number }>({
    partnerId,
    partnerKey,
    path: REFRESH_PATH,
    method: "POST",
    body: { refresh_token: data.refreshToken, shop_id: Number(data.shopId), partner_id: Number(partnerId) },
  });

  const now = Date.now();
  await ref.set(
    {
      accessToken: refreshResp.access_token,
      refreshToken: refreshResp.refresh_token,
      expiresAt: now + refreshResp.expire_in * 1000,
      updatedAt: now,
    },
    { merge: true }
  );

  return { accessToken: refreshResp.access_token, shopId: data.shopId };
}
