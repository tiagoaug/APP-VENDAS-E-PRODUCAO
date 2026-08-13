import { Product, SaleType, Variation } from '../types';
import { BlingRemoteProduct } from '../services/blingService';

function normalize(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Distância de Levenshtein padrão (matriz O(n*m)) — não existe biblioteca disso no projeto,
// e o volume de comparações aqui (catálogo local × catálogo Bling) é pequeno o suficiente
// pra não precisar de nada mais sofisticado.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export interface LocalSkuEntry {
  product: Product;
  variation: Variation;
  size?: string; // undefined = ATACADO (stock['WHOLESALE'])
  saleType: SaleType;
  sku: string; // normalizado
  rawSku: string;
}

/** "Achata" o catálogo local pra um índice pesquisável de SKUs por variação/tamanho — o campo
 * `Variation.sku` do app não é por tamanho, então cada tamanho de uma cor com SKU cadastrado
 * vira uma entrada candidata separada (1 SKU por cor, o tamanho é escolhido/confirmado por
 * quem vincula). */
export function buildLocalSkuIndex(products: Product[]): LocalSkuEntry[] {
  const entries: LocalSkuEntry[] = [];
  for (const product of products) {
    for (const variation of product.variations) {
      if (!variation.sku) continue;
      const isHybrid = !!product.saleTypes && product.saleTypes.length > 1;
      const saleTypes = isHybrid ? product.saleTypes! : [product.type];
      for (const saleType of saleTypes) {
        if (saleType === SaleType.WHOLESALE) {
          entries.push({ product, variation, size: undefined, saleType, sku: normalize(variation.sku), rawSku: variation.sku });
        } else {
          for (const size of Object.keys(variation.stock)) {
            entries.push({ product, variation, size, saleType, sku: normalize(variation.sku), rawSku: variation.sku });
          }
        }
      }
    }
  }
  return entries;
}

export type BlingSuggestionOrigin = 'AUTOMATICO_SKU' | 'SIMILAR' | 'NENHUM';

export interface BlingSuggestion {
  origin: BlingSuggestionOrigin;
  entry: LocalSkuEntry | null;
  distance?: number; // só presente quando origin === 'SIMILAR'
}

/** Sugere um vínculo local pra um produto do Bling — SKU normalizado idêntico (alta confiança,
 * pode auto-confirmar) ou distância de Levenshtein < 2 entre os códigos (precisa confirmação
 * manual). Sem campo de GTIN no catálogo local hoje, então esse nível do algoritmo original da
 * especificação não tem contrapartida pra comparar — fica documentado aqui, não inventado. */
export function suggestMatch(blingProduct: BlingRemoteProduct, index: LocalSkuEntry[]): BlingSuggestion {
  const blingCode = normalize(blingProduct.codigo || '');
  if (!blingCode) return { origin: 'NENHUM', entry: null };

  const exact = index.find((e) => e.sku === blingCode);
  if (exact) return { origin: 'AUTOMATICO_SKU', entry: exact };

  let best: LocalSkuEntry | null = null;
  let bestDistance = Infinity;
  for (const e of index) {
    const d = levenshtein(blingCode, e.sku);
    if (d < bestDistance) {
      bestDistance = d;
      best = e;
    }
  }
  if (best && bestDistance < 2) {
    return { origin: 'SIMILAR', entry: best, distance: bestDistance };
  }
  return { origin: 'NENHUM', entry: null };
}
