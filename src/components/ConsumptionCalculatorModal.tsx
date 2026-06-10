import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Ruler, Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseLocaleNumber } from '../utils/numbers';

interface ConsumptionCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (result: number) => void;
  isDarkMode: boolean;
  sizeLabel?: string;
}

export default function ConsumptionCalculatorModal({ isOpen, onClose, onResult, isDarkMode, sizeLabel }: ConsumptionCalculatorModalProps) {
  const [activeTab, setActiveTab] = useState<'PAPEL' | 'CORTE'>('PAPEL');
  
  // Fields for PAPEL (Milimetrado)
  const [lado1, setLado1] = useState('');
  const [lado2, setLado2] = useState('');
  const [pecasPar, setPecasPar] = useState('1');

  // Fields for CORTE (Material)
  const [materialMetros, setMaterialMetros] = useState('');
  const [materialPares, setMaterialPares] = useState('');

  const [finalResult, setFinalResult] = useState(0);

  useEffect(() => {
    if (activeTab === 'PAPEL') {
      const l1 = parseLocaleNumber(lado1);
      const l2 = parseLocaleNumber(lado2);
      const p = parseLocaleNumber(pecasPar);
      
      // M2 = (L1 * L2 * P) / 10000 (assuming L1/L2 are in cm)
      const res = (l1 * l2 * p) / 10000;
      setFinalResult(res);
    } else {
      const metros = parseLocaleNumber(materialMetros);
      const pares = parseLocaleNumber(materialPares);
      
      const res = pares > 0 ? metros / pares : 0;
      setFinalResult(res);
    }
  }, [activeTab, lado1, lado2, pecasPar, materialMetros, materialPares]);

  const handleCopy = () => {
    navigator.clipboard.writeText(finalResult.toFixed(4).replace('.', ','));
  };

  const handleApply = () => {
    onResult(finalResult);
    onClose();
  };

  if (!isOpen) return null;

  const inputClasses = `w-full px-6 py-5 rounded-2xl font-black outline-none transition-all border-2 text-lg ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`;
  const labelClasses = "text-[11px] font-black uppercase text-slate-400 tracking-widest mb-3 block ml-2";

  return createPortal(
    <div className="fixed inset-0 z-[80001] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-[440px] rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        {/* Header */}
        <div className="p-10 flex items-center justify-between pb-6">
           <div className="flex items-center gap-5">
              <div className="p-3.5 bg-emerald-500/10 rounded-2xl text-emerald-500">
                <Ruler size={26} strokeWidth={2.5} className="rotate-90" />
              </div>
              <div>
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>CALCULADOR DE CONSUMO</h3>
                {sizeLabel && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tamanho {sizeLabel}</span>}
              </div>
           </div>
           <button onClick={onClose} title="Fechar Calculadora" className={`p-3 rounded-2xl transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
            <X size={22} className="text-slate-300" />
           </button>
        </div>

        {/* Tabs */}
        <div className="px-10 mb-8">
           <div className={`p-2 rounded-[2rem] flex ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
              <button 
                onClick={() => setActiveTab('PAPEL')} 
                className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PAPEL' ? (isDarkMode ? 'bg-slate-800 text-white shadow-xl' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
              >
                PAPEL MILIMETRADO
              </button>
              <button 
                onClick={() => setActiveTab('CORTE')} 
                className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'CORTE' ? (isDarkMode ? 'bg-slate-800 text-white shadow-xl' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
              >
                CORTE EM MATERIAL
              </button>
           </div>
        </div>

        {/* Form Body */}
        <div className="px-10 flex flex-col gap-6">
           {activeTab === 'PAPEL' ? (
              <>
                 <div className="grid grid-cols-2 gap-5">
                    <div>
                       <label className={labelClasses}>Lado 1 (CM)</label>
                       <input type="text" value={lado1} onChange={e => setLado1(e.target.value)} className={inputClasses} placeholder="0,00" />
                    </div>
                    <div>
                       <label className={labelClasses}>Lado 2 (CM)</label>
                       <input type="text" value={lado2} onChange={e => setLado2(e.target.value)} className={inputClasses} placeholder="0,00" />
                    </div>
                 </div>
                 <div>
                    <label className={labelClasses}>CONJUGAÇÃO DA FACA</label>
                    <input type="text" value={pecasPar} onChange={e => setPecasPar(e.target.value)} className={inputClasses} placeholder="1" />
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-2 leading-relaxed">
                      ( QUANTAS SÃO NECESSÁRIAS PARA FAZER 1 PAR )
                    </p>
                 </div>
              </>
           ) : (
              <>
                 <div>
                    <label className={labelClasses}>Metros Consumidos</label>
                    <input type="text" value={materialMetros} onChange={e => setMaterialMetros(e.target.value)} className={inputClasses} placeholder="0,00" />
                 </div>
                 <div>
                    <label className={labelClasses}>Total de Pares Cortados</label>
                    <input type="text" value={materialPares} onChange={e => setMaterialPares(e.target.value)} className={inputClasses} placeholder="0" />
                 </div>
              </>
           )}
        </div>

        {/* Result Box (matching image) */}
        <div className="px-10 py-8">
           <div className={`p-8 rounded-[2.5rem] border-2 transition-all ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-100/50'}`}>
              <span className="text-[11px] font-black uppercase text-emerald-600/70 tracking-[0.15em] block mb-2">Consumo por Par</span>
              <div className="text-5xl font-black text-emerald-600 tracking-tight">
                {finalResult.toFixed(4).replace('.', ',')}
              </div>
           </div>
        </div>

        {/* Footer Actions (matching image) */}
        <div className="px-10 pb-10 flex gap-4">
            <button 
              onClick={handleCopy}
              title="Copiar Valor"
              className={`flex-1 py-5 rounded-[1.8rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            >
              <Copy size={18} />
              Copiar
            </button>
            <button 
              onClick={handleApply}
              title="Aplicar Valor ao Campo"
              className="flex-[1.2] py-5 rounded-[1.8rem] bg-emerald-600 text-white flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-emerald-600/20 active:scale-95 transition-all hover:bg-emerald-500"
            >
              <Check size={18} strokeWidth={3} />
              Aplicar
            </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
