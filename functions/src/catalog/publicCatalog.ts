import type { firestore } from "firebase-admin";
import * as admin from "firebase-admin";
import { getWholesaleBoxes, getRetailSizeAvailability, ProductLike, VariationLike, SaleTypeServer } from "./stockPoolsServer";

// Erro genérico único pra qualquer token inválido/expirado/revogado/inexistente — nunca revela
// o motivo real, pra não dar sinal nenhum a quem tenta adivinhar/enumerar tokens.
const LINK_NOT_FOUND_MESSAGE = "Link inválido ou expirado.";

/** Erro "seguro de mostrar" pro visitante público — index.ts só repassa `message` ao cliente
 * quando o erro É desta classe; qualquer outra exceção (índice do Firestore ainda
 * construindo, falha de rede, bug interno) vira um erro genérico + log no servidor, nunca
 * vaza detalhe interno pra fora. */
export class CatalogPublicError extends Error {}

interface CatalogLinkDoc {
  personId: string;
  token: string;
  isActive: boolean;
  createdAt: number;
  expiresAt: number | null;
  submissionCount?: number;
  lastSubmittedAt?: number;
  productIds?: string[];
  hidePrices?: boolean;
}

/** Resolve um token público pro dono (uid) + o próprio doc do link, via Admin SDK — ignora
 * completamente as regras do Firestore (o cliente nunca teria acesso a isso sozinho). Usa
 * collectionGroup porque o token não carrega o uid embutido (de propósito: um token não deve
 * ser "adivinhável" a partir de nada, nem o próprio uid). */
async function resolveCatalogLink(
  db: firestore.Firestore,
  token: string
): Promise<{ ownerId: string; linkRef: firestore.DocumentReference; link: CatalogLinkDoc } | null> {
  if (!token || typeof token !== "string" || token.length < 8 || token.length > 128) return null;

  const snap = await db.collectionGroup("catalogLinks").where("token", "==", token).limit(1).get();
  if (snap.empty) return null;

  const doc = snap.docs[0];
  const link = doc.data() as CatalogLinkDoc;
  if (!link.isActive) return null;
  if (link.expiresAt && link.expiresAt < Date.now()) return null;

  // doc.ref.path é users/{ownerId}/catalogLinks/{linkId}
  const ownerId = doc.ref.parent.parent?.id;
  if (!ownerId) return null;

  return { ownerId, linkRef: doc.ref, link };
}

export interface PublicCatalogVariation {
  variationId: string;
  colorName: string;
  photoUrl?: string;
  photoAlbum?: string[]; // fotos extras opcionais DESTA COR, só pro cliente ver mais ângulos/detalhes
  saleType: SaleTypeServer;
  sizes: { size?: string; available: number }[]; // size ausente = item de Atacado (caixas)
}

export interface PublicCatalogProduct {
  productId: string;
  reference: string;
  name: string;
  photoUrl?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  variations: PublicCatalogVariation[];
  // Ambos ausentes quando o link está configurado como "sem valores" (CatalogLink.hidePrices)
  // — nesse caso o cliente só escolhe modelo/cor/quantidade, sem ver preço nenhum. Presentes
  // conforme o produto vender por par e/ou por caixa (um produto híbrido tem os dois).
  pricePerPair?: number;
  pricePerBox?: number;
}

export interface GetPublicCatalogResult {
  personId: string;
  products: PublicCatalogProduct[];
}

/** Catálogo público e curado pra um token de Link de Pedido — só campos seguros de mostrar a
 * um cliente: nunca custo, fornecedor, ou dado de outro cliente. Tamanho/variação sem estoque
 * nem aparece (evita vazar "quanto tem" de algo zerado). */
export async function getPublicCatalog(db: firestore.Firestore, token: string): Promise<GetPublicCatalogResult> {
  const resolved = await resolveCatalogLink(db, token);
  if (!resolved) throw new CatalogPublicError(LINK_NOT_FOUND_MESSAGE);
  const { ownerId, linkRef, link } = resolved;

  // Se o link restringe produtos, filtra já na leitura — nunca manda pro cliente nem os
  // metadados de um produto fora da lista permitida.
  const allowedIds = Array.isArray(link.productIds) && link.productIds.length > 0 ? new Set(link.productIds) : null;

  const [productsSnap, categoriesSnap, brandsSnap] = await Promise.all([
    db.collection("users").doc(ownerId).collection("products").where("status", "==", "ACTIVE").get(),
    db.collection("users").doc(ownerId).collection("categories").get().catch(() => null),
    db.collection("users").doc(ownerId).collection("brands").get().catch(() => null),
  ]);

  const categoryNames = new Map<string, string>();
  categoriesSnap?.forEach((doc) => {
    const c = doc.data() as any;
    if (c?.name) categoryNames.set(doc.id, c.name);
  });

  const brandNames = new Map<string, string>();
  brandsSnap?.forEach((doc) => {
    const b = doc.data() as any;
    if (b?.name) brandNames.set(doc.id, b.name);
  });

  const products: PublicCatalogProduct[] = [];
  productsSnap.forEach((doc) => {
    if (allowedIds && !allowedIds.has(doc.id)) return;

    const p = doc.data() as any;
    const productLike: ProductLike = { type: p.type, saleTypes: p.saleTypes };
    const variations: PublicCatalogVariation[] = [];
    let hasRetail = false;
    let hasWholesale = false;

    for (const v of p.variations || []) {
      const variationLike: VariationLike = { stock: v.stock };
      const retailSizes = getRetailSizeAvailability(productLike, variationLike);
      const boxes = getWholesaleBoxes(productLike, variationLike);

      const sizes: { size?: string; available: number }[] = [...retailSizes];
      if (boxes > 0) sizes.push({ available: boxes });
      if (sizes.length === 0) continue; // nada disponível nessa cor — não mostra

      if (retailSizes.length > 0) hasRetail = true;
      if (boxes > 0) hasWholesale = true;

      variations.push({
        variationId: v.id,
        colorName: v.colorName,
        photoUrl: v.photoUrl,
        ...(Array.isArray(v.photoAlbum) && v.photoAlbum.length > 0 ? { photoAlbum: v.photoAlbum } : {}),
        saleType: p.type,
        sizes,
      });
    }

    if (variations.length === 0) return; // produto sem nada disponível — não mostra

    // costPrice/salePrice são sempre por CAIXA; unitCostPrice/unitSalePrice são por PAR, só
    // preenchidos quando o produto vende no par (Varejo puro ou Híbrido) — ver ProductFormView
    // (profitPerBox usa salePrice, profitPerPair usa unitSalePrice).
    const pricePerBox = hasWholesale ? (p.salePrice || 0) : undefined;
    const pricePerPair = hasRetail ? (p.unitSalePrice > 0 ? p.unitSalePrice : p.salePrice || 0) : undefined;

    products.push({
      productId: doc.id,
      reference: p.reference,
      name: p.name,
      photoUrl: p.photoUrl,
      ...(p.brandId && brandNames.has(p.brandId) ? { brandName: brandNames.get(p.brandId) } : {}),
      ...(p.categoryId ? { categoryId: p.categoryId, categoryName: categoryNames.get(p.categoryId) } : {}),
      variations,
      ...(link.hidePrices ? {} : {
        ...(pricePerPair !== undefined ? { pricePerPair } : {}),
        ...(pricePerBox !== undefined ? { pricePerBox } : {}),
      }),
    });
  });

  // Melhor esforço — nunca falha a resposta principal por causa disso.
  linkRef.set({ lastViewedAt: Date.now() }, { merge: true }).catch(() => {});

  return { personId: resolved.link.personId, products };
}

export interface SubmitCatalogRequestInput {
  token: string;
  items: {
    productId: string;
    saleType: SaleTypeServer;
    variations: { variationId: string; size?: string; quantity: number }[];
  }[];
  customerNote?: string;
}

const MAX_ITEMS = 30;
const MAX_VARIATIONS_PER_ITEM = 20;
const MAX_QUANTITY = 999;
const MAX_NOTE_LENGTH = 500;
const MAX_SUBMISSIONS_PER_HOUR = 5;

/** Recebe a escolha do cliente e grava como PENDING pro dono revisar — nunca confia em preço,
 * ownerId ou personId vindos do cliente (tudo é re-resolvido a partir do token), e revalida
 * cada produto/variação contra o catálogo real antes de gravar qualquer coisa. */
export async function submitCatalogRequest(db: firestore.Firestore, input: SubmitCatalogRequestInput): Promise<{ requestId: string }> {
  const resolved = await resolveCatalogLink(db, input.token);
  if (!resolved) throw new CatalogPublicError(LINK_NOT_FOUND_MESSAGE);
  const { ownerId, linkRef, link } = resolved;

  // Limite simples de envios por link, sem infra nova (contador no próprio doc do link).
  const now = Date.now();
  if (link.lastSubmittedAt && now - link.lastSubmittedAt < (60 * 60 * 1000) / MAX_SUBMISSIONS_PER_HOUR) {
    throw new CatalogPublicError("Aguarde um pouco antes de enviar outro pedido por este link.");
  }

  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length === 0 || items.length > MAX_ITEMS) {
    throw new CatalogPublicError("Quantidade de itens inválida.");
  }

  // Mesma restrição de produtos do link aplicada na leitura do catálogo — reforçada aqui pra
  // um cliente nunca conseguir pedir um produto que o link dele nem mostra.
  const allowedIds = Array.isArray(link.productIds) && link.productIds.length > 0 ? new Set(link.productIds) : null;

  const productsCol = db.collection("users").doc(ownerId).collection("products");
  const cleanItems: SubmitCatalogRequestInput["items"] = [];

  for (const item of items) {
    if (typeof item.productId !== "string" || (item.saleType !== "RETAIL" && item.saleType !== "WHOLESALE")) {
      throw new CatalogPublicError("Item de pedido inválido.");
    }
    if (allowedIds && !allowedIds.has(item.productId)) {
      throw new CatalogPublicError("Produto inválido.");
    }
    const variations = Array.isArray(item.variations) ? item.variations : [];
    if (variations.length === 0 || variations.length > MAX_VARIATIONS_PER_ITEM) {
      throw new CatalogPublicError("Item de pedido inválido.");
    }

    const productSnap = await productsCol.doc(item.productId).get();
    if (!productSnap.exists) throw new CatalogPublicError("Produto inválido.");
    const product = productSnap.data() as any;
    if (product.status !== "ACTIVE") throw new CatalogPublicError("Produto indisponível.");
    const variationIds = new Set((product.variations || []).map((v: any) => v.id));

    const cleanVariations: { variationId: string; size?: string; quantity: number }[] = [];
    for (const v of variations) {
      if (!variationIds.has(v.variationId)) throw new CatalogPublicError("Variação inválida.");
      const quantity = Math.floor(Number(v.quantity));
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        throw new CatalogPublicError("Quantidade inválida.");
      }
      cleanVariations.push({
        variationId: v.variationId,
        ...(v.size ? { size: String(v.size) } : {}),
        quantity,
      });
    }
    cleanItems.push({ productId: item.productId, saleType: item.saleType, variations: cleanVariations });
  }

  const customerNote = typeof input.customerNote === "string" ? input.customerNote.slice(0, MAX_NOTE_LENGTH) : undefined;

  const requestRef = db.collection("users").doc(ownerId).collection("catalogRequests").doc();
  await requestRef.set({
    linkId: linkRef.id,
    personId: link.personId,
    status: "PENDING",
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    items: cleanItems,
    ...(customerNote ? { customerNote } : {}),
  });

  await linkRef.set({ lastSubmittedAt: now, submissionCount: (link.submissionCount || 0) + 1 }, { merge: true });

  return { requestId: requestRef.id };
}
