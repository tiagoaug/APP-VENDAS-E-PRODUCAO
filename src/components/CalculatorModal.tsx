import { useState, useEffect } from 'react';
import { X, Delete, Check, Plus, Minus, X as Multi, Disc as Divide, Percent, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (result: number) => void;
  isDarkMode: boolean;
  initialValue?: number;
}

export default function CalculatorModal({ isOpen, onClose, onResult, isDarkMode, initialValue }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [lastResult, setLastResult] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialValue !== undefined) {
        setDisplay(initialValue.toString());
      } else {
        setDisplay('0');
      }
      setEquation('');
      setLastResult(null);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleNumber = (num: string) => {
    setDisplay(prev => {
      if (prev === '0') return num;
      return prev + num;
    });
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const calculate = () => {
    try {
      const fullEquation = equation + display;
      // Note: simple eval for a calculator is usually okay if input is controlled
      // We'll use a safer approach for basic operators
      const parts = fullEquation.split(' ');
      if (parts.length < 3) return;

      const a = parseFloat(parts[0]);
      const op = parts[1];
      const b = parseFloat(parts[2]);

      let result = 0;
      switch (op) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': result = a / b; break;
        default: result = b;
      }

      const formattedResult = Number(result.toFixed(2)).toString();
      setDisplay(formattedResult);
      setEquation('');
      setLastResult(result);
    } catch (e) {
      setDisplay('Erro');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
    setLastResult(null);
  };

  const backspace = () => {
    setDisplay(prev => {
      if (prev.length === 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleFinish = () => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      onResult(val);
      onClose();
    }
  };

  const buttons = [
    { label: 'C', onClick: clear, color: 'text-rose-500' },
    { label: 'DEL', onClick: backspace, icon: Delete, color: 'text-rose-500' },
    { label: '%', onClick: () => setDisplay((parseFloat(display)/100).toString()), color: 'text-indigo-500' },
    { label: '/', onClick: () => handleOperator('*'), icon: Divide, color: 'text-indigo-500' },
    { label: '7', onClick: () => handleNumber('7') },
    { label: '8', onClick: () => handleNumber('8') },
    { label: '9', onClick: () => handleNumber('9') },
    { label: '*', onClick: () => handleOperator('*'), icon: Multi, color: 'text-indigo-500' },
    { label: '4', onClick: () => handleNumber('4') },
    { label: '5', onClick: () => handleNumber('5') },
    { label: '6', onClick: () => handleNumber('6') },
    { label: '-', onClick: () => handleOperator('-'), icon: Minus, color: 'text-indigo-500' },
    { label: '1', onClick: () => handleNumber('1') },
    { label: '2', onClick: () => handleNumber('2') },
    { label: '3', onClick: () => handleNumber('3') },
    { label: '+', onClick: () => handleOperator('+'), icon: Plus, color: 'text-indigo-500' },
    { label: '0', onClick: () => handleNumber('0'), colSpan: 2 },
    { label: '.', onClick: () => handleNumber('.') },
    { label: '=', onClick: calculate, color: 'bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-[320px] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
           <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Calculadora</h3>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={18} className="text-slate-400" />
           </button>
        </div>

        <div className={`p-6 text-right flex flex-col justify-end min-h-[100px] ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap overflow-hidden h-4">
            {equation}
          </div>
          <div className={`text-4xl font-black tracking-tight mt-1 truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {display}
          </div>
        </div>

        <div className="p-4 grid grid-cols-4 gap-2">
          {buttons.map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.onClick}
              className={`h-14 flex items-center justify-center text-sm font-black uppercase transition-all active:scale-95 ${btn.colSpan === 2 ? 'col-span-2' : ''} ${btn.color || (isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')} rounded-2xl`}
            >
              {btn.icon ? <btn.icon size={18} strokeWidth={2.5} /> : btn.label}
            </button>
          ))}
        </div>

        <div className="p-4 pt-0">
          <button
            onClick={handleFinish}
            className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Check size={18} strokeWidth={3} /> Utilizar Valor
          </button>
        </div>
      </motion.div>
    </div>
  );
}
