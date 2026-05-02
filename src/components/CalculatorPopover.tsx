import { useState } from 'react';
import { X, Delete, Divide, Minus, Plus, Equal } from 'lucide-react';

interface CalculatorPopoverProps {
  onApply: (value: number) => void;
  onClose: () => void;
}

export default function CalculatorPopover({ onApply, onClose }: CalculatorPopoverProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [operator, setOperator] = useState<string | null>(null);
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [isNewValue, setIsNewValue] = useState(true);

  const handleNumber = (num: string) => {
    if (isNewValue || display === '0') {
      setDisplay(num);
      setIsNewValue(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    const current = parseFloat(display);
    if (prevValue === null) {
      setPrevValue(current);
    } else if (operator) {
      const result = calculate(prevValue, current, operator);
      setPrevValue(result);
      setDisplay(String(result));
    }
    setOperator(op);
    setIsNewValue(true);
    setEquation(`${prevValue === null ? current : prevValue} ${op}`);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (operator && prevValue !== null) {
      const current = parseFloat(display);
      const result = calculate(prevValue, current, operator);
      setDisplay(String(result));
      setPrevValue(null);
      setOperator(null);
      setEquation('');
      setIsNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setEquation('');
    setIsNewValue(true);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleApply = () => {
    onApply(parseFloat(display));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-[280px] overflow-hidden flex flex-col animate-in zoom-in duration-200">
        <div className="p-6 bg-slate-50 dark:bg-slate-800 flex flex-col items-end shrink-0">
          <div className="h-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{equation || 'CALCULAR'}</div>
          <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter truncate w-full text-right mt-1">
            {display}
          </div>
        </div>

        <div className="p-4 grid grid-cols-4 gap-2">
          <button onClick={handleClear} className="col-span-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-rose-500 font-black uppercase text-[9px] tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">Limpar</button>
          <button onClick={handleBackspace} className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><Delete size={16} /></button>
          <button onClick={() => handleOperator('/')} className={`p-3 rounded-2xl font-black flex items-center justify-center transition-all ${operator === '/' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}><Divide size={18} /></button>

          {[7, 8, 9].map(n => (
            <button key={n} onClick={() => handleNumber(String(n))} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-black text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">{n}</button>
          ))}
          <button onClick={() => handleOperator('*')} className={`p-4 rounded-2xl font-black flex items-center justify-center transition-all ${operator === '*' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}><X size={18} /></button>

          {[4, 5, 6].map(n => (
            <button key={n} onClick={() => handleNumber(String(n))} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-black text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">{n}</button>
          ))}
          <button onClick={() => handleOperator('-')} className={`p-4 rounded-2xl font-black flex items-center justify-center transition-all ${operator === '-' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}><Minus size={18} /></button>

          {[1, 2, 3].map(n => (
            <button key={n} onClick={() => handleNumber(String(n))} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-black text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">{n}</button>
          ))}
          <button onClick={() => handleOperator('+')} className={`p-4 rounded-2xl font-black flex items-center justify-center transition-all ${operator === '+' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}><Plus size={18} /></button>

          <button onClick={() => handleNumber('0')} className="col-span-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-black text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">0</button>
          <button onClick={() => handleNumber('.')} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-black text-lg hover:bg-slate-100 transition-all active:scale-95">,</button>
          <button onClick={handleEquals} className="p-4 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"><Equal size={18} strokeWidth={4} /></button>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Voltar</button>
          <button onClick={handleApply} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Aplicar Valor</button>
        </div>
      </div>
    </div>
  );
}
