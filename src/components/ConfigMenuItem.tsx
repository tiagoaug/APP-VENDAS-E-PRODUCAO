import React from 'react';
import { ChevronRight } from 'lucide-react';

interface ConfigMenuItemProps {
  key?: string | number;
  icon: React.ReactNode;
  label: string;
  desc?: string;
  color?: string;
  bg?: string;
  isDarkMode?: boolean;
  onClick: () => void;
  isLast?: boolean;
}

export default function ConfigMenuItem({
  icon,
  label,
  desc = '',
  color = 'text-slate-600',
  bg = 'bg-slate-100',
  isDarkMode = false,
  onClick,
  isLast
}: ConfigMenuItemProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!isLast ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800' : bg} ${color}`}>
          {icon}
        </div>
        <div className="text-left">
          <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{label}</p>
          {desc && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{desc}</p>}
        </div>
      </div>
      <ChevronRight size={20} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
    </button>
  );
}
