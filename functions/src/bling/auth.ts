import * as crypto from "crypto";
import type { firestore } from "firebase-admin";
import { exchangeBlingToken } from "./blingClient";

const NONCE_TTL_MS = 15 * 60 * 1000; // 15 min pra completar o fluxo de OAuth

/** Salva o Client ID/Secret do app Bling da PRÓPRIA empresa (cada conta Bling cadastra o seu
 * em developer.bling.com.br/aplicativos — diferente da Shopee, que usa uma chave de parceiro
 * única e compartilhada por todo o app). Nunca lido pelo client (ver firestore.rules). */
export async function saveBlingCredentials(db: firestore.Firestore, uid: string, clientId: string, clientSecret: string): Promise<{ ok: boolean }> {
  await db.collection("users").doc(uid).collection("blingIntegration").doc("credentials").set({
    clientId,
    clientSecret,
    updatedAt: Date.now(),
  });

  await db
    .collection("users")
    .doc(uid)
    .collection("blingConnections")
    .doc("bling")
    .set({ id: "bling", hasCredentials: true, connected: false }, { merge: true });

  return { ok: true };
}

/** Gera a URL de autorização do Bling e grava um nonce temporário (state -> uid) pro callback
 * (que chega sem contexto de usuário nenhum, é um endpoint público) saber de quem é aquela
 * autorização — mesmo mecanismo já usado pra Shopee em marketplace/auth.ts. */
export async function getBlingAuthUrl(db: firestore.Firestore, uid: string, callbackUrl: string): Promise<string> {
  const credSnap = await db.collection("users").doc(uid).collection("blingIntegration").doc("credentials").get();
  if (!credSnap.exists) throw new Error("Cadastre o Client ID e Client Secret do seu app Bling antes de conectar.");
  const { clientId } = credSnap.data() as { clientId: string };

  const nonce = crypto.randomBytes(24).toString("hex");
  await db.collection("blingAuthNonces").doc(nonce).set({ uid, createdAt: Date.now() });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    state: nonce,
    redirect_uri: callbackUrl,
  });
  return `https://www.bling.com.br/Api/v3/oauth/authorize?${params.toString()}`;
}

export interface BlingOAuthCallbackResult {
  ok: boolean;
  message: string;
}

/** Processa o retorno do Bling depois que o usuário autoriza o app: resolve o uid pelo nonce
 * (`state`), troca `code` por access/refresh token (usando o client_id/secret já salvos pra
 * esse uid) e grava tudo em users/{uid}/blingIntegration/tokens (Admin SDK only). */
export async function handleBlingOAuthCallback(
  db: firestore.Firestore,
  query: { code?: string; state?: string; redirectUri: string }
): Promise<BlingOAuthCallbackResult> {
  const { code, state, redirectUri } = query;
  if (!code || !state) {
    return { ok: false, message: "Retorno do Bling incompleto (faltou code ou state)." };
  }

  const nonceSnap = await db.collection("blingAuthNonces").doc(state).get();
  if (!nonceSnap.exists) {
    return { ok: false, message: "Sessão de conexão expirada ou inválida — tente conectar novamente." };
  }
  const { uid, createdAt } = nonceSnap.data() as { uid: string; createdAt: number };
  await nonceSnap.ref.delete();
  if (Date.now() - createdAt > NONCE_TTL_MS) {
    return { ok: false, message: "Sessão de conexão expirada — tente conectar novamente." };
  }

  const credSnap = await db.collection("users").doc(uid).collection("blingIntegration").doc("credentials").get();
  if (!credSnap.exists) {
    return { ok: false, message: "Credenciais do app Bling não encontradas — cadastre o Client ID/Secret novamente." };
  }
  const { clientId, clientSecret } = credSnap.data() as { clientId: string; clientSecret: string };

  const tokenResp = await exchangeBlingToken({ clientId, clientSecret, grantType: "authorization_code", code, redirectUri });

  const now = Date.now();
  await db
    .collection("users")
    .doc(uid)
    .collection("blingIntegration")
    .doc("tokens")
    .set({
      accessToken: tokenResp.access_token,
      refreshToken: tokenResp.refresh_token,
      expiresAt: now + tokenResp.expires_in * 1000,
      updatedAt: now,
    });

  // Índice global usado pelo webhook público do Bling (chega sem contexto de usuário) pra
  // descobrir de qual conta é aquela notificação — mesmo mecanismo do shopeeShopIndex.
  await db.collection("blingWebhookIndex").doc(uid).set({ uid, updatedAt: now });

  await db
    .collection("users")
    .doc(uid)
    .collection("blingConnections")
    .doc("bling")
    .set({ id: "bling", hasCredentials: true, connected: true, connectedAt: now }, { merge: true });

  return { ok: true, message: "Conta Bling conectada com sucesso." };
}

/** Desconecta a conta Bling: apaga o token salvo (obriga reautorizar do zero — útil quando os
 * escopos do app foram alterados no portal do Bling, já que só reautorizar emite um token com
 * as permissões novas) e marca a conexão como desconectada. Mantém o Client ID/Secret salvos,
 * não precisa recadastrar. */
export async function disconnectBling(db: firestore.Firestore, uid: string): Promise<{ ok: boolean }> {
  await db.collection("users").doc(uid).collection("blingIntegration").doc("tokens").delete();
  await db
    .collection("users")
    .doc(uid)
    .collection("blingConnections")
    .doc("bling")
    .set({ connected: false }, { merge: true });
  return { ok: true };
}

/** Garante um access_token válido pra `uid`, renovando via refresh_token se estiver perto de
 * expirar (margem de 5 min). O access_token do Bling dura ~6h; o refresh_token, ~30 dias
 * (confirmado na doc oficial de autenticação). Lança erro se não houver conexão. */
export async function getValidBlingAccessToken(db: firestore.Firestore, uid: string): Promise<string> {
  const credRef = db.collection("users").doc(uid).collection("blingIntegration").doc("credentials");
  const tokenRef = db.collection("users").doc(uid).collection("blingIntegration").doc("tokens");
  const [credSnap, tokenSnap] = await Promise.all([credRef.get(), tokenRef.get()]);

  if (!credSnap.exists) throw new Error("Credenciais do app Bling não cadastradas.");
  if (!tokenSnap.exists) throw new Error("Conta Bling não conectada.");

  const { clientId, clientSecret } = credSnap.data() as { clientId: string; clientSecret: string };
  const data = tokenSnap.data() as { accessToken: string; refreshToken: string; expiresAt: number };

  if (Date.now() < data.expiresAt - 5 * 60 * 1000) {
    return data.accessToken;
  }

  const refreshed = await exchangeBlingToken({ clientId, clientSecret, grantType: "refresh_token", refreshToken: data.refreshToken });

  const now = Date.now();
  await tokenRef.set(
    {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: now + refreshed.expires_in * 1000,
      updatedAt: now,
    },
    { merge: true }
  );

  return refreshed.access_token;
}
