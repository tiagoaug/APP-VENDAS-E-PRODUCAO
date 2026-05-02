import { useState } from 'react';
import { Category, CategoryType } from '../types';
import { Search, Plus, Tags, Trash2, Edit, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react';
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

  const filtered = categories.filter(c => 
    !c.isPersonal &&
    c.type === activeTab &&
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: CategoryType.PRODUCT, label: 'Produtos', icon: <ShoppingBag size={14} /> },
    { id: CategoryType.EXPENSE, label: 'Despesas', icon: <TrendingDown size={14} /> },
    { id: CategoryType.REVENUE, label: 'Receitas', icon: <TrendingUp size={14} /> },
  ];

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
    <div className="flex flex-col gap-6 pb-64 h-screen overflow-y-auto force-scrollbar px-4">
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
      />
      <div className="flex flex-col gap-4">
        <div className={`flex p-1 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
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

      <div className="flex flex-col gap-3">
        {filtered.map((category) => (
          <div key={category.id} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between relative overflow-hidden group transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className={`absolute left-0 top-0 w-1 h-full ${category.color}`} />
            
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 ${category.color.replace('bg-', 'text-')}`}>
                <Tags size={22} />
              </div>
              <div>
                <h3 className={`font-black text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{category.name}</h3>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">Registros: {Math.floor(Math.random() * 50)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setEditingCategory(category); setIsModalOpen(true); }} 
                className={`p-2 transition-colors ${isDarkMode ? 'text-slate-700 hover:text-indigo-400' : 'text-slate-200 hover:text-indigo-600'}`}
                title="Editar Categoria"
                aria-label="Editar Categoria"
              >
                <Edit size={18} />
              </button>
              <button 
                onClick={() => handleDeleteClick(category.id)}
                className={`p-2 transition-colors ${isDarkMode ? 'text-slate-700 hover:text-rose-500' : 'text-slate-200 hover:text-rose-500'}`}
                title="Excluir Categoria"
                aria-label="Excluir Categoria"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        <button 
          onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
          className={`border-2 border-dashed rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.98] group ${
            isDarkMode 
              ? 'bg-indigo-950/20 border-indigo-900/30 text-indigo-300 hover:bg-indigo-900/40 hover:border-indigo-500' 
              : 'bg-indigo-50/40 border-indigo-100 text-indigo-600 hover:bg-indigo-100/70 hover:border-indigo-300 shadow-sm shadow-indigo-100/50'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-xl transform transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
            <Plus size={28} strokeWidth={3} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.25em] drop-shadow-sm">Adicionar Nova Categoria</span>
        </button>
      </div>
    </div>
  );
}
