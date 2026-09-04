// Cópia mínima das funções puras de src/utils/stockPools.ts — o projeto de Functions compila
// separado do app (tsconfig próprio), não importa direto de src/. Mantido em sincronia manual
// por ora; unificar num pacote compartilhado é um fast-follow (ver plano da feature).

export type SaleTypeServer = "RETAIL" | "WHOLESALE";

export interface ProductLike {
  type: SaleTypeServer;
  saleTypes?: SaleTypeServer[];
}

export interface VariationLike {
  stock?: { [size: string]: number };
}

export function productHasSaleType(product: ProductLike | undefined, saleType: SaleTypeServer): boolean {
  if (!product) return false;
  if (product.saleTypes?.length) return product.saleTypes.includes(saleType);
  return product.type === saleType;
}

export function getWholesaleBoxes(product: ProductLike | undefined, variation: VariationLike | undefined): number {
  if (!productHasSaleType(product, "WHOLESALE")) return 0;
  return variation?.stock?.["WHOLESALE"] || 0;
}

/** Pares disponíveis por tamanho (Varejo) — zero se o produto não vende em Varejo. */
export function getRetailSizeAvailability(product: ProductLike | undefined, variation: VariationLike | undefined): { size: string; available: number }[] {
  if (!productHasSaleType(product, "RETAIL")) return [];
  if (!variation?.stock) return [];
  return Object.entries(variation.stock)
    .filter(([size]) => size !== "WHOLESALE")
    .map(([size, qty]) => ({ size, available: Number(qty) || 0 }))
    .filter((s) => s.available > 0);
}
