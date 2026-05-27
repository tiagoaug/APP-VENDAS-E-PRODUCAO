import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  RotateCcw, Eye, EyeOff, Plus, Minus, Settings2, FileText, Tag,
  Image as ImageIcon, Layers, Check, X,
} from 'lucide-react';
import Modal from './Modal';
import { Product, Variation, SaleType, LabelLayout, Grid, ProductionLot, ServiceOrder } from '../types';
import { labelService } from '../services/labelService';
import { shareImage } from '../utils/pdfExport';

// ─── Types ────────────────────────────────────────────────────────────────────

type ElemKey    = 'reference' | 'name' | 'color' | 'size' | 'qr' | 'footer' | 'photo' | 'grade' | 'osdata';
type FontFamily = 'helvetica' | 'times' | 'courier';
type Elem = {
  x: number; y: number; w: number; h: number;
  label: string; color: string; visible: boolean;
  fontSize?: number; fontFamily?: FontFamily; bold?: boolean;
};
type Layout = { paper: [number, number]; elems: Record<ElemKey, Elem> };
type PrintMode = 'document' | 'thermal';

// ─── Size presets ─────────────────────────────────────────────────────────────

const DOC_SIZES: { label: string; dims: [number, number] }[] = [
  { label: 'Ticket 80×120', dims: [80,  120] },
  { label: 'A6  105×148',   dims: [105, 148] },
  { label: 'A5  148×210',   dims: [148, 210] },
];

const THERMAL_SIZES: { label: string; dims: [number, number]; star?: boolean }[] = [
  { label: '75 × 24 mm',  dims: [75, 24],  star: true },
  { label: '38 × 25 mm',  dims: [38, 25]  },
  { label: '50 × 30 mm',  dims: [50, 30]  },
  { label: '57 × 40 mm',  dims: [57, 40]  },
  { label: '80 × 40 mm',  dims: [80, 40]  },
  { label: '80 × 50 mm',  dims: [80, 50]  },
  { label: '100 × 50 mm', dims: [100, 50] },
  { label: '40 × 30 mm',  dims: [40, 30]  },
];

const ELEM_KEYS: ElemKey[] = ['reference', 'name', 'color', 'size', 'qr', 'footer', 'photo', 'grade', 'osdata'];
const STEPS = [0.5, 1, 2, 5];
const STORAGE_MODE    = 'lbl_print_mode';
const STORAGE_SIZE    = 'lbl_print_size';
const STORAGE_MANUAL  = 'lbl_print_manual';
const STORAGE_LAYOUTS = 'lbl_print_layouts_v1';

// ─── Default layouts ──────────────────────────────────────────────────────────

function isThermal([W, H]: [number, number]) { return H <= 60 || W > H * 1.5; }

function defaultLayout([W, H]: [number, number]): Layout {
  if (isThermal([W, H])) {
    const qrSize = Math.min(H - 4, W * 0.34);
    const textW  = W - qrSize - 5;
    const qrX    = W - qrSize - 2;
    const qrY    = (H - qrSize) / 2;
    return {
      paper: [W, H],
      elems: {
        reference: { x: 0,   y: 0,          w: textW, h: H * 0.32, label: 'Referência', color: '#000000', visible: true,  fontSize: 7,   fontFamily: 'helvetica', bold: true  },
        name:      { x: 0,   y: H * 0.32,   w: textW, h: H * 0.26, label: 'Nome',       color: '#000000', visible: false, fontSize: 5,   fontFamily: 'helvetica', bold: false },
        color:     { x: 0,   y: H * 0.42,   w: textW, h: H * 0.28, label: 'Cor',        color: '#000000', visible: true,  fontSize: 5.5, fontFamily: 'helvetica', bold: false },
        size:      { x: 0,   y: H * 0.68,   w: textW, h: H * 0.32, label: 'Tamanho',    color: '#000000', visible: true,  fontSize: 9,   fontFamily: 'helvetica', bold: true  },
        qr:        { x: qrX, y: qrY,        w: qrSize,h: qrSize,   label: 'QR Code',    color: '#000000', visible: true,  fontSize: 8,   fontFamily: 'helvetica', bold: false },
        footer:    { x: 0,   y: H - 2,      w: W,     h: 2,        label: 'Rodapé',     color: '#000000', visible: false, fontSize: 3,   fontFamily: 'helvetica', bold: false },
        photo:     { x: 0,   y: 0,          w: 0,     h: 0,        label: 'Foto',       color: '#000000', visible: false, fontSize: 6,   fontFamily: 'helvetica', bold: false },
        grade:     { x: 0,   y: H * 0.62,   w: textW, h: H * 0.38, label: 'Grade',      color: '#f59e0b', visible: false, fontSize: 5,   fontFamily: 'helvetica', bold: true  },
        osdata:    { x: 0,   y: H - 3,      w: textW, h: 3,        label: 'Dados OS',   color: '#6366f1', visible: false, fontSize: 3.5, fontFamily: 'helvetica', bold: false },
      },
    };
  }
  const s = Math.min(W, H) / 40;
  const photoSz = 12 * s;
  return {
    paper: [W, H],
    elems: {
      reference: { x: 0,        y: 0,       w: W,     h: 6*s,     label: 'Referência', color: '#000000', visible: true,  fontSize: 8*s,  fontFamily: 'helvetica', bold: true  },
      name:      { x: 2*s,      y: 7*s,     w: W-4*s, h: 5*s,     label: 'Nome',       color: '#000000', visible: true,  fontSize: 6*s,  fontFamily: 'helvetica', bold: false },
      color:     { x: 0,        y: H-4*s,   w: W,     h: 4*s,     label: 'Cor',        color: '#000000', visible: true,  fontSize: 7*s,  fontFamily: 'helvetica', bold: true  },
      size:      { x: W-9*s,    y: 5*s,     w: 8*s,   h: 8*s,     label: 'Tamanho',    color: '#000000', visible: true,  fontSize: 11*s, fontFamily: 'helvetica', bold: true  },
      qr:        { x: (W-20*s)/2, y: 6*s,  w: 20*s,  h: 20*s,    label: 'QR Code',    color: '#000000', visible: true,  fontSize: 8,    fontFamily: 'helvetica', bold: false },
      footer:    { x: 0,        y: H-2*s,   w: W,     h: 2*s,     label: 'Rodapé',     color: '#000000', visible: true,  fontSize: 4*s,  fontFamily: 'helvetica', bold: false },
      photo:     { x: W-photoSz, y: H-4*s-photoSz, w: photoSz, h: photoSz, label: 'Foto', color: '#000000', visible: false, fontSize: 6, fontFamily: 'helvetica', bold: false },
      grade:     { x: 2*s,      y: H-10*s,  w: W-4*s, h: 7*s,     label: 'Grade',      color: '#f59e0b', visible: false, fontSize: 6*s,  fontFamily: 'helvetica', bold: true  },
      osdata:    { x: 2*s,      y: H-3.5*s, w: W-4*s, h: 3*s,     label: 'Dados OS',   color: '#6366f1', visible: false, fontSize: 4*s,  fontFamily: 'helvetica', bold: false },
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrintLabelEditorModal({ isOpen, onClose, product, isDarkMode, grids = [], lot, sizeGridOverride, os }: Props) {
  const [printMode, setPrintMode] = useState<PrintMode>(() => (localStorage.getItem(STORAGE_MODE) as PrintMode) || 'thermal');
  const [sizeKey, setSizeKey]     = useState<string>(() => localStorage.getItem(STORAGE_SIZE) || '75x24');
  const [layouts, setLayouts]     = useState<Record<string, Layout>>(loadLayouts);
  const [selected, setSelected]   = useState<ElemKey | null>(null);
  const [step, setStep]           = useState(1);
  const [tab, setTab]             = useState<'view'|'edit'>('view');
  const [elemConfigOpen, setElemConfigOpen] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [exportingJpg, setExportingJpg] = useState(false);
  const [qrPreview, setQrPreview] = useState('');

  // Label options
  const [selectedVariationId, setSelectedVariationId] = useState((product.variations || [])[0]?.id || '');
  const [selectedSizes, setSelectedSizes]             = useState<string[]>([]);
  const [useStockQty, setUseStockQty]                 = useState(false);
  const [isBoxLabel, setIsBoxLabel]                   = useState(product.type === SaleType.WHOLESALE);
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
  const layout: Layout = {
    ...rawLayout,
    elems: {
      ...def.elems,
      ...(rawLayout.elems || {})
    }
  };

  const variation = (product.variations || []).find(v => v.id === selectedVariationId) || (product.variations || [])[0];
  const availSizes = variation ? Object.keys(variation.stock).filter(s => s !== 'WHOLESALE') : [];
  const previewSize = selectedSizes[0] || availSizes[0] || '38';

  const activeGrid = grids.find(g => g.id === product.defaultGridId);
  const sizeGrid = (() => {
    if (sizeGridOverride) return sizeGridOverride;
    if (lot?.pairs && Object.keys(lot.pairs).length > 0) {
      return Object.entries(lot.pairs)
        .filter(([, qty]) => qty > 0)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([sz, qty]) => `${sz}x${qty}`)
        .join('-');
    }
    const sizes = availSizes.slice().sort((a, b) => Number(a) - Number(b));
    if (activeGrid && sizes.length > 0) {
      return sizes.map(s => {
        const qty = activeGrid.configuration[s];
        return qty !== undefined ? `${s}x${qty}` : s;
      }).join('-');
    }
    const nonZeroStock = variation ? sizes.filter(s => (variation.stock[s] ?? 0) > 0) : [];
    if (nonZeroStock.length > 0) return nonZeroStock.map(s => `${s}x${variation!.stock[s]}`).join('-');
    return sizes.join('-');
  })();
  const sizeGridEntries = sizeGrid
    ? sizeGrid.split('-').map(tok => { const [sz, q] = tok.split('x'); return { sz, qty: q ? parseInt(q) : null }; })
    : [];

  useEffect(() => {
    const qd = isBoxLabel
      ? `PRD|${product.id}|${variation?.id || ''}|WHOLESALE`
      : `PRD|${product.id}|${variation?.id || ''}|${previewSize}`;
    labelService.generateQRCode(qd).then(setQrPreview);
  }, [product.id, variation?.id, previewSize, isBoxLabel]);

  const saveLayout = useCallback((l: Layout) => {
    const key = sizeKey === 'manual' ? `${manualW}x${manualH}` : sizeKey;
    const next = { ...layouts, [key]: l };
    setLayouts(next);
    localStorage.setItem(STORAGE_LAYOUTS, JSON.stringify(next));
  }, [layouts, sizeKey, manualW, manualH]);

  const updateElem  = (key: ElemKey, patch: Partial<Elem>) =>
    saveLayout({ ...layout, elems: { ...layout.elems, [key]: { ...layout.elems[key], ...patch } } });
  const moveElem    = (key: ElemKey, dx: number, dy: number) => {
    const e = layout.elems[key];
    updateElem(key, { x: Math.max(0, Math.min(W - e.w, e.x + dx)), y: Math.max(0, Math.min(H - e.h, e.y + dy)) });
  };
  const resizeElem  = (key: ElemKey, dw: number, dh: number) => {
    const e = layout.elems[key];
    updateElem(key, { w: Math.max(5, Math.min(W - e.x, e.w + dw)), h: Math.max(2, Math.min(H - e.y, e.h + dh)) });
  };

  const handleSizeSelect = (dims: [number, number] | 'manual') => {
    if (dims === 'manual') { setSizeKey('manual'); }
    else { const k = `${dims[0]}x${dims[1]}`; setSizeKey(k); localStorage.setItem(STORAGE_SIZE, k); }
    setSelected(null);
  };
  const handleModeChange = (m: PrintMode) => {
    setPrintMode(m); localStorage.setItem(STORAGE_MODE, m);
    if (m === 'thermal' && !THERMAL_SIZES.some(s => `${s.dims[0]}x${s.dims[1]}` === sizeKey)) { setSizeKey('75x24'); localStorage.setItem(STORAGE_SIZE, '75x24'); }
    if (m === 'document' && THERMAL_SIZES.some(s => `${s.dims[0]}x${s.dims[1]}` === sizeKey)) { setSizeKey('40x30'); localStorage.setItem(STORAGE_SIZE, '40x30'); }
    setSelected(null);
  };
  const handleReset = () => { saveLayout(defaultLayout(paperDims)); setSelected(null); };

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
        qrX:      layout.elems.qr.x,
        qrY:      layout.elems.qr.y,
        qrSize:   layout.elems.qr.w,
        colorX:   layout.elems.color.x + layout.elems.color.w / 2,
        colorY:   layout.elems.color.y + (layout.elems.color.fontSize ?? 7) * 0.353 + 1,
        colorSize: layout.elems.color.fontSize ?? 7,
        footerX:  layout.elems.footer.x + 1,
        footerY:  layout.elems.footer.y + (layout.elems.footer.fontSize ?? 4) * 0.353 + 0.5,
        footerSize: layout.elems.footer.fontSize ?? 4,
        showSize: layout.elems.size.visible,
        sizeX:    layout.elems.size.x + layout.elems.size.w - 1,
        sizeY:    layout.elems.size.y + (layout.elems.size.fontSize ?? 11) * 0.353 + 1,
        sizeSize: layout.elems.size.fontSize ?? 11,
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
        showOsData: layout.elems.osdata.visible,
        osDataX:  layout.elems.osdata.x + layout.elems.osdata.w / 2,
        osDataY:  layout.elems.osdata.y + (layout.elems.osdata.fontSize ?? 3.5) * 0.353 + 1,
        osDataW:  layout.elems.osdata.w,
        osDataH:  layout.elems.osdata.h,
        osDataSize: layout.elems.osdata.fontSize ?? 3.5,
        osDataText: os ? `${os.osNumber} | ${os.providerName} | R$ ${os.totalValue.toFixed(2)}` : undefined,
      };
      const photoUrl = product.photoUrl;
      if (isBoxLabel) {
        await labelService.printWholesaleLabel(product, variation!, customQty, paperDims, ll, photoUrl, sizeGrid);
      } else {
        await labelService.printProductLabels(product, variation, sizesToPrint, quantities, paperDims, ll, photoUrl, sizeGrid);
      }
      onClose();
    } finally { setPrinting(false); }
  };

  const handleExportJpg = async () => {
    setExportingJpg(true);
    try {
      const DPI = 300;
      const mmToPx = (mm: number) => Math.round(mm * DPI / 25.4);
      const ptToPxHigh = (pt: number) => pt * DPI / 72;
      const cW = mmToPx(W);
      const cH = mmToPx(H);

      const sizesToPrint = isBoxLabel ? ['WHOLESALE'] : (selectedSizes.length > 0 ? selectedSizes : availSizes);
      const quantities: Record<string, number> = {};
      if (isBoxLabel) {
        quantities['WHOLESALE'] = customQty;
      } else if (useStockQty) {
        sizesToPrint.forEach(s => { quantities[s] = variation?.stock[s] || 0; });
      } else {
        sizesToPrint.forEach(s => { quantities[s] = customQty; });
      }

      const frames: HTMLCanvasElement[] = [];

      for (const size of sizesToPrint) {
        const qty = quantities[size] || 1;
        const qrData = isBoxLabel
          ? `PRD|${product.id}|${variation?.id || ''}|WHOLESALE`
          : `PRD|${product.id}|${variation?.id || ''}|${size}`;
        const qrDataUrl = await labelService.generateQRCode(qrData);

        for (let i = 0; i < qty; i++) {
          const canvas = document.createElement('canvas');
          canvas.width  = cW;
          canvas.height = cH;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cW, cH);

          const e = layout.elems;

          const drawText = (el: Elem, text: string, fallbackPt: number) => {
            if (!el.visible || !text) return;
            const fsPx = ptToPxHigh(el.fontSize ?? fallbackPt);
            const ff = el.fontFamily === 'times'   ? 'Georgia, serif'
                     : el.fontFamily === 'courier' ? '"Courier New", monospace'
                     : 'Arial, Helvetica, sans-serif';
            ctx.font         = `${el.bold ? '900' : '400'} ${fsPx}px ${ff}`;
            ctx.fillStyle    = '#000000';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, mmToPx(el.x + el.w / 2), mmToPx(el.y + el.h / 2));
          };

          if (e.qr.visible && qrDataUrl) {
            await new Promise<void>(res => {
              const img = new window.Image();
              img.onload  = () => { ctx.drawImage(img, mmToPx(e.qr.x), mmToPx(e.qr.y), mmToPx(e.qr.w), mmToPx(e.qr.h)); res(); };
              img.onerror = () => res();
              img.src = qrDataUrl;
            });
          }

          if (e.photo.visible && product.photoUrl) {
            await new Promise<void>(res => {
              const img = new window.Image();
              img.crossOrigin = 'anonymous';
              img.onload  = () => { ctx.drawImage(img, mmToPx(e.photo.x), mmToPx(e.photo.y), mmToPx(e.photo.w), mmToPx(e.photo.h)); res(); };
              img.onerror = () => res();
              img.src = product.photoUrl!;
            });
          }

          drawText(e.reference, product.reference || product.name, 8);
          drawText(e.name,      product.name,                       6);
          drawText(e.color,     variation?.colorName || '---',      7);
          if (e.size.visible) drawText(e.size, isBoxLabel ? 'BOX' : size, 11);
          drawText(e.footer,    'ANTIGRAVITY SYSTEM',               4);

          // Grade pills
          if (e.grade.visible && sizeGridEntries.length > 0) {
            const gX = mmToPx(e.grade.x), gY = mmToPx(e.grade.y);
            const gW = mmToPx(e.grade.w), gH = mmToPx(e.grade.h);
            const hasQty = sizeGridEntries.some(en => en.qty !== null);
            const cellW  = gW / sizeGridEntries.length;
            const szFsPx  = ptToPxHigh(e.grade.fontSize ?? 5);
            const qtyFsPx = ptToPxHigh((e.grade.fontSize ?? 5) * 0.90);
            const szH = hasQty ? gH * 0.48 : gH * 0.70;
            const pad = mmToPx(0.4);
            sizeGridEntries.forEach(({ sz, qty }, idx) => {
              const cx = gX + cellW * idx;
              // Numeração: fundo preto + texto branco
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              if (typeof (ctx as any).roundRect === 'function') {
                (ctx as any).roundRect(cx + pad, gY + pad, cellW - pad * 2, szH, mmToPx(0.5));
              } else {
                ctx.rect(cx + pad, gY + pad, cellW - pad * 2, szH);
              }
              ctx.fill();
              ctx.fillStyle    = '#ffffff';
              ctx.font         = `900 ${szFsPx}px Arial`;
              ctx.textAlign    = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(sz, cx + cellW / 2, gY + szH * 0.52);
              // Valor: texto preto simples
              if (qty !== null) {
                ctx.fillStyle = '#000000';
                ctx.font      = `900 ${qtyFsPx}px Arial`;
                ctx.fillText(`${qty}`, cx + cellW / 2, gY + szH + (gH - szH) * 0.6);
              }
            });
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

          frames.push(canvas);
        }
      }

      if (frames.length === 0) {
        alert('Nenhuma etiqueta para gerar. Selecione ao menos um tamanho ou variação.');
        return;
      }

      // Stack all frames vertically into one image
      const out = document.createElement('canvas');
      out.width  = cW;
      out.height = cH * frames.length;
      const oCtx = out.getContext('2d')!;
      oCtx.fillStyle = '#ffffff';
      oCtx.fillRect(0, 0, out.width, out.height);
      for (let i = 0; i < frames.length; i++) {
        oCtx.drawImage(frames[i], 0, i * cH);
      }

      await shareImage(out.toDataURL('image/jpeg', 0.92), `Etiquetas_${product.reference || product.name}.jpg`);
    } catch (err) {
      console.error('Erro ao gerar JPG:', err);
      alert('Erro ao gerar JPG: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExportingJpg(false);
    }
  };

  // ── Helpers preview ──────────────────────────────────────────────────────────
  const ptToPx = (pt: number) => pt * 0.353 * scale;
  const cssFont = (el: Elem, fallbackPt: number) => ({
    fontSize:   ptToPx(el.fontSize ?? fallbackPt),
    fontFamily: el.fontFamily === 'times'   ? 'Georgia, Times, serif'
              : el.fontFamily === 'courier' ? 'Courier New, monospace'
              : 'Arial, Helvetica, sans-serif',
    fontWeight: el.bold ? 900 : 400,
  });
  const pos = (el: Elem) => ({
    position: 'absolute' as const,
    left: el.x * scale, top: el.y * scale,
    width: el.w * scale, height: el.h * scale,
    overflow: 'hidden',
  });

  const sel = selected ? layout.elems[selected] : null;
  const dk  = isDarkMode;

  // ── Content preview ──────────────────────────────────────────────────────────
  const ContentPreview = () => {
    const e = layout.elems;
    return (
      <div style={{ position:'relative', width:previewW, height:previewH, backgroundColor:'#fff', flexShrink:0, overflow:'hidden' }}>
        {e.reference.visible && (
          <div style={{ ...pos(e.reference), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.reference, 8), color:'#000000', textAlign:'center' }}>{product.reference || product.name}</span>
          </div>
        )}
        {e.name.visible && (
          <div style={{ ...pos(e.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.name, 6), color:'#000000', textAlign:'center' }}>{product.name}</span>
          </div>
        )}
        {e.color.visible && (
          <div style={{ ...pos(e.color), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.color, 7), color:'#000000', textAlign:'center' }}>{variation?.colorName || '---'}</span>
          </div>
        )}
        {e.size.visible && !isBoxLabel && (
          <div style={{ ...pos(e.size), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.size, 11), color:'#000000', textAlign:'center' }}>{previewSize}</span>
          </div>
        )}
        {e.size.visible && isBoxLabel && (
          <div style={{ ...pos(e.size), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.size, 11), color:'#000000', textAlign:'center' }}>BOX</span>
          </div>
        )}
        {e.qr.visible && (
          <div style={pos(e.qr)}>
            {qrPreview ? <img src={qrPreview} alt="QR" style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <div style={{ width:'100%', height:'100%', backgroundColor:'#f1f5f9' }}/>}
          </div>
        )}
        {e.photo.visible && (
          <div style={{ ...pos(e.photo), borderRadius:2, overflow:'hidden', backgroundColor:'#fef3c7' }}>
            {product.photoUrl
              ? <img src={product.photoUrl} alt="Foto" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:'#fef3c7', border:'1px dashed #f59e0b' }}><span style={{ fontSize: Math.max(5, 6*scale), color:'#f59e0b' }}>FOTO</span></div>}
          </div>
        )}
        {e.footer.visible && (
          <div style={{ ...pos(e.footer), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.footer, 4), color:'#000000' }}>ANTIGRAVITY SYSTEM</span>
          </div>
        )}
        {e.osdata.visible && (
          <div style={{ ...pos(e.osdata), display:'flex', alignItems:'center', justifyContent:'center', padding: `${scale*0.3}px ${scale*0.5}px`, border:`${scale*0.4}px solid #6366f1`, borderRadius: scale*0.8, boxSizing:'border-box' }}>
            <span style={{ ...cssFont(e.osdata, 3.5), color:'#6366f1', textAlign:'center', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%' }}>
              {os ? `${os.osNumber} | ${os.providerName} | R$ ${os.totalValue.toFixed(2)}` : 'OS-C-0000 | Fornecedor | R$ 0,00'}
            </span>
          </div>
        )}
        {e.grade.visible && sizeGridEntries.length > 0 && (
          <div style={{ ...pos(e.grade), display:'flex', alignItems:'stretch', gap: scale * 0.5 }}>
            {sizeGridEntries.map(({ sz, qty }, i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                <span style={{ ...cssFont(e.grade, 5), color:'#ffffff', backgroundColor:'#000000', borderRadius: scale * 0.6, padding:`${scale * 0.3}px ${scale * 0.5}px`, lineHeight:1 }}>{sz}</span>
                {qty !== null && <span style={{ fontSize: ptToPx((e.grade.fontSize ?? 5) * 0.90), fontFamily:'Arial,sans-serif', fontWeight:900, color:'#000000', lineHeight:1, marginTop: scale * 0.5 }}>{qty}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Edit preview (colored blocks) ────────────────────────────────────────────
  const EditPreview = () => (
    <div style={{ position:'relative', width:previewW, height:previewH, backgroundColor:'#fff', flexShrink:0 }} onClick={()=>setSelected(null)}>
      {ELEM_KEYS.map(key => {
        const el = layout.elems[key];
        if (!el.visible) return null;
        const isSel = selected === key;
        return (
          <div key={key} onClick={e=>{e.stopPropagation();setSelected(key);}}
            style={{ position:'absolute', left:el.x*scale, top:el.y*scale, width:el.w*scale, height:el.h*scale,
              backgroundColor:el.color+'2a', border:`${isSel?2:1}px ${isSel?'solid':'dashed'} ${el.color}`,
              boxSizing:'border-box', cursor:'pointer', zIndex:isSel?10:1,
              display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <span style={{ fontSize:Math.max(5,7*scale), color:el.color, fontWeight:900, textAlign:'center', lineHeight:1 }}>{el.label}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editor de Etiquetas" maxWidth="max-w-lg" zIndex={70000}>
      <div className="flex flex-col gap-4 py-1">

        {/* Print mode */}
        <div className={`flex p-1 rounded-2xl gap-1 ${dk?'bg-slate-800':'bg-slate-100'}`}>
          {([['document','Documento',<FileText size={12}/>],['thermal','Etiqueta Térmica',<Tag size={12}/>]] as const).map(([m,lbl,icon])=>(
            <button key={m} type="button" onClick={()=>handleModeChange(m as PrintMode)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${printMode===m?'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm':'text-slate-400'}`}>
              {icon} {lbl}
            </button>
          ))}
        </div>

        {/* Size selection */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tamanho da Etiqueta</label>
            <button type="button" onClick={handleReset} className="text-[9px] font-black text-indigo-500 flex items-center gap-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded-lg">
              <RotateCcw size={9}/> Resetar
            </button>
          </div>
          {printMode === 'document' ? (
            <div className="flex gap-1.5 flex-wrap">
              {DOC_SIZES.map(opt => { const k=`${opt.dims[0]}x${opt.dims[1]}`; return (
                <button key={k} type="button" onClick={()=>handleSizeSelect(opt.dims)}
                  className={`py-2 px-3 rounded-xl border-2 font-black text-[9px] uppercase tracking-tight transition-all ${sizeKey===k?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                  {opt.label}
                </button>
              );})}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-1.5">
                {THERMAL_SIZES.map(opt => { const k=`${opt.dims[0]}x${opt.dims[1]}`; return (
                  <button key={k} type="button" onClick={()=>handleSizeSelect(opt.dims)}
                    className={`py-2 px-3 rounded-xl border-2 font-black text-[9px] tracking-tight transition-all flex items-center justify-between ${sizeKey===k?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                    {opt.label}
                    {opt.star && <span className="text-[7px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full ml-1">minha</span>}
                  </button>
                );})}
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-xl border-2 ${sizeKey==='manual'?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20':'border-slate-100 dark:border-slate-800'}`}>
                <button type="button" onClick={()=>handleSizeSelect('manual')} className={`text-[9px] font-black uppercase whitespace-nowrap ${sizeKey==='manual'?'text-indigo-600':'text-slate-400'}`}>Manual</button>
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
          )}
        </div>

        {/* View / Edit tabs */}
        <div className={`flex p-1 rounded-2xl gap-1 ${dk?'bg-slate-800':'bg-slate-100'}`}>
          {([['view','Visualizar',<FileText size={12}/>],['edit','Ajustar',<Settings2 size={12}/>]] as const).map(([t,lbl,icon])=>(
            <button key={t} type="button" onClick={()=>{setTab(t as any);setSelected(null);}}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab===t?'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm':'text-slate-400'}`}>
              {icon} {lbl}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className={`rounded-2xl border-2 overflow-x-auto overflow-y-hidden ${dk?'border-slate-700 bg-slate-900':'border-slate-200 bg-slate-100'}`}>
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

        {/* Configurar Elementos button */}
        {tab === 'edit' && (
          <button
            type="button"
            onClick={() => setElemConfigOpen(true)}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-black text-[11px] uppercase tracking-widest transition-all ${
              dk
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-500 hover:text-indigo-400'
                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            <Layers size={15} />
            Configurar Elementos
            <span className={`ml-1 text-[9px] font-black px-2 py-0.5 rounded-full ${dk ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
              {ELEM_KEYS.filter(k => layout.elems[k].visible).length}/{ELEM_KEYS.length} visíveis
            </span>
          </button>
        )}

        {/* Element config panel — bottom sheet */}
        {elemConfigOpen && (
          <div className="fixed inset-0 z-[70] flex flex-col" onClick={() => setElemConfigOpen(false)}>
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <div
              className={`relative mt-auto w-full max-h-[80vh] flex flex-col rounded-t-3xl shadow-2xl overflow-hidden ${dk ? 'bg-slate-900' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Layers size={16} />
                  </div>
                  <div>
                    <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>Configurar Elementos</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Visibilidade e seleção para ajuste</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setElemConfigOpen(false)}
                  aria-label="Fechar"
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${dk ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}
                >
                  <X size={16} />
                </button>
              </div>
              {/* Element list */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                {ELEM_KEYS.map(key => {
                  const el = layout.elems[key];
                  const isSel = selected === key;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                        isSel ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                      }`}
                      style={isSel ? { borderColor: el.color, backgroundColor: el.color + '15' } : {}}
                    >
                      <div className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: el.color }} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>{el.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">X:{el.x.toFixed(1)} Y:{el.y.toFixed(1)} • {el.w.toFixed(1)}×{el.h.toFixed(1)} mm</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelected(isSel ? null : key); setElemConfigOpen(false); }}
                        className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
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
                        aria-label={el.visible ? `Ocultar ${el.label}` : `Mostrar ${el.label}`}
                        onClick={() => updateElem(key, { visible: !el.visible })}
                        className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${el.visible ? 'shadow-inner' : dk ? 'bg-slate-700' : 'bg-slate-200'}`}
                        style={el.visible ? { backgroundColor: el.color } : {}}
                      >
                        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200 flex items-center justify-center ${el.visible ? 'left-5' : 'left-0.5'}`}>
                          {el.visible ? <Eye size={10} style={{ color: el.color }} /> : <EyeOff size={10} className="text-slate-400" />}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {/* Footer */}
              <div className={`px-4 py-4 border-t ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { ELEM_KEYS.forEach(k => updateElem(k, { visible: true })); }}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-1.5 ${
                      dk ? 'border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-400' : 'border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600'
                    }`}
                  >
                    <Eye size={12} /> Mostrar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setElemConfigOpen(false)}
                    className="flex-[2] py-3 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls panel */}
        {tab === 'edit' && selected && sel && (
          <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${dk?'bg-slate-900 border-slate-800':'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase" style={{color:sel.color}}>✎ {sel.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black text-slate-400 mr-1">Passo:</span>
                {STEPS.map(s=>(
                  <button key={s} type="button" onClick={()=>setStep(s)}
                    className={`px-2 py-0.5 rounded-lg border text-[9px] font-black transition-all ${step===s?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600':'border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                    {s}mm
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['X',sel.x],['Y',sel.y],['L',sel.w],['A',sel.h]].map(([lbl,val])=>(
                <div key={lbl as string} className={`p-2 rounded-xl border ${dk?'bg-slate-800 border-slate-700':'bg-white border-slate-100'}`}>
                  <span className="block text-[8px] font-black text-slate-400 uppercase">{lbl}</span>
                  <span className={`block text-[10px] font-black ${dk?'text-slate-200':'text-slate-700'}`}>{(val as number).toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 items-center justify-center">
              <div className="grid grid-cols-3 gap-1.5">
                <div/>
                <button type="button" aria-label="Mover para cima" onClick={()=>moveElem(selected,0,-step)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md active:scale-90"><ChevronUp size={20}/></button>
                <div/>
                <button type="button" aria-label="Mover para esquerda" onClick={()=>moveElem(selected,-step,0)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md active:scale-90"><ChevronLeft size={20}/></button>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dk?'bg-slate-800':'bg-slate-200'}`}><div className="w-2.5 h-2.5 rounded-full bg-indigo-400"/></div>
                <button type="button" aria-label="Mover para direita" onClick={()=>moveElem(selected,step,0)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md active:scale-90"><ChevronRight size={20}/></button>
                <div/>
                <button type="button" aria-label="Mover para baixo" onClick={()=>moveElem(selected,0,step)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md active:scale-90"><ChevronDown size={20}/></button>
                <div/>
              </div>
              <div className="flex flex-col gap-2">
                {([['Largura',sel.w,(d:number)=>resizeElem(selected,d,0)],['Altura',sel.h,(d:number)=>resizeElem(selected,0,d)]] as const).map(([lbl,val,fn])=>(
                  <div key={lbl} className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black text-slate-400 w-11 uppercase">{lbl}</span>
                    <button type="button" aria-label={`Diminuir ${lbl}`} onClick={()=>fn(-step)} className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Minus size={12}/></button>
                    <span className={`w-14 text-center text-[10px] font-black ${dk?'text-slate-200':'text-slate-700'}`}>{(val as number).toFixed(1)} mm</span>
                    <button type="button" aria-label={`Aumentar ${lbl}`} onClick={()=>fn(step)} className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Plus size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
            {/* Font controls */}
            <div className={`pt-3 border-t flex flex-col gap-3 ${dk?'border-slate-800':'border-slate-100'}`}>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipografia</span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-slate-400 w-11 uppercase shrink-0">Fonte</span>
                <div className="flex gap-1.5 flex-1">
                  {(['helvetica','times','courier'] as FontFamily[]).map(f=>(
                    <button key={f} type="button" onClick={()=>updateElem(selected,{fontFamily:f})}
                      className={`flex-1 py-1.5 rounded-xl border text-[9px] font-black transition-all ${(sel.fontFamily===f||(!sel.fontFamily&&f==='helvetica'))?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600':'border-slate-200 dark:border-slate-700 text-slate-400'}`}
                      style={{fontFamily:f==='helvetica'?'Arial':f==='times'?'Georgia':'monospace'}}>
                      {f==='helvetica'?'Sans':f==='times'?'Serif':'Mono'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-slate-400 w-11 uppercase shrink-0">Tamanho</span>
                <button type="button" aria-label="Diminuir fonte" onClick={()=>updateElem(selected,{fontSize:Math.max(3,(sel.fontSize||8)-0.5)})} className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Minus size={12}/></button>
                <span className={`w-14 text-center text-[10px] font-black ${dk?'text-slate-200':'text-slate-700'}`}>{(sel.fontSize||8).toFixed(1)} pt</span>
                <button type="button" aria-label="Aumentar fonte" onClick={()=>updateElem(selected,{fontSize:(sel.fontSize||8)+0.5})} className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Plus size={12}/></button>
                <button type="button" aria-label="Negrito" onClick={()=>updateElem(selected,{bold:!sel.bold})}
                  className={`w-9 h-7 rounded-xl border text-[11px] font-black transition-all ml-1 ${sel.bold?'border-indigo-500 bg-indigo-600 text-white':'border-slate-200 dark:border-slate-700 text-slate-400'}`}>B</button>
              </div>
            </div>
          </div>
        )}

        {/* Label options */}
        <div className={`flex flex-col gap-3 p-4 rounded-2xl border ${dk?'bg-slate-900 border-slate-800':'bg-slate-50 border-slate-100'}`}>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Opções de Impressão</label>

          {/* Variation */}
          <div className="flex flex-wrap gap-1.5">
            {(product.variations || []).map(v=>(
              <button key={v.id} type="button" onClick={()=>{setSelectedVariationId(v.id);setSelectedSizes([]);}}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-[9px] font-black transition-all ${selectedVariationId===v.id?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:v.color}}/>
                {v.colorName}
              </button>
            ))}
          </div>

          {/* Mode: per size or box */}
          <div className="flex gap-2">
            <button type="button" onClick={()=>setIsBoxLabel(false)}
              className={`flex-1 py-2 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${!isBoxLabel?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
              Por Tamanho
            </button>
            <button type="button" onClick={()=>setIsBoxLabel(true)}
              className={`flex-1 py-2 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${isBoxLabel?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
              Caixa
            </button>
          </div>

          {!isBoxLabel && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {availSizes.map(sz=>(
                  <button key={sz} type="button" onClick={()=>setSelectedSizes(p=>p.includes(sz)?p.filter(s=>s!==sz):[...p,sz])}
                    className={`min-w-[36px] h-10 rounded-xl border-2 font-black text-[10px] transition-all flex flex-col items-center justify-center ${selectedSizes.includes(sz)?'border-indigo-500 bg-indigo-500 text-white':'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
                    {sz}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={()=>setUseStockQty(false)}
                  className={`flex-1 py-2 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${!useStockQty?'border-indigo-500 bg-indigo-50 text-indigo-600':'border-slate-100 text-slate-400'}`}>1 etiq.</button>
                <button type="button" onClick={()=>setUseStockQty(true)}
                  className={`flex-1 py-2 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${useStockQty?'border-indigo-500 bg-indigo-50 text-indigo-600':'border-slate-100 text-slate-400'}`}>Qtd estoque</button>
                {!useStockQty && (
                  <input type="number" min={1} value={customQty} onChange={e=>setCustomQty(Math.max(1,+e.target.value))} title="Quantidade"
                    className={`w-16 text-center px-2 py-2 rounded-xl border-2 text-[10px] font-black outline-none ${dk?'bg-slate-800 border-slate-700 text-white':'bg-white border-slate-200 text-slate-800'}`}/>
                )}
              </div>
            </>
          )}

          {isBoxLabel && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase">Qtd. caixas:</span>
              <input type="number" min={1} value={customQty} onChange={e=>setCustomQty(Math.max(1,+e.target.value))} title="Quantidade"
                className={`w-16 text-center px-2 py-2 rounded-xl border-2 text-[10px] font-black outline-none ${dk?'bg-slate-800 border-slate-700 text-white':'bg-white border-slate-200 text-slate-800'}`}/>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={handleExportJpg} disabled={printing || exportingJpg}
              className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
              <ImageIcon size={16}/> {exportingJpg ? 'Gerando…' : 'Gerar JPG'}
            </button>
            <button type="button" onClick={handlePrint} disabled={printing || exportingJpg}
              className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
              <Printer size={16}/> {printing ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </div>
          <button type="button" onClick={onClose} className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest ${dk?'bg-slate-800 text-slate-400':'bg-slate-100 text-slate-500'}`}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
