import { useState, useMemo } from 'react';
import { X, Grid3x3, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { Grid, GridType } from '../types';

interface GradeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (breakdown: Record<string, number>) => void;
  productName: string;
  variationName: string;
  grids: Grid[];
  defaultGridId?: string;
  initialBreakdown?: Record<string, number>;
  isDarkMode: boolean;
}

export default function GradeBuilderModal({
  isOpen, onClose, onConfirm,
  productName, variationName,
  grids, defaultGridId,
  initialBreakdown = {},
  isDarkMode
}: GradeBuilderModalProps) {
  const formaGrids = useMemo(() => grids.filter(g => g.type === GridType.FORMA), [grids]);

  const [selectedGridId, setSelectedGridId] = useState<string>(defaultGridId || '');
  const [breakdown, setBreakdown] = useState<Record<string, number>>(initialBreakdown);

  const selectedGrid = useMemo(
    () => formaGrids.find(g => g.id === selectedGridId),
    [formaGrids, selectedGridId]
  );

  const sizes = useMemo(() => {
    if (selectedGrid?.sizes?.length) return selectedGrid.sizes;
    // fallback: derive from breakdown keys
    const keys = Object.keys(breakdown);
    if (keys.length) return keys;
    return [];
  }, [selectedGrid, breakdown]);

  const total = useMemo(
    () => Object.values(breakdown).reduce((a, b) => a + b, 0),
    [breakdown]
  );

  const handleSelectGrid = (gridId: string) => {
    setSelectedGridId(gridId);
    const grid = formaGrids.find(g => g.id === gridId);
    if (!grid) return;
    const bd: Record<string, number> = {};
    grid.sizes.forEach(s => { bd[s] = grid.configuration?.[s] || 0; });
    setBreakdown(bd);
  };

  const handleReset = () => {
    const bd: Record<string, number> = {};
    sizes.forEach(s => { bd[s] = 0; });
    setBreakdown(bd);
  };

  const setSize = (size: string, val: number) => {
    setBreakdown(prev => ({ ...prev, [size]: Math.max(0, val) }));
  };

  const canConfirm = total > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Grid3x3 size={17} className="text-white" />
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Configurar Grade
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {productName} — {variationName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              title="Limpar"
              aria-label="Limpar grade"
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar"
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* Seletor de grade de forma */}
          {formaGrids.length > 0 && (
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                Grade de Referência (opcional)
              </label>
              <select
                value={selectedGridId}
                onChange={e => handleSelectGrid(e.target.value)}
                title="Grade de referência"
                aria-label="Grade de referência"
                className={`w-full px-4 py-3 rounded-xl font-black text-[11px] outline-none border-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
              >
                <option value="">Entrada manual</option>
                {formaGrids.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {selectedGrid && (
                <p className="text-[9px] text-slate-400 font-bold mt-1 px-1">
                  Distribuição pré-carregada — ajuste se necessário
                </p>
              )}
            </div>
          )}

          {/* Tabela de tamanhos */}
          {sizes.length > 0 ? (
            <div className={`rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className={`grid grid-cols-2 gap-px px-4 py-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <span className="text-[8px] font-black text-slate-400 uppercase">Tamanho</span>
                <span className="text-[8px] font-black text-emerald-500 uppercase text-center">Pares / Grade</span>
              </div>
              {sizes.map(size => (
                <div
                  key={size}
                  className={`grid grid-cols-2 gap-2 px-4 py-3 items-center border-t ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-50 bg-white'}`}
                >
                  <span className={`text-[12px] font-black ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{size}</span>
                  <div className="flex justify-center">
                    <input
                      type="number"
                      min={0}
                      value={breakdown[size] ?? ''}
                      placeholder="0"
                      title={`Pares tamanho ${size}`}
                      aria-label={`Pares tamanho ${size}`}
                      onChange={e => setSize(size, parseInt(e.target.value) || 0)}
                      className={`w-20 text-center font-black text-sm rounded-lg px-2 py-1.5 outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-500 shrink-0" />
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  Selecione uma grade de referência para definir os tamanhos.
                </p>
              </div>
            </div>
          )}

          {/* Totalizador */}
          {total > 0 && (
            <div className={`p-4 rounded-2xl text-center ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total por Grade</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{total} pares</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <button
            type="button"
            onClick={() => { if (canConfirm) onConfirm(breakdown); }}
            disabled={!canConfirm}
            className={`w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              canConfirm
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-[0.99]'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 size={15} />
            Confirmar Grade — {total} pares
          </button>
        </div>
      </div>
    </div>
  );
}
