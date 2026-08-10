import { useEffect, useRef, useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  Bluetooth, CheckCircle2, XCircle, RefreshCw, Ruler, Plus, Trash2,
  FilePlus, Upload, FolderOpen, X, ChevronDown, ChevronUp, RotateCcw, Pencil, Star,
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
import PdfPageSelectModal, { CropRect, CroppedPage, FitMode } from '../components/PdfPageSelectModal';
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

/** Recorta uma página segundo `crop` (frações 0..1, mesmo recorte relativo aplicado a todas as
 * páginas do lote) e desenha essa região dentro da etiqueta widthMm×heightMm segundo `fitMode`:
 * "contain" encaixa a região inteira dentro da etiqueta (pode sobrar borda branca se a
 * proporção não bater), "cover" preenche a etiqueta inteira sem borda (corta um pouco além do
 * recorte se precisar) — nos dois casos SEM distorcer; antes disso sempre esticava pra
 * preencher exatamente, deformando o conteúdo quando a proporção do recorte não batia com a
 * da etiqueta (foi isso que fazia o conteúdo real da etiqueta parecer "pequeno demais"). */
async function renderPageToLabelCanvas(pageDataUrl: string, widthMm: number, heightMm: number, crop: CropRect, fitMode: FitMode): Promise<HTMLCanvasElement> {
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

  // Escala pra encaixar (contain, min) ou preencher (cover, max) sem distorcer — igual ao
  // CSS object-fit — e centraliza o resultado na etiqueta.
  const scale = fitMode === 'contain' ? Math.min(pxW / sw, pxH / sh) : Math.max(pxW / sw, pxH / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (pxW - dw) / 2;
  const dy = (pxH - dh) / 2;
  ctx.save();
  if (fitMode === 'cover') {
    // "cover" pode extrapolar a etiqueta — recorta o excesso pra não desenhar fora do canvas.
    ctx.beginPath();
    ctx.rect(0, 0, pxW, pxH);
    ctx.clip();
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
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

// Tamanho "preferido" — pré-selecionado sempre que a tela abre, em vez do primeiro preset da
// lista. É uma preferência do aparelho (não do catálogo compartilhado via Firestore), então
// fica salva local no dispositivo: cada operador/impressora pode ter uma etiqueta diferente
// como a mais usada no dia a dia.
const PREFERRED_SIZE_KEY = 'labelPreferredSize';
interface PreferredSizeRef { kind: 'preset' | 'custom'; key: string; }
function readPreferredSize(): PreferredSizeRef | null {
  try {
    const raw = localStorage.getItem(PREFERRED_SIZE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writePreferredSize(p: PreferredSizeRef | null) {
  try {
    if (p) localStorage.setItem(PREFERRED_SIZE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PREFERRED_SIZE_KEY);
  } catch {
    /* localStorage indisponível — preferência simplesmente não persiste, sem quebrar a tela */
  }
}

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

  const [preferredSize, setPreferredSizeState] = useState<PreferredSizeRef | null>(() => readPreferredSize());
  // Se o preferido é um preset, já resolve de cara (PRESET_SIZES é uma constante). Se for um
  // tamanho cadastrado (Firestore), ainda não dá — `labelPaperSizes` só chega depois via prop —
  // então cai no primeiro preset por enquanto, e o efeito abaixo troca assim que os dados chegarem.
  const [selectedSize, setSelectedSize] = useState<SelectedSize | null>(() => {
    const pref = readPreferredSize();
    if (pref?.kind === 'preset') {
      const p = PRESET_SIZES.find(s => s.name === pref.key);
      if (p) return { ...p };
    }
    return PRESET_SIZES[0] ? { ...PRESET_SIZES[0] } : null;
  });
  // Garante que a resolução do preferido "custom" (Firestore) só troca a seleção UMA vez,
  // assim que os dados chegarem — depois disso, o usuário pode escolher outro tamanho
  // livremente sem a preferência salva ficar "puxando" de volta a cada re-render.
  const appliedCustomPreferredRef = useRef(false);
  useEffect(() => {
    if (appliedCustomPreferredRef.current) return;
    if (preferredSize?.kind !== 'custom') {
      appliedCustomPreferredRef.current = true;
      return;
    }
    const match = labelPaperSizes.find(s => s.id === preferredSize.key);
    if (match) {
      setSelectedSize({ name: match.name, widthMm: match.widthMm, heightMm: match.heightMm, paperSizeId: match.id });
      appliedCustomPreferredRef.current = true;
    }
  }, [preferredSize, labelPaperSizes]);

  const togglePreferredSize = (kind: 'preset' | 'custom', key: string) => {
    setPreferredSizeState(prev => {
      const next: PreferredSizeRef | null = (prev?.kind === kind && prev.key === key) ? null : { kind, key };
      writePreferredSize(next);
      return next;
    });
  };
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
      const frames = await Promise.all(items.map(it => renderPageToLabelCanvas(it.dataUrl, selectedSize.widthMm, selectedSize.heightMm, it.crop, it.fitMode)));
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

  // Lista única (presets + cadastrados) pra poder ordenar com o preferido sempre no topo,
  // independente de ser preset ou cadastrado — "sempre mostrada preferencialmente".
  type SizeRow = { kind: 'preset' | 'custom'; key: string; name: string; widthMm: number; heightMm: number; custom?: LabelPaperSize };
  const sizeRows: SizeRow[] = [
    ...PRESET_SIZES.map(s => ({ kind: 'preset' as const, key: s.name, name: s.name, widthMm: s.widthMm, heightMm: s.heightMm })),
    ...labelPaperSizes.map(s => ({ kind: 'custom' as const, key: s.id, name: s.name, widthMm: s.widthMm, heightMm: s.heightMm, custom: s })),
  ].sort((a, b) => {
    const aPref = preferredSize?.kind === a.kind && preferredSize.key === a.key ? 0 : 1;
    const bPref = preferredSize?.kind === b.kind && preferredSize.key === b.key ? 0 : 1;
    return aPref - bPref;
  });

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

        {/* Resetar conexão/cache — dentro do card da impressora (ação relacionada), laranja
            claro chapado (sem o relevo 3D dos outros minicards) pra não competir visualmente
            com o status de conexão acima, mas ainda se destacar como ação de recuperação. */}
        <button
          type="button"
          onClick={handleResetConnection}
          disabled={resetting}
          className="w-full flex items-center justify-center gap-1.5 mt-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-amber-400 hover:bg-amber-500 disabled:opacity-60 transition-colors"
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
              {sizeRows.map(row => {
                const isPreferred = preferredSize?.kind === row.kind && preferredSize.key === row.key;
                const isActive = row.kind === 'preset'
                  ? selectedSize?.name === row.name && !selectedSize?.paperSizeId
                  : selectedSize?.paperSizeId === row.key;
                const starBtn = (
                  <button
                    type="button"
                    onClick={() => togglePreferredSize(row.kind, row.key)}
                    title={isPreferred ? 'Remover como preferida' : 'Marcar como preferida (pré-selecionada sempre)'}
                    className={`p-1.5 rounded-lg shrink-0 ${isPreferred ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'}`}
                  >
                    <Star size={14} fill={isPreferred ? 'currentColor' : 'none'} />
                  </button>
                );
                return (
                  <div
                    key={`${row.kind}_${row.key}`}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border-2 transition-all ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : isDarkMode ? 'border-transparent bg-slate-800/50' : 'border-transparent bg-slate-50'
                    }`}
                  >
                    {starBtn}
                    <button
                      type="button"
                      onClick={() => (row.kind === 'preset'
                        ? setSelectedSize({ name: row.name, widthMm: row.widthMm, heightMm: row.heightMm })
                        : setSelectedSize({ name: row.name, widthMm: row.widthMm, heightMm: row.heightMm, paperSizeId: row.key }))}
                      className="flex-1 flex items-center gap-2 text-left min-w-0 px-1 py-0.5"
                    >
                      <Ruler size={13} className={`shrink-0 ${row.kind === 'custom' ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold truncate">
                        {row.kind === 'custom' ? `${row.name} — ${row.widthMm}×${row.heightMm}mm` : row.name}
                      </span>
                    </button>
                    {row.kind === 'custom' && row.custom && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEditSize(row.custom!)}
                          className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePaperSize(row.custom!.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
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
          onBackToEdit={pdfPagesToSelect.length > 0 ? () => setShowPdfPageSelect(true) : undefined}
          onConfirmPrint={handleConfirmBatchPrint}
        />
      )}
    </>
  );
}
