import { firebaseService } from './firebaseService';
import { AIQuickPrompt, AIUsageEntry, AIUsageLimits } from '../types';

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

// Preço aproximado do modelo claude-sonnet-4-6 (USD por 1M tokens)
const PRICE_PER_MILLION_INPUT_USD = 3;
const PRICE_PER_MILLION_OUTPUT_USD = 15;

export function estimateCostUSD(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * PRICE_PER_MILLION_INPUT_USD
    + (outputTokens / 1_000_000) * PRICE_PER_MILLION_OUTPUT_USD;
}

const QUICK_PROMPTS_PATH = 'aiQuickPrompts';
const USAGE_PATH = 'aiUsage';
const SETTINGS_PATH = 'aiSettings';
const USAGE_LIMITS_DOC_ID = 'usageLimits';

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
    const cost = estimateCostUSD(entry.input_tokens || 0, entry.output_tokens || 0);

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
