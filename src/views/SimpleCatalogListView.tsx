import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';

interface NamedItem {
  id: string;
  name: string;
}

interface SimpleCatalogListViewProps<T extends NamedItem> {
  items: T[];
  // Rótulo singular pra textos (ex: "Marca", "Modelo").
  itemLabel: string;
  onAdd: (name: string) => Promise<void> | void;
  onEdit: (id: string, name: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  isDarkMode: boolean;
}

// Cadastro simples (só nome, editar, excluir) reaproveitado por Marcas e Modelos — mesma ideia
// de Cores/Categorias, mas sem os campos extras que aquelas telas têm.
export default function SimpleCatalogListView<T extends NamedItem>({
  items,
  itemLabel,
  onAdd,
  onEdit,
  onDelete,
  isDarkMode,
}: SimpleCatalogListViewProps<T>) {
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await onAdd(name);
      setNewName('');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: T) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const handleSaveEdit = async () => {
    const name = editingName.trim();
    if (!editingId || !name) return;
    await onEdit(editingId, name);
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder={`Nova ${itemLabel.toLowerCase()}...`}
          className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newName.trim() || saving}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map(item => (
          <div key={item.id} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            {editingId === item.id ? (
              <input
                type="text"
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-xs font-bold outline-none border-2 border-indigo-500 ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}
              />
            ) : (
              <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.name}</p>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              {editingId === item.id ? (
                <>
                  <button type="button" onClick={handleSaveEdit} className="p-2 rounded-xl text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Salvar" aria-label="Salvar">
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" title="Cancelar" aria-label="Cancelar">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    title={`Editar ${itemLabel}`}
                    aria-label={`Editar ${itemLabel}`}
                    className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-600 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-300 hover:text-indigo-600 hover:bg-slate-50'}`}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === item.id}
                    onClick={async () => {
                      if (!confirm(`Excluir "${item.name}"? Produtos que já usam não são alterados, só some da lista de seleção.`)) return;
                      setDeletingId(item.id);
                      try { await onDelete(item.id); } finally { setDeletingId(null); }
                    }}
                    title={`Excluir ${itemLabel}`}
                    aria-label={`Excluir ${itemLabel}`}
                    className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${isDarkMode ? 'text-slate-600 hover:text-rose-500 hover:bg-slate-800' : 'text-slate-300 hover:text-rose-500 hover:bg-slate-50'}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-[10px] text-slate-400 font-bold text-center py-8 uppercase tracking-widest">Nenhuma {itemLabel.toLowerCase()} cadastrada ainda</p>
        )}
      </div>
    </div>
  );
}
