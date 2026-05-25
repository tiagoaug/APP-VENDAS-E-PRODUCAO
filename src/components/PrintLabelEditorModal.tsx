import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  RotateCcw, Eye, EyeOff, Plus, Minus, Settings2, FileText, Tag,
  Image as ImageIcon,
} from 'lucide-react';
import Modal from './Modal';
import { Product, Variation, SaleType, LabelLayout } from '../types';
import { labelService } from '../services/labelService';
import { shareImage } from '../utils/pdfExport';

// ─── Types ────────────────────────────────────────────────────────────────────

type ElemKey    = 'reference' | 'name' | 'color' | 'size' | 'qr' | 'footer' | 'photo';
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

const ELEM_KEYS: ElemKey[] = ['reference', 'name', 'color', 'size', 'qr', 'footer', 'photo'];
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
        reference: { x: 0,   y: 0,          w: textW, h: H * 0.32, label: 'Referência', color: '#4338ca', visible: true,  fontSize: 7,   fontFamily: 'helvetica', bold: true  },
        name:      { x: 0,   y: H * 0.32,   w: textW, h: H * 0.26, label: 'Nome',       color: '#6366f1', visible: false, fontSize: 5,   fontFamily: 'helvetica', bold: false },
        color:     { x: 0,   y: H * 0.42,   w: textW, h: H * 0.28, label: 'Cor',        color: '#e11d48', visible: true,  fontSize: 5.5, fontFamily: 'helvetica', bold: false },
        size:      { x: 0,   y: H * 0.68,   w: textW, h: H * 0.32, label: 'Tamanho',    color: '#0ea5e9', visible: true,  fontSize: 9,   fontFamily: 'helvetica', bold: true  },
        qr:        { x: qrX, y: qrY,        w: qrSize,h: qrSize,   label: 'QR Code',    color: '#0ea5e9', visible: true,  fontSize: 8,   fontFamily: 'helvetica', bold: false },
        footer:    { x: 0,   y: H - 2,      w: W,     h: 2,        label: 'Rodapé',     color: '#94a3b8', visible: false, fontSize: 3,   fontFamily: 'helvetica', bold: false },
        photo:     { x: 0,   y: 0,          w: 0,     h: 0,        label: 'Foto',       color: '#f59e0b', visible: false, fontSize: 6,   fontFamily: 'helvetica', bold: false },
      },
    };
  }
  const s = Math.min(W, H) / 40;
  const photoSz = 12 * s;
  return {
    paper: [W, H],
    elems: {
      reference: { x: 0,        y: 0,       w: W,     h: 6*s,     label: 'Referência', color: '#4338ca', visible: true,  fontSize: 8*s,  fontFamily: 'helvetica', bold: true  },
      name:      { x: 2*s,      y: 7*s,     w: W-4*s, h: 5*s,     label: 'Nome',       color: '#6366f1', visible: true,  fontSize: 6*s,  fontFamily: 'helvetica', bold: false },
      color:     { x: 0,        y: H-4*s,   w: W,     h: 4*s,     label: 'Cor',        color: '#e11d48', visible: true,  fontSize: 7*s,  fontFamily: 'helvetica', bold: true  },
      size:      { x: W-9*s,    y: 5*s,     w: 8*s,   h: 8*s,     label: 'Tamanho',    color: '#0ea5e9', visible: true,  fontSize: 11*s, fontFamily: 'helvetica', bold: true  },
      qr:        { x: (W-20*s)/2, y: 6*s,  w: 20*s,  h: 20*s,    label: 'QR Code',    color: '#0ea5e9', visible: true,  fontSize: 8,    fontFamily: 'helvetica', bold: false },
      footer:    { x: 0,        y: H-2*s,   w: W,     h: 2*s,     label: 'Rodapé',     color: '#94a3b8', visible: true,  fontSize: 4*s,  fontFamily: 'helvetica', bold: false },
      photo:     { x: W-photoSz, y: H-4*s-photoSz, w: photoSz, h: photoSz, label: 'Foto', color: '#f59e0b', visible: false, fontSize: 6, fontFamily: 'helvetica', bold: false },
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrintLabelEditorModal({ isOpen, onClose, product, isDarkMode }: Props) {
  const [printMode, setPrintMode] = useState<PrintMode>(() => (localStorage.getItem(STORAGE_MODE) as PrintMode) || 'thermal');
  const [sizeKey, setSizeKey]     = useState<string>(() => localStorage.getItem(STORAGE_SIZE) || '75x24');
  const [layouts, setLayouts]     = useState<Record<string, Layout>>(loadLayouts);
  const [selected, setSelected]   = useState<ElemKey | null>(null);
  const [step, setStep]           = useState(1);
  const [tab, setTab]             = useState<'view'|'edit'>('view');
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
      };
      const photoUrl = product.photoUrl;
      if (isBoxLabel) {
        await labelService.printWholesaleLabel(product, variation!, customQty, paperDims, ll, photoUrl);
      } else {
        await labelService.printProductLabels(product, variation, sizesToPrint, quantities, paperDims, ll, photoUrl);
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

      const frames: string[] = [];

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
            ctx.fillStyle    = el.color;
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

          frames.push(canvas.toDataURL('image/jpeg', 0.92));
        }
      }

      if (frames.length === 0) return;

      // Stack all frames vertically into one image
      const out = document.createElement('canvas');
      out.width  = cW;
      out.height = cH * frames.length;
      const oCtx = out.getContext('2d')!;
      oCtx.fillStyle = '#ffffff';
      oCtx.fillRect(0, 0, out.width, out.height);
      for (let i = 0; i < frames.length; i++) {
        await new Promise<void>(res => {
          const img = new window.Image();
          img.onload = () => { oCtx.drawImage(img, 0, i * cH); res(); };
          img.src = frames[i];
        });
      }

      await shareImage(out.toDataURL('image/jpeg', 0.92), `Etiquetas_${product.reference || product.name}.jpg`);
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
          <div style={{ ...pos(e.reference), display:'flex', alignItems:'center', justifyContent:'center', backgroundColor: isThermal(paperDims)?'transparent':'#4338ca10' }}>
            <span style={{ ...cssFont(e.reference, 8), color:'#4338ca', textAlign:'center' }}>{product.reference || product.name}</span>
          </div>
        )}
        {e.name.visible && (
          <div style={{ ...pos(e.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.name, 6), color:'#475569', textAlign:'center' }}>{product.name}</span>
          </div>
        )}
        {e.color.visible && (
          <div style={{ ...pos(e.color), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.color, 7), color:'#1e293b', textAlign:'center' }}>{variation?.colorName || '---'}</span>
          </div>
        )}
        {e.size.visible && !isBoxLabel && (
          <div style={{ ...pos(e.size), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.size, 11), color:'#0ea5e9', textAlign:'center' }}>{previewSize}</span>
          </div>
        )}
        {e.size.visible && isBoxLabel && (
          <div style={{ ...pos(e.size), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.size, 11), color:'#0ea5e9', textAlign:'center' }}>BOX</span>
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
            <span style={{ ...cssFont(e.footer, 4), color:'#94a3b8' }}>ANTIGRAVITY SYSTEM</span>
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

        {/* Element chips */}
        {tab === 'edit' && (
          <div className="flex flex-wrap gap-1.5">
            {ELEM_KEYS.map(key => {
              const el = layout.elems[key]; const isSel = selected===key;
              return (
                <button key={key} type="button" onClick={()=>setSelected(isSel?null:key)}
                  className={`flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-xl border-2 text-[9px] font-black uppercase tracking-tight transition-all ${isSel?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                  style={isSel?{}:{borderColor:el.color+'70'}}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:el.color}}/>
                  {el.label}
                  <button type="button" aria-label={el.visible?`Ocultar ${el.label}`:`Mostrar ${el.label}`}
                    onClick={e=>{e.stopPropagation();updateElem(key,{visible:!el.visible});}}
                    className="ml-1 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity">
                    {el.visible?<Eye size={9}/>:<EyeOff size={9}/>}
                  </button>
                </button>
              );
            })}
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
