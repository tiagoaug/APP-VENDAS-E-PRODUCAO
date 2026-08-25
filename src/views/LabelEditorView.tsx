import { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { toDottedQRDataURL } from '../utils/dottedQRCode';
import {
  Type, ImagePlus, QrCode, Calendar, Minus, Square, Trash2, Copy, Save, Printer,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Plus, Check, X, ZoomIn, ZoomOut,
  Contrast, Crop as CropIcon, Download, Eye, EyeOff, Lock, Unlock, Layers as LayersIcon,
  Maximize2, Minimize2, Image as ImageIcon2, ChevronDown, Ruler as RulerIcon, RotateCw, Wrench, Grid3x3, Tag, Radius,
  FileText, StickyNote, RectangleVertical, RectangleHorizontal,
} from 'lucide-react';
import { LabelElement, LabelDataBinding, BatchLabelItem, ProductionLot, ServiceOrder, Sector, SectorNote } from '../types';
import { printAbleMarkLabel2 as printAbleMarkLabel } from '../lib/ablemarkPrinter2';
import { saveImageToGallery, isGallerySaverPlatform } from '../lib/gallerySaver';
import { shareImages, sharePDF } from '../utils/pdfExport';
import { toast } from '../utils/toast';
import LabelPrintPreviewModal, { PrintOptions } from '../components/LabelPrintPreviewModal';
import ImageSourcePickerModal from '../components/ImageSourcePickerModal';
import Modal from '../components/Modal';
import CropEditor, { CropRect, FULL_CROP, CENTER_CROP, cropEquals, cropImageToDataUrl } from '../components/CropEditor';
import { DIRECTION_TO_ROTATION } from '../utils/labelPrintTransform';
import { resolveLabelBinding, LabelBindingContext, computeGradeLayout } from '../utils/labelFieldResolvers';
import { LABEL_DOTS_PER_MM as DOTS_PER_MM, FONT_OPTIONS, cssFontFamily, loadImage, renderLabelElementsToCanvas } from '../utils/labelCanvasRenderer';

const BASE_PX_WIDTH = 300; // largura de referência do canvas em zoom 1.0x

export interface LabelEditorSession {
  widthMm: number;
  heightMm: number;
  paperSizeId?: string;
  fileId?: string;
  name?: string;
  elements?: LabelElement[];
  importedImageDataUrl?: string;
  // Espelha LabelFile.isSalesTemplate ao reabrir um modelo já salvo (ver App.tsx) — inicializa
  // o checkbox "Modelo para Vendas" no estado certo em vez de sempre desmarcado.
  isSalesTemplate?: boolean;
  // Modo de teste: editor aberto a partir do popup de impressão de uma Venda, com um lote de
  // etiquetas pra imprimir — cada item vira uma etiqueta, com os elementos de `dataBinding`
  // resolvidos pro dado real daquele item (ver resolveLabelBinding em
  // utils/labelFieldResolvers.ts). O primeiro item também serve de "representante" pra prévia
  // ao vivo enquanto o modelo é editado. Ausente = editor livre de sempre (Nova Etiqueta).
  batch?: { items: BatchLabelItem[] };
  // Espelha LabelFile.isProductionTemplate ao reabrir um modelo já salvo.
  isProductionTemplate?: boolean;
  // Presente quando o editor foi aberto a partir do PCP — dá acesso a Lote/OS/Setores pros
  // campos vinculados 'osdata'/'sectornotes' (ver LabelBindingContext em labelFieldResolvers.ts).
  // `sectorId` é o setor a marcar num modelo NOVO salvo a partir dessa sessão.
  productionContext?: { lot?: ProductionLot; os?: ServiceOrder | null; sectors?: Sector[]; sectorId?: string };
}

interface LabelEditorViewProps {
  isDarkMode: boolean;
  session: LabelEditorSession;
  onSave: (
    data: { name: string; widthMm: number; heightMm: number; paperSizeId?: string; elements: LabelElement[]; isSalesTemplate?: boolean; isProductionTemplate?: boolean; sectorId?: string },
    fileId?: string,
  ) => Promise<void>;
}

function newId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function wrapDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function elementIcon(el: LabelElement) {
  switch (el.type) {
    case 'text': return <Type size={13} />;
    case 'image': return <ImageIcon2 size={13} />;
    case 'qr': return <QrCode size={13} />;
    case 'line': return <Minus size={13} />;
    case 'shape': return <Square size={13} />;
    case 'grade': return <Grid3x3 size={13} />;
    default: return <Square size={13} />;
  }
}

// Usado só pro atalho "travar tudo/destravar tudo" do painel de camadas — o painel do
// elemento selecionado sempre mostra os 5 cadeados por propriedade, independentes.
function isElementLocked(el: LabelElement): boolean {
  return !!(el.lockWidth || el.lockHeight || el.lockRotation || el.lockFontSize || el.lockPosition);
}

function elementLabel(el: LabelElement): string {
  switch (el.type) {
    case 'text': return el.dataBinding ? BINDING_LABELS[el.dataBinding] : (el.text?.trim() ? el.text.trim().slice(0, 24) : 'Texto');
    case 'image': return el.dataBinding === 'photo' ? 'Foto (produto)' : 'Imagem';
    case 'qr': return el.dataBinding === 'qr' ? 'QR Code (venda)' : 'QR Code';
    case 'grade': return 'Grade';
    case 'line': return 'Linha';
    case 'shape': return 'Forma';
    default: return 'Elemento';
  }
}

// Nomes exibidos dos campos de venda/produção que um elemento pode "puxar" automaticamente (ver
// LabelElement.dataBinding em types.ts). 'osdata'/'sectornotes' só aparecem como botão quando a
// sessão veio do PCP (session.productionContext) — ver PRODUCTION_FIELD_OPTIONS abaixo.
const BINDING_LABELS: Record<LabelDataBinding, string> = {
  reference: 'Referência', name: 'Nome', color: 'Cor', size: 'Tamanho',
  qr: 'QR Code', photo: 'Foto', grade: 'Grade',
  customer: 'Cliente', recipient: 'Destinatário', packaging: 'Embalagem',
  osdata: 'Dados da OS', sectornotes: 'Obs. Setor',
};

// Botões de "Campos da venda" (modo de teste, ver LabelEditorSession.batch) — ordem de exibição.
// Nome e Cor não aparecem como botões próprios — viraram opções dentro do elemento Referência
// (ver LabelElement.combineFields / "Combinar Campos Neste Elemento"), mesma solução já usada em
// PrintLabelEditorModal.tsx (CONFIG_LIST_KEYS filtra 'name'/'color' pelo mesmo motivo).
const BOUND_FIELD_OPTIONS: { binding: LabelDataBinding; icon: typeof Type }[] = [
  { binding: 'reference', icon: Tag },
  { binding: 'size', icon: Type },
  { binding: 'qr', icon: QrCode },
  { binding: 'photo', icon: ImageIcon2 },
  { binding: 'grade', icon: Grid3x3 },
  { binding: 'customer', icon: Type },
  { binding: 'recipient', icon: Type },
  { binding: 'packaging', icon: Type },
];

// Botões extras de "Campos do pedido" — só aparecem quando a sessão veio do PCP
// (session.productionContext, ver LabelEditorSession).
const PRODUCTION_FIELD_OPTIONS: { binding: LabelDataBinding; icon: typeof Type }[] = [
  { binding: 'osdata', icon: FileText },
  { binding: 'sectornotes', icon: StickyNote },
];

// Valor de texto pra mostrar ao vivo no canvas de um elemento vinculado — dado real quando há
// contexto de venda (ctx), placeholder de exemplo quando não há (ver resolveLabelBinding).
function previewBindingText(binding: LabelDataBinding, ctx: LabelBindingContext | null, combineFields?: ('reference' | 'name' | 'color')[], sectorNoteFilter?: { sectorId: string; noteName: string }): string {
  const resolved = resolveLabelBinding(binding, ctx, combineFields, sectorNoteFilter);
  return resolved.kind === 'text' ? resolved.text : '';
}

// Prévia ao vivo (DOM, não canvas) da tabela de Grade — versão simplificada da renderização
// real (ver renderToCanvas), só pra dar noção de posição/tamanho enquanto edita.
function GradePreview({ el, ctx, pxPerMmX, pxPerMmY }: { el: LabelElement; ctx: LabelBindingContext | null; pxPerMmX: number; pxPerMmY: number }) {
  const resolved = el.dataBinding ? resolveLabelBinding(el.dataBinding, ctx) : null;
  const gridEntries = resolved?.kind === 'grade' ? resolved.gridEntries : [];
  const cells = computeGradeLayout(gridEntries, 0, 0, el.w, el.h, el.fontSize || 3.5);
  if (cells.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-slate-300 pointer-events-none text-slate-400 text-[8px] font-bold uppercase">
        Grade
      </div>
    );
  }
  const fontPx = Math.max(6, (el.fontSize || 3.5) * pxPerMmX);
  // Estilo da pílula da numeração (não da quantidade abaixo) — ver LabelElement.gradeSizeStyle.
  const sizeStyle = el.gradeSizeStyle || 'filled';
  const pillCls = sizeStyle === 'inverted' ? 'bg-white text-black border-2 border-black box-border'
    : sizeStyle === 'plain' ? 'bg-transparent text-black'
    : 'bg-black text-white';
  return (
    <div className="relative w-full h-full pointer-events-none">
      {cells.map((c, i) => (
        <div key={i}>
          <div
            className={`absolute rounded-sm flex items-center justify-center font-black leading-none ${pillCls}`}
            style={{
              left: `${(c.pillXmm / el.w) * 100}%`, top: `${(c.pillYmm / el.h) * 100}%`,
              width: `${(c.pillWmm / el.w) * 100}%`, height: `${(c.pillHmm / el.h) * 100}%`,
              fontSize: fontPx,
            }}
          >
            {c.sz}
          </div>
          {c.qty !== null && (
            <div
              className="absolute text-black font-black leading-none"
              style={{ left: c.qtyCxMm * pxPerMmX, top: c.qtyCyMm * pxPerMmY, transform: 'translate(-50%,-50%)', fontSize: fontPx * 0.85 }}
            >
              {c.qty}
            </div>
          )}
        </div>
      ))}
    </div>
  );
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
  // Travado = a área do editor para de capturar o toque pra arrastar elemento, e o arrasto em
  // cima dela volta a rolar a tela normalmente (o mesmo gesto de sempre no celular) — sem isso,
  // dá pra ficar "preso" dentro do editor sem conseguir rolar até Ferramentas/Salvar embaixo.
  const [canvasLocked, setCanvasLocked] = useState(false);
  const [name, setName] = useState(session.name || 'Nova etiqueta');
  // Marca o modelo salvo como reutilizável no popup de impressão de Vendas (ver
  // LabelPrintStudioView "filterSalesTemplates"). Pré-marcado quando o editor já abriu vindo de
  // lá (session.batch) — é o caso mais comum de quem chega por esse fluxo.
  const [isSalesTemplate, setIsSalesTemplate] = useState(session.isSalesTemplate ?? (!!session.batch && !session.productionContext));
  // Marca o modelo salvo como reutilizável a partir do PCP (aparece agrupado por setor no
  // seletor de perfil) — só faz sentido quando a sessão já veio de lá.
  const [isProductionTemplate, setIsProductionTemplate] = useState(session.isProductionTemplate ?? !!session.productionContext);
  const [addingQr, setAddingQr] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [saving, setSaving] = useState(false);
  // "Salvar como novo perfil" — sempre cria um LabelFile NOVO (ignora session.fileId), mesmo
  // editando um modelo já salvo, pra testar variações sem sobrescrever o original.
  const [saveAsNewModal, setSaveAsNewModal] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const [savingGallery, setSavingGallery] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showImageSourcePicker, setShowImageSourcePicker] = useState(false);
  // Recorte de uma imagem já adicionada ao editor — corta e "assa" a região recortada de vez
  // no imageDataUrl do elemento (não é um crop-por-referência tipo o do import de PDF; aqui é
  // só uma imagem solta, então recortar já substitui o arquivo direto).
  const [showImageCrop, setShowImageCrop] = useState(false);
  const [imageCropRect, setImageCropRect] = useState<CropRect>(FULL_CROP);
  const [croppingImage, setCroppingImage] = useState(false);
  const [printPreviewImages, setPrintPreviewImages] = useState<string[]>([]);
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
  // Tela cheia focada no elemento selecionado — só área de edição, ferramentas ativas daquele
  // tipo (texto/imagem/forma) e camadas; some com nome do arquivo, botões de adicionar
  // elemento, salvar/imprimir/galeria. `showLayers` também vale fora da tela cheia (painel
  // opcional na visão normal).
  const [fullscreen, setFullscreen] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  // Acordeões do painel do elemento — fechados por padrão, pra não ocupar espaço quando não é
  // isso que está sendo ajustado no momento (ex.: editando texto/estilo, não tamanho/ângulo).
  const [sizeAccordionOpen, setSizeAccordionOpen] = useState(false);
  const [angleAccordionOpen, setAngleAccordionOpen] = useState(false);
  const [cornerAccordionOpen, setCornerAccordionOpen] = useState(false);
  const [toolsAccordionOpen, setToolsAccordionOpen] = useState(false);
  // Fechado por padrão — minimizado, mostra só a camada selecionada (ver cabeçalho do
  // layersPanel abaixo); abrir revela a lista completa de camadas.
  const [layersAccordionOpen, setLayersAccordionOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const selected = elements.find(e => e.id === selectedId) || null;

  // Representante do lote (modo de teste em Vendas) usado só pra prévia ao vivo enquanto edita
  // o modelo — a impressão em lote de verdade resolve cada item na hora (ver handlePrint).
  const activeBindingContext: LabelBindingContext | null = session.batch?.items?.[0]
    ? { item: session.batch.items[0], lot: session.productionContext?.lot, os: session.productionContext?.os, sectors: session.productionContext?.sectors }
    : null;

  // Instruções por setor disponíveis pra escolher em "Obs. Setor" (ver LabelElement.sectorNoteFilter)
  // — mesma ideia de PrintLabelEditorModal.tsx (availableSectorNotes): em lote (várias etiquetas,
  // possivelmente de variantes diferentes), reúne a UNIÃO das instruções de TODOS os itens, não só
  // do representante da prévia — cada etiqueta resolve seu próprio texto na hora de imprimir.
  const availableSectorNotes: { sectorId: string; sectorName: string; noteName: string; text: string }[] = (() => {
    const seen = new Map<string, { sectorId: string; sectorName: string; noteName: string; text: string }>();
    const sectors = session.productionContext?.sectors || [];
    for (const item of session.batch?.items || []) {
      const v = item.variation;
      if (!v?.sectorNotes) continue;
      Object.entries(v.sectorNotes).forEach(([sid, notes]) => {
        const sector = sectors.find(s => s.id === sid);
        const sectorName = (sector?.name || sid).toUpperCase();
        (notes as SectorNote[]).filter(n => n.text).forEach(n => {
          const noteName = n.name || '(sem nome)';
          const key = `${sid}::${noteName}`;
          if (!seen.has(key)) seen.set(key, { sectorId: sid, sectorName, noteName, text: n.text });
        });
      });
    }
    return Array.from(seen.values());
  })();
  const [notePickerOpen, setNotePickerOpen] = useState(false);

  useEffect(() => {
    if (selected) setAngleInput(String(Math.round(selected.rotation)));
  }, [selectedId, selected?.rotation]);
  // Escala "encaixar na tela": zoom 1.0x sempre cabe inteiro na largura/altura disponíveis
  // (importante depois de girar a área — uma etiqueta 24×75mm não pode usar a mesma largura
  // de referência que uma 75×24mm, senão fica cortada por baixo). zoom continua ajustável a
  // partir desse encaixe.
  const maxCanvasHeightPx = typeof window !== 'undefined' ? window.innerHeight * (fullscreen ? 0.55 : 0.4) : BASE_PX_WIDTH;
  const baseWidthPx = fullscreen ? Math.min(500, (typeof window !== 'undefined' ? window.innerWidth * 0.9 : 500)) : BASE_PX_WIDTH;
  const fitScale = Math.min(baseWidthPx / widthMm, maxCanvasHeightPx / heightMm);
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

  // Adiciona um elemento vinculado a um campo de venda (ver LabelElement.dataBinding) — o
  // conteúdo é resolvido na hora de mostrar/exportar (previewBindingText/renderToCanvas), não
  // fica gravado estático no elemento.
  const handleAddBoundField = (binding: LabelDataBinding) => {
    if (binding === 'qr') {
      const side = Math.min(widthMm, heightMm) * 0.5;
      addElement({
        id: newId(), type: 'qr', x: widthMm * 0.25, y: heightMm * 0.25, w: side, h: side,
        rotation: 0, dataBinding: 'qr',
      });
    } else if (binding === 'photo') {
      addElement({
        id: newId(), type: 'image', x: widthMm * 0.25, y: heightMm * 0.1, w: widthMm * 0.5, h: widthMm * 0.5,
        rotation: 0, dataBinding: 'photo',
      });
    } else if (binding === 'grade') {
      addElement({
        id: newId(), type: 'grade', x: widthMm * 0.1, y: heightMm * 0.55, w: widthMm * 0.8, h: heightMm * 0.3,
        rotation: 0, dataBinding: 'grade', fontSize: 3.5,
      });
    } else {
      addElement({
        id: newId(), type: 'text', x: widthMm * 0.1, y: heightMm * 0.35, w: widthMm * 0.8, h: heightMm * 0.25,
        rotation: 0, dataBinding: binding, fontSize: 3.5, align: 'center', lineHeight: 1,
      });
    }
  };

  const pickImage = async (source: CameraSource) => {
    try {
      // quality: 100 — sem compressão JPEG extra na importação (nem width/height, que limitariam
      // a resolução nativa da foto/imagem da galeria); a única perda de nitidez que resta é a do
      // próprio arquivo original escolhido.
      const photo = await Camera.getPhoto({ source, resultType: CameraResultType.DataUrl, quality: 100 });
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
  // Elementos mantêm x/y/w/h em mm; se ficarem fora da nova área, o usuário reposiciona — EXCETO
  // o(s) elemento(s) que ocupavam a etiqueta inteira (ex.: foto/PDF importado como fundo, caso
  // mais comum de quem gira depois de importar um arquivo): esses são redimensionados junto,
  // senão continuam do tamanho antigo e saem cortados na impressão (a tela ainda "parece" ok
  // porque o container do editor não recorta visualmente, mas o canvas de impressão recorta
  // de verdade no tamanho físico do papel).
  const handleRotateCanvas = () => {
    const oldWidthMm = widthMm;
    const oldHeightMm = heightMm;
    setElements(prev => prev.map(el =>
      (el.x === 0 && el.y === 0 && Math.abs(el.w - oldWidthMm) < 0.01 && Math.abs(el.h - oldHeightMm) < 0.01)
        ? { ...el, w: oldHeightMm, h: oldWidthMm }
        : el
    ));
    setWidthMm(oldHeightMm);
    setHeightMm(oldWidthMm);
    toast.show(`Etiqueta girada: ${oldHeightMm > oldWidthMm ? 'Paisagem' : 'Retrato'} (${oldHeightMm} × ${oldWidthMm} mm)`);
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
  const handleSave = async (opts?: { asNew?: boolean; overrideName?: string }) => {
    setSaving(true);
    try {
      const finalName = (opts?.overrideName ?? name).trim() || 'Etiqueta';
      await onSave(
        { name: finalName, widthMm, heightMm, paperSizeId: session.paperSizeId, elements, isSalesTemplate, isProductionTemplate, sectorId: session.productionContext?.sectorId },
        opts?.asNew ? undefined : session.fileId,
      );
      if (opts?.overrideName) setName(finalName);
      toast.show(opts?.asNew ? 'Novo perfil salvo!' : 'Etiqueta salva!');
    } catch (err: any) {
      toast.show('Erro ao salvar etiqueta: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSaveAsNew = async () => {
    const finalName = saveAsNewModal.name.trim();
    if (!finalName) return;
    setSaveAsNewModal({ open: false, name: '' });
    await handleSave({ asNew: true, overrideName: finalName });
  };

  // `bindingCtx` resolve os elementos com `dataBinding` — item específico do lote em impressão
  // batch (ver handlePrint), o representante (`activeBindingContext`) fora disso.
  // Desenho em si mora em utils/labelCanvasRenderer.ts (compartilhado com a miniatura de
  // prévia dos modelos salvos, ver LabelProfilePickerModal.tsx) — aqui só passa o estado atual.
  const renderToCanvas = (
    printOptions: { offsetXmm: number; offsetYmm: number; rotationDeg: number },
    bindingCtx: LabelBindingContext | null = activeBindingContext,
  ): Promise<HTMLCanvasElement> => renderLabelElementsToCanvas(elements, widthMm, heightMm, printOptions, bindingCtx);

  // Renderiza a etiqueta atual pra PNG — uma imagem só, ou uma por item em modo lote
  // (session.batch, vindo de Vendas, cada uma já com os campos vinculados resolvidos pro dado
  // real daquela caixa/tamanho). Base pro preview de impressão E pros botões de compartilhar
  // (JPG/PDF) do rodapé — todos precisam do mesmo conjunto de imagens renderizadas.
  const renderAllFrames = async (): Promise<string[]> => {
    const batchItems = session.batch?.items;
    if (batchItems && batchItems.length > 0) {
      const urls: string[] = [];
      for (const item of batchItems) {
        const canvas = await renderToCanvas({ offsetXmm: 0, offsetYmm: 0, rotationDeg: 0 }, { item, lot: session.productionContext?.lot, os: session.productionContext?.os, sectors: session.productionContext?.sectors });
        urls.push(canvas.toDataURL('image/png'));
      }
      return urls;
    }
    const canvas = await renderToCanvas({ offsetXmm: 0, offsetYmm: 0, rotationDeg: 0 });
    return [canvas.toDataURL('image/png')];
  };

  // Compartilhado pelo botão "Imprimir" (rodapé) e "Visualizar etiqueta de impressão" (Área do
  // Editor) — a própria modal de preview já deixa fechar sem imprimir, então serve pros dois.
  const handleOpenPrintPreview = async () => {
    setPrintPreviewImages(await renderAllFrames());
    setShowPrintPreview(true);
  };

  const [sharingJpg, setSharingJpg] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);

  const handleShareJpg = async () => {
    setSharingJpg(true);
    try {
      const urls = await renderAllFrames();
      await shareImages(urls, name || 'etiqueta');
    } catch (err: any) {
      toast.show('Erro ao compartilhar: ' + (err?.message || err));
    } finally {
      setSharingJpg(false);
    }
  };

  // Junta todas as etiquetas (1 em modo normal, 1 por item em modo lote) num PDF só, 1 página
  // por etiqueta, no tamanho físico real widthMm×heightMm — mesmo mecanismo do preview de
  // impressão (ver LabelPrintPreviewModal.tsx).
  const handleSharePdf = async () => {
    setSharingPdf(true);
    try {
      const urls = await renderAllFrames();
      const orientation = widthMm > heightMm ? 'landscape' : 'portrait';
      const doc = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation });
      urls.forEach((url, i) => {
        if (i > 0) doc.addPage([widthMm, heightMm], orientation);
        doc.addImage(url, 'PNG', 0, 0, widthMm, heightMm);
      });
      await sharePDF(doc, name || 'etiqueta');
    } catch (err: any) {
      toast.show('Erro ao gerar PDF: ' + (err?.message || err));
    } finally {
      setSharingPdf(false);
    }
  };

  const handlePrint = async (options: PrintOptions) => {
    if (printingRef.current) return;
    printingRef.current = true;
    try {
      const batchItems = session.batch?.items;
      const printOpts = { offsetXmm: options.offsetXmm, offsetYmm: options.offsetYmm, rotationDeg: DIRECTION_TO_ROTATION[options.direction] };
      // Fora do modo lote: 1 "job" (o desenho atual), repetido `options.copies` vezes — igual
      // sempre foi. Em modo lote: 1 job por item da venda, cada um com seus campos vinculados
      // resolvidos pro dado daquela caixa/tamanho (ver renderToCanvas/resolveLabelBinding).
      const jobs: (LabelBindingContext | null)[] = batchItems && batchItems.length > 0
        ? batchItems.map(item => ({ item, lot: session.productionContext?.lot, os: session.productionContext?.os, sectors: session.productionContext?.sectors }))
        : [null];
      const totalJobs = jobs.length * options.copies;
      let printedCount = 0;
      for (const jobCtx of jobs) {
        const canvas = await renderToCanvas(printOpts, jobCtx);
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split('base64,')[1];
        for (let i = 0; i < options.copies; i++) {
          // Dá tempo da impressora terminar de alimentar/cortar a etiqueta anterior antes de
          // mandar a próxima — sem essa pausa o job seguinte chega enquanto o mecanismo ainda
          // está processando o de antes, e a impressão sai corrompida mesmo com bytes corretos.
          if (printedCount > 0) await new Promise(resolve => setTimeout(resolve, 2000));
          const written = await Filesystem.writeFile({ path: `label_${Date.now()}_${printedCount}.png`, data: base64, directory: Directory.Cache });
          const { sent, error } = await printAbleMarkLabel(written.uri, options.paperType, options.density);
          if (!sent) {
            toast.show(`Falha ao imprimir etiqueta ${printedCount + 1}/${totalJobs}: ${error || '(sem detalhe)'}`);
            return;
          }
          printedCount++;
        }
      }
      toast.show(totalJobs > 1 ? `${totalJobs} etiquetas enviadas para a impressora!` : 'Enviado para a impressora!');
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

  // ─── Blocos reutilizados na visão normal E na tela cheia ──────────────────────
  const zoomControls = (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
        <ZoomOut size={14} />
      </button>
      <span className="text-[10px] font-black text-slate-400 w-10 text-center">{zoom.toFixed(2)}x</span>
      <button type="button" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
        <ZoomIn size={14} />
      </button>
    </div>
  );

  // Painel de camadas — lista em ordem de topo pra base (o último elemento adicionado, que
  // fica por cima visualmente, aparece primeiro), com olho (ocultar) e cadeado (travar) por
  // item, clique seleciona o elemento.
  const layersPanel = (
    <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <button
        type="button"
        onClick={() => setLayersAccordionOpen(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-2.5 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}
      >
        {/* Minimizado, mostra só a camada selecionada (não a lista inteira) — dá pra ver o
            que está em edição sem precisar abrir o acordeão. */}
        {!layersAccordionOpen && selected ? (
          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
            {elementIcon(selected)} {elementLabel(selected)}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <LayersIcon size={13} className="text-violet-500" /> Camadas ({elements.length})
          </span>
        )}
        <span className="flex items-center gap-2">
          {/* Desmarcar todas — só desseleciona o elemento em edição (sai do painel de
              ferramentas), não mexe em ocultar/travar de nenhuma camada. */}
          {selected && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setSelectedId(null); }}
              title="Desmarcar seleção"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-black/10 hover:bg-black/20"
            >
              <X size={11} /> Desmarcar
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${layersAccordionOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {layersAccordionOpen && (
        <div className="p-3 flex flex-col gap-1.5">
          {elements.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400 text-center py-2">Nenhum elemento ainda.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {[...elements].reverse().map(el => (
                <div
                  key={el.id}
                  onClick={() => { setSelectedId(el.id); setTextTab('content'); }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all ${
                    selectedId === el.id ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {elementIcon(el)}
                  <span className="flex-1 text-[10px] font-bold truncate">{elementLabel(el)}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); updateElement(el.id, { hidden: !el.hidden }); }}
                    title={el.hidden ? 'Mostrar' : 'Ocultar'}
                    className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20"
                  >
                    {el.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      const anyLocked = isElementLocked(el);
                      updateElement(el.id, anyLocked
                        ? { lockWidth: false, lockHeight: false, lockRotation: false, lockFontSize: false, lockPosition: false }
                        : { lockWidth: true, lockHeight: true, lockRotation: true, lockFontSize: true, lockPosition: true });
                    }}
                    title={isElementLocked(el) ? 'Destravar tudo' : 'Travar tudo'}
                    className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20"
                  >
                    {isElementLocked(el) ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const canvasArea = (
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
              onPointerMove={canvasLocked ? undefined : onPointerMove}
              onPointerUp={canvasLocked ? undefined : endDrag}
              onPointerCancel={canvasLocked ? undefined : endDrag}
              onClick={() => setSelectedId(null)}
              className={`relative bg-white rounded-lg border-2 border-dashed border-slate-300 select-none shrink-0 ${canvasLocked ? '' : 'touch-none'}`}
              style={{ width: canvasWidthPx, height: canvasHeightPx, touchAction: canvasLocked ? 'pan-x pan-y' : 'none' }}
            >
              {elements.filter(el => !el.hidden).map(el => (
                <div
                  key={el.id}
                  onPointerDown={e => { if (!canvasLocked && !el.lockPosition) beginDrag(e, el.id, 'move'); }}
                  onClick={e => { e.stopPropagation(); if (!canvasLocked) { setSelectedId(el.id); setTextTab('content'); } }}
                  className={`absolute flex items-center justify-center ${selectedId === el.id ? 'outline outline-2 outline-indigo-500' : ''}`}
                  style={{
                    left: el.x * pxPerMmX,
                    top: el.y * pxPerMmY,
                    width: el.w * pxPerMmX,
                    height: el.h * pxPerMmY,
                    transform: `rotate(${el.rotation}deg)`,
                    cursor: canvasLocked ? 'default' : el.lockPosition ? 'default' : 'move',
                  }}
                >
                  {el.type === 'text' ? (
                    <span
                      className={`pointer-events-none whitespace-pre-wrap break-words w-full h-full flex items-center px-1 ${el.invert ? 'bg-black text-white' : 'text-black'}`}
                      style={{
                        fontSize: (el.fontSize || 4) * pxPerMmX,
                        fontFamily: cssFontFamily(el.fontFamily),
                        fontWeight: el.bold ? 900 : 400,
                        fontStyle: el.italic ? 'italic' : 'normal',
                        textDecoration: el.underline ? 'underline' : 'none',
                        textAlign: el.align || 'center',
                        justifyContent: el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center',
                        letterSpacing: `${el.letterSpacing || 0}px`,
                        lineHeight: el.lineHeight || 1,
                        borderRadius: el.invert ? (el.borderRadius ?? Math.min(el.h / 2, 1.2)) * pxPerMmY : undefined,
                      }}
                    >
                      {el.dataBinding ? (previewBindingText(el.dataBinding, activeBindingContext, el.combineFields, el.sectorNoteFilter) || `{{${BINDING_LABELS[el.dataBinding]}}}`) : el.text}
                    </span>
                  ) : el.type === 'line' ? (
                    <div className="w-full h-full bg-black pointer-events-none" />
                  ) : el.type === 'shape' ? (
                    <div className="w-full h-full border-2 border-black pointer-events-none" style={{ borderRadius: (el.borderRadius || 0) * pxPerMmX }} />
                  ) : el.type === 'grade' ? (
                    <GradePreview el={el} ctx={activeBindingContext} pxPerMmX={pxPerMmX} pxPerMmY={pxPerMmY} />
                  ) : el.type === 'qr' && el.dataBinding === 'qr' ? (
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-slate-300 pointer-events-none text-slate-400">
                      <QrCode size={Math.max(12, Math.min(el.w, el.h) * pxPerMmX * 0.4)} />
                    </div>
                  ) : el.type === 'image' && el.dataBinding === 'photo' ? (
                    activeBindingContext?.item.product.labelThumbnailUrl ? (
                      <img
                        src={activeBindingContext.item.product.labelThumbnailUrl}
                        alt=""
                        className="w-full h-full object-contain pointer-events-none"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-slate-300 pointer-events-none text-slate-400 text-[8px] font-bold uppercase text-center px-1">
                        Sem foto cadastrada
                      </div>
                    )
                  ) : el.imageDataUrl ? (
                    <img
                      src={el.imageDataUrl}
                      alt=""
                      className="w-full h-full object-contain pointer-events-none"
                      style={{ filter: el.grayscale ? 'grayscale(1)' : 'none' }}
                      draggable={false}
                    />
                  ) : null}

                  {selectedId === el.id && !canvasLocked && (
                    <>
                      {/* Canto — redimensiona largura E altura juntas, só quando nenhuma das
                          duas está travada (senão mudaria a que está travada também) */}
                      {!el.lockWidth && !el.lockHeight && (
                        <div
                          onPointerDown={e => beginDrag(e, el.id, 'resize')}
                          className="absolute -right-2 -bottom-2 w-4 h-4 rounded-sm bg-indigo-500 border-2 border-white cursor-nwse-resize z-10"
                        />
                      )}
                      {/* Bordas — cada uma mexe só num eixo, então respeita a trava daquele
                          eixo independentemente da outra (travar largura não afeta altura) */}
                      {!el.lockWidth && (
                        <>
                          <div
                            onPointerDown={e => beginDrag(e, el.id, 'resize-right')}
                            className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-6 rounded-full bg-indigo-500 border-2 border-white cursor-ew-resize"
                          />
                          <div
                            onPointerDown={e => beginDrag(e, el.id, 'resize-left')}
                            className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-6 rounded-full bg-indigo-500 border-2 border-white cursor-ew-resize"
                          />
                        </>
                      )}
                      {!el.lockHeight && (
                        <>
                          <div
                            onPointerDown={e => beginDrag(e, el.id, 'resize-bottom')}
                            className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 h-3 w-6 rounded-full bg-indigo-500 border-2 border-white cursor-ns-resize"
                          />
                          <div
                            onPointerDown={e => beginDrag(e, el.id, 'resize-top')}
                            className="absolute top-[-6px] left-1/2 -translate-x-1/2 h-3 w-6 rounded-full bg-indigo-500 border-2 border-white cursor-ns-resize"
                          />
                        </>
                      )}
                      {!el.lockRotation && (
                        <div
                          onPointerDown={e => beginDrag(e, el.id, 'rotate')}
                          className="absolute left-1/2 -top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white cursor-grab"
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );

  // Card que agrupa zoom + régua/canvas — "Área do Editor" — com atalho pra ver a etiqueta
  // como vai sair impressa sem precisar chegar até o botão "Imprimir" lá embaixo.
  const editorAreaCard = (
    <div className={`flex flex-col gap-3 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Área do Editor</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCanvasLocked(v => !v)}
            title={canvasLocked ? 'Destravar pra editar' : 'Travar pra rolar a tela'}
            data-guide-anchor="labelEditor.travarArea"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              canvasLocked ? 'bg-amber-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {canvasLocked ? <Lock size={13} /> : <Unlock size={13} />} {canvasLocked ? 'Travada' : 'Travar'}
          </button>
          <button
            type="button"
            onClick={handleOpenPrintPreview}
            title="Visualizar etiqueta de impressão"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <Eye size={13} /> Visualizar
          </button>
        </div>
      </div>
      <p className="text-[7px] text-black dark:text-white font-bold uppercase tracking-wider leading-relaxed -mt-1">
        {canvasLocked
          ? 'Área travada: arraste com o dedo pra rolar a tela — os elementos não se movem.'
          : 'Arrastar aqui move os elementos. Trave se só quiser rolar a tela até os controles abaixo.'}
      </p>
      {zoomControls}
      {canvasArea}
    </div>
  );

  // Painel de ferramentas do elemento selecionado — conteúdo muda por tipo (texto ganha as
  // abas Conteúdo/Estilo/Fonte; imagem ganha tons de cinza/recortar), mas largura/altura/
  // ângulo/duplicar/excluir valem pra qualquer tipo, inclusive linha e forma.
  const toolPanel = selected && (
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
                selected.dataBinding ? (
                  <div className="flex flex-col gap-2">
                    <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Campo vinculado: {BINDING_LABELS[selected.dataBinding]}
                        </span>
                      </div>
                      <div className={`p-3 ${isDarkMode ? 'bg-slate-800/30' : 'bg-white'}`}>
                        <p className="text-xs font-bold text-slate-500">
                          {previewBindingText(selected.dataBinding, activeBindingContext, selected.combineFields, selected.sectorNoteFilter) || '(sem dado disponível pra este item)'}
                        </p>
                      </div>
                    </div>

                    {/* Combinar Campos — só no elemento Referência: junta Ref/Nome/Cor num único
                        texto, em qualquer combinação (ex.: só Ref+Cor). */}
                    {selected.dataBinding === 'reference' && (
                      <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Combinar campos neste elemento</span>
                        </div>
                        <div className={`p-3 grid grid-cols-3 gap-1.5 ${isDarkMode ? 'bg-slate-800/30' : 'bg-white'}`}>
                          {([['reference', 'Ref'], ['name', 'Nome'], ['color', 'Cor']] as const).map(([field, label]) => {
                            const active = (selected.combineFields || ['reference']).includes(field);
                            return (
                              <button
                                key={field}
                                type="button"
                                onClick={() => {
                                  const current = selected.combineFields || ['reference'];
                                  const next = active ? current.filter(f => f !== field) : [...current, field];
                                  // Nunca deixa vazio — sem nada marcado, volta a mostrar só a Referência.
                                  updateElement(selected.id, { combineFields: next.length > 0 ? next : ['reference'] });
                                }}
                                className={`py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'border-indigo-500 bg-indigo-600 text-white' : `border-transparent ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Instrução a Exibir — só no elemento Obs. Setor: escolhe UMA instrução
                        específica (setor+nome) em vez da concatenação de todas (ver
                        LabelElement.sectorNoteFilter/getSectorNotesText). */}
                    {selected.dataBinding === 'sectornotes' && (
                      <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Instrução a exibir</span>
                        </div>
                        <div className={`p-3 ${isDarkMode ? 'bg-slate-800/30' : 'bg-white'}`}>
                          {availableSectorNotes.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setNotePickerOpen(true)}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}
                            >
                              <span className="truncate">
                                {selected.sectorNoteFilter
                                  ? availableSectorNotes.find(n => n.sectorId === selected.sectorNoteFilter!.sectorId && n.noteName === selected.sectorNoteFilter!.noteName)
                                    ? `${availableSectorNotes.find(n => n.sectorId === selected.sectorNoteFilter!.sectorId && n.noteName === selected.sectorNoteFilter!.noteName)!.sectorName} — ${selected.sectorNoteFilter.noteName}`
                                    : 'Todas as instruções'
                                  : 'Todas as instruções'}
                              </span>
                              <ChevronDown size={14} className="shrink-0" />
                            </button>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-400">Nenhuma instrução de setor cadastrada pra esse item ainda.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
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
                )
              )}

              {textTab === 'style' && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateElement(selected.id, { bold: !selected.bold })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.bold ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><Bold size={14} /></button>
                    <button type="button" onClick={() => updateElement(selected.id, { italic: !selected.italic })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.italic ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><Italic size={14} /></button>
                    <button type="button" onClick={() => updateElement(selected.id, { underline: !selected.underline })} className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.underline ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><Underline size={14} /></button>
                    <button
                      type="button"
                      title="Inverter — texto branco em retângulo preto, igual sai na impressão"
                      onClick={() => updateElement(selected.id, { invert: !selected.invert })}
                      className={`flex-1 flex items-center justify-center py-2 rounded-lg ${selected.invert ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none ${selected.invert ? 'bg-white text-indigo-600' : 'bg-slate-900 text-white'}`}>Aa</span>
                    </button>
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
                      <span>Tamanho</span><span className={selected.lockFontSize ? 'opacity-40' : ''}>{(selected.fontSize || 4).toFixed(1)}mm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateElement(selected.id, { lockFontSize: !selected.lockFontSize })} className={`p-2.5 rounded-lg shrink-0 ${selected.lockFontSize ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        {selected.lockFontSize ? <Lock size={15} /> : <Unlock size={15} />}
                      </button>
                      <input type="range" min={2} max={20} step={0.5} value={selected.fontSize || 4} disabled={selected.lockFontSize} onChange={e => updateElement(selected.id, { fontSize: parseFloat(e.target.value) })} className="flex-1" />
                    </div>
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

          {selected.type === 'grade' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-0.5">Estilo da numeração</span>
              <div className={`flex gap-1 p-1 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {([
                  ['filled', '38', 'bg-slate-900 text-white'],
                  ['inverted', '38', 'bg-white text-slate-900 border border-slate-900'],
                  ['plain', '38', 'bg-transparent text-slate-900 dark:text-white'],
                ] as const).map(([value, sample, sampleCls]) => {
                  const active = (selected.gradeSizeStyle || 'filled') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateElement(selected.id, { gradeSizeStyle: value })}
                      className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ring-2 ${active ? 'ring-indigo-500' : 'ring-transparent'}`}
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none ${sampleCls}`}>{sample}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          {/* Ocultar (global) / travar posição (vale pra todos os tipos, inclusive linha) /
              tela cheia — controle rápido do elemento selecionado. As demais travas (largura,
              altura, ângulo, tamanho de fonte) são por propriedade, cada uma com seu próprio
              cadeado ao lado do controle correspondente abaixo. O botão de tela cheia é o ÚNICO
              lugar que abre/fecha (ícone e título mudam com o estado) — não duplique em outro
              canto, ex.: no cabeçalho da própria tela cheia. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateElement(selected.id, { hidden: !selected.hidden })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${selected.hidden ? 'bg-amber-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {selected.hidden ? <EyeOff size={13} /> : <Eye size={13} />} {selected.hidden ? 'Oculto' : 'Visível'}
            </button>
            <button
              type="button"
              onClick={() => updateElement(selected.id, { lockPosition: !selected.lockPosition })}
              title={selected.lockPosition ? 'Destravar posição' : 'Travar posição'}
              className={`p-2.5 rounded-lg shrink-0 ${selected.lockPosition ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
            >
              {selected.lockPosition ? <Lock size={15} /> : <Unlock size={15} />}
            </button>
            {/* Atalho pra Inverter — mesmo campo de Estilo (aba Estilo), só que sempre visível
                aqui, sem precisar trocar de aba pra achar (útil sobretudo em campo vinculado,
                que passa a maior parte do tempo na aba Conteúdo). Só faz sentido em texto. */}
            {selected.type === 'text' && (
              <button
                type="button"
                onClick={() => updateElement(selected.id, { invert: !selected.invert })}
                title={selected.invert ? 'Desativar inverter cor' : 'Inverter cor — texto branco em retângulo preto'}
                className={`p-2.5 rounded-lg shrink-0 ${selected.invert ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
              >
                <span className={`block px-1.5 py-0.5 rounded text-[9px] font-black leading-none ${selected.invert ? 'bg-white text-indigo-600' : 'bg-slate-900 text-white'}`}>Aa</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setFullscreen(v => !v)}
              title={fullscreen ? 'Recolher tela cheia' : 'Expandir tela cheia'}
              className="px-3 py-2 rounded-lg bg-orange-500 text-white"
            >
              {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>

          {/* Tamanho — acordeão fechado por padrão (largura/altura só importa quando é isso
              que está sendo ajustado). Alternativa em barra às alças de borda do canvas.
              Largura e altura travam independentemente uma da outra. */}
          <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setSizeAccordionOpen(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}
            >
              <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <RulerIcon size={13} className="text-sky-500" /> Tamanho
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400">{selected.w.toFixed(1)} × {selected.h.toFixed(1)}mm</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${sizeAccordionOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {sizeAccordionOpen && (
              <div className="p-3 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span>Largura</span><span className={selected.lockWidth ? 'opacity-40' : ''}>{selected.w.toFixed(1)}mm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateElement(selected.id, { lockWidth: !selected.lockWidth })} className={`p-2.5 rounded-lg shrink-0 ${selected.lockWidth ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {selected.lockWidth ? <Lock size={15} /> : <Unlock size={15} />}
                    </button>
                    <input
                      type="range" min={3} max={Math.max(widthMm, heightMm) * 1.5} step={0.5}
                      value={selected.w}
                      disabled={selected.lockWidth}
                      onChange={e => updateElement(selected.id, { w: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span>Altura</span><span className={selected.lockHeight ? 'opacity-40' : ''}>{selected.h.toFixed(1)}mm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateElement(selected.id, { lockHeight: !selected.lockHeight })} className={`p-2.5 rounded-lg shrink-0 ${selected.lockHeight ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {selected.lockHeight ? <Lock size={15} /> : <Unlock size={15} />}
                    </button>
                    <input
                      type="range" min={3} max={Math.max(widthMm, heightMm) * 1.5} step={0.5}
                      value={selected.h}
                      disabled={selected.lockHeight}
                      onChange={e => updateElement(selected.id, { h: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                  </div>
                </div>

                {selected.type === 'grade' && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span>Tamanho da fonte</span><span className={selected.lockFontSize ? 'opacity-40' : ''}>{(selected.fontSize || 3.5).toFixed(1)}mm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateElement(selected.id, { lockFontSize: !selected.lockFontSize })} className={`p-2.5 rounded-lg shrink-0 ${selected.lockFontSize ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        {selected.lockFontSize ? <Lock size={15} /> : <Unlock size={15} />}
                      </button>
                      <input
                        type="range" min={2} max={20} step={0.5}
                        value={selected.fontSize || 3.5}
                        disabled={selected.lockFontSize}
                        onChange={e => updateElement(selected.id, { fontSize: parseFloat(e.target.value) })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ângulo — acordeão separado, também fechado por padrão. Campo digitado (corrigido:
              não trava mais ao apagar tudo), barra deslizante 0-360°, e +/- com passo
              configurável. Alternativa à alça de girar no canvas, vale pra qualquer tipo de
              elemento (texto, imagem, QR, linha, forma). */}
          <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setAngleAccordionOpen(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}
            >
              <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <RotateCw size={13} className="text-emerald-500" /> Ângulo
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400">{Math.round(selected.rotation)}°</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${angleAccordionOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {angleAccordionOpen && (
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Valor</span>
                  <input
                    type="number"
                    value={angleInput}
                    disabled={selected.lockRotation}
                    onChange={e => {
                      setAngleInput(e.target.value);
                      const raw = parseInt(e.target.value, 10);
                      if (!Number.isNaN(raw)) updateElement(selected.id, { rotation: wrapDeg(raw) });
                    }}
                    onBlur={() => setAngleInput(String(Math.round(selected.rotation)))}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'} ${selected.lockRotation ? 'opacity-40' : ''}`}
                  />
                  <span className="text-[10px] font-black text-slate-400 shrink-0">°</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateElement(selected.id, { lockRotation: !selected.lockRotation })} className={`p-2.5 rounded-lg shrink-0 ${selected.lockRotation ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {selected.lockRotation ? <Lock size={15} /> : <Unlock size={15} />}
                  </button>
                  <input
                    type="range" min={0} max={360} step={rotationStep}
                    value={Math.round(selected.rotation)}
                    disabled={selected.lockRotation}
                    onChange={e => updateElement(selected.id, { rotation: wrapDeg(parseInt(e.target.value, 10)) })}
                    className="flex-1"
                  />
                </div>
                <div className={`flex items-center gap-2 ${selected.lockRotation ? 'opacity-40' : ''}`}>
                  <button
                    type="button"
                    disabled={selected.lockRotation}
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
                    disabled={selected.lockRotation}
                    onClick={() => updateElement(selected.id, { rotation: wrapDeg(Math.round(selected.rotation) + rotationStep) })}
                    className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Arredondamento de Cantos — acordeão separado, igual Tamanho/Ângulo, fechado por
              padrão. Vale pra Formas/Retângulo (contorno) e pra Texto com Inverter ativo (chip
              tipo Referência) — nos outros tipos não faz sentido, então nem aparece. */}
          {(selected.type === 'shape' || (selected.type === 'text' && selected.invert)) && (
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setCornerAccordionOpen(v => !v)}
                className={`w-full flex items-center justify-between px-3 py-2.5 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}
              >
                <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <Radius size={13} className="text-fuchsia-500" /> Arredondamento de Cantos
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400">
                    {selected.type === 'text' && selected.borderRadius === undefined ? 'Auto' : `${(selected.borderRadius || 0).toFixed(1)}mm`}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${cornerAccordionOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {cornerAccordionOpen && (
                <div className="p-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const base = selected.type === 'text' ? (selected.borderRadius ?? Math.min(selected.h / 2, 1.2)) : (selected.borderRadius || 0);
                      updateElement(selected.id, { borderRadius: Math.max(0, base - 0.5) });
                    }}
                    className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  >
                    <Minus size={13} />
                  </button>
                  <span className={`flex-1 text-center text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {selected.type === 'text' && selected.borderRadius === undefined ? 'Auto' : `${(selected.borderRadius || 0).toFixed(1)} mm`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const base = selected.type === 'text' ? (selected.borderRadius ?? Math.min(selected.h / 2, 1.2)) : (selected.borderRadius || 0);
                      updateElement(selected.id, { borderRadius: base + 0.5 });
                    }}
                    className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleDuplicateSelected} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500">
              <Copy size={13} /> Duplicar
            </button>
            <button type="button" onClick={handleDeleteSelected} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-900/20 text-rose-500">
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
  );

  // ─── Rodapé só da visão normal — ferramentas manuais de edição da etiqueta (adicionar
  // elementos). Acordeão fechado por padrão pra não ocupar espaço enquanto não está em uso. ──
  const addElementsFooter = (
      <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <button
          type="button"
          onClick={() => setToolsAccordionOpen(v => !v)}
          className={`w-full flex items-center justify-between px-3 py-2.5 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}
        >
          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <Wrench size={13} className="text-amber-500" /> Ferramentas manuais de edição da etiqueta
          </span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${toolsAccordionOpen ? 'rotate-180' : ''}`} />
        </button>
        {toolsAccordionOpen && (
          <div className="p-3">
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

            {/* Campos da venda — modo de teste (session.batch, ver LabelEditorSession): só
                aparece quando o editor foi aberto a partir de Vendas. Cada botão insere um
                elemento vinculado (LabelElement.dataBinding) que puxa o dado real de cada
                etiqueta do lote na hora de imprimir, em vez de conteúdo estático. */}
            {session.batch && (
              <div className="mt-3 pt-3 border-t border-dashed border-slate-300/50 dark:border-slate-700/50">
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  <Tag size={12} className="text-emerald-500" /> {session.productionContext ? 'Campos do pedido' : 'Campos da venda'}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[...BOUND_FIELD_OPTIONS, ...(session.productionContext ? PRODUCTION_FIELD_OPTIONS : [])].map(({ binding, icon: Icon }) => (
                    <button key={binding} type="button" onClick={() => handleAddBoundField(binding)} className={btnCls()}>
                      <Icon size={16} /> {BINDING_LABELS[binding]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
  );

  const saveButtons = (
    <div className="flex flex-col gap-2">
      {/* Só faz sentido perguntar isso quando o editor abriu a partir de Vendas — fora daí,
          "modelo para Vendas" não tem contexto de venda pra puxar dado nenhum. */}
      {session.batch && !session.productionContext && (
        <label className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold cursor-pointer ${isDarkMode ? 'bg-slate-900 text-slate-300 border border-slate-800' : 'bg-white text-slate-600 border border-slate-100 shadow-sm'}`}>
          <input type="checkbox" checked={isSalesTemplate} onChange={e => setIsSalesTemplate(e.target.checked)} className="w-4 h-4" />
          Modelo para Vendas (aparece na lista pra reusar em outras vendas)
        </label>
      )}
      {session.productionContext && (
        <label className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold cursor-pointer ${isDarkMode ? 'bg-slate-900 text-slate-300 border border-slate-800' : 'bg-white text-slate-600 border border-slate-100 shadow-sm'}`}>
          <input type="checkbox" checked={isProductionTemplate} onChange={e => setIsProductionTemplate(e.target.checked)} className="w-4 h-4" />
          Modelo de Setor (aparece agrupado no PCP pra reusar)
        </label>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => handleSave()} disabled={saving} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          disabled={saving}
          title="Salvar como um novo perfil, sem mexer no que já estava salvo"
          onClick={() => setSaveAsNewModal({ open: true, name: session.fileId ? `${name} (cópia)` : name })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
        >
          <Copy size={14} /> Salvar Como
        </button>
      </div>
      <div className="flex gap-2">
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
          onClick={handleOpenPrintPreview}
          className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleShareJpg}
          disabled={sharingJpg}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
        >
          <ImageIcon2 size={14} /> {sharingJpg ? '...' : 'Compartilhar JPG'}
        </button>
        <button
          type="button"
          onClick={handleSharePdf}
          disabled={sharingPdf}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
        >
          <FileText size={14} /> {sharingPdf ? '...' : 'Compartilhar PDF'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {fullscreen && selected ? (
        // ── Tela cheia focada no elemento selecionado — só canvas, ferramentas ativas
        // daquele tipo, e camadas. Some com nome do arquivo, rodapé de adicionar elemento e
        // botões de salvar/galeria/imprimir.
        <div className={`fixed inset-0 z-[95000] flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
          {/* Sem botão de fechar aqui de propósito — o único controle de abrir/fechar tela
              cheia é o botão dentro do painel do elemento (Maximize2/Minimize2 conforme o
              estado), pra não duplicar a mesma ação em dois lugares. */}
          <div className={`flex items-center gap-2 px-4 py-3 border-b shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            {elementIcon(selected)}
            <span className={`text-[11px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{elementLabel(selected)}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {editorAreaCard}
            {toolPanel}
            {layersPanel}
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do arquivo"
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-black outline-none ${isDarkMode ? 'bg-slate-900 text-white border border-slate-800' : 'bg-white text-slate-900 border border-slate-100 shadow-sm'}`}
            />
            <button
              type="button"
              onClick={() => setShowLayers(v => !v)}
              title="Camadas"
              className={`px-3 rounded-xl shrink-0 ${showLayers ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-900 text-slate-300 border border-slate-800' : 'bg-white text-slate-600 border border-slate-100 shadow-sm'}`}
            >
              <LayersIcon size={16} />
            </button>
            <button
              type="button"
              onClick={handleRotateCanvas}
              title={`Girar área da etiqueta (Paisagem ↔ Retrato) — hoje ${widthMm > heightMm ? 'Paisagem' : 'Retrato'}`}
              className="px-3 rounded-xl shrink-0 bg-purple-800 text-white"
            >
              {widthMm > heightMm ? <RectangleHorizontal size={16} /> : <RectangleVertical size={16} />}
            </button>
          </div>

          {showLayers && layersPanel}

          {editorAreaCard}
          {toolPanel}
          {addElementsFooter}
          {saveButtons}
        </>
      )}

      <LabelPrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        isDarkMode={isDarkMode}
        widthMm={widthMm}
        heightMm={heightMm}
        previewDataUrls={printPreviewImages}
        totalLabelsNote={session.batch?.items && session.batch.items.length > 1 ? `${session.batch.items.length} etiquetas no lote` : undefined}
        onConfirmPrint={handlePrint}
      />

      <Modal isOpen={saveAsNewModal.open} onClose={() => setSaveAsNewModal({ open: false, name: '' })} title="Salvar Como" icon={<Copy size={20} />} maxWidth="max-w-xs" zIndex={98000}>
        <div className="flex flex-col gap-4">
          <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest">
            Cria um modelo novo — o original não é alterado
          </p>
          <div className="flex flex-col gap-1.5">
            <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Nome do perfil</label>
            <input
              autoFocus
              type="text"
              value={saveAsNewModal.name}
              onChange={e => setSaveAsNewModal(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmSaveAsNew(); }}
              maxLength={40}
              className={`w-full px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
            />
          </div>
          <button
            type="button"
            disabled={!saveAsNewModal.name.trim() || saving}
            onClick={handleConfirmSaveAsNew}
            className="py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Check size={13} /> Salvar
          </button>
        </div>
      </Modal>

      <ImageSourcePickerModal
        isOpen={showImageSourcePicker}
        onClose={() => setShowImageSourcePicker(false)}
        isDarkMode={isDarkMode}
        onPickCamera={() => pickImage(CameraSource.Camera)}
        onPickGallery={() => pickImage(CameraSource.Photos)}
      />

      {selected && (
        <Modal isOpen={notePickerOpen} onClose={() => setNotePickerOpen(false)} title="Instrução a Exibir" icon={<StickyNote size={20} />} maxWidth="max-w-md" zIndex={98000}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { updateElement(selected.id, { sectorNoteFilter: undefined }); setNotePickerOpen(false); }}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                !selected.sectorNoteFilter
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${!selected.sectorNoteFilter ? 'border-indigo-500 bg-indigo-500 text-white' : isDarkMode ? 'border-slate-600' : 'border-slate-300'}`}>
                {!selected.sectorNoteFilter && <Check size={12} strokeWidth={3} />}
              </span>
              <span className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Todas as instruções</span>
            </button>

            {availableSectorNotes.map(n => {
              const isSel = selected.sectorNoteFilter?.sectorId === n.sectorId && selected.sectorNoteFilter?.noteName === n.noteName;
              return (
                <button
                  key={`${n.sectorId}::${n.noteName}`}
                  type="button"
                  onClick={() => { updateElement(selected.id, { sectorNoteFilter: { sectorId: n.sectorId, noteName: n.noteName } }); setNotePickerOpen(false); }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                    isSel ? 'border-indigo-500 bg-indigo-500/10' : isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${isSel ? 'border-indigo-500 bg-indigo-500 text-white' : isDarkMode ? 'border-slate-600' : 'border-slate-300'}`}>
                    {isSel && <Check size={12} strokeWidth={3} />}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{n.noteName}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate">{n.sectorName} — {n.text}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

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
