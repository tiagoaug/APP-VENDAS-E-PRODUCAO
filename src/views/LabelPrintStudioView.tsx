import { useEffect, useRef, useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  Bluetooth, CheckCircle2, XCircle, RefreshCw, Ruler, Plus, Trash2,
  FilePlus, Upload, FolderOpen, X, ChevronDown, ChevronUp, RotateCcw, Pencil,
} from 'lucide-react';
import { LabelPaperSize, LabelFile } from '../types';
import {
  AbleMarkPairedDevice,
  listAbleMarkPairedDevices,
  connectAbleMarkPrinter,
  disconnectAbleMarkPrinter,
  isAbleMarkPrinterConnected,
  resetAbleMarkPrinter,
  printAbleMarkLabel,
} from '../lib/ablemarkPrinter';
import { toast } from '../utils/toast';
import { pickLabelImportFile } from '../utils/labelFileImport';
import PdfPageSelectModal, { CropRect, CroppedPage } from '../components/PdfPageSelectModal';
import LabelPrintPreviewModal, { PrintOptions } from '../components/LabelPrintPreviewModal';
import { applyPrintTransform, DIRECTION_TO_ROTATION } from '../utils/labelPrintTransform';

const DOTS_PER_MM = 8; // mesma densidade validada em hardware real (ver LabelEditorView)

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a página'));
    img.src = src;
  });
}

/** Recorta uma página (imagem já rasterizada) segundo `crop` (frações 0..1 da página) e
 * devolve só a região recortada como um novo PNG dataURL — usado quando só 1 página foi
 * selecionada (abre no editor normal já recortada). */
async function cropImageToDataUrl(pageDataUrl: string, crop: CropRect): Promise<string> {
  const img = await loadImageEl(pageDataUrl);
  const sx = crop.x * img.naturalWidth;
  const sy = crop.y * img.naturalHeight;
  const sw = crop.w * img.naturalWidth;
  const sh = crop.h * img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Recorta uma página segundo `crop` (frações 0..1, mesmo recorte relativo aplicado a todas
 * as páginas do lote) e desenha só essa região esticada pra preencher a etiqueta inteira de
 * widthMm×heightMm — sem sobrar borda branca, já que o recorte É o conteúdo da etiqueta. */
async function renderPageToLabelCanvas(pageDataUrl: string, widthMm: number, heightMm: number, crop: CropRect): Promise<HTMLCanvasElement> {
  const img = await loadImageEl(pageDataUrl);
  const pxW = Math.max(1, Math.round(widthMm * DOTS_PER_MM));
  const pxH = Math.max(1, Math.round(heightMm * DOTS_PER_MM));
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pxW, pxH);
  const sx = crop.x * img.naturalWidth;
  const sy = crop.y * img.naturalHeight;
  const sw = crop.w * img.naturalWidth;
  const sh = crop.h * img.naturalHeight;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, pxW, pxH);
  return canvas;
}

// Mesmos presets usados no editor de etiqueta de produto (PrintLabelEditorModal), replicados
// aqui porque não são exportados de lá — mantém os tamanhos comuns disponíveis sem exigir
// cadastro manual pra casos padrão.
const PRESET_SIZES: { name: string; widthMm: number; heightMm: number }[] = [
  { name: '75 × 24 mm', widthMm: 75, heightMm: 24 },
  { name: '38 × 25 mm', widthMm: 38, heightMm: 25 },
  { name: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  { name: '57 × 40 mm', widthMm: 57, heightMm: 40 },
  { name: '80 × 40 mm', widthMm: 80, heightMm: 40 },
  { name: '80 × 50 mm', widthMm: 80, heightMm: 50 },
  { name: '100 × 50 mm', widthMm: 100, heightMm: 50 },
  { name: '40 × 30 mm', widthMm: 40, heightMm: 30 },
  { name: '100 × 150 mm', widthMm: 100, heightMm: 150 },
];

export interface OpenEditorParams {
  widthMm: number;
  heightMm: number;
  paperSizeId?: string;
  existingFile?: LabelFile;
  importedImageDataUrl?: string;
}

interface LabelPrintStudioViewProps {
  isDarkMode: boolean;
  labelPaperSizes: LabelPaperSize[];
  labelFiles: LabelFile[];
  onAddPaperSize: (size: { name: string; widthMm: number; heightMm: number }) => Promise<void>;
  onEditPaperSize: (id: string, size: { name: string; widthMm: number; heightMm: number }) => Promise<void>;
  onDeletePaperSize: (id: string) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
  onOpenEditor: (params: OpenEditorParams) => void;
}

type SelectedSize = { name: string; widthMm: number; heightMm: number; paperSizeId?: string };

export default function LabelPrintStudioView({
  isDarkMode, labelPaperSizes, labelFiles,
  onAddPaperSize, onEditPaperSize, onDeletePaperSize, onDeleteFile, onOpenEditor,
}: LabelPrintStudioViewProps) {
  const [devices, setDevices] = useState<AbleMarkPairedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [selectedSize, setSelectedSize] = useState<SelectedSize | null>(
    PRESET_SIZES[0] ? { ...PRESET_SIZES[0] } : null,
  );
  const [sizesExpanded, setSizesExpanded] = useState(false);
  const [showAddSize, setShowAddSize] = useState(false);
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeWidth, setNewSizeWidth] = useState('');
  const [newSizeHeight, setNewSizeHeight] = useState('');
  const [savingSize, setSavingSize] = useState(false);

  const [pdfPagesToSelect, setPdfPagesToSelect] = useState<string[]>([]);
  const [showPdfPageSelect, setShowPdfPageSelect] = useState(false);
  const [batchFrames, setBatchFrames] = useState<HTMLCanvasElement[]>([]);
  const [showBatchPreview, setShowBatchPreview] = useState(false);
  const importingRef = useRef(false);

  useEffect(() => {
    isAbleMarkPrinterConnected().then(setConnected);
  }, []);

  const handleImportFile = async () => {
    if (!selectedSize || importingRef.current) return;
    importingRef.current = true;
    try {
      const result = await pickLabelImportFile();
      if (!result) return;
      if (result.kind === 'image') {
        onOpenEditor({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId, importedImageDataUrl: result.dataUrl });
        return;
      }
      // PDF de 1 página só — abre direto no editor, igual a uma imagem.
      if (result.pages.length === 1) {
        onOpenEditor({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId, importedImageDataUrl: result.pages[0] });
        return;
      }
      setPdfPagesToSelect(result.pages);
      setShowPdfPageSelect(true);
    } catch (err: any) {
      toast.show('Erro ao importar arquivo: ' + (err?.message || err));
    } finally {
      importingRef.current = false;
    }
  };

  // PDF de várias páginas: cada página selecionada vira uma etiqueta, recortada segundo o
  // recorte já resolvido por página (padrão único, por ímpar/par, ou manual — ver
  // PdfPageSelectModal) — se só 1 página foi marcada, recorta e abre o editor normal (permite
  // ajuste fino); com mais de 1, vai direto pra pré-visualização de impressão em lote.
  const handleConfirmPdfPages = async (items: CroppedPage[]) => {
    setShowPdfPageSelect(false);
    if (!selectedSize) return;
    if (items.length === 1) {
      try {
        const croppedDataUrl = await cropImageToDataUrl(items[0].dataUrl, items[0].crop);
        onOpenEditor({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId, importedImageDataUrl: croppedDataUrl });
      } catch (err: any) {
        toast.show('Erro ao recortar página: ' + (err?.message || err));
      }
      return;
    }
    try {
      const frames = await Promise.all(items.map(it => renderPageToLabelCanvas(it.dataUrl, selectedSize.widthMm, selectedSize.heightMm, it.crop)));
      setBatchFrames(frames);
      setShowBatchPreview(true);
    } catch (err: any) {
      toast.show('Erro ao preparar páginas: ' + (err?.message || err));
    }
  };

  const handleConfirmBatchPrint = async (options: PrintOptions) => {
    const rotationDeg = DIRECTION_TO_ROTATION[options.direction];
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < batchFrames.length; i++) {
      const transformed = applyPrintTransform(
        batchFrames[i], selectedSize!.widthMm, selectedSize!.heightMm,
        { offsetXmm: options.offsetXmm, offsetYmm: options.offsetYmm, rotationDeg },
        DOTS_PER_MM,
      );
      const base64 = transformed.toDataURL('image/png').split('base64,')[1];
      for (let c = 0; c < options.copies; c++) {
        try {
          const written = await Filesystem.writeFile({ path: `label_${Date.now()}_${i}_${c}.png`, data: base64, directory: Directory.Cache });
          const { sent: ok } = await printAbleMarkLabel(written.uri, options.paperType, options.density);
          if (ok) sent++; else failed++;
        } catch {
          failed++;
        }
      }
    }
    toast.show(failed === 0 ? `${sent} etiqueta(s) enviada(s) para a impressora!` : `${sent} enviada(s), ${failed} falharam.`);
  };

  const handleListDevices = async () => {
    setLoadingDevices(true);
    try {
      const list = await listAbleMarkPairedDevices();
      setDevices(list);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleConnect = async (address: string) => {
    setSelectedAddress(address);
    setConnecting(true);
    try {
      const { connected: ok } = await connectAbleMarkPrinter(address);
      setConnected(ok);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectAbleMarkPrinter();
    setConnected(false);
  };

  const handleResetConnection = async () => {
    setResetting(true);
    try {
      await resetAbleMarkPrinter();
      setConnected(false);
      setDevices([]);
      toast.show('Conexão e cache resetados — conecte novamente.');
    } finally {
      setResetting(false);
    }
  };

  const handleAddSize = async () => {
    const widthMm = parseFloat(newSizeWidth.replace(',', '.'));
    const heightMm = parseFloat(newSizeHeight.replace(',', '.'));
    if (!widthMm || !heightMm || widthMm <= 0 || heightMm <= 0) {
      toast.show('Informe largura e altura válidas (em mm).');
      return;
    }
    // Nome é opcional — sem ele, gera um nome padrão a partir das dimensões (mesmo padrão
    // usado nos tamanhos pré-definidos, ex: "75 × 24 mm"). Sem essa saída, o formulário
    // ficava travado silenciosamente (o botão "Salvar" não fazia nada e não avisava por quê).
    const name = newSizeName.trim() || `${widthMm} × ${heightMm} mm`;
    setSavingSize(true);
    try {
      if (editingSizeId) {
        await onEditPaperSize(editingSizeId, { name, widthMm, heightMm });
        toast.show('Tamanho atualizado!');
      } else {
        await onAddPaperSize({ name, widthMm, heightMm });
      }
      setNewSizeName('');
      setNewSizeWidth('');
      setNewSizeHeight('');
      setEditingSizeId(null);
      setShowAddSize(false);
    } catch (err: any) {
      toast.show('Erro ao salvar tamanho: ' + (err?.message || err));
    } finally {
      setSavingSize(false);
    }
  };

  const handleStartEditSize = (s: LabelPaperSize) => {
    setEditingSizeId(s.id);
    setNewSizeName(s.name);
    setNewSizeWidth(String(s.widthMm));
    setNewSizeHeight(String(s.heightMm));
    setShowAddSize(true);
  };

  const handleCancelAddSize = () => {
    setShowAddSize(false);
    setEditingSizeId(null);
    setNewSizeName('');
    setNewSizeWidth('');
    setNewSizeHeight('');
  };

  // Efeito "3D" dos minicards: sombra elevada + borda inferior grossa simulando profundidade,
  // que "afunda" (translateY + sombra menor) enquanto o dedo/mouse pressiona um botão interno.
  const miniCardCls = `relative rounded-2xl p-4 border-b-[3px] transition-shadow ${
    isDarkMode
      ? 'bg-gradient-to-b from-slate-800 to-slate-800/80 border-slate-950 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5)]'
      : 'bg-gradient-to-b from-white to-slate-50 border-slate-200 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.18)]'
  }`;
  const miniCardConnectedCls = `relative rounded-2xl p-4 border-b-[3px] transition-shadow ${
    isDarkMode
      ? 'bg-gradient-to-b from-emerald-900/40 to-emerald-900/20 border-emerald-600/60 shadow-[0_6px_16px_-4px_rgba(16,185,129,0.35)]'
      : 'bg-gradient-to-b from-emerald-50 to-white border-emerald-300 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.3)]'
  }`;
  const pressBtnCls = 'active:translate-y-0.5 transition-transform';
  const sectionTitleCls = 'text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3';
  const outerCardCls = `p-3 sm:p-4 rounded-3xl border ${
    isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-gradient-to-br from-slate-100 to-white border-slate-200'
  }`;

  return (
    <>
    <div className={outerCardCls}>
    <div className="flex flex-col gap-4">
      {/* Conexão */}
      <div className={connected ? miniCardConnectedCls : miniCardCls}>
        <div className="flex items-center justify-between mb-3">
          <span className={connected ? 'text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3' : sectionTitleCls}>
            Impressora (Ablemark BR-L100)
          </span>
          {connected ? (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} /> Conectada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-500">
              <XCircle size={13} /> Desconectada
            </span>
          )}
        </div>

        {connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            <CheckCircle2 size={13} /> Desconectar
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleListDevices}
              disabled={loadingDevices}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <RefreshCw size={13} className={loadingDevices ? 'animate-spin' : ''} /> Listar dispositivos pareados
            </button>
            {devices.map(d => (
              <button
                key={d.address}
                type="button"
                onClick={() => handleConnect(d.address)}
                disabled={connecting}
                className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                  selectedAddress === d.address
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bluetooth size={13} className="text-indigo-500 shrink-0" />
                  <span className="text-xs font-black truncate">{d.name}</span>
                </div>
                {connecting && selectedAddress === d.address && <RefreshCw size={13} className="animate-spin text-indigo-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resetar conexão/cache — card próprio, cores invertidas (fundo laranja, texto branco)
          pra chamar mais atenção como ação de recuperação/emergência. */}
      <div className={`relative rounded-2xl p-4 border-b-[3px] transition-shadow bg-gradient-to-b from-amber-500 to-amber-600 border-amber-700 shadow-[0_6px_16px_-4px_rgba(217,119,6,0.45)]`}>
        <button
          type="button"
          onClick={handleResetConnection}
          disabled={resetting}
          className={`w-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-60 ${pressBtnCls}`}
        >
          <RotateCcw size={13} className={resetting ? 'animate-spin' : ''} /> {resetting ? 'Resetando...' : 'Resetar conexão e cache (se a impressão falhar)'}
        </button>
      </div>

      {/* Tamanhos de etiqueta */}
      <div className={miniCardCls}>
        <button
          type="button"
          onClick={() => setSizesExpanded(v => !v)}
          className={`w-full flex items-center justify-between gap-2 ${sizesExpanded ? 'mb-3' : ''}`}
        >
          <span className={`${sectionTitleCls} mb-0`}>Tamanho da etiqueta</span>
          <div className="flex items-center gap-2">
            {selectedSize && (
              <span className="text-[10px] font-bold text-indigo-500 truncate max-w-[110px]">{selectedSize.name}</span>
            )}
            {sizesExpanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
          </div>
        </button>

        {sizesExpanded && (
          <>
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => (showAddSize ? handleCancelAddSize() : setShowAddSize(true))}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-500"
              >
                {showAddSize ? <X size={13} /> : <Plus size={13} />} {showAddSize ? 'Cancelar' : 'Cadastrar'}
              </button>
            </div>

            {showAddSize && (
              <div className="flex flex-col gap-2 mb-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">
                  {editingSizeId ? 'Editando tamanho' : 'Nome é opcional — se vazio, usamos as dimensões'}
                </span>
                <input
                  value={newSizeName}
                  onChange={e => setNewSizeName(e.target.value)}
                  placeholder="Nome (ex: Etiqueta de caixa)"
                  className={`px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-white text-slate-900 placeholder:text-slate-400'}`}
                />
                <div className="flex gap-2">
                  <input
                    value={newSizeWidth}
                    onChange={e => setNewSizeWidth(e.target.value)}
                    inputMode="decimal"
                    placeholder="Largura (mm)"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-white text-slate-900 placeholder:text-slate-400'}`}
                  />
                  <input
                    value={newSizeHeight}
                    onChange={e => setNewSizeHeight(e.target.value)}
                    inputMode="decimal"
                    placeholder="Altura (mm)"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-white text-slate-900 placeholder:text-slate-400'}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddSize}
                  disabled={savingSize}
                  className="py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
                >
                  {savingSize ? 'Salvando...' : editingSizeId ? 'Atualizar tamanho' : 'Salvar tamanho'}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {PRESET_SIZES.map(s => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSelectedSize({ ...s })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                    selectedSize?.name === s.name && !selectedSize?.paperSizeId
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : isDarkMode ? 'border-transparent bg-slate-800/50' : 'border-transparent bg-slate-50'
                  }`}
                >
                  <Ruler size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-bold">{s.name}</span>
                </button>
              ))}
              {labelPaperSizes.map(s => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                    selectedSize?.paperSizeId === s.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : isDarkMode ? 'border-transparent bg-slate-800/50' : 'border-transparent bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSize({ name: s.name, widthMm: s.widthMm, heightMm: s.heightMm, paperSizeId: s.id })}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    <Ruler size={13} className="text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold truncate">{s.name} — {s.widthMm}×{s.heightMm}mm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditSize(s)}
                    className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePaperSize(s.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Arquivos */}
      <div className={miniCardCls}>
        <span className={sectionTitleCls}>Arquivo de etiqueta</span>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            disabled={!selectedSize}
            onClick={() => selectedSize && onOpenEditor({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId })}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40 ${pressBtnCls}`}
          >
            <FilePlus size={14} /> Novo arquivo
          </button>
          <button
            type="button"
            disabled={!selectedSize}
            onClick={handleImportFile}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${pressBtnCls} ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <Upload size={14} /> Importar arquivo
          </button>
        </div>

        {labelFiles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {labelFiles.map(f => (
              <div
                key={f.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenEditor({ widthMm: f.widthMm, heightMm: f.heightMm, paperSizeId: f.paperSizeId, existingFile: f })}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <FolderOpen size={13} className="text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold truncate">{f.name}</span>
                  <span className="text-[9px] font-bold text-slate-400 shrink-0">{f.widthMm}×{f.heightMm}mm</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFile(f.id)}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>

      {selectedSize && (
        <PdfPageSelectModal
          isOpen={showPdfPageSelect}
          onClose={() => setShowPdfPageSelect(false)}
          isDarkMode={isDarkMode}
          pages={pdfPagesToSelect}
          widthMm={selectedSize.widthMm}
          heightMm={selectedSize.heightMm}
          onConfirm={handleConfirmPdfPages}
        />
      )}

      {selectedSize && (
        <LabelPrintPreviewModal
          isOpen={showBatchPreview}
          onClose={() => setShowBatchPreview(false)}
          isDarkMode={isDarkMode}
          widthMm={selectedSize.widthMm}
          heightMm={selectedSize.heightMm}
          previewDataUrls={batchFrames.map(f => f.toDataURL('image/png'))}
          totalLabelsNote={batchFrames.length > 1 ? `${batchFrames.length} páginas × cópias` : undefined}
          onConfirmPrint={handleConfirmBatchPrint}
        />
      )}
    </>
  );
}
