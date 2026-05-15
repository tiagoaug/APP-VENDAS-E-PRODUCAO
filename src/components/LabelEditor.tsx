import React, { useState, useEffect } from 'react';
import { Move, Maximize, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { LabelLayout } from '../types';
import { labelService } from '../services/labelService';

interface LabelEditorProps {
  dimensions: [number, number];
  layout: LabelLayout;
  onChange: (layout: LabelLayout) => void;
  productName: string;
  reference: string;
  colorName: string;
  isDarkMode: boolean;
}

export default function LabelEditor({ 
  dimensions, 
  layout, 
  onChange, 
  productName, 
  reference, 
  colorName,
  isDarkMode 
}: LabelEditorProps) {
  const [w, h] = dimensions;
  const [qrPreview, setQrPreview] = useState<string>('');
  const scale = 7; // Scale for the visualizer
  
  useEffect(() => {
    const loadQr = async () => {
      const url = await labelService.generateQRCode('PREVIEW');
      setQrPreview(url);
    };
    loadQr();
  }, []);

  const handleDrag = (e: React.MouseEvent, key: keyof LabelLayout, type: 'x' | 'y') => {
    if (e.buttons !== 1) return;
    
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    const pos = type === 'x' ? (e.clientX - rect.left) / scale : (e.clientY - rect.top) / scale;
    const roundedPos = Math.round(pos * 10) / 10;
    
    onChange({ ...layout, [key]: roundedPos });
  };

  const updateField = (key: keyof LabelLayout, value: any) => {
    onChange({ ...layout, [key]: value });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <h4 className="text-[10px] font-black tracking-widest text-slate-400">Pré-visualização e Ajuste</h4>
           <div className="group relative">
              <AlertCircle size={12} className="text-slate-300 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-[8px] text-white rounded-lg shadow-xl z-50">
                Os valores são em milímetros (mm). Arraste os elementos na etiqueta para ajustar a posição.
              </div>
           </div>
        </div>
        <button 
          onClick={() => {
            onChange(labelService.getDefaultLayout(dimensions));
          }}
          title="Resetar posições para o padrão"
          aria-label="Resetar layout"
          className="text-[9px] font-bold text-indigo-500 flex items-center gap-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded-lg transition-colors"
        >
          <RotateCcw size={10} /> Resetar
        </button>
      </div>

      <div className="flex justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 relative group">
        {/* Label Canvas */}
        <div 
          className="relative bg-white shadow-2xl overflow-hidden ring-1 ring-slate-100"
          style={{ 
            width: w * scale, 
            height: h * scale,
          }}
        >
          {/* Reference */}
          <div 
            draggable
            onDrag={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect || e.clientX === 0) return;
              const nx = (e.clientX - rect.left) / scale;
              const ny = (e.clientY - rect.top) / scale;
              onChange({ ...layout, refX: Math.round(nx * 10) / 10, refY: Math.round(ny * 10) / 10 });
            }}
            className="absolute cursor-move select-none whitespace-nowrap text-center flex flex-col items-center"
            title="Arraste para mover a referência"
            style={{ 
              left: (layout.refX * scale) - (w * scale / 2), 
              top: layout.refY * scale,
              fontSize: `${layout.refSize * 1.5}px`,
              width: w * scale,
              fontWeight: 'bold',
              color: 'black',
              lineHeight: 1
            }}
          >
            {reference}
          </div>

          {/* QR Code */}
          <div 
            draggable
            onDrag={(e) => {
               const rect = e.currentTarget.parentElement?.getBoundingClientRect();
               if (!rect || e.clientX === 0) return;
               const nx = (e.clientX - rect.left - (layout.qrSize * scale / 2)) / scale;
               const ny = (e.clientY - rect.top - (layout.qrSize * scale / 2)) / scale;
               onChange({ ...layout, qrX: Math.round(nx * 10) / 10, qrY: Math.round(ny * 10) / 10 });
            }}
            className="absolute cursor-move bg-white"
            style={{ 
              left: layout.qrX * scale, 
              top: layout.qrY * scale,
              width: layout.qrSize * scale,
              height: layout.qrSize * scale,
            }}
          >
            {qrPreview ? (
              <img src={qrPreview} alt="QR" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full border-2 border-slate-100 bg-slate-50 animate-pulse" />
            )}
          </div>

          {/* Color */}
          <div 
            draggable
            onDrag={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect || e.clientX === 0) return;
              const nx = (e.clientX - rect.left) / scale;
              const ny = (e.clientY - rect.top) / scale;
              onChange({ ...layout, colorX: Math.round(nx * 10) / 10, colorY: Math.round(ny * 10) / 10 });
            }}
            className="absolute cursor-move select-none whitespace-nowrap text-center flex flex-col items-center"
            style={{ 
              left: (layout.colorX * scale) - (w * scale / 2), 
              top: layout.colorY * scale,
              fontSize: `${layout.colorSize * 1.5}px`,
              width: w * scale,
              fontWeight: 'bold',
              color: 'black',
              lineHeight: 1
            }}
          >
            {colorName}
          </div>

          {/* Size */}
          {layout.showSize && (
            <div 
              draggable
              onDrag={(e) => {
                const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                if (!rect || e.clientX === 0) return;
                const nx = (e.clientX - rect.left) / scale;
                const ny = (e.clientY - rect.top) / scale;
                onChange({ ...layout, sizeX: Math.round(nx * 10) / 10, sizeY: Math.round(ny * 10) / 10 });
              }}
              className="absolute font-bold text-black cursor-move leading-none"
              style={{ 
                left: layout.sizeX * scale, 
                top: layout.sizeY * scale,
                fontSize: `${layout.sizeSize * 1.5}px`
              }}
            >
              38
            </div>
          )}

          {/* Footer */}
          <div 
            draggable
            onDrag={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect || e.clientX === 0) return;
              const nx = (e.clientX - rect.left) / scale;
              const ny = (e.clientY - rect.top) / scale;
              onChange({ ...layout, footerX: Math.round(nx * 10) / 10, footerY: Math.round(ny * 10) / 10 });
            }}
            className="absolute text-slate-400 cursor-move leading-none whitespace-nowrap"
            style={{ 
              left: layout.footerX * scale, 
              top: layout.footerY * scale,
              fontSize: `${layout.footerSize * 1.5}px`
            }}
          >
            ANTIGRAVITY SYSTEM
          </div>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[9px] font-black uppercase text-slate-400">QR Code: {layout.qrSize}mm</label>
          </div>
          <input 
            type="range" min="10" max={w - 5} step="0.5"
            value={layout.qrSize}
            onChange={(e) => updateField('qrSize', parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[9px] font-black uppercase text-slate-400">Fonte REF: {layout.refSize}pt</label>
          </div>
          <input 
            type="range" min="4" max="14" step="0.5"
            value={layout.refSize}
            onChange={(e) => updateField('refSize', parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[9px] font-black uppercase text-slate-400">Fonte COR: {layout.colorSize}pt</label>
          </div>
          <input 
            type="range" min="4" max="12" step="0.5"
            value={layout.colorSize}
            onChange={(e) => updateField('colorSize', parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
        <div className="space-y-2 flex items-center justify-between pt-2">
           <label className="text-[9px] font-black uppercase text-slate-400">Mostrar Tamanho</label>
           <button 
             onClick={() => updateField('showSize', !layout.showSize)}
             className={`w-10 h-5 rounded-full transition-colors relative ${layout.showSize ? 'bg-indigo-600' : 'bg-slate-300'}`}
           >
             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${layout.showSize ? 'left-6' : 'left-1'}`} />
           </button>
        </div>
      </div>
    </div>
  );
}
