
import { useState, useEffect } from 'react';
import { Category, CategoryType, AppModulesConfig } from '../types';
import { getCategoryModules, CategoryModuleValue } from '../utils/categories';


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
  const [modules, setModules] = useState<CategoryModuleValue[]>(() => {
    const initial = getCategoryModules(category?.module);
    return initial.length > 0 ? initial : ['sales'];
  });
  const [isPersonal, setIsPersonal] = useState(category?.isPersonal || defaultType === CategoryType.OTHER || getCategoryModules(category?.module).includes('personal'));
  const [parentId, setParentId] = useState<string | undefined>(category?.parentId);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setType(category.type);
      const initial = getCategoryModules(category.module);
      setModules(initial.length > 0 ? initial : ['sales']);
      setIsPersonal(!!category.isPersonal || initial.includes('personal'));
      setParentId(category.parentId);
    } else if (defaultType) {
      setType(defaultType);

      let suggestedModule: CategoryModuleValue = 'sales';
      if (defaultType === CategoryType.PRODUCTION || defaultType === CategoryType.SUPPLY || defaultType === CategoryType.CUTTING_TOOL) suggestedModule = 'production';
      if (defaultType === CategoryType.OTHER) suggestedModule = 'personal';

      setModules([suggestedModule]);
      setIsPersonal(defaultType === CategoryType.OTHER);
      setParentId(undefined);
    }
  }, [category, defaultType]);

  // Toca num módulo pra ligar/desligar ele (multi-seleção); "Todos" é um atalho que
  // seleciona tudo de uma vez — nunca deixa a seleção ficar totalmente vazia.
  const toggleModule = (m: CategoryModuleValue) => {
    setModules(prev => {
      if (m === 'any') {
        return prev.length === 1 && prev[0] === 'any' ? ['sales'] : ['any'];
      }
      const base = prev.includes('any') ? [] : prev;
      const next = base.includes(m) ? base.filter(x => x !== m) : [...base, m];
      if (next.length === 0) return base;
      if (m === 'personal') setIsPersonal(true);
      return next;
    });
  };

  const handleParentChange = (id: string) => {
    setParentId(id || undefined);
    if (id) {
      const parent = categories.find(c => c.id === id);
      if (parent?.module) {
        const parentModules = getCategoryModules(parent.module);
        if (parentModules.length > 0) setModules(parentModules);
      }
      if (parent?.type) {
        setType(parent.type);
      }
    }
  };

  const handleTypeChange = (newType: CategoryType) => {
    setType(newType);
    if (newType === CategoryType.PRODUCTION || newType === CategoryType.SUPPLY || newType === CategoryType.CUTTING_TOOL) setModules(['production']);
    else if (newType === CategoryType.OTHER) {
      setModules(['personal']);
      setIsPersonal(true);
    }
    else setModules(['sales']);
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name,
      type,
      color: category?.color || 'bg-indigo-500',
      module: modules,
      isPersonal,
      parentId,
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
            <option value={CategoryType.CUTTING_TOOL}>FACAS DE CORTE</option>
            <option value={CategoryType.OTHER}>PESSOAIS (OUTRAS)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Módulo Vinculado</span>
          <span className="text-[9px] font-bold text-slate-400 pl-1 -mt-1">Pode marcar mais de um</span>
          <div className="grid grid-cols-4 gap-2">
            {(['sales', 'production', 'personal', 'any'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => toggleModule(m)}
                data-guide-anchor="cat.selecionarModulo"
                className={`py-2 px-1 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${
                  modules.includes(m)
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                }`}
              >
                {m === 'sales' ? 'Vendas' : m === 'production' ? 'Produção' : m === 'personal' ? 'Pessoal' : 'Todos'}
              </button>
            ))}
          </div>
        </div>

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
          <button onClick={onClose} data-guide-anchor="cat.cancelar" className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
          <button
            onClick={handleSave}
            data-guide-anchor="cat.salvar"
            className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-200"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
