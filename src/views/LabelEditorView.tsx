import { useEffect, useRef, useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { toDottedQRDataURL } from '../utils/dottedQRCode';
import {
  Type, ImagePlus, QrCode, Calendar, Minus, Square, Trash2, Copy, Save, Printer,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Plus, Check, X, ZoomIn, ZoomOut,
  RotateCwSquare, Contrast, Crop as CropIcon, Download,
} from 'lucide-react';
import { LabelElement } from '../types';
import { printAbleMarkLabel } from '../lib/ablemarkPrinter';
import { saveImageToGallery, isGallerySaverPlatform } from '../lib/gallerySaver';
import { toast } from '../utils/toast';
import LabelPrintPreviewModal, { PrintOptions } from '../components/LabelPrintPreviewModal';
import ImageSourcePickerModal from '../components/ImageSourcePickerModal';
import Modal from '../components/Modal';
import CropEditor, { CropRect, FULL_CROP, CENTER_CROP, cropEquals, cropImageToDataUrl } from '../components/CropEditor';
import { DIRECTION_TO_ROTATION } from '../utils/labelPrintTransform';

// Densidade padrão de impressoras térmicas de etiqueta (203 dpi ≈ 8 pontos/mm) — não há uma
// folha de especificação da BR-L100 documentando isso, mas é o padrão quase universal do
// mercado; ajustável aqui se uma impressão real sair com proporção errada.
const DOTS_PER_MM = 8;
const BASE_PX_WIDTH = 300; // largura de referência do canvas em zoom 1.0x

export interface LabelEditorSession {
  widthMm: number;
  heightMm: number;
  paperSizeId?: string;
  fileId?: string;
  name?: string;
  elements?: LabelElement[];
  importedImageDataUrl?: string;
}

interface LabelEditorViewProps {
  isDarkMode: boolean;
  session: LabelEditorSession;
  onSave: (
    data: { name: string; widthMm: number; heightMm: number; paperSizeId?: string; elements: LabelElement[] },
    fileId?: string,
  ) => Promise<void>;
}

function newId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function wrapDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Mesmo conjunto de fontes do editor de etiqueta de produto (PrintLabelEditorModal) — só
// famílias "seguras" pro Canvas 2D/CSS do WebView (nada de fonte customizada/embutida).
const FONT_OPTIONS: { value: NonNullable<LabelElement['fontFamily']>; label: string; css: string }[] = [
  { value: 'helvetica', label: 'Sans',  css: 'Helvetica, Arial, sans-serif' },
  { value: 'arial',     label: 'Arial', css: 'Arial, sans-serif' },
  { value: 'times',     label: 'Serif', css: 'Georgia, serif' },
  { value: 'courier',   label: 'Mono',  css: 'monospace' },
  { value: 'avenir',    label: 'Geo',   css: '"Century Gothic","Trebuchet MS",sans-serif' },
];
function cssFontFamily(f?: LabelElement['fontFamily']): string {
  return FONT_OPTIONS.find(o => o.value === f)?.css || FONT_OPTIONS[0].css;
}

function initialElements(session: LabelEditorSession): LabelElement[] {
  if (session.elements) return session.elements;
  if (session.importedImageDataUrl) {
    return [{
      id: newId(), type: 'image', x: 0, y: 0, w: session.widthMm, h: session.heightMm,
      rotation: 0, imageDataUrl: session.importedImageDataUrl,
    }];
  }
  return [];
}

// 'resize' = alça do canto (redimensiona largura E altura juntas, como já era). As quatro
// variantes de borda redimensionam só um eixo — 'resize-left'/'resize-top' também deslocam
// x/y pra manter a borda oposta fixa (senão o elemento "puxaria" pro lado errado).
type DragMode = 'move' | 'resize' | 'resize-right' | 'resize-bottom' | 'resize-left' | 'resize-top' | 'rotate';
interface DragState {
  mode: DragMode;
  id: string;
  pointerId: number;
  pxPerMmX: number;
  pxPerMmY: number;
  startX: number; // mm
  startY: number;
  startW: number;
  startH: number;
  startRotation: number;
  startPointerX: number; // px
  startPointerY: number;
  centerX: number; // px, tela — só usado no rotate
  centerY: number;
}

type TextTab = 'content' | 'style' | 'font';

export default function LabelEditorView({ isDarkMode, session, onSave }: LabelEditorViewProps) {
  // Largura/altura viram estado local (não só o valor fixo da session) pra permitir girar a
  // área da etiqueta (trocar entre paisagem/retrato) sem precisar sair e recriar a sessão —
  // os elementos existentes mantêm as coordenadas em mm, só a área ao redor muda de forma.
  const [widthMm, setWidthMm] = useState(session.widthMm);
  const [heightMm, setHeightMm] = useState(session.heightMm);
  const [elements, setElements] = useState<LabelElement[]>(() => initialElements(session));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(session.name || 'Nova etiqueta');
  const [addingQr, setAddingQr] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingGallery, setSavingGallery] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showImageSourcePicker, setShowImageSourcePicker] = useState(false);
  // Recorte de uma imagem já adicionada ao editor — corta e "assa" a região recortada de vez
  // no imageDataUrl do elemento (não é um crop-por-referência tipo o do import de PDF; aqui é
  // só uma imagem solta, então recortar já substitui o arquivo direto).
  const [showImageCrop, setShowImageCrop] = useState(false);
  const [imageCropRect, setImageCropRect] = useState<CropRect>(FULL_CROP);
  const [croppingImage, setCroppingImage] = useState(false);
  const [printPreviewImage, setPrintPreviewImage] = useState('');
  const [zoom, setZoom] = useState(1);
  const [textTab, setTextTab] = useState<TextTab>('content');
  // Texto livre do campo de ângulo — separado de `selected.rotation` de propósito: um input
  // numérico controlado direto pelo valor do elemento trava ao apagar tudo (parseInt("") vira
  // NaN, a atualização é ignorada, e o campo volta pro valor antigo no meio da digitação).
  // Aqui só sincroniza de volta quando a rotação muda por outra via (slider, alça, +/-) ou ao
  // trocar de elemento — nunca no meio de uma edição de texto inválida/vazia.
  const [angleInput, setAngleInput] = useState('0');
  const [rotationStep, setRotationStep] = useState(5);
  const printingRef = useRef(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const selected = elements.find(e => e.id === selectedId) || null;

  useEffect(() => {
    if (selected) setAngleInput(String(Math.round(selected.rotation)));
  }, [selectedId, selected?.rotation]);
  // Escala "encaixar na tela": zoom 1.0x sempre cabe inteiro na largura/altura disponíveis
  // (importante depois de girar a área — uma etiqueta 24×75mm não pode usar a mesma largura
  // de referência que uma 75×24mm, senão fica cortada por baixo). zoom continua ajustável a
  // partir desse encaixe.
  const maxCanvasHeightPx = typeof window !== 'undefined' ? window.innerHeight * 0.4 : BASE_PX_WIDTH;
  const fitScale = Math.min(BASE_PX_WIDTH / widthMm, maxCanvasHeightPx / heightMm);
  const canvasWidthPx = fitScale * widthMm * zoom;
  const canvasHeightPx = fitScale * heightMm * zoom;
  const pxPerMmX = canvasWidthPx / widthMm;
  const pxPerMmY = canvasHeightPx / heightMm;

  const updateElement = (id: string, patch: Partial<LabelElement>) => {
    setElements(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));
  };

  const addElement = (el: LabelElement) => {
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
    setTextTab('content');
  };

  const handleAddText = () => {
    addElement({
      id: newId(), type: 'text', x: widthMm * 0.1, y: heightMm * 0.35, w: widthMm * 0.8, h: heightMm * 0.3,
      rotation: 0, text: 'Texto', fontSize: 4, bold: false, align: 'center', lineHeight: 1,
    });
  };

  const handleAddDate = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    addElement({
      id: newId(), type: 'text', x: widthMm * 0.1, y: heightMm * 0.4, w: widthMm * 0.8, h: heightMm * 0.2,
      rotation: 0, text: today, fontSize: 3, bold: false, align: 'center', lineHeight: 1,
    });
  };

  const handleAddLine = () => {
    addElement({
      id: newId(), type: 'line', x: widthMm * 0.1, y: heightMm * 0.5, w: widthMm * 0.8, h: Math.max(0.3, heightMm * 0.02),
      rotation: 0,
    });
  };

  const handleAddShape = () => {
    addElement({
      id: newId(), type: 'shape', x: widthMm * 0.2, y: heightMm * 0.2, w: widthMm * 0.6, h: heightMm * 0.6,
      rotation: 0,
    });
  };

  const pickImage = async (source: CameraSource) => {
    try {
      const photo = await Camera.getPhoto({ source, resultType: CameraResultType.DataUrl, quality: 85 });
      if (photo.dataUrl) {
        addElement({
          id: newId(), type: 'image', x: widthMm * 0.2, y: widthMm * 0.2, w: widthMm * 0.6, h: widthMm * 0.6,
          rotation: 0, imageDataUrl: photo.dataUrl,
        });
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (!/cancel/i.test(msg)) toast.show('Erro ao selecionar imagem: ' + msg);
    }
  };

  const handleConfirmQr = async () => {
    if (!qrValue.trim()) return;
    try {
      const dataUrl = await toDottedQRDataURL(qrValue.trim(), { margin: 1, width: 800 });
      const side = Math.min(widthMm, heightMm) * 0.6;
      addElement({
        id: newId(), type: 'qr', x: widthMm * 0.2, y: heightMm * 0.2, w: side, h: side,
        rotation: 0, qrValue: qrValue.trim(), imageDataUrl: dataUrl,
      });
      setQrValue('');
      setAddingQr(false);
    } catch (err: any) {
      toast.show('Erro ao gerar QR code: ' + (err?.message || err));
    }
  };

  const handleDuplicateSelected = () => {
    if (!selected) return;
    const copy: LabelElement = {
      ...selected,
      id: newId(),
      x: Math.min(widthMm - selected.w, selected.x + 3),
      y: Math.min(heightMm - selected.h, selected.y + 3),
    };
    setElements(prev => [...prev, copy]);
    setSelectedId(copy.id);
  };

  // Gira a área da etiqueta inteira 90° (troca largura por altura) — paisagem ↔ retrato.
  // Elementos mantêm x/y/w/h em mm; se ficarem fora da nova área, o usuário reposiciona.
  const handleRotateCanvas = () => {
    setWidthMm(heightMm);
    setHeightMm(widthMm);
    setSelectedId(null);
    setZoom(1);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    setElements(prev => prev.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  const handleOpenImageCrop = () => {
    if (!selected?.imageDataUrl) return;
    setImageCropRect(FULL_CROP);
    setShowImageCrop(true);
  };

  const handleApplyImageCrop = async () => {
    if (!selected?.imageDataUrl) return;
    setCroppingImage(true);
    try {
      const cropped = await cropImageToDataUrl(selected.imageDataUrl, imageCropRect);
      updateElement(selected.id, { imageDataUrl: cropped });
      setShowImageCrop(false);
    } catch (err: any) {
      toast.show('Erro ao recortar imagem: ' + (err?.message || err));
    } finally {
      setCroppingImage(false);
    }
  };

  // ─── Arrastar/redimensionar/rotacionar por ponteiro ──────────────────────────
  const beginDrag = (e: React.PointerEvent, id: string, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    const el = elements.find(x => x.id === id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!el || !rect) return;
    setSelectedId(id);
    const centerX = rect.left + (el.x + el.w / 2) * pxPerMmX;
    const centerY = rect.top + (el.y + el.h / 2) * pxPerMmY;
    dragRef.current = {
      mode, id, pointerId: e.pointerId, pxPerMmX, pxPerMmY,
      startX: el.x, startY: el.y, startW: el.w, startH: el.h, startRotation: el.rotation,
      startPointerX: e.clientX, startPointerY: e.clientY, centerX, centerY,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dxPx = e.clientX - drag.startPointerX;
    const dyPx = e.clientY - drag.startPointerY;

    if (drag.mode === 'move') {
      // Sem trava nos limites da folha de propósito: pra um elemento rotacionado 90/270°, a
      // caixa armazenada (x/y/w/h, não rotacionada) não bate com o retângulo visual na tela
      // (que gira em torno do centro), então travar em [0, larguraMm-w] usava a largura
      // ERRADA e criava uma "parede invisível" bem antes do que o usuário via na tela. Deixar
      // arrastar livre (inclusive um pouco pra fora da folha) resolve pra qualquer rotação.
      const dxMm = dxPx / drag.pxPerMmX;
      const dyMm = dyPx / drag.pxPerMmY;
      updateElement(drag.id, {
        x: drag.startX + dxMm,
        y: drag.startY + dyMm,
      });
    } else if (drag.mode.startsWith('resize')) {
      // Desfaz a rotação do elemento no vetor de deslocamento do ponteiro, pra redimensionar
      // no referencial local do elemento (senão arrastar o handle de um elemento rotacionado
      // muda w/h na direção errada).
      const rad = (-drag.startRotation * Math.PI) / 180;
      const localDx = dxPx * Math.cos(rad) - dyPx * Math.sin(rad);
      const localDy = dxPx * Math.sin(rad) + dyPx * Math.cos(rad);
      const patch: Partial<LabelElement> = {};

      if (drag.mode === 'resize' || drag.mode === 'resize-right') {
        patch.w = Math.max(3, drag.startW + localDx / drag.pxPerMmX);
      }
      if (drag.mode === 'resize' || drag.mode === 'resize-bottom') {
        patch.h = Math.max(3, drag.startH + localDy / drag.pxPerMmY);
      }
      if (drag.mode === 'resize-left') {
        // Borda esquerda: encolhe/cresce a largura a partir do lado esquerdo, deslocando x
        // pra manter a borda direita no lugar (senão o elemento inteiro "andaria" com o handle).
        const newW = Math.max(3, drag.startW - localDx / drag.pxPerMmX);
        patch.w = newW;
        patch.x = drag.startX + (drag.startW - newW);
      }
      if (drag.mode === 'resize-top') {
        const newH = Math.max(3, drag.startH - localDy / drag.pxPerMmY);
        patch.h = newH;
        patch.y = drag.startY + (drag.startH - newH);
      }
      updateElement(drag.id, patch);
    } else if (drag.mode === 'rotate') {
      const angleRad = Math.atan2(e.clientY - drag.centerY, e.clientX - drag.centerX);
      // 0° de rotação = handle apontando pra cima (referencial do handle, ver renderização
      // abaixo) — atan2 mede a partir do eixo +X, então soma 90° pra alinhar com "pra cima".
      const angleDeg = (angleRad * 180) / Math.PI + 90;
      updateElement(drag.id, { rotation: Math.round(angleDeg) });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  // ─── Salvar / Imprimir ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim() || 'Etiqueta', widthMm, heightMm, paperSizeId: session.paperSizeId, elements }, session.fileId);
      toast.show('Etiqueta salva!');
    } catch (err: any) {
      toast.show('Erro ao salvar etiqueta: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const renderToCanvas = async (printOptions: { offsetXmm: number; offsetYmm: number; rotationDeg: number }): Promise<HTMLCanvasElement> => {
    // "Direção de saída" gira a etiqueta inteira (0/90/180/270°) antes de comprimir — pra
    // 90°/270° a etiqueta impressa fica deitada, então o canvas físico troca largura/altura.
    const rotated90 = printOptions.rotationDeg === 90 || printOptions.rotationDeg === 270;
    const pxW = Math.max(1, Math.round((rotated90 ? heightMm : widthMm) * DOTS_PER_MM));
    const pxH = Math.max(1, Math.round((rotated90 ? widthMm : heightMm) * DOTS_PER_MM));
    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pxW, pxH);

    // Transformação global: centraliza, gira pela direção de saída, desfaz a centralização
    // (agora no sistema de coordenadas girado) e aplica o deslocamento vertical/horizontal —
    // tudo isso antes de desenhar cada elemento na sua posição normal (não rotacionada).
    ctx.translate(pxW / 2, pxH / 2);
    ctx.rotate((printOptions.rotationDeg * Math.PI) / 180);
    ctx.translate(-widthMm * DOTS_PER_MM / 2 + printOptions.offsetXmm * DOTS_PER_MM, -heightMm * DOTS_PER_MM / 2 + printOptions.offsetYmm * DOTS_PER_MM);

    for (const el of elements) {
      const wPx = el.w * DOTS_PER_MM;
      const hPx = el.h * DOTS_PER_MM;
      const cx = (el.x + el.w / 2) * DOTS_PER_MM;
      const cy = (el.y + el.h / 2) * DOTS_PER_MM;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);

      if (el.type === 'text') {
        const fontPx = Math.max(6, (el.fontSize || 4) * DOTS_PER_MM);
        const lineHeight = (el.lineHeight || 1) * fontPx * 1.15;
        ctx.fillStyle = '#000000';
        ctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${fontPx}px ${cssFontFamily(el.fontFamily)}`;
        try { (ctx as any).letterSpacing = `${el.letterSpacing || 0}px`; } catch { /* não suportado, ignora */ }
        ctx.textAlign = el.align === 'left' ? 'left' : el.align === 'right' ? 'right' : 'center';
        ctx.textBaseline = 'middle';
        const xOff = el.align === 'left' ? -wPx / 2 : el.align === 'right' ? wPx / 2 : 0;
        const lines = (el.text || '').split('\n');
        const totalH = lines.length * lineHeight;
        lines.forEach((line, i) => {
          const yOff = -totalH / 2 + lineHeight * (i + 0.5);
          ctx.fillText(line, xOff, yOff, wPx);
          if (el.underline) {
            const width = ctx.measureText(line).width;
            const underlineX = el.align === 'left' ? xOff : el.align === 'right' ? xOff - width : xOff - width / 2;
            ctx.fillRect(underlineX, yOff + fontPx * 0.35, width, Math.max(1, fontPx * 0.06));
          }
        });
      } else if (el.type === 'line') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
      } else if (el.type === 'shape') {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, DOTS_PER_MM * 0.25);
        ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
      } else if (el.imageDataUrl) {
        const img = await loadImage(el.imageDataUrl);
        ctx.filter = el.grayscale ? 'grayscale(1)' : 'none';
        ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx);
      }
      ctx.restore();
    }
    return canvas;
  };

  const handlePrint = async (options: PrintOptions) => {
    if (printingRef.current) return;
    printingRef.current = true;
    try {
      const canvas = await renderToCanvas({
        offsetXmm: options.offsetXmm, offsetYmm: options.offsetYmm, rotationDeg: DIRECTION_TO_ROTATION[options.direction],
      });
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split('base64,')[1];
      for (let i = 0; i < options.copies; i++) {
        // Dá tempo da impressora terminar de alimentar/cortar a cópia anterior antes de mandar
        // a próxima — sem essa pausa o job seguinte chega enquanto o mecanismo ainda está
        // processando o de antes, e a impressão sai corrompida mesmo com bytes corretos.
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 2000));
        const written = await Filesystem.writeFile({ path: `label_${Date.now()}_${i}.png`, data: base64, directory: Directory.Cache });
        const { sent, error } = await printAbleMarkLabel(written.uri, options.paperType, options.density);
        if (!sent) {
          toast.show(`Falha ao imprimir cópia ${i + 1}/${options.copies}: ${error || '(sem detalhe)'}`);
          return;
        }
      }
      toast.show(options.copies > 1 ? `${options.copies} cópias enviadas para a impressora!` : 'Enviado para a impressora!');
    } catch (err: any) {
      toast.show('Erro ao imprimir: ' + (err?.message || err));
    } finally {
      printingRef.current = false;
    }
  };

  const btnCls = (active?: boolean) =>
    `flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  const tickStepMm = widthMm > 60 ? 10 : 5;
  const ticksX: number[] = [];
  for (let mm = 0; mm <= widthMm; mm += tickStepMm) ticksX.push(mm);
  const ticksY: number[] = [];
  for (let mm = 0; mm <= heightMm; mm += tickStepMm) ticksY.push(mm);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome do arquivo"
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-black outline-none ${isDarkMode ? 'bg-slate-900 text-white border border-slate-800' : 'bg-white text-slate-900 border border-slate-100 shadow-sm'}`}
        />
        <button
          type="button"
          onClick={handleRotateCanvas}
          title="Girar área da etiqueta"
          className={`px-3 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-900 text-slate-300 border border-slate-800' : 'bg-white text-slate-600 border border-slate-100 shadow-sm'}`}
        >
          <RotateCwSquare size={16} />
        </button>
      </div>

      {/* Controle de zoom */}
      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] font-black text-slate-400 w-10 text-center">{zoom.toFixed(2)}x</span>
        <button type="button" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <ZoomIn size={14} />
        </button>
      </div>

      {/* Área da etiqueta, com régua em mm */}
      <div className="overflow-auto pb-2">
        <div className="inline-flex flex-col mx-auto" style={{ minWidth: canvasWidthPx + 22 }}>
          <div className="flex">
            <div style={{ width: 22 }} />
            <div className="relative h-4" style={{ width: canvasWidthPx }}>
              {ticksX.map(mm => (
                <div key={mm} className="absolute top-0 flex flex-col items-center" style={{ left: `${(mm / widthMm) * 100}%` }}>
                  <div className="w-px h-2 bg-slate-300 dark:bg-slate-600" />
                  <span className="text-[7px] font-bold text-slate-400 leading-none">{mm}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex">
            <div className="relative shrink-0" style={{ width: 22, height: canvasHeightPx }}>
              {ticksY.map(mm => (
                <div key={mm} className="absolute left-0 flex items-center gap-0.5" style={{ top: `${(mm / heightMm) * 100}%` }}>
                  <span className="text-[7px] font-bold text-slate-400 leading-none">{mm}</span>
                  <div className="w-2 h-px bg-slate-300 dark:bg-slate-600" />
                </div>
              ))}
            </div>
            <div
              ref={canvasRef}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={() => setSelectedId(null)}
              className="relative bg-white rounded-lg border-2 border-dashed border-slate-300 touch-none select-none shrink-0"
              style={{ width: canvasWidthPx, height: canvasHeightPx }}
            >
              {elements.map(el => (
                <div
                  key={el.id}
                  onPointerDown={e => beginDrag(e, el.id, 'move')}
                  onClick={e => { e.stopPropagation(); setSelectedId(el.id); setTextTab('content'); }}
                  className={`absolute flex items-center justify-center ${selectedId === el.id ? 'outline outline-2 outline-indigo-500' : ''}`}
                  style={{
                    left: el.x * pxPerMmX,
                    top: el.y * pxPerMmY,
                    width: el.w * pxPerMmX,
                    height: el.h * pxPerMmY,
                    transform: `rotate(${el.rotation}deg)`,
                    cursor: 'move',
                  }}
                >
                  {el.type === 'text' ? (
                    <span
                      className="pointer-events-none text-black whitespace-pre-wrap break-words w-full"
                      style={{
                        fontSize: (el.fontSize || 4) * pxPerMmX,
                        fontFamily: cssFontFamily(el.fontFamily),
                        fontWeight: el.bold ? 900 : 400,
                        fontStyle: el.italic ? 'italic' : 'normal',
                        textDecoration: el.underline ? 'underline' : 'none',
                        textAlign: el.align || 'center',
                        letterSpacing: `${el.letterSpacing || 0}px`,
                        lineHeight: el.lineHeight || 1,
                      }}
                    >
                      {el.text}
                    </span>
                  ) : el.type === 'line' ? (
                    <div className="w-full h-full bg-black pointer-events-none" />
                  ) : el.type === 'shape' ? (
                    <div className="w-full h-full border-2 border-black pointer-events-none" />
                  ) : el.imageDataUrl ? (
                    <img
                      src={el.imageDataUrl}
                      alt=""
                      className="w-full h-full object-contain pointer-events-none"
                      style={{ filter: el.grayscale ? 'grayscale(1)' : 'none' }}
                      draggable={false}
                    />
                  ) : null}

                  {selectedId === el.id && (
                    <>
                      {/* Canto — redimensiona largura e altura juntas */}
                      <div
                        onPointerDown={e => beginDrag(e, el.id, 'resize')}
                        className="absolute -right-2 -bottom-2 w-4 h-4 rounded-sm bg-indigo-500 border-2 border-white cursor-nwse-resize z-10"
                      />
                      {/* Bordas — redimensionam só um eixo (escalar/esticar independente) */}
                      <div
                        onPointerDown={e => beginDrag(e, el.id, 'resize-right')}
                        className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-6 rounded-full bg-indigo-500 border-2 border-white cursor-ew-resize"
                      />
                      <div
                        onPointerDown={e => beginDrag(e, el.id, 'resize-left')}
                        className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-6 rounded-full bg-indigo-500 border-2 border-white cursor-ew-resize"
                      />
                      <div
                        onPointerDown={e => beginDrag(e, el.id, 'resize-bottom')}
                        className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 h-3 w-6 rounded-full bg-indigo-500 border-2 border-white cursor-ns-resize"
                      />
                      <div
                        onPointerDown={e => beginDrag(e, el.id, 'resize-top')}
                        className="absolute top-[-6px] left-1/2 -translate-x-1/2 h-3 w-6 rounded-full bg-indigo-500 border-2 border-white cursor-ns-resize"
                      />
                      <div
                        onPointerDown={e => beginDrag(e, el.id, 'rotate')}
                        className="absolute left-1/2 -top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white cursor-grab"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Painel do elemento selecionado */}
      {selected && (
        <div className={`flex flex-col gap-2 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          {selected.type === 'text' && (
            <>
              <div className="flex gap-1.5">
                {(['content', 'style', 'font'] as TextTab[]).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTextTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      textTab === tab ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab === 'content' ? 'Conteúdo' : tab === 'style' ? 'Estilo' : 'Fonte'}
                  </button>
                ))}
              </div>

              {textTab === 'content' && (
                <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Texto da etiqueta</span>
                  </div>
                  <div className={`p-3 ${isDarkMode ? 'bg-slate-800/30' : 'bg-white'}`}>
                    <textarea
                      value={selected.text || ''}
                      onChange={e => updateElement(selected.id, { text: e.target.value })}
                      rows={2}
                      placeholder="Digite aqui o que vai sair impresso neste texto..."
                      className={`w-full px-3 py-2 rounded-lg text-xs font-bold outline-none resize-none ${isDarkMode ? 'bg-slate-900 text-white placeholder:text-slate-500' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400'}`}
                    />
                  </div>
                </div>
              )}

              {textTab === 'style' && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateElement(selected.id, { bold: !selected.bold })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.bold ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><Bold size={14} /></button>
                    <button type="button" onClick={() => updateElement(selected.id, { italic: !selected.italic })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.italic ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><Italic size={14} /></button>
                    <button type="button" onClick={() => updateElement(selected.id, { underline: !selected.underline })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.underline ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><Underline size={14} /></button>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateElement(selected.id, { align: 'left' })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.align === 'left' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><AlignLeft size={14} /></button>
                    <button type="button" onClick={() => updateElement(selected.id, { align: 'center' })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${(!selected.align || selected.align === 'center') ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><AlignCenter size={14} /></button>
                    <button type="button" onClick={() => updateElement(selected.id, { align: 'right' })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.align === 'right' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><AlignRight size={14} /></button>
                  </div>
                </div>
              )}

              {textTab === 'font' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Família</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {FONT_OPTIONS.map(f => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => updateElement(selected.id, { fontFamily: f.value })}
                          style={{ fontFamily: f.css }}
                          className={`py-2 rounded-lg border text-[9px] font-black transition-all ${
                            (selected.fontFamily === f.value || (!selected.fontFamily && f.value === 'helvetica'))
                              ? 'border-indigo-500 bg-indigo-600 text-white'
                              : `border-transparent ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span>Tamanho</span><span>{(selected.fontSize || 4).toFixed(1)}mm</span>
                    </div>
                    <input type="range" min={2} max={20} step={0.5} value={selected.fontSize || 4} onChange={e => updateElement(selected.id, { fontSize: parseFloat(e.target.value) })} className="w-full" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span>Espaçamento entre letras</span><span>{(selected.letterSpacing || 0).toFixed(1)}px</span>
                    </div>
                    <input type="range" min={0} max={10} step={0.5} value={selected.letterSpacing || 0} onChange={e => updateElement(selected.id, { letterSpacing: parseFloat(e.target.value) })} className="w-full" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span>Espaçamento entre linhas</span><span>{(selected.lineHeight || 1).toFixed(1)}x</span>
                    </div>
                    <input type="range" min={0.8} max={2.5} step={0.1} value={selected.lineHeight || 1} onChange={e => updateElement(selected.id, { lineHeight: parseFloat(e.target.value) })} className="w-full" />
                  </div>
                </div>
              )}
            </>
          )}

          {selected.type === 'image' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateElement(selected.id, { grayscale: !selected.grayscale })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                  selected.grayscale ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Contrast size={13} /> Tons de cinza
              </button>
              <button
                type="button"
                onClick={handleOpenImageCrop}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <CropIcon size={13} /> Recortar
              </button>
            </div>
          )}

          {/* Tamanho — alternativa em barra às alças de borda do canvas (escalar/esticar) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
              <span>Largura</span><span>{selected.w.toFixed(1)}mm</span>
            </div>
            <input
              type="range" min={3} max={Math.max(widthMm, heightMm) * 1.5} step={0.5}
              value={selected.w}
              onChange={e => updateElement(selected.id, { w: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
              <span>Altura</span><span>{selected.h.toFixed(1)}mm</span>
            </div>
            <input
              type="range" min={3} max={Math.max(widthMm, heightMm) * 1.5} step={0.5}
              value={selected.h}
              onChange={e => updateElement(selected.id, { h: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Ângulo — campo digitado (corrigido: não trava mais ao apagar tudo), barra
              deslizante 0-360°, e +/- com passo configurável. Alternativa à alça de girar no
              canvas, vale pra qualquer tipo de elemento (texto, imagem, QR, linha, forma). */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Ângulo</span>
            <input
              type="number"
              value={angleInput}
              onChange={e => {
                setAngleInput(e.target.value);
                const raw = parseInt(e.target.value, 10);
                if (!Number.isNaN(raw)) updateElement(selected.id, { rotation: wrapDeg(raw) });
              }}
              onBlur={() => setAngleInput(String(Math.round(selected.rotation)))}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
            />
            <span className="text-[10px] font-black text-slate-400 shrink-0">°</span>
          </div>
          <input
            type="range" min={0} max={360} step={rotationStep}
            value={Math.round(selected.rotation)}
            onChange={e => updateElement(selected.id, { rotation: wrapDeg(parseInt(e.target.value, 10)) })}
            className="w-full"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateElement(selected.id, { rotation: wrapDeg(Math.round(selected.rotation) - rotationStep) })}
              className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              <Minus size={13} />
            </button>
            <div className="flex-1 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
              passo
              <input
                type="number"
                min={1}
                max={180}
                value={rotationStep}
                onChange={e => {
                  const raw = parseInt(e.target.value, 10);
                  if (!Number.isNaN(raw) && raw > 0) setRotationStep(Math.min(180, raw));
                }}
                className={`w-12 px-1.5 py-1 rounded text-center text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
              />
              °
            </div>
            <button
              type="button"
              onClick={() => updateElement(selected.id, { rotation: wrapDeg(Math.round(selected.rotation) + rotationStep) })}
              className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleDuplicateSelected} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500">
              <Copy size={13} /> Duplicar
            </button>
            <button type="button" onClick={handleDeleteSelected} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-900/20 text-rose-500">
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      )}

      {/* Adicionar elementos — no rodapé, como na referência */}
      <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={handleAddText} className={btnCls()}><Type size={16} /> Texto</button>
          <button type="button" onClick={() => setShowImageSourcePicker(true)} className={btnCls()}><ImagePlus size={16} /> Imagem</button>
          <button type="button" onClick={() => setAddingQr(v => !v)} className={btnCls(addingQr)}><QrCode size={16} /> QR Code</button>
          <button type="button" onClick={handleAddDate} className={btnCls()}><Calendar size={16} /> Data</button>
          <button type="button" onClick={handleAddLine} className={btnCls()}><Minus size={16} /> Linha</button>
          <button type="button" onClick={handleAddShape} className={btnCls()}><Square size={16} /> Forma</button>
        </div>

        {addingQr && (
          <div className={`flex gap-2 mt-2 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <input
              value={qrValue}
              onChange={e => setQrValue(e.target.value)}
              placeholder="Texto ou link do QR code"
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}
            />
            <button type="button" onClick={handleConfirmQr} className="p-2 rounded-lg bg-indigo-600 text-white"><Check size={16} /></button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {isGallerySaverPlatform() && (
        <button
          type="button"
          disabled={savingGallery}
          onClick={async () => {
            setSavingGallery(true);
            try {
              const canvas = await renderToCanvas({ offsetXmm: 0, offsetYmm: 0, rotationDeg: 0 });
              const base64 = canvas.toDataURL('image/png').split('base64,')[1];
              const written = await Filesystem.writeFile({ path: `gallery_${Date.now()}.png`, data: base64, directory: Directory.Cache });
              const { saved, error } = await saveImageToGallery(written.uri);
              toast.show(saved ? 'Etiqueta salva na galeria!' : `Falha ao salvar: ${error || '(sem detalhe)'}`);
            } catch (err: any) {
              toast.show('Erro ao salvar na galeria: ' + (err?.message || err));
            } finally {
              setSavingGallery(false);
            }
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
        >
          <Download size={14} /> {savingGallery ? 'Salvando...' : 'Galeria'}
        </button>
        )}
        <button
          type="button"
          onClick={async () => {
            const canvas = await renderToCanvas({ offsetXmm: 0, offsetYmm: 0, rotationDeg: 0 });
            setPrintPreviewImage(canvas.toDataURL('image/png'));
            setShowPrintPreview(true);
          }}
          className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>

      <LabelPrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        isDarkMode={isDarkMode}
        widthMm={widthMm}
        heightMm={heightMm}
        previewDataUrls={[printPreviewImage]}
        onConfirmPrint={handlePrint}
      />

      <ImageSourcePickerModal
        isOpen={showImageSourcePicker}
        onClose={() => setShowImageSourcePicker(false)}
        isDarkMode={isDarkMode}
        onPickCamera={() => pickImage(CameraSource.Camera)}
        onPickGallery={() => pickImage(CameraSource.Photos)}
      />

      {selected?.imageDataUrl && (
        <Modal isOpen={showImageCrop} onClose={() => setShowImageCrop(false)} title="Recortar Imagem" icon={<CropIcon size={20} />} maxWidth="max-w-md" zIndex={98000}>
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest">
              Arraste pra mover, use os cantos pra redimensionar
            </p>
            <CropEditor imageSrc={selected.imageDataUrl} crop={imageCropRect} onChangeCrop={setImageCropRect} isDarkMode={isDarkMode} />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setImageCropRect(FULL_CROP)}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${cropEquals(imageCropRect, FULL_CROP) ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Imagem inteira
              </button>
              <button
                type="button"
                onClick={() => setImageCropRect(CENTER_CROP)}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${cropEquals(imageCropRect, CENTER_CROP) ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Recorte central
              </button>
            </div>
            <button
              type="button"
              onClick={handleApplyImageCrop}
              disabled={croppingImage}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
            >
              <Check size={16} /> {croppingImage ? 'Recortando...' : 'Aplicar recorte'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'));
    img.src = src;
  });
}
