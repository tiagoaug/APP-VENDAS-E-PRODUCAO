import { useState } from 'react';
import { Category, CategoryType } from '../types';
import { Search, Plus, Tags, Trash2, Edit, ShoppingBag, TrendingDown, TrendingUp, Factory, LayoutGrid, User, Package, PlusCircle } from 'lucide-react';
import CategoryModal from '../components/CategoryModal';
import ConfirmDialog from '../components/ConfirmDialog';

interface CategoriesViewProps {
  categories: Category[];
  onAdd: (category: Omit<Category, 'id'>) => void;
  onEdit: (id: string, category: Omit<Category, 'id'>) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
}

export default function CategoriesView({ categories, onAdd, onEdit, onDelete, isDarkMode }: CategoriesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryType>(CategoryType.PRODUCT);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const filtered = categories.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === CategoryType.OTHER) {
      return c.isPersonal && matchesSearch;
    }
    return c.type === activeTab && matchesSearch;
  });

  const tabs = [
    { id: CategoryType.PRODUCT, label: 'Produtos', icon: <ShoppingBag size={14} />, color: 'bg-indigo-500', text: 'text-indigo-600' },
    { id: CategoryType.EXPENSE, label: 'Despesas', icon: <TrendingDown size={14} />, color: 'bg-rose-500', text: 'text-rose-600' },
    { id: CategoryType.REVENUE, label: 'Receitas', icon: <TrendingUp size={14} />, color: 'bg-emerald-500', text: 'text-emerald-600' },
    { id: CategoryType.PRODUCTION, label: 'Produção', icon: <Factory size={14} />, color: 'bg-orange-500', text: 'text-orange-600' },
    { id: CategoryType.SUPPLY, label: 'Insumos', icon: <Package size={14} />, color: 'bg-emerald-500', text: 'text-emerald-600' },
    { id: CategoryType.GENERAL, label: 'Gerais', icon: <LayoutGrid size={14} />, color: 'bg-blue-500', text: 'text-blue-600' },
    { id: CategoryType.OTHER, label: 'Pessoais', icon: <User size={14} />, color: 'bg-indigo-500', text: 'text-indigo-600' },
  ];

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
        defaultType={activeTab}
      />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-2 py-3 px-1 rounded-2xl border transition-all ${
                activeTab === tab.id 
                  ? 'bg-slate-900 border-slate-900 dark:bg-indigo-600 dark:border-indigo-600 text-white shadow-lg scale-[1.02]' 
                  : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-100 text-slate-500 hover:text-slate-900 shadow-sm'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                activeTab === tab.id 
                  ? 'bg-white/20 text-white' 
                  : isDarkMode ? 'bg-slate-800 text-slate-500' : `${tab.color.replace('-500', '-50')} ${tab.text}`
              }`}>
                {tab.icon}
              </div>
              <span className="text-[8px] font-black uppercase tracking-tight text-center leading-tight h-5 flex items-center">{tab.label}</span>
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

      <div className="grid grid-cols-4 gap-2">
        {filtered.map((category) => (
          <div key={category.id} className={`p-3 rounded-3xl border shadow-sm flex flex-col gap-2 relative overflow-hidden group transition-all hover:scale-[1.02] active:scale-[0.98] ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className={`absolute top-0 left-0 w-full h-1 ${category.color}`} />
            
            <div className="flex items-start justify-between">
              <div className={`w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 ${category.color.replace('bg-', 'text-')}`}>
                <Tags size={16} />
              </div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => { setEditingCategory(category); setIsModalOpen(true); }} 
                  className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'text-slate-600 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}
                  title="Editar Categoria"
                  aria-label="Editar Categoria"
                >
                  <Edit size={14} />
                </button>
                <button 
                  onClick={() => handleDeleteClick(category.id)}
                  className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'text-slate-600 hover:text-rose-500 hover:bg-slate-800' : 'text-slate-300 hover:text-rose-500 hover:bg-slate-50'}`}
                  title="Excluir Categoria"
                  aria-label="Excluir Categoria"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div>
              <h3 className={`font-black text-[10px] uppercase tracking-wider leading-tight min-h-[2.5rem] flex flex-wrap gap-1 items-start ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {category.name}
                {category.isPersonal && (
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 text-[6px] font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800/50 inline-block">Pessoal</span>
                )}
              </h3>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[7px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Reg.</span>
                <span className={`text-[8px] font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-900'}`}>{Math.floor(Math.random() * 20)}</span>
              </div>
            </div>
          </div>
        ))}

        <button 
          onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
          className={`border-2 border-dashed rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] group min-h-[120px] ${
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
