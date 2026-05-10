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
  Plus
} from 'lucide-react';
import { ViewType, ProductionScreenType, AppModulesConfig } from '../types';

interface SettingsViewProps {
  onNavigate: (view: ViewType) => void;
  onNavigateProduction: (screen: ProductionScreenType) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  modulesConfig: AppModulesConfig;
}

export default function SettingsView({ onNavigate, onNavigateProduction, isDarkMode, toggleDarkMode, modulesConfig }: SettingsViewProps) {
  const menuGroups = [
    {
      title: "Configurações de Negócio",
      items: [
        { id: ViewType.PRODUCTS, label: "Produtos Cadastrados", icon: <Package size={24} />, color: "text-indigo-600 dark:text-indigo-400", module: 'sales' },
        { id: ViewType.PRODUCT_FORM, label: "Cadastrar Novo Modelo", icon: <Plus size={24} />, color: "text-emerald-600 dark:text-emerald-400", module: 'sales' },
        { id: ViewType.STOCK, label: "Estoque de Produtos", icon: <Boxes size={24} />, color: "text-amber-700 dark:text-amber-500", module: 'sales' },
        { id: ViewType.COLORS, label: "Paleta de Cores", icon: <Palette size={24} />, color: "text-pink-600 dark:text-pink-400", module: 'any' },
        { id: ViewType.CATEGORIES, label: "Categorias e Grupos", icon: <Tags size={24} />, color: "text-emerald-600 dark:text-emerald-400", module: 'any' },
        { id: ViewType.PEOPLE, label: "Clientes e Fornecedores", icon: <Users size={24} />, color: "text-indigo-600 dark:text-indigo-400", module: 'sales' },
      ].filter(item => item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig])
    },
    {
      title: "Módulo de Produção",
      items: [
        { id: ViewType.PRODUCT_SHEET, label: "Engenharia / Ficha Técnica", icon: <Database size={24} />, color: "text-indigo-600 dark:text-indigo-400", module: 'production' },
        { id: 'SOLE_MATRIX_DIRECT', label: "Matrizes de Solados", icon: <Footprints size={24} />, color: "text-orange-600 dark:text-orange-400", module: 'production' },
        { id: ViewType.GRIDS, label: "Grades de Tamanho", icon: <Grid3X3 size={24} />, color: "text-violet-600 dark:text-violet-400", module: 'production' },
        { id: ViewType.PRODUCTION_CONFIG, label: "Configuração de Fábrica", icon: <Factory size={24} />, color: "text-slate-600 dark:text-slate-400", module: 'production' },
      ].filter(item => item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig])
    },
    {
      title: "Financeiro & Contas",
      items: [
        { id: ViewType.FINANCIAL, label: "Fluxo de Caixa Vendas", icon: <BarChart3 size={24} />, color: "text-emerald-600 dark:text-emerald-400", module: 'sales' },
        { id: ViewType.PERSONAL_FINANCIAL, label: "Financeiro Pessoal", icon: <Wallet size={24} />, color: "text-pink-500 dark:text-pink-400", module: 'personal' },
        { id: ViewType.ACCOUNTS, label: "Contas Bancárias", icon: <Landmark size={24} />, color: "text-blue-600 dark:text-blue-400", module: 'any' },
        { id: ViewType.PAYMENT_METHODS, label: "Meios de Pagamento", icon: <CreditCard size={24} />, color: "text-indigo-600 dark:text-indigo-400", module: 'sales' },
      ].filter(item => item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig])
    },
    {
      title: "Sistema & Backup",
      items: [
        { id: ViewType.MODULES_CONFIG, label: "Módulos do Sistema", icon: <Shield size={24} />, color: "text-indigo-600 dark:text-indigo-400", module: 'any' },
        { id: ViewType.DASHBOARD_CONFIG, label: "Organizar Dashboard", icon: <Layout size={24} />, color: "text-indigo-600 dark:text-indigo-400", module: 'any' },
        { id: ViewType.BACKUP, label: "Backup & Formatação", icon: <Database size={24} />, color: "text-gray-600 dark:text-gray-400", module: 'any' },
      ].filter(item => item.module === 'any' || modulesConfig[item.module as keyof AppModulesConfig])
    }
  ];

  return (
    <div className="flex flex-col gap-8 pb-10 h-full overflow-y-auto force-scrollbar">
      {/* Theme Toggle */}
      <section className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`${isDarkMode ? 'text-indigo-400' : 'text-amber-500'}`}>
            {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
          </div>
          <div>
            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Modo {isDarkMode ? 'Noturno' : 'Diurno'}</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Ajustar aparência</p>
          </div>
        </div>
        <button 
          title="Alternar Tema"
          aria-label={`Mudar para modo ${isDarkMode ? 'diurno' : 'noturno'}`}
          onClick={toggleDarkMode}
          className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isDarkMode ? 'left-7' : 'left-1'}`} />
        </button>
      </section>

      {/* Menu Groups */}
      <div className="flex flex-col gap-6">
        {menuGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-3">
            <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">{group.title}</h3>
            <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              {group.items.map((item, itemIdx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'SOLE_MATRIX_DIRECT') {
                      onNavigateProduction('MATRIZES');
                    } else {
                      onNavigate(item.id as ViewType);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${itemIdx !== group.items.length - 1 ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${item.color}`}>
                      {item.icon}
                    </div>
                    <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
                  </div>
                  <ChevronRight size={20} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Gestão Cloud Pro v1.2.4</p>
      </div>
    </div>
  );
}
