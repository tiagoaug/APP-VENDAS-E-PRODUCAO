import { firebaseService } from './firebaseService';
import { AIQuickPrompt, AIUsageEntry, AIUsageLimits, AIProvider, AIProviderConfig } from '../types';

export const DEFAULT_QUICK_PROMPTS: Omit<AIQuickPrompt, 'id'>[] = [
  {
    label: 'Pedido mais atrasado',
    prompt: 'Qual pedido está mais atrasado?',
    icon: 'clock',
    autoSend: true,
    order: 0,
  },
  {
    label: 'Relatório de produto',
    prompt: 'Faça um relatório completo do produto: ',
    icon: 'package',
    autoSend: false,
    order: 1,
  },
  {
    label: 'Sugerir pedido de solados',
    prompt: 'Sugira um pedido de compra de solados com base no estoque atual e nos fornecedores.',
    icon: 'footprints',
    autoSend: true,
    order: 2,
  },
  {
    label: 'Resumo financeiro',
    prompt: 'Resumo financeiro: quanto tenho a pagar e a receber agora?',
    icon: 'dollar',
    autoSend: true,
    order: 3,
  },
  {
    label: 'Clientes/fornecedores em aberto',
    prompt: 'Quais clientes ou fornecedores estão com saldo em aberto?',
    icon: 'users',
    autoSend: true,
    order: 4,
  },
];

export const DEFAULT_USAGE_LIMITS: AIUsageLimits = {
  dailyTokenLimit: 100000,
  weeklyTokenLimit: 500000,
};

// Preços aproximados (USD por 1M tokens) — cada provedor cobra diferente.
// Claude: claude-sonnet-4-6. OpenAI: gpt-4.1. Gemini: gemini-2.0-flash.
const PRICING_PER_MILLION_USD: Record<AIProvider, { input: number; output: number }> = {
  anthropic: { input: 3, output: 15 },
  openai: { input: 2, output: 8 },
  gemini: { input: 0.1, output: 0.4 },
};

export function estimateCostUSD(inputTokens: number, outputTokens: number, provider: AIProvider = 'anthropic'): number {
  const pricing = PRICING_PER_MILLION_USD[provider] || PRICING_PER_MILLION_USD.anthropic;
  return (inputTokens / 1_000_000) * pricing.input
    + (outputTokens / 1_000_000) * pricing.output;
}

const QUICK_PROMPTS_PATH = 'aiQuickPrompts';
const USAGE_PATH = 'aiUsage';
const SETTINGS_PATH = 'aiSettings';
const USAGE_LIMITS_DOC_ID = 'usageLimits';
const GENERAL_DOC_ID = 'general';

export interface AIGeneralSettings {
  enabled: boolean;
}

export const DEFAULT_GENERAL_SETTINGS: AIGeneralSettings = { enabled: true };

export function subscribeToAIGeneralSettings(callback: (settings: AIGeneralSettings) => void) {
  return firebaseService.subscribeToCollection<any>(SETTINGS_PATH, (all) => {
    const found = all.find((d) => d.id === GENERAL_DOC_ID);
    callback(found ? { enabled: found.enabled !== false } : DEFAULT_GENERAL_SETTINGS);
  });
}

export async function saveAIEnabled(enabled: boolean): Promise<void> {
  await firebaseService.saveDocument(SETTINGS_PATH, { id: GENERAL_DOC_ID, enabled });
}

const PROVIDER_CONFIG_DOC_ID = 'providerConfig';

export const DEFAULT_PROVIDER_CONFIG: AIProviderConfig = { activeProvider: 'anthropic' };

// Chave de API do usuário (OpenAI/Gemini) fica junto do resto dos dados do
// negócio, na árvore do próprio usuário — mesma proteção por conta que já
// protege clientes, financeiro etc. O Claude (padrão) não precisa de chave
// aqui: usa a chave fixa do servidor.
export function subscribeToAIProviderConfig(callback: (config: AIProviderConfig) => void) {
  return firebaseService.subscribeToCollection<any>(SETTINGS_PATH, (all) => {
    const found = all.find((d) => d.id === PROVIDER_CONFIG_DOC_ID);
    callback(
      found
        ? { activeProvider: found.activeProvider || 'anthropic', openai: found.openai, gemini: found.gemini }
        : DEFAULT_PROVIDER_CONFIG
    );
  });
}

export async function saveAIProviderConfig(config: AIProviderConfig): Promise<void> {
  await firebaseService.saveDocument(SETTINGS_PATH, { id: PROVIDER_CONFIG_DOC_ID, ...config });
}

export async function seedDefaultQuickPromptsIfEmpty(): Promise<void> {
  const existing = await firebaseService.getCollection<AIQuickPrompt>(QUICK_PROMPTS_PATH);
  if (existing.length > 0) return;
  for (const prompt of DEFAULT_QUICK_PROMPTS) {
    await firebaseService.saveDocument(QUICK_PROMPTS_PATH, { ...prompt });
  }
}

export function subscribeToQuickPrompts(callback: (prompts: AIQuickPrompt[]) => void) {
  return firebaseService.subscribeToCollection<AIQuickPrompt>(QUICK_PROMPTS_PATH, (data) => {
    callback([...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  });
}

export async function saveQuickPrompt(prompt: Omit<AIQuickPrompt, 'id'> & { id?: string }): Promise<void> {
  await firebaseService.saveDocument(QUICK_PROMPTS_PATH, prompt);
}

export async function deleteQuickPrompt(id: string): Promise<void> {
  await firebaseService.deleteDocument(QUICK_PROMPTS_PATH, id);
}

export function subscribeToUsageEntries(callback: (entries: AIUsageEntry[]) => void) {
  return firebaseService.subscribeToCollection<AIUsageEntry>(USAGE_PATH, callback);
}

export async function getUsageLimits(): Promise<AIUsageLimits> {
  const all = await firebaseService.getCollection<AIUsageLimits>(SETTINGS_PATH);
  const found = all.find((d) => d.id === USAGE_LIMITS_DOC_ID);
  return found ? { dailyTokenLimit: found.dailyTokenLimit, weeklyTokenLimit: found.weeklyTokenLimit } : DEFAULT_USAGE_LIMITS;
}

export async function saveUsageLimits(limits: AIUsageLimits): Promise<void> {
  await firebaseService.saveDocument(SETTINGS_PATH, { id: USAGE_LIMITS_DOC_ID, ...limits });
}

function getStartOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getStartOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0 = domingo
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d.getTime();
}

export interface AIUsageStats {
  todayTokens: number;
  todayCostUSD: number;
  weekTokens: number;
  weekCostUSD: number;
  totalTokens: number;
  totalCostUSD: number;
}

export function computeUsageStats(entries: AIUsageEntry[]): AIUsageStats {
  const startOfToday = getStartOfToday();
  const startOfWeek = getStartOfWeek();

  let todayTokens = 0, todayCostUSD = 0;
  let weekTokens = 0, weekCostUSD = 0;
  let totalTokens = 0, totalCostUSD = 0;

  for (const entry of entries) {
    const tokens = (entry.input_tokens || 0) + (entry.output_tokens || 0);
    const cost = estimateCostUSD(entry.input_tokens || 0, entry.output_tokens || 0, entry.provider || 'anthropic');

    totalTokens += tokens;
    totalCostUSD += cost;

    if (entry.timestamp >= startOfWeek) {
      weekTokens += tokens;
      weekCostUSD += cost;
    }
    if (entry.timestamp >= startOfToday) {
      todayTokens += tokens;
      todayCostUSD += cost;
    }
  }

  return { todayTokens, todayCostUSD, weekTokens, weekCostUSD, totalTokens, totalCostUSD };
}
