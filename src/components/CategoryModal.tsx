
import { useState, useEffect } from 'react';
import { Category, CategoryType, AppModulesConfig } from '../types';


interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Omit<Category, 'id'>) => void;
  category?: Category;
  categories: Category[];
  defaultType?: CategoryType;
  modulesConfig: AppModulesConfig;
}

export default function CategoryModal({ isOpen, onClose, onSave, category, categories, defaultType, modulesConfig }: CategoryModalProps) {
  const [name, setName] = useState(category?.name || '');
  const [type, setType] = useState<CategoryType>(category?.type || defaultType || CategoryType.PRODUCT);
  const [module, setModule] = useState<keyof AppModulesConfig>(category?.module || 'sales');
  const [isPersonal, setIsPersonal] = useState(category?.isPersonal || defaultType === CategoryType.OTHER || category?.module === 'personal');
  const [parentId, setParentId] = useState<string | undefined>(category?.parentId);
  const [isRoot, setIsRoot] = useState(category?.isRoot || false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setType(category.type);
      setModule(category.module || 'sales');
      setIsPersonal(!!category.isPersonal || category.module === 'personal');
      setParentId(category.parentId);
      setIsRoot(!!category.isRoot);
    } else if (defaultType) {
      setType(defaultType);
      
      let suggestedModule: keyof AppModulesConfig = 'sales';
      if (defaultType === CategoryType.PRODUCTION || defaultType === CategoryType.SUPPLY) suggestedModule = 'production';
      if (defaultType === CategoryType.OTHER) suggestedModule = 'personal';
      
      setModule(suggestedModule);
      setIsPersonal(defaultType === CategoryType.OTHER);
      setParentId(undefined);
      setIsRoot(false);
    }
  }, [category, defaultType]);

  const handleParentChange = (id: string) => {
    setParentId(id || undefined);
    if (id) {
      const parent = categories.find(c => c.id === id);
      if (parent?.module) {
        setModule(parent.module);
      }
      if (parent?.type) {
        setType(parent.type);
      }
      setIsRoot(false);
    }
  };

  const handleTypeChange = (newType: CategoryType) => {
    setType(newType);
    if (newType === CategoryType.PRODUCTION || newType === CategoryType.SUPPLY) setModule('production');
    else if (newType === CategoryType.OTHER) {
      setModule('personal');
      setIsPersonal(true);
    }
    else setModule('sales');
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name,
      type,
      color: category?.color || 'bg-indigo-500',
      module,
      isPersonal,
      parentId,
      isRoot: !parentId && isRoot
    });
    onClose();
  };

  const parentOptions = categories.filter(c => !c.parentId && c.id !== category?.id);

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-black text-slate-800 dark:text-white">
          {category ? 'Editar Categoria' : 'Nova Categoria'}
        </h2>
        
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Nome da Categoria</span>
          <input
            type="text"
            placeholder="Ex: Aluguel, Vendas Loja..."
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Categoria Pai (Opcional)</span>
          <select
            title="Categoria Pai"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold appearance-none dark:text-white"
            value={parentId || ''}
            onChange={(e) => handleParentChange(e.target.value)}
          >
            <option value="">Nenhuma (Categoria Principal)</option>
            {parentOptions.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Tipo</span>
          <select
            title="Tipo de Categoria"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold appearance-none dark:text-white"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as CategoryType)}
          >
            <option value={CategoryType.PRODUCT}>PRODUTOS</option>
            <option value={CategoryType.EXPENSE}>DESPESAS</option>
            <option value={CategoryType.REVENUE}>RECEITAS</option>
            <option value={CategoryType.PRODUCTION}>PRODUÇÃO</option>
            <option value={CategoryType.GENERAL}>GERAIS</option>
            <option value={CategoryType.SUPPLY}>INSUMOS</option>
            <option value={CategoryType.OTHER}>PESSOAIS (OUTRAS)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Módulo Vinculado</span>
          <div className="grid grid-cols-3 gap-2">
            {(['sales', 'production', 'personal'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModule(m);
                  if (m === 'personal') setIsPersonal(true);
                }}
                className={`py-2 px-1 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${
                  module === m 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                }`}
              >
                {m === 'sales' ? 'Vendas' : m === 'production' ? 'Produção' : 'Pessoal'}
              </button>
            ))}
          </div>
        </div>

        <label className={`flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer select-none transition-opacity ${parentId ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <input 
            type="checkbox" 
            className="w-5 h-5 rounded-md border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
            checked={isRoot && !parentId}
            disabled={!!parentId}
            onChange={(e) => setIsRoot(e.target.checked)}
          />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest dark:text-white">Categoria Principal</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Exibir como card no topo</span>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer select-none">
          <input 
            type="checkbox" 
            className="w-5 h-5 rounded-md border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
            checked={isPersonal}
            onChange={(e) => setIsPersonal(e.target.checked)}
          />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest dark:text-white">Uso Pessoal</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Exibir na aba Pessoais</span>
          </div>
        </label>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
          <button 
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-200"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
