import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Purchase, Person, Product, PurchaseType } from '../types';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';

interface ExportData {
  purchase: Purchase;
  suppliers: Person[];
  products: Product[];
  additionalNote?: string;
  isDarkMode: boolean;
  showFinancialValues: boolean;
  /** Quando true, agrupa itens de mesma referência + cor (somando quantidades/caixas e total) */
  grouped?: boolean;
}

type ItemRow = {
  title: string;
  subtitle?: string;
  qtyLabel: string;
  unitValue?: number;
  lineTotal?: number;
  soleQuantities?: Record<string, number>;
};

const TYPE_LABELS: Record<string, string> = {
  [PurchaseType.REPLENISHMENT]: 'Abastecimento de Estoque',
  [PurchaseType.GENERAL]: 'Compra Geral',
  [PurchaseType.SOLE]: 'Compra de Solados',
};

function buildItemRows(purchase: Purchase, products: Product[], grouped = false): ItemRow[] {
  if (purchase.type === PurchaseType.GENERAL) {
    return (purchase.generalItems || []).map(item => ({
      title: item.description,
      qtyLabel: `${item.quantity ?? 1}${item.unit ? ` ${item.unit}` : ''}`,
      unitValue: item.value,
      lineTotal: (item.value || 0) * (item.quantity || 1),
    }));
  }

  if (purchase.type === PurchaseType.SOLE) {
    return (purchase.soleItems || []).map(raw => {
      const totalPairs = raw.totalPairs ?? Object.values(raw.quantities || {}).reduce((acc: number, q: any) => acc + (Number(q) || 0), 0);
      return {
        title: raw.moldName,
        subtitle: raw.colorName,
        qtyLabel: `${totalPairs} pares`,
        unitValue: raw.unitCost,
        lineTotal: raw.totalCost,
        soleQuantities: raw.quantities,
      };
    });
  }

  const items = purchase.items || [];

  // Agrupamento: soma quantidades (caixas/unidades) e total dos itens que compartilham
  // a mesma referência (produto) + mesma cor (variação) + mesma unidade (cx/un). Útil
  // após duplicar modelos — em vez de várias linhas iguais, mostra uma só com o total.
  if (grouped) {
    const map = new Map<string, { productId: string; variationId: string; isBox: boolean; quantity: number; lineTotal: number }>();
    for (const raw of items as any[]) {
      const key = `${raw.productId}::${raw.variationId}::${raw.isBox ? 'cx' : 'un'}`;
      const acc = map.get(key) || { productId: raw.productId, variationId: raw.variationId, isBox: !!raw.isBox, quantity: 0, lineTotal: 0 };
      acc.quantity += Number(raw.quantity) || 0;
      acc.lineTotal += (raw.cost || 0) * (Number(raw.quantity) || 0);
      map.set(key, acc);
    }
    return Array.from(map.values()).map(g => {
      const product = products.find(p => p.id === g.productId);
      const variation = product?.variations?.find(v => v.id === g.variationId);
      const ref = product?.reference ? `${product.reference} ` : '';
      return {
        title: `${ref}${product?.name || 'Produto não encontrado'}`,
        subtitle: variation?.colorName || undefined,
        qtyLabel: `${g.quantity} ${g.isBox ? 'cx' : 'un'}`,
        unitValue: g.quantity > 0 ? g.lineTotal / g.quantity : undefined,
        lineTotal: g.lineTotal,
      };
    });
  }

  return items.map((raw: any) => {
    const product = products.find(p => p.id === raw.productId);
    const variation = product?.variations?.find(v => v.id === raw.variationId);
    const ref = product?.reference ? `${product.reference} ` : '';
    return {
      title: `${ref}${product?.name || 'Produto não encontrado'}`,
      subtitle: [variation?.colorName, raw.size].filter(Boolean).join(' / ') || undefined,
      qtyLabel: `${raw.quantity} ${raw.isBox ? 'cx' : 'un'}`,
      unitValue: raw.cost,
      lineTotal: (raw.cost || 0) * (raw.quantity || 0),
    };
  });
}

export const exportPurchase = async (data: ExportData, formatType: 'pdf' | 'jpg') => {
  const { purchase, suppliers } = data;
  const supplier = suppliers.find(s => s.id === purchase.supplierId);
  const supplierFirstName = (supplier?.name || 'Fornecedor').split(' ')[0];
  const orderNumber = purchase.batchNumber || purchase.id.slice(-6).toUpperCase();
  const filename = `Compra_${orderNumber}_${supplierFirstName}`;

  try {
    if (formatType === 'pdf') {
      await generatePDF(data, filename, orderNumber);
    } else {
      await generateJPG(data, filename, orderNumber);
    }
  } catch (error) {
    console.error('Export error:', error);
    toast.show('Erro ao gerar arquivo. Por favor, tente novamente.');
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const HEADER_BG: [number, number, number] = [15, 23, 42];
const LABEL_COLOR: [number, number, number] = [100, 116, 139];
const TEXT_COLOR: [number, number, number] = [30, 41, 59];
const BLACK: [number, number, number] = [15, 23, 42];
const ROSE: [number, number, number] = [239, 68, 68];

// ── PDF ───────────────────────────────────────────────────────────────────────

async function generatePDF(data: ExportData, filename: string, orderNumber: string) {
  const { purchase, suppliers, products, additionalNote, showFinancialValues, grouped } = data;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const supplier = suppliers.find(s => s.id === purchase.supplierId);
  const rows = buildItemRows(purchase, products, grouped);
  const isSole = purchase.type === PurchaseType.SOLE;

  // Header Banner
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Relatório de Compra', 105, 18, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(TYPE_LABELS[purchase.type] || 'Compra', 105, 26, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Este documento não tem valor fiscal', 105, 33, { align: 'center' });

  // Info Section
  const infoY = 55;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Fornecedor:', 20, infoY);
  doc.setFont('helvetica', 'normal');
  const supplierName = supplier?.name || 'Não informado';
  const splitSupplier = doc.splitTextToSize(supplierName, 75);
  doc.text(splitSupplier, 50, infoY);
  doc.setFont('helvetica', 'bold');
  doc.text('Data:', 130, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(purchase.date), 'dd/MM/yyyy'), 150, infoY);

  const nextY = infoY + (splitSupplier.length * 5) + 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Pedido / Lote:', 20, nextY);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${orderNumber}`, 50, nextY);
  if (purchase.dueDate) {
    doc.setFont('helvetica', 'bold');
    doc.text('Vencimento:', 130, nextY);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(purchase.dueDate), 'dd/MM/yyyy'), 162, nextY);
  }

  const MARGIN = 20;
  const CONTENT_W = 210 - MARGIN * 2;
  let tableStartY = nextY + 15;

  if (isSole) {
    // ── Grade cells rendering for sole items ──
    const CELL_W = 22, CELL_H = 13, CELL_GAP = 2;
    const availW = CONTENT_W - 8;
    const cellsPerRow = Math.floor((availW + CELL_GAP) / (CELL_W + CELL_GAP));

    // Table header
    doc.setFillColor(241, 245, 249);
    doc.rect(MARGIN, tableStartY, CONTENT_W, 10, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...LABEL_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text('MODELO / COR — GRADE', MARGIN + 4, tableStartY + 7);
    if (showFinancialValues) doc.text('TOTAL', MARGIN + CONTENT_W - 4, tableStartY + 7, { align: 'right' });
    tableStartY += 13;

    const pageH = doc.internal.pageSize.getHeight();
    let y = tableStartY;

    rows.forEach(row => {
      const sizeEntries = Object.entries(row.soleQuantities || {}).filter(([, q]) => Number(q) > 0);
      const gridRows = Math.max(1, Math.ceil(sizeEntries.length / cellsPerRow));
      const gridH = gridRows * CELL_H + (gridRows - 1) * CELL_GAP;
      const cardH = 9 + gridH + (showFinancialValues ? 9 : 5);

      if (y + cardH > pageH - 20) { doc.addPage(); y = 20; }

      // Card background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'F');
      doc.setFillColor(...HEADER_BG);
      doc.roundedRect(MARGIN, y, 3, cardH, 1, 1, 'F');

      // Title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT_COLOR);
      doc.text(row.title, MARGIN + 6, y + 7);
      if (row.subtitle) {
        const titleW = doc.getTextWidth(row.title);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...LABEL_COLOR);
        doc.text(`• ${row.subtitle}`, MARGIN + 7 + titleW, y + 7);
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BLACK);
      doc.text(row.qtyLabel, MARGIN + CONTENT_W - 4, y + 7, { align: 'right' });

      // Grade cells
      const gridX = MARGIN + 6;
      const gridY = y + 10;
      sizeEntries.forEach(([size, qty], idx) => {
        const col = idx % cellsPerRow;
        const rowI = Math.floor(idx / cellsPerRow);
        const cx = gridX + col * (CELL_W + CELL_GAP);
        const cy = gridY + rowI * (CELL_H + CELL_GAP);

        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(cx, cy, CELL_W, CELL_H, 1.5, 1.5, 'FD');

        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...LABEL_COLOR);
        doc.text(size, cx + CELL_W / 2, cy + 4.5, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BLACK);
        doc.text(`${qty}`, cx + CELL_W / 2, cy + 11, { align: 'center' });
      });

      // Value
      if (showFinancialValues && row.lineTotal != null) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ROSE);
        doc.text(
          `R$ ${row.lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          MARGIN + CONTENT_W - 4, y + cardH - 2, { align: 'right' }
        );
      }

      y += cardH + 4;
    });

    // Financial Summary
    if (showFinancialValues) {
      if (y + 20 > pageH - 20) { doc.addPage(); y = 20; }
      doc.setDrawColor(200);
      doc.line(130, y + 6, 190, y + 6);
      doc.setTextColor(...HEADER_BG);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Total:', 130, y + 14);
      doc.text(`R$ ${purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, y + 14, { align: 'right' });
      y += 24;
    }

    // Observations
    if (additionalNote) {
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Observações:', MARGIN, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitNote = doc.splitTextToSize(additionalNote, CONTENT_W);
      doc.text(splitNote, MARGIN, y + 16);
    }

  } else {
    // ── Original autoTable rendering for non-sole types ──
    const head = showFinancialValues
      ? [['Item / Descrição', 'Qtd', 'Vlr. Unit.', 'Total']]
      : [['Item / Descrição', 'Qtd']];

    const tableData = rows.map(row => {
      const description = [row.title, row.subtitle].filter(Boolean).join('\n');
      const line: any[] = [
        { content: description, styles: { textColor: LABEL_COLOR } },
        { content: row.qtyLabel, styles: { halign: 'center' as const } },
      ];
      if (showFinancialValues) {
        line.push(
          row.unitValue != null ? `R$ ${row.unitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '---',
          row.lineTotal != null ? `R$ ${row.lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '---'
        );
      }
      return line;
    });

    autoTable(doc, {
      startY: tableStartY,
      head,
      body: tableData,
      theme: 'plain',
      headStyles: { fillColor: [248, 250, 252], textColor: LABEL_COLOR, fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, cellPadding: 4, textColor: TEXT_COLOR },
      columnStyles: showFinancialValues ? {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
      } : {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' }
      }
    });

    const tableFinalY = (doc as any).lastAutoTable.finalY + 10;

    if (showFinancialValues) {
      doc.setDrawColor(200);
      doc.line(130, tableFinalY, 190, tableFinalY);
      doc.setTextColor(...HEADER_BG);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Total:', 130, tableFinalY + 9);
      doc.text(`R$ ${purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY + 9, { align: 'right' });
    }

    if (additionalNote) {
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Observações:', 20, tableFinalY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitNote = doc.splitTextToSize(additionalNote, 90);
      doc.text(splitNote, 20, tableFinalY + 7);
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, 285, { align: 'center' });

  await sharePDF(doc, filename);
}

// ── JPG ───────────────────────────────────────────────────────────────────────

async function generateJPG(data: ExportData, filename: string, orderNumber: string) {
  const { purchase, suppliers, products, additionalNote, showFinancialValues, grouped } = data;
  const supplier = suppliers.find(s => s.id === purchase.supplierId);
  const rows = buildItemRows(purchase, products, grouped);
  const isSole = purchase.type === PurchaseType.SOLE;

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

  // Pre-calc canvas
  const mc = document.createElement('canvas');
  mc.width = W * S; mc.height = 10;
  const mx = mc.getContext('2d')!;
  mx.scale(S, S);

  const CELL_W = 58, CELL_H = 46, CELL_GAP = 8;
  const gridAvailW = W - pad * 2 - 24;
  const cellsPerRow = Math.max(1, Math.floor((gridAvailW + CELL_GAP) / (CELL_W + CELL_GAP)));

  const HEADER_H = 88, INFO_H = 76, TH_H = 38;
  const TOTALS_H = showFinancialValues ? 62 : 14;

  let itemsH = 0;

  const soleItemLayouts = isSole ? rows.map(row => {
    const sizeEntries = Object.entries(row.soleQuantities || {}).filter(([, q]) => Number(q) > 0);
    const gridRows = Math.max(1, Math.ceil(sizeEntries.length / cellsPerRow));
    const gridH = gridRows * CELL_H + (gridRows - 1) * CELL_GAP;
    const rowH = 16 + 8 + gridH + (showFinancialValues ? 30 : 12) + 8;
    itemsH += rowH;
    return { row, sizeEntries, rowH };
  }) : [];

  const VALUE_COL_W = showFinancialValues ? 120 : 0;
  const DESC_W = W - pad * 2 - VALUE_COL_W;

  const regularItemLayouts = !isSole ? rows.map(row => {
    const lines: { text: string; primary: boolean }[] = [];
    mx.font = '700 13px Arial';
    wrapText(mx, `${row.qtyLabel}   ·   ${row.title}`, DESC_W - 12).forEach(l => lines.push({ text: l, primary: true }));
    if (row.subtitle) {
      mx.font = '500 11px Arial';
      wrapText(mx, row.subtitle, DESC_W - 12).forEach(l => lines.push({ text: l, primary: false }));
    }
    const total = showFinancialValues
      ? `R$ ${(row.lineTotal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '';
    const rowH = Math.max(46, lines.length * 17 + 26);
    itemsH += rowH;
    return { lines, total, rowH };
  }) : [];

  const noteLines: string[] = [];
  if (additionalNote) {
    mx.font = '500 13px Arial';
    additionalNote.split('\n').forEach(l => noteLines.push(...wrapText(mx, l || ' ', W - pad * 2 - 28)));
  }

  const NOTES_H = noteLines.length ? 20 + noteLines.length * 19 + 24 : 0;
  const totalH = HEADER_H + INFO_H + TH_H + itemsH + TOTALS_H + NOTES_H + 28;

  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = totalH * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  let y = 0;

  // ── Header ──
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, y, W, HEADER_H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Sistema de Compras', W / 2, y + 36);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(TYPE_LABELS[purchase.type] || 'Relatório de Compra', W / 2, y + 58);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('Este documento não tem valor fiscal', W / 2, y + 75);
  y += HEADER_H;

  // ── Info box ──
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(pad, y + 10, W - pad * 2, INFO_H - 10);
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('FORNECEDOR', pad + 14, y + 26);
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(supplier?.name || 'Não informado', pad + 14, y + 46, (W - pad * 2) / 2 - 10);
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('PEDIDO / DATA', W - pad - 14, y + 26);
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`#${orderNumber}`, W - pad - 14, y + 46);
  ctx.font = '500 12px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText(format(new Date(purchase.date), 'dd/MM/yyyy'), W - pad - 14, y + 64);
  y += INFO_H;

  // ── Table header ──
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(pad, y, W - pad * 2, TH_H);
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText(isSole ? 'MODELO / COR — GRADE DE TAMANHOS' : 'ITEM / DESCRIÇÃO', pad + 12, y + TH_H / 2 + 4);
  if (showFinancialValues) {
    ctx.textAlign = 'right';
    ctx.fillText('TOTAL', W - pad - 12, y + TH_H / 2 + 4);
  }
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y + TH_H); ctx.lineTo(W - pad, y + TH_H); ctx.stroke();
  y += TH_H;

  if (isSole) {
    // ── Sole items with grade grid ──
    soleItemLayouts.forEach(({ row, sizeEntries, rowH }, i) => {
      if (i % 2 === 1) {
        roundRectPath(ctx, pad + 4, y + 4, W - pad * 2 - 8, rowH - 8, 12);
        ctx.fillStyle = '#fafafa';
        ctx.fill();
      }

      // Title + color badge
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(row.title, pad + 12, y + 18);
      if (row.subtitle) {
        const titleW = ctx.measureText(row.title).width;
        ctx.font = '600 12px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`• ${row.subtitle}`, pad + 14 + titleW, y + 18);
      }

      // Pairs count (right)
      ctx.textAlign = 'right';
      ctx.font = 'bold 13px Arial';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(row.qtyLabel, W - pad - 12, y + 18);

      // Grade cells
      const gridStartX = pad + 12;
      const gridStartY = y + 26;
      sizeEntries.forEach(([size, qty], idx) => {
        const col = idx % cellsPerRow;
        const rowIdx = Math.floor(idx / cellsPerRow);
        const cx = gridStartX + col * (CELL_W + CELL_GAP);
        const cy = gridStartY + rowIdx * (CELL_H + CELL_GAP);

        roundRectPath(ctx, cx + 0.5, cy + 0.5, CELL_W - 1, CELL_H - 1, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText(size, cx + CELL_W / 2, cy + 16);

        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`${qty}`, cx + CELL_W / 2, cy + 34);
      });

      // Value below grid
      if (showFinancialValues && row.lineTotal != null) {
        const gridH = Math.max(1, Math.ceil(sizeEntries.length / cellsPerRow)) * CELL_H
          + (Math.max(1, Math.ceil(sizeEntries.length / cellsPerRow)) - 1) * CELL_GAP;
        const valY = gridStartY + gridH + 18;
        ctx.textAlign = 'right';
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(
          `R$ ${(row.lineTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          W - pad - 12, valY
        );
      }

      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, y + rowH); ctx.lineTo(W - pad, y + rowH); ctx.stroke();
      y += rowH;
    });

  } else {
    // ── Regular items ──
    regularItemLayouts.forEach((item, i) => {
      if (i % 2 === 1) { ctx.fillStyle = '#fafafa'; ctx.fillRect(pad, y, W - pad * 2, item.rowH); }
      const tY = y + (item.rowH - (item.lines.length - 1) * 17) / 2;
      ctx.textAlign = 'left';
      item.lines.forEach((line, li) => {
        ctx.font = line.primary ? '700 13px Arial' : '500 11px Arial';
        ctx.fillStyle = line.primary ? '#334155' : '#94a3b8';
        ctx.fillText(line.text, pad + 12, tY + li * 17);
      });
      if (showFinancialValues) {
        ctx.font = 'bold 13px Arial'; ctx.fillStyle = '#0f172a'; ctx.textAlign = 'right';
        ctx.fillText(item.total, W - pad - 12, y + item.rowH / 2 + 5);
      }
      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, y + item.rowH); ctx.lineTo(W - pad, y + item.rowH); ctx.stroke();
      y += item.rowH;
    });
  }

  // ── Totals ──
  if (showFinancialValues) {
    y += 20;
    const tx = W - pad - 230;
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx, y - 4); ctx.lineTo(W - pad - 12, y - 4); ctx.stroke();
    ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left'; ctx.fillText('Total:', tx, y + 18);
    ctx.textAlign = 'right'; ctx.fillText(`R$ ${purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y + 18);
    y += 42;
  } else {
    y += 14;
  }

  // ── Notes ──
  if (noteLines.length) {
    const nbH = 20 + noteLines.length * 19 + 16;
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(pad, y, W - pad * 2, nbH);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(pad, y, 4, nbH);
    ctx.font = 'bold 9px Arial'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
    ctx.fillText('OBSERVAÇÕES', pad + 14, y + 15);
    ctx.font = '500 13px Arial'; ctx.fillStyle = '#334155';
    noteLines.forEach((line, i) => ctx.fillText(line, pad + 14, y + 30 + i * 19));
    y += nbH;
  }

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}
