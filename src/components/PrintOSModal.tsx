import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  RotateCcw, Eye, EyeOff, Plus, Minus, Settings2, FileText, Tag,
  LayoutDashboard, X, Check, Layers
} from 'lucide-react';
import Modal from './Modal';
import { ServiceOrder, Product, Grid, ProductionLot } from '../types';
import { labelService } from '../services/labelService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ElemKey    = 'header' | 'info' | 'total' | 'notes' | 'qr' | 'instruction' | 'footer' | 'photo' | 'grade';
type FontFamily = 'helvetica' | 'times' | 'courier';
type Elem = {
  x: number; y: number; w: number; h: number;
  label: string; color: string; visible: boolean;
  fontSize?: number;
  fontFamily?: FontFamily;
  bold?: boolean;
};
type Layout  = { paper: [number, number]; elems: Record<ElemKey, Elem> };
type PrintMode = 'document' | 'thermal';

// ─── Size presets ─────────────────────────────────────────────────────────────

const DOC_SIZES: { label: string; dims: [number, number] }[] = [
  { label: 'Ticket 80×120', dims: [80,  120] },
  { label: 'A6  105×148',   dims: [105, 148] },
  { label: 'A5  148×210',   dims: [148, 210] },
  { label: 'A4  210×297',   dims: [210, 297] },
];

const THERMAL_SIZES: { label: string; dims: [number, number]; star?: boolean }[] = [
  { label: '75 × 24 mm',   dims: [75,  24],  star: true  }, // usuário
  { label: '38 × 25 mm',   dims: [38,  25]  },
  { label: '50 × 30 mm',   dims: [50,  30]  },
  { label: '57 × 40 mm',   dims: [57,  40]  },
  { label: '80 × 40 mm',   dims: [80,  40]  },
  { label: '80 × 50 mm',   dims: [80,  50]  },
  { label: '100 × 50 mm',  dims: [100, 50]  },
  { label: '100 × 100 mm', dims: [100, 100] },
];

const ELEM_KEYS: ElemKey[] = ['header', 'info', 'total', 'notes', 'qr', 'photo', 'grade', 'instruction', 'footer'];
const STEPS = [0.5, 1, 2, 5];
const STORAGE_MODE    = 'os_print_mode';
const STORAGE_SIZE    = 'os_print_size';
const STORAGE_MANUAL  = 'os_print_manual';
const STORAGE_LAYOUTS = 'os_print_layouts_v2'; // v2: added photo+grade elements

// ─── Default layouts ──────────────────────────────────────────────────────────

function isThermal([W, H]: [number, number]) {
  return H <= 60 || W > H * 1.5;
}

function defaultLayout([W, H]: [number, number]): Layout {
  if (isThermal([W, H])) {
    // Thermal / label layout: QR on the right, text on the left
    const qrSize = Math.min(H - 4, W * 0.32);
    const textW  = W - qrSize - 6;
    const qrX    = W - qrSize - 2;
    const qrY    = (H - qrSize) / 2;
    const hdrH   = Math.min(H * 0.42, 12);
    // Photo: small square above QR when there's room
    const photoSz = Math.min(H * 0.5, 14);
    return {
      paper: [W, H],
      elems: {
        header:      { x: 0,    y: 0,           w: textW, h: hdrH,          label: 'Cabeçalho',   color: '#4338ca', visible: true,  fontSize: 7,   fontFamily: 'helvetica', bold: true  },
        info:        { x: 0,    y: hdrH + 0.5,  w: textW, h: H - hdrH - 1,  label: 'Informações', color: '#6366f1', visible: true,  fontSize: 5,   fontFamily: 'helvetica', bold: false },
        total:       { x: 0,    y: H * 0.7,     w: textW, h: H * 0.3,        label: 'Total OS',    color: '#16a34a', visible: false, fontSize: 6,   fontFamily: 'helvetica', bold: true  },
        notes:       { x: 0,    y: H * 0.8,     w: W,     h: H * 0.2,        label: 'Observações', color: '#f59e0b', visible: false, fontSize: 5,   fontFamily: 'helvetica', bold: false },
        qr:          { x: qrX,  y: qrY,         w: qrSize,h: qrSize,         label: 'QR Code',     color: '#0ea5e9', visible: true,  fontSize: 8,   fontFamily: 'helvetica', bold: false },
        photo:       { x: qrX,  y: 0,           w: photoSz, h: photoSz,      label: 'Foto',        color: '#e11d48', visible: false, fontSize: 6,   fontFamily: 'helvetica', bold: false },
        grade:       { x: 0,    y: H - 3.5,     w: textW, h: 3.5,            label: 'Grade',       color: '#d97706', visible: true,  fontSize: 4.5, fontFamily: 'helvetica', bold: true  },
        instruction: { x: 0,    y: H - 3,       w: W,     h: 3,              label: 'Instrução',   color: '#8b5cf6', visible: false, fontSize: 4,   fontFamily: 'helvetica', bold: false },
        footer:      { x: 0,    y: H - 2,       w: W,     h: 2,              label: 'Rodapé',      color: '#94a3b8', visible: false, fontSize: 3.5, fontFamily: 'helvetica', bold: false },
      },
    };
  }

  // Document layout (portrait, A6–A4 range)
  const s = W / 148;
  return {
    paper: [W, H],
    elems: {
      header:      { x: 0,           y: 0,      w: W,       h: 22*s,  label: 'Cabeçalho',   color: '#4338ca', visible: true,  fontSize: 9*s,   fontFamily: 'helvetica', bold: true  },
      info:        { x: 8*s,         y: 28*s,   w: W-16*s,  h: 52*s,  label: 'Informações', color: '#6366f1', visible: true,  fontSize: 9*s,   fontFamily: 'helvetica', bold: false },
      total:       { x: 8*s,         y: 82*s,   w: W-16*s,  h: 12*s,  label: 'Total OS',    color: '#16a34a', visible: true,  fontSize: 10*s,  fontFamily: 'helvetica', bold: true  },
      notes:       { x: 8*s,         y: 96*s,   w: W-16*s,  h: 10*s,  label: 'Observações', color: '#f59e0b', visible: true,  fontSize: 7.5*s, fontFamily: 'helvetica', bold: false },
      qr:          { x: (W-60*s)/2,  y: 110*s,  w: 60*s,    h: 60*s,  label: 'QR Code',     color: '#0ea5e9', visible: true,  fontSize: 8*s,   fontFamily: 'helvetica', bold: false },
      photo:       { x: W-46*s,      y: 28*s,   w: 38*s,    h: 38*s,  label: 'Foto',        color: '#e11d48', visible: false, fontSize: 8*s,   fontFamily: 'helvetica', bold: false },
      grade:       { x: 8*s,         y: 75*s,   w: W-16*s,  h: 7*s,   label: 'Grade',       color: '#d97706', visible: true,  fontSize: 7*s,   fontFamily: 'helvetica', bold: true  },
      instruction: { x: 8*s,         y: 173*s,  w: W-16*s,  h: 14*s,  label: 'Instrução',   color: '#8b5cf6', visible: true,  fontSize: 8*s,   fontFamily: 'helvetica', bold: true  },
      footer:      { x: 0,           y: H-8*s,  w: W,       h: 8*s,   label: 'Rodapé',      color: '#94a3b8', visible: true,  fontSize: 6*s,   fontFamily: 'helvetica', bold: false },
    },
  };
}

function loadLayouts(): Record<string, Layout> {
  try { return JSON.parse(localStorage.getItem(STORAGE_LAYOUTS) || '{}'); } catch { return {}; }
}

// ─── Ruler ────────────────────────────────────────────────────────────────────

function Ruler({ axis, totalMm, scale, isDark }: { axis: 'h'|'v'; totalMm: number; scale: number; isDark: boolean }) {
  const SIZE = 14;
  const bg  = isDark ? '#1e293b' : '#f1f5f9';
  const brd = isDark ? '#334155' : '#cbd5e1';
  const tc  = isDark ? '#64748b' : '#94a3b8';
  const ticks: { pos: number; mm: number; major: boolean; mid: boolean }[] = [];
  for (let mm = 0; mm <= totalMm; mm++) {
    const major = mm % 10 === 0, mid = mm % 5 === 0;
    if (!major && !mid && scale < 2) continue;
    if (!major && !mid && scale < 1) continue;
    ticks.push({ pos: mm * scale, mm, major, mid });
  }
  if (axis === 'h') {
    return (
      <div style={{ position: 'relative', width: totalMm * scale, height: SIZE, backgroundColor: bg, borderBottom: `1px solid ${brd}`, flexShrink: 0, overflow: 'hidden' }}>
        {ticks.map(({ pos, mm, major, mid }) => (
          <div key={mm} style={{ position: 'absolute', left: pos, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)' }}>
            <div style={{ width: 1, height: major ? 8 : mid ? 5 : 3, backgroundColor: tc }} />
            {major && mm > 0 && <span style={{ fontSize: 6, color: tc, lineHeight: 1, marginTop: 1 }}>{mm}</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: SIZE, height: totalMm * scale, backgroundColor: bg, borderRight: `1px solid ${brd}`, flexShrink: 0, overflow: 'hidden' }}>
      {ticks.map(({ pos, mm, major, mid }) => (
        <div key={mm} style={{ position: 'absolute', top: pos, left: 0, display: 'flex', alignItems: 'center', transform: 'translateY(-50%)' }}>
          <div style={{ height: 1, width: major ? 8 : mid ? 5 : 3, backgroundColor: tc }} />
          {major && mm > 0 && <span style={{ fontSize: 6, color: tc, lineHeight: 1, marginLeft: 1, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{mm}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean; onClose: () => void;
  os: ServiceOrder; nextSectorName: string; isDarkMode: boolean;
  product?: Product;      // Full product for photo + grid info
  grids?: Grid[];         // Available grids to resolve size range
  lot?: ProductionLot;    // Primary lot for size/qty breakdown
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrintOSModal({ isOpen, onClose, os, nextSectorName, isDarkMode, product, grids = [], lot }: Props) {
  const photoUrl = product?.photoUrl || '';

  // Build size grid string from lot.pairs (e.g. "37x2-38x4-39x4-40x2")
  // Falls back to the grid's sizes if no pairs data available
  const sizeGrid = (() => {
    if (lot?.pairs && Object.keys(lot.pairs).length > 0) {
      return Object.entries(lot.pairs)
        .filter(([, qty]) => qty > 0)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .map(([sz, qty]) => `${sz}x${qty}`)
        .join('-');
    }
    const productGrid = grids.find(g => g.id === (product?.productionGridId || product?.defaultGridId));
    return productGrid ? productGrid.sizes.join('-') : (os.sizeGrid || '');
  })();
  const [printMode, setPrintMode] = useState<PrintMode>(() => (localStorage.getItem(STORAGE_MODE) as PrintMode) || 'document');
  const [sizeKey,   setSizeKey]   = useState<string>(() => localStorage.getItem(STORAGE_SIZE) || '148x210');
  const [layouts,   setLayouts]   = useState<Record<string, Layout>>(loadLayouts);
  const [selected,  setSelected]  = useState<ElemKey | null>(null);
  const [step,      setStep]      = useState(1);
  const [tab,       setTab]       = useState<'view'|'edit'>('view');
  const [printing,  setPrinting]  = useState(false);
  const [qrPreview, setQrPreview] = useState('');
  const [elemConfigOpen, setElemConfigOpen] = useState(false);

  // Manual size state
  const savedManual = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_MANUAL) || '[80,40]'); } catch { return [80, 40]; } })();
  const [manualW, setManualW] = useState<number>(savedManual[0]);
  const [manualH, setManualH] = useState<number>(savedManual[1]);

  // Resolve current dimensions from sizeKey
  const paperDims: [number, number] = (() => {
    if (sizeKey === 'manual') return [manualW, manualH];
    const parts = sizeKey.split('x').map(Number);
    return (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) ? [parts[0], parts[1]] : [148, 210];
  })();
  const [W, H] = paperDims;

  // Preview scale: fit into available mobile width AND a max height
  const RULER = 14;
  const MAX_H = 280; // max preview height in px
  const MAX_W = Math.min(420, (typeof window !== 'undefined' ? window.innerWidth : 480) - 64) - RULER; // account for modal padding + ruler
  const scaleByH = MAX_H / H;
  const scaleByW = MAX_W / W;
  const scale    = Math.min(scaleByH, scaleByW);
  const previewW = W * scale;
  const previewH = H * scale;

  // Merge saved layout with current default so newly added elements (photo, grade)
  // are always present even in old persisted layouts — prevents undefined crashes
  const rawLayout = layouts[sizeKey === 'manual' ? `${manualW}x${manualH}` : sizeKey];
  const def = defaultLayout(paperDims);
  const layout: Layout = rawLayout
    ? { ...rawLayout, elems: { ...def.elems, ...rawLayout.elems } }
    : def;

  useEffect(() => { labelService.generateQRCode(`OS|${os.id}`).then(setQrPreview); }, [os.id]);

  const saveLayout = useCallback((l: Layout) => {
    const key = sizeKey === 'manual' ? `${manualW}x${manualH}` : sizeKey;
    const next = { ...layouts, [key]: l };
    setLayouts(next);
    localStorage.setItem(STORAGE_LAYOUTS, JSON.stringify(next));
  }, [layouts, sizeKey, manualW, manualH]);

  const updateElem = (key: ElemKey, patch: Partial<Elem>) =>
    saveLayout({ ...layout, elems: { ...layout.elems, [key]: { ...layout.elems[key], ...patch } } });

  const moveElem = (key: ElemKey, dx: number, dy: number) => {
    const e = layout.elems[key];
    updateElem(key, { x: Math.max(0, Math.min(W - e.w, e.x + dx)), y: Math.max(0, Math.min(H - e.h, e.y + dy)) });
  };
  const resizeElem = (key: ElemKey, dw: number, dh: number) => {
    const e = layout.elems[key];
    updateElem(key, { w: Math.max(5, Math.min(W - e.x, e.w + dw)), h: Math.max(2, Math.min(H - e.y, e.h + dh)) });
  };

  const handleSizeSelect = (dims: [number, number] | 'manual') => {
    if (dims === 'manual') { setSizeKey('manual'); }
    else {
      const k = `${dims[0]}x${dims[1]}`;
      setSizeKey(k);
      localStorage.setItem(STORAGE_SIZE, k);
    }
    setSelected(null);
  };

  const handleModeChange = (m: PrintMode) => {
    setPrintMode(m);
    localStorage.setItem(STORAGE_MODE, m);
    // Pick a sensible default size for the mode
    if (m === 'thermal' && !THERMAL_SIZES.some(s => `${s.dims[0]}x${s.dims[1]}` === sizeKey)) {
      setSizeKey('75x24'); localStorage.setItem(STORAGE_SIZE, '75x24');
    }
    if (m === 'document' && THERMAL_SIZES.some(s => `${s.dims[0]}x${s.dims[1]}` === sizeKey)) {
      setSizeKey('148x210'); localStorage.setItem(STORAGE_SIZE, '148x210');
    }
    setSelected(null);
  };

  const handleReset = () => { saveLayout(defaultLayout(paperDims)); setSelected(null); };

  const handlePrint = async () => {
    setPrinting(true);
    try { await labelService.printServiceOrder(os, nextSectorName, paperDims, layout, photoUrl, sizeGrid); onClose(); }
    finally { setPrinting(false); }
  };

  const sel = selected ? layout.elems[selected] : null;
  const dk  = isDarkMode;

  // ── Helpers para preview fiel ao PDF ──────────────────────────────────────
  // 1 pt jsPDF = 0.353 mm; conversão para px: pt * 0.353 * scale
  const ptToPx = (pt: number) => pt * 0.353 * scale;
  const cssFont = (el: Elem, fallbackPt: number) => ({
    fontSize: ptToPx(el.fontSize ?? fallbackPt),
    fontFamily: el.fontFamily === 'times' ? 'Georgia, Times, serif'
              : el.fontFamily === 'courier' ? 'Courier New, monospace'
              : 'Arial, Helvetica, sans-serif',
    fontWeight: el.bold ? 900 : 400,
  });
  // Posição absoluta de um elemento
  const pos = (el: Elem) => ({
    position: 'absolute' as const,
    left: el.x * scale, top: el.y * scale,
    width: el.w * scale, height: el.h * scale,
    overflow: 'hidden',
  });

  // ── Content preview (fiel ao layout do PDF) ───────────────────────────────
  const ContentPreview = () => {
    const e  = layout.elems;
    const thermal = isThermal(paperDims);
    return (
      <div style={{ position: 'relative', width: previewW, height: previewH, backgroundColor: '#fff', flexShrink: 0, overflow: 'hidden' }}>

        {/* Header */}
        {e.header.visible && !thermal && (
          <div style={{ ...pos(e.header), backgroundColor: '#4338ca', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 2 }}>
            <span style={{ ...cssFont(e.header, 7), color:'#fff', letterSpacing: 0.5 }}>ORDEM DE SERVIÇO</span>
            <span style={{ ...cssFont(e.header, 14), fontSize: ptToPx((e.header.fontSize ?? 9) * 1.7), color:'#fff' }}>{os.osNumber}</span>
          </div>
        )}
        {e.header.visible && thermal && (
          <div style={{ ...pos(e.header), display:'flex', flexDirection:'column', justifyContent:'center', paddingLeft: 2*scale }}>
            <span style={{ ...cssFont(e.header, 7), color:'#4338ca', lineHeight:1 }}>{os.osNumber}</span>
            <span style={{ ...cssFont(e.header, 5), color:'#64748b', lineHeight:1, marginTop: 1, fontWeight:700 }}>{os.productName}</span>
          </div>
        )}

        {/* Info */}
        {e.info.visible && !thermal && (() => {
          const lh = (e.info.h / 4) * scale;
          const rows = [
            ['Produto', os.productName, 'Variação', os.variationName||'—'],
            ['Setor', os.sectorName, 'Próximo', nextSectorName],
            ['Prestador', os.providerName, 'Tipo', os.type==='INTERNAL'?'Interna':'Terceirizada'],
            ['Qtd', `${os.quantity} prs`, 'Vlr/par', `R$ ${os.valuePerPair.toFixed(2)}`],
          ];
          const labelSt = { ...cssFont(e.info, 7), fontSize: ptToPx((e.info.fontSize??9)*0.70), color:'#94a3b8', textTransform:'uppercase' as const, lineHeight:1 };
          const valueSt = { ...cssFont(e.info, 9), color:'#1e293b', lineHeight:1.2, marginTop:1 };
          return (
            <div style={pos(e.info)}>
              {rows.map(([l1,v1,l2,v2],i)=>(
                <div key={i} style={{ position:'absolute', top: i*lh, left:0, width:'100%', height:lh }}>
                  {[{x:0,l:l1,v:v1},{x:e.info.w/2*scale,l:l2,v:v2}].map(({x,l,v})=>(
                    <div key={l} style={{ position:'absolute', left:x, top: lh*0.08 }}>
                      <div style={labelSt}>{l}</div>
                      <div style={valueSt}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}
        {e.info.visible && thermal && (
          <div style={{ ...pos(e.info), display:'flex', flexDirection:'column', justifyContent:'center', paddingLeft: 2*scale, gap:2 }}>
            <span style={{ ...cssFont(e.info, 5), color:'#334155', lineHeight:1 }}>{os.sectorName} → {nextSectorName}</span>
            <span style={{ ...cssFont(e.info, 6), color:'#16a34a', lineHeight:1, fontWeight:900 }}>R$ {os.totalValue.toFixed(2)} • {os.quantity}prs</span>
          </div>
        )}

        {/* Total */}
        {e.total.visible && (
          <div style={{ ...pos(e.total), backgroundColor:'#f0fdf4', border:'1px solid #86efac', borderRadius:2, display:'flex', alignItems:'center', justifyContent:'space-between', padding:`0 ${2*scale}px` }}>
            <span style={{ ...cssFont(e.total, 8), color:'#15803d' }}>TOTAL OS</span>
            <span style={{ ...cssFont(e.total, 11), fontSize: ptToPx((e.total.fontSize??10)*1.4), color:'#15803d' }}>R$ {os.totalValue.toFixed(2)}</span>
          </div>
        )}

        {/* Notes */}
        {e.notes.visible && os.notes && (
          <div style={{ ...pos(e.notes), display:'flex', alignItems:'center' }}>
            <span style={{ ...cssFont(e.notes, 7.5), color:'#78716c', fontStyle: e.notes.bold ? 'normal' : 'italic' }}>Obs: {os.notes}</span>
          </div>
        )}

        {/* QR */}
        {e.qr.visible && (
          <div style={pos(e.qr)}>
            {qrPreview ? <img src={qrPreview} alt="QR" style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : <div style={{ width:'100%', height:'100%', backgroundColor:'#f1f5f9' }} />}
          </div>
        )}

        {/* Photo */}
        {e.photo.visible && (
          <div style={{ ...pos(e.photo), borderRadius:2, border:'1px solid #fecaca' }}>
            {photoUrl
              ? <img src={photoUrl} alt="Produto" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <div style={{ width:'100%', height:'100%', backgroundColor:'#fff1f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ ...cssFont(e.photo, 7), color:'#e11d48' }}>FOTO</span>
                </div>
            }
          </div>
        )}

        {/* Grade */}
        {e.grade.visible && sizeGrid && (() => {
          const entries = sizeGrid.split('-').map(tok => { const [sz,qty]=tok.split('x'); return { sz:sz||tok, qty:qty?parseInt(qty):null }; });
          return (
            <div style={{ ...pos(e.grade), display:'flex', alignItems:'stretch', gap: 0.8*scale }}>
              {entries.map(({ sz, qty }) => (
                <div key={sz} style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', backgroundColor:'#fef3c7', border:'0.5px solid #fbbf24', borderRadius:2, padding:`0 ${1.5*scale}px`, flexShrink:0 }}>
                  <span style={{ ...cssFont(e.grade, 7), color:'#92400e', lineHeight:1 }}>{sz}</span>
                  {qty!==null && <span style={{ ...cssFont(e.grade, 5), fontSize: ptToPx((e.grade.fontSize??7)*0.7), color:'#b45309', lineHeight:1, marginTop:0.5 }}>{qty}p</span>}
                </div>
              ))}
            </div>
          );
        })()}
        {e.grade.visible && !sizeGrid && (
          <div style={{ ...pos(e.grade), display:'flex', alignItems:'center' }}>
            <span style={{ ...cssFont(e.grade, 6), color:'#d97706', fontStyle:'italic' }}>Grade</span>
          </div>
        )}

        {/* Instruction */}
        {e.instruction.visible && !thermal && (
          <div style={{ ...pos(e.instruction), display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
            <span style={{ ...cssFont(e.instruction, 8), color:'#4338ca', textAlign:'center', lineHeight:1.2 }}>ESCANEIE PARA DAR BAIXA E AVANÇAR O LOTE</span>
            <span style={{ ...cssFont(e.instruction, 7), fontSize: ptToPx((e.instruction.fontSize??8)*0.8), color:'#94a3b8', textAlign:'center', fontWeight:400 }}>Próximo setor: {nextSectorName}</span>
          </div>
        )}

        {/* Footer */}
        {e.footer.visible && (
          <div style={{ ...pos(e.footer), display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ ...cssFont(e.footer, 6), color:'#cbd5e1' }}>Emitida em: {new Date(os.createdAt).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>
    );
  };

  // ── Edit preview (colored blocks) ─────────────────────────────────────────
  const EditPreview = () => (
    <div style={{ position:'relative', width:previewW, height:previewH, backgroundColor:'#fff', flexShrink:0, cursor:'default' }} onClick={() => setSelected(null)}>
      {ELEM_KEYS.map(key => {
        const el = layout.elems[key];
        if (!el.visible) return null;
        const isSel = selected === key;
        return (
          <div key={key} onClick={e => { e.stopPropagation(); setSelected(key); }}
            style={{ position:'absolute', left:el.x*scale, top:el.y*scale, width:el.w*scale, height:el.h*scale,
              backgroundColor: el.color+'2a', border:`${isSel?2:1}px ${isSel?'solid':'dashed'} ${el.color}`,
              boxSizing:'border-box', cursor:'pointer', zIndex:isSel?10:1,
              display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <span style={{ fontSize:Math.max(5,7*scale), color:el.color, fontWeight:900, textAlign:'center', lineHeight:1, padding:'0 2px' }}>{el.label}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editor de Impressão — OS" maxWidth="max-w-lg" zIndex={70000}>
      <div className="flex flex-col gap-4 py-1">

        {/* ── Print mode toggle ── */}
        <div className={`flex p-1 rounded-2xl gap-1 ${dk?'bg-slate-800':'bg-slate-100'}`}>
          {([['document','Documento',<FileText size={12}/>],['thermal','Etiqueta Térmica',<Tag size={12}/>]] as const).map(([m,lbl,icon])=>(
            <button key={m} type="button" onClick={() => handleModeChange(m as PrintMode)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${printMode===m?`bg-white dark:bg-slate-700 text-indigo-600 shadow-sm`:'text-slate-400'}`}>
              {icon} {lbl}
            </button>
          ))}
        </div>

        {/* ── Size selection ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {printMode==='thermal' ? 'Tamanho da Etiqueta' : 'Tamanho do Papel'}
            </label>
            <button type="button" onClick={handleReset} className="text-[9px] font-black text-indigo-500 flex items-center gap-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded-lg">
              <RotateCcw size={9}/> Resetar
            </button>
          </div>

          {printMode === 'document' ? (
            <div className="flex gap-1.5 flex-wrap">
              {DOC_SIZES.map(opt => { const k=`${opt.dims[0]}x${opt.dims[1]}`; return (
                <button key={k} type="button" onClick={() => handleSizeSelect(opt.dims)}
                  className={`py-2 px-3 rounded-xl border-2 font-black text-[9px] uppercase tracking-tight transition-all ${sizeKey===k?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                  {opt.label}
                </button>
              );})}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-1.5">
                {THERMAL_SIZES.map(opt => { const k=`${opt.dims[0]}x${opt.dims[1]}`; return (
                  <button key={k} type="button" onClick={() => handleSizeSelect(opt.dims)}
                    className={`py-2 px-3 rounded-xl border-2 font-black text-[9px] tracking-tight transition-all flex items-center justify-between ${sizeKey===k?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                    {opt.label}
                    {opt.star && <span className="text-[7px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full ml-1">minha</span>}
                  </button>
                );})}
              </div>
              {/* Manual size */}
              <div className={`flex items-center gap-2 p-3 rounded-xl border-2 ${sizeKey==='manual'?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20':'border-slate-100 dark:border-slate-800'}`}>
                <button type="button" onClick={() => handleSizeSelect('manual')}
                  className={`text-[9px] font-black uppercase tracking-tight whitespace-nowrap ${sizeKey==='manual'?'text-indigo-600':'text-slate-400'}`}>
                  Manual
                </button>
                <div className="flex items-center gap-1 flex-1">
                  <input type="number" min={10} max={200} value={manualW}
                    title="Largura em milímetros" placeholder="80"
                    onChange={e => { setManualW(+e.target.value||10); if(sizeKey==='manual') { localStorage.setItem(STORAGE_MANUAL, JSON.stringify([+e.target.value||10,manualH])); }}}
                    className={`w-14 text-center px-2 py-1 rounded-lg border text-[10px] font-black outline-none ${dk?'bg-slate-800 border-slate-700 text-white':'bg-white border-slate-200 text-slate-800'}`}
                  />
                  <span className="text-[9px] text-slate-400 font-bold">×</span>
                  <input type="number" min={10} max={200} value={manualH}
                    title="Altura em milímetros" placeholder="40"
                    onChange={e => { setManualH(+e.target.value||10); if(sizeKey==='manual') { localStorage.setItem(STORAGE_MANUAL, JSON.stringify([manualW,+e.target.value||10])); }}}
                    className={`w-14 text-center px-2 py-1 rounded-lg border text-[10px] font-black outline-none ${dk?'bg-slate-800 border-slate-700 text-white':'bg-white border-slate-200 text-slate-800'}`}
                  />
                  <span className="text-[9px] text-slate-400 font-bold">mm</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── View / Edit tabs ── */}
        <div className={`flex p-1 rounded-2xl gap-1 ${dk?'bg-slate-800':'bg-slate-100'}`}>
          {([['view','Visualizar',<FileText size={12}/>],['edit','Ajustar',<Settings2 size={12}/>]] as const).map(([t,lbl,icon])=>(
            <button key={t} type="button" onClick={() => { setTab(t as any); setSelected(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab===t?'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm':'text-slate-400'}`}>
              {icon} {lbl}
            </button>
          ))}
        </div>

        {/* ── Preview with rulers ── */}
        <div className={`rounded-2xl border-2 overflow-x-auto overflow-y-hidden ${dk?'border-slate-700 bg-slate-900':'border-slate-200 bg-slate-100'}`}>
          <div style={{ minWidth: 'max-content' }}>
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

        {/* ── Element config button (edit mode only) ── */}
        {tab === 'edit' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setElemConfigOpen(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-black text-[11px] uppercase tracking-widest transition-all ${
                dk
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-500 hover:text-indigo-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              <Layers size={15} />
              Configurar Elementos
              <span className={`ml-1 text-[9px] font-black px-2 py-0.5 rounded-full ${
                dk ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-500'
              }`}>
                {ELEM_KEYS.filter(k => layout.elems[k].visible).length}/{ELEM_KEYS.length} visíveis
              </span>
            </button>
          </div>
        )}

        {/* ── Element config popup ── */}
        {elemConfigOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center z-[80000] px-4"
            style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={() => setElemConfigOpen(false)}
          >
            <div
              className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden ${dk ? 'bg-slate-900' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
              style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
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
                        isSel
                          ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
                          : dk ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                      }`}
                      style={isSel ? { borderColor: el.color, backgroundColor: el.color + '15' } : {}}
                    >
                      {/* Color dot */}
                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: el.color }}
                      />

                      {/* Label + info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black leading-none ${dk ? 'text-white' : 'text-slate-900'}`}>
                          {el.label}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          X:{el.x.toFixed(1)} Y:{el.y.toFixed(1)} • {el.w.toFixed(1)}×{el.h.toFixed(1)} mm
                        </p>
                      </div>

                      {/* Select for edit button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(isSel ? null : key);
                          setElemConfigOpen(false);
                        }}
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

                      {/* Visibility toggle */}
                      <button
                        type="button"
                        aria-label={el.visible ? `Ocultar ${el.label}` : `Mostrar ${el.label}`}
                        onClick={() => updateElem(key, { visible: !el.visible })}
                        className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${
                          el.visible
                            ? 'shadow-inner'
                            : dk ? 'bg-slate-700' : 'bg-slate-200'
                        }`}
                        style={el.visible ? { backgroundColor: el.color } : {}}
                      >
                        <span
                          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200 flex items-center justify-center ${
                            el.visible ? 'left-5' : 'left-0.5'
                          }`}
                        >
                          {el.visible
                            ? <Eye size={10} style={{ color: el.color }} />
                            : <EyeOff size={10} className="text-slate-400" />
                          }
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
                    onClick={() => {
                      ELEM_KEYS.forEach(k => updateElem(k, { visible: true }));
                    }}
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

        {/* ── Position / resize controls ── */}
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

            {/* Readout */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['X',sel.x],['Y',sel.y],['L',sel.w],['A',sel.h]].map(([lbl,val])=>(
                <div key={lbl as string} className={`p-2 rounded-xl border ${dk?'bg-slate-800 border-slate-700':'bg-white border-slate-100'}`}>
                  <span className="block text-[8px] font-black text-slate-400 uppercase">{lbl}</span>
                  <span className={`block text-[10px] font-black ${dk?'text-slate-200':'text-slate-700'}`}>{(val as number).toFixed(1)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-4 items-center justify-center">
              {/* 4-axis directional pad */}
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

              {/* Width / height resize */}
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

            {/* ── Font controls ── */}
            <div className={`pt-3 border-t flex flex-col gap-3 ${dk?'border-slate-800':'border-slate-100'}`}>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipografia</span>

              {/* Font family */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-slate-400 w-11 uppercase shrink-0">Fonte</span>
                <div className="flex gap-1.5 flex-1">
                  {(['helvetica','times','courier'] as FontFamily[]).map(f=>(
                    <button key={f} type="button" onClick={()=>updateElem(selected,{fontFamily:f})}
                      className={`flex-1 py-1.5 rounded-xl border text-[9px] font-black transition-all ${sel.fontFamily===f||(!sel.fontFamily&&f==='helvetica')?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600':'border-slate-200 dark:border-slate-700 text-slate-400'}`}
                      style={{fontFamily: f==='helvetica'?'Arial':f==='times'?'Georgia':'monospace'}}>
                      {f==='helvetica'?'Sans':f==='times'?'Serif':'Mono'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size + bold */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-slate-400 w-11 uppercase shrink-0">Tamanho</span>
                <button type="button" aria-label="Diminuir fonte" onClick={()=>updateElem(selected,{fontSize:Math.max(3,(sel.fontSize||8)-0.5)})}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Minus size={12}/></button>
                <span className={`w-14 text-center text-[10px] font-black ${dk?'text-slate-200':'text-slate-700'}`}>{(sel.fontSize||8).toFixed(1)} pt</span>
                <button type="button" aria-label="Aumentar fonte" onClick={()=>updateElem(selected,{fontSize:(sel.fontSize||8)+0.5})}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Plus size={12}/></button>
                <button type="button" aria-label="Negrito" onClick={()=>updateElem(selected,{bold:!sel.bold})}
                  className={`w-9 h-7 rounded-xl border text-[11px] font-black transition-all ml-1 ${sel.bold?'border-indigo-500 bg-indigo-600 text-white':'border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                  B
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── OS summary ── */}
        <div className={`flex items-center gap-3 p-3 rounded-2xl border ${dk?'bg-slate-900 border-slate-800':'bg-slate-50 border-slate-100'}`}>
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0"><FileText size={14}/></div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-black leading-none truncate ${dk?'text-white':'text-slate-800'}`}>{os.osNumber} • {os.productName}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">{os.sectorName} → {nextSectorName} • {os.quantity} prs • R$ {os.totalValue.toFixed(2)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[8px] font-black text-slate-400 uppercase">{W}×{H} mm</p>
            <p className="text-[8px] text-slate-400">{printMode==='thermal'?'Térmica':'Documento'}</p>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${dk?'bg-slate-800 text-slate-400':'bg-slate-100 text-slate-500'}`}>Cancelar</button>
          <button type="button" onClick={handlePrint} disabled={printing}
            className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
            <Printer size={16}/> {printing?'Gerando…':'Gerar PDF'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
