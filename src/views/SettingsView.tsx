import { 
  Package, 
  Users, 
  Truck, 
  Tags, 
  TableCellsMerge, 
  Palette, 
  CreditCard, 
  Wallet,
  BarChart3, 
  Database,
  Boxes,
  Moon,
  Sun,
  ChevronRight,
  Layout
} from 'lucide-react';
import { ViewType } from '../types';

interface SettingsViewProps {
  onNavigate: (view: ViewType) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export default function SettingsView({ onNavigate, isDarkMode, toggleDarkMode }: SettingsViewProps) {
  const menuGroups = [
    {
      title: "Cadastros Principal",
      items: [
        { id: ViewType.PRODUCTS, label: "Produtos (Produção)", icon: <Package size={24} />, color: "text-indigo-600 dark:text-indigo-400" },
        { id: ViewType.STOCK, label: "Estoque Central", icon: <Boxes size={24} />, color: "text-amber-700 dark:text-amber-500" },
        { id: ViewType.PEOPLE, label: "Clientes e Fornecedores", icon: <Users size={24} />, color: "text-emerald-600 dark:text-emerald-400" },
      ]
    },
    {
      title: "Configurações de Produto",
      items: [
        { id: ViewType.CATEGORIES, label: "Categorias", icon: <Tags size={24} />, color: "text-rose-600 dark:text-rose-400" },
        { id: ViewType.GRIDS, label: "Grades de Tamanhos", icon: <TableCellsMerge size={24} />, color: "text-cyan-600 dark:text-cyan-400" },
        { id: ViewType.COLORS, label: "Cores", icon: <Palette size={24} />, color: "text-purple-600 dark:text-purple-400" },
      ]
    },
    {
      title: "Financeiro & Contas",
      items: [
        { id: ViewType.ACCOUNTS, label: "Gerenciar Contas", icon: <Wallet size={24} />, color: "text-emerald-600 dark:text-emerald-400" },
        { id: ViewType.PAYMENT_METHODS, label: "Métodos de Pagamento", icon: <CreditCard size={24} />, color: "text-blue-600 dark:text-blue-400" },
        { id: ViewType.REPORTS, label: "Relatórios Avançados", icon: <BarChart3 size={24} />, color: "text-slate-600 dark:text-slate-400" },
        { id: ViewType.BACKUP, label: "Backup & Formatação", icon: <Database size={24} />, color: "text-gray-600 dark:text-gray-400" },
      ]
    },
    {
      title: "Personalização",
      items: [
        { id: ViewType.DASHBOARD_CONFIG, label: "Organizar Dashboard", icon: <Layout size={24} />, color: "text-indigo-600 dark:text-indigo-400" },
      ]
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
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${itemIdx !== group.items.length - 1 ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 flex items-center justify-center ${item.color}`}>
                      {item.icon}
                    </div>
                    <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.label}</span>
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
