import { useState, useRef, useCallback } from 'react';
import { Printer, FileText, Image, X, RotateCcw, ChevronDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { sharePDF, shareImage } from '../utils/pdfExport';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocFormat = {
  label: string;
  dims: [number, number]; // [width, height] in mm
  orientation: 'portrait' | 'landscape';
};

export type PrintDocumentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filename?: string;
  isDarkMode: boolean;
  /** Receives the current format and should return the JSX document content */
  renderContent: (format: DocFormat) => React.ReactNode;
};

// ─── Paper presets ────────────────────────────────────────────────────────────

const FORMATS: DocFormat[] = [
  { label: 'A4',            dims: [210, 297], orientation: 'portrait'  },
  { label: 'A4 Paisagem',   dims: [297, 210], orientation: 'landscape' },
  { label: 'A5',            dims: [148, 210], orientation: 'portrait'  },
  { label: 'A6',            dims: [105, 148], orientation: 'portrait'  },
];

const STORAGE_KEY = 'print_doc_format';

const MM_TO_PX = 3.7795; // 1mm = 3.7795px at 96dpi

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrintDocumentModal({
  isOpen, onClose, title, filename, isDarkMode, renderContent,
}: PrintDocumentModalProps) {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  const savedIdx = saved ? FORMATS.findIndex(f => f.label === saved) : 0;

  const [formatIdx, setFormatIdx] = useState(Math.max(0, savedIdx));
  const [printing, setPrinting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const format = FORMATS[formatIdx];
  const [W, H] = format.dims;

  // Scale to fit within ~340px wide preview panel
  const maxPreviewW = 340;
  const scale = maxPreviewW / (W * MM_TO_PX);
  const previewW = W * MM_TO_PX * scale;
  const previewH = H * MM_TO_PX * scale;

  const selectFormat = (idx: number) => {
    setFormatIdx(idx);
    localStorage.setItem(STORAGE_KEY, FORMATS[idx].label);
  };

  // ── Native print ──────────────────────────────────────────────────────────
  const handleNativePrint = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
        <style>
          @page { size: ${W}mm ${H}mm; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
          * { box-sizing: border-box; }
        </style>
      </head><body>
        ${el.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }, [W, H]);

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    setPrinting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const scale2 = Math.max(3, 600 / Math.min(previewW, previewH));
      const canvas = await html2canvas(el, {
        scale: scale2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.97);
      const doc = new jsPDF({
        unit: 'mm',
        format: [W, H],
        orientation: format.orientation,
      });
      doc.addImage(imgData, 'JPEG', 0, 0, W, H);
      const name = filename || title.replace(/[^a-zA-Z0-9]/g, '_');
      await sharePDF(doc, `${name}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
    } finally {
      setPrinting(false);
    }
  }, [previewW, previewH, W, H, format.orientation, filename, title]);

  // ── JPG export ────────────────────────────────────────────────────────────
  const handleExportJPG = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    setPrinting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const scale2 = Math.max(3, 600 / Math.min(previewW, previewH));
      const canvas = await html2canvas(el, {
        scale: scale2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const name = filename || title.replace(/[^a-zA-Z0-9]/g, '_');
      await shareImage(dataUrl, `${name}.jpg`);
    } catch (err) {
      console.error('Erro ao gerar JPG', err);
    } finally {
      setPrinting(false);
    }
  }, [previewW, previewH, filename, title]);

  if (!isOpen) return null;

  const dk = isDarkMode;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative w-full sm:max-w-2xl max-h-[95vh] flex flex-col rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden ${dk ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Printer size={18} className="text-white" />
            </div>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-wider ${dk ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Impressão e Exportação</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={`w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all ${dk ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* ── Format selector ────────────────────────────────────────────── */}
        <div className={`px-6 py-3 border-b flex items-center gap-2 flex-wrap shrink-0 ${dk ? 'border-slate-800 bg-slate-900/50' : 'border-slate-50 bg-slate-50/50'}`}>
          <span className={`text-[9px] font-black uppercase tracking-widest mr-1 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>Formato</span>
          {FORMATS.map((f, i) => (
            <button
              key={f.label}
              type="button"
              onClick={() => selectFormat(i)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                formatIdx === i
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : dk ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className={`ml-auto flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
            <RotateCcw size={11} />
            {W} × {H} mm
          </div>
        </div>

        {/* ── Preview ────────────────────────────────────────────────────── */}
        <div className={`flex-1 overflow-auto flex items-start justify-center p-6 ${dk ? 'bg-slate-950/50' : 'bg-slate-100'}`}>
          <div style={{ position: 'relative' }}>
            {/* Shadow paper */}
            <div
              style={{ width: previewW, height: previewH }}
              className="shadow-2xl rounded-sm"
            >
              <div
                ref={previewRef}
                style={{
                  width: previewW,
                  height: previewH,
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                  position: 'relative',
                  transformOrigin: 'top left',
                }}
              >
                {/* Scale wrapper so renderContent can use mm units via CSS vars */}
                <div
                  style={{
                    width: W * MM_TO_PX,
                    height: H * MM_TO_PX,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  {renderContent(format)}
                </div>
              </div>
            </div>

            {/* Format label */}
            <p className="text-center text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
              {format.label} — {W}×{H}mm
            </p>
          </div>
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className={`px-6 py-4 border-t flex items-center gap-3 shrink-0 ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
          <button
            type="button"
            onClick={handleNativePrint}
            disabled={printing}
            className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            <Printer size={16} strokeWidth={2.5} />
            Imprimir
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={printing}
            className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 ${
              dk ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText size={16} strokeWidth={2.5} />
            PDF
          </button>

          <button
            type="button"
            onClick={handleExportJPG}
            disabled={printing}
            className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 ${
              dk ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Image size={16} strokeWidth={2.5} />
            JPG
          </button>

          {/* Dropdown for more options */}
          <button
            type="button"
            disabled={printing}
            className={`p-3.5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 ${
              dk ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            title="Mais opções"
            aria-label="Mais opções de exportação"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Loading overlay */}
        {printing && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center rounded-[2.5rem] z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-xs font-black uppercase tracking-widest">Gerando...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper: usePrintDocument hook ───────────────────────────────────────────

export function usePrintDocument() {
  const [printConfig, setPrintConfig] = useState<{
    title: string;
    filename?: string;
    renderContent: (format: DocFormat) => React.ReactNode;
  } | null>(null);

  const openPrint = useCallback((
    title: string,
    renderContent: (format: DocFormat) => React.ReactNode,
    filename?: string,
  ) => {
    setPrintConfig({ title, renderContent, filename });
  }, []);

  const closePrint = useCallback(() => setPrintConfig(null), []);

  return { printConfig, openPrint, closePrint };
}
