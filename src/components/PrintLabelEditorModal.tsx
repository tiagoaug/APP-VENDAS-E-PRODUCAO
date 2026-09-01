import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Printer, ChevronDown,
  RotateCcw, Eye, EyeOff, Plus, Minus, Settings2, FileText, Tag,
  Image as ImageIcon, Layers, Check, X, Lock, Unlock, BookmarkPlus, Pencil, Trash2, BookOpen, Bluetooth, Share2, RefreshCw,
  HelpCircle, Hand, Maximize2, Sparkles, Square, Package, Download,
} from 'lucide-react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import Modal from './Modal';
import LabelPrintPreviewModal, { PrintOptions } from './LabelPrintPreviewModal';
import { Product, Variation, SaleType, LabelLayout, Grid, ProductionLot, ServiceOrder, Sector, SectorNote, BatchLabelItem } from '../types';
import { labelService } from '../services/labelService';
import { shareImage, shareImages } from '../utils/pdfExport';
import { toast } from '../utils/toast';
import { combineRefFields, parseSizeGridEntries, getSectorNotesText } from '../utils/labelFieldResolvers';
import { isAblemarkPlatform, AbleMarkPairedDevice } from '../lib/ablemarkPrinter';
import {
  isAbleMarkPrinterConnected2 as isAbleMarkPrinterConnected,
  printAbleMarkLabel2 as printAbleMarkLabel,
  listAbleMarkPairedDevices2 as listAbleMarkPairedDevices,
  connectAbleMarkPrinter2 as connectAbleMarkPrinter,
} from '../lib/ablemarkPrinter2';
import { saveImageToGallery, isGallerySaverPlatform } from '../lib/gallerySaver';
import { applyPrintTransform, DIRECTION_TO_ROTATION } from '../utils/labelPrintTransform';

// ─── Types ────────────────────────────────────────────────────────────────────

type ElemKey    = 'reference' | 'name' | 'color' | 'size' | 'qr' | 'footer' | 'photo' | 'grade' | 'osdata' | 'sectornotes' | 'packaging' | 'customer' | 'recipient';
type FontFamily = 'helvetica' | 'arial' | 'times' | 'courier' | 'avenir';
type Elem = {
  x: number; y: number; w: number; h: number;
  label: string; color: string; visible: boolean;
  fontSize?: number; fontFamily?: FontFamily; bold?: boolean;
  noteFilter?: { sectorId: string; noteName: string };
  // Efeito "chip": fundo preenchido (preto, ou a cor do elemento) com retângulo arredondado e
  // texto branco por cima — mesmo visual já usado nas pílulas da Grade, só que disponível pra
  // qualquer elemento de texto (ver botão "Inverter" na Tipografia).
  invert?: boolean;
  // Trava o elemento contra arraste/redimensionamento (Ajustar) — pra depois de posicionar do
  // jeito certo, não mover por engano tocando na etiqueta sem querer.
  locked?: boolean;
  // Só usado no elemento 'reference' — junta Referência/Nome/Cor num campo só, na ordem fixa
  // Ref → Nome → Cor, com qualquer combinação dos três (ex.: só Ref+Cor). Ausente/vazio =
  // comportamento de sempre (cada um no seu próprio elemento/posição).
  combineFields?: ('reference' | 'name' | 'color')[];
};
// Formas decorativas (retângulo de bordas arredondadas / linha) — ao contrário dos slots fixos
// acima (um por ElemKey), dá pra ter várias, adicionadas/removidas livremente pelo usuário.
type ShapeKind = 'rect' | 'line';
type ShapeElem = {
  id: string;
  kind: ShapeKind;
  x: number; y: number; w: number; h: number; // linha: ponto final é (x+w, y+h)
  color: string;
  strokeWidth: number;
  radius?: number;   // só 'rect'
  filled?: boolean;  // só 'rect' — preenchido vs. só contorno
  dashed?: boolean;  // contorno/linha tracejada em vez de contínua
  visible?: boolean; // ausente = true (compat com formas salvas antes desse campo existir)
  // Rotação em graus (0-359), só 'rect' — gira em torno do próprio centro. 'line' não usa
  // esse campo: o ângulo dela já está embutido no vetor (x,y)→(x+w,y+h); a ferramenta de
  // girar recalcula w/h mantendo comprimento e centro em vez de guardar um ângulo à parte.
  rotation?: number;
};
type Layout = { paper: [number, number]; elems: Record<ElemKey, Elem>; shapes?: ShapeElem[] };

// ─── Size presets ─────────────────────────────────────────────────────────────

const THERMAL_SIZES: { label: string; dims: [number, number]; star?: boolean }[] = [
  { label: '75 × 24 mm',  dims: [75, 24],  star: true },
  { label: '38 × 25 mm',  dims: [38, 25]  },
  { label: '50 × 30 mm',  dims: [50, 30]  },
  { label: '57 × 40 mm',  dims: [57, 40]  },
  { label: '80 × 40 mm',  dims: [80, 40]  },
  { label: '80 × 50 mm',  dims: [80, 50]  },
  { label: '100 × 50 mm', dims: [100, 50] },
  { label: '100 × 40 mm', dims: [100, 40] },
  { label: '40 × 30 mm',  dims: [40, 30]  },
];

const ELEM_KEYS: ElemKey[] = ['reference', 'name', 'color', 'size', 'qr', 'footer', 'photo', 'grade', 'osdata', 'sectornotes', 'packaging', 'customer', 'recipient'];
// Nome e Cor não aparecem mais como blocos independentes — viraram opções dentro do elemento
// Referência (ver Elem.combineFields / "Combinar Campos Neste Elemento"), então somem tanto da
// lista de Configurar Elementos quanto do arraste em Ajustar. Continuam existindo dentro de
// `Layout.elems` (Record<ElemKey, Elem> exige todas as chaves) só como fonte de texto.
const CONFIG_LIST_KEYS: ElemKey[] = ELEM_KEYS.filter(k => k !== 'name' && k !== 'color');
const STORAGE_SIZE    = 'lbl_print_size';
const STORAGE_MANUAL  = 'lbl_print_manual';
const STORAGE_LAYOUTS = 'lbl_print_layouts_v1';
const STORAGE_PRESETS = 'lbl_custom_presets_v1';

type CustomPreset = {
  id: string;
  name: string;
  dims: [number, number];
  layout: Layout;
};

function loadCustomPresets(): CustomPreset[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_PRESETS) || '[]'); } catch { return []; }
}
function saveCustomPresets(presets: CustomPreset[]) {
  localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets));
}

// ─── Default layouts ──────────────────────────────────────────────────────────

function isThermal([W, H]: [number, number]) { return H <= 60 || W > H * 1.5; }

function defaultLayout([W, H]: [number, number]): Layout {
  if (isThermal([W, H])) {
    const qrSize = Math.min(H - 4, W * 0.34);
    const textW  = W - qrSize - 5;
    const qrX    = W - qrSize - 2;
    const qrY    = (H - qrSize) / 2;
    const photoSize = Math.min(H - 4, W * 0.28);
    return {
      paper: [W, H],
      elems: {
        reference: { x: 0,   y: 0,          w: textW, h: H * 0.32, label: 'Referência', color: '#000000', visible: true,  fontSize: 7,   fontFamily: 'helvetica', bold: true  },
        name:      { x: 0,   y: H * 0.32,   w: textW, h: H * 0.26, label: 'Nome',       color: '#000000', visible: false, fontSize: 5,   fontFamily: 'helvetica', bold: false },
        color:     { x: 0,   y: H * 0.42,   w: textW, h: H * 0.28, label: 'Cor',        color: '#000000', visible: true,  fontSize: 5.5, fontFamily: 'helvetica', bold: false },
        size:      { x: 0,   y: H * 0.68,   w: textW, h: H * 0.32, label: 'Tamanho',    color: '#000000', visible: true,  fontSize: 9,   fontFamily: 'helvetica', bold: true  },
        qr:        { x: qrX, y: qrY,        w: qrSize,h: qrSize,   label: 'QR Code',    color: '#000000', visible: true,  fontSize: 8,   fontFamily: 'helvetica', bold: false },
        footer:    { x: 0,   y: H - 2,      w: W,     h: 2,        label: 'Rodapé',     color: '#000000', visible: false, fontSize: 3,   fontFamily: 'helvetica', bold: false },
        photo:     { x: 2,   y: H - photoSize - 2, w: photoSize, h: photoSize, label: 'Foto', color: '#000000', visible: false, fontSize: 6,   fontFamily: 'helvetica', bold: false },
        grade:     { x: 0,   y: H * 0.62,   w: textW, h: H * 0.38, label: 'Grade',      color: '#f59e0b', visible: false, fontSize: 5,   fontFamily: 'helvetica', bold: true  },
        osdata:      { x: 0,   y: H - 3,      w: textW, h: 3,        label: 'Dados OS',       color: '#6366f1', visible: false, fontSize: 3.5, fontFamily: 'helvetica', bold: false },
        sectornotes: { x: 0,   y: H - 4,      w: textW, h: 4,        label: 'Obs. Variante',  color: '#f97316', visible: false, fontSize: 3,   fontFamily: 'helvetica', bold: false },
        packaging:   { x: 0,   y: H * 0.32,   w: textW, h: H * 0.26, label: 'Embalagem',      color: '#0d9488', visible: false, fontSize: 4.5, fontFamily: 'helvetica', bold: false },
        customer:    { x: 0,   y: H * 0.42,   w: textW, h: H * 0.26, label: 'Cliente',        color: '#7c3aed', visible: false, fontSize: 4.5, fontFamily: 'helvetica', bold: false },
        recipient:   { x: 0,   y: H * 0.68,   w: textW, h: H * 0.26, label: 'Cliente de Cliente', color: '#db2777', visible: false, fontSize: 4.5, fontFamily: 'helvetica', bold: false },
      },
    };
  }
  const s = Math.min(W, H) / 40;
  const photoSz = 12 * s;
  return {
    paper: [W, H],
    elems: {
      reference:   { x: 0,        y: 0,       w: W,     h: 6*s,     label: 'Referência',    color: '#000000', visible: true,  fontSize: 8*s,  fontFamily: 'helvetica', bold: true  },
      name:        { x: 2*s,      y: 7*s,     w: W-4*s, h: 5*s,     label: 'Nome',          color: '#000000', visible: true,  fontSize: 6*s,  fontFamily: 'helvetica', bold: false },
      color:       { x: 0,        y: H-4*s,   w: W,     h: 4*s,     label: 'Cor',           color: '#000000', visible: true,  fontSize: 7*s,  fontFamily: 'helvetica', bold: true  },
      size:        { x: W-9*s,    y: 5*s,     w: 8*s,   h: 8*s,     label: 'Tamanho',       color: '#000000', visible: true,  fontSize: 11*s, fontFamily: 'helvetica', bold: true  },
      qr:          { x: (W-20*s)/2, y: 6*s,  w: 20*s,  h: 20*s,    label: 'QR Code',       color: '#000000', visible: true,  fontSize: 8,    fontFamily: 'helvetica', bold: false },
      footer:      { x: 0,        y: H-2*s,   w: W,     h: 2*s,     label: 'Rodapé',        color: '#000000', visible: true,  fontSize: 4*s,  fontFamily: 'helvetica', bold: false },
      photo:       { x: W-photoSz, y: H-4*s-photoSz, w: photoSz, h: photoSz, label: 'Foto', color: '#000000', visible: false, fontSize: 6,    fontFamily: 'helvetica', bold: false },
      grade:       { x: 2*s,      y: H-10*s,  w: W-4*s, h: 7*s,     label: 'Grade',         color: '#f59e0b', visible: false, fontSize: 6*s,  fontFamily: 'helvetica', bold: true  },
      osdata:      { x: 2*s,      y: H-3.5*s, w: W-4*s, h: 3*s,     label: 'Dados OS',      color: '#6366f1', visible: false, fontSize: 4*s,  fontFamily: 'helvetica', bold: false },
      sectornotes: { x: 2*s,      y: H-7*s,   w: W-4*s, h: 4*s,     label: 'Obs. Variante', color: '#f97316', visible: false, fontSize: 3.5*s,fontFamily: 'helvetica', bold: false },
      packaging:   { x: 2*s,      y: 12*s,    w: W-4*s, h: 5*s,     label: 'Embalagem',     color: '#0d9488', visible: false, fontSize: 5*s,  fontFamily: 'helvetica', bold: false },
      customer:    { x: 2*s,      y: 17*s,    w: W-4*s, h: 5*s,     label: 'Cliente',       color: '#7c3aed', visible: false, fontSize: 5*s,  fontFamily: 'helvetica', bold: false },
      recipient:   { x: 2*s,      y: 22*s,    w: W-4*s, h: 5*s,     label: 'Cliente de Cliente', color: '#db2777', visible: false, fontSize: 5*s,  fontFamily: 'helvetica', bold: false },
    },
  };
}

function loadLayouts(): Record<string, Layout> {
  try { return JSON.parse(localStorage.getItem(STORAGE_LAYOUTS) || '{}'); } catch { return {}; }
}

// ─── Ruler ────────────────────────────────────────────────────────────────────

function Ruler({ axis, totalMm, scale, isDark }: { axis: 'h'|'v'; totalMm: number; scale: number; isDark: boolean }) {
  const SIZE = 14;
  const bg = isDark ? '#1e293b' : '#f1f5f9', brd = isDark ? '#334155' : '#cbd5e1', tc = isDark ? '#64748b' : '#94a3b8';
  const ticks: { pos: number; mm: number; major: boolean; mid: boolean }[] = [];
  for (let mm = 0; mm <= totalMm; mm++) {
    const major = mm % 10 === 0, mid = mm % 5 === 0;
    if (!major && !mid && scale < 2) continue;
    ticks.push({ pos: mm * scale, mm, major, mid });
  }
  if (axis === 'h') return (
    <div style={{ position:'relative', width: totalMm*scale, height: SIZE, backgroundColor: bg, borderBottom:`1px solid ${brd}`, flexShrink:0, overflow:'hidden' }}>
      {ticks.map(({ pos, mm, major, mid }) => (
        <div key={mm} style={{ position:'absolute', left: pos, top:0, display:'flex', flexDirection:'column', alignItems:'center', transform:'translateX(-50%)' }}>
          <div style={{ width:1, height: major?8:mid?5:3, backgroundColor: tc }}/>
          {major && mm > 0 && <span style={{ fontSize:6, color:tc, lineHeight:1, marginTop:1 }}>{mm}</span>}
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ position:'relative', width: SIZE, height: totalMm*scale, backgroundColor: bg, borderRight:`1px solid ${brd}`, flexShrink:0, overflow:'hidden' }}>
      {ticks.map(({ pos, mm, major, mid }) => (
        <div key={mm} style={{ position:'absolute', top: pos, left:0, display:'flex', alignItems:'center', transform:'translateY(-50%)' }}>
          <div style={{ height:1, width: major?8:mid?5:3, backgroundColor: tc }}/>
          {major && mm > 0 && <span style={{ fontSize:6, color:tc, lineHeight:1, marginLeft:1, writingMode:'vertical-rl', transform:'rotate(180deg)' }}>{mm}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean; onClose: () => void;
  product: Product; isDarkMode: boolean;
  grids?: Grid[];
  lot?: ProductionLot;
  sizeGridOverride?: string;
  os?: ServiceOrder | null;
  sectors?: Sector[];
  batchItems?: BatchLabelItem[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrintLabelEditorModal({ isOpen, onClose, product, isDarkMode, grids = [], lot, sizeGridOverride, os, sectors = [], batchItems }: Props) {
  const [sizeKey, setSizeKey]     = useState<string>(() => localStorage.getItem(STORAGE_SIZE) || '75x24');
  const [layouts, setLayouts]     = useState<Record<string, Layout>>(loadLayouts);
  const [selected, setSelected]   = useState<ElemKey | null>(null);
  // Forma decorativa selecionada (retângulo/linha) — separado de `selected` (que só cobre os
  // slots fixos) porque formas são uma lista dinâmica, não uma chave fixa.
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [tab, setTab]             = useState<'view'|'edit'>('view');
  // Tela cheia do canvas de ajuste — isola o arraste dos elementos da rolagem da página (o
  // canvas fica sozinho num overlay fixo, sem nada por perto pra brigar com o gesto de
  // arrastar); sai só pelo X, sem gesto de fechar por swipe.
  const [fullscreenEdit, setFullscreenEdit] = useState(false);
  // Dentro da tela cheia: alterna entre o canvas de ajuste (com réguas, arrastável) e a
  // pré-visualização da etiqueta pronta (mesmo ContentPreview da aba Visualizar) — pra
  // conferir o resultado sem precisar sair da tela cheia.
  const [fullscreenPreviewMode, setFullscreenPreviewMode] = useState(false);
  const [elemConfigOpen, setElemConfigOpen] = useState(false);
  // Popup de dicas — abre sozinho na primeira vez que alguém usa o editor neste aparelho
  // (localStorage), sempre revisitável pelo botão de "?" ao lado das abas Visualizar/Ajustar.
  const [tipsModalOpen, setTipsModalOpen] = useState(() => {
    try { return !localStorage.getItem('lbl_print_tips_seen_v1'); } catch { return false; }
  });
  const dismissTips = () => {
    setTipsModalOpen(false);
    try { localStorage.setItem('lbl_print_tips_seen_v1', '1'); } catch {}
  };
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [sizeAccordionOpen, setSizeAccordionOpen] = useState(false);
  const [myPresetsPopupOpen, setMyPresetsPopupOpen] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [exportingJpg, setExportingJpg] = useState(false);
  const [savingGallery, setSavingGallery] = useState(false);
  const [preparingBt, setPreparingBt] = useState(false);
  const [showBtPreview, setShowBtPreview] = useState(false);
  const [btFramesCache, setBtFramesCache] = useState<HTMLCanvasElement[]>([]);
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);
  const [btDevices, setBtDevices] = useState<AbleMarkPairedDevice[]>([]);
  const [loadingBtDevices, setLoadingBtDevices] = useState(false);
  const [connectingBtAddress, setConnectingBtAddress] = useState<string | null>(null);
  const [showShareFormatPicker, setShowShareFormatPicker] = useState(false);
  const [qrPreview, setQrPreview] = useState('');

  // Custom presets — padrões salvos pelo usuário
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(loadCustomPresets);
  const [savePresetModal, setSavePresetModal] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const [renamePreset, setRenamePreset] = useState<{ id: string; name: string } | null>(null);

  // Exportação JPG em lote (múltiplos pedidos selecionados)
  const [jpgSpacing, setJpgSpacing]   = useState(2);
  const [jpgBatchMode, setJpgBatchMode] = useState<'combined' | 'separate'>('combined');

  // Label options
  const [selectedVariationId, setSelectedVariationId] = useState(
    batchItems?.[0]?.variation.id || lot?.variationId || (product.variations || [])[0]?.id || ''
  );
  const [selectedSizes, setSelectedSizes]             = useState<string[]>([]);
  const [useStockQty, setUseStockQty]                 = useState(false);
  const [isBoxLabel, setIsBoxLabel]                   = useState(!!sizeGridOverride || product.type === SaleType.WHOLESALE);
  const [customQty, setCustomQty]                     = useState(1);

  // Manual size
  const savedManual = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_MANUAL) || '[50,30]'); } catch { return [50, 30]; } })();
  const [manualW, setManualW] = useState<number>(savedManual[0]);
  const [manualH, setManualH] = useState<number>(savedManual[1]);

  const paperDims: [number, number] = (() => {
    if (sizeKey === 'manual') return [manualW, manualH];
    const p = sizeKey.split('x').map(Number);
    return p.length === 2 && !isNaN(p[0]) ? [p[0], p[1]] : [75, 24];
  })();
  const [W, H] = paperDims;

  const MAX_W  = Math.min(420, (typeof window !== 'undefined' ? window.innerWidth : 480) - 64) - 14;
  const MAX_H  = 280;
  const RULER  = 14;
  const scaleW = MAX_W / W, scaleH = MAX_H / H;
  const scale  = Math.min(scaleW, scaleH);
  const previewW = W * scale, previewH = H * scale;

  const rawLayout = layouts[sizeKey === 'manual' ? `${manualW}x${manualH}` : sizeKey] ?? defaultLayout(paperDims);
  const def = defaultLayout(paperDims);
  // "Foto" salva de uma versão antiga do editor podia ter w/h zerados (bug já corrigido no
  // padrão de fábrica, ver `photoSize` acima) — sem esse saneamento, quem já tinha essa
  // etiqueta salva continuaria vendo o bloco em tamanho zero mesmo depois da correção.
  const savedPhoto = rawLayout.elems?.photo;
  const sanitizedElems = savedPhoto && (savedPhoto.w <= 0 || savedPhoto.h <= 0)
    ? { ...rawLayout.elems, photo: { ...def.elems.photo, visible: savedPhoto.visible } }
    : rawLayout.elems;
  const layout: Layout = {
    ...rawLayout,
    elems: {
      ...def.elems,
      ...(sanitizedElems || {}),
    },
    shapes: rawLayout.shapes || [],
  };

  const variation = (product.variations || []).find(v => v.id === selectedVariationId) || (product.variations || [])[0];
  const availSizes = variation ? Object.keys(variation.stock).filter(s => s !== 'WHOLESALE') : [];

  // Etiqueta de um único pedido vinculado a um mapa: embute o roteamento (mapa/pedido)
  // no QR Code para que o "Escanear" do PCP abra direto o pedido correspondente. Etiqueta
  // gerada a partir de uma Venda (sem mapa) embute o id da venda com o marcador "SALE" em
  // vez disso, pro Scanner Rápido abrir a venda direto (ver scannerService.ts).
  const routeItem = batchItems?.length === 1 ? batchItems[0] : undefined;
  const qrRouteSuffix = (routeItem?.lotId && routeItem?.orderId)
    ? `|${routeItem.lotId}|${routeItem.orderId}|${routeItem.itemIdx ?? ''}`
    : (routeItem?.saleId ? `|SALE|${routeItem.saleId}` : '');

  const sectorNotesText: string = getSectorNotesText(variation, sectors, layout.elems.sectornotes.noteFilter);
  // Prévia (aba Visualizar) só mostra um representante do lote — o valor de verdade, por
  // etiqueta, só existe mesmo na hora de gerar (ver drawFrame/batchItems abaixo).
  const previewPackagingName: string | undefined = batchItems?.[0]?.packagingName;
  const previewCustomerName: string | undefined = batchItems?.[0]?.customerName;
  const previewRecipientName: string | undefined = batchItems?.[0]?.recipientName;

  // Lista de descrições por setor disponíveis pra escolher em "Obs. Variante" (ver
  // Configurar Elementos). Em impressão em lote (batchItems, várias etiquetas de uma vez —
  // possivelmente com variantes diferentes), reúne a UNIÃO das opções de todas as variantes
  // do lote, não só a variante "atual" — cada etiqueta resolve seu próprio texto pra essa
  // escolha na hora de desenhar (ver buildLabelFrames), então a lista só precisa cobrir
  // todas as opções possíveis, não decidir qual variante "vale".
  const sectorNotesSourceVariations: (Variation | undefined)[] =
    batchItems && batchItems.length > 0 ? batchItems.map(bi => bi.variation) : [variation];
  const availableSectorNotes: { sectorId: string; sectorName: string; noteName: string; text: string }[] = (() => {
    const seen = new Map<string, { sectorId: string; sectorName: string; noteName: string; text: string }>();
    for (const v of sectorNotesSourceVariations) {
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
  const previewSize = selectedSizes[0] || availSizes[0] || '38';

  const activeGrid = grids.find(g => g.id === product.defaultGridId);
  const sizeGrid = (() => {
    // Prévia (Visualizar) em modo lote — usa a grade REAL já calculada pra essa caixa
    // específica (ver handleOpenSaleLabels em SalesView.tsx), em vez de recalcular a partir
    // do produto/variação "representante" do lote (que ignora StockLot/embalagem real).
    if (batchItems && batchItems.length > 0 && batchItems[0].sizeGrid) return batchItems[0].sizeGrid;
    if (sizeGridOverride) return sizeGridOverride;
    if (lot?.pairs && Object.keys(lot.pairs).length > 0) {
      return Object.entries(lot.pairs)
        .filter(([, qty]) => qty > 0)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([sz, qty]) => `${sz}x${qty}`)
        .join('-');
    }
    const sizes = availSizes.slice().sort((a, b) => Number(a) - Number(b));
    // Sempre que existe grade cadastrada, a lista de tamanhos vem da PRÓPRIA grade
    // (Grid.configuration), não do estoque da variante — assim todo tamanho impresso já vem
    // com a quantidade de pares junto ("38x2"), nunca um tamanho solto sem par nenhum (podia
    // acontecer antes se a variante tivesse um tamanho no estoque que não constava na grade).
    if (activeGrid) {
      const gridSizes = Object.entries(activeGrid.configuration)
        .filter(([, qty]) => qty > 0)
        .sort(([a], [b]) => Number(a) - Number(b));
      if (gridSizes.length > 0) return gridSizes.map(([s, qty]) => `${s}x${qty}`).join('-');
    }
    const nonZeroStock = variation ? sizes.filter(s => (variation.stock[s] ?? 0) > 0) : [];
    if (nonZeroStock.length > 0) return nonZeroStock.map(s => `${s}x${variation!.stock[s]}`).join('-');
    return sizes.join('-');
  })();
  const sizeGridEntries = parseSizeGridEntries(sizeGrid);

  useEffect(() => {
    const qd = isBoxLabel
      ? `PRD|${product.id}|${variation?.id || ''}|WHOLESALE${qrRouteSuffix}`
      : `PRD|${product.id}|${variation?.id || ''}|${previewSize}${qrRouteSuffix}`;
    labelService.generateQRCode(qd).then(setQrPreview);
  }, [product.id, variation?.id, previewSize, isBoxLabel, qrRouteSuffix]);

  // `setLayouts` fica só em memória aqui — a persistência em disco (localStorage) roda
  // separada, debounced, no efeito logo abaixo. Antes, `localStorage.setItem(JSON.stringify(...))`
  // rodava SÍNCRONO dentro de cada chamada de saveLayout, ou seja, em CADA pointermove de um
  // arraste (60+ vezes por segundo): cada frame do gesto ficava esperando uma escrita em disco
  // terminar antes de repintar, e isso é o que fazia o arraste (principalmente de linha/forma)
  // parecer travado/não-contínuo no Android. Update funcional (`prev => ...`) também tira a
  // dependência de `layouts` do useCallback, então essa função não fica sendo recriada a cada
  // arraste.
  const saveLayout = useCallback((l: Layout) => {
    const key = sizeKey === 'manual' ? `${manualW}x${manualH}` : sizeKey;
    setLayouts(prev => ({ ...prev, [key]: l }));
  }, [sizeKey, manualW, manualH]);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_LAYOUTS, JSON.stringify(layouts));
    }, 400);
    return () => clearTimeout(t);
  }, [layouts]);

  const updateElem  = (key: ElemKey, patch: Partial<Elem>) =>
    saveLayout({ ...layout, elems: { ...layout.elems, [key]: { ...layout.elems[key], ...patch } } });
  const moveElem    = (key: ElemKey, dx: number, dy: number) => {
    const e = layout.elems[key];
    if (e.locked) return;
    updateElem(key, { x: Math.max(0, Math.min(W - e.w, e.x + dx)), y: Math.max(0, Math.min(H - e.h, e.y + dy)) });
  };
  const resizeElem  = (key: ElemKey, dw: number, dh: number) => {
    const e = layout.elems[key];
    if (e.locked) return;
    updateElem(key, { w: Math.max(5, Math.min(W - e.x, e.w + dw)), h: Math.max(2, Math.min(H - e.y, e.h + dh)) });
  };

  // ── Formas decorativas (retângulo/linha) ──────────────────────────────────────
  const addShape = (kind: ShapeKind) => {
    const id = `shape_${Date.now()}_${Math.round(Math.random() * 1000)}`;
    const shape: ShapeElem = kind === 'rect'
      ? { id, kind, x: W * 0.15, y: H * 0.15, w: W * 0.5, h: H * 0.3, color: '#000000', strokeWidth: 1, radius: 2, filled: false }
      : { id, kind, x: W * 0.1, y: H * 0.5, w: W * 0.6, h: 0, color: '#000000', strokeWidth: 0.5 };
    saveLayout({ ...layout, shapes: [...(layout.shapes || []), shape] });
    setSelected(null);
    setSelectedShapeId(id);
  };
  const updateShape = (id: string, patch: Partial<ShapeElem>) =>
    saveLayout({ ...layout, shapes: (layout.shapes || []).map(s => s.id === id ? { ...s, ...patch } : s) });
  const deleteShape = (id: string) => {
    saveLayout({ ...layout, shapes: (layout.shapes || []).filter(s => s.id !== id) });
    setSelectedShapeId(null);
  };
  const moveShape = (id: string, dx: number, dy: number) => {
    const s = (layout.shapes || []).find(sh => sh.id === id);
    if (!s) return;
    updateShape(id, { x: Math.max(0, Math.min(W - Math.max(0, s.w), s.x + dx)), y: Math.max(0, Math.min(H - Math.max(0, s.h), s.y + dy)) });
  };
  const resizeShape = (id: string, dw: number, dh: number) => {
    const s = (layout.shapes || []).find(sh => sh.id === id);
    if (!s) return;
    if (s.kind === 'line') {
      updateShape(id, { w: s.w + dw, h: s.h + dh });
    } else {
      updateShape(id, { w: Math.max(5, Math.min(W - s.x, s.w + dw)), h: Math.max(5, Math.min(H - s.y, s.h + dh)) });
    }
  };

  // Arrastar bloco direto na área da etiqueta (Ajustar) — alternativa aos steppers de X/Y em
  // "Configurar Elementos". Guarda a posição ORIGINAL do elemento e do ponteiro no pointerdown
  // (não a última posição) — cada pointermove recalcula x/y ABSOLUTO a partir dessas duas
  // âncoras fixas, em vez de somar um delta incremental em cima do estado atual. Isso importa
  // porque o React 18 pode enfileirar (batch) vários pointermove do Android numa render só; com
  // delta incremental, os eventos "perdidos" no meio do lote simplesmente desapareciam e o
  // arraste avançava só ~1mm por lote inteiro em vez do total arrastado. Com âncora fixa, o
  // ÚLTIMO evento do lote já calcula a posição final correta sozinho, então nada se perde.
  // `setPointerCapture` garante que o arraste continua liso mesmo se o dedo sair da área do
  // bloco antes de soltar.
  const dragRef = useRef<{ key: ElemKey; baseX: number; baseY: number; startX: number; startY: number } | null>(null);
  const [draggingKey, setDraggingKey] = useState<ElemKey | null>(null);

  const handleElemPointerDown = (e: React.PointerEvent<HTMLDivElement>, key: ElemKey) => {
    e.stopPropagation();
    setSelected(key);
    setSelectedShapeId(null);
    // Elemento travado: ainda seleciona (pra destravar/ajustar fonte etc), só não inicia
    // arraste — evita mover sem querer depois de já ter posicionado do jeito certo.
    if (layout.elems[key].locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = layout.elems[key];
    dragRef.current = { key, baseX: el.x, baseY: el.y, startX: e.clientX, startY: e.clientY };
    setDraggingKey(key);
  };
  const handleElemPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dxMm = (e.clientX - drag.startX) / scale;
    const dyMm = (e.clientY - drag.startY) / scale;
    const el = layout.elems[drag.key];
    updateElem(drag.key, {
      x: Math.max(0, Math.min(W - el.w, drag.baseX + dxMm)),
      y: Math.max(0, Math.min(H - el.h, drag.baseY + dyMm)),
    });
  };
  const handleElemPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }
    dragRef.current = null;
    setDraggingKey(null);
  };

  // Mesmo mecanismo de arraste acima (âncora fixa no pointerdown), só que pra formas (lista
  // dinâmica em vez de chave fixa).
  const shapeDragRef = useRef<{ id: string; baseX: number; baseY: number; startX: number; startY: number } | null>(null);
  const [draggingShapeId, setDraggingShapeId] = useState<string | null>(null);

  const handleShapePointerDown = (e: React.PointerEvent<Element>, id: string) => {
    e.stopPropagation();
    setSelectedShapeId(id);
    setSelected(null);
    try { (e.currentTarget as Element & { setPointerCapture: (id: number) => void }).setPointerCapture(e.pointerId); } catch {}
    const s = (layout.shapes || []).find(sh => sh.id === id);
    if (!s) return;
    shapeDragRef.current = { id, baseX: s.x, baseY: s.y, startX: e.clientX, startY: e.clientY };
    setDraggingShapeId(id);
  };
  const handleShapePointerMove = (e: React.PointerEvent<Element>) => {
    const drag = shapeDragRef.current;
    if (!drag) return;
    const dxMm = (e.clientX - drag.startX) / scale;
    const dyMm = (e.clientY - drag.startY) / scale;
    const s = (layout.shapes || []).find(sh => sh.id === drag.id);
    if (!s) return;
    updateShape(drag.id, {
      x: Math.max(0, Math.min(W - Math.max(0, s.w), drag.baseX + dxMm)),
      y: Math.max(0, Math.min(H - Math.max(0, s.h), drag.baseY + dyMm)),
    });
  };
  const handleShapePointerUp = (e: React.PointerEvent<Element>) => {
    if (shapeDragRef.current) { try { (e.currentTarget as Element & { releasePointerCapture: (id: number) => void }).releasePointerCapture(e.pointerId); } catch {} }
    shapeDragRef.current = null;
    setDraggingShapeId(null);
  };

  // Arrastar as pontas de uma linha (endpoint 0 = início, 1 = fim) — muda ângulo/comprimento
  // sem mover a linha inteira. Endpoint 0 desloca x/y mantendo o fim fixo (compensa w/h);
  // endpoint 1 só ajusta w/h, x/y fica parado. Mesma âncora fixa no pointerdown (ver comentário
  // acima) — sem isso as alças praticamente não respondiam no Android (cada lote de eventos
  // batched do WebView só aplicava a última sub-mexida, não a soma do arraste inteiro).
  const endpointDragRef = useRef<{ shapeId: string; endpoint: 0 | 1; baseX: number; baseY: number; baseW: number; baseH: number; startX: number; startY: number } | null>(null);
  const handleEndpointPointerDown = (e: React.PointerEvent<Element>, shapeId: string, endpoint: 0 | 1) => {
    e.stopPropagation();
    try { (e.currentTarget as Element & { setPointerCapture: (id: number) => void }).setPointerCapture(e.pointerId); } catch {}
    const s = (layout.shapes || []).find(sh => sh.id === shapeId);
    if (!s) return;
    endpointDragRef.current = { shapeId, endpoint, baseX: s.x, baseY: s.y, baseW: s.w, baseH: s.h, startX: e.clientX, startY: e.clientY };
  };
  const handleEndpointPointerMove = (e: React.PointerEvent<Element>) => {
    const drag = endpointDragRef.current;
    if (!drag) return;
    const dxMm = (e.clientX - drag.startX) / scale;
    const dyMm = (e.clientY - drag.startY) / scale;
    if (drag.endpoint === 0) {
      updateShape(drag.shapeId, { x: drag.baseX + dxMm, y: drag.baseY + dyMm, w: drag.baseW - dxMm, h: drag.baseH - dyMm });
    } else {
      updateShape(drag.shapeId, { w: drag.baseW + dxMm, h: drag.baseH + dyMm });
    }
  };
  const handleEndpointPointerUp = (e: React.PointerEvent<Element>) => {
    if (endpointDragRef.current) { try { (e.currentTarget as Element & { releasePointerCapture: (id: number) => void }).releasePointerCapture(e.pointerId); } catch {} }
    endpointDragRef.current = null;
  };

  const handleSizeSelect = (dims: [number, number] | 'manual') => {
    if (dims === 'manual') { setSizeKey('manual'); }
    else { const k = `${dims[0]}x${dims[1]}`; setSizeKey(k); localStorage.setItem(STORAGE_SIZE, k); }
    setSelected(null);
  };
  const handleReset = () => { saveLayout(defaultLayout(paperDims)); setSelected(null); };

  // ── Custom Preset Handlers ────────────────────────────────────────────────────
  const handleSavePreset = (name: string) => {
    const id = `preset_${Date.now()}`;
    const newPreset: CustomPreset = { id, name: name.trim() || `Padrão ${customPresets.length + 1}`, dims: [W, H], layout };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setSavePresetModal({ open: false, name: '' });
    toast.show(`Padrão "${newPreset.name}" salvo!`);
  };

  const handleDeletePreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
  };

  const handleRenamePreset = (id: string, newName: string) => {
    const updated = customPresets.map(p => p.id === id ? { ...p, name: newName.trim() || p.name } : p);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setRenamePreset(null);
    toast.show('Padrão renomeado!');
  };

  const handleLoadPreset = (preset: CustomPreset) => {
    // Load preset: set size to manual with preset dims and apply saved layout
    setManualW(preset.dims[0]);
    setManualH(preset.dims[1]);
    setSizeKey('manual');
    localStorage.setItem(STORAGE_MANUAL, JSON.stringify(preset.dims));
    // Persist the preset layout under the manual key
    const key = `${preset.dims[0]}x${preset.dims[1]}`;
    const next = { ...layouts, [key]: preset.layout, manual: preset.layout };
    setLayouts(next);
    localStorage.setItem(STORAGE_LAYOUTS, JSON.stringify(next));
    setSelected(null);
    toast.show(`Padrão "${preset.name}" carregado!`);
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const sizesToPrint = isBoxLabel ? ['WHOLESALE'] : (selectedSizes.length > 0 ? selectedSizes : availSizes);
      let quantities: Record<string, number> | undefined;
      if (isBoxLabel) {
        quantities = { WHOLESALE: customQty };
      } else if (useStockQty) {
        quantities = {};
        sizesToPrint.forEach(s => { quantities![s] = variation?.stock[s] || 0; });
      } else {
        quantities = {};
        sizesToPrint.forEach(s => { quantities![s] = customQty; });
      }
      // Build LabelLayout from our Elem layout for the labelService
      const ll: LabelLayout = {
        refX:     layout.elems.reference.x + layout.elems.reference.w / 2,
        refY:     layout.elems.reference.y + (layout.elems.reference.fontSize ?? 8) * 0.353 + 1,
        refSize:  layout.elems.reference.fontSize ?? 8,
        refFontFamily: layout.elems.reference.fontFamily,
        qrX:      layout.elems.qr.x,
        qrY:      layout.elems.qr.y,
        qrSize:   layout.elems.qr.w,
        colorX:   layout.elems.color.x + layout.elems.color.w / 2,
        colorY:   layout.elems.color.y + (layout.elems.color.fontSize ?? 7) * 0.353 + 1,
        colorSize: layout.elems.color.fontSize ?? 7,
        colorFontFamily: layout.elems.color.fontFamily,
        footerX:  layout.elems.footer.x + 1,
        footerY:  layout.elems.footer.y + (layout.elems.footer.fontSize ?? 4) * 0.353 + 0.5,
        footerSize: layout.elems.footer.fontSize ?? 4,
        footerFontFamily: layout.elems.footer.fontFamily,
        showSize: layout.elems.size.visible,
        sizeX:    layout.elems.size.x + layout.elems.size.w - 1,
        sizeY:    layout.elems.size.y + (layout.elems.size.fontSize ?? 11) * 0.353 + 1,
        sizeSize: layout.elems.size.fontSize ?? 11,
        sizeFontFamily: layout.elems.size.fontFamily,
        photoX:   layout.elems.photo.x,
        photoY:   layout.elems.photo.y,
        photoW:   layout.elems.photo.w,
        photoH:   layout.elems.photo.h,
        showPhoto: layout.elems.photo.visible,
        showGrade: layout.elems.grade.visible,
        gradeX:   layout.elems.grade.x,
        gradeY:   layout.elems.grade.y,
        gradeW:   layout.elems.grade.w,
        gradeH:   layout.elems.grade.h,
        gradeFontFamily: layout.elems.grade.fontFamily,
        showOsData: layout.elems.osdata.visible,
        osDataX:  layout.elems.osdata.x + layout.elems.osdata.w / 2,
        osDataY:  layout.elems.osdata.y + (layout.elems.osdata.fontSize ?? 3.5) * 0.353 + 1,
        osDataW:  layout.elems.osdata.w,
        osDataH:  layout.elems.osdata.h,
        osDataSize: layout.elems.osdata.fontSize ?? 3.5,
        osDataText: os ? `${os.osNumber} | ${os.providerName} | R$ ${os.totalValue.toFixed(2)}` : undefined,
        osDataFontFamily: layout.elems.osdata.fontFamily,
        showSectorNotes: layout.elems.sectornotes.visible,
        sectorNotesX:    layout.elems.sectornotes.x,
        sectorNotesY:    layout.elems.sectornotes.y + (layout.elems.sectornotes.fontSize ?? 3) * 0.353 + 0.5,
        sectorNotesW:    layout.elems.sectornotes.w,
        sectorNotesH:    layout.elems.sectornotes.h,
        sectorNotesSize: layout.elems.sectornotes.fontSize ?? 3,
        sectorNotesText: sectorNotesText || undefined,
        sectorNotesHasHeader: !layout.elems.sectornotes.noteFilter,
        sectorNotesFontFamily: layout.elems.sectornotes.fontFamily,
      };
      // O elemento "Foto" da etiqueta usa SÓ a miniatura de linhas cadastrada em "Miniaturas
      // de Etiquetas" (Product.labelThumbnailUrl) — nunca a foto normal do produto, que sai
      // borrada/escura numa impressora térmica monocromática. Sem miniatura cadastrada, o
      // espaço fica em branco aqui (a prévia mostra o aviso, ver ContentPreview).
      const photoUrl = product.labelThumbnailUrl;
      if (batchItems && batchItems.length > 1) {
        await labelService.printProductLabelsBatch(
          batchItems.map(item => ({
            product: item.product,
            variation: item.variation,
            sizeGrid: item.sizeGrid,
            sectorNotesText: getSectorNotesText(item.variation, sectors, layout.elems.sectornotes.noteFilter) || undefined,
            photoUrl: item.product.labelThumbnailUrl,
            lotId: item.lotId,
            orderId: item.orderId,
            itemIdx: item.itemIdx,
            saleId: item.saleId,
          })),
          paperDims, ll
        );
      } else if (isBoxLabel) {
        await labelService.printWholesaleLabel(product, variation!, customQty, paperDims, ll, photoUrl, sizeGrid, routeItem?.lotId, routeItem?.orderId, routeItem?.itemIdx, routeItem?.saleId);
      } else {
        await labelService.printProductLabels(product, variation, sizesToPrint, quantities, paperDims, ll, photoUrl, sizeGrid, routeItem?.lotId, routeItem?.orderId, routeItem?.itemIdx, routeItem?.saleId);
      }
      onClose();
    } finally { setPrinting(false); }
  };

  // Extraído de handleExportJpg pra ser reutilizado também pelo caminho de impressão
  // Bluetooth (handlePrintBluetooth) — a única diferença entre os dois é a resolução (DPI):
  // exportação JPG usa 300 DPI (qualidade de arquivo), a impressora térmica usa ~203 DPI
  // (8 pontos/mm, a mesma densidade já validada em hardware real no editor de etiqueta geral
  // — ver DOTS_PER_MM em LabelEditorView.tsx). Mandar um bitmap de 300 DPI pra uma impressora
  // de 8 pontos/mm faria a etiqueta sair fisicamente ~1.5x maior que o tamanho configurado.
  const buildLabelFrames = async (dpi: number): Promise<{ frames: HTMLCanvasElement[]; fileNames: string[] | null; cW: number; cH: number }> => {
      const mmToPx = (mm: number) => Math.round(mm * dpi / 25.4);
      const ptToPxHigh = (pt: number) => pt * dpi / 72;
      const cW = mmToPx(W);
      const cH = mmToPx(H);
      const e = layout.elems;

      const drawFrame = async (opts: {
        refText: string;
        nameText?: string;
        colorText: string;
        sizeText?: string;
        qrDataUrl?: string;
        photoUrl?: string;
        gridEntries: { sz: string; qty: number | null }[];
        notesText: string;
        packagingText?: string;
        customerText?: string;
        recipientText?: string;
      }): Promise<HTMLCanvasElement> => {
        const canvas = document.createElement('canvas');
        canvas.width  = cW;
        canvas.height = cH;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cW, cH);

        // Formas decorativas — desenhadas primeiro, ficam atrás do texto/QR/foto.
        (layout.shapes || []).filter(s => s.visible !== false).forEach(s => {
          ctx.strokeStyle = s.color;
          ctx.fillStyle = s.color;
          ctx.lineWidth = Math.max(1, mmToPx(s.strokeWidth));
          ctx.setLineDash(s.dashed ? [mmToPx(s.strokeWidth) * 3, mmToPx(s.strokeWidth) * 2.2] : []);
          if (s.kind === 'rect') {
            ctx.save();
            if (s.rotation) {
              const cx = mmToPx(s.x + s.w / 2), cy = mmToPx(s.y + s.h / 2);
              ctx.translate(cx, cy);
              ctx.rotate((s.rotation * Math.PI) / 180);
              ctx.translate(-cx, -cy);
            }
            ctx.beginPath();
            if (typeof (ctx as any).roundRect === 'function') {
              (ctx as any).roundRect(mmToPx(s.x), mmToPx(s.y), mmToPx(s.w), mmToPx(s.h), mmToPx(s.radius ?? 0));
            } else {
              ctx.rect(mmToPx(s.x), mmToPx(s.y), mmToPx(s.w), mmToPx(s.h));
            }
            if (s.filled) ctx.fill(); else ctx.stroke();
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.moveTo(mmToPx(s.x), mmToPx(s.y));
            ctx.lineTo(mmToPx(s.x + s.w), mmToPx(s.y + s.h));
            ctx.stroke();
          }
          ctx.setLineDash([]);
        });

        const drawText = (el: Elem, text: string, fallbackPt: number) => {
          if (!el.visible || !text) return;
          const fsPx = ptToPxHigh(el.fontSize ?? fallbackPt);
          const ff = el.fontFamily === 'times'   ? 'Georgia, serif'
                   : el.fontFamily === 'courier' ? '"Courier New", monospace'
                   : el.fontFamily === 'avenir'  ? '"Century Gothic","Trebuchet MS","Gill Sans MT",sans-serif'
                   : el.fontFamily === 'arial'   ? 'Arial, sans-serif'
                   : 'Helvetica, Arial, sans-serif';
          ctx.font = `${el.bold ? '900' : '400'} ${fsPx}px ${ff}`;
          if (el.invert) {
            // Efeito "chip" — fundo preto arredondado do tamanho do elemento, texto branco
            // por cima (mesmo visual das pílulas de Grade, só que pra qualquer campo).
            const bx = mmToPx(el.x), by = mmToPx(el.y), bw = mmToPx(el.w), bh = mmToPx(el.h);
            const radius = Math.min(bh / 2, mmToPx(1.2));
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            if (typeof (ctx as any).roundRect === 'function') {
              (ctx as any).roundRect(bx, by, bw, bh, radius);
            } else {
              ctx.rect(bx, by, bw, bh);
            }
            ctx.fill();
            ctx.fillStyle = '#ffffff';
          } else {
            ctx.fillStyle = '#000000';
          }
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, mmToPx(el.x + el.w / 2), mmToPx(el.y + el.h / 2));
        };

        if (e.qr.visible && opts.qrDataUrl) {
          await new Promise<void>(res => {
            const img = new window.Image();
            img.onload  = () => { ctx.drawImage(img, mmToPx(e.qr.x), mmToPx(e.qr.y), mmToPx(e.qr.w), mmToPx(e.qr.h)); res(); };
            img.onerror = () => res();
            img.src = opts.qrDataUrl!;
          });
        }

        if (e.photo.visible && opts.photoUrl) {
          await new Promise<void>(res => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload  = () => { ctx.drawImage(img, mmToPx(e.photo.x), mmToPx(e.photo.y), mmToPx(e.photo.w), mmToPx(e.photo.h)); res(); };
            img.onerror = () => res();
            img.src = opts.photoUrl!;
          });
        }

        // Nome e Cor não desenham mais como blocos próprios — só entram no texto de
        // Referência via combineFields (ver combineRefFields, já aplicado em opts.refText).
        drawText(e.reference, opts.refText, 8);
        if (e.size.visible && opts.sizeText !== undefined) drawText(e.size, opts.sizeText, 11);
        drawText(e.footer, 'ANTIGRAVITY SYSTEM', 4);
        if (opts.packagingText) drawText(e.packaging, opts.packagingText, 4.5);
        if (opts.customerText) drawText(e.customer, opts.customerText, 4.5);
        if (opts.recipientText) drawText(e.recipient, opts.recipientText, 4.5);

        // Grade pills
        const gridEntries = opts.gridEntries;
        if (e.grade.visible && gridEntries.length > 0) {
          const gX = mmToPx(e.grade.x), gY = mmToPx(e.grade.y);
          const gW = mmToPx(e.grade.w), gH = mmToPx(e.grade.h);
          const hasQty = gridEntries.some(en => en.qty !== null);
          const totalQty = gridEntries.reduce((s, en) => s + (en.qty || 0), 0);
          const totalWidthFactor = 1.6;
          const totalUnits = gridEntries.length + (hasQty ? totalWidthFactor : 0);
          const cellW  = gW / totalUnits;
          const totalCellW = cellW * totalWidthFactor;
          const szFsPx  = ptToPxHigh(e.grade.fontSize ?? 5);
          const qtyFsPx = ptToPxHigh((e.grade.fontSize ?? 5) * 0.90);
          const szH = hasQty ? gH * 0.48 : gH * 0.70;
          const pad = mmToPx(0.4);

          gridEntries.forEach(({ sz, qty }, idx) => {
            const cellX = gX + cellW * idx;
            const cx = cellX + cellW / 2;
            // Numeração: fundo preto + texto branco
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            if (typeof (ctx as any).roundRect === 'function') {
              (ctx as any).roundRect(cellX + pad, gY + pad, cellW - pad * 2, szH, mmToPx(0.5));
            } else {
              ctx.rect(cellX + pad, gY + pad, cellW - pad * 2, szH);
            }
            ctx.fill();
            ctx.fillStyle    = '#ffffff';
            ctx.font         = `900 ${szFsPx}px Arial`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sz, cx, gY + szH * 0.52);
            // Valor: texto preto simples
            if (qty !== null) {
              ctx.fillStyle = '#000000';
              ctx.font      = `900 ${qtyFsPx}px Arial`;
              ctx.fillText(`${qty}`, cx, gY + szH + (gH - szH) * 0.6);
            }
          });

          if (hasQty) {
            const cellX = gX + cellW * gridEntries.length;
            const cx = cellX + totalCellW / 2;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            if (typeof (ctx as any).roundRect === 'function') {
              (ctx as any).roundRect(cellX + pad, gY + pad, totalCellW - pad * 2, szH, mmToPx(0.5));
            } else {
              ctx.rect(cellX + pad, gY + pad, totalCellW - pad * 2, szH);
            }
            ctx.fill();
            ctx.fillStyle    = '#ffffff';
            ctx.font         = `900 ${szFsPx * 0.65}px Arial`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TOTAL', cx, gY + szH * 0.52);
            ctx.fillStyle = '#000000';
            ctx.font      = `900 ${qtyFsPx}px Arial`;
            ctx.fillText(`${totalQty}`, cx, gY + szH + (gH - szH) * 0.6);
          }
        }

        // OS Data
        if (e.osdata.visible && os) {
          const osText = `${os.osNumber} | ${os.providerName} | R$ ${os.totalValue.toFixed(2)}`;
          const osFsPx = ptToPxHigh(e.osdata.fontSize ?? 3.5);
          ctx.font         = `400 ${osFsPx}px Arial, Helvetica, sans-serif`;
          ctx.fillStyle    = '#6366f1';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(osText, mmToPx(e.osdata.x + e.osdata.w / 2), mmToPx(e.osdata.y + e.osdata.h / 2));
          ctx.strokeStyle  = '#6366f1';
          ctx.lineWidth    = mmToPx(0.15);
          const pad = mmToPx(0.3);
          ctx.strokeRect(mmToPx(e.osdata.x) + pad, mmToPx(e.osdata.y) + pad, mmToPx(e.osdata.w) - pad * 2, mmToPx(e.osdata.h) - pad * 2);
        }

        // Sector Notes
        const notesText = opts.notesText;
        if (e.sectornotes.visible && notesText) {
          const snFsPx  = ptToPxHigh(e.sectornotes.fontSize ?? 3);
          const snX     = mmToPx(e.sectornotes.x);
          const snY     = mmToPx(e.sectornotes.y);
          const snW     = mmToPx(e.sectornotes.w);
          const snH     = mmToPx(e.sectornotes.h);
          const pad     = mmToPx(0.4);
          const lineH   = snFsPx * 1.35;
          ctx.textAlign    = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#000000';
          if (!e.sectornotes.noteFilter) {
            notesText.split('\n').forEach((line, li) => {
              const ty = snY + pad + li * lineH;
              if (ty + lineH > snY + snH) return;
              const isHeader = li % 2 === 0;
              ctx.font = `${isHeader ? '700' : '400'} ${snFsPx}px "Century Gothic","Trebuchet MS","Gill Sans",Arial,sans-serif`;
              ctx.fillText(line, snX + pad, ty);
            });
          } else {
            ctx.font = `400 ${snFsPx}px "Century Gothic","Trebuchet MS","Gill Sans",Arial,sans-serif`;
            const maxW = snW - pad * 2;
            const words = notesText.split(/\s+/).filter(Boolean);
            const lines: string[] = [];
            let cur = '';
            words.forEach(word => {
              const test = cur ? `${cur} ${word}` : word;
              if (cur && ctx.measureText(test).width > maxW) {
                lines.push(cur);
                cur = word;
              } else {
                cur = test;
              }
            });
            if (cur) lines.push(cur);
            lines.slice(0, 2).forEach((line, li) => {
              const ty = snY + pad + li * lineH;
              if (ty + lineH > snY + snH) return;
              ctx.fillText(line, snX + pad, ty);
            });
          }
        }

        return canvas;
      };

      const frames: HTMLCanvasElement[] = [];
      let fileNames: string[] | null = null;

      if (batchItems && batchItems.length > 1) {
        fileNames = [];
        for (const item of batchItems) {
          const itemQrSuffix = (item.lotId && item.orderId)
            ? `|${item.lotId}|${item.orderId}|${item.itemIdx ?? ''}`
            : (item.saleId ? `|SALE|${item.saleId}` : '');
          const qrDataUrl = await labelService.generateQRCode(`PRD|${item.product.id}|${item.variation.id}|GRADE${itemQrSuffix}`);
          const canvas = await drawFrame({
            refText: combineRefFields(e.reference.combineFields, item.product.reference || item.product.name, item.product.name, item.variation.colorName || '---'),
            colorText: item.variation.colorName || '---',
            qrDataUrl,
            photoUrl: item.product.labelThumbnailUrl,
            gridEntries: parseSizeGridEntries(item.sizeGrid),
            notesText: getSectorNotesText(item.variation, sectors, e.sectornotes.noteFilter),
            packagingText: item.packagingName,
            customerText: item.customerName,
            recipientText: item.recipientName,
          });
          frames.push(canvas);
          const safeName = `Etiqueta_${item.product.reference || item.product.name}_${item.variation.colorName || 'cor'}`.replace(/[^\w\-]+/g, '_');
          fileNames.push(safeName);
        }
      } else {
        const sizesToPrint = isBoxLabel ? ['WHOLESALE'] : (selectedSizes.length > 0 ? selectedSizes : availSizes);
        const quantities: Record<string, number> = {};
        if (isBoxLabel) {
          quantities['WHOLESALE'] = customQty;
        } else if (useStockQty) {
          sizesToPrint.forEach(s => { quantities[s] = variation?.stock[s] || 0; });
        } else {
          sizesToPrint.forEach(s => { quantities[s] = customQty; });
        }

        for (const size of sizesToPrint) {
          const qty = quantities[size] || 1;
          const qrData = isBoxLabel
            ? `PRD|${product.id}|${variation?.id || ''}|WHOLESALE${qrRouteSuffix}`
            : `PRD|${product.id}|${variation?.id || ''}|${size}${qrRouteSuffix}`;
          const qrDataUrl = await labelService.generateQRCode(qrData);

          for (let i = 0; i < qty; i++) {
            const canvas = await drawFrame({
              refText: combineRefFields(e.reference.combineFields, product.reference || product.name, product.name, variation?.colorName || '---'),
              nameText: product.name,
              colorText: variation?.colorName || '---',
              sizeText: isBoxLabel ? 'BOX' : size,
              qrDataUrl,
              photoUrl: product.labelThumbnailUrl,
              gridEntries: sizeGridEntries,
              notesText: sectorNotesText,
              packagingText: previewPackagingName,
              customerText: previewCustomerName,
              recipientText: previewRecipientName,
            });
            frames.push(canvas);
          }
        }
      }

      return { frames, fileNames, cW, cH };
  };

  const handleExportJpg = async () => {
    setExportingJpg(true);
    try {
      const { frames, fileNames, cW, cH } = await buildLabelFrames(300);
      const mmToPx = (mm: number) => Math.round(mm * 300 / 25.4);

      if (frames.length === 0) {
        toast.show('Nenhuma etiqueta para gerar. Selecione ao menos um tamanho ou variação.');
        return;
      }

      // Lote: gerar um arquivo JPG separado por pedido selecionado — todos compartilhados
      // de uma vez só, num único share sheet nativo, em vez de abrir o compartilhamento
      // etiqueta por etiqueta.
      if (fileNames && jpgBatchMode === 'separate') {
        const dataUris = frames.map(f => f.toDataURL('image/jpeg', 0.92));
        const names = frames.map((_, i) => `${fileNames[i]}_${i + 1}.jpg`);
        await shareImages(dataUris, 'Etiquetas', names);
        return;
      }

      // Empilha todos os quadros verticalmente em uma única imagem, com
      // espaçamento configurável entre etiquetas no caso de lote.
      const gapPx = fileNames ? mmToPx(jpgSpacing) : 0;
      const out = document.createElement('canvas');
      out.width  = cW;
      out.height = cH * frames.length + gapPx * Math.max(0, frames.length - 1);
      const oCtx = out.getContext('2d')!;
      oCtx.fillStyle = '#ffffff';
      oCtx.fillRect(0, 0, out.width, out.height);
      for (let i = 0; i < frames.length; i++) {
        oCtx.drawImage(frames[i], 0, i * (cH + gapPx));
      }

      const fileName = fileNames ? `Etiquetas_Lote_${frames.length}.jpg` : `Etiquetas_${product.reference || product.name}.jpg`;
      await shareImage(out.toDataURL('image/jpeg', 0.92), fileName);
    } catch (err) {
      console.error('Erro ao gerar JPG:', err);
      toast.show('Erro ao gerar JPG: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExportingJpg(false);
    }
  };

  // Salva cada etiqueta como um PNG separado na galeria — pensado como alternativa manual à
  // impressão Bluetooth direta: com a etiqueta na galeria, dá pra abrir o app oficial da
  // impressora (ou qualquer outro) e imprimir por lá.
  const handleSaveToGallery = async () => {
    setSavingGallery(true);
    try {
      const { frames } = await buildLabelFrames(300);
      if (frames.length === 0) {
        toast.show('Nenhuma etiqueta para gerar. Selecione ao menos um tamanho ou variação.');
        return;
      }
      let saved = 0;
      let failed = 0;
      for (let i = 0; i < frames.length; i++) {
        const base64 = frames[i].toDataURL('image/png').split('base64,')[1];
        try {
          const written = await Filesystem.writeFile({ path: `gallery_${Date.now()}_${i}.png`, data: base64, directory: Directory.Cache });
          const { saved: ok } = await saveImageToGallery(written.uri);
          if (ok) saved++; else failed++;
        } catch {
          failed++;
        }
      }
      toast.show(failed === 0 ? `${saved} etiqueta(s) salva(s) na galeria!` : `${saved} salva(s), ${failed} falharam.`);
    } catch (err) {
      console.error('Erro ao salvar na galeria:', err);
      toast.show('Erro ao salvar na galeria: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingGallery(false);
    }
  };

  // Impressão via Bluetooth (Ablemark BR-L100) — reaproveita buildLabelFrames (uma etiqueta
  // por unidade física, já respeitando a grade de tamanhos/quantidades) só que a 8 pontos/mm
  // em vez de 300 DPI. Abre o mesmo LabelPrintPreviewModal usado pelo editor de etiqueta geral
  // pra escolher direção/deslocamento/densidade/papel antes de mandar.
  // Gera os quadros e abre a pré-visualização — só chamado quando já se sabe que a
  // impressora está conectada (direto, ou depois de conectar pelo popup abaixo).
  const proceedToBtPreview = async () => {
    setPreparingBt(true);
    try {
      const { frames } = await buildLabelFrames(8 * 25.4);
      if (frames.length === 0) {
        toast.show('Nenhuma etiqueta para gerar. Selecione ao menos um tamanho ou variação.');
        return;
      }
      setBtFramesCache(frames);
      setShowBtPreview(true);
    } catch (err) {
      console.error('Erro ao preparar impressão Bluetooth:', err);
      toast.show('Erro ao preparar impressão: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPreparingBt(false);
    }
  };

  const handleOpenBluetoothPrint = async () => {
    if (await isAbleMarkPrinterConnected()) {
      await proceedToBtPreview();
      return;
    }
    // Impressora desconectada — em vez de só avisar e mandar o usuário sair daqui pra
    // conectar em outra tela, oferece a conexão direto neste popup e já segue pra
    // impressão assim que conectar.
    setShowConnectPrompt(true);
    setLoadingBtDevices(true);
    try {
      const list = await listAbleMarkPairedDevices();
      setBtDevices(list);
    } finally {
      setLoadingBtDevices(false);
    }
  };

  const handleConnectBtDevice = async (address: string) => {
    setConnectingBtAddress(address);
    try {
      const { connected, error } = await connectAbleMarkPrinter(address);
      if (connected) {
        setShowConnectPrompt(false);
        await proceedToBtPreview();
      } else {
        toast.show('Falha ao conectar: ' + (error || '(sem detalhe)'));
      }
    } finally {
      setConnectingBtAddress(null);
    }
  };

  const handleConfirmBtPrint = async (options: PrintOptions) => {
    const rotationDeg = DIRECTION_TO_ROTATION[options.direction];
    let sent = 0;
    let failed = 0;
    let isFirst = true;
    for (let i = 0; i < btFramesCache.length; i++) {
      const transformed = applyPrintTransform(
        btFramesCache[i], W, H,
        { offsetXmm: options.offsetXmm, offsetYmm: options.offsetYmm, rotationDeg },
        8,
      );
      const base64 = transformed.toDataURL('image/png').split('base64,')[1];
      for (let c = 0; c < options.copies; c++) {
        // Dá tempo da impressora terminar de alimentar/cortar a etiqueta anterior antes de
        // mandar a próxima — sem essa pausa, o job seguinte chega enquanto o mecanismo ainda
        // está processando o de antes, e a impressão sai corrompida (caracteres bagunçados)
        // mesmo com os bytes enviados corretos.
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

  // ── Helpers preview ──────────────────────────────────────────────────────────
  const ptToPx = (pt: number) => pt * 0.353 * scale;
  const cssFont = (el: Elem, fallbackPt: number) => ({
    fontSize:   ptToPx(el.fontSize ?? fallbackPt),
    fontFamily: el.fontFamily === 'times'   ? 'Georgia, Times, serif'
              : el.fontFamily === 'courier' ? '"Courier New", monospace'
              : el.fontFamily === 'avenir'  ? '"Century Gothic","Trebuchet MS","Gill Sans MT","Segoe UI",sans-serif'
              : el.fontFamily === 'arial'   ? 'Arial, sans-serif'
              : 'Helvetica, Arial, sans-serif',
    fontWeight: el.bold ? 900 : 400,
  });
  const pos = (el: Elem) => ({
    position: 'absolute' as const,
    left: el.x * scale, top: el.y * scale,
    width: el.w * scale, height: el.h * scale,
    overflow: 'hidden',
  });
  // Efeito "chip" na prévia (Visualizar) — retângulo preto arredondado + texto branco, pra
  // bater com o que sai de verdade na impressão/JPG (ver drawText em buildLabelFrames).
  const chipWrapStyle = (el: Elem) => el.invert ? { backgroundColor: '#000000', borderRadius: Math.min((el.h * scale) / 2, 6) } : {};
  const chipTextColor = (el: Elem) => el.invert ? '#ffffff' : '#000000';

  const sel = selected ? layout.elems[selected] : null;
  const dk  = isDarkMode;

  // ── Content preview ──────────────────────────────────────────────────────────
  const ContentPreview = () => {
    const e = layout.elems;
    return (
      <div style={{ position:'relative', width:previewW, height:previewH, backgroundColor:'#fff', flexShrink:0, overflow:'hidden' }}>
        {/* Formas decorativas — desenhadas primeiro, ficam atrás do texto */}
        <svg width={previewW} height={previewH} style={{ position:'absolute', left:0, top:0, pointerEvents:'none' }}>
          {(layout.shapes || []).filter(s => s.visible !== false).map(s => s.kind === 'rect' ? (
            <rect key={s.id} x={s.x*scale} y={s.y*scale} width={s.w*scale} height={s.h*scale} rx={(s.radius ?? 0)*scale}
              fill={s.filled ? s.color : 'none'} stroke={s.color} strokeWidth={s.strokeWidth*scale} strokeDasharray={s.dashed ? '4 3' : undefined}
              transform={s.rotation ? `rotate(${s.rotation} ${(s.x+s.w/2)*scale} ${(s.y+s.h/2)*scale})` : undefined} />
          ) : (
            <line key={s.id} x1={s.x*scale} y1={s.y*scale} x2={(s.x+s.w)*scale} y2={(s.y+s.h)*scale} stroke={s.color} strokeWidth={s.strokeWidth*scale} strokeDasharray={s.dashed ? '4 3' : undefined} />
          ))}
        </svg>
        {e.reference.visible && (
          <div style={{ ...pos(e.reference), ...chipWrapStyle(e.reference), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.reference, 8), color:chipTextColor(e.reference), textAlign:'center' }}>{combineRefFields(e.reference.combineFields, product.reference || product.name, product.name, variation?.colorName || '---')}</span>
          </div>
        )}
        {e.size.visible && !isBoxLabel && (
          <div style={{ ...pos(e.size), ...chipWrapStyle(e.size), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.size, 11), color:chipTextColor(e.size), textAlign:'center' }}>{previewSize}</span>
          </div>
        )}
        {e.size.visible && isBoxLabel && (
          <div style={{ ...pos(e.size), ...chipWrapStyle(e.size), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.size, 11), color:chipTextColor(e.size), textAlign:'center' }}>BOX</span>
          </div>
        )}
        {e.qr.visible && (
          <div style={pos(e.qr)}>
            {qrPreview ? <img src={qrPreview} alt="QR" style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <div style={{ width:'100%', height:'100%', backgroundColor:'#f1f5f9' }}/>}
          </div>
        )}
        {e.photo.visible && (
          <div style={{ ...pos(e.photo), borderRadius:2, overflow:'hidden', backgroundColor: product.labelThumbnailUrl ? 'transparent' : '#fef3c7' }}>
            {product.labelThumbnailUrl
              ? <img src={product.labelThumbnailUrl} alt="Miniatura para etiqueta" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
              : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:'#fef3c7', border:'1px dashed #f59e0b', padding:2, overflow:'hidden' }}><span style={{ fontSize: Math.max(4, 4.5*scale), color:'#b45309', textAlign:'center', lineHeight:1.2, fontWeight:700 }}>Sem miniatura de etiquetas cadastrado</span></div>}
          </div>
        )}
        {e.footer.visible && (
          <div style={{ ...pos(e.footer), ...chipWrapStyle(e.footer), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.footer, 4), color:chipTextColor(e.footer) }}>ANTIGRAVITY SYSTEM</span>
          </div>
        )}
        {e.osdata.visible && (
          <div style={{ ...pos(e.osdata), display:'flex', alignItems:'center', justifyContent:'center', padding: `${scale*0.3}px ${scale*0.5}px`, border:`${scale*0.4}px solid #6366f1`, borderRadius: scale*0.8, boxSizing:'border-box' }}>
            <span style={{ ...cssFont(e.osdata, 3.5), color:'#6366f1', textAlign:'center', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%' }}>
              {os ? `${os.osNumber} | ${os.providerName} | R$ ${os.totalValue.toFixed(2)}` : 'OS-C-0000 | Fornecedor | R$ 0,00'}
            </span>
          </div>
        )}
        {e.sectornotes.visible && (
          <div style={{ ...pos(e.sectornotes), display:'flex', alignItems:'flex-start', justifyContent:'flex-start', padding: `${scale*0.3}px ${scale*0.5}px`, overflow:'hidden' }}>
            <span style={{
              fontSize: ptToPx(e.sectornotes.fontSize ?? 3),
              fontFamily: cssFont(e.sectornotes, 3).fontFamily,
              fontWeight: sectorNotesText ? 400 : 400,
              fontStyle: sectorNotesText ? 'normal' : 'italic',
              color: sectorNotesText ? '#000000' : '#94a3b8',
              lineHeight:1.35, whiteSpace:'pre-line', overflow:'hidden', width:'100%'
            }}>
              {sectorNotesText || 'Sem instruções de setor cadastradas para esta cor'}
            </span>
          </div>
        )}
        {e.packaging.visible && (
          <div style={{ ...pos(e.packaging), ...(previewPackagingName ? chipWrapStyle(e.packaging) : {}), display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <span style={{
              ...cssFont(e.packaging, 4.5),
              color: previewPackagingName ? chipTextColor(e.packaging) : '#94a3b8',
              fontStyle: previewPackagingName ? 'normal' : 'italic',
              textAlign:'center',
            }}>
              {previewPackagingName || 'Sem embalagem vinculada'}
            </span>
          </div>
        )}
        {e.customer.visible && (
          <div style={{ ...pos(e.customer), ...(previewCustomerName ? chipWrapStyle(e.customer) : {}), display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <span style={{
              ...cssFont(e.customer, 4.5),
              color: previewCustomerName ? chipTextColor(e.customer) : '#94a3b8',
              fontStyle: previewCustomerName ? 'normal' : 'italic',
              textAlign:'center',
            }}>
              {previewCustomerName || 'Sem cliente vinculado'}
            </span>
          </div>
        )}
        {e.recipient.visible && (
          <div style={{ ...pos(e.recipient), ...(previewRecipientName ? chipWrapStyle(e.recipient) : {}), display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <span style={{
              ...cssFont(e.recipient, 4.5),
              color: previewRecipientName ? chipTextColor(e.recipient) : '#94a3b8',
              fontStyle: previewRecipientName ? 'normal' : 'italic',
              textAlign:'center',
            }}>
              {previewRecipientName || 'Sem destinatário definido'}
            </span>
          </div>
        )}
        {e.grade.visible && sizeGridEntries.length > 0 && (() => {
          const hasQty = sizeGridEntries.some(en => en.qty !== null);
          const totalQty = sizeGridEntries.reduce((s, en) => s + (en.qty || 0), 0);
          return (
            <div style={{ ...pos(e.grade), display:'flex', alignItems:'stretch', gap: scale * 0.5 }}>
              {sizeGridEntries.map(({ sz, qty }, i) => (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  <span style={{ ...cssFont(e.grade, 5), color:'#ffffff', backgroundColor:'#000000', borderRadius: scale * 0.6, padding:`${scale * 0.3}px ${scale * 0.5}px`, lineHeight:1 }}>{sz}</span>
                  {qty !== null && <span style={{ fontSize: ptToPx((e.grade.fontSize ?? 5) * 0.90), fontFamily:'Arial,sans-serif', fontWeight:900, color:'#000000', lineHeight:1, marginTop: scale * 0.5 }}>{qty}</span>}
                </div>
              ))}
              {hasQty && (
                <div style={{ flex:1.6, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  <span style={{ ...cssFont(e.grade, 5), fontSize: ptToPx((e.grade.fontSize ?? 5) * 0.65), color:'#ffffff', backgroundColor:'#000000', borderRadius: scale * 0.6, padding:`${scale * 0.3}px ${scale * 0.5}px`, lineHeight:1, whiteSpace:'nowrap' }}>TOTAL</span>
                  <span style={{ fontSize: ptToPx((e.grade.fontSize ?? 5) * 0.90), fontFamily:'Arial,sans-serif', fontWeight:900, color:'#000000', lineHeight:1, marginTop: scale * 0.5 }}>{totalQty}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ── Edit preview (colored blocks) ────────────────────────────────────────────
  const EditPreview = () => (
    <div data-guide-anchor="printLabelEditor.canvasAjustar" style={{ position:'relative', width:previewW, height:previewH, backgroundColor:'#fff', flexShrink:0 }} onClick={()=>{setSelected(null);setSelectedShapeId(null);}}>
      {/* Formas (retângulo/linha) — HTML/CSS (div), NÃO SVG. As primitivas de forma em SVG
          (<rect>/<line>/<circle>) têm suporte inconsistente a `touch-action` em várias versões
          do Chromium/WebView do Android — era isso que deixava o arraste de forma/linha preso/
          não-contínuo mesmo já com a lógica de arraste corrigida (âncora fixa, sem localStorage
          no meio do gesto etc). Os blocos de texto logo abaixo (CONFIG_LIST_KEYS) sempre foram
          <div> normal e nunca tiveram esse problema — aqui é a mesma técnica, e é literalmente
          o que já funciona de verdade no editor usado pra imprimir na Ablemark
          (ver LabelEditorView.tsx: elemento absolutamente posicionado, linha vira uma div fina
          rotacionada com `transform-origin` na ponta inicial, em vez de x1/y1/x2/y2 de SVG). */}
      {(layout.shapes || []).filter(s => s.visible !== false).map(s => {
        const isSel = selectedShapeId === s.id;
        if (s.kind === 'rect') {
          return (
            <div
              key={s.id}
              onPointerDown={e => handleShapePointerDown(e, s.id)}
              onPointerMove={handleShapePointerMove}
              onPointerUp={handleShapePointerUp}
              onPointerCancel={handleShapePointerUp}
              style={{
                position: 'absolute',
                left: s.x * scale, top: s.y * scale,
                width: Math.max(1, s.w * scale), height: Math.max(1, s.h * scale),
                borderRadius: (s.radius ?? 0) * scale,
                backgroundColor: s.filled ? s.color + '55' : (isSel ? s.color + '22' : 'transparent'),
                border: `${Math.max(1, s.strokeWidth * scale)}px ${s.dashed ? 'dashed' : 'solid'} ${s.color}`,
                boxSizing: 'border-box',
                cursor: 'grab', touchAction: 'none',
                transform: s.rotation ? `rotate(${s.rotation}deg)` : undefined,
              }}
            />
          );
        }
        // Linha — div fina do comprimento certo, rotacionada em torno da ponta inicial
        // (transformOrigin '0 50%'), igual à técnica do editor da Ablemark. A faixa de toque
        // (height:20) é mais alta que o traço visual desenhado dentro dela, só pra facilitar
        // acertar com o dedo — mesmo propósito da antiga faixa invisível de SVG.
        const dxPx = s.w * scale, dyPx = s.h * scale;
        const lengthPx = Math.max(1, Math.hypot(dxPx, dyPx));
        const angleDeg = Math.atan2(dyPx, dxPx) * 180 / Math.PI;
        const strokePx = Math.max(1, s.strokeWidth * scale);
        return (
          <div
            key={s.id}
            onPointerDown={e => handleShapePointerDown(e, s.id)}
            onPointerMove={handleShapePointerMove}
            onPointerUp={handleShapePointerUp}
            onPointerCancel={handleShapePointerUp}
            style={{
              position: 'absolute',
              left: s.x * scale, top: s.y * scale,
              width: lengthPx, height: 20,
              transform: `rotate(${angleDeg}deg)`,
              transformOrigin: '0 50%',
              display: 'flex', alignItems: 'center',
              cursor: 'grab', touchAction: 'none',
            }}
          >
            <div style={{
              width: '100%', height: strokePx,
              backgroundColor: s.dashed ? 'transparent' : s.color,
              borderTop: s.dashed ? `${strokePx}px dashed ${s.color}` : 'none',
            }} />
          </div>
        );
      })}
      {selectedShapeId && (layout.shapes || []).filter(s => s.id === selectedShapeId).map(s => (
        <div key={`sel_${s.id}`}>
          {/* Pin de centro (só linha) — arrasta a linha inteira; as duas pontas continuam só
              mudando ângulo/comprimento (handleEndpointPointerDown), não a posição toda. */}
          {s.kind === 'line' && (
            <div
              onPointerDown={e => handleShapePointerDown(e, s.id)}
              onPointerMove={handleShapePointerMove}
              onPointerUp={handleShapePointerUp}
              onPointerCancel={handleShapePointerUp}
              style={{
                position: 'absolute',
                left: (s.x + s.w / 2) * scale - 7, top: (s.y + s.h / 2) * scale - 7,
                width: 14, height: 14, borderRadius: 9999,
                backgroundColor: '#fff', border: `2.5px solid ${s.color}`,
                boxSizing: 'border-box', cursor: 'grab', touchAction: 'none',
              }}
            />
          )}
          {([[s.x, s.y], [s.x + s.w, s.y + s.h]] as const).map(([px, py], i) => (
            <div
              key={i}
              onPointerDown={e => handleEndpointPointerDown(e, s.id, i as 0 | 1)}
              onPointerMove={handleEndpointPointerMove}
              onPointerUp={handleEndpointPointerUp}
              onPointerCancel={handleEndpointPointerUp}
              style={{
                position: 'absolute',
                left: px * scale - 7, top: py * scale - 7,
                width: 14, height: 14, borderRadius: 9999,
                backgroundColor: s.color, border: '1.5px solid #fff',
                boxSizing: 'border-box', cursor: 'grab', touchAction: 'none',
              }}
            />
          ))}
        </div>
      ))}
      {CONFIG_LIST_KEYS.map(key => {
        const el = layout.elems[key];
        if (!el.visible) return null;
        const isSel = selected === key;
        const isDragging = draggingKey === key;
        return (
          <div key={key}
            data-guide-anchor="printLabelEditor.blocoEtiqueta"
            onClick={e=>{e.stopPropagation();setSelected(key);}}
            onPointerDown={e=>handleElemPointerDown(e, key)}
            onPointerMove={handleElemPointerMove}
            onPointerUp={handleElemPointerUp}
            onPointerCancel={handleElemPointerUp}
            style={{ position:'absolute', left:el.x*scale, top:el.y*scale, width:el.w*scale, height:el.h*scale,
              backgroundColor:el.color+(isDragging?'45':isSel?'38':'2a'), border:`${isSel?2.5:1}px ${isSel?'solid':'dashed'} ${el.color}`,
              boxShadow:isSel?`0 0 0 3px ${el.color}33`:'none',
              boxSizing:'border-box', cursor:el.locked?'not-allowed':isDragging?'grabbing':'grab', touchAction:'none', zIndex:isDragging?20:isSel?10:1,
              display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <span style={{ fontSize:Math.max(5,7*scale), color:el.color, fontWeight:900, textAlign:'center', lineHeight:1, pointerEvents:'none' }}>{el.label}</span>
            {el.locked && (
              <div style={{ position:'absolute', top:2, right:2, width:14, height:14, borderRadius:9999, backgroundColor:'#f59e0b', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', boxShadow:'0 1px 2px rgba(0,0,0,0.3)' }}>
                <Lock size={8} color="#fff" strokeWidth={3} />
              </div>
            )}
            {/* Cantos — só pra deixar óbvio qual bloco está selecionado (sem o D-pad de setas,
                que servia como esse indicativo antes) */}
            {isSel && !isDragging && ([['-4px','-4px'],['calc(100% - 4px)','-4px'],['-4px','calc(100% - 4px)'],['calc(100% - 4px)','calc(100% - 4px)']] as const).map(([left, top], i) => (
              <div key={i} style={{ position:'absolute', left, top, width:8, height:8, borderRadius:9999, backgroundColor:el.color, border:'1.5px solid #fff', boxShadow:'0 1px 2px rgba(0,0,0,0.3)', pointerEvents:'none' }} />
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editor de Etiquetas" maxWidth="max-w-lg" zIndex={70000}>
      <div className="flex flex-col gap-4 py-1">


        {/* Size selection — acordeão, recolhido por padrão pra economizar espaço */}
        <div className={`rounded-2xl border overflow-hidden ${dk ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            type="button"
            data-guide-anchor="printLabelEditor.tamanhoAccordion"
            onClick={() => setSizeAccordionOpen(o => !o)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-3 transition-all ${dk ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100'}`}
          >
            <span className="flex items-center gap-2">
              <Tag size={13} className="text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Tamanho da Etiqueta</span>
            </span>
            <span className="flex items-center gap-2">
              <span className={`text-[9px] font-black px-2 py-1 rounded-full ${dk ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>{W}×{H}mm</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${sizeAccordionOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {/* Salvar Padrão / Resetar e Meus Padrões — sempre visíveis, mesmo com o acordeão fechado */}
          <div className={`p-3 flex flex-col gap-2.5 border-t ${dk ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
            <div className={`flex p-1 rounded-2xl gap-1 ${dk?'bg-slate-800':'bg-slate-100'}`}>
              <button type="button" data-guide-anchor="printLabelEditor.salvarPadrao" onClick={() => setSavePresetModal({ open: true, name: '' })}
                title="Salvar padrão atual com nome"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dk ? 'bg-slate-700 text-emerald-400 shadow-sm' : 'bg-white text-emerald-600 shadow-sm'}`}>
                <BookmarkPlus size={12}/> Salvar Padrão
              </button>
              <button type="button" data-guide-anchor="printLabelEditor.resetar" onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:text-indigo-500">
                <RotateCcw size={11}/> Resetar
              </button>
            </div>

            {customPresets.length > 0 && (
              <button
                type="button"
                data-guide-anchor="printLabelEditor.meusPadroesAbrir"
                onClick={() => setMyPresetsPopupOpen(true)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${dk ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-400'}`}
              >
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                  <BookOpen size={11}/> Meus Padrões
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${dk ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-500'}`}>{customPresets.length}</span>
                  <ChevronDown size={13} className="text-slate-400 -rotate-90" />
                </span>
              </button>
            )}
          </div>

          {sizeAccordionOpen && (
            <div className={`p-3 pt-0 flex flex-col gap-3 ${dk ? 'bg-slate-900' : 'bg-white'}`}>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {THERMAL_SIZES.map(opt => { const k=`${opt.dims[0]}x${opt.dims[1]}`; return (
                    <button key={k} type="button" data-guide-anchor="printLabelEditor.tamanhoPreset" onClick={()=>handleSizeSelect(opt.dims)}
                      className={`py-2 px-3 rounded-xl border-2 font-black text-[9px] tracking-tight transition-all flex items-center justify-between ${sizeKey===k?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                      {opt.label}
                      {opt.star && <span className="text-[9px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full ml-1">minha</span>}
                    </button>
                  );})}
                </div>
                <div className={`flex items-center gap-2 p-3 rounded-xl border-2 ${sizeKey==='manual'?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20':'border-slate-100 dark:border-slate-800'}`}>
                  <button type="button" data-guide-anchor="printLabelEditor.tamanhoManual" onClick={()=>handleSizeSelect('manual')} className={`text-[9px] font-black uppercase whitespace-nowrap ${sizeKey==='manual'?'text-indigo-600':'text-slate-400'}`}>Manual</button>
                  <div className="flex items-center gap-1 flex-1">
                    <input type="number" min={10} max={200} value={manualW} title="Largura mm" placeholder="80"
                      onChange={e=>{setManualW(+e.target.value||10); if(sizeKey==='manual') localStorage.setItem(STORAGE_MANUAL, JSON.stringify([+e.target.value||10,manualH]));}}
                      className={`w-14 text-center px-2 py-1 rounded-lg border text-[10px] font-black outline-none ${dk?'bg-slate-800 border-slate-700 text-white':'bg-white border-slate-200 text-slate-800'}`}/>
                    <span className="text-[9px] text-slate-400 font-bold">×</span>
                    <input type="number" min={10} max={200} value={manualH} title="Altura mm" placeholder="40"
                      onChange={e=>{setManualH(+e.target.value||10); if(sizeKey==='manual') localStorage.setItem(STORAGE_MANUAL, JSON.stringify([manualW,+e.target.value||10]));}}
                      className={`w-14 text-center px-2 py-1 rounded-lg border text-[10px] font-black outline-none ${dk?'bg-slate-800 border-slate-700 text-white':'bg-white border-slate-200 text-slate-800'}`}/>
                    <span className="text-[9px] text-slate-400 font-bold">mm</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* View / Edit tabs */}
        <div className="flex items-center gap-2">
          <div className={`flex-1 flex p-1 rounded-2xl gap-1 ${dk?'bg-slate-800':'bg-slate-100'}`}>
            {([['view','Visualizar',<FileText size={12}/>],['edit','Ajustar',<Settings2 size={12}/>]] as const).map(([t,lbl,icon])=>(
              <button key={t} type="button" data-guide-anchor="printLabelEditor.abaVisualizarAjustar" onClick={()=>{setTab(t as any);setSelected(null);}}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab===t?'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm':'text-slate-400'}`}>
                {icon} {lbl}
              </button>
            ))}
          </div>
          {tab === 'edit' && (
            <button
              type="button"
              aria-label="Abrir etiqueta em tela cheia"
              title="Tela cheia — mais fácil de arrastar"
              data-guide-anchor="printLabelEditor.telaCheia"
              onClick={() => setFullscreenEdit(true)}
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90 ${dk ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Maximize2 size={16} />
            </button>
          )}
          <button
            type="button"
            aria-label="Dicas de edição"
            title="Como editar a etiqueta"
            data-guide-anchor="printLabelEditor.dicasAbrir"
            onClick={() => setTipsModalOpen(true)}
            className={`relative w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90 ${dk ? 'bg-slate-800 text-indigo-400 hover:bg-slate-700 active:bg-indigo-900/50' : 'bg-slate-100 text-indigo-500 hover:bg-slate-200 active:bg-indigo-100'}`}
          >
            <span className="absolute inset-0 rounded-2xl animate-pulse-indigo-ring pointer-events-none" />
            <HelpCircle size={16} />
          </button>
        </div>

        {/* Preview — overflow-hidden (não -auto): `scale` já é calculado (Math.min(scaleW,
            scaleH)) pra previewW/previewH nunca passarem de MAX_W/MAX_H, então esse container
            nunca precisa rolar de verdade; tê-lo como scrollável só dava ao Android WebView um
            gesto de rolagem pra "roubar" o toque no meio do arraste de uma forma/linha (mesmo
            bug corrigido na tela cheia — ver comentário lá). */}
        <div className={`rounded-2xl border-2 overflow-hidden ${dk?'border-slate-700 bg-slate-900':'border-slate-200 bg-slate-100'}`}>
          <div style={{ minWidth:'max-content' }}>
            {tab === 'edit' ? (
              <>
                <div style={{ display:'flex' }}>
                  <div style={{ width:RULER, height:RULER, flexShrink:0, backgroundColor:dk?'#1e293b':'#f1f5f9', borderBottom:`1px solid ${dk?'#334155':'#cbd5e1'}`, borderRight:`1px solid ${dk?'#334155':'#cbd5e1'}` }}/>
                  <Ruler axis="h" totalMm={W} scale={scale} isDark={dk}/>
                </div>
                <div style={{ display:'flex' }}>
                  <Ruler axis="v" totalMm={H} scale={scale} isDark={dk}/>
                  <EditPreview/>
                </div>
              </>
            ) : (
              <div className="flex justify-center p-3">
                <div style={{ boxShadow:'0 4px 24px rgba(0,0,0,0.12)', borderRadius:2, overflow:'hidden', flexShrink:0 }}>
                  <ContentPreview/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tela cheia do canvas de ajuste — mesmo EditPreview/Ruler de cima, só que sozinhos
            num overlay fixo. `overscrollBehavior:'contain'` + `touchAction:'none'` no fundo
            impedem que um arraste que escape de um elemento vire rolagem/pull-to-refresh da
            página por trás; sai só pelo X (sem swipe-to-close). */}
        {fullscreenEdit && tab === 'edit' && (
          <div
            className={`fixed inset-0 z-[95000] flex flex-col ${dk ? 'bg-slate-950' : 'bg-slate-100'}`}
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className={`flex flex-col gap-2 px-4 py-3 border-b shrink-0 ${dk ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <span className={`text-[11px] font-black uppercase tracking-widest truncate ${dk ? 'text-white' : 'text-slate-900'}`}>Ajustar Etiqueta — Tela Cheia</span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.telaCheiaCamadas"
                  onClick={() => setElemConfigOpen(true)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${dk ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  <Layers size={15} className="shrink-0" /> Camadas e Elementos — Liga/Desliga e Seleciona
                </button>
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.telaCheiaPreview"
                  onClick={() => setFullscreenPreviewMode(v => !v)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${fullscreenPreviewMode ? 'bg-indigo-600 text-white' : (dk ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}`}
                >
                  {fullscreenPreviewMode ? <Settings2 size={15} className="shrink-0" /> : <FileText size={15} className="shrink-0" />}
                  {fullscreenPreviewMode ? 'Voltar pra Edição' : 'Pré-visualizar Etiqueta Pronta'}
                </button>
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.telaCheiaSair"
                  onClick={() => { setFullscreenEdit(false); setFullscreenPreviewMode(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${dk ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={15} className="shrink-0" /> Sair da Tela Cheia
                </button>
              </div>
            </div>
            {/* overflow-hidden (não -auto) de propósito: sem container que role, não tem
                gesto de rolagem competindo pelo toque — mesmo mecanismo de arraste já
                validado na prévia normal (touchAction:'none' por elemento), sem precisar de
                touch-action bloqueando tudo num container grande por cima (isso é o que
                estava fazendo o WebView do Android cancelar o arraste no meio do gesto). */}
            <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
              {fullscreenPreviewMode ? (
                <div style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                  <ContentPreview />
                </div>
              ) : (
                <div style={{ minWidth: 'max-content' }}>
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: RULER, height: RULER, flexShrink: 0, backgroundColor: dk ? '#1e293b' : '#f1f5f9', borderBottom: `1px solid ${dk ? '#334155' : '#cbd5e1'}`, borderRight: `1px solid ${dk ? '#334155' : '#cbd5e1'}` }} />
                    <Ruler axis="h" totalMm={W} scale={scale} isDark={dk} />
                  </div>
                  <div style={{ display: 'flex' }}>
                    <Ruler axis="v" totalMm={H} scale={scale} isDark={dk} />
                    <EditPreview />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Configurar Elementos button */}
        {tab === 'edit' && (
          <button
            type="button"
            data-guide-anchor="printLabelEditor.elementosCamadasAbrir"
            onClick={() => setElemConfigOpen(true)}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-black text-[11px] uppercase tracking-widest transition-all ${
              dk
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-500 hover:text-indigo-400'
                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            <Layers size={15} />
            Elementos e Camadas
            <span className={`ml-1 text-[9px] font-black px-2 py-0.5 rounded-full ${dk ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
              {CONFIG_LIST_KEYS.filter(k => layout.elems[k].visible).length + (layout.shapes || []).filter(s => s.visible !== false).length}
              /{CONFIG_LIST_KEYS.length + (layout.shapes || []).length} visíveis
            </span>
          </button>
        )}

        {/* Adicionar Forma — retângulo de bordas arredondadas ou linha, decorativos */}
        {tab === 'edit' && (
          <div className="flex gap-2">
            <button type="button" data-guide-anchor="printLabelEditor.addForma" onClick={() => addShape('rect')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${dk ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'}`}>
              <Square size={14} strokeWidth={2.5} /> + Retângulo
            </button>
            <button type="button" data-guide-anchor="printLabelEditor.addForma" onClick={() => addShape('line')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${dk ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'}`}>
              <Minus size={14} strokeWidth={2.5} /> + Linha
            </button>
          </div>
        )}

        {/* Painel de ajuste da forma selecionada */}
        {tab === 'edit' && selectedShapeId && (() => {
          const shape = (layout.shapes || []).find(s => s.id === selectedShapeId);
          if (!shape) return null;
          return (
            <div className={`rounded-3xl border-2 overflow-hidden ${dk ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className={`flex items-center justify-between px-4 py-3 border-b ${dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center gap-2">
                  {shape.kind === 'rect' ? <Square size={14} style={{ color: shape.color }} /> : <Minus size={14} style={{ color: shape.color }} />}
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: shape.color }}>{shape.kind === 'rect' ? 'Retângulo' : 'Linha'}</span>
                  {shape.visible === false && (
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${dk ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>Oculta</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label={shape.visible === false ? 'Mostrar forma' : 'Ocultar forma'} data-guide-anchor="printLabelEditor.formaVisivel" onClick={() => updateShape(shape.id, { visible: shape.visible === false })}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${dk ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {shape.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button type="button" aria-label="Remover forma" data-guide-anchor="printLabelEditor.formaRemover" onClick={() => deleteShape(shape.id)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${dk ? 'bg-rose-900/30 text-rose-400 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {/* Cor */}
                <div className="flex items-center gap-2 flex-wrap">
                  {['#000000', '#ef4444', '#6366f1', '#f59e0b', '#10b981', '#0ea5e9', '#94a3b8'].map(c => (
                    <button key={c} type="button" aria-label={`Cor ${c}`} data-guide-anchor="printLabelEditor.formaCor" onClick={() => updateShape(shape.id, { color: c })}
                      className="w-7 h-7 rounded-full shrink-0 transition-all"
                      style={{ backgroundColor: c, boxShadow: shape.color === c ? `0 0 0 2px ${dk ? '#0f172a' : '#fff'}, 0 0 0 4px ${c}` : 'none' }} />
                  ))}
                </div>
                {/* Estilo da linha — sólida ou tracejada (vale pro contorno do retângulo também) */}
                <div className="flex gap-2">
                  {([[false, 'Sólida'], [true, 'Tracejada']] as const).map(([d, lbl]) => (
                    <button key={lbl} type="button" data-guide-anchor="printLabelEditor.formaEstiloLinha" onClick={() => updateShape(shape.id, { dashed: d })}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-[9px] font-black uppercase tracking-widest transition-all ${(!!shape.dashed) === d ? 'border-indigo-500 bg-indigo-600 text-white' : dk ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {/* Espessura */}
                <div className="flex flex-col gap-1.5">
                  <div className={`flex items-center rounded-2xl border overflow-hidden ${dk ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`text-[9px] font-black uppercase px-3 py-2.5 border-r shrink-0 w-20 text-center ${dk ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>Espessura</span>
                    <button type="button" aria-label="Diminuir espessura" data-guide-anchor="printLabelEditor.formaEspessura" onClick={() => updateShape(shape.id, { strokeWidth: Math.max(0.1, +(shape.strokeWidth - 0.1).toFixed(2)) })}
                      className={`w-9 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Minus size={13}/></button>
                    <span className={`flex-1 text-center text-[11px] font-black ${dk ? 'text-white' : 'text-slate-900'}`}>{shape.strokeWidth.toFixed(2)} mm</span>
                    <button type="button" aria-label="Aumentar espessura" data-guide-anchor="printLabelEditor.formaEspessura" onClick={() => updateShape(shape.id, { strokeWidth: +(shape.strokeWidth + 0.1).toFixed(2) })}
                      className={`w-9 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Plus size={13}/></button>
                  </div>
                  <input type="range" min={0.1} max={5} step={0.1} value={shape.strokeWidth}
                    onChange={e => updateShape(shape.id, { strokeWidth: parseFloat(e.target.value) })}
                    className="w-full" aria-label="Espessura (arrastar)" />
                </div>
                {/* Girar — retângulo gira em torno do próprio centro (campo shape.rotation);
                    linha "gira" recalculando w/h mantendo comprimento e centro fixos, já que o
                    ângulo dela já é o próprio vetor da linha, não um campo separado. */}
                {(() => {
                  const length = shape.kind === 'line' ? Math.hypot(shape.w, shape.h) : 0;
                  const currentAngle = shape.kind === 'rect'
                    ? Math.round((((shape.rotation ?? 0) % 360) + 360) % 360)
                    : Math.round((((Math.atan2(shape.h, shape.w) * 180 / Math.PI) % 360) + 360) % 360);
                  const setAngle = (deg: number) => {
                    const norm = ((deg % 360) + 360) % 360;
                    if (shape.kind === 'rect') {
                      updateShape(shape.id, { rotation: norm });
                    } else {
                      const rad = (norm * Math.PI) / 180;
                      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
                      const newW = length * Math.cos(rad), newH = length * Math.sin(rad);
                      updateShape(shape.id, { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH });
                    }
                  };
                  return (
                    <div className="flex flex-col gap-1.5">
                      <div className={`flex items-center rounded-2xl border overflow-hidden ${dk ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                        <span className={`text-[9px] font-black uppercase px-3 py-2.5 border-r shrink-0 w-20 text-center ${dk ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>Girar</span>
                        <button type="button" aria-label="Girar -1 grau" data-guide-anchor="printLabelEditor.formaGirar" onClick={() => setAngle(currentAngle - 1)}
                          className={`w-9 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Minus size={13}/></button>
                        <input
                          type="number" min={0} max={359} value={currentAngle}
                          onChange={e => setAngle(Number(e.target.value) || 0)}
                          aria-label="Ângulo em graus"
                          className={`flex-1 text-center text-[11px] font-black bg-transparent outline-none ${dk ? 'text-white' : 'text-slate-900'}`}
                        />
                        <span className={`text-[10px] font-bold pr-2 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>°</span>
                        <button type="button" aria-label="Girar +1 grau" data-guide-anchor="printLabelEditor.formaGirar" onClick={() => setAngle(currentAngle + 1)}
                          className={`w-9 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Plus size={13}/></button>
                      </div>
                      <input type="range" min={0} max={359} step={1} value={currentAngle}
                        onChange={e => setAngle(parseInt(e.target.value, 10))}
                        className="w-full" aria-label="Ângulo (arrastar)" />
                    </div>
                  );
                })()}
                {shape.kind === 'rect' && (
                  <>
                    <div className={`flex items-center rounded-2xl border overflow-hidden ${dk ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                      <span className={`text-[9px] font-black uppercase px-3 py-2.5 border-r shrink-0 w-20 text-center ${dk ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>Bordas</span>
                      <button type="button" aria-label="Diminuir raio da borda" data-guide-anchor="printLabelEditor.formaRaio" onClick={() => updateShape(shape.id, { radius: Math.max(0, (shape.radius ?? 0) - 0.5) })}
                        className={`w-9 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Minus size={13}/></button>
                      <span className={`flex-1 text-center text-[11px] font-black ${dk ? 'text-white' : 'text-slate-900'}`}>{(shape.radius ?? 0).toFixed(1)} mm</span>
                      <button type="button" aria-label="Aumentar raio da borda" data-guide-anchor="printLabelEditor.formaRaio" onClick={() => updateShape(shape.id, { radius: (shape.radius ?? 0) + 0.5 })}
                        className={`w-9 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Plus size={13}/></button>
                    </div>
                    <button type="button" data-guide-anchor="printLabelEditor.formaPreenchido" onClick={() => updateShape(shape.id, { filled: !shape.filled })}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${shape.filled ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : dk ? 'border-slate-700' : 'border-slate-200'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${dk ? 'text-slate-200' : 'text-slate-700'}`}>Preenchido</span>
                      <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 shrink-0 ${shape.filled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${shape.filled ? 'left-6' : 'left-1'}`} />
                      </div>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Largura', 'Altura'] as const).map((lbl) => {
                        const val = lbl === 'Largura' ? shape.w : shape.h;
                        const fn = (d: number) => resizeShape(shape.id, lbl === 'Largura' ? d : 0, lbl === 'Largura' ? 0 : d);
                        const setAbs = (v: number) => updateShape(shape.id, lbl === 'Largura' ? { w: Math.max(5, Math.min(W - shape.x, v)) } : { h: Math.max(5, Math.min(H - shape.y, v)) });
                        const max = lbl === 'Largura' ? W : H;
                        return (
                          <div key={lbl} className="flex flex-col gap-1">
                            <div className={`flex items-center rounded-2xl border overflow-hidden ${dk ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                              <span className={`text-[9px] font-black uppercase px-2 py-2.5 border-r shrink-0 ${dk ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>{lbl}</span>
                              <button type="button" aria-label={`Diminuir ${lbl}`} data-guide-anchor="printLabelEditor.formaLargAlt" onClick={() => fn(-1)}
                                className={`w-8 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Minus size={12}/></button>
                              <span className={`flex-1 text-center text-[10px] font-black ${dk ? 'text-white' : 'text-slate-900'}`}>{val.toFixed(1)}</span>
                              <button type="button" aria-label={`Aumentar ${lbl}`} data-guide-anchor="printLabelEditor.formaLargAlt" onClick={() => fn(1)}
                                className={`w-8 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Plus size={12}/></button>
                            </div>
                            <input type="range" min={5} max={max} step={0.5} value={val}
                              onChange={e => setAbs(parseFloat(e.target.value))}
                              className="w-full" aria-label={`${lbl} (arrastar)`} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {shape.kind === 'line' && (
                  <p className={`text-[9px] font-bold leading-relaxed ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                    Arraste a linha na etiqueta acima pra reposicionar. Toque e arraste as bolinhas nas pontas pra mudar o comprimento/ângulo.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Element config panel — centered modal */}
        {elemConfigOpen && (
          <div className="fixed inset-0 z-[96000] flex items-center justify-center p-4" onClick={() => setElemConfigOpen(false)}>
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-sm max-h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden ${dk ? 'bg-slate-900' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Layers size={16} />
                  </div>
                  <div>
                    <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>Elementos e Camadas</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Ligue/desligue e selecione cada bloco pra ajustar</p>
                  </div>
                </div>
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.elementosFechar"
                  onClick={() => setElemConfigOpen(false)}
                  aria-label="Fechar"
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${dk ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}
                >
                  <X size={16} />
                </button>
              </div>
              {/* Element list */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                {CONFIG_LIST_KEYS.map(key => {
                  const el = layout.elems[key];
                  const isSel = selected === key;
                  const isLocked = false;
                  return (
                    <div
                      key={key}
                      className={`flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all ${isLocked ? 'opacity-50' : ''} ${
                        isSel ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                      }`}
                      style={isSel ? { borderColor: el.color, backgroundColor: el.color + '15' } : {}}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: el.color }} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>{el.label}</p>
                          {isLocked ? (
                            <p className="text-[10px] font-bold text-amber-500 mt-0.5">Indisponível para mapa com várias variantes</p>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">X:{el.x.toFixed(1)} Y:{el.y.toFixed(1)} • {el.w.toFixed(1)}×{el.h.toFixed(1)} mm</p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isLocked}
                          data-guide-anchor="printLabelEditor.elementoAjustar"
                          onClick={() => { setSelected(isSel ? null : key); setElemConfigOpen(false); }}
                          className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${isLocked ? 'cursor-not-allowed' : ''} ${
                            isSel
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                              : dk
                                ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-indigo-400 hover:text-indigo-300'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'
                          }`}
                        >
                          {isSel ? <Check size={12} /> : 'Ajustar'}
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          aria-label={isLocked ? `${el.label} bloqueado` : el.visible ? `Ocultar ${el.label}` : `Mostrar ${el.label}`}
                          title={isLocked ? 'Disponível apenas para etiqueta de uma única variante' : undefined}
                          data-guide-anchor="printLabelEditor.elementoVisivel"
                          onClick={() => updateElem(key, { visible: !el.visible })}
                          className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${isLocked ? 'cursor-not-allowed' : ''} ${el.visible ? 'shadow-inner' : dk ? 'bg-slate-700' : 'bg-slate-200'}`}
                          style={el.visible ? { backgroundColor: el.color } : {}}
                        >
                          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200 flex items-center justify-center ${el.visible ? 'left-5' : 'left-0.5'}`}>
                            {isLocked ? <Lock size={10} className="text-amber-500" /> : el.visible ? <Eye size={10} style={{ color: el.color }} /> : <EyeOff size={10} className="text-slate-400" />}
                          </span>
                        </button>
                      </div>
                      {key === 'sectornotes' && !isLocked && el.visible && (
                        <div className="flex flex-col gap-1.5 pl-8">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Instrução a exibir</label>
                          {availableSectorNotes.length > 0 ? (
                            <button
                              type="button"
                              data-guide-anchor="printLabelEditor.instrucaoAbrir"
                              onClick={() => setNotePickerOpen(true)}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold border outline-none transition-all ${dk ? 'bg-slate-800 border-slate-700 text-white hover:border-indigo-500' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400'}`}
                            >
                              <span className="truncate">
                                {el.noteFilter
                                  ? availableSectorNotes.find(n => n.sectorId === el.noteFilter!.sectorId && n.noteName === el.noteFilter!.noteName)
                                    ? `${availableSectorNotes.find(n => n.sectorId === el.noteFilter!.sectorId && n.noteName === el.noteFilter!.noteName)!.sectorName} — ${el.noteFilter.noteName}`
                                    : 'Todas as instruções'
                                  : 'Todas as instruções'}
                              </span>
                              <ChevronDown size={13} className="shrink-0 text-slate-400" />
                            </button>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-400">Nenhuma instrução por setor cadastrada para esta cor.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Formas decorativas (retângulo/linha) — mesma mecânica de liga/desliga e
                    seleção dos elementos de texto acima. Ficam listadas aqui pra resolver
                    justamente o caso de formas sobrepostas atrapalhando o arraste no canvas:
                    dá pra ocultar a que está atrapalhando, ou selecionar direto pela lista
                    sem depender de acertar o toque nela na etiqueta. */}
                {(layout.shapes || []).length > 0 && (
                  <>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-2 mb-1 px-1 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>Formas</p>
                    {(layout.shapes || []).map((shape, idx) => {
                      const isSelShape = selectedShapeId === shape.id;
                      const isVisible = shape.visible !== false;
                      const shapeLabel = `${shape.kind === 'rect' ? 'Retângulo' : 'Linha'} ${idx + 1}`;
                      return (
                        <div
                          key={shape.id}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                            isSelShape ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                          }`}
                          style={isSelShape ? { borderColor: shape.color, backgroundColor: shape.color + '15' } : {}}
                        >
                          {shape.kind === 'rect' ? <Square size={14} style={{ color: shape.color }} className="shrink-0" /> : <Minus size={14} style={{ color: shape.color }} className="shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>{shapeLabel}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">X:{shape.x.toFixed(1)} Y:{shape.y.toFixed(1)} • {shape.w.toFixed(1)}×{shape.h.toFixed(1)} mm</p>
                          </div>
                          <button
                            type="button"
                            data-guide-anchor="printLabelEditor.formaAjustar"
                            onClick={() => { setSelected(null); setSelectedShapeId(isSelShape ? null : shape.id); setTab('edit'); setElemConfigOpen(false); }}
                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                              isSelShape
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20'
                                : dk
                                  ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-indigo-400 hover:text-indigo-300'
                                  : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'
                            }`}
                          >
                            {isSelShape ? <Check size={12} /> : 'Ajustar'}
                          </button>
                          <button
                            type="button"
                            aria-label={isVisible ? `Ocultar ${shapeLabel}` : `Mostrar ${shapeLabel}`}
                            data-guide-anchor="printLabelEditor.formaVisivelLista"
                            onClick={() => {
                              updateShape(shape.id, { visible: !isVisible });
                              if (isVisible && isSelShape) setSelectedShapeId(null);
                            }}
                            className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${isVisible ? 'shadow-inner' : dk ? 'bg-slate-700' : 'bg-slate-200'}`}
                            style={isVisible ? { backgroundColor: shape.color } : {}}
                          >
                            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200 flex items-center justify-center ${isVisible ? 'left-5' : 'left-0.5'}`}>
                              {isVisible ? <Eye size={10} style={{ color: shape.color }} /> : <EyeOff size={10} className="text-slate-400" />}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {/* Footer */}
              <div className={`px-4 py-4 border-t ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-guide-anchor="printLabelEditor.mostrarTodos"
                    onClick={() => { CONFIG_LIST_KEYS.forEach(k => updateElem(k, { visible: true })); (layout.shapes || []).forEach(s => updateShape(s.id, { visible: true })); }}
                    className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-1.5 active:scale-95 ${
                      dk ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-emerald-500 hover:text-emerald-400' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-400 hover:text-emerald-600'
                    }`}
                  >
                    <Eye size={13} /> Mostrar Todos
                  </button>
                  <button
                    type="button"
                    data-guide-anchor="printLabelEditor.elementosFechar"
                    onClick={() => setElemConfigOpen(false)}
                    className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <X size={13} /> Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instrução a exibir — popup centralizado, aberto a partir do elemento
            "Obs. Variante" dentro de Configurar Elementos */}
        {notePickerOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setNotePickerOpen(false)}>
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-sm max-h-[75vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden ${dk ? 'bg-slate-900' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-6 py-4 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-orange-500 flex items-center justify-center text-white shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>Instrução a Exibir</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Escolha a informação mostrada em Obs. Variante</p>
                  </div>
                </div>
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.instrucaoFechar"
                  onClick={() => setNotePickerOpen(false)}
                  aria-label="Fechar"
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${dk ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.instrucaoEscolher"
                  onClick={() => { updateElem('sectornotes', { noteFilter: undefined }); setNotePickerOpen(false); }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                    !layout.elems.sectornotes.noteFilter
                      ? 'border-orange-500 bg-orange-500/10'
                      : dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${!layout.elems.sectornotes.noteFilter ? 'border-orange-500 bg-orange-500 text-white' : dk ? 'border-slate-600' : 'border-slate-300'}`}>
                    {!layout.elems.sectornotes.noteFilter && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={`text-[11px] font-black uppercase tracking-widest ${dk ? 'text-white' : 'text-slate-900'}`}>Todas as instruções</span>
                </button>

                {availableSectorNotes.map(n => {
                  const isSel = layout.elems.sectornotes.noteFilter?.sectorId === n.sectorId && layout.elems.sectornotes.noteFilter?.noteName === n.noteName;
                  return (
                    <button
                      key={`${n.sectorId}::${n.noteName}`}
                      type="button"
                      data-guide-anchor="printLabelEditor.instrucaoEscolher"
                      onClick={() => { updateElem('sectornotes', { noteFilter: { sectorId: n.sectorId, noteName: n.noteName } }); setNotePickerOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                        isSel ? 'border-orange-500 bg-orange-500/10' : dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${isSel ? 'border-orange-500 bg-orange-500 text-white' : dk ? 'border-slate-600' : 'border-slate-300'}`}>
                        {isSel && <Check size={12} strokeWidth={3} />}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[11px] font-black uppercase tracking-widest truncate ${dk ? 'text-white' : 'text-slate-900'}`}>{n.noteName}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate">{n.sectorName} — {n.text}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Dicas de edição — abre sozinha na primeira vez (localStorage) e fica sempre
            acessível pelo "?" ao lado das abas Visualizar/Ajustar. */}
        {tipsModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={dismissTips}>
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-sm max-h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden ${dk ? 'bg-slate-900' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-6 py-5 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>Manual do Editor de Etiquetas</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Toque numa seção pra abrir</p>
                  </div>
                </div>
                <button type="button" data-guide-anchor="printLabelEditor.dicasFechar" onClick={dismissTips} aria-label="Fechar"
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${dk ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">
                {([
                  {
                    icon: Tag, title: 'Tamanho da Etiqueta',
                    items: [
                      'Escolha um dos tamanhos prontos ou toque em "Manual" pra digitar largura/altura na régua.',
                      '"Salvar Padrão" grava a etiqueta atual (tamanho + posições) com um nome — reaproveite depois em "Meus Padrões".',
                      '"Resetar" volta esse tamanho pro layout de fábrica, desfazendo seus ajustes.',
                    ],
                  },
                  {
                    icon: FileText, title: 'Visualizar × Ajustar',
                    items: [
                      '"Visualizar" mostra a etiqueta como ela sai de verdade, com os dados reais do produto/venda.',
                      '"Ajustar" troca pra blocos coloridos com o nome de cada campo — é onde você move, redimensiona e configura.',
                    ],
                  },
                  {
                    icon: Hand, title: 'Mover e Redimensionar',
                    items: [
                      'Na aba Ajustar, toque e arraste qualquer bloco direto na etiqueta pra reposicionar.',
                      'Com o bloco selecionado, os botões +/- e as barras deslizantes de Largura/Altura mudam o tamanho.',
                      'Os 4 pontinhos nos cantos do bloco mostram qual elemento está selecionado no momento.',
                    ],
                  },
                  {
                    icon: Layers, title: 'Configurar Elementos',
                    items: [
                      'Lista todos os campos disponíveis (Referência, Grade, QR Code, Embalagem, Foto, Rodapé, Dados OS, Obs. Variante...).',
                      'Toque no interruptor pra ligar/desligar cada um, ou em "Ajustar" pra selecioná-lo direto na etiqueta.',
                      '"Mostrar Todos" liga tudo de uma vez.',
                    ],
                  },
                  {
                    icon: Lock, title: 'Cadeado, Ocultar e Remover',
                    items: [
                      'Com um bloco selecionado, 3 botões aparecem no topo do painel: Cadeado, Olho e Lixeira.',
                      'Cadeado trava o bloco contra arraste/redimensionamento sem querer, depois de já estar no lugar certo.',
                      'Olho oculta o bloco temporariamente — útil pra selecionar um elemento menor escondido embaixo de um maior.',
                      'Lixeira remove o bloco da etiqueta (ele some, mas volta a aparecer pra religar em "Configurar Elementos").',
                    ],
                  },
                  {
                    icon: Check, title: 'Combinar Campos (Referência/Nome/Cor)',
                    items: [
                      'Selecione o bloco "Referência" — um painel "Combinar Campos" aparece com 3 opções: Ref, Nome, Cor.',
                      'Toque pra ligar/desligar qualquer combinação (ex.: só Ref+Cor) — o texto final junta os marcados nessa ordem.',
                      'Nome e Cor não têm mais bloco próprio — só existem como opções aqui dentro.',
                    ],
                  },
                  {
                    icon: Sparkles, title: 'Tipografia e Inverter',
                    items: [
                      'Fonte, tamanho e negrito ficam no painel "Tipografia" do elemento selecionado.',
                      'O botão "Aa" (Inverter) desenha um retângulo preto arredondado com o texto em branco por cima — sai assim na etiqueta impressa também.',
                    ],
                  },
                  {
                    icon: Package, title: 'Grade e Embalagem',
                    items: [
                      'Grade mostra o tamanho e a quantidade real de pares de cada numeração daquela caixa específica.',
                      'Nas Vendas, a origem dos números segue uma ordem: caixa já separada → lote em estoque → embalagem cadastrada → grade padrão do produto (só como último recurso).',
                      'Embalagem mostra o nome do padrão de embalagem daquela caixa (opcional, desligado por padrão).',
                    ],
                  },
                  {
                    icon: Square, title: 'Formas — Retângulo e Linha',
                    items: [
                      '"+ Retângulo" e "+ Linha" adicionam formas decorativas — bordas, molduras, divisórias.',
                      'Arraste pra mover; nas linhas, arraste as bolinhas das pontas pra mudar ângulo/comprimento.',
                      'No painel da forma: cor, espessura, e (só retângulo) raio da borda e se é preenchido.',
                    ],
                  },
                  {
                    icon: ImageIcon, title: 'Foto e Miniatura para Etiqueta',
                    items: [
                      'O elemento "Foto" usa a Miniatura para Etiqueta do produto quando cadastrada — senão usa a foto normal.',
                      'Miniatura para Etiqueta é um desenho de linhas do modelo (não uma foto), cadastrado no Cadastro de Produto — fica mais nítido numa impressora térmica de baixa resolução do que uma foto normal.',
                    ],
                  },
                  {
                    icon: Share2, title: 'Compartilhar e Imprimir',
                    items: [
                      '"Compartilhar" gera a etiqueta em JPG ou PDF, no tamanho exato configurado — pronta pra enviar ou abrir noutro app de impressão.',
                      '"Imprimir na Impressora" manda direto pra Ablemark BR-L100 via Bluetooth (só Android) — escolha direção, deslocamento, densidade e cópias antes de enviar.',
                      'Em lote (várias etiquetas de uma vez), dá pra exportar tudo numa imagem só combinada ou em arquivos separados.',
                    ],
                  },
                ] as { icon: typeof Hand; title: string; items: string[] }[]).map(({ icon: Icon, title, items }, i, arr) => (
                  <div key={i} className={i < arr.length - 1 ? `pb-3.5 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}` : ''}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${dk ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Icon size={13} />
                      </div>
                      <span className={`text-[11px] font-black ${dk ? 'text-white' : 'text-slate-900'}`}>{title}</span>
                    </div>
                    <ul className="flex flex-col gap-1.5 pl-1">
                      {items.map((it, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${dk ? 'bg-slate-600' : 'bg-slate-300'}`} />
                          <span className={`text-[10px] font-bold leading-relaxed ${dk ? 'text-slate-400' : 'text-slate-500'}`}>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className={`px-6 py-4 border-t ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                <button type="button" data-guide-anchor="printLabelEditor.dicasFechar" onClick={dismissTips}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Meus Padrões — popup centralizado com os tamanhos salvos pelo usuário */}
        {myPresetsPopupOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setMyPresetsPopupOpen(false)}>
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-sm max-h-[75vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden ${dk ? 'bg-slate-900' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-6 py-4 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>Meus Padrões</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Tamanhos de etiqueta salvos por você</p>
                  </div>
                </div>
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.meusPadroesFechar"
                  onClick={() => setMyPresetsPopupOpen(false)}
                  aria-label="Fechar"
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${dk ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                {customPresets.length === 0 ? (
                  <p className="text-[11px] font-bold text-slate-400 text-center py-6">Nenhum padrão salvo ainda.</p>
                ) : customPresets.map(preset => {
                  const isSel = sizeKey === 'manual' && manualW === preset.dims[0] && manualH === preset.dims[1];
                  return (
                    <div key={preset.id} className={`flex items-center gap-0 rounded-2xl border-2 overflow-hidden transition-all ${
                      isSel ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                    }`}>
                      <button
                        type="button"
                        data-guide-anchor="printLabelEditor.padraoCarregar"
                        onClick={() => { handleLoadPreset(preset); setMyPresetsPopupOpen(false); }}
                        className={`flex-1 min-w-0 flex items-center gap-2 py-3 px-4 text-left transition-all ${
                          isSel ? 'text-emerald-600 dark:text-emerald-400' : dk ? 'text-slate-200' : 'text-slate-700'
                        }`}
                      >
                        <span className="text-[11px] font-black uppercase tracking-widest truncate">{preset.name}</span>
                        <span className="text-[9px] font-bold opacity-60 shrink-0">{preset.dims[0]}×{preset.dims[1]}mm</span>
                      </button>
                      <button
                        type="button"
                        data-guide-anchor="printLabelEditor.padraoRenomear"
                        onClick={() => setRenamePreset({ id: preset.id, name: preset.name })}
                        title="Renomear padrão"
                        className={`px-3 py-3 border-l transition-all ${
                          dk ? 'border-slate-700 text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/20' : 'border-slate-200 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'
                        }`}
                      >
                        <Pencil size={13}/>
                      </button>
                      <button
                        type="button"
                        data-guide-anchor="printLabelEditor.padraoExcluir"
                        onClick={() => handleDeletePreset(preset.id)}
                        title="Excluir padrão"
                        className={`px-3 py-3 border-l transition-all ${
                          dk ? 'border-slate-700 text-slate-500 hover:text-rose-400 hover:bg-rose-900/20' : 'border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50'
                        }`}
                      >
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Controls panel */}
        {tab === 'edit' && selected && sel && (
          <div className={`rounded-3xl border-2 overflow-hidden ${dk ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

            {/* ── Header: element name + remover ── */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: sel.color }} />
                <span className="text-[11px] font-black uppercase tracking-widest truncate" style={{ color: sel.color }}>{sel.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label={sel.locked ? `Destravar ${sel.label}` : `Travar ${sel.label}`}
                  title={sel.locked ? 'Destravado — toque pra travar contra arraste/redimensionamento' : 'Travar — impede mover ou redimensionar por engano'}
                  data-guide-anchor="printLabelEditor.elementoTravar"
                  onClick={() => updateElem(selected, { locked: !sel.locked })}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${sel.locked ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : dk ? 'bg-slate-900 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                >
                  {sel.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <button
                  type="button"
                  aria-label={sel.visible ? `Ocultar ${sel.label}` : `Mostrar ${sel.label}`}
                  title={sel.visible ? 'Ocultar temporariamente — útil pra selecionar um elemento embaixo de um maior' : 'Mostrar de novo'}
                  data-guide-anchor="printLabelEditor.elementoOcultar"
                  onClick={() => updateElem(selected, { visible: !sel.visible })}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${!sel.visible ? 'bg-slate-200 dark:bg-slate-700 text-slate-500' : dk ? 'bg-slate-900 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                >
                  {sel.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${sel.label} da etiqueta`}
                  title="Remover — pode ser trazido de volta em Configurar Elementos"
                  data-guide-anchor="printLabelEditor.elementoRemover"
                  onClick={() => { updateElem(selected, { visible: false }); setSelected(null); }}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${dk ? 'bg-rose-900/30 text-rose-400 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4">

              {/* ── Position + Size pills ── */}
              <div className={`flex rounded-2xl overflow-hidden border ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                {([['X', sel.x], ['Y', sel.y], ['L', sel.w], ['A', sel.h]] as [string, number][]).map(([lbl, val], i) => (
                  <div key={lbl} className={`flex-1 flex flex-col items-center py-2.5 ${i < 3 ? `border-r ${dk ? 'border-slate-700' : 'border-slate-200'}` : ''} ${dk ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                    <span className={`text-[9px] font-black uppercase leading-none mb-1 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>{lbl}</span>
                    <span className={`text-[11px] font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>{val.toFixed(1)}</span>
                  </div>
                ))}
              </div>

              {/* ── Resize capsules — arraste o bloco na etiqueta acima pra mover; aqui só
                  redimensiona (o D-pad de setas foi removido, o arraste substitui) ── */}
              <div className={`grid grid-cols-2 gap-3 transition-opacity ${sel.locked ? 'opacity-40 pointer-events-none' : ''}`}>
                {([
                    ['Largura', sel.w, (d: number) => resizeElem(selected, d, 0), 5, W, (v: number) => updateElem(selected, { w: Math.max(5, Math.min(W - sel.x, v)) })],
                    ['Altura', sel.h, (d: number) => resizeElem(selected, 0, d), 2, H, (v: number) => updateElem(selected, { h: Math.max(2, Math.min(H - sel.y, v)) })],
                  ] as [string, number, (d: number) => void, number, number, (v: number) => void][]).map(([lbl, val, fn, min, max, setAbs]) => (
                    <div key={lbl} className="flex flex-col gap-1.5">
                      <div className={`flex flex-col items-center rounded-2xl border overflow-hidden ${dk ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                        <span className={`text-[9px] font-black uppercase w-full text-center py-2 border-b ${dk ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>{lbl}</span>
                        <div className="flex items-center w-full">
                          <button type="button" disabled={sel.locked} aria-label={`Diminuir ${lbl}`} data-guide-anchor="printLabelEditor.elementoTamanho" onClick={() => fn(-0.5)}
                            className={`w-9 h-9 flex items-center justify-center shrink-0 transition-colors active:scale-90 ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Minus size={13}/></button>
                          <span className={`flex-1 text-center text-[11px] font-black ${dk ? 'text-white' : 'text-slate-900'}`}>{val.toFixed(1)}</span>
                          <button type="button" disabled={sel.locked} aria-label={`Aumentar ${lbl}`} data-guide-anchor="printLabelEditor.elementoTamanho" onClick={() => fn(0.5)}
                            className={`w-9 h-9 flex items-center justify-center shrink-0 transition-colors active:scale-90 ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Plus size={13}/></button>
                        </div>
                      </div>
                      <input
                        type="range" min={min} max={max} step={0.5}
                        value={val}
                        disabled={sel.locked}
                        onChange={e => setAbs(parseFloat(e.target.value))}
                        className="w-full"
                        aria-label={`${lbl} (arrastar)`}
                      />
                    </div>
                  ))}
              </div>

              {/* ── Combinar Campos — só no elemento Referência: junta Ref/Nome/Cor num único
                  campo, em qualquer combinação (ex.: só Ref+Cor) ── */}
              {selected === 'reference' && (
                <div className={`rounded-2xl border overflow-hidden ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className={`px-4 py-2 border-b ${dk ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Combinar Campos Neste Elemento</span>
                  </div>
                  <div className={`p-3 grid grid-cols-3 gap-1.5 ${dk ? 'bg-slate-800/30' : 'bg-white'}`}>
                    {([['reference', 'Ref'], ['name', 'Nome'], ['color', 'Cor']] as const).map(([field, label]) => {
                      const active = (sel.combineFields || ['reference']).includes(field);
                      return (
                        <button
                          key={field}
                          type="button"
                          data-guide-anchor="printLabelEditor.combinarCampos"
                          onClick={() => {
                            const current = sel.combineFields || ['reference'];
                            const next = active ? current.filter(f => f !== field) : [...current, field];
                            // Nunca deixa vazio — sem nada marcado, volta a mostrar só a Referência.
                            updateElem(selected, { combineFields: next.length > 0 ? next : ['reference'] });
                          }}
                          className={`py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm' : `border-transparent ${dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className={`px-4 pb-3 text-[9px] font-bold leading-relaxed ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                    {combineRefFields(sel.combineFields, product.reference || product.name, product.name, variation?.colorName || '---')}
                  </p>
                </div>
              )}

              {/* ── Typography capsule ── */}
              <div className={`rounded-2xl border overflow-hidden ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className={`px-4 py-2 border-b ${dk ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Tipografia</span>
                </div>
                <div className={`p-3 flex flex-col gap-3 ${dk ? 'bg-slate-800/30' : 'bg-white'}`}>
                  {/* Font family */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {([
                      ['helvetica', 'Sans',  'Helvetica, Arial, sans-serif'],
                      ['arial',     'Arial', 'Arial, sans-serif'],
                      ['times',     'Serif', 'Georgia, serif'],
                      ['courier',   'Mono',  'monospace'],
                      ['avenir',    'Geo',   '"Century Gothic","Trebuchet MS",sans-serif'],
                    ] as [FontFamily, string, string][]).map(([f, label, ff]) => (
                      <button key={f} type="button" data-guide-anchor="printLabelEditor.tipoFonte" onClick={() => updateElem(selected, { fontFamily: f })}
                        className={`py-2 rounded-xl border text-[9px] font-black transition-all ${(sel.fontFamily === f || (!sel.fontFamily && f === 'helvetica')) ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm' : `border-transparent ${dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}`}
                        style={{ fontFamily: ff }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Size + Bold */}
                  <div className={`flex items-center rounded-2xl border overflow-hidden ${dk ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`text-[9px] font-black uppercase px-3 py-2.5 border-r shrink-0 w-16 text-center ${dk ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>Tamanho</span>
                    <button type="button" aria-label="Diminuir fonte" data-guide-anchor="printLabelEditor.fonteTamanho" onClick={() => updateElem(selected, { fontSize: Math.max(3, (sel.fontSize || 8) - 0.5) })}
                      className={`w-9 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Minus size={13}/></button>
                    <span className={`flex-1 text-center text-[11px] font-black ${dk ? 'text-white' : 'text-slate-900'}`}>{(sel.fontSize || 8).toFixed(1)} pt</span>
                    <button type="button" aria-label="Aumentar fonte" data-guide-anchor="printLabelEditor.fonteTamanho" onClick={() => updateElem(selected, { fontSize: (sel.fontSize || 8) + 0.5 })}
                      className={`w-9 h-9 flex items-center justify-center shrink-0 active:scale-90 transition-colors ${dk ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}><Plus size={13}/></button>
                    <button type="button" aria-label="Negrito" data-guide-anchor="printLabelEditor.fonteNegrito" onClick={() => updateElem(selected, { bold: !sel.bold })}
                      className={`w-10 h-9 border-l flex items-center justify-center text-[13px] font-black transition-all ${sel.bold ? `bg-indigo-600 text-white ${dk ? 'border-slate-700' : 'border-indigo-500'}` : `${dk ? 'border-slate-700 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}`}>B</button>
                    <button type="button" aria-label="Inverter cor (texto branco em fundo preto)" title="Inverter — texto branco em retângulo preto, igual na impressão"
                      data-guide-anchor="printLabelEditor.fonteInverter"
                      onClick={() => updateElem(selected, { invert: !sel.invert })}
                      className={`w-10 h-9 border-l flex items-center justify-center shrink-0 transition-all ${sel.invert ? `bg-indigo-600 ${dk ? 'border-slate-700' : 'border-indigo-500'}` : `${dk ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-200 hover:bg-slate-100'}`}`}>
                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black leading-none ${sel.invert ? 'bg-white text-indigo-600' : 'bg-slate-900 text-white'}`}>Aa</span>
                    </button>
                  </div>
                  <input
                    type="range" min={3} max={30} step={0.5}
                    value={sel.fontSize || 8}
                    onChange={e => updateElem(selected, { fontSize: parseFloat(e.target.value) })}
                    className="w-full"
                    aria-label="Tamanho da fonte"
                  />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* JPG do lote: imagem combinada x arquivos separados + espaçamento */}
        {batchItems && batchItems.length > 1 && (
          <div className={`flex flex-col gap-3 p-4 rounded-2xl border ${dk?'bg-slate-900 border-slate-800':'bg-slate-50 border-slate-100'}`}>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Exportação JPG do Lote</label>
            <div className="flex gap-2">
              <button type="button" data-guide-anchor="printLabelEditor.jpgLoteModo" onClick={() => setJpgBatchMode('combined')}
                className={`flex-1 py-2 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${jpgBatchMode==='combined'?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                1 imagem combinada
              </button>
              <button type="button" data-guide-anchor="printLabelEditor.jpgLoteModo" onClick={() => setJpgBatchMode('separate')}
                className={`flex-1 py-2 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${jpgBatchMode==='separate'?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                {batchItems.length} arquivos separados
              </button>
            </div>
            {jpgBatchMode === 'combined' && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase">Espaçamento entre etiquetas (mm):</span>
                <input type="number" min={0} step={0.5} value={jpgSpacing} onChange={e=>setJpgSpacing(Math.max(0,+e.target.value))} title="Espaçamento entre etiquetas (mm)"
                  className={`w-16 text-center px-2 py-2 rounded-xl border-2 text-[10px] font-black outline-none ${dk?'bg-slate-800 border-slate-700 text-white':'bg-white border-slate-200 text-slate-800'}`}/>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button type="button" data-guide-anchor="printLabelEditor.compartilhar" onClick={() => setShowShareFormatPicker(true)} disabled={printing || exportingJpg}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
            <Share2 size={16}/> {(printing || exportingJpg) ? 'Gerando…' : 'Compartilhar'}
          </button>
          {isGallerySaverPlatform() && (
          <button type="button" data-guide-anchor="printLabelEditor.salvarGaleria" onClick={handleSaveToGallery} disabled={printing || savingGallery}
            className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
            <Download size={16}/> {savingGallery ? 'Salvando…' : 'Salvar na Galeria'}
          </button>
          )}
          {isAblemarkPlatform() && (
          <button type="button" data-guide-anchor="printLabelEditor.imprimirBluetooth" onClick={handleOpenBluetoothPrint} disabled={printing || exportingJpg || preparingBt}
            className="w-full py-4 rounded-2xl bg-sky-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
            <Bluetooth size={16}/> {preparingBt ? 'Preparando…' : 'Imprimir na Impressora'}
          </button>
          )}
          <button type="button" data-guide-anchor="printLabelEditor.cancelar" onClick={onClose} className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest ${dk?'bg-slate-800 text-slate-400':'bg-slate-100 text-slate-500'}`}>
            Cancelar
          </button>
        </div>
      </div>

      {/* ── Popup: escolher formato de compartilhamento ── */}
      <Modal isOpen={showShareFormatPicker} onClose={() => setShowShareFormatPicker(false)} title="Compartilhar Etiqueta" maxWidth="max-w-xs" zIndex={98000}>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-center text-slate-500 dark:text-slate-400">Em qual formato?</p>
          <button
            type="button"
            data-guide-anchor="printLabelEditor.formatoEscolher"
            onClick={() => { setShowShareFormatPicker(false); handleExportJpg(); }}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-emerald-600 text-white"
          >
            <ImageIcon size={16} /> {batchItems && batchItems.length > 1 ? `JPG (${batchItems.length})` : 'JPG'}
          </button>
          <button
            type="button"
            data-guide-anchor="printLabelEditor.formatoEscolher"
            onClick={() => { setShowShareFormatPicker(false); handlePrint(); }}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest ${dk ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <FileText size={16} /> {batchItems && batchItems.length > 1 ? `PDF (${batchItems.length})` : 'PDF'}
          </button>
        </div>
      </Modal>

      {/* ── Popup: conectar impressora (só aparece se tentar imprimir desconectado) ── */}
      <Modal isOpen={showConnectPrompt} onClose={() => setShowConnectPrompt(false)} title="Conectar Impressora" maxWidth="max-w-xs" zIndex={98000}>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-center text-slate-500 dark:text-slate-400">
            A impressora está desconectada — conecte pra continuar.
          </p>
          <button
            type="button"
            data-guide-anchor="printLabelEditor.listarDispositivos"
            onClick={async () => { setLoadingBtDevices(true); try { setBtDevices(await listAbleMarkPairedDevices()); } finally { setLoadingBtDevices(false); } }}
            disabled={loadingBtDevices}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${dk ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <RefreshCw size={13} className={loadingBtDevices ? 'animate-spin' : ''} /> Listar dispositivos pareados
          </button>
          {btDevices.map(d => (
            <button
              key={d.address}
              type="button"
              data-guide-anchor="printLabelEditor.conectarDispositivo"
              onClick={() => handleConnectBtDevice(d.address)}
              disabled={!!connectingBtAddress}
              className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${dk ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bluetooth size={13} className="text-indigo-500 shrink-0" />
                <span className="text-xs font-black truncate">{d.name}</span>
              </div>
              {connectingBtAddress === d.address && <RefreshCw size={13} className="animate-spin text-indigo-400" />}
            </button>
          ))}
        </div>
      </Modal>

      <LabelPrintPreviewModal
        isOpen={showBtPreview}
        onClose={() => setShowBtPreview(false)}
        isDarkMode={dk}
        widthMm={W}
        heightMm={H}
        previewDataUrls={btFramesCache.map(f => f.toDataURL('image/png'))}
        totalLabelsNote={btFramesCache.length > 1 ? `${btFramesCache.length} etiquetas na grade × cópias` : undefined}
        onConfirmPrint={handleConfirmBtPrint}
      />

      {/* ── Modal: Salvar Padrão ── */}
      {savePresetModal.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setSavePresetModal({ open: false, name: '' })}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div
            className={`relative w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden ${dk ? 'bg-slate-900' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-6 py-5 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <BookmarkPlus size={18} />
                </div>
                <div>
                  <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>Salvar Padrão</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">{W}×{H} mm • {sizeKey === 'manual' ? 'Manual' : sizeKey}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={`text-[10px] font-black uppercase tracking-widest ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Nome do Padrão</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Ex: Etiqueta BOSS Preto, Grade Silk..."
                  value={savePresetModal.name}
                  onChange={e => setSavePresetModal(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(savePresetModal.name); }}
                  maxLength={40}
                  className={`w-full px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                    dk ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-emerald-400'
                  }`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.padraoModalCancelar"
                  onClick={() => setSavePresetModal({ open: false, name: '' })}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${
                    dk ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.padraoModalSalvar"
                  onClick={() => handleSavePreset(savePresetModal.name)}
                  className="flex-1 py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check size={13}/> Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Renomear Padrão ── */}
      {renamePreset && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setRenamePreset(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div
            className={`relative w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden ${dk ? 'bg-slate-900' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-6 py-5 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Pencil size={18} />
                </div>
                <div>
                  <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>Renomear Padrão</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Altere o nome deste padrão de etiqueta</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={`text-[10px] font-black uppercase tracking-widest ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Novo Nome</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nome do padrão..."
                  value={renamePreset.name}
                  onChange={e => setRenamePreset(p => p ? { ...p, name: e.target.value } : null)}
                  onKeyDown={e => { if (e.key === 'Enter' && renamePreset) handleRenamePreset(renamePreset.id, renamePreset.name); }}
                  maxLength={40}
                  className={`w-full px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    dk ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400'
                  }`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.renomearCancelar"
                  onClick={() => setRenamePreset(null)}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${
                    dk ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-guide-anchor="printLabelEditor.renomearSalvar"
                  onClick={() => renamePreset && handleRenamePreset(renamePreset.id, renamePreset.name)}
                  className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check size={13}/> Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
