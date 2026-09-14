import { useState, useMemo, useEffect } from 'react';
import { Grid, GridType, GridTemplate } from '../types';
import { Plus, TableCellsMerge, Trash2, Edit, Ruler, Target, Footprints, Scissors, Filter, Box, LayoutGrid, Zap, Bookmark, BookmarkCheck, Sparkles, ChevronDown } from 'lucide-react';
import GradeModal from '../components/GradeModal';
import GuidePulseDot from '../components/GuidePulseDot';
import { subscribeToGridTemplates, saveGridTemplate, deleteGridTemplate } from '../services/gridTemplatesService';
import { isTemplateAdmin } from '../utils/templateAdmin';

interface GradesViewProps {
  grids: Grid[];
  onAdd: (grid: Omit<Grid, 'id'>) => void;
  onEdit: (id: string, grid: Omit<Grid, 'id'>) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
  onStartJourney?: (journeyId: string) => void;
  // Bolinha pulsante em "Modelos Disponíveis" + no Salvar do modal, ver Etapa 5 do Assistente
  // de Configuração.
  guideActive?: boolean;
}

export default function GradesView({ grids, onAdd, onEdit, onDelete, isDarkMode, onStartJourney, guideActive }: GradesViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrid, setEditingGrid] = useState<Grid | null>(null);
  const [activeFilter, setActiveFilter] = useState<GridType | 'ALL'>('ALL');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // Modelos de grade salvos por qualquer conta (coleção compartilhada, fora de users/{uid})
  // — pool de sugestões prontas pra tocar e adicionar, alimentada pelo botão de marcador em
  // cada grade já cadastrada (ver handleToggleTemplate abaixo).
  const [templates, setTemplates] = useState<GridTemplate[]>([]);
  useEffect(() => {
    const unsub = subscribeToGridTemplates(setTemplates);
    return () => unsub();
  }, []);

  const templatesForActiveFilter = useMemo(() => {
    if (activeFilter === 'ALL') return templates;
    return templates.filter(t => t.type === activeFilter);
  }, [templates, activeFilter]);

  const findTemplateFor = (grid: Grid) =>
    templates.find(t => t.name.toUpperCase() === grid.name.toUpperCase() && t.type === grid.type);

  const isSavedAsTemplate = (grid: Grid) => !!findTemplateFor(grid);

  // Toggle real — clicar de novo numa grade já marcada desmarca (apaga o modelo
  // compartilhado), em vez de ficar travado só como "salvar".
  const handleToggleTemplate = (grid: Grid) => {
    const existing = findTemplateFor(grid);
    if (existing) deleteGridTemplate(existing.id);
    else saveGridTemplate({ name: grid.name, type: grid.type, sizes: grid.sizes });
  };

  const handleAddFromTemplate = (template: GridTemplate) => {
    const exists = grids.some(g => g.name.toUpperCase() === template.name.toUpperCase() && g.type === template.type);
    if (exists) return;
    onAdd({ name: template.name, type: template.type, sizes: template.sizes, configuration: {} });
  };

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
        guideActive={guideActive}
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
        <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Filter size={13} className="text-slate-400 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Filtrar por tipo</span>
          </div>
          {(() => {
            const filters = [
              { id: 'ALL',                label: 'Todas',      color: 'indigo',  icon: LayoutGrid },
              { id: GridType.FORMA,       label: 'Formas',     color: 'indigo',  icon: Footprints },
              { id: GridType.SOLADO,      label: 'Solados',    color: 'emerald', icon: Zap        },
              { id: GridType.FACA,        label: 'Facas',      color: 'rose',    icon: Scissors   },
              { id: GridType.EMBALAGEM,   label: 'Embalagens', color: 'amber',   icon: Box        },
            ];
            const colorActive: Record<string, string> = {
              indigo:  isDarkMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'   : 'bg-indigo-50 text-indigo-600 border-indigo-200',
              emerald: isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30': 'bg-emerald-50 text-emerald-600 border-emerald-200',
              rose:    isDarkMode ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'         : 'bg-rose-50 text-rose-600 border-rose-200',
              amber:   isDarkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'      : 'bg-amber-50 text-amber-600 border-amber-200',
            };
            const colorIcon: Record<string, string> = {
              indigo: 'text-indigo-500', emerald: 'text-emerald-500', rose: 'text-rose-500', amber: 'text-amber-500',
            };
            const inactiveCls = isDarkMode
              ? 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50';

            const renderBtn = (f: typeof filters[0]) => {
              const isActive = activeFilter === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id as any)}
                  data-guide-anchor="grade.selecionarFiltro"
                  className={`flex-1 py-2.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all border-2 flex items-center justify-center gap-1.5 ${
                    isActive ? `${colorActive[f.color]} shadow-sm scale-[1.02]` : inactiveCls
                  }`}
                >
                  <Icon size={13} className={colorIcon[f.color]} />
                  {f.label}
                </button>
              );
            };

            return (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5">{filters.slice(0, 3).map(renderBtn)}</div>
                <div className="flex gap-1.5">{filters.slice(3).map(renderBtn)}</div>
              </div>
            );
          })()}
        </div>

        <div className="rounded-[2rem] border-2 overflow-hidden bg-violet-50/30 dark:bg-violet-950/20 border-violet-100/50 dark:border-violet-900/30">
          <button
            type="button"
            onClick={() => setTemplatesOpen(o => !o)}
            data-guide-anchor="grade.alternarModelos"
            className="relative w-full flex items-center justify-between px-4 py-3 text-violet-600 dark:text-violet-400"
          >
            {guideActive && <span className="absolute top-2 right-9"><GuidePulseDot show /></span>}
            <div className="flex items-center gap-2">
              <Sparkles size={14} />
              <span className="text-[11px] font-black uppercase tracking-widest">Modelos Disponíveis</span>
            </div>
            <ChevronDown size={16} className={`transition-transform duration-200 ${templatesOpen ? 'rotate-180' : ''}`} />
          </button>
          {templatesOpen && (
            <div className="px-4 pb-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-snug">
                Toque num modelo abaixo para adicioná-lo às suas {
                  activeFilter === GridType.SOLADO ? 'grades de solado'
                  : activeFilter === GridType.FACA ? 'grades de faca'
                  : activeFilter === GridType.EMBALAGEM ? 'grades de embalagem'
                  : activeFilter === GridType.FORMA ? 'grades de forma'
                  : 'grades'
                }.
              </p>
              {templatesForActiveFilter.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 italic py-2">Nenhum modelo disponível ainda pra este tipo.</p>
              )}
              {templatesForActiveFilter.map(template => {
                  const exists = grids.some(g => g.name.toUpperCase() === template.name.toUpperCase() && g.type === template.type);
                  const isExpanded = expandedTemplateId === template.id;
                  return (
                    <div
                      key={template.id}
                      className={`rounded-xl border-2 overflow-hidden ${
                        exists
                          ? 'bg-slate-100 dark:bg-slate-800 border-transparent'
                          : 'bg-white dark:bg-slate-900 border-violet-100 dark:border-violet-900 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => handleAddFromTemplate(template)}
                          disabled={exists}
                          data-guide-anchor="grade.adicionarModelo"
                          title={`Adicionar modelo: ${template.name}`}
                          className={`flex-1 text-left px-3 py-2.5 text-[11px] font-black uppercase tracking-widest active:scale-[0.98] ${
                            exists ? 'text-slate-300 dark:text-slate-600' : 'text-violet-600 dark:text-violet-400'
                          }`}
                        >
                          {template.name} {exists && '✓'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedTemplateId(isExpanded ? null : template.id)}
                          data-guide-anchor="grade.previaModelo"
                          title={isExpanded ? 'Ocultar prévia das numerações' : 'Mostrar prévia das numerações'}
                          aria-label={isExpanded ? 'Ocultar prévia das numerações' : 'Mostrar prévia das numerações'}
                          className={`px-3 py-2.5 shrink-0 ${exists ? 'text-slate-300 dark:text-slate-600' : 'text-violet-400 hover:text-violet-600'}`}
                        >
                          <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-violet-100/60 dark:border-violet-900/40">
                          {(template.sizes || []).map(size => (
                            <span
                              key={size}
                              className={`px-2 py-1 rounded-lg border text-[9px] font-black ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                            >
                              {size}
                            </span>
                          ))}
                          {(template.sizes || []).length === 0 && (
                            <span className="text-[9px] text-slate-300 dark:text-slate-700 font-bold italic">Sem numerações</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {templatesOpen && onStartJourney && (
              <button
                type="button"
                onClick={() => onStartJourney('tour_cadastrar_grade')}
                data-guide-anchor="grade.naoAchouModelo"
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 border-t border-violet-100/50 dark:border-violet-900/30 text-[10px] font-black uppercase tracking-widest text-violet-500 hover:text-violet-600 transition-colors"
              >
                Não achou um modelo? Veja como criar uma nova
              </button>
            )}
          </div>

        {filteredGrids.map((grid) => (
          <div key={grid.id} className={`p-4 sm:p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-5 group transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                  <TableCellsMerge size={24} />
                </div>
                <div className={`inline-flex px-2 py-0.5 rounded-md items-center gap-1 border ${
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

              <div className="min-w-0">
                <h3 className={`font-black text-base uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{grid.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  {grid.sizes?.length || 0} Numerações
                </p>
              </div>

              <div className="flex gap-2">
                <button title="Editar Grade" onClick={() => { setEditingGrid(grid); setIsModalOpen(true); }} data-guide-anchor="grade.editar" className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-50 text-slate-500 hover:text-indigo-600'}`}>
                  <Edit size={14} /> Editar
                </button>
                <button title="Excluir Grade" onClick={() => onDelete(grid.id)} data-guide-anchor="grade.excluir" className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-rose-400' : 'bg-slate-50 text-slate-500 hover:text-rose-500'}`}>
                  <Trash2 size={14} /> Excluir
                </button>
              </div>

              {isTemplateAdmin() && (
                <button
                  onClick={() => handleToggleTemplate(grid)}
                  data-guide-anchor="grade.salvarModelo"
                  title={isSavedAsTemplate(grid) ? 'Toque pra desmarcar como exemplo' : 'Usar como exemplo pra novas contas'}
                  className={`self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.97] ${
                    isSavedAsTemplate(grid)
                      ? 'bg-violet-100 border-violet-200 text-violet-700 dark:bg-violet-500/20 dark:border-violet-500/40 dark:text-violet-300'
                      : 'bg-slate-200 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isSavedAsTemplate(grid) ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                  {isSavedAsTemplate(grid) ? 'Usada como exemplo' : 'Marcar como modelo'}
                </button>
              )}
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
          data-guide-anchor="grade.novo"
          className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem] py-10 flex flex-col items-center justify-center gap-3 text-slate-300 dark:text-slate-700 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-100 dark:hover:border-cyan-900/30 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10 transition-all cursor-pointer"
        >
          <Plus size={32} strokeWidth={1.5} />
          <span className="text-[10px] font-black uppercase tracking-widest italic">Criar Nova Grade</span>
        </button>
      </div>
    </div>
  );
}
