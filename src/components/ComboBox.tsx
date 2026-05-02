import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface ComboBoxProps {
  options: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDarkMode?: boolean;
}

export default function ComboBox({ options, value, onChange, placeholder = "SELECIONE...", isDarkMode = false }: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(search.toLowerCase())
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
        className={`w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 cursor-pointer focus-within:ring-4 focus-within:ring-slate-900/5 dark:focus-within:ring-indigo-500/10 transition-all ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <input
          type="text"
          className="w-full bg-transparent border-none outline-none text-[12px] font-black uppercase tracking-widest placeholder:text-slate-400 dark:placeholder:text-slate-500"
          placeholder={selectedOption ? selectedOption.name : placeholder}
          value={isOpen ? search : ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <ChevronDown size={14} className="text-indigo-400" strokeWidth={3} />
      </div>

      {isOpen && (
        <div className={`absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto`}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <div
                key={option.id}
                className={`px-5 py-3 text-[12px] font-bold uppercase cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${value === option.id ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}
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
