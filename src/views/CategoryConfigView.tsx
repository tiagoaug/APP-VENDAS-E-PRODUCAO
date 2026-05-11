import { useState } from 'react';
import { Category, CategoryType, AppModulesConfig } from '../types';
import { ArrowLeft, Shield, ChevronRight, LayoutGrid, CheckCircle2 } from 'lucide-react';
import Modal from '../components/Modal';

interface CategoryConfigViewProps {
  categories: Category[];
  modulesConfig: AppModulesConfig;
  onEdit: (id: string, updates: Partial<Category>) => void;
  onBack: () => void;
  isDarkMode: boolean;
}

export default function CategoryConfigView({ categories, onEdit, onBack, isDarkMode }: CategoryConfigViewProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const handleModuleChange = (id: string, module: keyof AppModulesConfig) => {
    onEdit(id, { module });

    const children = categories.filter(c => c.parentId === id);
    children.forEach(child => {
      onEdit(child.id, { module });
    });
    
    setSelectedCategoryId(null);
  };

  const getModuleName = (module?: string) => {
    switch (module) {
      case 'sales': return 'Vendas';
      case 'production': return 'Produção';
      case 'personal': return 'Pessoal';
      default: return 'Não Definido';
    }
  };

  const translateType = (type: CategoryType) => {
    switch (type) {
      case CategoryType.PRODUCT: return 'Produtos';
      case CategoryType.EXPENSE: return 'Despesas';
      case CategoryType.REVENUE: return 'Receitas';
      case CategoryType.PRODUCTION: return 'Produção';
      case CategoryType.GENERAL: return 'Gerais';
      case CategoryType.SUPPLY: return 'Insumos';
      case CategoryType.OTHER: return 'Pessoais';
      default: return type;
    }
  };

  const mainCategories = categories.filter(c => !c.parentId);
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  return (
    <div className="flex flex-col gap-6 pb-32">
      <header className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Hierarquia de Módulos</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Configure o acesso por grupo de categorias</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 mx-1">
        {mainCategories.map((parent) => {
          const children = categories.filter(c => c.parentId === parent.id);
          return (
            <div key={parent.id} className={`rounded-[2rem] border overflow-hidden transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'}`}>
              <div className="p-5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 border-b dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${parent.color} text-white shadow-lg`}>
                    <LayoutGrid size={20} />
                  </div>
                  <div>
                    <h3 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{parent.name}</h3>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{translateType(parent.type)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCategoryId(parent.id)}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white border border-slate-200 text-indigo-600 hover:border-indigo-500 shadow-sm'
                  }`}
                >
                  Módulo: {getModuleName(parent.module)}
                </button>
              </div>

              {children.length > 0 && (
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {children.map(child => (
                    <div key={child.id} className="p-4 pl-12 flex items-center justify-between group hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <ChevronRight size={14} className="text-slate-300" />
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{child.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 italic">Herdado de {parent.name}</span>
                        <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                          {getModuleName(child.module)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`mx-1 p-8 rounded-[3rem] bg-indigo-50/30 dark:bg-indigo-950/10 border-2 border-dashed ${isDarkMode ? 'border-indigo-900/30' : 'border-indigo-100'}`}>
        <div className="flex gap-6 items-start">
          <div className="p-4 rounded-2xl bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 shrink-0">
            <Shield size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className={`text-base font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-indigo-900'}`}>Herança de Módulos</h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
              Se uma <strong>categoria pai</strong> for vinculada a um módulo, todas as subcategorias dentro dela pertencerão ao mesmo módulo automaticamente.
            </p>
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!selectedCategoryId}
        onClose={() => setSelectedCategoryId(null)}
        title="Escolher Módulo"
      >
        <div className="flex flex-col gap-4 p-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
            Escolha o módulo para <strong>{selectedCategory?.name}</strong> e todas as suas subcategorias:
          </p>
          {(['sales', 'production', 'personal'] as const).map(m => (
            <button
              key={m}
              onClick={() => handleModuleChange(selectedCategoryId!, m)}
              className={`w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all group ${
                selectedCategory?.module === m
                  ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
              }`}
            >
              <span className={`text-sm font-black uppercase tracking-widest ${selectedCategory?.module === m ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {getModuleName(m)}
              </span>
              {selectedCategory?.module === m && (
                <CheckCircle2 size={20} className="text-indigo-500" />
              )}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
