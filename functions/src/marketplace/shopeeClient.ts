import * as crypto from "crypto";

// Cliente de baixo nível pra API v2 da Shopee Open Platform — assinatura HMAC-SHA256 e
// chamadas HTTP. Não guarda estado nenhum; quem chama passa partnerId/partnerKey (do
// secret) e, quando aplicável, accessToken/shopId (lidos de users/{uid}/shopeeIntegration).
//
// IMPORTANTE: o app "vendas e producao" no Shopee Open Platform está com App Status
// "Developing" (console: open.shopee.com/console/app/236901) — ou seja, só existe no
// ambiente de TESTE (Sandbox) da Shopee, não em produção. O host abaixo foi confirmado
// direto no "API Test Tool" do console (uma chamada de teste real devolveu HTTP 200
// usando exatamente este host). Quando a Shopee aprovar o app pra "Live", trocar para
// o host de produção e usar o Partner ID/Key da aba "Live" do console (são credenciais
// diferentes das de Test).
export const SHOPEE_HOST = "https://openplatform.sandbox.test-stable.shopee.sg";

export interface ShopeeSignParams {
  partnerId: string;
  partnerKey: string;
  path: string; // ex: "/api/v2/order/get_order_detail"
  timestamp: number; // epoch seconds
  accessToken?: string; // presente pra chamadas em nome de uma loja já autorizada
  shopId?: string;
}

/** Base string = partner_id + path + timestamp [+ access_token + shop_id], assinada com
 * HMAC-SHA256 usando a Partner Key. Endpoints de auth (troca de code por token) não levam
 * access_token/shop_id; endpoints de loja (pedidos, estoque) levam os dois. */
export function signShopeeRequest(params: ShopeeSignParams): string {
  const { partnerId, partnerKey, path, timestamp, accessToken, shopId } = params;
  let baseString = `${partnerId}${path}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += shopId;
  return crypto.createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

export interface ShopeeCallOptions {
  partnerId: string;
  partnerKey: string;
  path: string;
  method?: "GET" | "POST";
  accessToken?: string;
  shopId?: string;
  query?: Record<string, string | number>;
  body?: Record<string, unknown>;
}

/** Chama um endpoint da API v2 da Shopee, já assinado. Lança erro se a resposta trouxer
 * `error` preenchido (padrão de erro da Shopee: { error, message, request_id }). */
export async function shopeeCall<T = any>(options: ShopeeCallOptions): Promise<T> {
  const { partnerId, partnerKey, path, method = "GET", accessToken, shopId, query, body } = options;
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShopeeRequest({ partnerId, partnerKey, path, timestamp, accessToken, shopId });

  const params = new URLSearchParams({
    partner_id: partnerId,
    timestamp: String(timestamp),
    sign,
    ...(accessToken ? { access_token: accessToken } : {}),
    ...(shopId ? { shop_id: shopId } : {}),
    ...(query ? Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])) : {}),
  });

  const url = `${SHOPEE_HOST}${path}?${params.toString()}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as any;
  if (json?.error) {
    throw new Error(`Shopee API error [${json.error}]: ${json.message || "sem detalhe"} (request_id=${json.request_id || "?"})`);
  }
  return json as T;
}

/** Verifica a assinatura de um push da Shopee (header Authorization) contra o corpo bruto
 * recebido — usa a Partner Key. Comparação em tempo constante pra evitar timing attack. */
export function verifyShopeePushSignature(pushUrl: string, rawBody: string, receivedSignature: string, partnerKey: string): boolean {
  const baseString = `${pushUrl}|${rawBody}`;
  const expected = crypto.createHmac("sha256", partnerKey).update(baseString).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(receivedSignature || "", "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
