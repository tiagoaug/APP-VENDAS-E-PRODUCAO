import { useState, useEffect } from 'react';
import { Category, CategoryType, AppModulesConfig, ViewType } from '../types';
import { Search, Plus, Tags, Trash2, Edit, ShoppingBag, TrendingDown, TrendingUp, Factory, LayoutGrid, User, Package, PlusCircle, Settings } from 'lucide-react';
import CategoryModal from '../components/CategoryModal';
import ConfirmDialog from '../components/ConfirmDialog';

interface CategoriesViewProps {
  categories: Category[];
  onAdd: (category: Omit<Category, 'id'>) => void;
  onEdit: (id: string, category: Omit<Category, 'id'>) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
  modulesConfig: AppModulesConfig;
  onNavigate: (view: ViewType) => void;
}

export default function CategoriesView({ categories, onAdd, onEdit, onDelete, isDarkMode, modulesConfig, onNavigate }: CategoriesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const allTabs = [
    { id: CategoryType.PRODUCT, label: 'Produtos', icon: <ShoppingBag size={14} />, color: 'bg-indigo-500', text: 'text-indigo-600', module: 'sales' },
    { id: CategoryType.EXPENSE, label: 'Despesas', icon: <TrendingDown size={14} />, color: 'bg-rose-500', text: 'text-rose-600', module: 'sales' },
    { id: CategoryType.REVENUE, label: 'Receitas', icon: <TrendingUp size={14} />, color: 'bg-emerald-500', text: 'text-emerald-600', module: 'sales' },
    { id: CategoryType.PRODUCTION, label: 'Produção', icon: <Factory size={14} />, color: 'bg-orange-500', text: 'text-orange-600', module: 'production' },
    { id: CategoryType.SUPPLY, label: 'Insumos', icon: <Package size={14} />, color: 'bg-emerald-500', text: 'text-emerald-600', module: 'production' },
    { id: CategoryType.GENERAL, label: 'Gerais', icon: <LayoutGrid size={14} />, color: 'bg-blue-500', text: 'text-blue-600', module: 'sales' },
    { id: CategoryType.OTHER, label: 'Pessoais', icon: <User size={14} />, color: 'bg-indigo-500', text: 'text-indigo-600', module: 'personal' },
  ];

  const tabs = allTabs.filter(t => modulesConfig[t.module as keyof AppModulesConfig]);
  const [activeTab, setActiveTab] = useState<CategoryType>(tabs[0]?.id || CategoryType.PRODUCT);
  
  // Ensure active tab is valid if modules are disabled
  useEffect(() => {
    const isCurrentTabVisible = tabs.some(t => t.id === activeTab);
    if (!isCurrentTabVisible && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [modulesConfig, tabs, activeTab]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const rootCategories = categories.filter(c => 
    c.isRoot && 
    modulesConfig[ (c.module || (c.type === CategoryType.PRODUCTION || c.type === CategoryType.SUPPLY ? 'production' : c.isPersonal ? 'personal' : 'sales')) as keyof AppModulesConfig ]
  );

  const filtered = categories.filter(c => {
    if (c.isRoot) return false; // Don't show in the bottom list if it's a root card

    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryModule = c.module || (c.type === CategoryType.PRODUCTION || c.type === CategoryType.SUPPLY ? 'production' : c.isPersonal ? 'personal' : 'sales');
    if (!modulesConfig[categoryModule as keyof AppModulesConfig]) return false;

    if (activeTab === CategoryType.OTHER) {
      return (c.isPersonal || c.module === 'personal') && matchesSearch;
    }
    return c.type === activeTab && matchesSearch;
  });

  const suggestedSupplies = ['SOLADOS', 'PALMILHAS', 'COURO/SINTÉTICO', 'FORROS', 'ADESIVOS', 'LINHAS', 'EMBALAGENS', 'MATERIAIS'];

  const handleAddSuggested = (name: string) => {
    const exists = categories.some(c => c.name.toUpperCase() === name.toUpperCase() && c.type === CategoryType.SUPPLY);
    if (!exists) {
      onAdd({ name, type: CategoryType.SUPPLY, color: 'bg-emerald-500' });
    }
  };

  const handleDeleteClick = (id: string) => {
    setIdToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (idToDelete) {
      onDelete(idToDelete);
      setIdToDelete(null);
      setIsConfirmOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20 px-1">
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Excluir Categoria?"
        message="Deseja realmente excluir esta categoria? Os itens associados a ela não serão excluídos, mas ficarão sem categoria vinculada."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsConfirmOpen(false);
          setIdToDelete(null);
        }}
        isDanger={true}
      />
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingCategory(null); }}
        onSave={(cat) => {
          if (editingCategory) onEdit(editingCategory.id, cat);
          else onAdd(cat);
        }}
        category={editingCategory || undefined}
        categories={categories}
        defaultType={activeTab}
        modulesConfig={modulesConfig}
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
           <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Categorias Principais</h2>
           <button 
             onClick={() => onNavigate(ViewType.CATEGORY_CONFIG)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
           >
             <Settings size={14} />
             Configurar
           </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {rootCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                // When clicking a root card, we might want to filter the list below or edit it
                setEditingCategory(cat);
                setIsModalOpen(true);
              }}
              className={`flex flex-col items-center justify-center gap-3 p-5 rounded-[2.5rem] border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-xl shadow-slate-950/20' : 'bg-white border-slate-100 text-slate-800 shadow-xl shadow-slate-200/30'
              }`}
            >
              <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shadow-inner ${
                cat.color.replace('bg-', 'bg-opacity-10 ')
              }`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${cat.color} text-white`}>
                  <LayoutGrid size={20} />
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-center">{cat.name}</span>
            </button>
          ))}
          
          {rootCategories.length === 0 && (
            <div className={`col-span-full p-8 rounded-[2.5rem] border border-dashed flex flex-col items-center justify-center text-center gap-2 ${isDarkMode ? 'bg-slate-900/30 border-slate-800 text-slate-600' : 'bg-slate-50/50 border-slate-200 text-slate-400'}`}>
              <LayoutGrid size={24} className="opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Nenhuma categoria principal definida</p>
              <p className="text-[8px] font-medium max-w-[200px]">Marque "Categoria Principal" ao criar ou editar para fixá-la aqui.</p>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

        <div className="flex items-center justify-between px-1">
           <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Todas as Categorias</h2>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-2 py-3 px-1 rounded-2xl border transition-all ${
                activeTab === tab.id 
                  ? `${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-lg shadow-slate-100'} scale-[1.05]` 
                  : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-50 text-slate-400 hover:text-slate-600 shadow-sm'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                activeTab === tab.id 
                  ? `${tab.color} text-white shadow-md` 
                  : isDarkMode ? 'bg-slate-800 text-slate-500' : `${tab.color.replace('bg-', 'bg-opacity-10 ')} ${tab.text}`
              }`}>
                {tab.icon}
              </div>
              <span className={`text-[9.5px] font-black uppercase tracking-tight text-center leading-tight h-6 flex items-center ${
                activeTab === tab.id ? tab.text : 'text-inherit'
              }`}>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder={`Buscar em ${tabs.find(t => t.id === activeTab)?.label}...`}
              className={`w-full border rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 text-slate-800 dark:text-slate-100 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {activeTab === CategoryType.SUPPLY && (
          <div className="flex flex-col gap-2 p-4 rounded-[2rem] bg-emerald-50/30 dark:bg-emerald-950/20 border-2 border-emerald-100/50 dark:border-emerald-900/30">
            <div className="flex items-center gap-2 mb-1">
              <PlusCircle size={14} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Sugestões de Insumos</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedSupplies.map(name => {
                const exists = categories.some(c => c.name.toUpperCase() === name.toUpperCase() && c.type === CategoryType.SUPPLY);
                return (
                  <button
                    key={name}
                    onClick={() => handleAddSuggested(name)}
                    disabled={exists}
                    className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                      exists 
                        ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 border-2 border-transparent' 
                        : 'bg-white text-emerald-600 border-2 border-emerald-100 hover:border-emerald-500 dark:bg-slate-900 dark:text-emerald-400 dark:border-emerald-900 shadow-sm active:scale-95'
                    }`}
                  >
                    {name} {exists && '✓'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {filtered
          .filter(c => !c.parentId)
          .map((parent) => {
            const children = filtered.filter(c => c.parentId === parent.id);
            return (
              <div key={parent.id} className="flex flex-col gap-2">
                <div className={`p-4 rounded-[2rem] border shadow-sm flex items-center justify-between relative overflow-hidden group transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <div className={`absolute left-0 top-0 w-1.5 h-full ${parent.color}`} />
                  
                  <div className="flex items-center gap-4 pl-3">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 ${parent.color.replace('bg-', 'text-')}`}>
                      <Tags size={18} />
                    </div>
                    
                    <div>
                      <h3 className={`font-black text-xs uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {parent.name}
                        {parent.isPersonal && (
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800/50">Pessoal</span>
                        )}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                          {children.length > 0 ? `${children.length} Subcategorias` : 'Categoria Principal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pr-2">
                      <button 
                        onClick={() => { setEditingCategory(parent); setIsModalOpen(true); }} 
                        className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-600 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(parent.id)}
                        className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-600 hover:text-rose-500 hover:bg-slate-800' : 'text-slate-300 hover:text-rose-500 hover:bg-slate-50'}`}
                      >
                        <Trash2 size={16} />
                      </button>
                  </div>
                </div>

                {children.map(child => (
                  <div key={child.id} className={`ml-8 p-3 rounded-[1.5rem] border shadow-sm flex items-center justify-between relative overflow-hidden group transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-slate-900/50 border-slate-800/50' : 'bg-slate-50/50 border-slate-100'}`}>
                    <div className="flex items-center gap-3 pl-2">
                      <ChevronRight size={14} className="text-slate-300" />
                      <div className={`w-1.5 h-1.5 rounded-full ${child.color}`} />
                      <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{child.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 pr-1">
                      <button 
                        onClick={() => { setEditingCategory(child); setIsModalOpen(true); }} 
                        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-slate-600 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(child.id)}
                        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-slate-600 hover:text-rose-500 hover:bg-slate-800' : 'text-slate-300 hover:text-rose-500 hover:bg-slate-50'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

        <button 
          onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
          className={`border-2 border-dashed rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] group min-h-[100px] mt-2 ${
            isDarkMode 
              ? 'bg-indigo-950/10 border-indigo-900/30 text-indigo-400 hover:bg-indigo-900/20 hover:border-indigo-500' 
              : 'bg-indigo-50/20 border-indigo-100 text-indigo-600 hover:bg-indigo-50/50 hover:border-indigo-300 shadow-sm shadow-indigo-100/20'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg transform transition-transform duration-500 group-hover:scale-110">
            <Plus size={16} strokeWidth={3} />
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-center">Nova</span>
        </button>
      </div>
    </div>
  );
}
