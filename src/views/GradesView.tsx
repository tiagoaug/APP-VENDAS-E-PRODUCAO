import { useState } from 'react';
import { Grid } from '../types';
import { Plus, TableCellsMerge, Trash2, Edit, Box } from 'lucide-react';
import GradeModal from '../components/GradeModal';

interface GradesViewProps {
  grids: Grid[];
  onAdd: (grid: Omit<Grid, 'id'>) => void;
  onEdit: (id: string, grid: Omit<Grid, 'id'>) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
}

export default function GradesView({ grids, onAdd, onEdit, onDelete, isDarkMode }: GradesViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrid, setEditingGrid] = useState<Grid | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <GradeModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingGrid(null); }}
        onSave={(g) => {
          if (editingGrid) onEdit(editingGrid.id, g);
          else onAdd(g);
        }}
        grid={editingGrid || undefined}
      />
      <div className="flex flex-col gap-4">
        {grids.map((grid) => (
          <div key={grid.id} className={`p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-5 group ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="text-cyan-600 dark:text-cyan-400">
                  <TableCellsMerge size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white tracking-tight">{grid.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {grid.sizes?.length || 0} Tamanhos cadastrados
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingGrid(grid); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                  <Edit size={18} />
                </button>
                <button onClick={() => onDelete(grid.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(grid.sizes || []).map((size) => (
                <div key={size} className="bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{size}</span>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2 pt-2 border-t border-slate-50 dark:border-slate-700">
               <Box size={14} className="text-slate-300" />
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Total da grade: {Object.values(grid.configuration || {}).reduce((a, b) => a + b, 0)} VARIAÇÕES</span>
            </div>
          </div>
        ))}

        <button 
          onClick={() => { setEditingGrid(null); setIsModalOpen(true); }}
          className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem] py-10 flex flex-col items-center justify-center gap-3 text-slate-300 dark:text-slate-700 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-100 dark:hover:border-cyan-900/30 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10 transition-all cursor-pointer"
        >
          <Plus size={32} strokeWidth={1.5} />
          <span className="text-[10px] font-black uppercase tracking-widest italic">Criar Nova Grade</span>
        </button>
      </div>
    </div>
  );
}
