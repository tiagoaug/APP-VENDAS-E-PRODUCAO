import { useEffect, useRef, useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  Ruler, Plus, Trash2,
  FilePlus, Upload, FolderOpen, X, ChevronDown, ChevronUp, Pencil, Star,
  RectangleVertical, RectangleHorizontal,
} from 'lucide-react';
import { LabelPaperSize, LabelFile, BatchLabelItem, ProductionLot, ServiceOrder, Sector } from '../types';
import { printAbleMarkLabel2 as printAbleMarkLabel } from '../lib/ablemarkPrinter2';
import { toast } from '../utils/toast';
import { pickLabelImportFile } from '../utils/labelFileImport';
import PdfPageSelectModal, { CropRect, CroppedPage, FitMode } from '../components/PdfPageSelectModal';
import LabelPrintPreviewModal, { PrintOptions } from '../components/LabelPrintPreviewModal';
import PrinterConnectionCard from '../components/PrinterConnectionCard';
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
  // Repassado ao editor sem uso aqui (ver LabelEditorSession.batch) — só transporta o lote de
  // impressão de uma Venda através da escolha de modelo (ver `batchContext` da prop abaixo).
  batchContext?: { items: BatchLabelItem[] };
  // Repassado ao editor sem uso aqui (ver LabelEditorSession.productionContext) — transporta
  // Lote/OS/Setores de uma sessão aberta a partir do PCP através da escolha de modelo.
  productionContext?: { lot?: ProductionLot; os?: ServiceOrder | null; sectors?: Sector[]; sectorId?: string };
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
  // Presente quando esta tela abriu a partir do popup de impressão de uma Venda (modo de
  // teste) — filtra a lista pra só mostrar modelos marcados "Modelo para Vendas"
  // (LabelFile.isSalesTemplate) e repassa o lote pro editor em qualquer caminho (novo, importar
  // ou abrir um já salvo).
  filterSalesTemplates?: boolean;
  batchContext?: { items: BatchLabelItem[] };
}

type SelectedSize = { name: string; widthMm: number; heightMm: number; paperSizeId?: string };

export default function LabelPrintStudioView({
  isDarkMode, labelPaperSizes, labelFiles,
  onAddPaperSize, onEditPaperSize, onDeletePaperSize, onDeleteFile, onOpenEditor,
  filterSalesTemplates, batchContext,
}: LabelPrintStudioViewProps) {
  const visibleLabelFiles = filterSalesTemplates ? labelFiles.filter(f => f.isSalesTemplate) : labelFiles;
  const openEditorWithContext = (params: OpenEditorParams) => onOpenEditor(batchContext ? { ...params, batchContext } : params);

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

  // Orientação da etiqueta selecionada — não é um state à parte (senão desalinha do tamanho
  // escolhido); inverte largura/altura do `selectedSize` atual, então vale tanto pro Novo
  // Arquivo quanto pra Importação de PDF (ambos usam selectedSize.widthMm/heightMm).
  const sizeOrientation: 'portrait' | 'landscape' = selectedSize && selectedSize.widthMm > selectedSize.heightMm ? 'landscape' : 'portrait';
  const setSizeOrientation = (target: 'portrait' | 'landscape') => {
    if (!selectedSize || sizeOrientation === target) return;
    setSelectedSize({ ...selectedSize, widthMm: selectedSize.heightMm, heightMm: selectedSize.widthMm });
  };
  const [sizesExpanded, setSizesExpanded] = useState(false);
  // Fechado por padrão de propósito: conexão de impressora só importa pra quem vai IMPRIMIR de
  // verdade — quem só vai exportar/compartilhar (JPG/PDF) nem precisa abrir. Fechado também
  // evita checar o estado do Bluetooth logo ao abrir a tela (PrinterConnectionCard só monta,
  // e só aí roda a checagem, quando expandido).
  const [printerExpanded, setPrinterExpanded] = useState(false);
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

  const handleImportFile = async () => {
    if (!selectedSize || importingRef.current) return;
    importingRef.current = true;
    try {
      const result = await pickLabelImportFile();
      if (!result) return;
      if (result.kind === 'image') {
        openEditorWithContext({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId, importedImageDataUrl: result.dataUrl });
        return;
      }
      // PDF de 1 página só — abre direto no editor, igual a uma imagem.
      if (result.pages.length === 1) {
        openEditorWithContext({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId, importedImageDataUrl: result.pages[0] });
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
        openEditorWithContext({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId, importedImageDataUrl: croppedDataUrl });
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
    let isFirst = true;
    for (let i = 0; i < batchFrames.length; i++) {
      const transformed = applyPrintTransform(
        batchFrames[i], selectedSize!.widthMm, selectedSize!.heightMm,
        { offsetXmm: options.offsetXmm, offsetYmm: options.offsetYmm, rotationDeg },
        DOTS_PER_MM,
      );
      const base64 = transformed.toDataURL('image/png').split('base64,')[1];
      for (let c = 0; c < options.copies; c++) {
        // Dá tempo da impressora terminar de alimentar/cortar a etiqueta anterior antes de
        // mandar a próxima — sem essa pausa o job seguinte chega enquanto o mecanismo ainda
        // está processando o de antes, e a impressão sai corrompida mesmo com bytes corretos.
        if (!isFirst) await new Promise(resolve => setTimeout(resolve, 2000));
        isFirst = false;
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
  const pressBtnCls = 'active:translate-y-0.5 transition-transform';
  const sectionTitleCls = 'text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3';
  const outerCardCls = `p-3 sm:p-4 rounded-3xl border ${
    isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-gradient-to-br from-slate-100 to-white border-slate-200'
  }`;

  return (
    <>
    <div className={outerCardCls}>
    <div className="flex flex-col gap-4">
      {/* Tamanhos de etiqueta */}
      <div className={miniCardCls}>
        <button
          type="button"
          onClick={() => setSizesExpanded(v => !v)}
          data-guide-anchor="labelPrintStudio.expandirTamanhos"
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
                data-guide-anchor="labelPrintStudio.abrirCadastroTamanho"
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
                  data-guide-anchor="labelPrintStudio.salvarTamanho"
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
                    data-guide-anchor="labelPrintStudio.marcarPreferido"
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
                      data-guide-anchor="labelPrintStudio.selecionarTamanho"
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
                          data-guide-anchor="labelPrintStudio.editarTamanho"
                          className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePaperSize(row.custom!.id)}
                          data-guide-anchor="labelPrintStudio.excluirTamanho"
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

      {/* Orientação — inverte largura/altura do tamanho selecionado acima; vale tanto pro Novo
          Arquivo quanto pra Importação de PDF logo abaixo (ambos usam selectedSize). */}
      <div className={miniCardCls}>
        <span className={sectionTitleCls}>Orientação da etiqueta</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!selectedSize}
            onClick={() => setSizeOrientation('portrait')}
            data-guide-anchor="labelPrintStudio.orientacaoRetrato"
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${pressBtnCls} ${
              sizeOrientation === 'portrait' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <RectangleVertical size={14} /> Retrato
          </button>
          <button
            type="button"
            disabled={!selectedSize}
            onClick={() => setSizeOrientation('landscape')}
            data-guide-anchor="labelPrintStudio.orientacaoPaisagem"
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${pressBtnCls} ${
              sizeOrientation === 'landscape' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <RectangleHorizontal size={14} /> Paisagem
          </button>
        </div>
        {selectedSize && (
          <p className="text-[9px] font-bold text-slate-400 mt-2 text-center">{selectedSize.widthMm} × {selectedSize.heightMm} mm</p>
        )}
      </div>

      {/* Arquivos */}
      <div className={miniCardCls}>
        <span className={sectionTitleCls}>{filterSalesTemplates ? 'Modelo de etiqueta (Vendas)' : 'Arquivo de etiqueta'}</span>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            disabled={!selectedSize}
            onClick={() => selectedSize && openEditorWithContext({ widthMm: selectedSize.widthMm, heightMm: selectedSize.heightMm, paperSizeId: selectedSize.paperSizeId })}
            data-guide-anchor="labelPrintStudio.novoArquivo"
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40 ${pressBtnCls}`}
          >
            <FilePlus size={14} /> Novo arquivo
          </button>
          <button
            type="button"
            disabled={!selectedSize}
            onClick={handleImportFile}
            data-guide-anchor="labelPrintStudio.importarArquivo"
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${pressBtnCls} ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <Upload size={14} /> Importar arquivo
          </button>
        </div>

        {filterSalesTemplates && visibleLabelFiles.length === 0 && (
          <p className="text-[10px] font-bold text-slate-400 text-center py-2">
            Nenhum modelo de Vendas ainda — crie um novo e marque "Modelo para Vendas" ao salvar.
          </p>
        )}

        {visibleLabelFiles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {visibleLabelFiles.map(f => (
              <div
                key={f.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}
              >
                <button
                  type="button"
                  onClick={() => openEditorWithContext({ widthMm: f.widthMm, heightMm: f.heightMm, paperSizeId: f.paperSizeId, existingFile: f })}
                  data-guide-anchor="labelPrintStudio.abrirArquivo"
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <FolderOpen size={13} className="text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold truncate">{f.name}</span>
                  <span className="text-[9px] font-bold text-slate-400 shrink-0">{f.widthMm}×{f.heightMm}mm</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFile(f.id)}
                  data-guide-anchor="labelPrintStudio.excluirArquivo"
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conexão de impressora — deixada pro final de propósito: só importa pra quem vai
          IMPRIMIR de verdade (quem só vai exportar/compartilhar JPG/PDF nem precisa abrir).
          Fechada por padrão também evita checar o Bluetooth logo ao abrir a tela — o
          PrinterConnectionCard só monta (e só aí roda essa checagem) quando expandido. */}
      <button
        type="button"
        onClick={() => setPrinterExpanded(v => !v)}
        data-guide-anchor="labelPrintStudio.expandirImpressora"
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
      >
        <span className="text-[10px] font-black uppercase tracking-widest">Configurar Impressora (só se for imprimir)</span>
        {printerExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {printerExpanded && <PrinterConnectionCard isDarkMode={isDarkMode} />}
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
