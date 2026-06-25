import { useState } from 'react';
import { Calendar } from 'lucide-react';
import DatePickerPopover from './DatePickerPopover';

interface DatePickerProps {
  value: string; // Formato "yyyy-MM-dd"
  onChange: (date: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  raw?: boolean;
}

export default function DatePicker({ 
  value, 
  onChange, 
  className = '', 
  placeholder = 'Selecione...', 
  disabled = false, 
  raw = false 
}: DatePickerProps) {
  const [show, setShow] = useState(false);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShow(true)}
        className={raw ? className : `flex items-center gap-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className || 'bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-[1.1rem] py-2.5 px-4 text-xs font-black dark:text-white focus:ring-4 focus:ring-indigo-500/10 transition-all'}`}
      >
        {!raw && <Calendar size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />}
        <span className="flex-1 truncate">
          {value ? formatDisplayDate(value) : placeholder}
        </span>
      </button>

      {show && (
        <DatePickerPopover
          value={value || new Date().toISOString().split('T')[0]}
          onChange={onChange}
          onClose={() => setShow(false)}
        />
      )}
    </>
  );
}
