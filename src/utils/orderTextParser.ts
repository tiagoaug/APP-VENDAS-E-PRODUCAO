import { Product, ProductStatus, Variation, Grid, Person, SaleType, OrderTextAlias } from '../types';
import { isHybridProduct, productHasSaleType } from './stockPools';

// Reconhecimento de "Pedido Digitado" colado (texto livre, tipo WhatsApp) — tenta casar cada
// linha contra o catálogo (referência/nome, cor, tamanho, quantidade) e devolve um resultado
// pra REVISÃO, nunca pra criação automática. Nada aqui vira Sale sozinho — ver PasteOrderModal.

// ── Normalização (mesma técnica de src/utils/helpMatching.ts, duplicada aqui de propósito —
// é assim que src/utils/blingReconciliation.ts também faz, não existe um util compartilhado
// de normalização de texto no projeto ainda). ──────────────────────────────────────────────
const DIACRITIC_RANGE = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_RANGE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreAgainst(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;
  const haystack = new Set(targetTokens);
  let score = 0;
  for (const t of queryTokens) {
    if (haystack.has(t)) score += 1;
    else if ([...haystack].some(h => h.includes(t) || t.includes(h))) score += 0.5;
  }
  return score / queryTokens.length;
}

const NAME_MATCH_THRESHOLD = 0.34; // mesmo limiar de helpMatching.ts
const CUSTOMER_MATCH_THRESHOLD = 0.5; // mais rígido — nome de cliente é achado "por eliminação"

function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) { seen.add(k); result.push(item); }
  }
  return result;
}

// ── Índice de candidatos — achata o catálogo inteiro num array (um item por variação×tamanho
// pra Varejo, um por variação pra Atacado), molde de buildLocalSkuIndex em blingReconciliation.ts. ──
export interface OrderLineCandidate {
  product: Product;
  variation: Variation;
  size?: string; // undefined = candidato de Atacado (grade/caixa)
  saleType: SaleType;
  referenceNorm: string;
  nameNorm: string;
  colorNorm: string;
}

export function buildOrderCandidateIndex(products: Product[], grids: Grid[] = []): OrderLineCandidate[] {
  const candidates: OrderLineCandidate[] = [];
  const activeProducts = products.filter(p => !p.status || p.status === ProductStatus.ACTIVE);

  activeProducts.forEach(product => {
    const referenceNorm = normalizeText(product.reference);
    const nameNorm = normalizeText(product.name);
    const grid = grids.find(g => g.id === product.defaultGridId);
    const supportsRetail = productHasSaleType(product, SaleType.RETAIL);
    const supportsWholesale = productHasSaleType(product, SaleType.WHOLESALE);

    product.variations.forEach(variation => {
      const colorNorm = normalizeText(variation.colorName);

      if (supportsRetail) {
        const stockSizes = Object.keys(variation.stock || {}).filter(k => k !== 'WHOLESALE');
        const gridSizes = grid?.sizes || [];
        const sizeSet = new Set([...stockSizes, ...gridSizes]);
        sizeSet.forEach(size => {
          candidates.push({ product, variation, size, saleType: SaleType.RETAIL, referenceNorm, nameNorm, colorNorm });
        });
      }
      if (supportsWholesale) {
        candidates.push({ product, variation, size: undefined, saleType: SaleType.WHOLESALE, referenceNorm, nameNorm, colorNorm });
      }
    });
  });

  return candidates;
}

// ── Extração por linha — cada passo consome o que já achou antes do próximo rodar. ──────────
const QTY_REGEX = /x\s*(\d+)\b/i;
// Tamanho de calçado: 2 dígitos, faixa 30-46 — um ou mais juntos por /, - ou vírgula
// ("38", "40/41", "39-40"). Regra explícita: "40/41 x1" = 1 unidade de CADA tamanho listado,
// não a quantidade dividida entre eles — é o jeito comum de escrever "um de cada" numa lista.
const SIZE_CLUSTER_REGEX = /\b((?:3[0-9]|4[0-6])(?:\s*[/,-]\s*(?:3[0-9]|4[0-6]))*)\b/;
const SIZE_NUM_REGEX = /3[0-9]|4[0-6]/g;
// Sem \b de propósito — OCR de print costuma colar letra em cima do número (ex.: "Z290",
// "ref290", um ícone lido como caractere) ou a pessoa digita "cod290" sem espaço; pega só a
// sequência de dígitos, ignorando letras grudadas dos dois lados. Espaço ENTRE os dígitos
// também é ignorado (ex.: "2 90" vira "290") — OCR às vezes separa mal os caracteres do número.
const REFERENCE_REGEX = /\d(?:\s*\d){1,5}/;
const CUSTOMER_PREFIX_REGEX = /^\s*cliente\s*:?\s*/i;

function extractQuantity(line: string): { quantity: number; rest: string } {
  const m = line.match(QTY_REGEX);
  if (!m || m.index === undefined) return { quantity: 1, rest: line };
  return { quantity: Math.max(1, parseInt(m[1], 10) || 1), rest: line.slice(0, m.index) + line.slice(m.index + m[0].length) };
}

function extractSizes(line: string): { sizes: string[]; rest: string } {
  const m = line.match(SIZE_CLUSTER_REGEX);
  if (!m || m.index === undefined) return { sizes: [], rest: line };
  const sizes = m[0].match(SIZE_NUM_REGEX) || [];
  return { sizes, rest: line.slice(0, m.index) + line.slice(m.index + m[0].length) };
}

function extractReference(line: string): { reference: string | null; rest: string } {
  const m = line.match(REFERENCE_REGEX);
  if (!m || m.index === undefined) return { reference: null, rest: line };
  return { reference: m[0].replace(/\s+/g, ''), rest: line.slice(0, m.index) + line.slice(m.index + m[0].length) };
}

// ── Resultado por linha ──────────────────────────────────────────────────────────────────────
export interface ParsedOrderLine {
  raw: string;
  lineIndex: number;
  status: 'auto' | 'review' | 'unmatched';
  productId?: string;
  variationId?: string;
  // 1 entrada por tamanho numa linha multi-tamanho ("40/41 x1" => duas entradas, size undefined
  // pra Atacado (grade fechada, sem tamanho).
  sizes: { size?: string; quantity: number }[];
  saleType?: SaleType;
  matchedProduct?: Product;
  matchedVariation?: Variation;
  reasons: string[];
  // Alternativas pro seletor manual quando `review`/`unmatched` — variações do mesmo produto
  // (cor ambígua) ou produtos candidatos (nome ambíguo), conforme o caso.
  candidates?: OrderLineCandidate[];
  // Texto restante depois de tirar quantidade/tamanho/referência — normalmente a "cor" da
  // linha, mas pode ser a linha quase inteira se nada mais foi reconhecido. Vira a CHAVE de um
  // alias ao "ensinar" uma correspondência (ver PasteOrderModal.tsx) — por isso precisa vir
  // preenchido mesmo quando a linha termina `unmatched`.
  colorText: string;
}

export interface ParsedOrderResult {
  lines: ParsedOrderLine[];
  // Linhas que nem pareciam item (recado, linha em branco, ou reivindicada como cliente) —
  // nunca somem da tela, mesmo sem virar item.
  unparsedRawLines: string[];
  detectedCustomer?: { personId?: string; rawName: string; confidence: 'exact' | 'fuzzy' | 'none' };
}

function unmatchedLine(raw: string, lineIndex: number, reasons: string[], colorText: string, candidates?: OrderLineCandidate[]): ParsedOrderLine {
  return { raw, lineIndex, status: 'unmatched', sizes: [], reasons, colorText, candidates };
}

function parseItemLine(raw: string, lineIndex: number, index: OrderLineCandidate[], aliases: OrderTextAlias[]): ParsedOrderLine {
  const { quantity, rest: afterQty } = extractQuantity(raw);
  const { sizes: rawSizes, rest: afterSizes } = extractSizes(afterQty);
  const { reference, rest: afterRef } = extractReference(afterSizes);
  const colorText = afterRef.replace(/\bx\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const colorTextNorm = normalizeText(colorText);

  const reasons: string[] = [];
  let product: Product | null = null;
  let variation: Variation | null = null;
  let exactReference = false;
  let colorAmbiguous = false;

  // 0) Correspondência ENSINADA (ver PasteOrderModal "Lembrar esta correspondência") — mais
  // confiável que qualquer match automático, porque foi confirmada manualmente uma vez. Alias
  // GLOBAL (sem productId) resolve produto+cor de uma vez só, direto pelo texto da linha, sem
  // depender de referência nenhuma — checado ANTES da resolução normal de produto.
  const globalAlias = colorTextNorm ? aliases.find(a => !a.productId && a.phraseNorm === colorTextNorm) : undefined;
  if (globalAlias) {
    // Alias global não guarda o produto-alvo separado (só existe pra escopo) — acha o produto
    // dono da variação diretamente no índice, já que ids de variação são únicos no catálogo.
    const owningCandidate = index.find(c => c.variation.id === globalAlias.variationId);
    if (owningCandidate) {
      product = owningCandidate.product;
      variation = owningCandidate.variation;
      exactReference = true; // alias confirmado manualmente == confiança de match exato
      reasons.push('Produto/cor reconhecidos por correspondência ensinada.');
    }
  }

  // 1) Produto: referência exata é o sinal mais forte (normalmente única no catálogo); sem
  // referência, tenta por nome (fallback — sempre vira `review`, nunca `auto`).
  if (!product && reference) {
    const refNorm = normalizeText(reference);
    const byRef = uniqueBy(index.filter(c => c.referenceNorm === refNorm).map(c => c.product), p => p.id);
    if (byRef.length === 1) { product = byRef[0]; exactReference = true; }
    else if (byRef.length > 1) {
      return unmatchedLine(raw, lineIndex, ['Referência bateu em mais de um produto — confira manualmente.'], colorText);
    }
  }

  if (!product) {
    const nameQuery = tokenize(`${colorText} ${reference ?? ''}`);
    if (nameQuery.length > 0) {
      const allProducts = uniqueBy(index.map(c => c.product), p => p.id);
      const scored = allProducts
        .map(p => ({ product: p, score: scoreAgainst(nameQuery, tokenize(`${p.reference} ${p.name}`)) }))
        .filter(r => r.score >= NAME_MATCH_THRESHOLD)
        .sort((a, b) => b.score - a.score);
      if (scored.length > 0) product = scored[0].product;
    }
  }

  if (!product) {
    return unmatchedLine(raw, lineIndex, ['Não foi possível identificar o produto (referência/nome não reconhecidos).'], colorText);
  }

  const productCandidates = index.filter(c => c.product.id === product!.id);
  const distinctVariations = uniqueBy(productCandidates.map(c => c.variation), v => v.id);

  // 2) Correspondência ensinada ESCOPADA a este produto (ex.: "preto dourado" -> sempre a cor
  // "Preto" DESTE produto) — checada depois de saber o produto, antes do match normal de cor.
  const scopedAlias = !variation && colorTextNorm ? aliases.find(a => a.productId === product!.id && a.phraseNorm === colorTextNorm) : undefined;
  if (scopedAlias) {
    const aliasVariation = distinctVariations.find(v => v.id === scopedAlias.variationId);
    if (aliasVariation) {
      variation = aliasVariation;
      reasons.push('Cor reconhecida por correspondência ensinada anteriormente.');
    }
    // Se a variação do alias não existe mais neste produto (cor removida depois de ensinar),
    // ignora silenciosamente e cai no fluxo normal de cor abaixo — nunca quebra.
  }

  // 3) Cor (fluxo normal — só roda se nenhum alias já resolveu a variação acima)
  if (!variation) {
    if (distinctVariations.length === 1) {
      variation = distinctVariations[0];
    } else if (colorText) {
      const colorMatches0 = distinctVariations.filter(v => normalizeText(v.colorName) === colorTextNorm);
      let exactColor = colorMatches0.length > 0;
      let colorMatches = colorMatches0;
      if (!colorMatches.length) {
        colorMatches = distinctVariations.filter(v => {
          const vNorm = normalizeText(v.colorName);
          return vNorm.includes(colorTextNorm) || colorTextNorm.includes(vNorm);
        });
      }
      if (colorMatches.length === 1) { variation = colorMatches[0]; colorAmbiguous = !exactColor; }
      else { colorAmbiguous = true; }
    } else {
      colorAmbiguous = true; // produto tem várias cores e a linha não citou nenhuma
    }
    if (colorAmbiguous) reasons.push(variation ? 'Cor reconhecida por aproximação — confirme.' : 'Não deu pra identificar a cor entre as opções do produto.');
  }

  // 4) Tipo de venda + tamanho(s)
  const supportsRetail = productHasSaleType(product, SaleType.RETAIL);
  const supportsWholesale = productHasSaleType(product, SaleType.WHOLESALE);
  let saleType: SaleType | undefined;
  let sizeEntries: { size?: string; quantity: number }[] = [];
  let needsReview = false;

  if (rawSizes.length > 0) {
    saleType = SaleType.RETAIL;
    if (!supportsRetail) {
      reasons.push('Tamanho informado, mas este produto não vende por Varejo.');
      needsReview = true;
    }
    const validSizes = variation ? new Set(productCandidates.filter(c => c.variation.id === variation!.id && c.saleType === SaleType.RETAIL).map(c => c.size)) : null;
    sizeEntries = rawSizes.map(size => {
      if (validSizes && !validSizes.has(size)) { reasons.push(`Tamanho ${size} não encontrado no cadastro desta cor.`); needsReview = true; }
      return { size, quantity };
    });
  } else if (supportsWholesale && !supportsRetail) {
    saleType = SaleType.WHOLESALE;
    sizeEntries = [{ size: undefined, quantity }];
  } else if (isHybridProduct(product)) {
    // Sem tamanho, produto vende os dois jeitos — não chuta Varejo×Atacado.
    needsReview = true;
    reasons.push('Produto vende Atacado e Varejo — informe o tamanho ou confirme que é grade fechada.');
  } else if (supportsRetail) {
    needsReview = true;
    reasons.push('Produto vende por tamanho (Varejo) — informe o tamanho.');
  } else {
    saleType = SaleType.WHOLESALE;
    sizeEntries = [{ size: undefined, quantity }];
  }

  const status: ParsedOrderLine['status'] = (!exactReference || colorAmbiguous || needsReview) ? 'review' : 'auto';

  return {
    raw,
    lineIndex,
    status,
    productId: product.id,
    variationId: variation?.id,
    sizes: sizeEntries,
    saleType,
    matchedProduct: product,
    matchedVariation: variation || undefined,
    reasons,
    candidates: status !== 'auto' ? productCandidates : undefined,
    colorText,
  };
}

// ── Detecção de cliente ──────────────────────────────────────────────────────────────────────
function detectCustomer(explicitName: string | null, leftoverLines: string[], people: Person[]): { detected?: ParsedOrderResult['detectedCustomer']; consumedLine?: string } {
  const customers = people.filter(p => p.isCustomer);

  const matchAgainst = (rawName: string) => {
    const norm = normalizeText(rawName);
    const exact = customers.find(p => normalizeText(p.name) === norm);
    if (exact) return { personId: exact.id, rawName, confidence: 'exact' as const };
    const nameTokens = tokenize(rawName);
    const scored = customers
      .map(p => ({ person: p, score: scoreAgainst(nameTokens, tokenize(p.name)) }))
      .filter(r => r.score >= CUSTOMER_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) return { personId: scored[0].person.id, rawName, confidence: 'fuzzy' as const };
    return { rawName, confidence: 'none' as const };
  };

  if (explicitName) return { detected: matchAgainst(explicitName) };

  // Sem "Cliente:" explícito — por eliminação, tenta achar uma linha sem dígito que bata com
  // algum cliente cadastrado (nunca reivindica uma linha que já virou item ou que não bate).
  for (const line of leftoverLines) {
    if (/\d/.test(line)) continue;
    const norm = normalizeText(line);
    if (!norm) continue;
    const nameTokens = tokenize(line);
    const scored = customers
      .map(p => ({ person: p, score: scoreAgainst(nameTokens, tokenize(p.name)) }))
      .filter(r => r.score >= CUSTOMER_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) {
      return { detected: { personId: scored[0].person.id, rawName: line, confidence: normalizeText(scored[0].person.name) === norm ? 'exact' : 'fuzzy' }, consumedLine: line };
    }
  }
  return {};
}

// ── Entrada principal ────────────────────────────────────────────────────────────────────────
export function parseOrderText(text: string, products: Product[], people: Person[], grids: Grid[] = [], aliases: OrderTextAlias[] = []): ParsedOrderResult {
  const index = buildOrderCandidateIndex(products, grids);
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let explicitCustomerName: string | null = null;
  const itemCandidateLines: string[] = [];
  const nonItemLines: string[] = [];

  rawLines.forEach(line => {
    if (CUSTOMER_PREFIX_REGEX.test(line)) {
      explicitCustomerName = line.replace(CUSTOMER_PREFIX_REGEX, '').trim();
      return;
    }
    // Linha "parece item" se tiver pelo menos um dígito (referência, tamanho ou quantidade) —
    // sem nenhum dígito, não tenta parsear como item (evita transformar recado em linha unmatched).
    if (/\d/.test(line)) itemCandidateLines.push(line);
    else nonItemLines.push(line);
  });

  const lines = itemCandidateLines.map((line, i) => parseItemLine(line, i, index, aliases));

  const { detected, consumedLine } = detectCustomer(explicitCustomerName, nonItemLines, people);
  const unparsedRawLines = nonItemLines.filter(l => l !== consumedLine);

  return { lines, unparsedRawLines, detectedCustomer: detected };
}

// ── Shape entregue pro SaleFormView (ver PasteOrderModal.onConfirm) ─────────────────────────
export interface DraftSaleBlockInput {
  productId: string;
  saleType: SaleType;
  variations: { variationId: string; size?: string; quantity: number }[];
}

// Agrupa linhas já resolvidas (produto+variação+tamanho definidos) em blocos por
// produto+tipoDeVenda — mesma chave que SaleFormView já usa (`${productId}-${saleType}`) —
// somando quantidades repetidas de variação+tamanho (mesma ideia do merge do scanner de
// código de barras existente, SaleFormView.handleScanResult).
export function buildDraftBlocksFromLines(lines: ParsedOrderLine[]): DraftSaleBlockInput[] {
  const blocksByKey = new Map<string, DraftSaleBlockInput>();
  lines.forEach(line => {
    if (!line.productId || !line.variationId || !line.saleType) return;
    const key = `${line.productId}-${line.saleType}`;
    let block = blocksByKey.get(key);
    if (!block) {
      block = { productId: line.productId, saleType: line.saleType, variations: [] };
      blocksByKey.set(key, block);
    }
    line.sizes.forEach(({ size, quantity }) => {
      const existing = block!.variations.find(v => v.variationId === line.variationId && v.size === size);
      if (existing) existing.quantity += quantity;
      else block!.variations.push({ variationId: line.variationId!, size, quantity });
    });
  });
  return Array.from(blocksByKey.values());
}
