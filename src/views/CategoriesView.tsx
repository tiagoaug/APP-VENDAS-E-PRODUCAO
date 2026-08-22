import { useState, useEffect } from 'react';
import { Category, CategoryType, AppModulesConfig, ViewType, CategoryTemplate } from '../types';
import { Search, Plus, Tags, Trash2, Edit, ShoppingBag, TrendingDown, TrendingUp, Factory, LayoutGrid, User, Package, PlusCircle, Settings, ChevronRight, ChevronDown, Scissors, Bookmark, BookmarkCheck, Sparkles, Footprints } from 'lucide-react';

import CategoryModal from '../components/CategoryModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { getCategoryModules, categoryModulesInclude } from '../utils/categories';
import { subscribeToCategoryTemplates, saveCategoryTemplate } from '../services/categoryTemplatesService';

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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Modelos de categoria salvos por qualquer conta (coleção compartilhada, fora de
  // users/{uid}) — pool de sugestões prontas pra tocar e adicionar, alimentada pelo botão
  // de marcador em cada categoria já cadastrada (ver handleSaveAsTemplate abaixo).
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
  useEffect(() => {
    const unsub = subscribeToCategoryTemplates(setTemplates);
    return () => unsub();
  }, []);

  const allTabs = [
    { id: CategoryType.PRODUCT, label: 'Produtos', icon: <ShoppingBag size={14} />, color: 'bg-indigo-500', text: 'text-indigo-600', module: 'sales' },
    { id: CategoryType.EXPENSE, label: 'Despesas', icon: <TrendingDown size={14} />, color: 'bg-rose-500', text: 'text-rose-600', module: 'sales' },
    { id: CategoryType.REVENUE, label: 'Receitas', icon: <TrendingUp size={14} />, color: 'bg-emerald-500', text: 'text-emerald-600', module: 'sales' },
    { id: CategoryType.PRODUCTION, label: 'Produção', icon: <Factory size={14} />, color: 'bg-orange-500', text: 'text-orange-600', module: 'production' },
    { id: CategoryType.SUPPLY, label: 'Insumos', icon: <Package size={14} />, color: 'bg-emerald-500', text: 'text-emerald-600', module: 'production' },
    { id: CategoryType.CUTTING_TOOL, label: 'Facas', icon: <Scissors size={14} />, color: 'bg-orange-500', text: 'text-orange-600', module: 'production' },
    { id: CategoryType.MOLD, label: 'Solados', icon: <Footprints size={14} />, color: 'bg-cyan-500', text: 'text-cyan-600', module: 'production' },
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

  const filtered = categories.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryModule = getCategoryModules(c.module).length > 0
      ? c.module
      : (c.type === CategoryType.PRODUCTION || c.type === CategoryType.SUPPLY || c.type === CategoryType.CUTTING_TOOL || c.type === CategoryType.MOLD ? 'production' : c.isPersonal ? 'personal' : 'sales');
    if (!categoryModulesInclude(categoryModule, modulesConfig)) return false;

    if (activeTab === CategoryType.OTHER) {
      return (c.isPersonal || getCategoryModules(c.module).includes('personal')) && matchesSearch;
    }
    return c.type === activeTab && matchesSearch;
  });

  // Categorias pré-prontas por tipo — o usuário só toca pra selecionar em vez de digitar
  // cada uma manualmente; o botão vira "✓ desabilitado" quando já foi adicionada, dando o
  // feedback visual de quais já estão selecionadas (mesma mecânica que já existia só pra
  // Insumos/Facas, agora generalizada pros outros tipos de categoria).
  const CATEGORY_SUGGESTIONS: Partial<Record<CategoryType, { names: string[]; color: string; wrap: string; header: string; activeBtn: string }>> = {
    [CategoryType.PRODUCTION]: {
      names: ['CORTE', 'COSTURA', 'MONTAGEM', 'ACABAMENTO', 'EMBALAGEM'],
      color: 'bg-orange-500',
      wrap: 'bg-orange-50/30 dark:bg-orange-950/20 border-orange-100/50 dark:border-orange-900/30',
      header: 'text-orange-600 dark:text-orange-400',
      activeBtn: 'text-orange-600 border-orange-100 hover:border-orange-500 dark:text-orange-400 dark:border-orange-900',
    },
    [CategoryType.GENERAL]: {
      names: ['GERAL', 'DIVERSOS', 'ADMINISTRATIVO'],
      color: 'bg-blue-500',
      wrap: 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-100/50 dark:border-blue-900/30',
      header: 'text-blue-600 dark:text-blue-400',
      activeBtn: 'text-blue-600 border-blue-100 hover:border-blue-500 dark:text-blue-400 dark:border-blue-900',
    },
    [CategoryType.SUPPLY]: {
      names: ['SOLADOS', 'PALMILHAS', 'COURO/SINTÉTICO', 'FORROS', 'ADESIVOS', 'LINHAS', 'EMBALAGENS', 'MATERIAIS'],
      color: 'bg-emerald-500',
      wrap: 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-100/50 dark:border-emerald-900/30',
      header: 'text-emerald-600 dark:text-emerald-400',
      activeBtn: 'text-emerald-600 border-emerald-100 hover:border-emerald-500 dark:text-emerald-400 dark:border-emerald-900',
    },
    [CategoryType.CUTTING_TOOL]: {
      names: ['LATERAL', 'FRENTE', 'TRASEIRA', 'BIQUEIRA', 'CONTRAFORTE', 'PALMILHA', 'VIRA', 'OUTROS'],
      color: 'bg-orange-500',
      wrap: 'bg-orange-50/30 dark:bg-orange-950/20 border-orange-100/50 dark:border-orange-900/30',
      header: 'text-orange-600 dark:text-orange-400',
      activeBtn: 'text-orange-600 border-orange-100 hover:border-orange-500 dark:text-orange-400 dark:border-orange-900',
    },
    [CategoryType.MOLD]: {
      names: ['SOLADO', 'SALTO', 'PALMILHA'],
      color: 'bg-cyan-500',
      wrap: 'bg-cyan-50/30 dark:bg-cyan-950/20 border-cyan-100/50 dark:border-cyan-900/30',
      header: 'text-cyan-600 dark:text-cyan-400',
      activeBtn: 'text-cyan-600 border-cyan-100 hover:border-cyan-500 dark:text-cyan-400 dark:border-cyan-900',
    },
    [CategoryType.OTHER]: {
      names: ['ALIMENTAÇÃO', 'TRANSPORTE', 'SAÚDE', 'LAZER', 'MORADIA', 'EDUCAÇÃO', 'VESTUÁRIO'],
      color: 'bg-indigo-500',
      wrap: 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-100/50 dark:border-indigo-900/30',
      header: 'text-indigo-600 dark:text-indigo-400',
      activeBtn: 'text-indigo-600 border-indigo-100 hover:border-indigo-500 dark:text-indigo-400 dark:border-indigo-900',
    },
  };

  const handleAddSuggested = (name: string, type: CategoryType) => {
    const config = CATEGORY_SUGGESTIONS[type];
    if (!config) return;
    const exists = categories.some(c => c.name.toUpperCase() === name.toUpperCase() && c.type === type);
    if (exists) return;
    onAdd({
      name,
      type,
      color: config.color,
      ...(type === CategoryType.OTHER ? { isPersonal: true } : {}),
    });
  };

  // Modelos disponíveis pro tipo ativo — o usuário escolhe entre eles ou cria uma nova
  // categoria do zero (fluxo "Nova" já existente, sem mudança nenhuma).
  const templatesForActiveTab = templates.filter(t => t.type === activeTab);

  const handleAddFromTemplate = (template: CategoryTemplate) => {
    const exists = categories.some(c => c.name.toUpperCase() === template.name.toUpperCase() && c.type === template.type);
    if (exists) return;
    onAdd({
      name: template.name,
      type: template.type,
      color: template.color,
      module: template.module,
      isPersonal: template.isPersonal,
    });
  };

  const isSavedAsTemplate = (cat: Category) =>
    templates.some(t => t.name.toUpperCase() === cat.name.toUpperCase() && t.type === cat.type);

  const handleSaveAsTemplate = (cat: Category) => {
    if (isSavedAsTemplate(cat)) return;
    saveCategoryTemplate({
      name: cat.name,
      type: cat.type,
      color: cat.color,
      module: cat.module,
      isPersonal: cat.isPersonal,
    });
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
           <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Todas as Categorias</h2>
            <button
              onClick={() => onNavigate(ViewType.CATEGORY_CONFIG)}
              title="Configurar Hierarquia de Módulos"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Settings size={14} />
              Configurar
            </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={`Filtrar por ${tab.label}`}
              aria-label={`Filtrar categorias por ${tab.label}`}
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
              <span className={`text-[11px] font-black uppercase tracking-tight text-center leading-tight h-6 flex items-center ${
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
              title="Pesquisar Categorias"
              aria-label="Campo de pesquisa de categorias"
              className={`w-full border rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 text-slate-800 dark:text-slate-100 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {(() => {
          const config = CATEGORY_SUGGESTIONS[activeTab];
          if (!config) return null;
          const label = `Sugestões de ${tabs.find(t => t.id === activeTab)?.label || 'Categorias'}`;

          return (
            <div className={`rounded-[2rem] border-2 overflow-hidden ${config.wrap}`}>
              <button
                type="button"
                onClick={() => setSuggestionsOpen(o => !o)}
                className={`w-full flex items-center justify-between px-4 py-3 ${config.header}`}
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={14} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
                </div>
                <ChevronDown size={16} className={`transition-transform duration-200 ${suggestionsOpen ? 'rotate-180' : ''}`} />
              </button>
              {suggestionsOpen && (
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  {config.names.map(name => {
                    const exists = categories.some(c => c.name.toUpperCase() === name.toUpperCase() && c.type === activeTab);
                    return (
                      <button
                        type="button"
                        key={name}
                        onClick={() => handleAddSuggested(name, activeTab)}
                        disabled={exists}
                        title={`Adicionar sugestão: ${name}`}
                        className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${
                          exists
                            ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 border-transparent'
                            : `bg-white dark:bg-slate-900 ${config.activeBtn} shadow-sm active:scale-95`
                        }`}
                      >
                        {name} {exists && '✓'}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {templatesForActiveTab.length > 0 && (
          <div className="rounded-[2rem] border-2 overflow-hidden bg-violet-50/30 dark:bg-violet-950/20 border-violet-100/50 dark:border-violet-900/30">
            <button
              type="button"
              onClick={() => setTemplatesOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-violet-600 dark:text-violet-400"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} />
                <span className="text-[11px] font-black uppercase tracking-widest">Modelos Disponíveis</span>
              </div>
              <ChevronDown size={16} className={`transition-transform duration-200 ${templatesOpen ? 'rotate-180' : ''}`} />
            </button>
            {templatesOpen && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                {templatesForActiveTab.map(template => {
                  const exists = categories.some(c => c.name.toUpperCase() === template.name.toUpperCase() && c.type === template.type);
                  return (
                    <button
                      type="button"
                      key={template.id}
                      onClick={() => handleAddFromTemplate(template)}
                      disabled={exists}
                      title={`Adicionar modelo: ${template.name}`}
                      className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${
                        exists
                          ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 border-transparent'
                          : 'bg-white dark:bg-slate-900 text-violet-600 border-violet-100 hover:border-violet-500 dark:text-violet-400 dark:border-violet-900 shadow-sm active:scale-95'
                      }`}
                    >
                      {template.name} {exists && '✓'}
                    </button>
                  );
                })}
              </div>
            )}
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
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 text-[11px] font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800/50">Pessoal</span>
                        )}
                      </h3>
                      {children.length > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                            {children.length} Subcategorias
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pr-2">
                      <button
                        onClick={() => handleSaveAsTemplate(parent)}
                        disabled={isSavedAsTemplate(parent)}
                        title={isSavedAsTemplate(parent) ? 'Já é um modelo disponível' : 'Salvar como modelo pra outras contas'}
                        className={`p-2 rounded-xl transition-colors ${
                          isSavedAsTemplate(parent)
                            ? 'text-violet-500'
                            : isDarkMode ? 'text-slate-600 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-300 hover:text-violet-600 hover:bg-slate-50'
                        }`}
                      >
                        {isSavedAsTemplate(parent) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      </button>
                      <button
                        onClick={() => { setEditingCategory(parent); setIsModalOpen(true); }}
                        title="Editar Categoria"
                        className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-600 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(parent.id)}
                        title="Excluir Categoria"
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
                        onClick={() => handleSaveAsTemplate(child)}
                        disabled={isSavedAsTemplate(child)}
                        title={isSavedAsTemplate(child) ? 'Já é um modelo disponível' : 'Salvar como modelo pra outras contas'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isSavedAsTemplate(child)
                            ? 'text-violet-500'
                            : isDarkMode ? 'text-slate-600 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-300 hover:text-violet-600 hover:bg-slate-50'
                        }`}
                      >
                        {isSavedAsTemplate(child) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </button>
                      <button
                        onClick={() => { setEditingCategory(child); setIsModalOpen(true); }}
                        title="Editar Subcategoria"
                        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-slate-600 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(child.id)}
                        title="Excluir Subcategoria"
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
          data-guide-anchor="cat.novo"
          className={`border-2 border-dashed rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] group min-h-[100px] mt-2 ${
            isDarkMode 
              ? 'bg-indigo-950/10 border-indigo-900/30 text-indigo-400 hover:bg-indigo-900/20 hover:border-indigo-500' 
              : 'bg-indigo-50/20 border-indigo-100 text-indigo-600 hover:bg-indigo-50/50 hover:border-indigo-300 shadow-sm shadow-indigo-100/20'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg transform transition-transform duration-500 group-hover:scale-110">
            <Plus size={16} strokeWidth={3} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-center">Nova</span>
        </button>
      </div>
    </div>
  );
}
