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
        {grids.map((grid) => {
          const totalPairs = Object.values(grid.configuration || {}).reduce((a, b) => a + (Number(b) || 0), 0);
          return (
            <div key={grid.id} className={`p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-6 group transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                    <TableCellsMerge size={24} />
                  </div>
                  <div>
                    <h3 className={`font-black text-base uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{grid.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {grid.sizes?.length || 0} Numerações • {totalPairs} Pares Total
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingGrid(grid); setIsModalOpen(true); }} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}>
                    <Edit size={18} />
                  </button>
                  <button onClick={() => onDelete(grid.id)} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-300 hover:text-rose-500 hover:bg-slate-50'}`}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Distribution Matrix Pattern */}
              <div className={`p-5 rounded-[2rem] flex flex-col gap-4 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
                <div className="flex items-center gap-2 text-slate-400">
                  <Box size={14} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Distribuição da Grade</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {(grid.sizes || []).map((size) => (
                    <div key={size} className="flex flex-col items-center gap-1 min-w-[32px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase leading-none">{size}</span>
                      <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {grid.configuration?.[size] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/50">
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Padrão de Grade Ativo</span>
                 </div>
                 <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalPairs}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase">PARES</span>
                 </div>
              </div>
            </div>
          );
        })}

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
