import { useState } from 'react';
import { ColorValue } from '../types';
import { Plus, Trash2, Edit } from 'lucide-react';
import ColorModal from '../components/ColorModal';

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

  return (
    <div className="flex flex-col gap-6 h-full pb-32 overflow-y-auto">
      <ColorModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingColor(null); }}
        onSave={(col) => {
          if (editingColor) onEdit(editingColor.id, col);
          else onAdd(col);
        }}
        color={editingColor || undefined}
      />
      <div className="flex flex-col gap-3">
        {colors.map((color) => (
          <div key={color.id} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between relative group ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-4">
              <div>
                <h3 className={`font-black text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{color.name}</h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); setEditingColor(color); setIsModalOpen(true); }} 
                className={`p-4 transition-colors ${isDarkMode ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-500 hover:text-indigo-600'}`}
              >
                <Edit size={24} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(color.id); }}
                className={`p-4 transition-colors z-50 cursor-pointer ${isDarkMode ? 'text-slate-500 hover:text-rose-500' : 'text-slate-500 hover:text-rose-500'}`}
              >
                <Trash2 size={24} />
              </button>
            </div>
          </div>
        ))}

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
    </div>
  );
}
