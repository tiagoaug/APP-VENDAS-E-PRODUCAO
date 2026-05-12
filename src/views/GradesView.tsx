import { useState, useMemo } from 'react';
import { Grid, GridType } from '../types';
import { Plus, TableCellsMerge, Trash2, Edit, Ruler, Target, Footprints, Scissors, Filter, Box, LayoutGrid, Zap } from 'lucide-react';
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
  const [activeFilter, setActiveFilter] = useState<GridType | 'ALL'>('ALL');

  const filteredGrids = useMemo(() => {
    if (activeFilter === 'ALL') return grids;
    return grids.filter(g => {
      // Fallback para grids antigos sem tipo definido
      const gridType = g.type || GridType.FORMA;
      return gridType === activeFilter;
    });
  }, [grids, activeFilter]);

  return (
    <div className="flex flex-col gap-6">
      <GradeModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingGrid(null); }}
        onSave={(g) => {
          if (editingGrid) onEdit(editingGrid.id, g);
          else onAdd(g);
        }}
        grid={editingGrid ? editingGrid : (activeFilter !== 'ALL' ? { type: activeFilter } as any : undefined)}
      />

      <div className={`p-5 rounded-2xl border flex items-start gap-4 ${isDarkMode ? 'bg-cyan-900/10 border-cyan-900/30' : 'bg-cyan-50/50 border-cyan-100'}`}>
        <Ruler size={20} className="text-cyan-500 mt-0.5 shrink-0 rotate-90" />
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-relaxed">
          Grades de Tamanhos definem <span className="text-cyan-600 dark:text-cyan-400 font-black">quais numerações existem</span> no processo produtivo de cada modelo. 
          Os padrões de embalagem (quantidade de pares por tamanho) são configurados separadamente em <span className="text-cyan-600 dark:text-cyan-400 font-black">Embalagens</span>.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Filters */}
        <div className={`p-2 rounded-2xl border flex items-center gap-3 overflow-x-auto no-scrollbar ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
            <Filter size={19} />
          </div>
          <div className="flex items-center gap-1 pr-4">
            {[
              { id: 'ALL', label: 'TODAS', color: 'indigo', icon: LayoutGrid },
              { id: GridType.FORMA, label: 'FOR.', color: 'indigo', icon: Footprints },
              { id: GridType.SOLADO, label: 'SOL.', color: 'emerald', icon: Zap },
              { id: GridType.FACA, label: 'FACA', color: 'rose', icon: Scissors },
              { id: GridType.EMBALAGEM, label: 'EMB.', color: 'amber', icon: Box }
            ].map(filter => {
              const isActive = activeFilter === filter.id;
              const Icon = filter.icon;
              let activeClasses = '';
              let iconClasses = '';
              
              // Always set icon color for better identification
              if (filter.color === 'indigo') iconClasses = 'text-indigo-500';
              if (filter.color === 'emerald') iconClasses = 'text-emerald-500';
              if (filter.color === 'rose') iconClasses = 'text-rose-500';
              if (filter.color === 'amber') iconClasses = 'text-amber-500';

              if (isActive) {
                if (filter.color === 'indigo') activeClasses = isDarkMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border-indigo-200';
                if (filter.color === 'emerald') activeClasses = isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200';
                if (filter.color === 'rose') activeClasses = isDarkMode ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-600 border-rose-200';
                if (filter.color === 'amber') activeClasses = isDarkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-600 border-amber-200';
              }

              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as any)}
                  className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-tight transition-all whitespace-nowrap border-2 flex items-center gap-1.5 ${
                    isActive
                      ? `${activeClasses} shadow-lg shadow-black/5 scale-105 z-10`
                      : isDarkMode
                        ? 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                        : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={14} className={iconClasses} />
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredGrids.map((grid) => (
          <div key={grid.id} className={`p-4 sm:p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-5 group transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                  <TableCellsMerge size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-black text-base uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{grid.name}</h3>
                    <div className={`px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                      grid.type === GridType.SOLADO 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                        : grid.type === GridType.FACA
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                          : grid.type === GridType.EMBALAGEM
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500'
                    }`}>
                      {grid.type === GridType.SOLADO ? <Footprints size={12} /> : grid.type === GridType.FACA ? <Scissors size={12} /> : grid.type === GridType.EMBALAGEM ? <Box size={12} /> : <Target size={12} />}
                      <span className="text-[8px] font-black uppercase tracking-widest">
                        {grid.type === GridType.SOLADO ? 'Solado' : grid.type === GridType.FACA ? 'Faca' : grid.type === GridType.EMBALAGEM ? 'Emb.' : 'Forma'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    {grid.sizes?.length || 0} Numerações
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button title="Editar Grade" onClick={() => { setEditingGrid(grid); setIsModalOpen(true); }} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}>
                  <Edit size={20} />
                </button>
                <button title="Excluir Grade" onClick={() => onDelete(grid.id)} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-300 hover:text-rose-500 hover:bg-slate-50'}`}>
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            {/* Size chips */}
            <div className={`p-3 sm:p-5 rounded-[2rem] flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Numerações da Grade</span>
              <div className="flex flex-wrap gap-1.5">
                {(grid.sizes || []).map((size) => (
                  <div
                    key={size}
                    className={`px-3 py-1.5 rounded-xl border-2 flex items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                  >
                    <span className="text-xs font-black">{size}</span>
                  </div>
                ))}
                {(grid.sizes || []).length === 0 && (
                  <span className="text-[10px] text-slate-300 dark:text-slate-700 font-bold italic">Nenhuma numeração cadastrada</span>
                )}
              </div>
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
