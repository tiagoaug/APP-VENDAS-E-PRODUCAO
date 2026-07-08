import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";

interface ComboBoxProps {
  options: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDarkMode?: boolean;
  icon?: React.ReactNode;
  compact?: boolean;
  /** Abre um popup centralizado (com busca) em vez do dropdown ancorado embaixo do campo —
   * usado quando o campo fica dentro de um card/modal pequeno onde o dropdown inline
   * empurrava/sobrepunha o resto do conteúdo abaixo dele. */
  usePopupModal?: boolean;
}

export default function ComboBox({ options, value, onChange, placeholder = "SELECIONE...", isDarkMode = false, icon, compact = false, usePopupModal = false }: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option =>
    String(option?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    if (usePopupModal) return; // popup fecha via backdrop/X, não por clique-fora do campo
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [usePopupModal]);

  const closePopup = () => { setIsOpen(false); setSearch(""); };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`w-full flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl ${icon ? (compact ? 'pl-9' : 'pl-12') : (compact ? 'pl-4' : 'pl-5')} pr-0 ${compact ? 'py-2.5' : 'py-4'} cursor-pointer focus-within:ring-4 focus-within:ring-slate-900/5 dark:focus-within:ring-indigo-500/10 transition-all ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon && (
          <div className={`absolute ${compact ? 'left-3' : 'left-5'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}>
            {icon}
          </div>
        )}
        <input
          type="text"
          readOnly={usePopupModal}
          className={`flex-1 bg-transparent border-none outline-none font-black uppercase tracking-widest min-w-0 ${compact ? 'text-[10px]' : 'text-[13px]'} ${usePopupModal ? 'cursor-pointer' : ''} ${selectedOption ? 'placeholder:text-slate-900 dark:placeholder:text-white' : 'placeholder:text-slate-700 dark:placeholder:text-slate-300'}`}
          placeholder={selectedOption ? selectedOption.name : placeholder}
          value={!usePopupModal && isOpen ? search : ""}
          onChange={(e) => {
            if (usePopupModal) return;
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Área clicável generosa ao redor da seta */}
        <div className={`flex items-center justify-center ${compact ? 'w-9' : 'w-12'} h-full self-stretch shrink-0 text-indigo-400`}>
          <ChevronDown size={compact ? 16 : 22} strokeWidth={2.5} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && !usePopupModal && (
        <div className={`absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto`}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <div
                key={option.id}
                className={`${compact ? 'px-4 py-2.5 text-[10px]' : 'px-5 py-4 text-[13px]'} font-bold uppercase cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-indigo-50 ${value === option.id ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                  setSearch("");
                }}
              >
                {option.name}
              </div>
            ))
          ) : (
            <div className={`px-5 py-3 ${compact ? 'text-[10px]' : 'text-[12px]'} text-slate-400 italic`}>Nenhum resultado encontrado</div>
          )}
        </div>
      )}

      {isOpen && usePopupModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 65000 }}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closePopup} />
          <div className={`relative w-full max-w-sm max-h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{placeholder}</h3>
              <button type="button" onClick={closePopup} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <div className="p-3">
              <div className={`relative flex items-center rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <Search size={16} className="absolute left-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  className={`flex-1 bg-transparent border-none outline-none py-3 pl-11 pr-4 text-[13px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'}`}
                  placeholder="Digitar para buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {filteredOptions.length > 0 ? (
                filteredOptions.map(option => (
                  <div
                    key={option.id}
                    className={`px-4 py-3.5 rounded-xl text-[13px] font-bold uppercase cursor-pointer transition-all ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'} ${value === option.id ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : (isDarkMode ? 'text-slate-200' : 'text-slate-700')}`}
                    onClick={() => {
                      onChange(option.id);
                      closePopup();
                    }}
                  >
                    {option.name}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-[12px] text-slate-400 italic">Nenhum resultado encontrado</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
