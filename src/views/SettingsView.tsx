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
  ChevronDown,
  Layout,
  Grid3X3,
  Factory,
  Database,
  Footprints,
  Shield,
  Landmark,
  Package,
  Plus,
  LogOut,
  Accessibility,
  Type,
  Layers,
  BookOpen
} from 'lucide-react';
import { ViewType, ProductionScreenType, AppModulesConfig } from '../types';

type FontSize = 'xs' | 'sm' | 'md';

interface SettingsViewProps {
  onNavigate: (view: ViewType) => void;
  onNavigateProduction: (screen: ProductionScreenType) => void;
  isDarkMode: boolean;
  appTheme: 'light' | 'dark' | 'industrial';
  setAppTheme: (theme: 'light' | 'dark' | 'industrial') => void;
  toggleDarkMode: () => void;
  modulesConfig: AppModulesConfig;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  onLogout: () => void;
}

export default function SettingsView({ 
  onNavigate, 
  onNavigateProduction, 
  isDarkMode, 
  appTheme,
  setAppTheme,
  toggleDarkMode, 
  modulesConfig,
  fontSize,
  setFontSize,
  onLogout
}: SettingsViewProps) {
  const [showA11y, setShowA11y] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuGroups = [
    {
      title: "Configurações de Negócio",
      items: [
        { id: ViewType.PRODUCTS, label: "Produtos Cadastrados", icon: <Package size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
        { id: ViewType.PRODUCT_FORM, label: "Cadastrar Novo Modelo", icon: <Plus size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'sales' },
        { id: ViewType.STOCK, label: "Estoque de Produtos", icon: <Boxes size={22} />, color: "text-amber-700 dark:text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", module: 'sales' },
        { id: ViewType.COLORS, label: "Paleta de Cores", icon: <Palette size={22} />, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/30", module: 'any' },
        { id: ViewType.CATEGORIES, label: "Categorias e Grupos", icon: <Tags size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'any' },
        { id: ViewType.PEOPLE, label: "Clientes e Fornecedores", icon: <Users size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
      ].filter(item => item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig])
    },
    {
      title: "Módulo de Produção",
      items: [
        { id: ViewType.PRODUCT_SHEET, label: "Engenharia / Ficha Técnica", icon: <Database size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'production' },
        { id: 'SOLE_MATRIX_DIRECT', label: "Matrizes de Solados", icon: <Footprints size={22} />, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", module: 'production' },
        { id: ViewType.GRIDS, label: "Grades de Tamanho", icon: <Grid3X3 size={22} />, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/30", module: 'production' },
        { id: ViewType.PRODUCTION_CONFIG, label: "Configuração de Fábrica", icon: <Factory size={22} />, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", module: 'production' },
      ].filter(item => item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig])
    },
    {
      title: "Financeiro & Contas",
      items: [
        { id: ViewType.FINANCIAL, label: "Fluxo de Caixa Vendas", icon: <BarChart3 size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'sales' },
        { id: ViewType.PERSONAL_FINANCIAL, label: "Financeiro Pessoal", icon: <Wallet size={22} />, color: "text-pink-500 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/30", module: 'personal' },
        { id: ViewType.ACCOUNTS, label: "Contas Bancárias", icon: <Landmark size={22} />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", module: 'any' },
        { id: ViewType.PAYMENT_METHODS, label: "Meios de Pagamento", icon: <CreditCard size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
      ].filter(item => item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig])
    },
    {
      title: "Sistema & Backup",
      items: [
        { id: ViewType.MODULES_CONFIG, label: "Módulos do Sistema", icon: <Shield size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'any' },
        { id: ViewType.DASHBOARD_CONFIG, label: "Organizar Dashboard", icon: <Layout size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'any' },
        { id: ViewType.BACKUP, label: "Ajustes Técnicos", icon: <Database size={22} />, color: "text-gray-600 dark:text-gray-400", bg: "bg-slate-100 dark:bg-slate-800", module: 'any' },
        { id: ViewType.MANUAL, label: "Manual do Sistema", icon: <BookOpen size={22} />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", module: 'any' },
      ].filter(item => item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig])
    }
  ];

  const fontSizeOptions: { key: FontSize; label: string; desc: string; px: string }[] = [
    { key: 'xs', label: 'Compacto', desc: 'Very Small', px: '14px' },
    { key: 'sm', label: 'Médio', desc: 'Small', px: '16px' },
    { key: 'md', label: 'Grande', desc: 'Medium', px: '18px' },
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

        {/* ── ACESSIBILIDADE ── */}
        <div className="flex flex-col gap-3">
          <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Personalização</h3>
          <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

            {/* Accessibility accordion trigger */}
            <button
              onClick={() => setShowA11y(v => !v)}
              title="Acessibilidade e Aparência"
              aria-label="Abrir configurações de acessibilidade e aparência"
              className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0 text-violet-600 dark:text-violet-400">
                  <Accessibility size={22} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Acessibilidade</p>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Aparência e tamanho de fonte</p>
                </div>
              </div>
              <ChevronDown
                size={18}
                className={`transition-transform duration-300 ${showA11y ? 'rotate-180 text-violet-500' : isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}
              />
            </button>

            {/* Accessibility expandable panel */}
            {showA11y && (
              <div className={`px-4 pb-4 pt-2 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-50/60'}`}>

                {/* Dark Mode toggle */}
                <div className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-amber-50 text-amber-500'}`}>
                      {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                    </div>
                    <div>
                      <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Modo {isDarkMode ? 'Noturno' : 'Diurno'}</p>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Ajustar aparência</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    title={`Mudar para modo ${isDarkMode ? 'diurno' : 'noturno'}`}
                    aria-label={`Mudar para modo ${isDarkMode ? 'diurno' : 'noturno'}`}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${appTheme === 'dark' ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>


                <div className={`flex items-center justify-between p-4 rounded-2xl ${appTheme === 'industrial' ? 'bg-slate-700' : isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${appTheme === 'industrial' ? 'bg-slate-600 text-zinc-400' : 'bg-slate-100 text-slate-500'}`}>
                      <Factory size={18} />
                    </div>
                    <div>
                      <p className={`text-sm font-black ${appTheme === 'industrial' ? 'text-slate-900' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>Padrão Industrial</p>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Cinza claro de alta visibilidade</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAppTheme(appTheme === 'industrial' ? 'light' : 'industrial')}
                    title={`Mudar para padrão industrial`}
                    aria-label={appTheme === 'industrial' ? 'Desativar padrão industrial' : 'Ativar padrão industrial'}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${appTheme === 'industrial' ? 'bg-zinc-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${appTheme === 'industrial' ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Font size options */}
                <div className={`p-4 rounded-2xl flex flex-col gap-3 ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-100'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Type size={14} className="text-slate-400" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tamanho da Fonte</p>
                  </div>
                  <div className="flex gap-2">
                    {fontSizeOptions.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setFontSize(opt.key)}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all active:scale-95 ${
                          fontSize === opt.key
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                            : isDarkMode
                              ? 'border-slate-700 bg-slate-700/50 hover:border-slate-600'
                              : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <span className={`font-black leading-none ${
                          opt.key === 'xs' ? 'text-base' : opt.key === 'sm' ? 'text-xl' : 'text-2xl'
                        } ${fontSize === opt.key ? 'text-violet-600 dark:text-violet-400' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          A
                        </span>
                        <span className={`text-[11px] font-black uppercase tracking-wide ${
                          fontSize === opt.key ? 'text-violet-500' : 'text-slate-400'
                        }`}>
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
