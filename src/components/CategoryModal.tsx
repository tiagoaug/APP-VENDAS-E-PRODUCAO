
import { useState, useEffect } from 'react';
import { Category, CategoryType } from '../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Omit<Category, 'id'>) => void;
  category?: Category;
  defaultType?: CategoryType;
}

export default function CategoryModal({ isOpen, onClose, onSave, category, defaultType }: CategoryModalProps) {
  const [name, setName] = useState(category?.name || '');
  const [type, setType] = useState<CategoryType>(category?.type || defaultType || CategoryType.PRODUCT);
  const [isPersonal, setIsPersonal] = useState(category?.isPersonal || defaultType === CategoryType.OTHER);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setType(category.type);
      setIsPersonal(!!category.isPersonal);
    } else if (defaultType) {
      setType(defaultType);
      setIsPersonal(defaultType === CategoryType.OTHER);
    }
  }, [category, defaultType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-xl font-black text-slate-800 dark:text-white">
          {category ? 'Editar Categoria' : 'Nova Categoria'}
        </h2>
        <input
          type="text"
          placeholder="Nome da Categoria"
          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          title="Tipo de Categoria"
          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold appearance-none dark:text-white"
          value={type}
          onChange={(e) => setType(e.target.value as CategoryType)}
        >
          <option value={CategoryType.PRODUCT}>PRODUTOS</option>
          <option value={CategoryType.EXPENSE}>DESPESAS</option>
          <option value={CategoryType.REVENUE}>RECEITAS</option>
          <option value={CategoryType.PRODUCTION}>PRODUÇÃO</option>
          <option value={CategoryType.GENERAL}>GERAIS</option>
          <option value={CategoryType.SUPPLY}>INSUMOS</option>
          <option value={CategoryType.OTHER}>PESSOAIS (OUTRAS)</option>
        </select>

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
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
          <button 
            onClick={() => {
              onSave({ name, type, color: 'bg-indigo-500', isPersonal });
              setName('');
              onClose();
            }}
            className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold text-white shadow-lg"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
