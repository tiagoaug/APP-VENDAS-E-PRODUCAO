import type { firestore } from "firebase-admin";
import { blingCall } from "./blingClient";
import { getValidBlingAccessToken } from "./auth";

export interface BlingRemoteProduct {
  id: string;
  nome: string;
  codigo?: string;
  gtin?: string;
  imagemUrl?: string;
  produtoPaiId?: string; // agrupa variações (cor/tamanho) do mesmo produto — campo idProdutoPai
}

/** Busca o catálogo completo de produtos do Bling (paginado, sequencial — não paralelo, pra
 * não estourar rate limit). NOTA: o endpoint de listagem (GET /produtos) NÃO retorna o campo
 * `gtin` (só o endpoint de produto único, GET /produtos/{id}, que exigiria 1 chamada por
 * produto) — confirmado contra a definição real da API v3
 * (github.com/AlexandreBellas/bling-erp-api-js, IGetResponse vs IFindResponse de produtos).
 * Por isso o algoritmo de reconciliação do cliente (utils/blingReconciliation.ts) hoje só usa
 * SKU/nome — o nível de match por GTIN da especificação original fica documentado mas sem
 * dado pra comparar, em vez de inventado. */
export async function fetchBlingProducts(db: firestore.Firestore, uid: string): Promise<BlingRemoteProduct[]> {
  const accessToken = await getValidBlingAccessToken(db, uid);
  const produtos: BlingRemoteProduct[] = [];
  const LIMIT = 100;
  const MAX_PAGES = 20; // teto de segurança (2000 produtos) pra não rodar indefinidamente

  for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
    const resp = await blingCall<{ data: { id: number; idProdutoPai?: number; nome: string; codigo?: string; imagemURL?: string }[] }>({
      accessToken,
      path: "produtos",
      query: { pagina, limite: LIMIT },
    });
    const page = resp?.data || [];
    for (const p of page) {
      produtos.push({
        id: String(p.id),
        nome: p.nome,
        codigo: p.codigo,
        imagemUrl: p.imagemURL,
        produtoPaiId: p.idProdutoPai ? String(p.idProdutoPai) : undefined,
      });
    }
    if (page.length < LIMIT) break;
  }

  await db
    .collection("users")
    .doc(uid)
    .collection("blingConnections")
    .doc("bling")
    .set({ lastProductSyncAt: Date.now() }, { merge: true });

  return produtos;
}

interface BlingProductMappingDoc {
  blingProdutoId: string;
}

async function loadMappedBlingProductIds(db: firestore.Firestore, uid: string): Promise<Set<string>> {
  const snap = await db.collection("users").doc(uid).collection("blingProductMappings").get();
  return new Set(snap.docs.map((d) => (d.data() as BlingProductMappingDoc).blingProdutoId));
}

type BlingOrderOrigin = "PROPRIO" | "MERCADO_LIVRE" | "SHOPEE" | "LOJA_VIRTUAL" | "OUTRO";

/** Classifica o `tipo` de um canal de venda do Bling (ex: "Shopee", confirmado num exemplo real
 * da definição da API v3) num BlingOrderOrigin — heurística por substring já que a lista
 * completa de valores possíveis de `tipo` não está documentada publicamente, só o exemplo
 * "Shopee" e o "agrupador" (1=Loja virtual, 2=Hub, 3=Marketplace, 4=API). */
function classifyChannelType(tipo: string, agrupador?: number): BlingOrderOrigin {
  const t = tipo.toLowerCase();
  if (t.includes("shopee")) return "SHOPEE";
  if (t.includes("mercadolivre") || t.includes("mercado_livre") || t.includes("meli")) return "MERCADO_LIVRE";
  if (agrupador === 1) return "LOJA_VIRTUAL"; // Loja virtual (ex: Loja Integrada, Nuvemshop, etc.)
  if (agrupador === 3) return "OUTRO"; // Marketplace não identificado especificamente
  return "PROPRIO"; // API/Hub/canal próprio do Bling
}

/** Busca os canais de venda cadastrados no Bling (GET /canais-venda) e monta um índice
 * id -> origem, pra classificar de qual marketplace cada pedido veio (campo `loja.id` do
 * pedido referencia um canal de venda). Uma chamada só por sincronização. */
async function loadSalesChannelOrigins(accessToken: string): Promise<Map<string, BlingOrderOrigin>> {
  const map = new Map<string, BlingOrderOrigin>();
  try {
    const resp = await blingCall<{ data: { id: number; tipo: string; descricao: string }[] }>({
      accessToken,
      path: "canais-venda",
      query: { limite: 100 },
    });
    for (const canal of resp?.data || []) {
      map.set(String(canal.id), classifyChannelType(canal.tipo));
    }
  } catch (err: any) {
    console.error("[syncBlingOrders] falha ao buscar canais de venda, origem cairá em PROPRIO:", err?.message || err);
  }
  return map;
}

/**
 * Descobre o(s) id(s) reais de situação "Em aberto" pra Pedidos de Venda NESTA conta Bling —
 * cada conta pode ter suas próprias situações/cores, então não dá pra chutar um id fixo (o
 * exemplo da doc da API mostra id=9 pra "Em aberto", mas isso não é garantido igual em toda
 * conta). Confirmado via github.com/AlexandreBellas/bling-erp-api-js: GET /situacoes/modulos
 * lista os módulos do sistema (o de pedidos de venda tem descricao="Pedidos de Venda"), e GET
 * /situacoes/modulos/{id} lista as situações desse módulo com nome e cor.
 */
async function resolveOpenSituationIds(accessToken: string): Promise<number[]> {
  try {
    const modulesResp = await blingCall<{ data: { id: number; nome: string; descricao: string }[] }>({
      accessToken,
      path: "situacoes/modulos",
    });
    console.log("[syncBlingOrders] situacoes/modulos:", JSON.stringify(modulesResp?.data));
    const vendasModule = modulesResp?.data?.find((m) => m.descricao === "Pedidos de Venda" || m.nome === "Vendas");
    if (!vendasModule) {
      console.log("[syncBlingOrders] módulo 'Pedidos de Venda' não encontrado na lista acima.");
      return [];
    }

    const situationsResp = await blingCall<{ data: { id: number; nome: string; idHerdado?: number }[] }>({
      accessToken,
      path: `situacoes/modulos/${vendasModule.id}`,
    });
    console.log(`[syncBlingOrders] situações do módulo ${vendasModule.id} (${vendasModule.nome}):`, JSON.stringify(situationsResp?.data));
    const ids = (situationsResp?.data || []).filter((s) => s.nome.trim().toLowerCase() === "em aberto").map((s) => s.id);
    console.log("[syncBlingOrders] ids resolvidos pra 'Em aberto':", JSON.stringify(ids));
    return ids;
  } catch (err: any) {
    console.error("[syncBlingOrders] falha ao resolver situação 'Em aberto', sync não vai filtrar por situação:", err?.message || err);
    return [];
  }
}

export interface SyncOrdersResult {
  ok: boolean;
  message: string;
  ordersImported: number;
}

// GET /situacoes/modulos retorna 403 "higher privileges" nesta conta mesmo com o escopo
// "Gerenciador de transições" marcado (testado 2026-08-11) — parece bloqueado independente do
// escopo escolhido, então não dá pra resolver o id de "Em aberto" via API de forma confiável.
// Em compensação, `situacao.valor` (campo numérico separado de `situacao.id`, esse sim sempre
// presente na resposta de GET /pedidos/vendas, que NÃO é bloqueado) bateu 100% com os pedidos
// que o usuário confirmou como "Em aberto" no Bling: os 7 pedidos abertos (14050-14056) tinham
// TODOS `valor: 0`, enquanto os +90 restantes (atendidos, cancelados etc.) tinham `valor: 1` ou
// `valor: 2` — confirmado direto nos dados reais da conta, não é um número inventado. `valor`
// parece ser o código de estado interno do Bling (mais estável entre contas do que `id`, que é
// específico de cada situação customizada). Se um dia GET /situacoes/modulos for liberado,
// resolveOpenSituationIds volta a ser tentado primeiro e o filtro por valor vira só uma
// segurança extra.
const OPEN_SITUATION_VALOR = 0;

/**
 * Busca pedidos de venda EM ABERTO do Bling (GET /pedidos/vendas, primeira página) e, pra cada
 * um, busca os itens (GET /pedidos/vendas/{id} — o endpoint de listagem não traz itens,
 * confirmado contra a definição real da API) pra marcar quais estão vinculados a um produto
 * local. Chamadas sequenciais (não paralelas) — mesma exigência de respeitar rate limit já
 * usada na emissão em lote.
 *
 * O filtro de "Em aberto" é aplicado no cliente por `situacao.valor === OPEN_SITUATION_VALOR`
 * (ver comentário acima) — se GET /situacoes/modulos conseguir resolver os ids de verdade,
 * usa idsSituacoes no servidor também, mas o filtro por valor sempre roda como garantia.
 *
 * A origem (loja própria vs. Mercado Livre vs. Shopee vs. outro) é resolvida via GET
 * /canais-venda + o campo `loja.id` do pedido — como a lista completa de tipos de canal não é
 * documentada publicamente, a classificação é uma heurística por substring (ver
 * classifyChannelType) que reconhece Shopee e Mercado Livre e agrupa o resto por "agrupador".
 */
export async function syncBlingOrders(db: firestore.Firestore, uid: string): Promise<SyncOrdersResult> {
  const accessToken = await getValidBlingAccessToken(db, uid);
  const mappedIds = await loadMappedBlingProductIds(db, uid);
  const channelOrigins = await loadSalesChannelOrigins(accessToken);
  const openSituationIds = await resolveOpenSituationIds(accessToken);

  const listResp = await blingCall<{
    data: { id: number; numero?: number; numeroLoja?: string; total?: number; contato?: { nome?: string }; situacao?: { id: number; valor: number } }[];
  }>({
    accessToken,
    path: "pedidos/vendas",
    query: { pagina: 1, limite: 100, ...(openSituationIds.length > 0 ? { idsSituacoes: openSituationIds } : {}) },
  });
  const allPedidos = listResp?.data || [];
  const pedidos = allPedidos.filter((p) => p.situacao?.valor === OPEN_SITUATION_VALOR);
  console.log(`[syncBlingOrders] ${allPedidos.length} pedido(s) retornado(s) pelo Bling, ${pedidos.length} em aberto (valor=${OPEN_SITUATION_VALOR}).`);

  const ordersRef = db.collection("users").doc(uid).collection("blingOrders");
  let imported = 0;

  for (const pedidoSummary of pedidos) {
    const docId = String(pedidoSummary.id);
    const existingSnap = await ordersRef.doc(docId).get();
    if (existingSnap.exists && existingSnap.data()?.status === "EMITIDA") {
      continue; // já emitida — não sobrescreve
    }

    const detail = await blingCall<{
      data: {
        id: number;
        numero?: number;
        total?: number;
        contato?: { nome?: string };
        loja?: { id: number };
        itens: { descricao: string; quantidade: number; valor: number; produto?: { id: number } }[];
      };
    }>({ accessToken, path: `pedidos/vendas/${pedidoSummary.id}` });

    const pedido = detail.data;
    const itens = (pedido.itens || []).map((it) => ({
      blingProdutoId: it.produto?.id ? String(it.produto.id) : "",
      descricao: it.descricao,
      quantidade: Number(it.quantidade || 0),
      valorUnitario: Number(it.valor || 0),
      mapeado: !!it.produto?.id && mappedIds.has(String(it.produto.id)),
    }));

    const allMapped = itens.length > 0 && itens.every((i) => i.mapeado);
    const now = Date.now();
    const origem = (pedido.loja?.id && channelOrigins.get(String(pedido.loja.id))) || "PROPRIO";

    await ordersRef.doc(docId).set(
      {
        id: docId,
        blingPedidoId: docId,
        numero: String(pedido.numero ?? pedidoSummary.numeroLoja ?? pedido.id),
        origem,
        cliente: pedido.contato?.nome || "Cliente não informado",
        valorTotal: Number(pedido.total || 0),
        itens,
        status: allMapped ? "PRONTO_PARA_EMITIR" : "PENDENTE",
        createdAt: existingSnap.exists ? existingSnap.data()?.createdAt || now : now,
        updatedAt: now,
      },
      { merge: true }
    );
    imported++;
  }

  // Limpa pedidos locais que não estão mais "Em aberto" no Bling (foram pagos/faturados/
  // cancelados por fora, ou — motivo do bug corrigido nesta versão — tinham sido importados
  // antes do filtro por situação existir). `pedidos` já vem filtrado por valor=0 acima
  // (confiável mesmo com GET /situacoes/modulos bloqueado), então a limpeza roda sempre.
  let removed = 0;
  {
    const currentOpenIds = new Set(pedidos.map((p) => String(p.id)));
    const staleSnap = await ordersRef.where("status", "in", ["PENDENTE", "PRONTO_PARA_EMITIR", "EMITINDO"]).get();
    for (const doc of staleSnap.docs) {
      if (!currentOpenIds.has(doc.id)) {
        await doc.ref.delete();
        removed++;
      }
    }
  }

  await db
    .collection("users")
    .doc(uid)
    .collection("blingConnections")
    .doc("bling")
    .set({ lastOrderSyncAt: Date.now() }, { merge: true });

  const message = removed > 0 ? `${imported} pedido(s) sincronizado(s), ${removed} removido(s) (não estão mais em aberto).` : `${imported} pedido(s) sincronizado(s).`;
  return { ok: true, message, ordersImported: imported };
}

export interface BlingEmissionResult {
  pedidoId: string;
  ok: boolean;
  notaFiscalId?: string;
  danfeUrl?: string;
  motivo?: string;
}

// Situação da NF-e (ISituacaoNfe): 5=Autorizada, 6=Emitida DANFE — os dois casos de "sucesso
// final". 2=Cancelada, 4=Rejeitada, 9=Denegada — falha definitiva. Qualquer outro valor fica
// como "ainda processando" (EMITINDO). Fonte: comentário da própria definição de tipo em
// github.com/AlexandreBellas/bling-erp-api-js (src/entities/nfes/types/situacao.type.ts).
const NFE_SITUACAO_SUCESSO = new Set([5, 6]);
const NFE_SITUACAO_FALHA = new Set([2, 4, 9]);

/**
 * Emite a NF-e de um pedido já sincronizado: gera a nota a partir do pedido de venda no Bling
 * (se ainda não tiver uma), envia pra autorização na SEFAZ e busca o resultado (link do DANFE
 * ou motivo de rejeição). Assume que o chamador já validou que todos os itens do pedido estão
 * vinculados — mas revalida aqui também, por segurança.
 */
export async function emitBlingInvoice(db: firestore.Firestore, uid: string, orderId: string): Promise<BlingEmissionResult> {
  const orderRef = db.collection("users").doc(uid).collection("blingOrders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return { pedidoId: orderId, ok: false, motivo: "Pedido não encontrado." };
  const order = orderSnap.data() as { blingPedidoId: string; itens: { mapeado: boolean }[]; notaFiscalId?: string };

  if (!order.itens.every((i) => i.mapeado)) {
    return { pedidoId: orderId, ok: false, motivo: "Pedido tem item sem vínculo de produto." };
  }

  try {
    const accessToken = await getValidBlingAccessToken(db, uid);

    let notaFiscalId = order.notaFiscalId;
    if (!notaFiscalId) {
      const gerado = await blingCall<{ idNotaFiscal?: number; data?: { idNotaFiscal?: number } }>({
        accessToken,
        method: "POST",
        path: `pedidos/vendas/${order.blingPedidoId}/gerar-nfe`,
      });
      const idNotaFiscal = gerado?.idNotaFiscal ?? gerado?.data?.idNotaFiscal;
      if (!idNotaFiscal) throw new Error("Bling não retornou o ID da nota fiscal gerada.");
      notaFiscalId = String(idNotaFiscal);
      await orderRef.set({ notaFiscalId, status: "EMITINDO", updatedAt: Date.now() }, { merge: true });
    }

    await blingCall({ accessToken, method: "POST", path: `nfe/${notaFiscalId}/enviar` });

    const find = await blingCall<{ data: { situacao?: number; linkDanfe?: string; linkPDF?: string } }>({
      accessToken,
      path: `nfe/${notaFiscalId}`,
    });
    const situacao = find?.data?.situacao;
    const danfeUrl = find?.data?.linkDanfe || find?.data?.linkPDF;

    if (situacao !== undefined && NFE_SITUACAO_FALHA.has(situacao)) {
      await orderRef.set({ status: "REJEITADA", motivoRejeicao: `Situação da NF-e: ${situacao}`, updatedAt: Date.now() }, { merge: true });
      return { pedidoId: orderId, ok: false, notaFiscalId, motivo: `Nota fiscal rejeitada/cancelada (situação ${situacao}).` };
    }

    const emitida = situacao !== undefined && NFE_SITUACAO_SUCESSO.has(situacao);
    await orderRef.set(
      {
        status: emitida ? "EMITIDA" : "EMITINDO",
        notaFiscalId,
        danfeUrl: danfeUrl || null,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return { pedidoId: orderId, ok: emitida, notaFiscalId, danfeUrl, motivo: emitida ? undefined : `Nota ainda em processamento (situação ${situacao}).` };
  } catch (err: any) {
    const motivo = err?.message || "Falha ao emitir nota fiscal.";
    await orderRef.set({ status: "REJEITADA", motivoRejeicao: motivo, updatedAt: Date.now() }, { merge: true });
    return { pedidoId: orderId, ok: false, motivo };
  }
}

/** Emissão em lote SEQUENCIAL (não paralela) — respeita rate limit do Bling e a numeração
 * sequencial da NF-e, exigência explícita da especificação original. */
export async function emitBlingInvoicesBatch(db: firestore.Firestore, uid: string, orderIds: string[]): Promise<BlingEmissionResult[]> {
  const results: BlingEmissionResult[] = [];
  for (const orderId of orderIds) {
    results.push(await emitBlingInvoice(db, uid, orderId));
  }
  return results;
}
