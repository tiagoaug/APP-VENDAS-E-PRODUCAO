import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface ComboBoxProps {
  options: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDarkMode?: boolean;
  icon?: React.ReactNode;
}

export default function ComboBox({ options, value, onChange, placeholder = "SELECIONE...", isDarkMode = false, icon }: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option =>
    String(option?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`w-full flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl ${icon ? 'pl-12' : 'pl-5'} pr-0 py-4 cursor-pointer focus-within:ring-4 focus-within:ring-slate-900/5 dark:focus-within:ring-indigo-500/10 transition-all ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-[12px] font-black uppercase tracking-widest placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-0"
          placeholder={selectedOption ? selectedOption.name : placeholder}
          value={isOpen ? search : ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {/* Área clicável generosa ao redor da seta */}
        <div className="flex items-center justify-center w-12 h-full self-stretch shrink-0 text-indigo-400">
          <ChevronDown size={22} strokeWidth={2.5} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className={`absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto`}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <div
                key={option.id}
                className={`px-5 py-4 text-[13px] font-bold uppercase cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-indigo-50 ${value === option.id ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}
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
            <div className="px-5 py-3 text-[12px] text-slate-400 italic">Nenhum resultado encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}
