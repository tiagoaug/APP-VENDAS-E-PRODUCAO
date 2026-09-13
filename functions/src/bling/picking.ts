import type { firestore } from "firebase-admin";

export interface AbaterEstoqueItem {
  blingOrderId: string;
  blingProdutoId: string;
  quantidade: number;
}

export interface AbaterEstoqueResult {
  ok: boolean;
  message: string;
  itemsProcessed: number;
}

// Um produto/cor/tamanho dentro de um vínculo "kit" — espelha BlingMappingComponent do
// frontend (src/types.ts). Cópia inline de propósito: Functions é um projeto TS separado, sem
// import compartilhado com o frontend.
interface MappingComponent {
  productId: string;
  variationId: string;
  size?: string;
  quantidade: number;
}

// Mesmo normalizador do frontend (ver src/utils/blingMappingComponents.ts) — vínculo simples
// (sem `components`) vira um componente único de quantidade 1, kit usa `components` direto.
function getMappingComponents(mapping: any): MappingComponent[] {
  if (Array.isArray(mapping.components) && mapping.components.length > 0) return mapping.components;
  return [{ productId: mapping.productId, variationId: mapping.variationId, size: mapping.size, quantidade: 1 }];
}

/**
 * Abate do estoque local os itens marcados como separados na Lista de Separação: pra cada
 * (pedido, produto do Bling) informado, resolve o vínculo local (BlingProductMapping) e
 * desconta `quantidade` de `Variation.stock[tamanho]` (ou `stock['WHOLESALE']` pra atacado) —
 * mesma convenção de chave já usada no resto do app (ver marketplace/sync.ts `stockKeyFor`).
 * Marca o item como `separado: true` dentro do pedido, pra a Lista de Separação não contar de
 * novo numa próxima geração. Tudo numa única transação (lê tudo, escreve tudo — regra do
 * Firestore) pra não haver risco de abater duas vezes ou meio a meio em caso de falha.
 */
export async function abaterEstoqueBling(db: firestore.Firestore, uid: string, items: AbaterEstoqueItem[]): Promise<AbaterEstoqueResult> {
  if (items.length === 0) return { ok: true, message: "Nada selecionado pra abater.", itemsProcessed: 0 };

  const usersRef = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const orderIds = Array.from(new Set(items.map((i) => i.blingOrderId)));
    const orderRefs = orderIds.map((id) => usersRef.collection("blingOrders").doc(id));
    const orderSnaps = await Promise.all(orderRefs.map((ref) => tx.get(ref)));
    const orders = new Map(orderSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as any]));

    const mappingsSnap = await tx.get(usersRef.collection("blingProductMappings"));
    const mappingByBlingId = new Map(mappingsSnap.docs.map((d) => [(d.data() as any).blingProdutoId as string, d.data() as any]));

    const productIds = new Set<string>();
    for (const item of items) {
      const mapping = mappingByBlingId.get(item.blingProdutoId);
      if (!mapping) continue;
      for (const component of getMappingComponents(mapping)) productIds.add(component.productId);
    }
    const productRefs = Array.from(productIds).map((id) => usersRef.collection("products").doc(id));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
    const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as any]));

    // Vínculo simples = 1 componente (o próprio mapping, ver getMappingComponents); kit = vários
    // produtos abatidos juntos, cada um na sua própria quantidade (item.quantidade × quantidade
    // do componente). `key` usa só a presença de `size` (não mais mapping.saleType) — atacado já
    // sempre chega aqui sem size, então size||"WHOLESALE" sozinho já cobre os dois casos, e isso
    // deixa cada componente do kit livre pra ter seu próprio tamanho/atacado independente.
    for (const item of items) {
      const mapping = mappingByBlingId.get(item.blingProdutoId);
      if (!mapping) continue;
      for (const component of getMappingComponents(mapping)) {
        const product = products.get(component.productId);
        if (!product) continue;
        const variation = (product.variations || []).find((v: any) => v.id === component.variationId);
        if (!variation) continue;
        const key = component.size || "WHOLESALE";
        variation.stock = { ...(variation.stock || {}) };
        variation.stock[key] = Math.max(0, (variation.stock[key] || 0) - item.quantidade * component.quantidade);
      }
    }

    for (const [id, product] of products.entries()) {
      tx.set(usersRef.collection("products").doc(id), product, { merge: true });
    }

    for (const [orderId, order] of orders.entries()) {
      const orderItemIds = new Set(items.filter((i) => i.blingOrderId === orderId).map((i) => i.blingProdutoId));
      if (orderItemIds.size === 0) continue;
      const updatedItens = (order.itens || []).map((it: any) => (orderItemIds.has(it.blingProdutoId) ? { ...it, separado: true } : it));
      tx.set(usersRef.collection("blingOrders").doc(orderId), { itens: updatedItens, updatedAt: Date.now() }, { merge: true });
    }
  });

  return { ok: true, message: `Estoque abatido pra ${items.length} item(ns).`, itemsProcessed: items.length };
}
