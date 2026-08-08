import { useState } from 'react';
import {
  Printer, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Minus, Plus,
} from 'lucide-react';
import Modal from './Modal';
import { LabelElement } from '../types';

export type PrintDirection = 'down' | 'up' | 'left' | 'right';
export type PrintPaperType = 2 | 1 | 4; // 2 = Espaço (confirmado), 1 = Contínuo, 4 = Marca preta (ambos não testados em hardware)

export interface PrintOptions {
  direction: PrintDirection;
  offsetXmm: number;
  offsetYmm: number;
  density: 1 | 2 | 3;
  copies: number;
  paperType: PrintPaperType;
}

const DEFAULT_OPTIONS: PrintOptions = { direction: 'down', offsetXmm: 0, offsetYmm: 0, density: 2, copies: 1, paperType: 2 };

interface LabelPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  widthMm: number;
  heightMm: number;
  elements: LabelElement[];
  onConfirmPrint: (options: PrintOptions) => Promise<void>;
}

const PREVIEW_WIDTH = 260;

export default function LabelPrintPreviewModal({
  isOpen, onClose, isDarkMode, widthMm, heightMm, elements, onConfirmPrint,
}: LabelPrintPreviewModalProps) {
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_OPTIONS);
  const [printing, setPrinting] = useState(false);

  const aspect = widthMm / heightMm;
  const previewHeight = PREVIEW_WIDTH / aspect;
  const pxPerMmX = PREVIEW_WIDTH / widthMm;
  const pxPerMmY = previewHeight / heightMm;

  const patch = (p: Partial<PrintOptions>) => setOptions(prev => ({ ...prev, ...p }));

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await onConfirmPrint(options);
      onClose();
    } finally {
      setPrinting(false);
    }
  };

  const rowCls = `flex items-center justify-between px-3 py-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`;
  const labelCls = 'text-[10px] font-black uppercase tracking-widest text-slate-400';
  const stepperBtnCls = `p-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`;

  const directionOptions: { value: PrintDirection; label: string; icon: typeof ArrowDown }[] = [
    { value: 'left', label: 'Esquerda', icon: ArrowLeft },
    { value: 'right', label: 'Direita', icon: ArrowRight },
    { value: 'up', label: 'Acima', icon: ArrowUp },
    { value: 'down', label: 'Abaixo', icon: ArrowDown },
  ];

  const paperTypeOptions: { value: PrintPaperType; label: string; confirmed: boolean }[] = [
    { value: 2, label: 'Espaço', confirmed: true },
    { value: 1, label: 'Contínuo', confirmed: false },
    { value: 4, label: 'Marca preta', confirmed: false },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Visualização da Impressão" icon={<Printer size={20} />} maxWidth="max-w-md" zIndex={95000}>
      <div className="flex flex-col gap-4">
        {/* Preview somente leitura */}
        <div className="mx-auto">
          <div
            className="relative bg-white rounded-lg border-2 border-dashed border-slate-300 overflow-hidden"
            style={{ width: PREVIEW_WIDTH, height: previewHeight }}
          >
            {elements.map(el => (
              <div
                key={el.id}
                className="absolute flex items-center justify-center"
                style={{
                  left: el.x * pxPerMmX, top: el.y * pxPerMmY, width: el.w * pxPerMmX, height: el.h * pxPerMmY,
                  transform: `rotate(${el.rotation}deg)`,
                }}
              >
                {el.type === 'text' ? (
                  <span
                    className="text-black whitespace-pre-wrap break-words w-full"
                    style={{
                      fontSize: (el.fontSize || 4) * pxPerMmX, fontWeight: el.bold ? 900 : 400,
                      fontStyle: el.italic ? 'italic' : 'normal', textDecoration: el.underline ? 'underline' : 'none',
                      textAlign: el.align || 'center', letterSpacing: `${el.letterSpacing || 0}px`, lineHeight: el.lineHeight || 1,
                    }}
                  >
                    {el.text}
                  </span>
                ) : el.type === 'line' ? (
                  <div className="w-full h-full bg-black" />
                ) : el.type === 'shape' ? (
                  <div className="w-full h-full border-2 border-black" />
                ) : el.imageDataUrl ? (
                  <img src={el.imageDataUrl} alt="" className="w-full h-full object-contain" draggable={false} />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Direção de saída */}
        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Direção de saída</span>
          <div className="grid grid-cols-4 gap-2">
            {directionOptions.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => patch({ direction: d.value })}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest ${
                  options.direction === d.value ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <d.icon size={14} /> {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Offsets */}
        <div className={rowCls}>
          <span className={labelCls}>Deslocamento vertical</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => patch({ offsetYmm: Math.max(-20, +(options.offsetYmm - 0.5).toFixed(1)) })} className={stepperBtnCls}><Minus size={12} /></button>
            <span className="text-xs font-black w-10 text-center">{options.offsetYmm.toFixed(1)}</span>
            <button type="button" onClick={() => patch({ offsetYmm: Math.min(20, +(options.offsetYmm + 0.5).toFixed(1)) })} className={stepperBtnCls}><Plus size={12} /></button>
          </div>
        </div>
        <div className={rowCls}>
          <span className={labelCls}>Deslocamento horizontal</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => patch({ offsetXmm: Math.max(-20, +(options.offsetXmm - 0.5).toFixed(1)) })} className={stepperBtnCls}><Minus size={12} /></button>
            <span className="text-xs font-black w-10 text-center">{options.offsetXmm.toFixed(1)}</span>
            <button type="button" onClick={() => patch({ offsetXmm: Math.min(20, +(options.offsetXmm + 0.5).toFixed(1)) })} className={stepperBtnCls}><Plus size={12} /></button>
          </div>
        </div>

        {/* Densidade */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className={labelCls}>Densidade de impressão</span>
            <span className="text-xs font-black text-indigo-500">{options.density}</span>
          </div>
          <input
            type="range" min={1} max={3} step={1} value={options.density}
            onChange={e => patch({ density: parseInt(e.target.value, 10) as 1 | 2 | 3 })}
            className="w-full"
          />
        </div>

        {/* Número de cópias */}
        <div className={rowCls}>
          <span className={labelCls}>Número de impressões</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => patch({ copies: Math.max(1, options.copies - 1) })} className={stepperBtnCls}><Minus size={12} /></button>
            <span className="text-xs font-black w-6 text-center">{options.copies}</span>
            <button type="button" onClick={() => patch({ copies: Math.min(20, options.copies + 1) })} className={stepperBtnCls}><Plus size={12} /></button>
          </div>
        </div>

        {/* Tipo de papel */}
        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Tipo de papel</span>
          <div className="grid grid-cols-3 gap-2">
            {paperTypeOptions.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => patch({ paperType: p.value })}
                className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                  options.paperType === p.value ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {p.label}
                {!p.confirmed && <span className="text-[7px] font-bold opacity-70 normal-case">não testado</span>}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          disabled={printing}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
        >
          <Printer size={16} /> {printing ? 'Imprimindo...' : 'Imprimir agora'}
        </button>
      </div>
    </Modal>
  );
}
