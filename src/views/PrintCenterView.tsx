import React, { useState, useMemo, useCallback } from 'react';
import {
  Printer, Search, FileText, Package, ShoppingBag,
  Factory, ClipboardList, Check, X,
  AlertCircle, Settings2, BookOpen, Truck,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  RotateCcw, Eye, EyeOff, Plus, Minus, Tag, Image, Thermometer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  Product, Sale, Purchase, ProductionLot, ServiceOrder, Person,
  SaleStatus, PaymentStatus, PurchaseType, SaleType
} from '../types';
import { sharePDF, shareImage } from '../utils/pdfExport';
import PrintLabelEditorModal from '../components/PrintLabelEditorModal';
import PrintOSModal from '../components/PrintOSModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'os' | 'lots' | 'sales' | 'purchases' | 'products' | 'labels';
type FontFamily = 'helvetica' | 'times' | 'courier';

// ─── Paper presets ────────────────────────────────────────────────────────────

interface PaperPreset { key: string; label: string; dims: [number, number]; orientation: 'portrait' | 'landscape'; thermal?: boolean; star?: boolean }

const PAPER_PRESETS: PaperPreset[] = [
  { key: 'a4',       label: 'A4  210×297',   dims: [210, 297], orientation: 'portrait'  },
  { key: 'a5',       label: 'A5  148×210',   dims: [148, 210], orientation: 'portrait'  },
  { key: 'a6',       label: 'A6  105×148',   dims: [105, 148], orientation: 'portrait'  },
  { key: 'ticket',   label: 'Ticket 80×120', dims: [80,  120], orientation: 'portrait'  },
  { key: 'th75x24',  label: '75×24 mm',      dims: [75,   24], orientation: 'landscape', thermal: true, star: true },
  { key: 'th80x40',  label: '80×40 mm',      dims: [80,   40], orientation: 'landscape', thermal: true },
  { key: 'th57x40',  label: '57×40 mm',      dims: [57,   40], orientation: 'landscape', thermal: true },
  { key: 'th50x30',  label: '50×30 mm',      dims: [50,   30], orientation: 'landscape', thermal: true },
  { key: 'th100x50', label: '100×50 mm',     dims: [100,  50], orientation: 'landscape', thermal: true },
];

// ─── Label thermal sizes ──────────────────────────────────────────────────────

const LABEL_SIZES: { key: string; label: string; dims: [number, number]; star?: boolean }[] = [
  { key: '75x24',  label: '75 × 24 mm',  dims: [75,  24], star: true },
  { key: '38x25',  label: '38 × 25 mm',  dims: [38,  25] },
  { key: '50x30',  label: '50 × 30 mm',  dims: [50,  30] },
  { key: '57x40',  label: '57 × 40 mm',  dims: [57,  40] },
  { key: '80x40',  label: '80 × 40 mm',  dims: [80,  40] },
  { key: '80x50',  label: '80 × 50 mm',  dims: [80,  50] },
  { key: '100x50', label: '100 × 50 mm', dims: [100, 50] },
  { key: '40x30',  label: '40 × 30 mm',  dims: [40,  30] },
];

interface LayoutElem {
  x: number; y: number; w: number; h: number;
  label: string; color: string; visible: boolean;
  fontSize?: number; fontFamily?: FontFamily; bold?: boolean;
}

interface PrintLayout {
  paper: [number, number];
  orientation: 'portrait' | 'landscape';
  elems: Record<string, LayoutElem>;
}

interface Props {
  isDarkMode: boolean;
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  productionLots: ProductionLot[];
  serviceOrders: ServiceOrder[];
  people: Person[];
  sectors: any[];
  onDeleteItems?: (section: Section, ids: string[]) => void;
}

// ─── Section config ───────────────────────────────────────────────────────────

const SECTIONS: {
  id: Section; label: string; shortLabel: string;
  icon: React.ReactNode; accent: string; accentBg: string; accentBorder: string;
}[] = [
  { id: 'os',        label: 'Ordens de Serviço', shortLabel: 'OS',       icon: <ClipboardList size={20}/>, accent: 'text-rose-600',   accentBg: 'bg-rose-500',   accentBorder: 'border-rose-400' },
  { id: 'lots',      label: 'Mapa de Produção',  shortLabel: 'Mapa',     icon: <Factory size={20}/>,       accent: 'text-violet-600', accentBg: 'bg-violet-600', accentBorder: 'border-violet-400' },
  { id: 'sales',     label: 'Pedidos de Venda',  shortLabel: 'Vendas',   icon: <ShoppingBag size={20}/>,   accent: 'text-indigo-600', accentBg: 'bg-indigo-600', accentBorder: 'border-indigo-400' },
  { id: 'purchases', label: 'Pedidos de Compra', shortLabel: 'Compras',  icon: <Truck size={20}/>,         accent: 'text-teal-600',   accentBg: 'bg-teal-600',   accentBorder: 'border-teal-400' },
  { id: 'products',  label: 'Produtos',           shortLabel: 'Produtos', icon: <BookOpen size={20}/>,      accent: 'text-amber-600',  accentBg: 'bg-amber-500',  accentBorder: 'border-amber-400' },
  { id: 'labels',    label: 'Etiquetas',          shortLabel: 'Etiquetas',icon: <Tag size={20}/>,           accent: 'text-pink-600',   accentBg: 'bg-pink-600',   accentBorder: 'border-pink-400' },
];

// ─── Default layouts per section ─────────────────────────────────────────────

const A4: [number, number] = [210, 297];
const STORAGE_KEY = 'print_center_layouts_v1';

function defaultElems(section: Section): Record<string, LayoutElem> {
  switch (section) {
    case 'os': return {
      header:   { x:0, y:0,    w:210, h:20,  label:'Cabeçalho',   color:'#4338ca', visible:true,  fontSize:11, fontFamily:'helvetica', bold:true  },
      info:     { x:8, y:24,   w:194, h:50,  label:'Informações', color:'#6366f1', visible:true,  fontSize:9,  fontFamily:'helvetica', bold:false },
      total:    { x:8, y:78,   w:194, h:12,  label:'Total OS',    color:'#16a34a', visible:true,  fontSize:10, fontFamily:'helvetica', bold:true  },
      grade:    { x:8, y:93,   w:194, h:8,   label:'Grade',       color:'#d97706', visible:true,  fontSize:7,  fontFamily:'helvetica', bold:true  },
      qr:       { x:75, y:105, w:60,  h:60,  label:'QR Code',     color:'#0ea5e9', visible:true,  fontSize:8,  fontFamily:'helvetica', bold:false },
      notes:    { x:8, y:106,  w:194, h:10,  label:'Observações', color:'#f59e0b', visible:true,  fontSize:7,  fontFamily:'helvetica', bold:false },
      instruction:{x:8,y:168, w:194, h:14,  label:'Instrução',   color:'#8b5cf6', visible:true,  fontSize:8,  fontFamily:'helvetica', bold:true  },
      footer:   { x:0, y:285,  w:210, h:12,  label:'Rodapé',      color:'#94a3b8', visible:true,  fontSize:6,  fontFamily:'helvetica', bold:false },
    };
    case 'lots': return {
      header:   { x:0, y:0,    w:210, h:18,  label:'Cabeçalho',   color:'#7c3aed', visible:true,  fontSize:10, fontFamily:'helvetica', bold:true  },
      info:     { x:8, y:22,   w:194, h:30,  label:'Informações', color:'#6366f1', visible:true,  fontSize:9,  fontFamily:'helvetica', bold:false },
      grade:    { x:8, y:56,   w:194, h:10,  label:'Grade Sizes', color:'#d97706', visible:true,  fontSize:7,  fontFamily:'helvetica', bold:true  },
      route:    { x:8, y:70,   w:194, h:8,   label:'Rota',        color:'#94a3b8', visible:true,  fontSize:6,  fontFamily:'helvetica', bold:false },
      qr:       { x:75,y:82,   w:60,  h:60,  label:'QR Lote',     color:'#0ea5e9', visible:false, fontSize:8,  fontFamily:'helvetica', bold:false },
      footer:   { x:0, y:285,  w:210, h:12,  label:'Rodapé',      color:'#94a3b8', visible:true,  fontSize:6,  fontFamily:'helvetica', bold:false },
    };
    case 'sales': return {
      header:   { x:0, y:0,    w:210, h:18,  label:'Cabeçalho',   color:'#4338ca', visible:true,  fontSize:10, fontFamily:'helvetica', bold:true  },
      customer: { x:8, y:22,   w:194, h:14,  label:'Cliente',     color:'#6366f1', visible:true,  fontSize:9,  fontFamily:'helvetica', bold:false },
      items:    { x:8, y:40,   w:194, h:80,  label:'Itens',       color:'#1e293b', visible:true,  fontSize:8,  fontFamily:'helvetica', bold:false },
      total:    { x:8, y:124,  w:194, h:12,  label:'Total',       color:'#16a34a', visible:true,  fontSize:10, fontFamily:'helvetica', bold:true  },
      notes:    { x:8, y:140,  w:194, h:10,  label:'Observações', color:'#f59e0b', visible:true,  fontSize:7,  fontFamily:'helvetica', bold:false },
      footer:   { x:0, y:285,  w:210, h:12,  label:'Rodapé',      color:'#94a3b8', visible:true,  fontSize:6,  fontFamily:'helvetica', bold:false },
    };
    case 'purchases': return {
      header:   { x:0, y:0,    w:210, h:18,  label:'Cabeçalho',   color:'#0f766e', visible:true,  fontSize:10, fontFamily:'helvetica', bold:true  },
      supplier: { x:8, y:22,   w:194, h:14,  label:'Fornecedor',  color:'#6366f1', visible:true,  fontSize:9,  fontFamily:'helvetica', bold:false },
      items:    { x:8, y:40,   w:194, h:80,  label:'Itens',       color:'#1e293b', visible:true,  fontSize:8,  fontFamily:'helvetica', bold:false },
      total:    { x:8, y:124,  w:194, h:12,  label:'Total',       color:'#16a34a', visible:true,  fontSize:10, fontFamily:'helvetica', bold:true  },
      notes:    { x:8, y:140,  w:194, h:10,  label:'Observações', color:'#f59e0b', visible:true,  fontSize:7,  fontFamily:'helvetica', bold:false },
      footer:   { x:0, y:285,  w:210, h:12,  label:'Rodapé',      color:'#94a3b8', visible:true,  fontSize:6,  fontFamily:'helvetica', bold:false },
    };
    case 'products': return {
      header:   { x:0, y:0,    w:210, h:18,  label:'Cabeçalho',   color:'#b45309', visible:true,  fontSize:10, fontFamily:'helvetica', bold:true  },
      info:     { x:8, y:22,   w:194, h:20,  label:'Informações', color:'#6366f1', visible:true,  fontSize:9,  fontFamily:'helvetica', bold:false },
      photo:    { x:160,y:22,  w:42,  h:42,  label:'Foto',        color:'#f59e0b', visible:true,  fontSize:8,  fontFamily:'helvetica', bold:false },
      variations:{ x:8,y:46,  w:194, h:60,  label:'Variações',   color:'#7c3aed', visible:true,  fontSize:8,  fontFamily:'helvetica', bold:false },
      footer:   { x:0, y:285,  w:210, h:12,  label:'Rodapé',      color:'#94a3b8', visible:true,  fontSize:6,  fontFamily:'helvetica', bold:false },
    };
    case 'labels': return {};
  }
}

function defaultLayout(section: Section): PrintLayout {
  return { paper: A4, orientation: 'portrait', elems: defaultElems(section) };
}

const hexToRgb = (hex: string) => {
  if (!hex) return null;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length < 6) return null;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
};

function loadLayouts(): Record<Section, PrintLayout> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as any; } catch { return {} as any; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(date: number) { return new Date(date).toLocaleDateString('pt-BR'); }
function fmtMoney(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// ─── PDF renderers ────────────────────────────────────────────────────────────

async function renderSalesPDF(
  items: Sale[], products: Product[], people: Person[], layout: PrintLayout
) {
  const [W, H] = layout.paper;
  const doc = new jsPDF({ orientation: layout.orientation, unit: 'mm', format: layout.paper });
  const e = layout.elems;
  const applyFont = (el: LayoutElem, def = 8) => {
    doc.setFont(el.fontFamily || 'helvetica', el.bold ? 'bold' : 'normal');
    doc.setFontSize(el.fontSize ?? def);
  };

  let first = true;
  for (const sale of items) {
    if (!first) doc.addPage(layout.paper, layout.orientation);
    first = false;
    const customer = people.find(p => p.id === sale.customerId);
    const statusLabel = sale.status === SaleStatus.QUOTE ? 'ORÇAMENTO' : sale.status === SaleStatus.SALE ? 'VENDA' : 'CANCELADO';
    const paid = sale.paymentStatus === PaymentStatus.PAID;

    // Header
    if (e.header?.visible !== false) {
      doc.setFillColor(67, 56, 202);
      doc.rect(e.header.x, e.header.y, e.header.w, e.header.h, 'F');
      applyFont(e.header, 10);
      doc.setTextColor(255, 255, 255);
      doc.text(`PEDIDO DE VENDA — ${sale.orderNumber}`, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.55, { align: 'center' });
      doc.setFontSize((e.header.fontSize ?? 10) * 0.7);
      doc.text(`${statusLabel}${paid ? ' • QUITADO' : ''}`, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.85, { align: 'center' });
    }
    // Customer
    if (e.customer?.visible !== false) {
      applyFont(e.customer, 9); doc.setTextColor(100, 100, 100);
      doc.text('CLIENTE', e.customer.x, e.customer.y + (e.customer.fontSize ?? 9) * 0.25);
      applyFont(e.customer, 9); doc.setFont(e.customer.fontFamily || 'helvetica', 'bold'); doc.setTextColor(30, 30, 30);
      doc.text(customer?.name || sale.customerName || '—', e.customer.x, e.customer.y + e.customer.h * 0.7);
      doc.setFont(e.customer.fontFamily || 'helvetica', 'normal');
      doc.setFontSize((e.customer.fontSize ?? 9) * 0.8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Data: ${fmt(sale.date)}  •  Entrega: ${sale.deliveryDate ? fmt(sale.deliveryDate) : '—'}`, e.customer.x + e.customer.w * 0.5, e.customer.y + e.customer.h * 0.7, { align: 'right' });
    }
    // Items table
    if (e.items?.visible !== false) {
      let iy = e.items.y;
      const lineH = (e.items.fontSize ?? 8) * 0.45;
      // Header row
      doc.setFillColor(248, 250, 252); doc.rect(e.items.x, iy, e.items.w, lineH * 1.8, 'F');
      applyFont(e.items, 7); doc.setTextColor(100, 100, 100);
      doc.text('PRODUTO', e.items.x + 2, iy + lineH * 1.2);
      doc.text('QTD', e.items.x + e.items.w * 0.68, iy + lineH * 1.2);
      doc.text('UNIT.', e.items.x + e.items.w * 0.78, iy + lineH * 1.2);
      doc.text('TOTAL', e.items.x + e.items.w - 2, iy + lineH * 1.2, { align: 'right' });
      iy += lineH * 2;
      for (const item of sale.items) {
        if (iy > e.items.y + e.items.h) break;
        const prod = products.find(p => p.id === item.productId);
        const vari = prod?.variations.find(v => v.id === item.variationId);
        const desc = `${prod?.reference || '?'} ${prod?.name || '?'} — ${vari?.colorName || '?'}${item.size ? ` Nº${item.size}` : ''}`;
        applyFont(e.items, 8); doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(desc, e.items.w * 0.60);
        doc.text(lines[0], e.items.x + 2, iy);
        doc.text(`${item.quantity}`, e.items.x + e.items.w * 0.70, iy);
        doc.text(fmtMoney(item.price), e.items.x + e.items.w * 0.80, iy);
        doc.text(fmtMoney(item.quantity * item.price), e.items.x + e.items.w - 2, iy, { align: 'right' });
        iy += lineH * 1.5;
        doc.setDrawColor(240, 240, 240); doc.line(e.items.x, iy - lineH * 0.3, e.items.x + e.items.w, iy - lineH * 0.3);
      }
    }
    // Total
    if (e.total?.visible !== false) {
      doc.setFillColor(240, 253, 244); doc.setDrawColor(134, 239, 172);
      doc.roundedRect(e.total.x, e.total.y, e.total.w, e.total.h, 2, 2, 'FD');
      applyFont(e.total, 10); doc.setTextColor(21, 128, 61);
      doc.text('TOTAL DO PEDIDO', e.total.x + 4, e.total.y + e.total.h * 0.65);
      doc.setFontSize((e.total.fontSize ?? 10) * 1.3);
      doc.text(fmtMoney(sale.total), e.total.x + e.total.w - 4, e.total.y + e.total.h * 0.75, { align: 'right' });
    }
    // Notes
    if (e.notes?.visible !== false && sale.notes) {
      applyFont(e.notes, 7); doc.setTextColor(120, 120, 120);
      const lines = doc.splitTextToSize(`Obs: ${sale.notes}`, e.notes.w);
      doc.text(lines, e.notes.x, e.notes.y + (e.notes.fontSize ?? 7) * 0.35);
    }
    // Footer
    if (e.footer?.visible !== false) {
      applyFont(e.footer, 6); doc.setTextColor(180, 180, 180);
      doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')} • ANTIGRAVITY SYSTEM`, e.footer.x + e.footer.w / 2, e.footer.y + e.footer.h * 0.6, { align: 'center' });
    }
  }
  await sharePDF(doc, `Pedidos_Venda_${fmt(Date.now()).replace(/\//g, '-')}.pdf`);
}

async function renderPurchasesPDF(
  items: Purchase[], people: Person[], layout: PrintLayout
) {
  const doc = new jsPDF({ orientation: layout.orientation, unit: 'mm', format: layout.paper });
  const e = layout.elems;
  const applyFont = (el: LayoutElem, def = 8) => {
    doc.setFont(el.fontFamily || 'helvetica', el.bold ? 'bold' : 'normal');
    doc.setFontSize(el.fontSize ?? def);
  };
  let first = true;
  for (const purchase of items) {
    if (!first) doc.addPage(layout.paper, layout.orientation);
    first = false;
    const supplier = people.find(p => p.id === purchase.supplierId);
    const typeLabel = purchase.type === PurchaseType.REPLENISHMENT ? 'REPOSIÇÃO' : 'GERAL';

    if (e.header?.visible !== false) {
      doc.setFillColor(15, 118, 110);
      doc.rect(e.header.x, e.header.y, e.header.w, e.header.h, 'F');
      applyFont(e.header, 10); doc.setTextColor(255, 255, 255);
      doc.text(`PEDIDO DE COMPRA — ${purchase.batchNumber || purchase.id.slice(0,8).toUpperCase()}`, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.55, { align: 'center' });
      doc.setFontSize((e.header.fontSize ?? 10) * 0.7); doc.text(typeLabel, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.85, { align: 'center' });
    }
    if (e.supplier?.visible !== false) {
      applyFont(e.supplier, 9); doc.setTextColor(100, 100, 100);
      doc.text('FORNECEDOR', e.supplier.x, e.supplier.y + (e.supplier.fontSize ?? 9) * 0.25);
      doc.setFont(e.supplier.fontFamily || 'helvetica', 'bold'); doc.setTextColor(30, 30, 30);
      doc.text(supplier?.name || '—', e.supplier.x, e.supplier.y + e.supplier.h * 0.7);
      doc.setFont(e.supplier.fontFamily || 'helvetica', 'normal');
      doc.setFontSize((e.supplier.fontSize ?? 9) * 0.8); doc.setTextColor(120, 120, 120);
      doc.text(`Data: ${fmt(purchase.date)}`, e.supplier.x + e.supplier.w * 0.5, e.supplier.y + e.supplier.h * 0.7, { align: 'right' });
    }
    if (e.items?.visible !== false) {
      let iy = e.items.y;
      const lineH = (e.items.fontSize ?? 8) * 0.45;
      const allItems = [
        ...(purchase.items || []).map(i => ({ desc: `Produto ID: ${i.productId}`, qty: i.quantity, price: i.cost })),
        ...(purchase.generalItems || []).map(i => ({ desc: i.description, qty: i.quantity ?? 1, price: i.value })),
      ];
      doc.setFillColor(240, 253, 250); doc.rect(e.items.x, iy, e.items.w, lineH * 1.8, 'F');
      applyFont(e.items, 7); doc.setTextColor(100, 100, 100);
      doc.text('ITEM', e.items.x + 2, iy + lineH * 1.2);
      doc.text('QTD', e.items.x + e.items.w * 0.68, iy + lineH * 1.2);
      doc.text('VALOR', e.items.x + e.items.w - 2, iy + lineH * 1.2, { align: 'right' });
      iy += lineH * 2;
      for (const it of allItems) {
        if (iy > e.items.y + e.items.h) break;
        applyFont(e.items, 8); doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(it.desc, e.items.w * 0.60);
        doc.text(lines[0], e.items.x + 2, iy);
        doc.text(`${it.qty}`, e.items.x + e.items.w * 0.70, iy);
        doc.text(fmtMoney(it.price), e.items.x + e.items.w - 2, iy, { align: 'right' });
        iy += lineH * 1.5;
        doc.setDrawColor(240, 240, 240); doc.line(e.items.x, iy - lineH * 0.3, e.items.x + e.items.w, iy - lineH * 0.3);
      }
    }
    if (e.total?.visible !== false) {
      doc.setFillColor(240, 253, 250); doc.setDrawColor(134, 239, 172);
      doc.roundedRect(e.total.x, e.total.y, e.total.w, e.total.h, 2, 2, 'FD');
      applyFont(e.total, 10); doc.setTextColor(15, 118, 110);
      doc.text('TOTAL DA COMPRA', e.total.x + 4, e.total.y + e.total.h * 0.65);
      doc.setFontSize((e.total.fontSize ?? 10) * 1.3);
      doc.text(fmtMoney(purchase.total), e.total.x + e.total.w - 4, e.total.y + e.total.h * 0.75, { align: 'right' });
    }
    if (e.notes?.visible !== false && purchase.notes) {
      applyFont(e.notes, 7); doc.setTextColor(120, 120, 120);
      doc.text(doc.splitTextToSize(`Obs: ${purchase.notes}`, e.notes.w), e.notes.x, e.notes.y + (e.notes.fontSize ?? 7) * 0.35);
    }
    if (e.footer?.visible !== false) {
      applyFont(e.footer, 6); doc.setTextColor(180, 180, 180);
      doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')} • ANTIGRAVITY SYSTEM`, e.footer.x + e.footer.w / 2, e.footer.y + e.footer.h * 0.6, { align: 'center' });
    }
  }
  await sharePDF(doc, `Pedidos_Compra_${fmt(Date.now()).replace(/\//g, '-')}.pdf`);
}

async function renderLotsPDF(
  items: ProductionLot[], products: Product[],
  sectors: { id: string; name: string }[], layout: PrintLayout
) {
  const doc = new jsPDF({ orientation: layout.orientation, unit: 'mm', format: layout.paper });
  const e = layout.elems;
  const applyFont = (el: LayoutElem, def = 8) => {
    doc.setFont(el.fontFamily || 'helvetica', el.bold ? 'bold' : 'normal');
    doc.setFontSize(el.fontSize ?? def);
  };
  let first = true;
  for (const lot of items) {
    if (!first) doc.addPage(layout.paper, layout.orientation);
    first = false;
    const product = products.find(p => p.id === lot.productId);
    const variation = product?.variations.find(v => v.id === lot.variationId);
    const curSector = sectors.find(s => s.id === lot.route?.[lot.currentSectorIndex]);

    if (e.header?.visible !== false) {
      const lotColor = (lot as any).metadata?.badgeColor || '#7c3aed';
      const rgb = hexToRgb(lotColor) || { r: 124, g: 58, b: 237 };
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(e.header.x, e.header.y, e.header.w, e.header.h, 'F');
      applyFont(e.header, 10); doc.setTextColor(255, 255, 255);
      doc.text(`MAPA DE PRODUÇÃO — ${lot.orderNumber}`, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.55, { align: 'center' });
      doc.setFontSize((e.header.fontSize ?? 10) * 0.7);
      doc.text(lot.finishedAt ? 'FINALIZADO' : `SETOR: ${curSector?.name || '—'}`, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.85, { align: 'center' });
    }
    if (e.info?.visible !== false) {
      applyFont(e.info, 9);
      const col = e.info.w / 2;
      const lineH = e.info.h / 3;
      const rows = [
        ['Produto', `${product?.name || '—'} (${product?.reference || '?'})`],
        ['Cor', variation?.colorName || '—'],
        ['Quantidade', `${lot.quantity} pares`],
        ['Prioridade', lot.prioridade || '—'],
        ['Criado em', fmt(lot.createdAt)],
        ['Situação', lot.finishedAt ? 'Finalizado' : 'Em produção'],
      ];
      let ry = e.info.y;
      for (let i = 0; i < rows.length; i += 2) {
        const [l1, v1] = rows[i]; const [l2, v2] = rows[i + 1] || ['', ''];
        doc.setFont(e.info.fontFamily || 'helvetica', 'normal'); doc.setTextColor(120, 120, 120); doc.setFontSize((e.info.fontSize ?? 9) * 0.75);
        doc.text(l1.toUpperCase(), e.info.x, ry);
        doc.text(l2.toUpperCase(), e.info.x + col, ry);
        doc.setFont(e.info.fontFamily || 'helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.setFontSize(e.info.fontSize ?? 9);
        doc.text(v1, e.info.x, ry + lineH * 0.45);
        doc.text(v2, e.info.x + col, ry + lineH * 0.45);
        ry += lineH;
      }
    }
    if (e.grade?.visible !== false && lot.pairs && Object.keys(lot.pairs).length > 0) {
      const entries = Object.entries(lot.pairs as Record<string,number>).sort(([a],[b])=>parseFloat(a)-parseFloat(b));
      const cellW = Math.min(16, (e.grade.w - 4) / entries.length);
      entries.forEach(([sz, qty], i) => {
        const cx = e.grade.x + 2 + i * cellW;
        doc.setFillColor(254, 243, 199); doc.setDrawColor(251, 191, 36);
        doc.roundedRect(cx, e.grade.y, cellW - 0.5, e.grade.h, 0.8, 0.8, 'FD');
        applyFont(e.grade, 6); doc.setTextColor(146, 64, 14);
        doc.text(sz, cx + cellW / 2, e.grade.y + e.grade.h * 0.48, { align: 'center' });
        doc.setFontSize((e.grade.fontSize ?? 6) * 0.75); doc.setTextColor(180, 83, 9);
        doc.text(`${qty}p`, cx + cellW / 2, e.grade.y + e.grade.h * 0.85, { align: 'center' });
      });
    }
    if (e.route?.visible !== false && lot.route?.length) {
      applyFont(e.route, 6); doc.setTextColor(148, 163, 184);
      const routeStr = lot.route.map((sid, i) => {
        const sn = sectors.find(s => s.id === sid)?.name || sid;
        return i === lot.currentSectorIndex ? `[${sn}]` : sn;
      }).join(' → ');
      doc.text(doc.splitTextToSize(routeStr, e.route.w)[0], e.route.x, e.route.y + e.route.h * 0.6);
    }
    if (e.footer?.visible !== false) {
      applyFont(e.footer, 6); doc.setTextColor(180, 180, 180);
      doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')} • ANTIGRAVITY SYSTEM`, e.footer.x + e.footer.w / 2, e.footer.y + e.footer.h * 0.6, { align: 'center' });
    }
  }
  await sharePDF(doc, `Mapa_Producao_${fmt(Date.now()).replace(/\//g, '-')}.pdf`);
}

async function renderOSPDF(
  items: ServiceOrder[], products: Product[],
  sectors: { id: string; name: string }[], layout: PrintLayout
) {
  const doc = new jsPDF({ orientation: layout.orientation, unit: 'mm', format: layout.paper });
  const e = layout.elems;
  const applyFont = (el: LayoutElem, def = 8) => {
    doc.setFont(el.fontFamily || 'helvetica', el.bold ? 'bold' : 'normal');
    doc.setFontSize(el.fontSize ?? def);
  };
  let first = true;
  for (const os of items) {
    if (!first) doc.addPage(layout.paper, layout.orientation);
    first = false;
    const sector = sectors.find(s => s.id === os.sectorId);

    if (e.header?.visible !== false) {
      doc.setFillColor(220, 38, 38);
      doc.rect(e.header.x, e.header.y, e.header.w, e.header.h, 'F');
      applyFont(e.header, 10); doc.setTextColor(255, 255, 255);
      doc.text(`ORDEM DE SERVIÇO — ${os.osNumber}`, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.55, { align: 'center' });
      doc.setFontSize((e.header.fontSize ?? 10) * 0.7);
      doc.text(os.finishedAt ? 'CONCLUÍDA' : 'EM ABERTO', e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.85, { align: 'center' });
    }
    if (e.info?.visible !== false) {
      const col = e.info.w / 2; const lineH = e.info.h / 4;
      const rows = [
        ['Produto', os.productName, 'Variação', os.variationName || '—'],
        ['Setor', sector?.name || os.sectorName, 'Prestador', os.providerName],
        ['Tipo', os.type === 'INTERNAL' ? 'Interna' : 'Terceirizada', 'Criado em', fmt(os.createdAt)],
        ['Quantidade', `${os.quantity} pares`, 'Vlr/par', `R$ ${os.valuePerPair.toFixed(2)}`],
      ];
      let ry = e.info.y;
      for (const [l1, v1, l2, v2] of rows) {
        doc.setFont(e.info.fontFamily || 'helvetica', 'normal'); doc.setTextColor(120, 120, 120); doc.setFontSize((e.info.fontSize ?? 9) * 0.75);
        doc.text(l1.toUpperCase(), e.info.x, ry); doc.text((l2 || '').toUpperCase(), e.info.x + col, ry);
        doc.setFont(e.info.fontFamily || 'helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.setFontSize(e.info.fontSize ?? 9);
        doc.text(v1, e.info.x, ry + lineH * 0.45); doc.text(v2 || '', e.info.x + col, ry + lineH * 0.45);
        ry += lineH;
      }
    }
    if (e.total?.visible !== false) {
      doc.setFillColor(240, 253, 244); doc.setDrawColor(134, 239, 172);
      doc.roundedRect(e.total.x, e.total.y, e.total.w, e.total.h, 2, 2, 'FD');
      applyFont(e.total, 10); doc.setTextColor(21, 128, 61);
      doc.text('TOTAL OS', e.total.x + 4, e.total.y + e.total.h * 0.65);
      doc.setFontSize((e.total.fontSize ?? 10) * 1.4);
      doc.text(fmtMoney(os.totalValue), e.total.x + e.total.w - 4, e.total.y + e.total.h * 0.75, { align: 'right' });
    }
    if (e.grade?.visible !== false && os.sizeGrid) {
      const entries = os.sizeGrid.split('-').map(tok => { const [sz, q] = tok.split('x'); return { sz: sz || tok, qty: q ? parseInt(q) : null }; });
      const cellW = Math.min(16, (e.grade.w - 4) / entries.length);
      entries.forEach(({ sz, qty }, i) => {
        const cx = e.grade.x + 2 + i * cellW;
        doc.setFillColor(254, 243, 199); doc.setDrawColor(251, 191, 36);
        doc.roundedRect(cx, e.grade.y, cellW - 0.5, e.grade.h, 0.8, 0.8, 'FD');
        applyFont(e.grade, 6); doc.setTextColor(146, 64, 14);
        doc.text(sz, cx + cellW / 2, e.grade.y + (qty !== null ? e.grade.h * 0.48 : e.grade.h * 0.65), { align: 'center' });
        if (qty !== null) { doc.setFontSize((e.grade.fontSize ?? 6) * 0.75); doc.setTextColor(180, 83, 9); doc.text(`${qty}p`, cx + cellW / 2, e.grade.y + e.grade.h * 0.85, { align: 'center' }); }
      });
    }
    if (e.notes?.visible !== false && os.notes) {
      applyFont(e.notes, 7); doc.setTextColor(120, 120, 120);
      doc.text(doc.splitTextToSize(`Obs: ${os.notes}`, e.notes.w), e.notes.x, e.notes.y + (e.notes.fontSize ?? 7) * 0.35);
    }
    if (e.instruction?.visible !== false) {
      applyFont(e.instruction, 8); doc.setTextColor(67, 56, 202);
      doc.text('ESCANEIE O QR CODE PARA CONFIRMAR E AVANÇAR O LOTE', e.instruction.x + e.instruction.w / 2, e.instruction.y + e.instruction.h * 0.4, { align: 'center' });
    }
    if (e.footer?.visible !== false) {
      applyFont(e.footer, 6); doc.setTextColor(180, 180, 180);
      doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')} • ANTIGRAVITY SYSTEM`, e.footer.x + e.footer.w / 2, e.footer.y + e.footer.h * 0.6, { align: 'center' });
    }
  }
  await sharePDF(doc, `OS_Lista_${fmt(Date.now()).replace(/\//g, '-')}.pdf`);
}

async function renderProductsPDF(items: Product[], layout: PrintLayout) {
  const doc = new jsPDF({ orientation: layout.orientation, unit: 'mm', format: layout.paper });
  const e = layout.elems;
  const applyFont = (el: LayoutElem, def = 8) => {
    doc.setFont(el.fontFamily || 'helvetica', el.bold ? 'bold' : 'normal');
    doc.setFontSize(el.fontSize ?? def);
  };
  let first = true;
  for (const product of items) {
    if (!first) doc.addPage(layout.paper, layout.orientation);
    first = false;
    if (e.header?.visible !== false) {
      doc.setFillColor(245, 158, 11);
      doc.rect(e.header.x, e.header.y, e.header.w, e.header.h, 'F');
      applyFont(e.header, 10); doc.setTextColor(255, 255, 255);
      doc.text(`FICHA DE PRODUTO — ${product.reference}`, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.55, { align: 'center' });
      doc.setFontSize((e.header.fontSize ?? 10) * 0.75); doc.text(product.name, e.header.x + e.header.w / 2, e.header.y + e.header.h * 0.85, { align: 'center' });
    }
    if (e.photo?.visible !== false && product.photoUrl) {
      try { doc.addImage(product.photoUrl, 'JPEG', e.photo.x, e.photo.y, e.photo.w, e.photo.h); } catch { /* skip */ }
    }
    if (e.info?.visible !== false) {
      const col = e.info.w / 3;
      applyFont(e.info, 9);
      [
        ['Tipo', product.type === SaleType.RETAIL ? 'Varejo' : 'Atacado'],
        ['Custo', fmtMoney(product.costPrice)],
        ['Venda', fmtMoney(product.salePrice)],
      ].forEach(([l, v], i) => {
        doc.setFont(e.info.fontFamily || 'helvetica', 'normal'); doc.setTextColor(120, 120, 120); doc.setFontSize((e.info.fontSize ?? 9) * 0.75);
        doc.text(l, e.info.x + col * i, e.info.y);
        doc.setFont(e.info.fontFamily || 'helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.setFontSize(e.info.fontSize ?? 9);
        doc.text(v, e.info.x + col * i, e.info.y + e.info.h * 0.55);
      });
    }
    if (e.variations?.visible !== false) {
      let vy = e.variations.y;
      const lineH = (e.variations.fontSize ?? 8) * 0.5;
      for (const v of product.variations) {
        if (vy > e.variations.y + e.variations.h) break;
        const totalStock = Object.values(v.stock as Record<string,number>).reduce((s,n)=>s+n,0);
        doc.setFillColor(249, 250, 251); doc.roundedRect(e.variations.x, vy, e.variations.w, lineH * 3.2, 1, 1, 'F');
        applyFont(e.variations, 8); doc.setTextColor(30, 30, 30);
        doc.setFont(e.variations.fontFamily || 'helvetica', 'bold');
        doc.text(v.colorName, e.variations.x + 4, vy + lineH * 1.3);
        doc.setFont(e.variations.fontFamily || 'helvetica', 'normal'); doc.setFontSize((e.variations.fontSize ?? 8) * 0.85); doc.setTextColor(100, 100, 100);
        doc.text(`Estoque total: ${totalStock} un.`, e.variations.x + 50, vy + lineH * 1.3);
        const sizes = Object.entries(v.stock as Record<string,number>).filter(([k])=>k!=='WHOLESALE').map(([k,q])=>`${k}:${q}`).join('  ');
        doc.setFontSize((e.variations.fontSize ?? 8) * 0.7); doc.setTextColor(148, 163, 184);
        doc.text(doc.splitTextToSize(sizes, e.variations.w - 8)[0] || '', e.variations.x + 4, vy + lineH * 2.5);
        vy += lineH * 3.5;
      }
    }
    if (e.footer?.visible !== false) {
      applyFont(e.footer, 6); doc.setTextColor(180, 180, 180);
      doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')} • ANTIGRAVITY SYSTEM`, e.footer.x + e.footer.w / 2, e.footer.y + e.footer.h * 0.6, { align: 'center' });
    }
  }
  await sharePDF(doc, `Fichas_Produto_${fmt(Date.now()).replace(/\//g, '-')}.pdf`);
}

// ─── JPG Canvas renderer ─────────────────────────────────────────────────────

type CardDef = { color: string; num: string; title: string; subtitle: string; rows: { label: string; value: string }[] };

function buildCards(
  section: Section,
  osItems: ServiceOrder[], lotItems: ProductionLot[],
  saleItems: Sale[], purchaseItems: Purchase[], productItems: Product[],
  allProducts: Product[], people: Person[], allSectors: { id: string; name: string }[]
): CardDef[] {
  const cards: CardDef[] = [];
  if (section === 'os') {
    for (const os of osItems) {
      cards.push({
        color: '#dc2626', num: os.osNumber, title: os.productName, subtitle: os.variationName || '',
        rows: [
          { label: 'Setor', value: allSectors.find(s => s.id === os.sectorId)?.name || os.sectorName || '—' },
          { label: 'Prestador', value: os.providerName || '—' },
          { label: 'Quantidade', value: `${os.quantity} pares` },
          { label: 'Valor/par', value: `R$ ${os.valuePerPair.toFixed(2)}` },
          { label: 'Total', value: fmtMoney(os.totalValue) },
          { label: 'Status', value: os.finishedAt ? 'Concluída' : 'Em aberto' },
        ],
      });
    }
  } else if (section === 'lots') {
    for (const lot of lotItems) {
      const product = allProducts.find(p => p.id === lot.productId);
      const variation = product?.variations.find(v => v.id === lot.variationId);
      const curSector = allSectors.find(s => s.id === lot.route?.[lot.currentSectorIndex]);
      cards.push({
        color: (lot as any).metadata?.badgeColor || '#7c3aed', num: lot.orderNumber, title: product?.name || '—', subtitle: variation?.colorName || '',
        rows: [
          { label: 'Referência', value: product?.reference || '—' },
          { label: 'Setor atual', value: curSector?.name || '—' },
          { label: 'Quantidade', value: `${lot.quantity} pares` },
          { label: 'Status', value: lot.finishedAt ? 'Finalizado' : 'Em produção' },
          { label: 'Criado em', value: fmt(lot.createdAt) },
        ],
      });
    }
  } else if (section === 'sales') {
    for (const sale of saleItems) {
      const customer = people.find(p => p.id === sale.customerId);
      cards.push({
        color: '#4338ca', num: sale.orderNumber,
        title: customer?.name || sale.customerName || 'Sem cliente',
        subtitle: sale.status === SaleStatus.QUOTE ? 'Orçamento' : sale.status === SaleStatus.SALE ? 'Venda' : 'Cancelado',
        rows: [
          { label: 'Data', value: fmt(sale.date) },
          { label: 'Entrega', value: sale.deliveryDate ? fmt(sale.deliveryDate) : '—' },
          { label: 'Itens', value: `${sale.items.length} produto(s)` },
          { label: 'Total', value: fmtMoney(sale.total) },
          { label: 'Pagamento', value: sale.paymentStatus === PaymentStatus.PAID ? 'Quitado' : 'Pendente' },
        ],
      });
    }
  } else if (section === 'purchases') {
    for (const purchase of purchaseItems) {
      const supplier = people.find(p => p.id === purchase.supplierId);
      cards.push({
        color: '#0f766e', num: purchase.batchNumber || purchase.id.slice(0, 8).toUpperCase(),
        title: supplier?.name || '—',
        subtitle: purchase.type === PurchaseType.REPLENISHMENT ? 'Reposição' : 'Geral',
        rows: [
          { label: 'Data', value: fmt(purchase.date) },
          { label: 'Tipo', value: purchase.type === PurchaseType.REPLENISHMENT ? 'Reposição' : 'Geral' },
          { label: 'Total', value: fmtMoney(purchase.total) },
        ],
      });
    }
  } else {
    for (const product of productItems) {
      cards.push({
        color: '#d97706', num: product.reference, title: product.name,
        subtitle: `${product.variations.length} variação(ões)`,
        rows: [
          { label: 'Tipo', value: product.type === SaleType.RETAIL ? 'Varejo' : 'Atacado' },
          { label: 'Custo', value: fmtMoney(product.costPrice) },
          { label: 'Preço de venda', value: fmtMoney(product.salePrice) },
          { label: 'Cores', value: product.variations.map(v => v.colorName).join(', ') || '—' },
        ],
      });
    }
  }
  return cards;
}

function drawRR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawRRTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function renderSectionJPG(
  section: Section, filename: string,
  osItems: ServiceOrder[], lotItems: ProductionLot[],
  saleItems: Sale[], purchaseItems: Purchase[], productItems: Product[],
  allProducts: Product[], people: Person[], allSectors: { id: string; name: string }[]
) {
  const cards = buildCards(section, osItems, lotItems, saleItems, purchaseItems, productItems, allProducts, people, allSectors);
  if (cards.length === 0) return;

  const CW = 800, PAD = 14, CPAD = 24, HEADERH = 70, ROWH = 42, GAP = 14, RADIUS = 16;
  const cardH = (c: CardDef) => HEADERH + CPAD + c.rows.length * ROWH + CPAD;
  const totalH = 64 + cards.reduce((s, c) => s + cardH(c) + GAP, 0) + GAP;

  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, CW, totalH);

  // Top bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, CW, 50);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
  ctx.fillText('ANTIGRAVITY SYSTEM', PAD + 6, 32);
  ctx.fillStyle = '#64748b'; ctx.font = '12px Arial'; ctx.textAlign = 'right';
  ctx.fillText(`${cards.length} registro(s)  •  ${new Date().toLocaleDateString('pt-BR')}`, CW - PAD - 6, 32);

  let y = 64;
  for (const card of cards) {
    const CH = cardH(card);
    const cx = PAD, cw = CW - PAD * 2;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    drawRR(ctx, cx + 2, y + 3, cw, CH, RADIUS); ctx.fill();

    // card bg
    ctx.fillStyle = '#ffffff';
    drawRR(ctx, cx, y, cw, CH, RADIUS); ctx.fill();

    // header
    ctx.fillStyle = card.color;
    drawRRTop(ctx, cx, y, cw, HEADERH, RADIUS); ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = 'bold 12px Arial';
    ctx.fillText(card.num, cx + CPAD, y + 22);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 21px Arial';
    const titleMax = 38;
    ctx.fillText(card.title.length > titleMax ? card.title.slice(0, titleMax) + '…' : card.title, cx + CPAD, y + 50);
    if (card.subtitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '12px Arial'; ctx.textAlign = 'right';
      ctx.fillText(card.subtitle, cx + cw - CPAD, y + 22);
    }

    // rows
    ctx.textAlign = 'left';
    let fy = y + HEADERH + CPAD;
    const half = Math.ceil(card.rows.length / 2);
    const colW = (cw - CPAD * 2) / 2;
    card.rows.forEach((row, i) => {
      const col = i < half ? 0 : 1;
      const row_i = i < half ? i : i - half;
      const fx = cx + CPAD + col * (colW + 8);
      const fy2 = y + HEADERH + CPAD + row_i * ROWH;
      ctx.fillStyle = '#94a3b8'; ctx.font = '10px Arial';
      ctx.fillText(row.label.toUpperCase(), fx, fy2 + 10);
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 14px Arial';
      const valMax = 22;
      ctx.fillText(row.value.length > valMax ? row.value.slice(0, valMax) + '…' : row.value, fx, fy2 + 28);
    });
    // use fy properly
    fy = fy; // already set above

    y += CH + GAP;
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
  await shareImage(dataUrl, filename);
}

async function renderThermalCanvas(
  section: Section,
  osItems: ServiceOrder[], lotItems: ProductionLot[],
  saleItems: Sale[], purchaseItems: Purchase[], productItems: Product[],
  allProducts: Product[], people: Person[], allSectors: { id: string; name: string }[]
) {
  const cards = buildCards(section, osItems, lotItems, saleItems, purchaseItems, productItems, allProducts, people, allSectors);
  if (cards.length === 0) return;

  // 80x40mm at ~12px/mm → 960x480px per label
  const LW = 960, LH = 480, PAD = 32;
  const canvas = document.createElement('canvas');
  canvas.width = LW; canvas.height = LH * cards.length;
  const ctx = canvas.getContext('2d')!;

  cards.forEach((card, idx) => {
    const oy = idx * LH;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, oy, LW, LH);
    if (idx > 0) { ctx.strokeStyle = '#cccccc'; ctx.setLineDash([8, 4]); ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(LW, oy); ctx.stroke(); ctx.setLineDash([]); }

    // Left accent strip
    ctx.fillStyle = card.color; ctx.fillRect(0, oy, 16, LH);

    // Number
    ctx.fillStyle = card.color; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'left';
    ctx.fillText(card.num, PAD + 16, oy + 52);

    // Date
    ctx.fillStyle = '#94a3b8'; ctx.font = '20px Arial'; ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString('pt-BR'), LW - PAD, oy + 52);

    // Divider
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(PAD + 16, oy + 66); ctx.lineTo(LW - PAD, oy + 66); ctx.stroke();

    // Title
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'left';
    const t = card.title.length > 24 ? card.title.slice(0, 24) + '…' : card.title;
    ctx.fillText(t, PAD + 16, oy + 128);

    // Subtitle
    ctx.fillStyle = '#64748b'; ctx.font = '26px Arial';
    ctx.fillText(card.subtitle || '', PAD + 16, oy + 168);

    // Key rows (first 4 only for thermal)
    const maxRows = Math.min(card.rows.length, 4);
    const colW = (LW - PAD * 2 - 16) / 2;
    for (let i = 0; i < maxRows; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const fx = PAD + 16 + col * (colW + 8);
      const fy = oy + 220 + row * 100;
      ctx.fillStyle = '#94a3b8'; ctx.font = '18px Arial';
      ctx.fillText(card.rows[i].label.toUpperCase(), fx, fy);
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 30px Arial';
      const v = card.rows[i].value.length > 18 ? card.rows[i].value.slice(0, 18) + '…' : card.rows[i].value;
      ctx.fillText(v, fx, fy + 38);
    }

    // Footer
    ctx.fillStyle = '#cbd5e1'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
    ctx.fillText('ANTIGRAVITY SYSTEM', LW / 2, oy + LH - 16);
  });

  const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
  await shareImage(dataUrl, `Etiqueta_${section}_${fmt(Date.now()).replace(/\//g, '-')}.jpg`);
}

// ─── Ruler ────────────────────────────────────────────────────────────────────

function Ruler({ axis, totalMm, scale, isDark }: { axis: 'h'|'v'; totalMm: number; scale: number; isDark: boolean }) {
  const SIZE = 12, bg = isDark ? '#1e293b' : '#f1f5f9', brd = isDark ? '#334155' : '#cbd5e1', tc = isDark ? '#64748b' : '#94a3b8';
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
          <div style={{ width:1, height: major?7:mid?4:2, backgroundColor: tc }}/>
          {major && mm > 0 && <span style={{ fontSize:5, color:tc, lineHeight:1, marginTop:1 }}>{mm}</span>}
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ position:'relative', width: SIZE, height: totalMm*scale, backgroundColor: bg, borderRight:`1px solid ${brd}`, flexShrink:0, overflow:'hidden' }}>
      {ticks.map(({ pos, mm, major, mid }) => (
        <div key={mm} style={{ position:'absolute', top: pos, left:0, display:'flex', alignItems:'center', transform:'translateY(-50%)' }}>
          <div style={{ height:1, width: major?7:mid?4:2, backgroundColor: tc }}/>
          {major && mm > 0 && <span style={{ fontSize:5, color:tc, lineHeight:1, marginLeft:1, writingMode:'vertical-rl', transform:'rotate(180deg)' }}>{mm}</span>}
        </div>
      ))}
    </div>
  );
}

const STEPS = [0.5, 1, 2, 5];

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${color}`}>{label}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PrintCenterView({ isDarkMode, products, sales, purchases, productionLots, serviceOrders, people, sectors, onDeleteItems }: Props) {
  const [activeSection, setActiveSection] = useState<Section>('os');
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);
  const [osModalOpen, setOsModalOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Selections
  const [selOS,        setSelOS]        = useState<Set<string>>(new Set());
  const [selLots,      setSelLots]      = useState<Set<string>>(new Set());
  const [selSales,     setSelSales]     = useState<Set<string>>(new Set());
  const [selPurchases, setSelPurchases] = useState<Set<string>>(new Set());
  const [selProducts,  setSelProducts]  = useState<Set<string>>(new Set());

  // Filters
  const [osFilter,       setOsFilter]       = useState<'all'|'open'|'done'>('all');
  const [lotFilter,      setLotFilter]      = useState<'all'|'active'|'done'>('all');
  const [saleFilter,     setSaleFilter]     = useState<'all'|'quote'|'sale'|'cancelled'>('all');
  const [purchaseFilter, setPurchaseFilter] = useState<'all'|'replenishment'|'general'>('all');

  // Layout editor state
  const [allLayouts, setAllLayouts] = useState<Partial<Record<Section, PrintLayout>>>(() => loadLayouts());
  const [selectedElem, setSelectedElem] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Label section state — opens PrintLabelEditorModal
  const [labelProductId,       setLabelProductId]       = useState('');
  const [labelModalOpen,       setLabelModalOpen]       = useState(false);

  const layout: PrintLayout = allLayouts[activeSection] ?? defaultLayout(activeSection);
  const [W, H] = layout.paper;

  const MAX_W = Math.min(340, (typeof window !== 'undefined' ? window.innerWidth : 400) - 32);
  const MAX_H = 260;
  const scale = Math.min(MAX_W / W, MAX_H / H);
  const RULER = 12;
  const dk = isDarkMode;

  const saveLayout = useCallback((sec: Section, l: PrintLayout) => {
    const next = { ...allLayouts, [sec]: l };
    setAllLayouts(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [allLayouts]);

  const updateElem = (key: string, patch: Partial<LayoutElem>) => {
    const next: PrintLayout = { ...layout, elems: { ...layout.elems, [key]: { ...layout.elems[key], ...patch } } };
    saveLayout(activeSection, next);
  };
  const moveElem = (key: string, dx: number, dy: number) => {
    const e = layout.elems[key];
    updateElem(key, { x: Math.max(0, Math.min(W - e.w, e.x + dx)), y: Math.max(0, Math.min(H - e.h, e.y + dy)) });
  };
  const resizeElem = (key: string, dw: number, dh: number) => {
    const e = layout.elems[key];
    updateElem(key, { w: Math.max(5, Math.min(W - e.x, e.w + dw)), h: Math.max(2, Math.min(H - e.y, e.h + dh)) });
  };
  const handleReset = () => { saveLayout(activeSection, defaultLayout(activeSection)); setSelectedElem(null); };

  const q = search.toLowerCase();

  const filteredOS      = useMemo(() => serviceOrders.filter(o => {
    if (osFilter === 'open' && o.finishedAt) return false;
    if (osFilter === 'done' && !o.finishedAt) return false;
    return !q || `${o.osNumber} ${o.productName} ${o.sectorName} ${o.providerName}`.toLowerCase().includes(q);
  }), [serviceOrders, osFilter, q]);

  const filteredLots    = useMemo(() => productionLots.filter(l => {
    if (lotFilter === 'active' && l.finishedAt) return false;
    if (lotFilter === 'done' && !l.finishedAt) return false;
    const p = products.find(pr => pr.id === l.productId);
    return !q || `${l.orderNumber} ${p?.name} ${p?.reference}`.toLowerCase().includes(q);
  }), [productionLots, lotFilter, products, q]);

  const filteredSales   = useMemo(() => sales.filter(s => {
    if (saleFilter === 'quote' && s.status !== SaleStatus.QUOTE) return false;
    if (saleFilter === 'sale' && s.status !== SaleStatus.SALE) return false;
    if (saleFilter === 'cancelled' && s.status !== SaleStatus.CANCELLED) return false;
    const c = people.find(p => p.id === s.customerId);
    return !q || `${s.orderNumber} ${c?.name} ${s.customerName}`.toLowerCase().includes(q);
  }), [sales, saleFilter, people, q]);

  const filteredPurchases = useMemo(() => purchases.filter(p => {
    if (purchaseFilter === 'replenishment' && p.type !== PurchaseType.REPLENISHMENT) return false;
    if (purchaseFilter === 'general' && p.type !== PurchaseType.GENERAL) return false;
    const s = people.find(pe => pe.id === p.supplierId);
    return !q || `${p.batchNumber} ${s?.name}`.toLowerCase().includes(q);
  }), [purchases, purchaseFilter, people, q]);

  const filteredProducts = useMemo(() => products.filter(p =>
    !q || `${p.reference} ${p.name}`.toLowerCase().includes(q)
  ), [products, q]);

  function toggle<T>(set: Set<T>, item: T): Set<T> { const n = new Set(set); n.has(item) ? n.delete(item) : n.add(item); return n; }

  function selCount() {
    if (activeSection === 'labels')    return labelProductId ? 1 : 0;
    if (activeSection === 'os')        return selOS.size;
    if (activeSection === 'lots')      return selLots.size;
    if (activeSection === 'sales')     return selSales.size;
    if (activeSection === 'purchases') return selPurchases.size;
    return selProducts.size;
  }

  function getSelIds() {
    if (activeSection === 'os') return Array.from(selOS);
    if (activeSection === 'lots') return Array.from(selLots);
    if (activeSection === 'sales') return Array.from(selSales);
    if (activeSection === 'purchases') return Array.from(selPurchases);
    return Array.from(selProducts);
  }

  function selectAll() {
    if (activeSection === 'os')        setSelOS(new Set(filteredOS.map(o => o.id)));
    else if (activeSection === 'lots') setSelLots(new Set(filteredLots.map(l => l.id)));
    else if (activeSection === 'sales') setSelSales(new Set(filteredSales.map(s => s.id)));
    else if (activeSection === 'purchases') setSelPurchases(new Set(filteredPurchases.map(p => p.id)));
    else setSelProducts(new Set(filteredProducts.map(p => p.id)));
  }
  function clearSel() {
    if (activeSection === 'os')        setSelOS(new Set());
    else if (activeSection === 'lots') setSelLots(new Set());
    else if (activeSection === 'sales') setSelSales(new Set());
    else if (activeSection === 'purchases') setSelPurchases(new Set());
    else setSelProducts(new Set());
  }

  const changePaper = (preset: PaperPreset) => {
    const def = defaultLayout(activeSection);
    const [oldW, oldH] = layout.paper;
    const [newW, newH] = preset.dims;
    const sx = newW / oldW, sy = newH / oldH;
    const scaledElems: Record<string, LayoutElem> = {};
    for (const [k, el] of Object.entries(layout.elems)) {
      scaledElems[k] = {
        ...el,
        x: parseFloat((el.x * sx).toFixed(1)),
        y: parseFloat((el.y * sy).toFixed(1)),
        w: parseFloat((el.w * sx).toFixed(1)),
        h: parseFloat((el.h * sy).toFixed(1)),
      };
    }
    saveLayout(activeSection, { paper: preset.dims, orientation: preset.orientation, elems: scaledElems });
    setSelectedElem(null);
  };

  const handlePrint = () => {
    if (selCount() === 0) return;
    setShowExportModal(true);
  };

  const doExport = async (format: 'pdf' | 'jpg' | 'thermal') => {
    setShowExportModal(false);
    const selOS_items    = filteredOS.filter(o => selOS.has(o.id));
    const selLots_items  = filteredLots.filter(l => selLots.has(l.id));
    const selSales_items = filteredSales.filter(s => selSales.has(s.id));
    const selPurch_items = filteredPurchases.filter(p => selPurchases.has(p.id));
    const selProd_items  = filteredProducts.filter(p => selProducts.has(p.id));

    if (format === 'pdf') {
      if (activeSection === 'labels') { setLabelModalOpen(true); return; }
      if (activeSection === 'os' && selOS_items.length === 1) { setOsModalOpen(true); return; }
      setPrinting(true);
      try {
        if (activeSection === 'os')        await renderOSPDF(selOS_items, products, sectors, layout);
        else if (activeSection === 'lots') await renderLotsPDF(selLots_items, products, sectors, layout);
        else if (activeSection === 'sales') await renderSalesPDF(selSales_items, products, people, layout);
        else if (activeSection === 'purchases') await renderPurchasesPDF(selPurch_items, people, layout);
        else await renderProductsPDF(selProd_items, layout);
      } finally { setPrinting(false); }

    } else if (format === 'jpg') {
      if (activeSection === 'labels') { setLabelModalOpen(true); return; }
      setPrinting(true);
      try {
        const fname = `Exportacao_${activeSection}_${fmt(Date.now()).replace(/\//g, '-')}.jpg`;
        await renderSectionJPG(activeSection, fname,
          selOS_items, selLots_items, selSales_items, selPurch_items, selProd_items,
          products, people, sectors);
      } finally { setPrinting(false); }

    } else {
      // thermal
      if (activeSection === 'labels' || activeSection === 'products') {
        setLabelModalOpen(true);
      } else if (activeSection === 'os' && selOS_items.length === 1) {
        setOsModalOpen(true);
      } else {
        setPrinting(true);
        try {
          await renderThermalCanvas(activeSection,
            selOS_items, selLots_items, selSales_items, selPurch_items, selProd_items,
            products, people, sectors);
        } finally { setPrinting(false); }
      }
    }
  };

  const sec = SECTIONS.find(s => s.id === activeSection)!;
  const cnt = selCount();
  const elemKeys = Object.keys(layout.elems);
  const selElem = selectedElem ? layout.elems[selectedElem] : null;

  // ── Labels panel — seleciona produto e abre o editor completo ───────────────

  const renderLabelsPanel = () => {
    const labelProduct = products.find(p => p.id === labelProductId);
    return (
      <div key="labels-panel" className="flex flex-col gap-4">
        {/* Info */}
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${dk ? 'bg-indigo-900/20 border-indigo-700/30' : 'bg-indigo-50 border-indigo-100'}`}>
          <Tag size={20} className="text-pink-500 shrink-0"/>
          <div>
            <p className="text-sm font-black text-pink-600 dark:text-pink-400">Impressão de Etiquetas</p>
            <p className="text-xs text-slate-400 mt-0.5">Selecione o produto abaixo e clique em "Abrir Editor de Etiquetas" para configurar tamanho, layout, QR Code e imprimir.</p>
          </div>
        </div>

        {/* Produto selecionado */}
        {labelProduct && (
          <div className={`p-4 rounded-2xl border-2 border-pink-400 bg-pink-50 dark:bg-pink-900/20 flex items-center gap-3`}>
            {labelProduct.photoUrl
              ? <img src={labelProduct.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0"/>
              : <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${dk ? 'bg-slate-800' : 'bg-white'}`}><Package size={20} className="text-slate-400"/></div>}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-pink-600 dark:text-pink-400">{labelProduct.reference}</p>
              <p className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-800'}`}>{labelProduct.name}</p>
              <p className="text-xs text-slate-400">{labelProduct.variations.length} variação(ões)</p>
            </div>
            <button aria-label="Remover produto selecionado" type="button" onClick={() => setLabelProductId('')} className="text-slate-400 p-1"><X size={16}/></button>
          </div>
        )}

        {/* Lista de produtos */}
        <div className={`rounded-2xl border overflow-hidden ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b ${dk ? 'text-slate-400 border-slate-800 bg-slate-900' : 'text-slate-400 border-slate-100 bg-slate-50'}`}>
            {labelProductId ? 'Trocar Produto' : 'Selecione o Produto'}
          </p>
          <div className={`flex flex-col divide-y ${dk ? 'divide-slate-800' : 'divide-slate-50'}`}>
            {products.map(p => (
              <button key={p.id} type="button"
                onClick={() => setLabelProductId(p.id)}
                className={`flex items-center gap-3 p-4 text-left transition-all ${labelProductId === p.id ? dk ? 'bg-pink-900/20' : 'bg-pink-50' : dk ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-slate-50'}`}>
                {p.photoUrl
                  ? <img src={p.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0"/>
                  : <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${dk ? 'bg-slate-800' : 'bg-slate-100'}`}><Package size={16} className="text-slate-400"/></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-pink-600 dark:text-pink-400">{p.reference}</p>
                  <p className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-800'}`}>{p.name}</p>
                </div>
                {labelProductId === p.id && <Check size={16} className="text-pink-500 shrink-0"/>}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── List rows ─────────────────────────────────────────────────────────────

  const renderRows = () => {
    if (activeSection === 'os') return filteredOS.map(os => {
      const sel = selOS.has(os.id);
      const sector = sectors.find(s => s.id === os.sectorId);
      return (
        <button key={os.id} type="button" onClick={() => setSelOS(toggle(selOS, os.id))}
          className={`w-full flex items-center gap-3 p-4 text-left rounded-2xl border-2 transition-all ${sel ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20' : dk ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <div className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center ${sel ? 'bg-rose-500 border-rose-500 text-white' : dk ? 'border-slate-600' : 'border-slate-300'}`}>
            {sel && <Check size={10} strokeWidth={3}/>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">{os.osNumber}</span>
              <Badge label={os.finishedAt ? 'Concluída' : 'Em aberto'} color={os.finishedAt ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}/>
            </div>
            <p className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-800'}`}>{os.productName}</p>
            <p className="text-[10px] text-slate-400 truncate">{sector?.name || os.sectorName} • {os.providerName} • {os.quantity} prs</p>
          </div>
          <p className="text-sm font-black text-rose-600 dark:text-rose-400 shrink-0">{fmtMoney(os.totalValue)}</p>
        </button>
      );
    });

    if (activeSection === 'lots') return filteredLots.map(lot => {
      const sel = selLots.has(lot.id);
      const product = products.find(p => p.id === lot.productId);
      const variation = product?.variations.find(v => v.id === lot.variationId);
      const curSector = sectors.find(s => s.id === lot.route?.[lot.currentSectorIndex]);
      return (
        <button key={lot.id} type="button" onClick={() => setSelLots(toggle(selLots, lot.id))}
          className={`w-full flex items-center gap-3 p-4 text-left rounded-2xl border-2 transition-all ${sel ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20' : dk ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <div className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center ${sel ? 'bg-violet-600 border-violet-600 text-white' : dk ? 'border-slate-600' : 'border-slate-300'}`}>
            {sel && <Check size={10} strokeWidth={3}/>}
          </div>
          {product?.photoUrl
            ? <img src={product.photoUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0"/>
            : <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${dk ? 'bg-slate-800' : 'bg-slate-100'}`}><Factory size={16} className="text-slate-400"/></div>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider leading-none shrink-0"
                style={(() => {
                  const bg = (lot as any).metadata?.badgeColor || '#7c3aed';
                  const txt = (lot as any).metadata?.badgeTextColor || '#ffffff';
                  return {
                    backgroundColor: bg,
                    color: txt,
                  };
                })()}
              >
                MAPA {lot.orderNumber}
              </span>
              <Badge label={lot.finishedAt ? 'Finalizado' : curSector?.name || 'Em produção'} color={lot.finishedAt ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}/>
            </div>
            <p className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-800'}`}>{product?.name || '—'}</p>
            <p className="text-[10px] text-slate-400 truncate">{product?.reference} • {variation?.colorName} • {lot.quantity} pares</p>
          </div>
        </button>
      );
    });

    if (activeSection === 'sales') return filteredSales.map(sale => {
      const sel = selSales.has(sale.id);
      const customer = people.find(p => p.id === sale.customerId);
      const stColor = sale.status === SaleStatus.QUOTE ? 'bg-amber-50 text-amber-600' : sale.status === SaleStatus.SALE ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500';
      return (
        <button key={sale.id} type="button" onClick={() => setSelSales(toggle(selSales, sale.id))}
          className={`w-full flex items-center gap-3 p-4 text-left rounded-2xl border-2 transition-all ${sel ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : dk ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <div className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center ${sel ? 'bg-indigo-600 border-indigo-600 text-white' : dk ? 'border-slate-600' : 'border-slate-300'}`}>
            {sel && <Check size={10} strokeWidth={3}/>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{sale.orderNumber}</span>
              <Badge label={sale.status === SaleStatus.QUOTE ? 'Orçamento' : sale.status === SaleStatus.SALE ? 'Venda' : 'Cancelado'} color={stColor}/>
            </div>
            <p className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-800'}`}>{customer?.name || sale.customerName || 'Sem cliente'}</p>
            <p className="text-[10px] text-slate-400">{fmt(sale.date)} • {sale.items.length} item(s)</p>
          </div>
          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 shrink-0">{fmtMoney(sale.total)}</p>
        </button>
      );
    });

    if (activeSection === 'purchases') return filteredPurchases.map(purchase => {
      const sel = selPurchases.has(purchase.id);
      const supplier = people.find(p => p.id === purchase.supplierId);
      return (
        <button key={purchase.id} type="button" onClick={() => setSelPurchases(toggle(selPurchases, purchase.id))}
          className={`w-full flex items-center gap-3 p-4 text-left rounded-2xl border-2 transition-all ${sel ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/20' : dk ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <div className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center ${sel ? 'bg-teal-600 border-teal-600 text-white' : dk ? 'border-slate-600' : 'border-slate-300'}`}>
            {sel && <Check size={10} strokeWidth={3}/>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[10px] font-black text-teal-600 dark:text-teal-400">{purchase.batchNumber || purchase.id.slice(0,8).toUpperCase()}</span>
              <Badge label={purchase.type === PurchaseType.REPLENISHMENT ? 'Reposição' : 'Geral'} color="bg-teal-50 text-teal-600"/>
            </div>
            <p className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-800'}`}>{supplier?.name || '—'}</p>
            <p className="text-[10px] text-slate-400">{fmt(purchase.date)}</p>
          </div>
          <p className="text-sm font-black text-teal-600 dark:text-teal-400 shrink-0">{fmtMoney(purchase.total)}</p>
        </button>
      );
    });

    return filteredProducts.map(product => {
      const sel = selProducts.has(product.id);
      return (
        <button key={product.id} type="button" onClick={() => setSelProducts(toggle(selProducts, product.id))}
          className={`w-full flex items-center gap-3 p-4 text-left rounded-2xl border-2 transition-all ${sel ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : dk ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <div className={`w-5 h-5 rounded-lg border-2 shrink-0 flex items-center justify-center ${sel ? 'bg-amber-500 border-amber-500 text-white' : dk ? 'border-slate-600' : 'border-slate-300'}`}>
            {sel && <Check size={10} strokeWidth={3}/>}
          </div>
          {product.photoUrl
            ? <img src={product.photoUrl} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0"/>
            : <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${dk ? 'bg-slate-800' : 'bg-slate-100'}`}><Package size={16} className="text-slate-400"/></div>}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400">{product.reference}</p>
            <p className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-800'}`}>{product.name}</p>
            <p className="text-[10px] text-slate-400">{product.variations.length} variação(ões)</p>
          </div>
          <p className="text-sm font-black text-amber-600 dark:text-amber-400 shrink-0">{fmtMoney(product.salePrice)}</p>
        </button>
      );
    });
  };

  const filterBtns = () => {
    if (activeSection === 'os') return [['all','Todos'],['open','Em aberto'],['done','Concluídas']].map(([v,l]) => (
      <button key={v} type="button" onClick={()=>setOsFilter(v as any)}
        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${osFilter===v?'bg-rose-600 text-white':'text-slate-400'}`}>{l}</button>
    ));
    if (activeSection === 'lots') return [['all','Todos'],['active','Em prod.'],['done','Finalizados']].map(([v,l]) => (
      <button key={v} type="button" onClick={()=>setLotFilter(v as any)}
        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${lotFilter===v?'bg-violet-600 text-white':'text-slate-400'}`}>{l}</button>
    ));
    if (activeSection === 'sales') return [['all','Todos'],['quote','Orçamentos'],['sale','Vendas'],['cancelled','Cancelados']].map(([v,l]) => (
      <button key={v} type="button" onClick={()=>setSaleFilter(v as any)}
        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${saleFilter===v?'bg-indigo-600 text-white':'text-slate-400'}`}>{l}</button>
    ));
    if (activeSection === 'purchases') return [['all','Todos'],['replenishment','Reposição'],['general','Geral']].map(([v,l]) => (
      <button key={v} type="button" onClick={()=>setPurchaseFilter(v as any)}
        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${purchaseFilter===v?'bg-teal-600 text-white':'text-slate-400'}`}>{l}</button>
    ));
    return null;
  };

  const rows = activeSection === 'labels' ? [] : renderRows();

  // ── Layout editor view ────────────────────────────────────────────────────

  const EditorView = () => (
    <div className="flex flex-col gap-4 py-2 overflow-y-auto flex-1 px-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase tracking-widest ${sec.accent}`}>Editor — {sec.label}</span>
        <button type="button" onClick={handleReset} className="flex items-center gap-1 text-[9px] font-black text-indigo-500 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
          <RotateCcw size={9}/> Resetar
        </button>
      </div>

      {/* Paper size selector */}
      {activeSection !== 'labels' && (
        <div className={`p-3 rounded-2xl border ${dk ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Tamanho do Papel</p>
          <div className="flex flex-wrap gap-1.5">
            {PAPER_PRESETS.map(p => {
              const active = layout.paper[0] === p.dims[0] && layout.paper[1] === p.dims[1];
              return (
                <button key={p.key} type="button" onClick={() => changePaper(p)}
                  className={`px-3 py-1.5 rounded-xl border-2 text-[9px] font-black tracking-tight transition-all flex items-center gap-1 ${active ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : dk ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-400'}`}>
                  {p.label}
                  {p.thermal && <span className="text-[7px] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1 py-0.5 rounded-full">térmica</span>}
                  {p.star && <span className="text-[7px] text-amber-500">★</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[8px] font-black text-slate-400 uppercase">Atual:</span>
            <span className="text-[9px] font-black text-indigo-600">{W}×{H} mm • {layout.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</span>
            <button type="button" onClick={() => {
              saveLayout(activeSection, { ...layout, orientation: layout.orientation === 'portrait' ? 'landscape' : 'portrait', paper: [layout.paper[1], layout.paper[0]] as [number,number] });
              setSelectedElem(null);
            }} className="ml-auto text-[8px] font-black text-indigo-500 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
              Girar ↻
            </button>
          </div>
        </div>
      )}

      {/* Preview with rulers */}
      <div className={`rounded-2xl border-2 overflow-auto ${dk ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-100'}`}>
        <div style={{ minWidth: 'max-content' }}>
          <div style={{ display:'flex' }}>
            <div style={{ width:RULER, height:RULER, flexShrink:0, backgroundColor:dk?'#1e293b':'#f1f5f9', borderBottom:`1px solid ${dk?'#334155':'#cbd5e1'}`, borderRight:`1px solid ${dk?'#334155':'#cbd5e1'}` }}/>
            <Ruler axis="h" totalMm={W} scale={scale} isDark={dk}/>
          </div>
          <div style={{ display:'flex' }}>
            <Ruler axis="v" totalMm={H} scale={scale} isDark={dk}/>
            {/* Edit canvas */}
            <div style={{ position:'relative', width: W*scale, height: H*scale, backgroundColor:'#fff', flexShrink:0 }} onClick={()=>setSelectedElem(null)}>
              {elemKeys.map(key => {
                const el = layout.elems[key];
                if (!el.visible) return null;
                const isSel = selectedElem === key;
                return (
                  <div key={key} onClick={e=>{e.stopPropagation();setSelectedElem(key);}}
                    style={{ position:'absolute', left:el.x*scale, top:el.y*scale, width:el.w*scale, height:el.h*scale,
                      backgroundColor:el.color+'22', border:`${isSel?2:1}px ${isSel?'solid':'dashed'} ${el.color}`,
                      boxSizing:'border-box', cursor:'pointer', zIndex:isSel?10:1,
                      display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                    <span style={{ fontSize:Math.max(5,6*scale), color:el.color, fontWeight:900, textAlign:'center', lineHeight:1 }}>{el.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Element visibility chips */}
      <div className="flex flex-wrap gap-1.5">
        {elemKeys.map(key => {
          const el = layout.elems[key]; const isSel = selectedElem === key;
          return (
            <button key={key} type="button" onClick={()=>setSelectedElem(isSel?null:key)}
              className={`flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-xl border-2 text-[9px] font-black uppercase tracking-tight transition-all ${isSel?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600':'border-slate-100 dark:border-slate-800 text-slate-400'}`}
              style={isSel?{}:{borderColor:el.color+'70'}}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:el.color}}/>
              {el.label}
              <button type="button" aria-label={el.visible?'Ocultar':'Mostrar'} onClick={e=>{e.stopPropagation();updateElem(key,{visible:!el.visible});}}
                className="ml-1 p-0.5 rounded opacity-60 hover:opacity-100">
                {el.visible?<Eye size={9}/>:<EyeOff size={9}/>}
              </button>
            </button>
          );
        })}
      </div>

      {/* Controls for selected element */}
      {selectedElem && selElem && (
        <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${dk?'bg-slate-900 border-slate-800':'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase" style={{color:selElem.color}}>✎ {selElem.label}</span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-black text-slate-400 mr-1">Passo:</span>
              {STEPS.map(s=>(
                <button key={s} type="button" onClick={()=>setStep(s)}
                  className={`px-2 py-0.5 rounded-lg border text-[9px] font-black transition-all ${step===s?'border-indigo-500 bg-indigo-50 text-indigo-600':'border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Readout */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[['X',selElem.x],['Y',selElem.y],['L',selElem.w],['A',selElem.h]].map(([lbl,val])=>(
              <div key={lbl as string} className={`p-2 rounded-xl border ${dk?'bg-slate-800 border-slate-700':'bg-white border-slate-100'}`}>
                <span className="block text-[8px] font-black text-slate-400 uppercase">{lbl}</span>
                <span className={`block text-[10px] font-black ${dk?'text-slate-200':'text-slate-700'}`}>{(val as number).toFixed(1)}</span>
              </div>
            ))}
          </div>

          {/* D-pad + resize */}
          <div className="flex gap-4 items-center justify-center">
            <div className="grid grid-cols-3 gap-1.5">
              <div/><button aria-label="Mover para cima" type="button" onClick={()=>moveElem(selectedElem,0,-step)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center active:scale-90"><ChevronUp size={18}/></button><div/>
              <button aria-label="Mover para esquerda" type="button" onClick={()=>moveElem(selectedElem,-step,0)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center active:scale-90"><ChevronLeft size={18}/></button>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dk?'bg-slate-800':'bg-slate-200'}`}><div className="w-2.5 h-2.5 rounded-full bg-indigo-400"/></div>
              <button aria-label="Mover para direita" type="button" onClick={()=>moveElem(selectedElem,step,0)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center active:scale-90"><ChevronRight size={18}/></button>
              <div/><button aria-label="Mover para baixo" type="button" onClick={()=>moveElem(selectedElem,0,step)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center active:scale-90"><ChevronDown size={18}/></button><div/>
            </div>
            <div className="flex flex-col gap-2">
              {([['Largura',selElem.w,(d:number)=>resizeElem(selectedElem,d,0)],['Altura',selElem.h,(d:number)=>resizeElem(selectedElem,0,d)]] as const).map(([lbl,val,fn])=>(
                <div key={lbl} className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black text-slate-400 w-11 uppercase">{lbl}</span>
                  <button aria-label={`Diminuir ${lbl}`} type="button" onClick={()=>fn(-step)} className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Minus size={11}/></button>
                  <span className={`w-12 text-center text-[9px] font-black ${dk?'text-slate-200':'text-slate-700'}`}>{(val as number).toFixed(1)}</span>
                  <button aria-label={`Aumentar ${lbl}`} type="button" onClick={()=>fn(step)} className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Plus size={11}/></button>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className={`pt-3 border-t flex flex-col gap-3 ${dk?'border-slate-800':'border-slate-100'}`}>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipografia</span>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-slate-400 w-10 uppercase shrink-0">Fonte</span>
              <div className="flex gap-1.5 flex-1">
                {(['helvetica','times','courier'] as FontFamily[]).map(f=>(
                  <button key={f} type="button" onClick={()=>updateElem(selectedElem,{fontFamily:f})}
                    className={`flex-1 py-1.5 rounded-xl border text-[9px] font-black transition-all ${(selElem.fontFamily===f||(!selElem.fontFamily&&f==='helvetica'))?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600':'border-slate-200 dark:border-slate-700 text-slate-400'}`}
                    style={{fontFamily:f==='helvetica'?'Arial':f==='times'?'Georgia':'monospace'}}>
                    {f==='helvetica'?'Sans':f==='times'?'Serif':'Mono'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-slate-400 w-10 uppercase shrink-0">Tam.</span>
              <button aria-label="Diminuir fonte" type="button" onClick={()=>updateElem(selectedElem,{fontSize:Math.max(3,(selElem.fontSize||8)-0.5)})} className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Minus size={11}/></button>
              <span className={`w-12 text-center text-[9px] font-black ${dk?'text-slate-200':'text-slate-700'}`}>{(selElem.fontSize||8).toFixed(1)} pt</span>
              <button aria-label="Aumentar fonte" type="button" onClick={()=>updateElem(selectedElem,{fontSize:(selElem.fontSize||8)+0.5})} className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk?'bg-slate-700 text-slate-300':'bg-slate-200 text-slate-600'} active:scale-90`}><Plus size={11}/></button>
              <button aria-label="Negrito" type="button" onClick={()=>updateElem(selectedElem,{bold:!selElem.bold})}
                className={`w-9 h-7 rounded-xl border text-[11px] font-black transition-all ml-1 ${selElem.bold?'border-indigo-500 bg-indigo-600 text-white':'border-slate-200 dark:border-slate-700 text-slate-400'}`}>B</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <div className={`flex flex-col h-full overflow-hidden ${dk?'bg-slate-950':'bg-slate-50'}`}>

      {/* ── Section tabs (2×3 grid, no horizontal scroll) ── */}
      <div className={`px-4 pt-3 pb-0 border-b ${dk?'border-slate-800 bg-slate-900':'border-slate-100 bg-white'}`}>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {SECTIONS.map(s => (
            <button key={s.id} type="button"
              onClick={() => { setActiveSection(s.id); setSearch(''); setSelectedElem(null); if(view==='editor') setView('list'); }}
              className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl border-2 font-black text-[9px] uppercase tracking-widest transition-all ${
                activeSection === s.id
                  ? `${s.accentBg} border-transparent text-white shadow-md`
                  : dk ? 'border-slate-800 text-slate-500 bg-slate-900' : 'border-slate-100 text-slate-400 bg-white'
              }`}>
              <span className={activeSection === s.id ? 'text-white' : s.accent}>{s.icon}</span>
              {s.shortLabel}
            </button>
          ))}
        </div>

        {/* View toggle — hidden for labels section */}
        {activeSection !== 'labels' && (
          <div className={`flex p-1 rounded-2xl gap-1 mb-3 ${dk?'bg-slate-800':'bg-slate-100'}`}>
            {([['list','Lista',<FileText size={11}/>],['editor','Ajustar Impressão',<Settings2 size={11}/>]] as const).map(([v,l,icon])=>(
              <button key={v} type="button" onClick={()=>{setView(v as any);setSelectedElem(null);}}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${view===v?'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm':'text-slate-400'}`}>
                {icon}{l}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeSection === 'labels' ? (
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {renderLabelsPanel()}
        </div>
      ) : view === 'editor' ? (
        <EditorView/>
      ) : (
        <>
          {/* Search + filters */}
          <div className={`px-4 py-3 flex flex-col gap-2 border-b ${dk?'border-slate-800':'border-slate-100'}`}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Buscar em ${sec.label}…`}
                className={`w-full py-2.5 pl-9 pr-8 rounded-2xl border text-sm outline-none ${dk?'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500':'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}/>
              {search && <button aria-label="Limpar busca" type="button" onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={13}/></button>}
            </div>
            <div className={`flex gap-0.5 p-1 rounded-2xl ${dk?'bg-slate-800':'bg-slate-100'}`}>
              {filterBtns()}
            </div>
          </div>

          {/* Select all / count toolbar */}
          <div className={`px-4 py-2 flex items-center justify-between border-b ${dk?'border-slate-800':'border-slate-100'}`}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={selectAll} className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${sec.accent} ${dk?'border-slate-700':'border-slate-200'}`}>Todos</button>
              {cnt > 0 && <button type="button" onClick={clearSel} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border text-slate-400 border-slate-200 dark:border-slate-700">Limpar</button>}
              {cnt > 0 && onDeleteItems && (
                <button type="button" onClick={() => {
                  if (confirm(`Deseja apagar ${cnt} item(ns) selecionado(s)?`)) {
                    let ids: string[] = [];
                    if (activeSection === 'os') ids = Array.from(selOS);
                    else if (activeSection === 'lots') ids = Array.from(selLots);
                    else if (activeSection === 'sales') ids = Array.from(selSales);
                    else if (activeSection === 'purchases') ids = Array.from(selPurchases);
                    else if (activeSection === 'products') ids = Array.from(selProducts);
                    if (ids.length > 0) {
                      onDeleteItems(activeSection, ids);
                      clearSel();
                    }
                  }
                }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20">
                  Apagar
                </button>
              )}
            </div>
            <span className={`text-[9px] font-black uppercase ${cnt>0?sec.accent:'text-slate-400'}`}>
              {cnt > 0 ? `${cnt} sel.` : `${rows.length} reg.`}
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
            {rows.length === 0
              ? <div className={`flex flex-col items-center justify-center py-16 gap-3 rounded-3xl border-2 border-dashed ${dk?'border-slate-800 text-slate-600':'border-slate-200 text-slate-400'}`}>
                  <AlertCircle size={28} className="opacity-30"/>
                  <p className="text-xs font-black uppercase tracking-widest opacity-50">Nenhum registro</p>
                </div>
              : rows}
          </div>

        </>
      )}

      {/* ── Print bar — always visible at bottom ── */}
      <div className={`px-4 py-4 border-t shrink-0 ${dk?'border-slate-800 bg-slate-900':'border-slate-100 bg-white'}`}>
        <button type="button" onClick={handlePrint} disabled={printing || cnt === 0}
          className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-40 ${cnt>0?'bg-indigo-600 text-white shadow-indigo-500/20':dk?'bg-slate-800 text-slate-500':'bg-slate-100 text-slate-400'}`}>
          <Printer size={18}/>
          {printing ? 'Exportando…'
            : cnt > 0 ? `Exportar ${cnt} ${sec.shortLabel}`
            : activeSection === 'labels' ? 'Selecione um produto acima'
            : 'Selecione itens para exportar'}
        </button>
      </div>

      {/* ── Export modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-[2rem] p-6 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${dk ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className={`text-base font-black uppercase tracking-tight ${dk?'text-white':'text-slate-900'}`}>Exportar</h3>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${sec.accent}`}>{cnt} {sec.label} selecionado(s)</p>
              </div>
              <button type="button" title="Fechar" aria-label="Fechar modal de exportação" onClick={() => setShowExportModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button>
            </div>

            {/* PDF */}
            <button type="button" onClick={() => doExport('pdf')}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${dk?'border-indigo-700/50 bg-indigo-900/20 hover:bg-indigo-900/40':'border-indigo-100 bg-indigo-50 hover:bg-indigo-100'}`}>
              <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <FileText size={20} className="text-white"/>
              </div>
              <div>
                <p className={`text-sm font-black ${dk?'text-white':'text-slate-900'}`}>Documento PDF</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Gerar e compartilhar PDF formatado</p>
              </div>
            </button>

            {/* JPG */}
            <button type="button" onClick={() => doExport('jpg')}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${dk?'border-emerald-700/50 bg-emerald-900/20 hover:bg-emerald-900/40':'border-emerald-100 bg-emerald-50 hover:bg-emerald-100'}`}>
              <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                <Image size={20} className="text-white"/>
              </div>
              <div>
                <p className={`text-sm font-black ${dk?'text-white':'text-slate-900'}`}>Imagem JPG</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Exportar como cards visuais em imagem</p>
              </div>
            </button>

            {/* Etiqueta Térmica */}
            <button type="button" onClick={() => doExport('thermal')}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${dk?'border-amber-700/50 bg-amber-900/20 hover:bg-amber-900/40':'border-amber-100 bg-amber-50 hover:bg-amber-100'}`}>
              <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                <Thermometer size={20} className="text-white"/>
              </div>
              <div>
                <p className={`text-sm font-black ${dk?'text-white':'text-slate-900'}`}>Etiqueta Térmica</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Imprimir em impressora térmica</p>
              </div>
            </button>

            <button type="button" onClick={() => setShowExportModal(false)}
              className={`w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${dk?'bg-slate-800 text-slate-400':'bg-slate-100 text-slate-500'}`}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── PrintLabelEditorModal — abre quando produto selecionado em Etiquetas ── */}
      {labelModalOpen && labelProductId && (() => {
        const prod = (products || []).find(p => p.id === labelProductId);
        if (!prod) return null;
        return (
          <PrintLabelEditorModal
            isOpen={labelModalOpen}
            onClose={() => setLabelModalOpen(false)}
            product={prod}
            isDarkMode={isDarkMode}
            sectors={sectors}
          />
        );
      })()}

      {/* ── PrintOSModal — abre quando 1 OS é selecionada em OS ── */}
      {osModalOpen && selOS.size === 1 && (() => {
        const osId = Array.from(selOS)[0];
        const os = serviceOrders.find(o => o.id === osId);
        if (!os) return null;
        const curSectorIdx = os.currentSectorIndex || 0;
        const nextSectorId = os.route?.[curSectorIdx + 1];
        const nextSectorName = sectors.find(s => s.id === nextSectorId)?.name || 'Fim';
        return (
          <PrintOSModal
            isOpen={osModalOpen}
            onClose={() => setOsModalOpen(false)}
            os={os}
            nextSectorName={nextSectorName}
            isDarkMode={isDarkMode}
            product={products.find(p => p.id === os.productId)}
          />
        );
      })()}
    </div>
  );
}
