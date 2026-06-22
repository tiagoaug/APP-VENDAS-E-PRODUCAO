import { Product, SaleType, Variation } from '../types';

/**
 * Produto híbrido: vendido tanto em Atacado (caixas) quanto em Varejo (pares por
 * tamanho), com os dois saldos mantidos independentes dentro de Variation.stock
 * ('WHOLESALE' vs. chaves de tamanho).
 */
export function isHybridProduct(product: Product | undefined): boolean {
  return (product?.saleTypes?.length ?? 0) > 1;
}

export function productHasSaleType(product: Product | undefined, saleType: SaleType): boolean {
  if (!product) return false;
  if (product.saleTypes?.length) return product.saleTypes.includes(saleType);
  return product.type === saleType;
}

/**
 * Caixas do pool Atacado — zero se o produto não vende em Atacado, mesmo que
 * variation.stock tenha a chave 'WHOLESALE' com algum resíduo (produtos 100%
 * varejo nunca deveriam ter essa chave, mas o gate evita contar lixo de qualquer forma).
 */
export function getWholesaleBoxes(product: Product | undefined, variation: Variation | undefined): number {
  if (!productHasSaleType(product, SaleType.WHOLESALE)) return 0;
  return variation?.stock?.['WHOLESALE'] || 0;
}

/**
 * Pares do pool Varejo — zero se o produto não vende em Varejo. Importante: um
 * produto 100% Atacado pode ter chaves residuais por tamanho em variation.stock
 * (resíduo de produção/migração antiga) — sem este gate, esse resíduo era somado
 * como se fosse estoque de varejo real, inflando o valor estimado em Varejo para
 * produtos que nunca venderam por par.
 */
export function getRetailPairs(product: Product | undefined, variation: Variation | undefined): number {
  if (!productHasSaleType(product, SaleType.RETAIL)) return 0;
  if (!variation?.stock) return 0;
  return Object.entries(variation.stock).reduce((sum, [key, qty]) => key === 'WHOLESALE' ? sum : sum + (Number(qty) || 0), 0);
}

/**
 * Quantidade no pool único de um produto NÃO-híbrido — mesma fórmula já usada em
 * todo o código antes desta mudança (caixas para Atacado, soma de tudo para Varejo).
 * Para produto híbrido, soma os dois pools.
 */
export function getPoolQty(product: Product | undefined, variation: Variation | undefined): number {
  if (isHybridProduct(product)) {
    return getWholesaleBoxes(product, variation) + getRetailPairs(product, variation);
  }
  return product?.type === SaleType.WHOLESALE ? getWholesaleBoxes(product, variation) : getRetailPairs(product, variation);
}

/**
 * Valor (custo/venda) só do pool Atacado — caixas vezes preço por caixa. Zero para
 * produto sem pool Atacado.
 */
export function getWholesaleValue(product: Product | undefined, variation: Variation | undefined): { cost: number; sale: number } {
  if (!product) return { cost: 0, sale: 0 };
  const qty = getWholesaleBoxes(product, variation);
  return { cost: qty * (product.costPrice || 0), sale: qty * (product.salePrice || 0) };
}

/**
 * Valor (custo/venda) só do pool Varejo — pares vezes preço por par. Produto
 * híbrido usa unitCostPrice/unitSalePrice (preço por par, separado do preço por
 * caixa); produto 100% varejo usa costPrice/salePrice direto (já são por par).
 * Zero para produto sem pool Varejo.
 */
export function getRetailValue(product: Product | undefined, variation: Variation | undefined): { cost: number; sale: number } {
  if (!product) return { cost: 0, sale: 0 };
  const qty = getRetailPairs(product, variation);
  if (isHybridProduct(product)) {
    const unitCost = product.unitCostPrice ?? product.costPrice ?? 0;
    const unitSale = product.unitSalePrice ?? product.salePrice ?? 0;
    return { cost: qty * unitCost, sale: qty * unitSale };
  }
  return { cost: qty * (product.costPrice || 0), sale: qty * (product.salePrice || 0) };
}

/**
 * Valor de custo/venda total em estoque — soma dos dois pools (Atacado + Varejo).
 * Para produto NÃO-híbrido, equivale à fórmula única já usada em todo o código
 * antes desta mudança (só um dos dois pools é não-zero).
 */
export function getStockValue(product: Product | undefined, variation: Variation | undefined): { costValue: number; saleValue: number } {
  const w = getWholesaleValue(product, variation);
  const r = getRetailValue(product, variation);
  return { costValue: w.cost + r.cost, saleValue: w.sale + r.sale };
}
