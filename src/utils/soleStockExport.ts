import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';

export interface StockShareItem {
  moldName: string;
  colorName: string;
  sizes: { size: string; qty: number }[];
  total: number;
}

interface ExportData {
  items: StockShareItem[];
  observations?: string;
}

export const exportSoleStockReport = async (data: ExportData, formatType: 'pdf' | 'jpg', filename: string) => {
  try {
    if (formatType === 'pdf') {
      await generatePDF(data, filename);
    } else {
      await generateJPG(data, filename);
    }
  } catch (error) {
    console.error('Export error:', error);
    toast.show('Erro ao gerar arquivo. Por favor, tente novamente.');
  }
};

const HEADER_BG: [number, number, number] = [15, 23, 42]; // slate-900
const LABEL_COLOR: [number, number, number] = [100, 116, 139]; // slate-500
const TEXT_COLOR: [number, number, number] = [30, 41, 59]; // slate-800
const QTY_COLOR: [number, number, number] = [15, 23, 42]; // slate-900 (preto)
const ZERO_COLOR: [number, number, number] = [203, 213, 225]; // slate-300

async function generatePDF(data: ExportData, filename: string) {
  const { items, observations } = data;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  // Header Banner
  doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Relatório de Estoque de Solados', 105, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Central de Compartilhamento', 105, 26, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 33, { align: 'center' });

  const totalGeral = items.reduce((sum, i) => sum + i.total, 0);

  // Info section
  const infoY = 55;
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Itens listados:', 20, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${items.length}`, 55, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('Total de pares:', 130, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalGeral}`, 165, infoY);

  // ── Item cards, each with its complete size grade rendered as a grid ──
  const MARGIN = 20;
  const CONTENT_W = 210 - MARGIN * 2;
  const CELL_W = 24, CELL_H = 15, CELL_GAP = 3;
  const cellsPerRow = Math.max(1, Math.floor((CONTENT_W - 12 + CELL_GAP) / (CELL_W + CELL_GAP)));
  const pageH = doc.internal.pageSize.getHeight();
  const BOTTOM_MARGIN = 25;

  let y = infoY + 14;

  items.forEach(item => {
    const gridRows = Math.max(1, Math.ceil(item.sizes.length / cellsPerRow));
    const gridH = gridRows * CELL_H + (gridRows - 1) * CELL_GAP;
    const cardH = 12 + gridH + 8;

    if (y + cardH > pageH - BOTTOM_MARGIN) {
      doc.addPage();
      y = 20;
    }

    // Card background + accent bar
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2.5, 2.5, 'F');
    doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
    doc.roundedRect(MARGIN, y, 2.5, cardH, 1.2, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
    doc.text(`${item.moldName} • ${item.colorName}`, MARGIN + 6, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
    doc.text(`${item.total} pares`, MARGIN + CONTENT_W - 6, y + 8, { align: 'right' });

    // Grade grid
    const gridX = MARGIN + 6;
    const gridY = y + 12;
    item.sizes.forEach((s, idx) => {
      const col = idx % cellsPerRow;
      const row = Math.floor(idx / cellsPerRow);
      const cx = gridX + col * (CELL_W + CELL_GAP);
      const cy = gridY + row * (CELL_H + CELL_GAP);

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cx, cy, CELL_W, CELL_H, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(LABEL_COLOR[0], LABEL_COLOR[1], LABEL_COLOR[2]);
      doc.text(s.size, cx + CELL_W / 2, cy + 5, { align: 'center' });

      doc.setFontSize(10);
      const c = s.qty > 0 ? QTY_COLOR : ZERO_COLOR;
      doc.setTextColor(c[0], c[1], c[2]);
      doc.text(`${s.qty}`, cx + CELL_W / 2, cy + 12, { align: 'center' });
    });

    y += cardH + 5;
  });

  // Observations
  if (observations) {
    if (y + 30 > pageH - BOTTOM_MARGIN) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Observações:', MARGIN, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitNote = doc.splitTextToSize(observations, CONTENT_W);
    doc.text(splitNote, MARGIN, y + 15);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, 285, { align: 'center' });

  await sharePDF(doc, filename);
}

async function generateJPG(data: ExportData, filename: string) {
  const { items, observations } = data;

  const W = 600;
  const S = 2;
  const pad = 24;

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  };

  // Helper: draw a rounded-rectangle path (for a softer, modern card/cell look)
  const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };

  const mc = document.createElement('canvas');
  mc.width = W * S; mc.height = 10;
  const mx = mc.getContext('2d')!;
  mx.scale(S, S);

  const totalGeral = items.reduce((sum, i) => sum + i.total, 0);

  // ── Pre-compute grade grid layout for each item ──
  const CELL_W = 58, CELL_H = 44, CELL_GAP = 8;
  const TITLE_H = 30, CARD_PAD = 16;
  const gridAvailW = W - pad * 2 - 24;
  const cellsPerRow = Math.max(1, Math.floor((gridAvailW + CELL_GAP) / (CELL_W + CELL_GAP)));

  const itemData = items.map(item => {
    const gridRows = Math.max(1, Math.ceil(item.sizes.length / cellsPerRow));
    const gridH = gridRows * CELL_H + (gridRows - 1) * CELL_GAP;
    const rowH = CARD_PAD + TITLE_H + gridH + CARD_PAD;
    return { item, rowH };
  });

  const noteLines: string[] = [];
  if (observations) {
    mx.font = '500 13px Arial';
    observations.split('\n').forEach(l => noteLines.push(...wrapText(mx, l || ' ', W - pad * 2 - 28)));
  }

  const HEADER_H = 88, INFO_H = 60, TH_H = 38;
  const itemsH = itemData.reduce((a, i) => a + i.rowH, 0);
  const TOTALS_H = 14;
  const NOTES_H = noteLines.length ? 20 + noteLines.length * 19 + 24 : 0;
  const totalH = HEADER_H + INFO_H + TH_H + itemsH + TOTALS_H + NOTES_H + 28;

  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = totalH * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  let y = 0;

  // ── Header ──────────────────────────────────────────────────
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, y, W, HEADER_H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Estoque de Solados', W / 2, y + 36);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Central de Compartilhamento', W / 2, y + 58);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, W / 2, y + 75);
  y += HEADER_H;

  // ── Info box ─────────────────────────────────────────────────
  roundRectPath(ctx, pad, y + 10, W - pad * 2, INFO_H - 10, 16);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('ITENS LISTADOS', pad + 14, y + 26);
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`${items.length}`, pad + 14, y + 46);
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('TOTAL DE PARES', W - pad - 14, y + 26);
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`${totalGeral}`, W - pad - 14, y + 46);
  y += INFO_H;

  // ── Table header ─────────────────────────────────────────────
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(pad, y, W - pad * 2, TH_H);
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('MODELO / COR — GRADE COMPLETA', pad + 12, y + TH_H / 2 + 4);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL', W - pad - 12, y + TH_H / 2 + 4);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y + TH_H); ctx.lineTo(W - pad, y + TH_H); ctx.stroke();
  y += TH_H;

  // ── Item cards with grade grids ──────────────────────────────
  itemData.forEach(({ item, rowH }, i) => {
    if (i % 2 === 1) {
      roundRectPath(ctx, pad + 4, y + 4, W - pad * 2 - 8, rowH - 8, 14);
      ctx.fillStyle = '#fafafa';
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.font = '700 14px Arial';
    ctx.fillStyle = '#334155';
    ctx.fillText(`${item.moldName} • ${item.colorName}`, pad + 12, y + CARD_PAD + 8);

    ctx.textAlign = 'right';
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${item.total} pares`, W - pad - 12, y + CARD_PAD + 8);

    const gridStartX = pad + 12;
    const gridStartY = y + CARD_PAD + TITLE_H;
    item.sizes.forEach((s, idx) => {
      const col = idx % cellsPerRow;
      const row = Math.floor(idx / cellsPerRow);
      const cx = gridStartX + col * (CELL_W + CELL_GAP);
      const cy = gridStartY + row * (CELL_H + CELL_GAP);

      roundRectPath(ctx, cx + 0.5, cy + 0.5, CELL_W - 1, CELL_H - 1, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = 'bold 9px Arial';
      ctx.fillStyle = '#64748b';
      ctx.fillText(s.size, cx + CELL_W / 2, cy + 17);

      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = s.qty > 0 ? '#0f172a' : '#cbd5e1';
      ctx.fillText(`${s.qty}`, cx + CELL_W / 2, cy + 35);
    });

    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y + rowH); ctx.lineTo(W - pad, y + rowH); ctx.stroke();
    y += rowH;
  });

  y += TOTALS_H;

  // ── Notes ────────────────────────────────────────────────────
  if (noteLines.length) {
    const nbH = 20 + noteLines.length * 19 + 16;
    roundRectPath(ctx, pad, y, W - pad * 2, nbH, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    roundRectPath(ctx, pad, y, 5, nbH, 2.5);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.font = 'bold 9px Arial'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('OBSERVAÇÕES', pad + 14, y + 15);
    ctx.font = '500 13px Arial'; ctx.fillStyle = '#334155';
    noteLines.forEach((line, i) => ctx.fillText(line, pad + 14, y + 30 + i * 19));
    y += nbH;
  }

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}
