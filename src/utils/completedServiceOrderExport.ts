import jsPDF from 'jspdf';
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';
import { formatCurrency } from './numbers';
import { openPrintStudio } from '../lib/printStudio';

// Mesmo padrão visual/de cálculo já usado em serviceOrderReportExport.ts (relatório de OS
// por prestador, gerado pela IA) — generalizado aqui pra aceitar qualquer lista já
// filtrada (não só por prestador) e com um modo extra de agrupamento por período.

export interface CompletedOSExportItem {
  osNumber: string;
  sectorName: string;
  providerName: string;
  customerName: string;
  productName: string;
  variationName: string;
  quantity: number;
  valuePerPair: number;
  totalValue: number;
  finishedAt: number;
  paymentStatus: 'PENDING' | 'COMPLETED';
}

export interface CompletedOSExportData {
  title: string;
  periodLabel: string;
  groupBy: 'none' | 'day' | 'week' | 'month' | 'custom';
  items: CompletedOSExportItem[];
  /** Usado quando groupBy === 'custom' — define o intervalo único que forma o grupo */
  customRange?: { start: number; end: number };
}

const HEADER_BG: [number, number, number] = [15, 23, 42]; // slate-900
const LABEL_COLOR: [number, number, number] = [100, 116, 139]; // slate-500
const TEXT_COLOR: [number, number, number] = [30, 41, 59]; // slate-800

const paymentLabel = (s: 'PENDING' | 'COMPLETED') => (s === 'COMPLETED' ? 'Pago' : 'Pendente');

interface PeriodGroup {
  label: string;
  sortKey: number;
  count: number;
  totalPairs: number;
  totalValue: number;
  totalPaid: number;
  totalPending: number;
}

function groupByPeriod(items: CompletedOSExportItem[], groupBy: 'day' | 'week' | 'month' | 'custom', customRange?: { start: number; end: number }): PeriodGroup[] {
  if (groupBy === 'custom') {
    const start = customRange?.start ?? -Infinity;
    const end = customRange?.end ?? Infinity;
    const g: PeriodGroup = {
      label: customRange ? `${format(start, 'dd/MM/yyyy')} – ${format(end, 'dd/MM/yyyy')}` : 'Período Selecionado',
      sortKey: start, count: 0, totalPairs: 0, totalValue: 0, totalPaid: 0, totalPending: 0,
    };
    items.filter(item => item.finishedAt >= start && item.finishedAt <= end).forEach(item => {
      g.count += 1;
      g.totalPairs += item.quantity;
      g.totalValue += item.totalValue;
      if (item.paymentStatus === 'COMPLETED') g.totalPaid += item.totalValue;
      else g.totalPending += item.totalValue;
    });
    return [g];
  }

  const groups = new Map<string, PeriodGroup>();
  items.forEach(item => {
    const d = new Date(item.finishedAt);
    let key: string; let label: string; let sortKey: number;
    if (groupBy === 'day') {
      label = format(d, 'dd/MM/yyyy');
      key = label;
      sortKey = startOfDay(d).getTime();
    } else if (groupBy === 'week') {
      const start = startOfWeek(d, { weekStartsOn: 1 });
      label = `Semana de ${format(start, 'dd/MM/yyyy')}`;
      key = label;
      sortKey = start.getTime();
    } else {
      label = format(d, 'MM/yyyy');
      key = label;
      sortKey = startOfMonth(d).getTime();
    }
    let g = groups.get(key);
    if (!g) {
      g = { label, sortKey, count: 0, totalPairs: 0, totalValue: 0, totalPaid: 0, totalPending: 0 };
      groups.set(key, g);
    }
    g.count += 1;
    g.totalPairs += item.quantity;
    g.totalValue += item.totalValue;
    if (item.paymentStatus === 'COMPLETED') g.totalPaid += item.totalValue;
    else g.totalPending += item.totalValue;
  });
  return Array.from(groups.values()).sort((a, b) => b.sortKey - a.sortKey);
}

const itemLine = (item: CompletedOSExportItem): string => {
  const parts = [item.productName];
  if (item.variationName) parts.push(item.variationName);
  let line = parts.join(' • ');
  if (item.customerName) line += ` — ${item.customerName}`;
  line += ` — ${item.quantity} pares`;
  return line;
};

export const exportCompletedServiceOrders = async (
  data: CompletedOSExportData,
  formatType: 'pdf' | 'jpg',
  filename: string,
  previewOnly: boolean = false
): Promise<boolean | string[]> => {
  try {
    if (formatType === 'pdf') {
      return await generatePDF(data, filename, previewOnly);
    } else {
      return await generateJPG(data, filename, previewOnly);
    }
  } catch (error) {
    console.error('Completed OS export error:', error);
    toast.show('Erro ao gerar arquivo. Por favor, tente novamente.');
    return false;
  }
};

async function generatePDF(data: CompletedOSExportData, filename: string, previewOnly: boolean = false): Promise<boolean | string[]> {
  const { title, periodLabel, groupBy, items, customRange } = data;
  const totalPairs = items.reduce((a, i) => a + i.quantity, 0);
  const totalAmount = items.reduce((a, i) => a + i.totalValue, 0);
  const totalPaid = items.reduce((a, i) => a + (i.paymentStatus === 'COMPLETED' ? i.totalValue : 0), 0);
  const totalPending = totalAmount - totalPaid;

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(title, 105, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel, 105, 25, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 33, { align: 'center' });

  const MARGIN = 20;
  const CONTENT_W = 210 - MARGIN * 2;
  const pageH = doc.internal.pageSize.getHeight();
  const BOTTOM_MARGIN = 25;

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

  if (groupBy === 'none') {
    items.forEach((os) => {
      const lines = [itemLine(os)];
      const cardH = 14 + lines.length * 6 + 4;
      if (y + cardH > pageH - BOTTOM_MARGIN) { doc.addPage(); y = 20; }

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2.5, 2.5, 'F');
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.roundedRect(MARGIN, y, 2.5, cardH, 1.2, 1.2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      doc.text(`${os.osNumber} • ${os.sectorName} • ${os.providerName || '—'} • ${paymentLabel(os.paymentStatus)}`, MARGIN + 6, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.text(`R$ ${formatCurrency(os.totalValue)}`, MARGIN + CONTENT_W - 6, y + 8, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(LABEL_COLOR[0], LABEL_COLOR[1], LABEL_COLOR[2]);
      lines.forEach((line, idx) => doc.text(line, MARGIN + 6, y + 14 + idx * 6));

      y += cardH + 5;
    });
  } else {
    const groups = groupByPeriod(items, groupBy, customRange);
    groups.forEach((g) => {
      const cardH = 26;
      if (y + cardH > pageH - BOTTOM_MARGIN) { doc.addPage(); y = 20; }

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2.5, 2.5, 'F');
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.roundedRect(MARGIN, y, 2.5, cardH, 1.2, 1.2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      doc.text(g.label, MARGIN + 6, y + 9);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.text(`R$ ${formatCurrency(g.totalValue)}`, MARGIN + CONTENT_W - 6, y + 9, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(LABEL_COLOR[0], LABEL_COLOR[1], LABEL_COLOR[2]);
      doc.text(`${g.count} OS • ${g.totalPairs} pares • Pago R$ ${formatCurrency(g.totalPaid)} • Pendente R$ ${formatCurrency(g.totalPending)}`, MARGIN + 6, y + 18);

      y += cardH + 5;
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, 285, { align: 'center' });

  if (previewOnly) {
    return [doc.output('datauristring')];
  }
  await sharePDF(doc, filename);
  return true;
}

async function generateJPG(data: CompletedOSExportData, filename: string, previewOnly: boolean = false): Promise<boolean | string[]> {
  const { title, periodLabel, groupBy, items, customRange } = data;
  const totalPairs = items.reduce((a, i) => a + i.quantity, 0);
  const totalAmount = items.reduce((a, i) => a + i.totalValue, 0);
  const totalPaid = items.reduce((a, i) => a + (i.paymentStatus === 'COMPLETED' ? i.totalValue : 0), 0);
  const totalPending = totalAmount - totalPaid;

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
  const GROUP_CARD_H = 64;

  const orderData = groupBy === 'none'
    ? items.map((os) => {
      const lines = wrapText(mx, itemLine(os), itemAvailW);
      const cardH = CARD_PAD + TITLE_H + lines.length * LINE_H + CARD_PAD / 2;
      return { os, lines, cardH };
    })
    : [];
  const groups = groupBy !== 'none' ? groupByPeriod(items, groupBy, customRange) : [];

  const bodyH = groupBy === 'none'
    ? orderData.reduce((a, o) => a + o.cardH + 8, 0)
    : groups.reduce((a) => a + GROUP_CARD_H + 8, 0);
  const totalH = HEADER_H + INFO_H + bodyH + 24;

  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = totalH * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  let y = 0;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, y, W, HEADER_H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, W / 2, y + 32);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(periodLabel, W / 2, y + 56);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, W / 2, y + 75);
  y += HEADER_H;

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

  if (groupBy === 'none') {
    orderData.forEach(({ os, lines, cardH }) => {
      roundRectPath(ctx, pad, y, W - pad * 2, cardH, 12);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      roundRectPath(ctx, pad, y, 4, cardH, 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.font = '700 12px Arial';
      ctx.fillStyle = '#334155';
      ctx.fillText(`${os.osNumber} • ${os.sectorName} • ${os.providerName || '—'} • ${paymentLabel(os.paymentStatus)}`, pad + 14, y + 18);

      ctx.textAlign = 'right';
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`R$ ${formatCurrency(os.totalValue)}`, W - pad - 14, y + 18);

      ctx.textAlign = 'left';
      ctx.font = '500 11px Arial';
      ctx.fillStyle = '#64748b';
      lines.forEach((line, idx) => ctx.fillText(line, pad + 14, y + CARD_PAD + TITLE_H + idx * LINE_H));

      y += cardH + 8;
    });
  } else {
    groups.forEach((g) => {
      roundRectPath(ctx, pad, y, W - pad * 2, GROUP_CARD_H, 12);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      roundRectPath(ctx, pad, y, 4, GROUP_CARD_H, 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.font = '700 13px Arial';
      ctx.fillStyle = '#334155';
      ctx.fillText(g.label, pad + 14, y + 22);

      ctx.textAlign = 'right';
      ctx.font = 'bold 13px Arial';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`R$ ${formatCurrency(g.totalValue)}`, W - pad - 14, y + 22);

      ctx.textAlign = 'left';
      ctx.font = '500 11px Arial';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${g.count} OS • ${g.totalPairs} pares • Pago R$ ${formatCurrency(g.totalPaid)} • Pendente R$ ${formatCurrency(g.totalPending)}`, pad + 14, y + 44);

      y += GROUP_CARD_H + 8;
    });
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  if (previewOnly) {
    return [dataUrl];
  }
  await shareImage(dataUrl, filename);
  return true;
}

// Gera a mesma imagem JPG do relatório e abre o Print Studio já com ela carregada —
// mesmo padrão de sendPCPItemsToPrintStudio (pcpShareExport.ts): grava em arquivo via
// Filesystem antes de abrir, pra ponte JS↔nativo do Capacitor não receber o base64 bruto.
export async function sendCompletedOSToPrintStudio(data: CompletedOSExportData, filename: string): Promise<void> {
  if (data.items.length === 0) {
    toast.show('Nada para enviar ao Print Studio.');
    return;
  }
  try {
    const result = await generateJPG(data, filename, true);
    if (!Array.isArray(result) || result.length === 0) {
      toast.show('Não foi possível gerar a imagem.');
      return;
    }

    const uris: string[] = [];
    for (let i = 0; i < result.length; i++) {
      const dataUri = result[i];
      const base64 = dataUri.includes('base64,') ? dataUri.split('base64,')[1] : dataUri;
      const written = await Filesystem.writeFile({
        path: `printstudio_os_${Date.now()}_${i}.jpg`,
        data: base64,
        directory: Directory.Cache,
      });
      uris.push(written.uri);
    }

    await openPrintStudio(uris);
  } catch (error) {
    console.error('Error sending completed OS to Print Studio:', error);
    toast.show('Erro ao enviar para o Print Studio.');
  }
}
