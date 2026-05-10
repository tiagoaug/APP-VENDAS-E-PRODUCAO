import { 
  Package, 
  ArrowLeft,
  ChevronRight,
  Database,
  Plus,
  Grid3X3,
  Footprints,
  Layers,
  History,
  TrendingUp,
  AlertCircle,
  FileText,
  Search,
  ExternalLink,
  Palette
} from 'lucide-react';
import { ViewType, ProductionScreenType, Product, Grid } from '../types';
import { motion } from 'motion/react';
import ConfigMenuItem from '../components/ConfigMenuItem';

interface ProductSheetMenuViewProps {
  onNavigate: (view: ViewType, id?: string | null) => void;
  onAddProduct: () => void;
  onNavigateGrids: () => void;
  onNavigateProductionConfig: (screen: ProductionScreenType) => void;
  onBack: () => void;
  isDarkMode: boolean;
  products: Product[];
  grids: Grid[];
}

export default function ProductSheetMenuView({ 
  onNavigate, 
  onAddProduct, 
  onNavigateGrids, 
  onNavigateProductionConfig,
  onBack, 
  isDarkMode,
  products,
  grids
}: ProductSheetMenuViewProps) {
  // Stats calculation
  const totalProducts = products.length;
  const totalGrids = grids.length;
  const recentProducts = [...products].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);
  
  const stats = [
    { label: "Modelos", value: totalProducts, icon: <Package size={18} />, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Grades", value: totalGrids, icon: <Grid3X3 size={18} />, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Ativos", value: products.filter(p => p.status === 'ACTIVE').length, icon: <TrendingUp size={18} />, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  const menuGroups = [
    {
      title: "Gestão e Desenvolvimento",
      items: [
        { 
          id: 'PRODUCTS',
          label: "Produtos Cadastrados", 
          desc: "Visualizar e gerenciar catálogo de produtos",
          icon: <Package size={24} />, 
          color: "text-indigo-600",
          bg: "bg-indigo-50",
          onClick: () => onNavigate(ViewType.PRODUCTS)
        },
        { 
          id: 'NEW_PRODUCT',
          label: "Cadastrar Novo Modelo", 
          desc: "Cadastrar novo modelo de produto",
          icon: <Plus size={24} />, 
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          onClick: onAddProduct
        },
        { 
          id: 'COLORS',
          label: "Paleta de Cores", 
          desc: "Gerenciar cores e variações",
          icon: <Palette size={24} />, 
          color: "text-pink-600",
          bg: "bg-pink-50",
          onClick: () => onNavigate(ViewType.COLORS)
        },
      ]
    },
    {
      title: "Configurações Técnicas",
      items: [
        { 
          id: 'GRIDS',
          label: "Grades de Produção", 
          desc: "Tamanhos e configurações",
          icon: <Grid3X3 size={24} />, 
          color: "text-violet-600",
          bg: "bg-violet-50",
          onClick: onNavigateGrids
        },
        { 
          id: 'SOLES',
          label: "Matrizes de Solados", 
          desc: "Moldes e mapeamentos",
          icon: <Footprints size={24} />, 
          color: "text-orange-600",
          bg: "bg-orange-50",
          onClick: () => onNavigateProductionConfig('MATRIZES')
        },
        { 
          id: 'MATERIALS',
          label: "Materiais e Insumos", 
          desc: "Componentes para produção",
          icon: <Layers size={24} />, 
          color: "text-blue-600",
          bg: "bg-blue-50",
          onClick: () => onNavigateProductionConfig('INSUMOS')
        },
      ]
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex-1 overflow-y-auto pb-32 custom-scrollbar">
        <header className="flex flex-col gap-6 mb-8 px-2">
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-16 h-16 rounded-[1.8rem] bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-500/20"
            >
              <Database size={32} strokeWidth={2.5} />
            </motion.div>
            <div>
              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white"
              >
                Engenharia
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-1"
              >
                Ficha Técnica e Desenvolvimento
              </motion.p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + (idx * 0.1) }}
                className={`p-4 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              >
                <div className={`w-8 h-8 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                  {stat.icon}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{stat.label}</p>
                <p className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
              </motion.div>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2">
          {/* Main Menu Column */}
          <div className="flex flex-col gap-6">
            {menuGroups.map((group, groupIdx) => (
              <div key={`group-${groupIdx}`} className="flex flex-col gap-3">
                <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                  {group.title}
                </h3>
                <div className={`rounded-[2rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  {group.items.map((item, index) => {
                    const isLast = index === group.items.length - 1;
                    return (
                      <ConfigMenuItem
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        desc={item.desc}
                        color={item.color}
                        bg={item.bg}
                        isDarkMode={isDarkMode}
                        onClick={item.onClick}
                        isLast={isLast}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity Column */}
          <div className="flex flex-col gap-6">
            <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none flex items-center gap-2">
              <History size={14} />
              Modelos Recentes
            </h3>
            <div className={`rounded-[2rem] border shadow-sm p-4 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              {recentProducts.length > 0 ? (
                recentProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onNavigate(ViewType.PRODUCT_FORM, p.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                      <Package size={20} />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Ref: {p.reference}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center text-center gap-4 opacity-50">
                  <AlertCircle size={32} className="text-slate-300" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhum modelo cadastrado</p>
                </div>
              )}
              
              {totalProducts > 3 && (
                <button
                  onClick={() => onNavigate(ViewType.PRODUCTS)}
                  className={`mt-2 w-full py-3 rounded-xl border-2 border-dashed text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400' : 'border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-500'}`}
                >
                  Ver todos os {totalProducts} modelos
                </button>
              )}
            </div>

            {/* Quick Tips or Alerts */}
            <div className={`p-6 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-100 bg-slate-50/50'}`}>
               <div className="flex items-start gap-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                   <AlertCircle size={20} />
                 </div>
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1">Dica de Engenharia</p>
                   <p className={`text-[10px] font-bold leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                     Certifique-se de configurar as **Grades de Produção** antes de criar novos modelos para habilitar o mapeamento de solas automático.
                   </p>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Bottom Back Button */}
        <div className="mt-8 flex justify-center px-2">
          <button 
            onClick={onBack}
            className={`flex items-center gap-2 px-8 py-5 rounded-[2rem] w-full transition-all border-2 ${isDarkMode ? 'bg-slate-800/30 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700' : 'bg-white border-slate-100 text-slate-500 hover:text-slate-900 hover:border-slate-200 shadow-sm'}`}
          >
            <ArrowLeft size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Voltar ao Início</span>
          </button>
        </div>
      </div>
    </div>
  );
}
