import { useState, useEffect } from 'react';
import { ColorValue, ColorTemplate } from '../types';
import { Plus, Trash2, Edit, Bookmark, BookmarkCheck, Sparkles, ChevronDown, Layers } from 'lucide-react';
import ColorModal from '../components/ColorModal';
import { subscribeToColorTemplates, saveColorTemplate } from '../services/colorTemplatesService';

interface ColorsViewProps {
  colors: ColorValue[];
  onAdd: (color: Omit<ColorValue, 'id'>) => void;
  onEdit: (id: string, color: Omit<ColorValue, 'id'>) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
}

export default function ColorsView({ colors, onAdd, onEdit, onDelete, isDarkMode }: ColorsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<ColorValue | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState<{ primary: boolean; composite: boolean }>({ primary: false, composite: false });

  // Modelos de cor salvos por qualquer conta (coleção compartilhada, fora de users/{uid}) —
  // mesma mecânica já usada em Categorias.
  const [templates, setTemplates] = useState<ColorTemplate[]>([]);
  useEffect(() => {
    const unsub = subscribeToColorTemplates(setTemplates);
    return () => unsub();
  }, []);

  const primaryColors = colors.filter(c => !c.isComposite);
  const compositeColors = colors.filter(c => c.isComposite);

  const isSavedAsTemplate = (color: ColorValue) =>
    templates.some(t => t.name.toUpperCase() === color.name.toUpperCase() && !!t.isComposite === !!color.isComposite);

  const handleSaveAsTemplate = (color: ColorValue) => {
    if (isSavedAsTemplate(color)) return;
    saveColorTemplate({ name: color.name, hex: color.hex, isComposite: color.isComposite });
  };

  const handleSaveAllAsTemplates = () => {
    colors.forEach(c => {
      if (!isSavedAsTemplate(c)) saveColorTemplate({ name: c.name, hex: c.hex, isComposite: c.isComposite });
    });
  };

  const handleAddFromTemplate = (template: ColorTemplate) => {
    const exists = colors.some(c => c.name.toUpperCase() === template.name.toUpperCase());
    if (exists) return;
    onAdd({ name: template.name, hex: template.hex, isComposite: template.isComposite });
  };

  const renderColorRow = (color: ColorValue) => (
    <div key={color.id} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between relative group ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <div className="flex items-center gap-4">
        <div>
          <h3 className={`font-black text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{color.name}</h3>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); handleSaveAsTemplate(color); }}
          disabled={isSavedAsTemplate(color)}
          title={isSavedAsTemplate(color) ? 'Já é um modelo disponível' : 'Salvar como modelo pra outras contas'}
          className={`p-2 rounded-xl transition-colors ${
            isSavedAsTemplate(color)
              ? 'text-violet-500'
              : isDarkMode ? 'text-slate-600 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-300 hover:text-violet-600 hover:bg-slate-50'
          }`}
        >
          {isSavedAsTemplate(color) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setEditingColor(color); setIsModalOpen(true); }}
          title="Editar Cor"
          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-600 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}
        >
          <Edit size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(color.id); }}
          title="Excluir Cor"
          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-600 hover:text-rose-500 hover:bg-slate-800' : 'text-slate-300 hover:text-rose-500 hover:bg-slate-50'}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  const renderTemplatesSection = (kind: 'primary' | 'composite') => {
    const available = templates.filter(t => !!t.isComposite === (kind === 'composite'));
    if (available.length === 0) return null;
    return (
      <div className="rounded-[2rem] border-2 overflow-hidden bg-violet-50/30 dark:bg-violet-950/20 border-violet-100/50 dark:border-violet-900/30">
        <button
          type="button"
          onClick={() => setTemplatesOpen(o => ({ ...o, [kind]: !o[kind] }))}
          className="w-full flex items-center justify-between px-4 py-3 text-violet-600 dark:text-violet-400"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} />
            <span className="text-[11px] font-black uppercase tracking-widest">Modelos Disponíveis</span>
          </div>
          <ChevronDown size={16} className={`transition-transform duration-200 ${templatesOpen[kind] ? 'rotate-180' : ''}`} />
        </button>
        {templatesOpen[kind] && (
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {available.map(template => {
              const exists = colors.some(c => c.name.toUpperCase() === template.name.toUpperCase());
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
    );
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-32 overflow-y-auto overflow-x-hidden">
      <ColorModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingColor(null); }}
        onSave={(col) => {
          if (editingColor) onEdit(editingColor.id, col);
          else onAdd(col);
        }}
        color={editingColor || undefined}
      />

      {colors.length > 0 && (
        <button
          onClick={handleSaveAllAsTemplates}
          className={`flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed text-[10px] font-black uppercase tracking-widest transition-all ${
            isDarkMode ? 'border-violet-900/50 text-violet-400 hover:bg-violet-950/20' : 'border-violet-200 text-violet-600 hover:bg-violet-50/50'
          }`}
        >
          <Sparkles size={14} /> Salvar Todas Como Modelo Padrão
        </button>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <Layers size={14} className="text-slate-400" />
          <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cores Primárias</h2>
        </div>
        {primaryColors.map(renderColorRow)}
        {renderTemplatesSection('primary')}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <Layers size={14} className="text-slate-400" />
          <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cores Compostas</h2>
        </div>
        {compositeColors.length === 0 && (
          <p className={`text-[11px] font-bold px-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Nenhuma cor composta cadastrada ainda.</p>
        )}
        {compositeColors.map(renderColorRow)}
        {renderTemplatesSection('composite')}
      </div>

      <button
        onClick={() => { setEditingColor(null); setIsModalOpen(true); }}
        className={`border-2 border-dashed rounded-2xl p-4 flex items-center justify-center gap-3 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.98] ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-indigo-400 hover:border-indigo-900/50'
            : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-indigo-600 hover:border-indigo-100'
        }`}
      >
        <Plus size={20} />
        <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Nova Cor</span>
      </button>
    </div>
  );
}
