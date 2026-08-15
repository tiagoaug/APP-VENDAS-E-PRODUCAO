import type { firestore } from "firebase-admin";
import { blingCall } from "./blingClient";
import { getValidBlingAccessToken } from "./auth";
import { consumeNotesForNewOrder } from "./notes";

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
  // "Livro de vendas" — registro leve e permanente de todo pedido com NF-e já autorizada/emitida
  // (ver loop dedicado depois da limpeza abaixo), usado só pelo Painel de Saúde pra contar pares
  // vendidos. Existe separado de `blingOrders` porque `blingOrders` só guarda pedidos "Em
  // aberto" (voltado pro fluxo de emissão de NF-e) — um pedido que o Bling fatura/atende rápido
  // (antes do próximo sync) sai de "Em aberto" sem nunca ter entrado em `blingOrders`, e sem
  // esse ledger separado essa venda nunca seria contada em lugar nenhum do app.
  const ledgerRef = db.collection("users").doc(uid).collection("blingSalesLedger");
  // Cache do detalhe já buscado pra cada pedido "em aberto" processado no loop abaixo, reusado
  // no loop do livro de vendas logo depois — evita rebuscar o mesmo pedido duas vezes.
  const pedidoDetailCache = new Map<string, { itens: { quantidade: number }[]; notaFiscalId?: number; origem: string; valorTotal: number; numero: string; dataVenda: number }>();
  let imported = 0;

  for (const pedidoSummary of pedidos) {
    const docId = String(pedidoSummary.id);
    const existingSnap = await ordersRef.doc(docId).get();
    if (existingSnap.exists && existingSnap.data()?.status === "EMITIDA") {
      continue; // já emitida — não sobrescreve
    }
    const isNewOrder = !existingSnap.exists;

    const detail = await blingCall<{
      data: {
        id: number;
        numero?: number;
        total?: number;
        contato?: { nome?: string };
        loja?: { id: number };
        notaFiscal?: { id: number };
        data?: string; // data do pedido — "YYYY-MM-DD" (campo `data` do IFindResponse de pedidosVendas)
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
    const numero = String(pedido.numero ?? pedidoSummary.numeroLoja ?? pedido.id);
    const dataVenda = pedido.data ? new Date(pedido.data).getTime() : now;

    pedidoDetailCache.set(docId, {
      itens: itens.map((i) => ({ quantidade: i.quantidade })),
      notaFiscalId: pedido.notaFiscal?.id,
      origem,
      valorTotal: Number(pedido.total || 0),
      numero,
      dataVenda,
    });

    await ordersRef.doc(docId).set(
      {
        id: docId,
        blingPedidoId: docId,
        numero,
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

    if (isNewOrder) {
      const pares = itens.reduce((s, i) => s + i.quantidade, 0);
      await consumeNotesForNewOrder(db, uid, docId, pares);
    }
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

  // Autorizada → Concluída: a situação do PEDIDO (não da NF-e) é um dado separado que também
  // pode avançar sozinho no Bling depois que a nota já foi autorizada por aqui (ex.: alguém
  // marca o pedido como "Atendido" direto no site, ou o próprio Bling avança automaticamente).
  // Reaproveita o mesmo sinal já validado (`situacao.valor !== OPEN_SITUATION_VALOR`) — só que
  // agora aplicado a pedidos que JÁ estão EMITIDA aqui, em vez de servir só pra decidir limpeza.
  // Limitação conhecida: só enxerga pedidos que ainda estão na 1ª página (100) da listagem.
  {
    const situacaoByPedidoId = new Map(allPedidos.map((p) => [String(p.id), p.situacao?.valor]));
    const emitidaSnap = await ordersRef.where("status", "==", "EMITIDA").get();
    for (const doc of emitidaSnap.docs) {
      const valor = situacaoByPedidoId.get(doc.id);
      if (valor !== undefined && valor !== OPEN_SITUATION_VALOR) {
        await doc.ref.set({ status: "CONCLUIDA", updatedAt: Date.now() }, { merge: true });
      }
    }
  }

  // Livro de vendas — roda pra TODOS os pedidos vistos nessa página (abertos ou não), não só os
  // novos, porque um pedido pode ainda não ter DANFE numa sincronização e ganhar depois. Só
  // conta como "venda" quem tem `notaFiscal` vinculada E a NF-e está com situação
  // Autorizada/Emitida DANFE (NFE_SITUACAO_SUCESSO, mesmo critério da emissão) — não usa
  // "saiu de Em aberto" como proxy aqui porque isso também inclui cancelamentos, cujo
  // significado exato dos outros valores de `situacao.valor` não é conhecido (ver comentário de
  // OPEN_SITUATION_VALOR acima).
  for (const p of allPedidos) {
    const docId = String(p.id);
    const existingLedgerSnap = await ledgerRef.doc(docId).get();
    // Entradas gravadas antes do campo `dataVenda` existir (versão anterior deste código, que
    // usava a data de descoberta em vez da data real do pedido) ficam com o filtro de período
    // quebrado — repara aqui em vez de deixar erradas pra sempre.
    const needsDateRepair = existingLedgerSnap.exists && (existingLedgerSnap.data() as any)?.dataVenda === undefined;
    if (existingLedgerSnap.exists && !needsDateRepair) continue;

    let cached = pedidoDetailCache.get(docId);
    if (!cached) {
      try {
        const detail = await blingCall<{
          data: { numero?: number; total?: number; loja?: { id: number }; notaFiscal?: { id: number }; itens?: { quantidade: number }[]; data?: string };
        }>({ accessToken, path: `pedidos/vendas/${p.id}` });
        const d = detail.data;
        cached = {
          itens: (d.itens || []).map((it) => ({ quantidade: Number(it.quantidade || 0) })),
          notaFiscalId: d.notaFiscal?.id,
          origem: (d.loja?.id && channelOrigins.get(String(d.loja.id))) || "PROPRIO",
          valorTotal: Number(d.total || 0),
          numero: String(d.numero ?? p.numeroLoja ?? p.id),
          dataVenda: d.data ? new Date(d.data).getTime() : Date.now(),
        };
      } catch (err: any) {
        console.warn(`[syncBlingOrders] Falha ao buscar detalhe do pedido ${docId} pro livro de vendas:`, err?.message || err);
        continue;
      }
    }

    if (needsDateRepair) {
      await ledgerRef.doc(docId).set({ dataVenda: cached.dataVenda }, { merge: true });
      continue;
    }

    if (!cached.notaFiscalId) continue; // sem NF-e gerada ainda — não é uma venda confirmada

    try {
      const { situacao } = await fetchNfeDetails(accessToken, String(cached.notaFiscalId));
      if (situacao === undefined || !NFE_SITUACAO_SUCESSO.has(situacao)) continue; // DANFE ainda não autorizado

      const pares = cached.itens.reduce((s, i) => s + i.quantidade, 0);
      await ledgerRef.doc(docId).set({
        id: docId,
        numero: cached.numero,
        origem: cached.origem,
        totalPares: pares,
        valorTotal: cached.valorTotal,
        dataVenda: cached.dataVenda,
        createdAt: Date.now(),
      });
    } catch (err: any) {
      console.warn(`[syncBlingOrders] Falha ao checar NF-e do pedido ${docId} pro livro de vendas:`, err?.message || err);
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

/**
 * Roda a sincronização automática de pedidos pra todo usuário Bling conectado que tenha
 * configurado um intervalo (`autoSyncIntervalMinutes`, ver `blingSetAutoSyncInterval` em
 * index.ts) e já tenha passado tempo suficiente desde o último sync (`lastOrderSyncAt`).
 * Chamada pelo `blingAutoSyncScheduler` (index.ts), que dispara a cada 5 minutos — esse é o grão
 * mínimo de precisão possível pra qualquer intervalo configurado (um intervalo de 15min pode
 * atrasar até ~5min do horário exato, por exemplo).
 *
 * Usa uma Collection Group Query em `blingConnections` (varre a subcoleção em QUALQUER
 * usuário) em vez de listar `users` e depois ler a subcoleção de cada um — `saveBlingCredentials`
 * (auth.ts) nunca dá um `.set()` direto no documento `users/{uid}`, só escreve nas subcoleções
 * dele (`blingIntegration`, `blingConnections`), então esse documento pai nunca "existe" de
 * verdade pro Firestore; `db.collection("users").get()` (a abordagem antiga) SEMPRE voltava
 * vazio por causa disso — a sincronização automática nunca rodava pra ninguém, silenciosamente
 * (o loop simplesmente não tinha nenhum uid pra iterar). Collection group query não depende do
 * documento pai existir, só das subcoleções — e como não tem nenhum filtro/orderBy, não precisa
 * de índice composto extra no Firestore.
 */
export async function runAutoSyncForDueUsers(db: firestore.Firestore): Promise<void> {
  const connsSnap = await db.collectionGroup("blingConnections").get();
  const now = Date.now();
  let notConnected = 0, noInterval = 0, notDue = 0, ran = 0;

  for (const connDoc of connsSnap.docs) {
    if (connDoc.id !== "bling") continue; // só o doc fixo de conexão, não outros docs futuros na mesma subcoleção
    const uid = connDoc.ref.parent.parent?.id;
    if (!uid) continue;
    try {
      const conn = connDoc.data() as { connected?: boolean; autoSyncIntervalMinutes?: number | null; lastOrderSyncAt?: number };
      if (!conn.connected) { notConnected++; continue; }
      if (!conn.autoSyncIntervalMinutes) { noInterval++; continue; }

      const dueAt = (conn.lastOrderSyncAt || 0) + conn.autoSyncIntervalMinutes * 60_000;
      if (now < dueAt) {
        notDue++;
        console.log(`[blingAutoSync] uid=${uid} ainda não é hora — faltam ${Math.round((dueAt - now) / 60_000)}min (intervalo=${conn.autoSyncIntervalMinutes}min, último sync=${conn.lastOrderSyncAt ? new Date(conn.lastOrderSyncAt).toISOString() : "nunca"}).`);
        continue;
      }

      ran++;
      await syncBlingOrders(db, uid);
      console.log(`[blingAutoSync] Sincronização automática executada pra uid=${uid}.`);
    } catch (err: any) {
      console.error(`[blingAutoSync] Falha ao sincronizar uid=${uid}:`, err?.message || err);
    }
  }
  console.log(`[blingAutoSync] Resumo: ${connsSnap.docs.length} conexão(ões) Bling encontrada(s), ${notConnected} desconectada(s), ${noInterval} sem intervalo configurado (Manual), ${notDue} com intervalo mas ainda não venceu, ${ran} sincronizada(s) agora.`);
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

interface NfeEtiqueta {
  nome?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

/** GET nfe/{id} — mesma consulta usada tanto ao emitir quanto ao só atualizar os dados de uma
 * nota já existente (ver `refreshBlingInvoiceDetails`), fatorada aqui pra não duplicar a lógica
 * de extração dos campos (ver comentário mais detalhado sobre `linkDanfe`/`linkPDF` abaixo). */
async function fetchNfeDetails(accessToken: string, notaFiscalId: string) {
  const find = await blingCall<{
    data: {
      situacao?: number;
      numero?: number;
      linkDanfe?: string;
      linkPDF?: string;
      transporte?: { etiqueta?: NfeEtiqueta };
    };
  }>({ accessToken, path: `nfe/${notaFiscalId}` });

  const situacao = find?.data?.situacao;
  // `linkDanfe` e `linkPDF` são dois campos distintos na resposta do Bling (fonte:
  // AlexandreBellas/bling-erp-api-js, src/entities/nfes/interfaces/find.interface.ts) — na
  // prática ambos costumam apontar pro mesmo DANFE completo hospedado pelo Bling. A API v3 não
  // expõe um campo separado para o "DANFE Simplificado + Etiqueta de Transporte" que aparece no
  // menu de impressão do site do Bling (isso é um recurso só da interface web deles); por isso
  // guardamos os dois links que a API realmente devolve, e a etiqueta de transporte (endereço
  // do destinatário) é montada no próprio app a partir de `transporte.etiqueta`.
  const danfeUrl = find?.data?.linkDanfe || find?.data?.linkPDF;
  const pdfUrl = find?.data?.linkPDF && find.data.linkPDF !== danfeUrl ? find.data.linkPDF : undefined;
  const notaNumero = find?.data?.numero ? String(find.data.numero) : undefined;
  const etiquetaTransporte = find?.data?.transporte?.etiqueta;

  return { situacao, danfeUrl, pdfUrl, notaNumero, etiquetaTransporte };
}

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

    let enviarErr: any;
    try {
      await blingCall({ accessToken, method: "POST", path: `nfe/${notaFiscalId}/enviar` });
    } catch (err: any) {
      // Bling responde 400 aqui quando a nota já foi enviada/autorizada antes (ex.: reprocessamento
      // após timeout, clique duplo, ou re-execução de um lote que já tinha emitido essa nota) — não é
      // necessariamente uma falha real. Em vez de assumir erro na hora, guarda o erro e deixa a
      // consulta de situação logo abaixo confirmar o estado real da nota no Bling; só é tratado como
      // falha de fato se a situação não vier como autorizada/emitida (ver abaixo).
      enviarErr = err;
      console.warn(`Bling nfe/${notaFiscalId}/enviar falhou (pedido ${orderId}), verificando situação real antes de desistir:`, err?.message);
    }

    const { situacao, danfeUrl, pdfUrl, notaNumero, etiquetaTransporte } = await fetchNfeDetails(accessToken, notaFiscalId);

    if (situacao !== undefined && NFE_SITUACAO_FALHA.has(situacao)) {
      await orderRef.set({ status: "REJEITADA", motivoRejeicao: `Situação da NF-e: ${situacao}`, updatedAt: Date.now() }, { merge: true });
      return { pedidoId: orderId, ok: false, notaFiscalId, motivo: `Nota fiscal rejeitada/cancelada (situação ${situacao}).` };
    }

    const emitida = situacao !== undefined && NFE_SITUACAO_SUCESSO.has(situacao);

    // Situação não confirma sucesso E a chamada de envio realmente falhou (não foi só um "já
    // enviada antes") — aí sim é uma falha de verdade, com o motivo original do Bling.
    if (!emitida && enviarErr) {
      const motivo = enviarErr?.message || "Falha ao enviar nota fiscal.";
      await orderRef.set({ status: "REJEITADA", motivoRejeicao: motivo, notaFiscalId, updatedAt: Date.now() }, { merge: true });
      return { pedidoId: orderId, ok: false, notaFiscalId, motivo };
    }

    await orderRef.set(
      {
        status: emitida ? "EMITIDA" : "EMITINDO",
        notaFiscalId,
        notaNumero: notaNumero || null,
        danfeUrl: danfeUrl || null,
        pdfUrl: pdfUrl || null,
        etiquetaTransporte: etiquetaTransporte || null,
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

/**
 * Só busca e atualiza os dados de uma nota fiscal já gerada (número, DANFE, PDF, etiqueta de
 * transporte) — sem chamar `/enviar` de novo. Usado pra "preencher" pedidos que foram emitidos
 * antes desses campos existirem (ex.: notas autorizadas antes desse deploy) e pra atualizar o
 * status de pedidos que ainda estavam "EMITINDO" da última vez que foram consultados.
 */
export async function refreshBlingInvoiceDetails(db: firestore.Firestore, uid: string, orderId: string): Promise<BlingEmissionResult> {
  const orderRef = db.collection("users").doc(uid).collection("blingOrders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return { pedidoId: orderId, ok: false, motivo: "Pedido não encontrado." };
  const order = orderSnap.data() as { notaFiscalId?: string };
  if (!order.notaFiscalId) return { pedidoId: orderId, ok: false, motivo: "Pedido ainda não tem nota fiscal gerada." };

  try {
    const accessToken = await getValidBlingAccessToken(db, uid);
    const { situacao, danfeUrl, pdfUrl, notaNumero, etiquetaTransporte } = await fetchNfeDetails(accessToken, order.notaFiscalId);
    const emitida = situacao !== undefined && NFE_SITUACAO_SUCESSO.has(situacao);
    const falhou = situacao !== undefined && NFE_SITUACAO_FALHA.has(situacao);

    await orderRef.set(
      {
        status: falhou ? "REJEITADA" : emitida ? "EMITIDA" : "EMITINDO",
        ...(falhou ? { motivoRejeicao: `Situação da NF-e: ${situacao}` } : {}),
        notaNumero: notaNumero || null,
        danfeUrl: danfeUrl || null,
        pdfUrl: pdfUrl || null,
        etiquetaTransporte: etiquetaTransporte || null,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return {
      pedidoId: orderId,
      ok: emitida,
      notaFiscalId: order.notaFiscalId,
      danfeUrl,
      motivo: emitida ? undefined : `Situação atual da nota: ${situacao ?? "desconhecida"}.`,
    };
  } catch (err: any) {
    return { pedidoId: orderId, ok: false, motivo: err?.message || "Falha ao atualizar dados da nota fiscal." };
  }
}
