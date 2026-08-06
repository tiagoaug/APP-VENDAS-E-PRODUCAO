import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, Check } from "lucide-react";

export interface EngineeringPickerOption {
  id: string;
  name: string;
  subtitle?: string;
}

interface EngineeringPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  options: EngineeringPickerOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  isDarkMode: boolean;
  searchPlaceholder?: string;
  /** Texto exibido quando não há nenhuma opção cadastrada ainda (lista vazia, sem busca). */
  emptyHint?: string;
  /** Quando informado, exibe uma linha de "cadastrar novo" ao final da lista quando a
   * busca não corresponde a nenhum item existente. */
  onCreateNew?: (searchTerm: string) => void;
  createLabel?: (searchTerm: string) => string;
  zIndex?: number;
}

export default function EngineeringPickerModal({
  isOpen,
  onClose,
  title,
  icon,
  options,
  selectedId,
  onSelect,
  isDarkMode,
  searchPlaceholder = "Pesquisar...",
  emptyHint,
  onCreateNew,
  createLabel,
  zIndex = 100000,
}: EngineeringPickerModalProps) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen) setSearch("");
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = options.some((o) => o.name.toLowerCase() === search.trim().toLowerCase());
  const canCreate = !!onCreateNew && search.trim().length > 0 && !exactMatch;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex }}>
      <div
        className={`w-full max-w-md max-h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border ${
          isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 flex items-center justify-between gap-3 border-b ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                {icon}
              </div>
            )}
            <h3 className={`text-sm font-black uppercase tracking-widest truncate ${isDarkMode ? "text-white" : "text-slate-900"}`}>{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all ${isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
            aria-label="Fechar"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className={`relative flex items-center rounded-2xl border-2 ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
            <Search size={16} className="absolute left-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              className={`flex-1 bg-transparent border-none outline-none py-3.5 pl-11 pr-4 text-sm font-bold ${isDarkMode ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"}`}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
          {filtered.length > 0 ? (
            <div className="flex flex-col gap-1">
              {filtered.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onSelect(option.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl text-left transition-all ${
                      isSelected
                        ? isDarkMode
                          ? "bg-indigo-500/20 text-indigo-300"
                          : "bg-indigo-50 text-indigo-700"
                        : isDarkMode
                          ? "text-slate-200 hover:bg-slate-800"
                          : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{option.name}</p>
                      {option.subtitle && <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 truncate">{option.subtitle}</p>}
                    </div>
                    {isSelected && <Check size={16} strokeWidth={3} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-xs font-bold text-slate-400 italic">
                {options.length === 0 ? emptyHint || "Nenhum item cadastrado" : "Nenhum resultado encontrado"}
              </p>
            </div>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() => onCreateNew?.(search.trim())}
              className={`w-full mt-2 flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-black text-sm transition-all border-2 border-dashed ${
                isDarkMode ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-emerald-500/10" : "bg-emerald-100"}`}>
                <Plus size={16} strokeWidth={3} />
              </div>
              <span className="truncate">{createLabel ? createLabel(search.trim()) : `Cadastrar novo: "${search.trim()}"`}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
