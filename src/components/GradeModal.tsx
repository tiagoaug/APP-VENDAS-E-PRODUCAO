import { useState, useEffect } from 'react';
import { Grid } from '../types';
import { TableCellsMerge, X, Plus } from 'lucide-react';

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
    } else {
      setName('');
      setSizes([]);
    }
  }, [grid, isOpen]);

  const addSize = () => {
    const trimmed = newSize.trim();
    if (trimmed !== '' && !sizes.includes(trimmed)) {
      setSizes(prev => [...prev, trimmed].sort((a, b) => Number(a) - Number(b)));
      setNewSize('');
    }
  };

  const removeSize = (sizeToRemove: string) => {
    setSizes(sizes.filter(s => s !== sizeToRemove));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    // configuration is kept for backward compatibility but quantities are managed in Embalagens
    const configuration: { [size: string]: number } = grid?.configuration || {};
    onSave({ name: name.trim(), sizes, configuration });
    setName('');
    setSizes([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm flex flex-col gap-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center">
              <TableCellsMerge size={20} className="text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                {grid ? 'Editar Grade' : 'Nova Grade'}
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Numerações de Produção</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="text-[9px] uppercase font-black text-slate-400 mb-1.5 block tracking-widest">Nome da Grade</label>
          <input
            type="text"
            placeholder="Ex: Feminino 34-40"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Add size */}
        <div>
          <label className="text-[9px] uppercase font-black text-slate-400 mb-1.5 block tracking-widest">Adicionar Numeração</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ex: 38"
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSize()}
            />
            <button
              onClick={addSize}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded-xl font-black transition-colors flex items-center gap-1"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Size chips */}
        <div>
          <label className="text-[9px] uppercase font-black text-slate-400 mb-1.5 block tracking-widest">Numerações da Grade ({sizes.length})</label>
          <div className="min-h-[60px] flex flex-wrap gap-2 p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
            {sizes.map(size => (
              <span key={size} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 shadow-sm">
                {size}
                <button onClick={() => removeSize(size)} className="text-rose-400 hover:text-rose-600 transition-colors font-black">×</button>
              </span>
            ))}
            {sizes.length === 0 && (
              <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold italic self-center">Adicione numerações acima</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || sizes.length === 0}
            className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg transition-all"
          >
            Salvar Grade
          </button>
        </div>
      </div>
    </div>
  );
}
