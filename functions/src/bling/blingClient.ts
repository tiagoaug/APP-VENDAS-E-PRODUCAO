// Cliente de baixo nível pra API v3 do Bling — autenticação Bearer simples (sem HMAC como a
// Shopee). Diferente da Shopee (uma chave de parceiro só, compartilhada por todo o app), o
// Bling exige que CADA empresa cadastre seu próprio "aplicativo" no portal de desenvolvedor
// (developer.bling.com.br/aplicativos) e gere seu próprio Client ID/Secret — por isso não há
// nenhum secret global aqui, client_id/client_secret vêm de users/{uid}/blingIntegration.
//
// Hosts e caminhos de OAuth confirmados via busca (2026-08-10) contra referências públicas
// (developer.bling.com.br/aplicativos + implementações de terceiros que batem entre si:
// github.com/vcsil/bling_api_v3_oauth, resultados de busca agregados) — não foi possível abrir
// a doc oficial interativa diretamente (é uma SPA que não retorna conteúdo via fetch simples).
export const BLING_API_HOST = "https://api.bling.com.br/Api/v3";
export const BLING_OAUTH_HOST = "https://www.bling.com.br/Api/v3/oauth";

export interface BlingTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/** Troca um `authorization_code` (ou `refresh_token`) por um par access/refresh token —
 * mesmo endpoint pros dois casos, variando `grant_type`. Autenticação via HTTP Basic com
 * `client_id:client_secret` em base64 (confirmado na doc oficial de autenticação do Bling). */
export async function exchangeBlingToken(params: {
  clientId: string;
  clientSecret: string;
  grantType: "authorization_code" | "refresh_token";
  code?: string;
  refreshToken?: string;
  redirectUri?: string;
}): Promise<BlingTokenResponse> {
  const { clientId, clientSecret, grantType, code, refreshToken, redirectUri } = params;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body: Record<string, string> = { grant_type: grantType };
  if (grantType === "authorization_code") {
    body.code = code || "";
    if (redirectUri) body.redirect_uri = redirectUri;
  } else {
    body.refresh_token = refreshToken || "";
  }

  // RFC 6749 (OAuth2) exige application/x-www-form-urlencoded no endpoint de token — testado
  // em produção 2026-08-10: com corpo JSON o Bling respondia 500 (rejeitando a troca do code
  // por token), com form-urlencoded funciona.
  const res = await fetch(`${BLING_OAUTH_HOST}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  const rawText = await res.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    // corpo não é JSON — cai no log abaixo com o texto cru pra facilitar diagnóstico
  }

  if (!res.ok || !json?.access_token) {
    const detail = json?.error_description || json?.error || rawText.slice(0, 300) || "resposta vazia";
    throw new Error(`Bling OAuth token error [${res.status}]: ${detail}`);
  }
  return json as BlingTokenResponse;
}

export interface BlingCallOptions {
  accessToken: string;
  path: string; // ex: "produtos", "pedidos/vendas", "pedidos/vendas/123/gerar-nfe"
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | (string | number)[] | undefined>;
  body?: Record<string, unknown>;
}

// Limite oficial do Bling: 3 requisições/segundo (developer.bling.com.br/limites, confirmado
// via busca 2026-08-10) — 350ms de espaçamento mínimo entre chamadas dá uma margem segura.
// `lastCallAt` é escopo de módulo (por instância da Cloud Function): como todo o resto do
// código já chama o Bling sequencialmente (nunca em paralelo, por exigência de rate limit e
// numeração de NF-e), isso é suficiente pra não estourar o limite dentro de uma mesma execução.
const MIN_INTERVAL_MS = 350;
let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCallAt = Date.now();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Chama um endpoint da API v3 do Bling (base https://api.bling.com.br/Api/v3), autenticado
 * via Bearer token. Respeita o limite de 3 req/s (throttle) e faz retry com backoff em caso de
 * 429 (até 3 tentativas). Lança erro com os detalhes que o Bling manda no corpo
 * (`error.description` / `error.fields`) quando a resposta não é 2xx. */
export async function blingCall<T = any>(options: BlingCallOptions): Promise<T> {
  const { accessToken, path, method = "GET", query, body } = options;

  // Arrays viram `chave[]=v1&chave[]=v2` (convenção padrão do axios pra params em array, usada
  // pela implementação de referência da API v3 do Bling — github.com/AlexandreBellas/
  // bling-erp-api-js — pros parâmetros idsSituacoes/idsProdutos/codigos/etc.).
  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) params.append(`${k}[]`, String(item));
      } else {
        params.append(k, String(v));
      }
    }
  }
  const qs = params.toString() ? `?${params.toString()}` : "";

  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttle();

    const res = await fetch(`${BLING_API_HOST}/${path}${qs}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      await sleep(attempt * 1000); // backoff: 1s, 2s, 3s
      continue;
    }

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const desc = json?.error?.description || json?.error?.message || JSON.stringify(json?.error?.fields || {});
      throw new Error(`Bling API error [${res.status}] em ${path}: ${desc || "sem detalhe"}`);
    }
    return json as T;
  }
  throw new Error(`Bling API error [429] em ${path}: limite de requisições excedido mesmo após novas tentativas.`);
}
