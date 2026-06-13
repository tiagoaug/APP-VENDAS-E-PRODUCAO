import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';
import { formatCurrency } from './numbers';
import type { AIProviderServiceReportData, AIProviderServiceOrderItem } from '../services/aiService';

export const exportProviderServiceReport = async (
  data: AIProviderServiceReportData,
  formatType: 'pdf' | 'jpg',
  filename: string
) => {
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

const formatPeriod = (data: AIProviderServiceReportData): string => {
  if (data.fromDate && data.toDate) {
    return `${format(new Date(`${data.fromDate}T00:00:00`), 'dd/MM/yyyy')} – ${format(new Date(`${data.toDate}T00:00:00`), 'dd/MM/yyyy')}`;
  }
  if (data.fromDate) return `A partir de ${format(new Date(`${data.fromDate}T00:00:00`), 'dd/MM/yyyy')}`;
  if (data.toDate) return `Até ${format(new Date(`${data.toDate}T00:00:00`), 'dd/MM/yyyy')}`;
  return 'Todo o período';
};

const statusLabel = (s: 'PENDING' | 'COMPLETED') => (s === 'COMPLETED' ? 'Concluída' : 'Pendente');
const paymentLabel = (s: 'PENDING' | 'COMPLETED') => (s === 'COMPLETED' ? 'Pago' : 'Pendente');

const itemLine = (item: AIProviderServiceOrderItem): string => {
  const parts = [item.productName];
  if (item.colorName) parts.push(item.colorName);
  let line = parts.join(' • ');
  if (item.reference) line += ` — Ref: ${item.reference}`;
  line += ` — ${item.quantity} pares`;
  return line;
};

async function generatePDF(data: AIProviderServiceReportData, filename: string) {
  const { providerName, orders, totalPairs, totalAmount, totalPaid, totalPending } = data;
  const period = formatPeriod(data);
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  // Header Banner
  doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Relatório de Serviços Terceirizados', 105, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${providerName} · ${period}`, 105, 25, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 33, { align: 'center' });

  const MARGIN = 20;
  const CONTENT_W = 210 - MARGIN * 2;
  const pageH = doc.internal.pageSize.getHeight();
  const BOTTOM_MARGIN = 25;

  // Totals box
  let y = 50;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 3, 3, 'F');

  const colW = CONTENT_W / 4;
  const totalsCols: [string, string][] = [
    ['PARES', `${totalPairs}`],
    ['TOTAL', `R$ ${formatCurrency(totalAmount)}`],
    ['PAGO', `R$ ${formatCurrency(totalPaid)}`],
    ['PENDENTE', `R$ ${formatCurrency(totalPending)}`],
  ];
  totalsCols.forEach(([label, value], idx) => {
    const cx = MARGIN + colW * idx + colW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(LABEL_COLOR[0], LABEL_COLOR[1], LABEL_COLOR[2]);
    doc.text(label, cx, y + 8, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
    doc.text(value, cx, y + 17, { align: 'center' });
  });

  y += 32;

  orders.forEach((os) => {
    const itemLines = os.items.map(itemLine);
    const cardH = 14 + itemLines.length * 6 + 4;

    if (y + cardH > pageH - BOTTOM_MARGIN) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2.5, 2.5, 'F');
    doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
    doc.roundedRect(MARGIN, y, 2.5, cardH, 1.2, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
    doc.text(`OS-${os.osNumber} • ${os.sectorName} • ${statusLabel(os.status)} • ${paymentLabel(os.paymentStatus)}`, MARGIN + 6, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
    doc.text(
      `R$ ${formatCurrency(os.totalValue)} (${os.quantity} x R$ ${formatCurrency(os.valuePerPair)})`,
      MARGIN + CONTENT_W - 6,
      y + 8,
      { align: 'right' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(LABEL_COLOR[0], LABEL_COLOR[1], LABEL_COLOR[2]);
    itemLines.forEach((line, idx) => {
      doc.text(line, MARGIN + 6, y + 14 + idx * 6);
    });

    y += cardH + 5;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, 285, { align: 'center' });

  await sharePDF(doc, filename);
}

async function generateJPG(data: AIProviderServiceReportData, filename: string) {
  const { providerName, orders, totalPairs, totalAmount, totalPaid, totalPending } = data;
  const period = formatPeriod(data);

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
  mx.font = '500 11px Arial';

  const HEADER_H = 88, INFO_H = 70, CARD_PAD = 16, TITLE_H = 22, LINE_H = 16;
  const itemAvailW = W - pad * 2 - 28;

  const orderData = orders.map((os) => {
    const itemLines: string[] = [];
    os.items.forEach((item) => itemLines.push(...wrapText(mx, itemLine(item), itemAvailW)));
    const cardH = CARD_PAD + TITLE_H + itemLines.length * LINE_H + CARD_PAD / 2;
    return { os, itemLines, cardH };
  });

  const ordersH = orderData.reduce((a, o) => a + o.cardH + 8, 0);
  const totalH = HEADER_H + INFO_H + ordersH + 24;

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
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Relatório de Serviços Terceirizados', W / 2, y + 32);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${providerName} · ${period}`, W / 2, y + 56);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, W / 2, y + 75);
  y += HEADER_H;

  // ── Totals box ───────────────────────────────────────────────
  roundRectPath(ctx, pad, y + 10, W - pad * 2, INFO_H - 10, 16);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();

  const colW = (W - pad * 2) / 4;
  const totalsCols: [string, string][] = [
    ['PARES', `${totalPairs}`],
    ['TOTAL', `R$ ${formatCurrency(totalAmount)}`],
    ['PAGO', `R$ ${formatCurrency(totalPaid)}`],
    ['PENDENTE', `R$ ${formatCurrency(totalPending)}`],
  ];
  ctx.textAlign = 'center';
  totalsCols.forEach(([label, value], idx) => {
    const cx = pad + colW * idx + colW / 2;
    ctx.font = 'bold 9px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(label, cx, y + 32);
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(value, cx, y + 54);
  });
  y += INFO_H;

  // ── Order cards ──────────────────────────────────────────────
  orderData.forEach(({ os, itemLines, cardH }) => {
    roundRectPath(ctx, pad, y, W - pad * 2, cardH, 12);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    roundRectPath(ctx, pad, y, 4, cardH, 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = '700 12px Arial';
    ctx.fillStyle = '#334155';
    ctx.fillText(`OS-${os.osNumber} • ${os.sectorName} • ${statusLabel(os.status)} • ${paymentLabel(os.paymentStatus)}`, pad + 14, y + 18);

    ctx.textAlign = 'right';
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(
      `R$ ${formatCurrency(os.totalValue)} (${os.quantity} x R$ ${formatCurrency(os.valuePerPair)})`,
      W - pad - 14,
      y + 18
    );

    ctx.textAlign = 'left';
    ctx.font = '500 11px Arial';
    ctx.fillStyle = '#64748b';
    itemLines.forEach((line, idx) => {
      ctx.fillText(line, pad + 14, y + CARD_PAD + TITLE_H + idx * LINE_H);
    });

    y += cardH + 8;
  });

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}
