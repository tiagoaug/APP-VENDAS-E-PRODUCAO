import { useState } from 'react';
import {
  Users,
  Tags,
  Palette,
  CreditCard,
  Wallet,
  BarChart3,
  Boxes,
  Moon,
  Sun,
  ChevronRight,
  Layout,
  Grid3X3,
  Factory,
  Database,
  Footprints,
  Shield,
  Landmark,
  Package,
  LogOut,
  Accessibility,
  Type,
  BookOpen,
  Wrench,
  CheckCircle2,
  X,
  Check,
  UserCog,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { ViewType, ProductionScreenType, AppModulesConfig, Collaborator } from '../types';
import { ThemeId, THEME_VISUALS, FONT_OPTIONS, FONT_SCALE_OPTIONS, NavIconMode, NAV_MONO_PALETTE } from '../utils/themes';
import { isViewAllowed, isSectorAllowed } from '../utils/collaborators';

interface SettingsViewProps {
  onNavigate: (view: ViewType) => void;
  onNavigateProduction: (screen: ProductionScreenType) => void;
  isDarkMode: boolean;
  appTheme: ThemeId;
  setAppTheme: (theme: ThemeId) => void;
  toggleDarkMode: () => void;
  modulesConfig: AppModulesConfig;
  fontScale: number;
  setFontScale: (scale: number) => void;
  fontFamily: string;
  setFontFamily: (family: string) => void;
  navIconMode: NavIconMode;
  setNavIconMode: (mode: NavIconMode) => void;
  navMonoColor: string;
  setNavMonoColor: (color: string) => void;
  collaborators: Collaborator[];
  activeCollaborator: Collaborator | null;
  onSwitchCollaborator: (id: string, pin: string) => boolean;
  onLogout: () => void;
  onFixPkgAllocations: () => Promise<{ fixed: number; total: number }>;
}

export default function SettingsView({
  onNavigate,
  onNavigateProduction,
  isDarkMode,
  appTheme,
  setAppTheme,
  toggleDarkMode,
  modulesConfig,
  fontScale,
  setFontScale,
  fontFamily,
  setFontFamily,
  navIconMode,
  setNavIconMode,
  navMonoColor,
  setNavMonoColor,
  collaborators,
  activeCollaborator,
  onSwitchCollaborator,
  onLogout,
  onFixPkgAllocations
}: SettingsViewProps) {
  const [showA11y, setShowA11y] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [fixingAlloc, setFixingAlloc] = useState(false);
  const [fixAllocResult, setFixAllocResult] = useState<{ fixed: number; total: number } | null>(null);
  const [showCollabSwitcher, setShowCollabSwitcher] = useState(false);
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const isItemAllowed = (itemId: ViewType | string) => {
    if (itemId === 'SOLE_MATRIX_DIRECT') return isSectorAllowed(activeCollaborator, 'cadastro_insumos');
    return isViewAllowed(activeCollaborator, itemId as ViewType);
  };

  const closeCollabSwitcher = () => {
    setShowCollabSwitcher(false);
    setSwitchTargetId(null);
    setPinInput('');
    setPinError(false);
    setShowPin(false);
  };

  const confirmSwitch = () => {
    if (!switchTargetId) return;
    const ok = onSwitchCollaborator(switchTargetId, pinInput);
    if (ok) {
      closeCollabSwitcher();
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const menuGroups = [
    {
      title: "Configurações de Negócio",
      items: [
        { id: ViewType.PRODUCTION_ENGINEERING, label: "Modelos / Ficha Técnica", icon: <Package size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
        { id: ViewType.STOCK, label: "Expedição e Estoque", icon: <Boxes size={22} />, color: "text-amber-700 dark:text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", module: 'sales' },
        { id: ViewType.COLORS, label: "Paleta de Cores", icon: <Palette size={22} />, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/30", module: 'any' },
        { id: ViewType.CATEGORIES, label: "Categorias e Grupos", icon: <Tags size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'any' },
        { id: ViewType.PEOPLE, label: "Clientes e Fornecedores", icon: <Users size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
      ].filter(item => (item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig]) && isItemAllowed(item.id))
    },
    {
      title: "Módulo de Produção",
      items: [
        { id: 'SOLE_MATRIX_DIRECT', label: "Matrizes de Solados", icon: <Footprints size={22} />, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", module: 'production' },
        { id: ViewType.GRIDS, label: "Grades de Tamanho", icon: <Grid3X3 size={22} />, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/30", module: 'production' },
        { id: ViewType.PRODUCTION_CONFIG, label: "Configuração de Fábrica", icon: <Factory size={22} />, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", module: 'production' },
      ].filter(item => (item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig]) && isItemAllowed(item.id))
    },
    {
      title: "Financeiro & Contas",
      items: [
        { id: ViewType.FINANCIAL, label: "Fluxo de Caixa Vendas", icon: <BarChart3 size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'sales' },
        { id: ViewType.PERSONAL_FINANCIAL, label: "Financeiro Pessoal", icon: <Wallet size={22} />, color: "text-pink-500 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/30", module: 'personal' },
        { id: ViewType.ACCOUNTS, label: "Contas Bancárias", icon: <Landmark size={22} />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", module: 'any' },
        { id: ViewType.PAYMENT_METHODS, label: "Meios de Pagamento", icon: <CreditCard size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
      ].filter(item => (item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig]) && isItemAllowed(item.id))
    },
    {
      title: "Sistema & Backup",
      items: [
        { id: ViewType.MODULES_CONFIG, label: "Módulos do Sistema", icon: <Shield size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'any' },
        { id: ViewType.COLLABORATORS_CONFIG, label: "Colaboradores", icon: <UserCog size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'any' },
        { id: ViewType.DASHBOARD_CONFIG, label: "Organizar Dashboard", icon: <Layout size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'any' },
        { id: ViewType.BACKUP, label: "Ajustes Técnicos", icon: <Database size={22} />, color: "text-gray-600 dark:text-gray-400", bg: "bg-slate-100 dark:bg-slate-800", module: 'any' },
        { id: ViewType.MANUAL, label: "Manual do Sistema", icon: <BookOpen size={22} />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", module: 'any' },
      ].filter(item => (item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig]) && isItemAllowed(item.id))
    }
  ];

  return (
    <div className="flex flex-col gap-6 pb-10 h-full overflow-y-auto overflow-x-hidden force-scrollbar">

      {/* Menu Groups */}
      <div className="flex flex-col gap-6">
        {menuGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-3">
            <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">{group.title}</h3>
            <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              {group.items.map((item, itemIdx) => (
                <button
                  key={item.id}
                  title={item.label}
                  aria-label={`Navegar para ${item.label}`}
                  onClick={() => {
                    if (item.id === 'SOLE_MATRIX_DIRECT') {
                      onNavigateProduction('MATRIZES');
                    } else {
                      onNavigate(item.id as ViewType);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${itemIdx !== group.items.length - 1 ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${(item as any).bg || 'bg-slate-100 dark:bg-slate-800'} ${item.color}`}>
                      {item.icon}
                    </div>
                    <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
                  </div>
                  <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* ── EQUIPE / QUEM ESTÁ USANDO ── */}
        <div className="flex flex-col gap-3">
          <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Equipe</h3>
          <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button
              onClick={() => setShowCollabSwitcher(true)}
              title="Quem está usando"
              aria-label="Trocar colaborador ativo"
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800"
            >
              <div className="flex items-center gap-4">
                {activeCollaborator ? (
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-sm" style={{ backgroundColor: activeCollaborator.colorHex }}>
                    {activeCollaborator.name.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                    <UserCog size={22} />
                  </div>
                )}
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Quem está usando</p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{activeCollaborator ? activeCollaborator.name : 'Acesso Completo'}</p>
                </div>
              </div>
              <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
            </button>
          </div>
        </div>

        {/* ── ACESSIBILIDADE ── */}
        <div className="flex flex-col gap-3">
          <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Personalização</h3>
          <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

            {/* Accessibility — abre popup de teste */}
            <button
              onClick={() => setShowA11y(true)}
              title="Acessibilidade e Personalização"
              aria-label="Abrir configurações de acessibilidade e personalização"
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0 text-violet-600 dark:text-violet-400">
                  <Accessibility size={22} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Acessibilidade e Personalização</p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Tema, fonte e tamanho</p>
                </div>
              </div>
              <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
            </button>

            {/* ── CORRIGIR ALOCAÇÕES DE EMBALAGEM ── */}
            <button
              type="button"
              title="Corrigir alocações de embalagem inconsistentes"
              aria-label="Corrigir inconsistências nas alocações de embalagem"
              disabled={fixingAlloc}
              onClick={async () => {
                setFixingAlloc(true);
                setFixAllocResult(null);
                try {
                  const result = await onFixPkgAllocations();
                  setFixAllocResult(result);
                } finally {
                  setFixingAlloc(false);
                }
              }}
              className={`w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'border-b border-slate-800 hover:bg-slate-800/50' : 'border-b border-slate-50 hover:bg-slate-50'} disabled:opacity-60`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${fixAllocResult ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'}`}>
                  {fixAllocResult ? <CheckCircle2 size={22} /> : <Wrench size={22} />}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {fixingAlloc ? 'Corrigindo...' : fixAllocResult ? `${fixAllocResult.fixed} corrigido(s) de ${fixAllocResult.total}` : 'Corrigir Alocações de Embalagem'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {fixAllocResult ? 'Concluído — estoque consistente' : 'Ajustar inconsistências de estoque × embalagem'}
                  </p>
                </div>
              </div>
              {!fixingAlloc && !fixAllocResult && <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />}
            </button>

            {/* ── LOGOUT — último item do menu ── */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="Encerrar Sessão"
              aria-label="Sair da conta atual"
              className="w-full flex items-center justify-between p-4 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors active:bg-rose-100 dark:active:bg-rose-900/20"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0 text-rose-500">
                  <LogOut size={22} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black tracking-tight text-rose-500">Encerrar Sessão</p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Sair da conta atual</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-rose-300" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 text-center">
        <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest">Gestão Cloud Pro v1.2.4</p>
      </div>

      {/* ── ACESSIBILIDADE E PERSONALIZAÇÃO — POPUP DE TESTE ── */}
      {showA11y && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowA11y(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md max-h-[88vh] overflow-y-auto rounded-[2rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
          >
            {/* Header */}
            <div className={`p-6 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Accessibility size={22} />
                </div>
                <div>
                  <h3 className={`text-base font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Acessibilidade</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Tema, fonte e tamanho</p>
                </div>
              </div>
              <button
                onClick={() => setShowA11y(false)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                aria-label="Fechar" title="Fechar"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Dark Mode toggle — atalho rápido */}
              <div className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-amber-50 text-amber-500'}`}>
                    {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                  </div>
                  <div>
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Modo {isDarkMode ? 'Noturno' : 'Diurno'}</p>
                    <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Atalho rápido</p>
                  </div>
                </div>
                <button
                  onClick={toggleDarkMode}
                  title="Alternar modo claro/escuro"
                  aria-label="Alternar modo claro/escuro"
                  className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${isDarkMode ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Tema */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Palette size={14} className="text-slate-400" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tema</p>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  {(Object.keys(THEME_VISUALS) as ThemeId[]).map(id => {
                    const t = THEME_VISUALS[id];
                    const active = appTheme === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAppTheme(id)}
                        className="flex flex-col items-center gap-1.5"
                        aria-label={`Tema ${t.label}`}
                        title={t.label}
                      >
                        <div
                          className={`w-12 h-12 rounded-2xl border-2 transition-all flex items-center justify-center ${active ? 'border-violet-500 scale-110 shadow-lg' : 'border-transparent'}`}
                          style={{ background: t.swatch }}
                        >
                          {active && <Check size={18} className="text-white drop-shadow" strokeWidth={3} />}
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-wide ${active ? 'text-violet-500' : 'text-slate-400'}`}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fonte */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Type size={14} className="text-slate-400" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Fonte</p>
                </div>
                <div className={`flex flex-col gap-1.5 max-h-48 overflow-y-auto rounded-2xl p-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                  {FONT_OPTIONS.map(opt => {
                    const active = fontFamily === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFontFamily(opt.value)}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${active ? 'bg-violet-500 text-white' : isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600'}`}
                        style={{ fontFamily: opt.value }}
                      >
                        <span className="text-sm truncate">{opt.label}</span>
                        {active && <Check size={14} className="shrink-0" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tamanho da Fonte */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Type size={14} className="text-slate-400" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tamanho da Fonte ({fontScale}%)</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {FONT_SCALE_OPTIONS.map(pct => {
                    const active = fontScale === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setFontScale(pct)}
                        className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all active:scale-95 ${active ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <span className={`font-black leading-none ${active ? 'text-violet-600 dark:text-violet-400' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: `${10 + (pct / 100) * 6}px` }}>A</span>
                        <span className={`text-[9px] font-black ${active ? 'text-violet-500' : 'text-slate-400'}`}>{pct}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ícones do Menu — barra inferior (Home/Compras/Vendas/...) */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Layout size={14} className="text-slate-400" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Ícones do Menu</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNavIconMode('mono')}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${navIconMode === 'mono' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <span className={`text-[11px] font-black uppercase tracking-wide ${navIconMode === 'mono' ? 'text-violet-500' : 'text-slate-400'}`}>Monocromático</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNavIconMode('colored')}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${navIconMode === 'colored' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <span className={`text-[11px] font-black uppercase tracking-wide ${navIconMode === 'colored' ? 'text-violet-500' : 'text-slate-400'}`}>Colorido</span>
                  </button>
                </div>
                {navIconMode === 'mono' && (
                  <div className={`flex flex-col gap-2 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Cor do ícone ativo</p>
                    <div className="flex flex-wrap gap-2">
                      {NAV_MONO_PALETTE.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNavMonoColor(c)}
                          title={c}
                          aria-label={`Cor ${c}`}
                          className={`w-7 h-7 rounded-lg border transition-all ${navMonoColor === c ? 'border-violet-500 scale-110 ring-2 ring-violet-500/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={`p-5 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <button
                type="button"
                onClick={() => setShowA11y(false)}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUEM ESTÁ USANDO — TROCA DE COLABORADOR ── */}
      {showCollabSwitcher && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeCollabSwitcher}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-[2rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
          >
            <div className={`p-6 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <UserCog size={22} />
                </div>
                <div>
                  <h3 className={`text-base font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Quem está usando</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Escolha o colaborador</p>
                </div>
              </div>
              <button
                onClick={closeCollabSwitcher}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                aria-label="Fechar" title="Fechar"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              {collaborators.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  Nenhum colaborador cadastrado ainda. Cadastre em "Colaboradores", no menu Sistema & Backup.
                </p>
              )}

              {collaborators.map(collab => {
                const isTarget = switchTargetId === collab.id;
                const isActive = activeCollaborator?.id === collab.id;
                return (
                  <div key={collab.id} className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => { setSwitchTargetId(isTarget ? null : collab.id); setPinInput(''); setPinError(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${isTarget ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0" style={{ backgroundColor: collab.colorHex }}>
                        {collab.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left flex-1">
                        <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{collab.name}</p>
                        {isActive && <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Ativo agora</p>}
                      </div>
                      <KeyRound size={16} className="text-slate-400 shrink-0" />
                    </button>

                    {isTarget && (
                      <div className="flex flex-col gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="relative">
                          <input
                            type={showPin ? 'text' : 'password'}
                            inputMode="numeric"
                            maxLength={6}
                            autoFocus
                            value={pinInput}
                            onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(false); }}
                            onKeyDown={e => { if (e.key === 'Enter') confirmSwitch(); }}
                            placeholder="Digite o PIN"
                            className={`w-full px-4 py-3 pr-11 rounded-2xl border-2 text-sm font-bold outline-none tracking-[0.3em] text-center transition-colors ${pinError ? 'border-rose-500' : 'focus:border-indigo-500'} ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPin(v => !v)}
                            title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                            aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition"
                          >
                            {showPin ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
                          </button>
                        </div>
                        {pinError && <p className="text-[10px] font-bold text-rose-500 text-center">PIN incorreto</p>}
                        <button
                          type="button"
                          onClick={confirmSwitch}
                          className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT CONFIRM MODAL ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
              <LogOut size={32} className="text-rose-500" strokeWidth={2} />
            </div>

            <div className="text-center">
              <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Encerrar Sessão?
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-2 leading-relaxed">
                Você será desconectado. Seus dados ficam salvos na nuvem e estarão disponíveis no próximo acesso.
              </p>
            </div>

            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                title="Cancelar Sair"
                className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
                  isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                title="Confirmar Sair"
                className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all active:scale-95"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
