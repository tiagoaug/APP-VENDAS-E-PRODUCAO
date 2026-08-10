// Paleta fixa de cores pro badge de "pares por caixa" (ex.: "12P", "15P") — usado tanto no
// cadastro do padrão de embalagem (escolher a cor) quanto na exibição do estoque (aplicar a
// cor escolhida). Classes Tailwind precisam ser strings ESTÁTICAS (não geradas por
// interpolação) pra não serem removidas no build de produção, por isso o lookup por chave.
export const BADGE_COLOR_OPTIONS = [
  'violet', 'indigo', 'sky', 'teal', 'emerald', 'amber', 'orange', 'rose', 'pink', 'slate',
] as const;

export type BadgeColorKey = typeof BADGE_COLOR_OPTIONS[number];

export const DEFAULT_BADGE_COLOR: BadgeColorKey = 'violet';

export const BADGE_COLOR_CLASSES: Record<BadgeColorKey, { light: string; dark: string; swatch: string }> = {
  violet: { light: 'bg-violet-100 text-violet-700', dark: 'bg-violet-900/30 text-violet-300', swatch: 'bg-violet-500' },
  indigo: { light: 'bg-indigo-100 text-indigo-700', dark: 'bg-indigo-900/30 text-indigo-300', swatch: 'bg-indigo-500' },
  sky: { light: 'bg-sky-100 text-sky-700', dark: 'bg-sky-900/30 text-sky-300', swatch: 'bg-sky-500' },
  teal: { light: 'bg-teal-100 text-teal-700', dark: 'bg-teal-900/30 text-teal-300', swatch: 'bg-teal-500' },
  emerald: { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-900/30 text-emerald-300', swatch: 'bg-emerald-500' },
  amber: { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-900/30 text-amber-300', swatch: 'bg-amber-500' },
  orange: { light: 'bg-orange-100 text-orange-700', dark: 'bg-orange-900/30 text-orange-300', swatch: 'bg-orange-500' },
  rose: { light: 'bg-rose-100 text-rose-700', dark: 'bg-rose-900/30 text-rose-300', swatch: 'bg-rose-500' },
  pink: { light: 'bg-pink-100 text-pink-700', dark: 'bg-pink-900/30 text-pink-300', swatch: 'bg-pink-500' },
  slate: { light: 'bg-slate-200 text-slate-700', dark: 'bg-slate-700 text-slate-300', swatch: 'bg-slate-500' },
};

export function getBadgeColorClasses(key: string | undefined, isDarkMode: boolean): string {
  const safeKey = (BADGE_COLOR_OPTIONS as readonly string[]).includes(key || '') ? (key as BadgeColorKey) : DEFAULT_BADGE_COLOR;
  const cls = BADGE_COLOR_CLASSES[safeKey];
  return isDarkMode ? cls.dark : cls.light;
}
