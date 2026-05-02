
import { useState, useEffect } from 'react';
import { Grid } from '../types';

interface GradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (grid: Omit<Grid, 'id'>) => void;
  grid?: Grid;
}

export default function GradeModal({ isOpen, onClose, onSave, grid }: GradeModalProps) {
  const [name, setName] = useState(grid?.name || '');
  const [sizes, setSizes] = useState<string[]>(grid?.sizes || []);
  const [newSize, setNewSize] = useState('');

  useEffect(() => {
    if (grid) {
      setName(grid.name);
      setSizes(grid.sizes || []);
    }
  }, [grid]);

  const addSize = () => {
    if (newSize.trim() !== '' && !sizes.includes(newSize.trim())) {
      setSizes([...sizes, newSize.trim()].sort());
      setNewSize('');
    }
  };

  const removeSize = (sizeToRemove: string) => {
    setSizes(sizes.filter(s => s !== sizeToRemove));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-xl font-black text-slate-800 dark:text-white">
          {grid ? 'Editar Grade' : 'Nova Grade'}
        </h2>
        <input
          type="text"
          placeholder="Nome da Grade"
          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nova numeração"
            className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSize()}
          />
          <button 
            onClick={addSize}
            className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-4 py-3 rounded-xl font-bold"
          >
            +
          </button>
        </div>

        <div className="flex flex-wrap gap-2 min-h-[50px] p-2 border border-slate-100 dark:border-slate-800 rounded-xl">
          {sizes.map(size => (
            <span key={size} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
              {size}
              <button onClick={() => removeSize(size)} className="text-rose-500 font-bold">×</button>
            </span>
          ))}
        </div>
        
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
          <button 
            onClick={() => {
              const configuration: { [size: string]: number } = {};
              sizes.forEach(s => configuration[s] = 1); // Default to 1
              onSave({ name, sizes, configuration });
              setName('');
              setSizes([]);
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
