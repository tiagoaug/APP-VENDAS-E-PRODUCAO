import { ViewType } from '../types';
import { HELP_FAQ, HELP_TOPICS, HelpFaqEntry, HelpTopic } from '../data/helpKnowledgeBase';

// Motor de busca da Central de Ajuda — determinístico, por palavras-chave (nada de IA/rede).
// Mesma filosofia da spec original: nunca inventa resposta; sem match relevante, admite e
// sugere o que existe. Ver docs/AGENT_CONTEXT_REACT.md.

// Faixa Unicode das marcas diacríticas combinantes (U+0300–U+036F) — montada por código
// (não literal no regex) pra evitar caracteres invisíveis/ambíguos direto na fonte.
const DIACRITIC_RANGE = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_RANGE, ''); // remove acentos após NFD
}

function tokenize(text: string): string[] {
  return normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
}

// Pontua por interseção simples de tokens da busca com keywords + título/pergunta — TF
// grosseiro, suficiente pra uma base pequena e sem ambiguidade forçada.
function scoreAgainst(queryTokens: string[], keywords: string[], title: string): number {
  if (queryTokens.length === 0) return 0;
  const haystack = new Set([...keywords.flatMap(tokenize), ...tokenize(title)]);
  let score = 0;
  for (const t of queryTokens) {
    if (haystack.has(t)) score += 1;
    else if ([...haystack].some(h => h.includes(t) || t.includes(h))) score += 0.5;
  }
  return score / queryTokens.length;
}

export interface HelpSearchResult {
  topics: HelpTopic[];
  faq: HelpFaqEntry[];
}

const MATCH_THRESHOLD = 0.34;

// filterByProduction: mesmo gate já usado no resto do app (modulesConfig.production) — quem
// não tem o módulo de Produção não vê tópicos/FAQ marcados productionOnly.
export function getTopicForView(view: ViewType, productionEnabled: boolean): HelpTopic | undefined {
  return HELP_TOPICS.find(t => t.view === view && (!t.productionOnly || productionEnabled));
}

// Lista completa de FAQ (sem busca) — usada pra navegação/browse quando o campo de busca
// está vazio, já que searchHelp('') propositalmente não devolve FAQ (evita a lista inteira
// competindo visualmente com o tópico da tela atual logo na abertura).
export function getAllFaq(productionEnabled: boolean): HelpFaqEntry[] {
  return HELP_FAQ.filter(f => !f.productionOnly || productionEnabled);
}

export function searchHelp(query: string, productionEnabled: boolean, currentView?: ViewType): HelpSearchResult {
  const queryTokens = tokenize(query);
  const topics = HELP_TOPICS.filter(t => !t.productionOnly || productionEnabled);
  const faq = HELP_FAQ.filter(f => !f.productionOnly || productionEnabled);

  if (queryTokens.length === 0) {
    // Sem busca digitada: prioriza o tópico da tela atual, depois o resto em ordem cadastrada.
    const current = topics.filter(t => t.view === currentView);
    const rest = topics.filter(t => t.view !== currentView);
    return { topics: [...current, ...rest], faq: [] };
  }

  const scoredTopics = topics
    .map(t => ({ item: t, score: scoreAgainst(queryTokens, t.keywords, t.title) + (t.view === currentView ? 0.1 : 0) }))
    .filter(r => r.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map(r => r.item);

  const scoredFaq = faq
    .map(f => ({ item: f, score: scoreAgainst(queryTokens, f.keywords, f.question) }))
    .filter(r => r.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map(r => r.item);

  return { topics: scoredTopics, faq: scoredFaq };
}
