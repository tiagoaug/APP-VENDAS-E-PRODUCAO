import { Product, SaleType, Variation, ProductionConfigItem, StockPkgAllocation } from '../types';

/** Quantos pares um padrão de embalagem carrega — `metadata.capacity` quando cadastrado
 * direto, senão soma de `metadata.sizeQuantities` (mesma fonte que PackagingBuilderModal/
 * PurchaseFormView já usam pra mostrar "N pares" de um padrão). */
function getPkgCapacity(pkg: ProductionConfigItem | undefined): number {
  if (!pkg?.metadata) return 0;
  if (pkg.metadata.capacity) return Number(pkg.metadata.capacity) || 0;
  const sizeQty = pkg.metadata.sizeQuantities as Record<string, number> | undefined;
  if (sizeQty) return Object.values(sizeQty).reduce((s, q) => s + (Number(q) || 0), 0);
  return 0;
}

/** Valor (custo OU venda, uma chamada por vez) do pool Atacado, prorateado por par quando
 * há preço unitário (`unitPrice`) cadastrado: cada padrão de embalagem em uso
 * (`stockPkgAllocations`) contribui `caixas × pares-do-padrão × unitPrice`, em vez de tratar
 * toda caixa como se tivesse o mesmo número de pares. Caixas "avulsas" (sem padrão vinculado)
 * e padrões sem capacidade cadastrada caem no preço fixo por caixa (`flatBoxPrice`), já que
 * não dá pra saber quantos pares têm — mesma base usada quando não há preço por par. */
function computeWholesalePoolValue(
  boxQty: number,
  flatBoxPrice: number,
  unitPrice: number | undefined,
  allocations: StockPkgAllocation[],
  packagingItems: ProductionConfigItem[],
): number {
  if (!unitPrice) return boxQty * flatBoxPrice;
  const totalAllocated = allocations.reduce((s, a) => s + (a.qty || 0), 0);
  let value = 0;
  allocations.forEach(a => {
    if ((a.qty || 0) <= 0) return;
    const capacity = getPkgCapacity(packagingItems.find(p => p.id === a.pkgId));
    value += capacity > 0 ? a.qty * capacity * unitPrice : a.qty * flatBoxPrice;
  });
  const residual = boxQty - totalAllocated;
  if (residual > 0) value += residual * flatBoxPrice;
  return value;
}

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
 * Valor (custo/venda) só do pool Atacado. Quando o produto tem preço por par cadastrado
 * (unitCostPrice/unitSalePrice — já existente pra todo produto Atacado, não só híbrido) E
 * há mais de um padrão de embalagem em uso (stockPkgAllocations), prorateia por padrão
 * (pares reais de cada caixa × preço por par) em vez de tratar toda caixa como do mesmo
 * tamanho — do contrário caixas de 12 e 15 pares, por exemplo, valeriam o mesmo. Sem preço
 * por par cadastrado, cai no cálculo antigo (preço fixo por caixa). `packagingItems` (Grids
 * tipo PACKAGING) é opcional — sem ele, não dá pra saber a capacidade de cada padrão, então
 * também cai no preço fixo.
 */
export function getWholesaleValue(
  product: Product | undefined,
  variation: Variation | undefined,
  packagingItems: ProductionConfigItem[] = [],
): { cost: number; sale: number } {
  if (!product) return { cost: 0, sale: 0 };
  const qty = getWholesaleBoxes(product, variation);
  const allocations = variation?.stockPkgAllocations || [];
  return {
    cost: computeWholesalePoolValue(qty, product.costPrice || 0, product.unitCostPrice, allocations, packagingItems),
    sale: computeWholesalePoolValue(qty, product.salePrice || 0, product.unitSalePrice, allocations, packagingItems),
  };
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
export function getStockValue(
  product: Product | undefined,
  variation: Variation | undefined,
  packagingItems: ProductionConfigItem[] = [],
): { costValue: number; saleValue: number } {
  const w = getWholesaleValue(product, variation, packagingItems);
  const r = getRetailValue(product, variation);
  return { costValue: w.cost + r.cost, saleValue: w.sale + r.sale };
}
