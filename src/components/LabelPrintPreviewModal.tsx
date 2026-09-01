import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import {
  Printer, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Minus, Plus, ChevronLeft, ChevronRight, Pencil,
  Download, FileText, Image as ImageIcon,
} from 'lucide-react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import Modal from './Modal';
import PrinterConnectionCard from './PrinterConnectionCard';
import { isAblemarkPlatform } from '../lib/ablemarkPrinter';
import { isAbleMarkPrinterConnected2 } from '../lib/ablemarkPrinter2';
import { saveImageToGallery, isGallerySaverPlatform } from '../lib/gallerySaver';
import { shareImages, sharePDF } from '../utils/pdfExport';
import { toast } from '../utils/toast';

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
  /** Imagens já renderizadas (dataURL) pra mostrar no preview, uma por etiqueta do lote — o
   * modal não sabe nada sobre o modelo de dados que gerou elas (elementos do editor livre,
   * canvas do editor de produto, etc.), só exibe o resultado. Com mais de uma, mostra
   * setas de avançar/voltar pra conferir cada etiqueta antes de imprimir o lote inteiro. */
  previewDataUrls: string[];
  /** Nota opcional acima do botão de imprimir — ex.: "48 etiquetas (grade) × cópias". */
  totalLabelsNote?: string;
  /** Quando informado, mostra um botão "Voltar à edição" que fecha esta prévia e chama isso —
   * usado nos fluxos onde a edição (ex.: recorte do PDF) é uma tela separada da prévia, então
   * o "Voltar" genérico do rodapé não basta pra corrigir algo antes de imprimir. */
  onBackToEdit?: () => void;
  onConfirmPrint: (options: PrintOptions) => Promise<void>;
}

const PREVIEW_WIDTH = 260;

export default function LabelPrintPreviewModal({
  isOpen, onClose, isDarkMode, widthMm, heightMm, previewDataUrls, totalLabelsNote, onBackToEdit, onConfirmPrint,
}: LabelPrintPreviewModalProps) {
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_OPTIONS);
  const [printing, setPrinting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [savingGallery, setSavingGallery] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Impressora Bluetooth (Ablemark) desconectada na hora de imprimir — em vez de deixar o
  // usuário tentar, tomar um erro genérico e ter que sair pra outra tela só pra conectar, o
  // card de conexão (PrinterConnectionCard) aparece aqui mesmo, dentro do preview. Ausente em
  // plataformas sem Ablemark (iOS) — lá não tem o que conectar.
  const [printerConnected, setPrinterConnected] = useState(true);

  // Volta pra primeira etiqueta só quando a modal ABRE — dependia antes também de
  // `previewDataUrls`, mas esse array é recriado (nova referência) a cada render do pai
  // (`.map(f => f.toDataURL(...))` sem memoização), então qualquer re-render alheio do pai
  // (ex.: um snapshot do Firestore chegando em outro lugar da árvore) resetava a navegação
  // de volta pra página 1 no meio da conferência do usuário.
  useEffect(() => { if (isOpen) setPreviewIndex(0); }, [isOpen]);
  useEffect(() => {
    if (isOpen && isAblemarkPlatform()) isAbleMarkPrinterConnected2().then(setPrinterConnected);
  }, [isOpen]);
  // Se o lote encolher (ou o índice ficar inválido por qualquer motivo), não deixa a imagem
  // sumir silenciosamente — trava no último item válido.
  const safePreviewIndex = Math.min(previewIndex, Math.max(0, previewDataUrls.length - 1));

  const aspect = widthMm / heightMm;
  const previewHeight = PREVIEW_WIDTH / aspect;

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

  // Salva TODAS as etiquetas do lote na galeria (não só a que está sendo visualizada agora) —
  // mesma lógica do lote inteiro que "Imprimir agora" já manda pra impressora de uma vez.
  const handleSaveGallery = async () => {
    setSavingGallery(true);
    try {
      let savedCount = 0;
      for (let i = 0; i < previewDataUrls.length; i++) {
        const base64 = previewDataUrls[i].split('base64,')[1] || previewDataUrls[i];
        const written = await Filesystem.writeFile({ path: `label_gallery_${Date.now()}_${i}.png`, data: base64, directory: Directory.Cache });
        const { saved } = await saveImageToGallery(written.uri);
        if (saved) savedCount++;
      }
      toast.show(savedCount > 0 ? `${savedCount} etiqueta${savedCount > 1 ? 's' : ''} salva${savedCount > 1 ? 's' : ''} na galeria!` : 'Falha ao salvar na galeria.');
    } catch (err: any) {
      toast.show('Erro ao salvar na galeria: ' + (err?.message || err));
    } finally {
      setSavingGallery(false);
    }
  };

  // Compartilha o lote inteiro numa única ação nativa (ver shareImages) — com 1 etiqueta só,
  // vira um compartilhamento normal de imagem única.
  const handleShareJpg = async () => {
    setSharing(true);
    try {
      await shareImages(previewDataUrls, 'etiqueta');
    } catch (err: any) {
      toast.show('Erro ao compartilhar: ' + (err?.message || err));
    } finally {
      setSharing(false);
    }
  };

  // Junta todas as etiquetas do lote num PDF só (1 página por etiqueta, no tamanho físico real
  // widthMm×heightMm) e compartilha — mesmo mecanismo de exportação em PDF já usado em
  // Vendas/Compras (ver sharePDF), só que a partir das imagens já renderizadas do preview.
  const [sharingPdf, setSharingPdf] = useState(false);
  const handleSharePdf = async () => {
    setSharingPdf(true);
    try {
      const orientation = widthMm > heightMm ? 'landscape' : 'portrait';
      const doc = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation });
      previewDataUrls.forEach((url, i) => {
        if (i > 0) doc.addPage([widthMm, heightMm], orientation);
        doc.addImage(url, 'PNG', 0, 0, widthMm, heightMm);
      });
      await sharePDF(doc, 'etiquetas');
    } catch (err: any) {
      toast.show('Erro ao gerar PDF: ' + (err?.message || err));
    } finally {
      setSharingPdf(false);
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
        {/* Preview somente leitura — com mais de 1 etiqueta, dá pra avançar/voltar pra
            conferir cada uma antes de mandar o lote inteiro pra impressora. */}
        <div className="mx-auto flex flex-col items-center gap-2">
          <div
            className="relative bg-white rounded-lg border-2 border-dashed border-slate-300 overflow-hidden"
            style={{ width: PREVIEW_WIDTH, height: previewHeight }}
          >
            {previewDataUrls[safePreviewIndex] && (
              <img src={previewDataUrls[safePreviewIndex]} alt="" className="w-full h-full object-contain" draggable={false} />
            )}
          </div>
          {previewDataUrls.length > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewIndex(Math.max(0, safePreviewIndex - 1))}
                disabled={safePreviewIndex <= 0}
                data-guide-anchor="labelPrintPreview.anterior"
                className={`p-1.5 rounded-full disabled:opacity-30 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Etiqueta {safePreviewIndex + 1} de {previewDataUrls.length}
              </span>
              <button
                type="button"
                onClick={() => setPreviewIndex(Math.min(previewDataUrls.length - 1, safePreviewIndex + 1))}
                disabled={safePreviewIndex >= previewDataUrls.length - 1}
                data-guide-anchor="labelPrintPreview.proxima"
                className={`p-1.5 rounded-full disabled:opacity-30 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
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
                data-guide-anchor="labelPrintPreview.selecionarDirecao"
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
            <button type="button" onClick={() => patch({ offsetYmm: Math.max(-20, +(options.offsetYmm - 0.5).toFixed(1)) })} data-guide-anchor="labelPrintPreview.diminuirOffsetY" className={stepperBtnCls}><Minus size={12} /></button>
            <span className="text-xs font-black w-10 text-center">{options.offsetYmm.toFixed(1)}</span>
            <button type="button" onClick={() => patch({ offsetYmm: Math.min(20, +(options.offsetYmm + 0.5).toFixed(1)) })} data-guide-anchor="labelPrintPreview.aumentarOffsetY" className={stepperBtnCls}><Plus size={12} /></button>
          </div>
        </div>
        <div className={rowCls}>
          <span className={labelCls}>Deslocamento horizontal</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => patch({ offsetXmm: Math.max(-20, +(options.offsetXmm - 0.5).toFixed(1)) })} data-guide-anchor="labelPrintPreview.diminuirOffsetX" className={stepperBtnCls}><Minus size={12} /></button>
            <span className="text-xs font-black w-10 text-center">{options.offsetXmm.toFixed(1)}</span>
            <button type="button" onClick={() => patch({ offsetXmm: Math.min(20, +(options.offsetXmm + 0.5).toFixed(1)) })} data-guide-anchor="labelPrintPreview.aumentarOffsetX" className={stepperBtnCls}><Plus size={12} /></button>
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
            <button type="button" onClick={() => patch({ copies: Math.max(1, options.copies - 1) })} data-guide-anchor="labelPrintPreview.diminuirCopias" className={stepperBtnCls}><Minus size={12} /></button>
            <span className="text-xs font-black w-6 text-center">{options.copies}</span>
            <button type="button" onClick={() => patch({ copies: Math.min(20, options.copies + 1) })} data-guide-anchor="labelPrintPreview.aumentarCopias" className={stepperBtnCls}><Plus size={12} /></button>
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
                data-guide-anchor="labelPrintPreview.selecionarTipoPapel"
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

        {totalLabelsNote && (
          <p className="text-center text-[10px] font-bold text-slate-400">{totalLabelsNote}</p>
        )}

        {/* Impressora desconectada — conecta aqui mesmo, sem sair do preview. */}
        {isAblemarkPlatform() && !printerConnected && (
          <div className="flex flex-col gap-1.5">
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-rose-500">
              Conecte a impressora pra imprimir
            </p>
            <PrinterConnectionCard isDarkMode={isDarkMode} onConnectedChange={setPrinterConnected} />
          </div>
        )}

        {onBackToEdit && (
          <button
            type="button"
            onClick={() => { onClose(); onBackToEdit(); }}
            disabled={printing}
            data-guide-anchor="labelPrintPreview.voltarEdicao"
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <Pencil size={14} /> Voltar à edição
          </button>
        )}

        <div className="flex gap-2">
          {isGallerySaverPlatform() && (
            <button
              type="button"
              onClick={handleSaveGallery}
              disabled={savingGallery}
              data-guide-anchor="labelPrintPreview.salvarGaleria"
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              <Download size={14} /> {savingGallery ? 'Salvando...' : 'Galeria'}
            </button>
          )}
          <button
            type="button"
            onClick={handleShareJpg}
            disabled={sharing}
            data-guide-anchor="labelPrintPreview.compartilharJpg"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <ImageIcon size={14} /> {sharing ? '...' : 'JPG'}
          </button>
          <button
            type="button"
            onClick={handleSharePdf}
            disabled={sharingPdf}
            data-guide-anchor="labelPrintPreview.compartilharPdf"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <FileText size={14} /> {sharingPdf ? '...' : 'PDF'}
          </button>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          disabled={printing || (isAblemarkPlatform() && !printerConnected)}
          data-guide-anchor="labelPrintPreview.imprimir"
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
        >
          <Printer size={16} /> {printing ? 'Imprimindo...' : 'Imprimir agora'}
        </button>
      </div>
    </Modal>
  );
}
