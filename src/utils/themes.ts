export type ThemeId = 'light' | 'dark' | 'industrial' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'graphite' | 'hcWhite' | 'hcBlack' | 'hcIndustrial';

// Identidade visual de cada tema para o "chrome" mais visível do app (fundo geral,
// cabeçalho e barra inferior) — o resto da UI usa normalmente isDarkMode (claro/escuro)
// e ganha a cor do tema por cima via as classes CSS em index.css (mesmo truque do
// .industrial original), sem precisar editar componente por componente.
export const THEME_VISUALS: Record<ThemeId, {
  cssClass: string; outerBg: string; headerGradient: string; pillGradient: string; baseText: string;
  swatch: string; label: string;
}> = {
  light:      { cssClass: '', outerBg: 'bg-slate-50', headerGradient: 'bg-gradient-to-b from-slate-50 to-white', pillGradient: 'bg-gradient-to-b from-white to-slate-100 border border-slate-200/60', baseText: 'text-slate-900', swatch: 'linear-gradient(135deg,#f8fafc,#e2e8f0)', label: 'Claro' },
  dark:       { cssClass: 'dark', outerBg: 'bg-slate-950', headerGradient: 'bg-gradient-to-b from-slate-800 to-slate-950', pillGradient: 'bg-gradient-to-b from-slate-700 to-slate-900 border border-slate-600/40', baseText: 'text-white', swatch: 'linear-gradient(135deg,#1e293b,#020617)', label: 'Escuro' },
  industrial: { cssClass: 'industrial', outerBg: 'bg-[#e5e7eb]', headerGradient: 'bg-gradient-to-b from-gray-100 to-gray-50', pillGradient: 'bg-gradient-to-b from-gray-50 to-gray-200 border border-gray-300', baseText: 'text-slate-900', swatch: 'linear-gradient(135deg,#e5e7eb,#9ca3af)', label: 'Industrial' },
  ocean:      { cssClass: 'theme-ocean', outerBg: 'bg-cyan-50', headerGradient: 'bg-gradient-to-b from-cyan-50 to-white', pillGradient: 'bg-gradient-to-b from-white to-cyan-100 border border-cyan-200/60', baseText: 'text-slate-900', swatch: 'linear-gradient(135deg,#ecfeff,#0891b2)', label: 'Oceano' },
  forest:     { cssClass: 'theme-forest', outerBg: 'bg-emerald-50', headerGradient: 'bg-gradient-to-b from-emerald-50 to-white', pillGradient: 'bg-gradient-to-b from-white to-emerald-100 border border-emerald-200/60', baseText: 'text-slate-900', swatch: 'linear-gradient(135deg,#ecfdf5,#059669)', label: 'Floresta' },
  sunset:     { cssClass: 'theme-sunset', outerBg: 'bg-orange-50', headerGradient: 'bg-gradient-to-b from-orange-50 to-white', pillGradient: 'bg-gradient-to-b from-white to-orange-100 border border-orange-200/60', baseText: 'text-slate-900', swatch: 'linear-gradient(135deg,#fff7ed,#ea580c)', label: 'Pôr do Sol' },
  midnight:   { cssClass: 'dark theme-midnight', outerBg: 'bg-[#0b0a1e]', headerGradient: 'bg-gradient-to-b from-[#1a1735] to-[#0b0a1e]', pillGradient: 'bg-gradient-to-b from-[#241f47] to-[#13112b] border border-violet-900/40', baseText: 'text-white', swatch: 'linear-gradient(135deg,#15132f,#8b5cf6)', label: 'Meia-Noite' },
  graphite:   { cssClass: 'dark theme-graphite', outerBg: 'bg-[#1c1c1e]', headerGradient: 'bg-gradient-to-b from-[#2c2c2e] to-[#1c1c1e]', pillGradient: 'bg-gradient-to-b from-[#3a3a3c] to-[#1c1c1e] border border-zinc-700/40', baseText: 'text-white', swatch: 'linear-gradient(135deg,#262628,#71717a)', label: 'Grafite' },
  // Temas de alto contraste (acessibilidade): preto/branco puros + bordas fortes,
  // pra máxima legibilidade — sem os tons intermediários de cinza dos demais temas.
  hcWhite:      { cssClass: 'theme-hc-white', outerBg: 'bg-white', headerGradient: 'bg-gradient-to-b from-white to-white', pillGradient: 'bg-white border-2 border-black', baseText: 'text-black', swatch: 'linear-gradient(135deg,#ffffff,#000000)', label: 'Alto Contraste Branco' },
  hcBlack:      { cssClass: 'dark theme-hc-black', outerBg: 'bg-black', headerGradient: 'bg-gradient-to-b from-black to-black', pillGradient: 'bg-black border-2 border-white', baseText: 'text-white', swatch: 'linear-gradient(135deg,#000000,#ffffff)', label: 'Alto Contraste Preto' },
  hcIndustrial: { cssClass: 'dark theme-hc-industrial', outerBg: 'bg-black', headerGradient: 'bg-gradient-to-b from-black to-black', pillGradient: 'bg-black border-2 border-yellow-400', baseText: 'text-yellow-300', swatch: 'linear-gradient(135deg,#000000,#facc15)', label: 'Alto Contraste Industrial' },
};

export const ALL_THEME_CLASSES = ['dark', 'industrial', 'theme-ocean', 'theme-forest', 'theme-sunset', 'theme-midnight', 'theme-graphite', 'theme-hc-white', 'theme-hc-black', 'theme-hc-industrial'];

// ~24 opções de fonte para teste em Acessibilidade — mistura de Google Fonts
// (carregadas via index.css) e fontes de sistema (sempre disponíveis, sem import).
export const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: "'Roboto Flex', ui-sans-serif, system-ui, sans-serif", label: 'Roboto Flex (Padrão)' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Source Sans 3', sans-serif", label: 'Source Sans 3' },
  { value: "'Ubuntu', sans-serif", label: 'Ubuntu' },
  { value: "'Noto Sans', sans-serif", label: 'Noto Sans' },
  { value: "'PT Sans', sans-serif", label: 'PT Sans' },
  { value: "'Work Sans', sans-serif", label: 'Work Sans' },
  { value: "'Rubik', sans-serif", label: 'Rubik' },
  { value: "'Mukta', sans-serif", label: 'Mukta' },
  { value: "'Karla', sans-serif", label: 'Karla' },
  { value: "Arial, sans-serif", label: 'Arial' },
  { value: "Helvetica, Arial, sans-serif", label: 'Helvetica' },
  { value: "Georgia, serif", label: 'Georgia' },
  { value: "Verdana, sans-serif", label: 'Verdana' },
  { value: "Tahoma, sans-serif", label: 'Tahoma' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
  { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
  { value: "'Courier New', Courier, monospace", label: 'Courier New' },
];

export const FONT_SCALE_OPTIONS = [80, 90, 100, 110, 125, 140, 160] as const;

// ── Ícones do menu inferior (Home/Compras/Vendas/...) ───────────────────────
export type NavIconMode = 'mono' | 'colored';

// Modo "Colorido": cada item da barra inferior ganha sua própria cor fixa,
// sempre visível (ativo ou não) — não depende da paleta escolhida no modo mono.
export const NAV_TAB_COLORS: Record<string, string> = {
  dashboard: '#4f46e5',   // Home — indigo
  purchases: '#ea580c',   // Compras — orange
  sales: '#a21caf',       // Vendas — fuchsia
  production: '#059669',  // Prod. — emerald
  financial: '#0891b2',   // Finan. — cyan
  personal: '#db2777',    // Pessoal — pink
  settings: '#475569',    // Mais — slate
};

// 25 cores para o modo "Monocromático" — do escuro ao claro, cobrindo várias
// tonalidades (mesmo padrão usado na paleta de Cor de Badges do PCP).
export const NAV_MONO_PALETTE: string[] = [
  '#000000', '#1e293b', '#475569', '#7c3aed', '#4f46e5',
  '#2563eb', '#0891b2', '#0d9488', '#059669', '#16a34a',
  '#ca8a04', '#ea580c', '#e11d48', '#dc2626', '#9333ea',
  '#f1f5f9', '#ede9fe', '#e0e7ff', '#dbeafe', '#cffafe',
  '#ccfbf1', '#d1fae5', '#dcfce7', '#fef3c7', '#ffedd5',
];
