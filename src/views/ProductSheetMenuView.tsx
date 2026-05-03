import { 
  Package, 
  ArrowLeft,
  ChevronRight,
  Database
} from 'lucide-react';
import { ViewType } from '../types';
import { motion } from 'framer-motion';
import ConfigMenuItem from '../components/ConfigMenuItem';

interface ProductSheetMenuViewProps {
  onNavigate: (view: ViewType) => void;
  onBack: () => void;
  isDarkMode: boolean;
}

export default function ProductSheetMenuView({ onNavigate, onBack, isDarkMode }: ProductSheetMenuViewProps) {
  const menuItems = [
    { 
      id: ViewType.PRODUCTS, 
      label: "Produtos", 
      desc: "Gerenciar Catálogo",
      icon: <Package size={24} />, 
      color: "text-indigo-600",
      bg: "bg-indigo-50"
    },
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
                Ficha Técnica
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1"
              >
                Engenharia de Produtos
              </motion.p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Cadastros Base</h3>
            <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              {menuItems.map((item, index) => (
                <ConfigMenuItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  desc={item.desc}
                  color={item.color}
                  bg={item.bg}
                  isDarkMode={isDarkMode}
                  onClick={() => onNavigate(item.id)}
                  isLast={index === menuItems.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Back Button specifically requested */}
        <div className="mt-8 flex justify-center">
          <button 
            onClick={onBack}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl w-full transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-black uppercase tracking-widest">Voltar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
