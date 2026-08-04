import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { sharePDF, shareImage, shareImages } from './pdfExport';
import { toast } from './toast';

// Um item de "caixa" resolvido pra uma parada (via StockLot vinculado ao(s) pedido(s) da
// parada) — resumo de produto/cor/grade/pares, nunca o ID interno da caixa (código
// aleatório sem uso na impressão).
export interface DeliveryPrintBoxItem {
  productLabel: string; // "300 mule" (referência + nome)
  colorName: string;
  gradeLabel: string; // ex: "38x4-39x8-..."
  totalPairs: number;
  boxQty?: number;
  pkgName?: string;
}

export interface DeliveryPrintStopItem {
  stopNumber: number;
  customerName: string; // nome do cliente, ou label da parada manual
  addressLine: string; // endereço formatado numa linha
  priority: 'URGENT' | 'NORMAL';
  status: 'PENDING' | 'DELIVERED' | 'SKIPPED';
  orderNumbers: string[];
  carrierName?: string;
  note?: string;
  // Observações cadastradas no(s) PEDIDO(S) da parada (Sale.notes) — distintas de `note`
  // acima, que é a observação da PARADA (digitada pelo motorista na tela de entrega).
  orderNotes?: string[];
  boxes: DeliveryPrintBoxItem[];
}

export interface DeliveryPrintData {
  routeLabel: string; // ex: "Rota 03/08/2026"
  driverName?: string;
  statusLabel: string; // ex: "Em andamento", "Concluída", "Rascunho"
  stops: DeliveryPrintStopItem[];
  showOrders: boolean;
  showCustomers: boolean;
  // 'none' = não mostra produtos; 'summary' = uma linha por produto/cor com a contagem de
  // caixas (ex.: "300 Preto — 2 CX"); 'full' = tabela detalhada por caixa (produto, cor,
  // pares, caixas).
  boxesMode: 'none' | 'summary' | 'full';
  showSignatureField: boolean;
  // Desenha uma caixinha de checagem (quadrado vazio) ao lado do número de cada parada,
  // pra marcar manualmente à caneta conforme vai entregando.
  showCheckbox: boolean;
  // Quantas entregas (paradas) forçar por folha — 0 = automático (encaixa o máximo que
  // couber sem NUNCA cortar os dados de uma entrega entre duas folhas); N>0 = sempre N
  // paradas por folha, mesmo sobrando espaço em branco.
  stopsPerPage: number;
  pageSize: 'a4' | '100x150';
}

// Agrupa os itens de caixa de uma parada por produto+cor, somando a contagem de caixas —
// usado no modo "Resumido" (uma linha por produto/cor, ex.: "300 Preto — 2 CX").
function summarizeBoxes(boxes: DeliveryPrintBoxItem[]): { label: string; boxQty: number }[] {
  const map = new Map<string, { label: string; boxQty: number }>();
  boxes.forEach(b => {
    const key = `${b.productLabel}::${b.colorName}`;
    const entry = map.get(key) || { label: `${b.productLabel} ${b.colorName}`, boxQty: 0 };
    entry.boxQty += b.boxQty ?? 0;
    map.set(key, entry);
  });
  return Array.from(map.values());
}

// Agrupa `stops` em "folhas" sem NUNCA cortar uma entrega no meio entre duas folhas: no
// modo automático (stopsPerPage === 0), encaixa o máximo que couber no orçamento de altura
// de cada folha (medido por `measureHeight`) — se uma entrega sozinha já estourar o
// orçamento (ex.: parada com muitas caixas), ela ainda assim ocupa uma folha inteira pra
// si, nunca é partida. No modo fixo (stopsPerPage > 0), agrupa em blocos de exatamente N
// paradas por folha, independente do quanto sobra de espaço.
function paginateStops<T>(
  stops: T[],
  measureHeight: (s: T) => number,
  getPageBudget: (pageIndex: number) => number,
  stopsPerPage: number,
): T[][] {
  if (stops.length === 0) return [[]];
  if (stopsPerPage > 0) {
    const pages: T[][] = [];
    for (let i = 0; i < stops.length; i += stopsPerPage) pages.push(stops.slice(i, i + stopsPerPage));
    return pages;
  }
  const pages: T[][] = [];
  let current: T[] = [];
  let currentH = 0;
  let pageIdx = 0;
  let budget = getPageBudget(0);
  stops.forEach(s => {
    const hgt = measureHeight(s);
    if (current.length > 0 && currentH + hgt > budget) {
      pages.push(current);
      current = [];
      currentH = 0;
      pageIdx += 1;
      budget = getPageBudget(pageIdx);
    }
    current.push(s);
    currentH += hgt;
  });
  if (current.length > 0) pages.push(current);
  return pages;
}

const PAGE_DIMS: Record<'a4' | '100x150', { w: number; h: number; format: 'a4' | [number, number] }> = {
  a4: { w: 210, h: 297, format: 'a4' },
  '100x150': { w: 100, h: 150, format: [100, 150] },
};

export async function generateDeliveryPrintExport(
  data: DeliveryPrintData,
  formatType: 'pdf' | 'jpg',
  previewOnly: boolean = false,
): Promise<boolean | string[]> {
  try {
    const filename = `Rota_${data.routeLabel.replace(/[^a-zA-Z0-9]/g, '')}_${format(new Date(), 'yyyyMMdd_HHmm')}`;
    return formatType === 'pdf'
      ? await generatePDF(data, filename, previewOnly)
      : await generateJPG(data, filename, previewOnly);
  } catch (error) {
    console.error('Error generating delivery print export:', error);
    toast.error('Erro ao gerar exportação da rota');
    return false;
  }
}

async function generatePDF(data: DeliveryPrintData, filename: string, previewOnly: boolean): Promise<boolean | string[]> {
  const { w, h, format: pageFormat } = PAGE_DIMS[data.pageSize];
  const isA4 = data.pageSize === 'a4';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: pageFormat });
  const marginX = isA4 ? 14 : 8;
  const pageBottom = h - (isA4 ? 20 : 10);
  const titleSize = isA4 ? 22 : 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.text('GESTÃO PRO', marginX, marginX + 6);

  doc.setFontSize(isA4 ? 10 : 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('ROTEIRO DE ENTREGA', marginX, marginX + 12);

  doc.setFontSize(isA4 ? 9 : 7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60);
  const headerLine = [
    data.routeLabel,
    data.driverName ? `Motorista: ${data.driverName}` : null,
    `Status: ${data.statusLabel}`,
    `${data.stops.length} parada(s)`,
  ].filter(Boolean).join('  •  ');
  const headerLines = doc.splitTextToSize(headerLine, w - marginX * 2);
  doc.text(headerLines, marginX, marginX + 18);

  const firstStopStartY = marginX + 18 + headerLines.length * 4 + 4;
  doc.setLineWidth(0.6);
  doc.line(marginX, firstStopStartY, w - marginX, firstStopStartY);
  const contentStartY = firstStopStartY + (isA4 ? 8 : 5);

  // Grade de caixas (modo Completo) desenhada manualmente linha a linha (não via
  // jspdf-autotable) — dá altura EXATA e previsível, essencial pra paginação nunca cortar
  // uma entrega no meio: com autoTable a altura real só se sabe depois de já ter desenhado.
  const boxHeaderH = isA4 ? 6 : 4.5;
  const boxRowH = isA4 ? 5 : 4;

  const boxesBlockHeight = (stop: DeliveryPrintStopItem): number => {
    if (data.boxesMode === 'full' && stop.boxes.length > 0) {
      return boxHeaderH + stop.boxes.length * boxRowH + (isA4 ? 6 : 4);
    }
    if (data.boxesMode === 'summary' && stop.boxes.length > 0) {
      return summarizeBoxes(stop.boxes).length * (isA4 ? 4.5 : 3.6) + (isA4 ? 2 : 1.5);
    }
    return isA4 ? 4 : 3;
  };

  // Estima a altura TOTAL de uma entrega, em mm — espelha exatamente os incrementos de
  // `drawStop` abaixo, com +12% de folga: pequenas variações de fonte não valem a pena
  // perseguir com precisão milimétrica — melhor sobrar espaço em branco no fim da folha do
  // que arriscar cortar uma entrega.
  const measureStopHeightMm = (stop: DeliveryPrintStopItem): number => {
    let hgt = isA4 ? 5.5 : 4.2; // título
    const addressLines = doc.splitTextToSize(stop.addressLine, w - marginX * 2);
    hgt += addressLines.length * (isA4 ? 4.5 : 3.6) + 1.5;
    if (data.showOrders && stop.orderNumbers.length > 0) hgt += isA4 ? 5 : 3.8;
    if (stop.carrierName) hgt += isA4 ? 5 : 3.8;
    if (stop.note) {
      const noteLines = doc.splitTextToSize(`Obs: ${stop.note}`, w - marginX * 2);
      hgt += noteLines.length * (isA4 ? 4 : 3.2) + 1;
    }
    if (stop.orderNotes && stop.orderNotes.length > 0) {
      const orderNoteLines = doc.splitTextToSize(`Observações do Pedido: ${stop.orderNotes.join(' | ')}`, w - marginX * 2);
      hgt += orderNoteLines.length * (isA4 ? 4 : 3.2) + 1.5;
    }
    hgt += boxesBlockHeight(stop);
    if (data.showSignatureField) hgt += isA4 ? 13.5 : 10;
    hgt += isA4 ? 6 : 4; // divisor final
    return hgt * 1.12;
  };

  const pages = paginateStops(
    data.stops,
    measureStopHeightMm,
    (pageIdx) => (pageIdx === 0 ? pageBottom - contentStartY : pageBottom - marginX),
    data.stopsPerPage,
  );

  const drawStop = (stop: DeliveryPrintStopItem, yStart: number): number => {
    let currentY = yStart;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA4 ? 12 : 9.5);
    doc.setTextColor(0);
    let titleX = marginX;
    if (data.showCheckbox) {
      const boxSize = isA4 ? 4.5 : 3.5;
      doc.setDrawColor(0);
      doc.setLineWidth(0.4);
      doc.rect(marginX, currentY - boxSize + 1, boxSize, boxSize);
      titleX = marginX + boxSize + 3;
    }
    const stopTitle = `${stop.stopNumber}. ${stop.customerName}`;
    doc.text(stopTitle, titleX, currentY);
    if (stop.priority === 'URGENT') {
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(isA4 ? 8 : 6.5);
      doc.text('URGENTE', w - marginX, currentY, { align: 'right' });
      doc.setTextColor(0);
    }
    currentY += isA4 ? 5.5 : 4.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isA4 ? 9.5 : 7.5);
    doc.setTextColor(70);
    const addressLines = doc.splitTextToSize(stop.addressLine, w - marginX * 2);
    doc.text(addressLines, marginX, currentY);
    currentY += addressLines.length * (isA4 ? 4.5 : 3.6) + 1.5;

    if (data.showOrders && stop.orderNumbers.length > 0) {
      doc.setFontSize(isA4 ? 9 : 7);
      doc.setTextColor(40, 40, 120);
      doc.text(`Pedido(s): ${stop.orderNumbers.join(', ')}`, marginX, currentY);
      currentY += isA4 ? 5 : 3.8;
    }

    if (stop.carrierName) {
      doc.setFontSize(isA4 ? 9 : 7);
      doc.setTextColor(100);
      doc.text(`Transportadora: ${stop.carrierName}`, marginX, currentY);
      currentY += isA4 ? 5 : 3.8;
    }

    if (stop.note) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(isA4 ? 8.5 : 6.8);
      doc.setTextColor(120);
      const noteLines = doc.splitTextToSize(`Obs: ${stop.note}`, w - marginX * 2);
      doc.text(noteLines, marginX, currentY);
      currentY += noteLines.length * (isA4 ? 4 : 3.2) + 1;
      doc.setFont('helvetica', 'normal');
    }

    if (stop.orderNotes && stop.orderNotes.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA4 ? 8.5 : 6.8);
      doc.setTextColor(180, 83, 9);
      const orderNoteLines = doc.splitTextToSize(`Observações do Pedido: ${stop.orderNotes.join(' | ')}`, w - marginX * 2);
      doc.text(orderNoteLines, marginX, currentY);
      currentY += orderNoteLines.length * (isA4 ? 4 : 3.2) + 1.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
    }

    if (data.boxesMode === 'full' && stop.boxes.length > 0) {
      const tableW = w - marginX * 2;
      const colWs = [tableW * 0.4, tableW * 0.25, tableW * 0.17, tableW * 0.18];
      const colXs = [marginX, marginX + colWs[0], marginX + colWs[0] + colWs[1], marginX + colWs[0] + colWs[1] + colWs[2]];
      doc.setFillColor(240, 240, 240);
      doc.rect(marginX, currentY, tableW, boxHeaderH, 'F');
      doc.setDrawColor(180);
      doc.setLineWidth(0.2);
      doc.rect(marginX, currentY, tableW, boxHeaderH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA4 ? 8 : 6.5);
      doc.setTextColor(0);
      ['Produto', 'Cor', 'Pares', 'Cxs'].forEach((label, i) => doc.text(label, colXs[i] + 1.5, currentY + boxHeaderH - (isA4 ? 2 : 1.5)));
      currentY += boxHeaderH;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA4 ? 8.5 : 6.8);
      stop.boxes.forEach(b => {
        doc.rect(marginX, currentY, tableW, boxRowH);
        const cells = [b.productLabel, b.colorName, String(b.totalPairs), b.boxQty != null ? String(b.boxQty) : '—'];
        cells.forEach((cellText, i) => doc.text(cellText, colXs[i] + 1.5, currentY + boxRowH - (isA4 ? 1.6 : 1.2)));
        currentY += boxRowH;
      });
      currentY += isA4 ? 6 : 4;
    } else if (data.boxesMode === 'summary' && stop.boxes.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA4 ? 9 : 7);
      doc.setTextColor(0);
      summarizeBoxes(stop.boxes).forEach(s => {
        doc.text(`${s.label} — ${s.boxQty} CX`, marginX, currentY);
        currentY += isA4 ? 4.5 : 3.6;
      });
      doc.setFont('helvetica', 'normal');
      currentY += isA4 ? 2 : 1.5;
    } else {
      currentY += isA4 ? 4 : 3;
    }

    if (data.showSignatureField) {
      currentY += isA4 ? 6 : 4;
      const sigLineW = isA4 ? (w - marginX * 2) * 0.62 : (w - marginX * 2) * 0.6;
      doc.setDrawColor(150);
      doc.setLineWidth(0.3);
      doc.line(marginX, currentY, marginX + sigLineW, currentY);
      doc.line(marginX + sigLineW + 6, currentY, w - marginX, currentY);
      currentY += isA4 ? 3.5 : 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA4 ? 7.5 : 6);
      doc.setTextColor(120);
      doc.text('Assinatura do Recebedor', marginX, currentY);
      doc.text('Data', marginX + sigLineW + 6, currentY);
      doc.setTextColor(0);
      currentY += isA4 ? 4 : 3;
    }

    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY, w - marginX, currentY);
    currentY += isA4 ? 6 : 4;
    return currentY;
  };

  pages.forEach((pageStops, pageIdx) => {
    if (pageIdx > 0) {
      doc.addPage(pageFormat, 'portrait');
    }
    let currentY = pageIdx === 0 ? contentStartY : marginX;
    pageStops.forEach(stop => { currentY = drawStop(stop, currentY); });
  });

  doc.setFontSize(isA4 ? 8 : 6);
  doc.setTextColor(180);
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Página ${i} de ${pageCount}     Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, w / 2, h - (isA4 ? 8 : 4), { align: 'center' });
  }

  if (previewOnly) {
    return [doc.output('datauristring')];
  }
  await sharePDF(doc, filename);
  return true;
}

async function generateJPG(data: DeliveryPrintData, filename: string, previewOnly: boolean): Promise<boolean | string[]> {
  const W = 900;
  const pad = 40;
  const SCALE = 3;
  // Altura de folha FIXA, proporcional ao tamanho de papel escolhido (mesma lógica do
  // formato "Marketplace" 100x150 já usado no Central de Compartilhamento do PCP) — cada
  // imagem gerada corresponde a UMA folha física, o que é o que permite paginar de verdade.
  const PAGE_H = data.pageSize === '100x150' ? Math.round(W * 1.5) : Math.round(W * Math.SQRT2);
  const FOOTER_H = 50;
  const CONTINUATION_HEADER_H = 50;

  const measureCtx = document.createElement('canvas').getContext('2d')!;
  const wrapText = (c: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const wd of words) {
      const test = cur ? `${cur} ${wd}` : wd;
      if (c.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  };

  measureCtx.font = '700 13px Inter';
  const headerLine = [
    data.routeLabel,
    data.driverName ? `Motorista: ${data.driverName}` : null,
    `Status: ${data.statusLabel}`,
    `${data.stops.length} parada(s)`,
  ].filter(Boolean).join('  •  ');
  const headerLines = wrapText(measureCtx, headerLine, W - pad * 2);
  const HEADER_H = 120 + headerLines.length * 18;

  // Espelha exatamente os incrementos de `drawStop` abaixo, com +8% de folga: como cada
  // folha agora tem altura FIXA (PAGE_H), uma subestimativa cortaria/escondería conteúdo no
  // fim da imagem em vez de só "sobrar espaço" como antes (quando a imagem crescia pra
  // caber tudo).
  const measureStopHeight = (stop: DeliveryPrintStopItem): number => {
    let hgt = 44; // título + endereço (1 linha)
    measureCtx.font = '600 15px Inter';
    const addrLines = wrapText(measureCtx, stop.addressLine, W - pad * 2);
    hgt += (addrLines.length - 1) * 20;
    if (data.showOrders && stop.orderNumbers.length > 0) hgt += 24;
    if (stop.carrierName) hgt += 22;
    if (stop.note) hgt += 22;
    if (stop.orderNotes && stop.orderNotes.length > 0) hgt += 22;
    if (data.boxesMode === 'full' && stop.boxes.length > 0) hgt += 46 + stop.boxes.length * 30;
    else if (data.boxesMode === 'summary' && stop.boxes.length > 0) hgt += 8 + summarizeBoxes(stop.boxes).length * 22;
    if (data.showSignatureField) hgt += 50;
    hgt += 24; // divisor
    return hgt * 1.08;
  };

  const pages = paginateStops(
    data.stops,
    measureStopHeight,
    (pageIdx) => PAGE_H - (pageIdx === 0 ? HEADER_H : CONTINUATION_HEADER_H) - FOOTER_H,
    data.stopsPerPage,
  );

  const drawStop = (ctx: CanvasRenderingContext2D, stop: DeliveryPrintStopItem, yStart: number): number => {
    let y = yStart;
    let titleX = pad;
    if (data.showCheckbox) {
      const boxSize = 18;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pad, y - boxSize + 2, boxSize, boxSize);
      titleX = pad + boxSize + 10;
    }
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 18px Inter';
    ctx.fillText(`${stop.stopNumber}. ${stop.customerName}`, titleX, y);
    if (stop.priority === 'URGENT') {
      ctx.fillStyle = '#dc2626';
      ctx.font = '800 12px Inter';
      ctx.textAlign = 'right';
      ctx.fillText('URGENTE', W - pad, y);
      ctx.textAlign = 'left';
    }
    y += 24;

    ctx.fillStyle = '#475569';
    ctx.font = '600 15px Inter';
    const addrLines = wrapText(ctx, stop.addressLine, W - pad * 2);
    addrLines.forEach((line, i) => ctx.fillText(line, pad, y + i * 20));
    y += addrLines.length * 20 + 4;

    if (data.showOrders && stop.orderNumbers.length > 0) {
      ctx.fillStyle = '#28287a';
      ctx.font = '700 14px Inter';
      ctx.fillText(`Pedido(s): ${stop.orderNumbers.join(', ')}`, pad, y);
      y += 22;
    }

    if (stop.carrierName) {
      ctx.fillStyle = '#64748b';
      ctx.font = '600 13px Inter';
      ctx.fillText(`Transportadora: ${stop.carrierName}`, pad, y);
      y += 20;
    }

    if (stop.note) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 500 13px Inter';
      ctx.fillText(`Obs: ${stop.note}`, pad, y);
      y += 20;
    }

    if (stop.orderNotes && stop.orderNotes.length > 0) {
      ctx.fillStyle = '#b45309';
      ctx.font = '700 13px Inter';
      ctx.fillText(`Observações do Pedido: ${stop.orderNotes.join(' | ')}`, pad, y);
      y += 20;
    }

    if (data.boxesMode === 'full' && stop.boxes.length > 0) {
      y += 6;
      const cols = 4;
      const cellW = (W - pad * 2) / cols;
      const rowH = 30;

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(pad, y, W - pad * 2, rowH);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(pad, y, W - pad * 2, rowH);
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 11px Inter';
      ctx.textBaseline = 'middle';
      ['PRODUTO', 'COR', 'PARES', 'CXS'].forEach((lbl, i) => ctx.fillText(lbl, pad + i * cellW + 8, y + rowH / 2));
      y += rowH;

      ctx.font = '600 12px Inter';
      stop.boxes.forEach((b) => {
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(pad, y, W - pad * 2, rowH);
        ctx.fillStyle = '#0f172a';
        ctx.fillText(b.productLabel, pad + 8, y + rowH / 2);
        ctx.fillText(b.colorName, pad + cellW + 8, y + rowH / 2);
        ctx.fillText(String(b.totalPairs), pad + cellW * 2 + 8, y + rowH / 2);
        ctx.fillText(b.boxQty != null ? String(b.boxQty) : '—', pad + cellW * 3 + 8, y + rowH / 2);
        y += rowH;
      });
      ctx.textBaseline = 'alphabetic';
      y += 10;
    } else if (data.boxesMode === 'summary' && stop.boxes.length > 0) {
      y += 4;
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 14px Inter';
      summarizeBoxes(stop.boxes).forEach(s => {
        ctx.fillText(`${s.label} — ${s.boxQty} CX`, pad, y);
        y += 22;
      });
      y += 4;
    }

    if (data.showSignatureField) {
      y += 16;
      const sigLineW = (W - pad * 2) * 0.6;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + sigLineW, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad + sigLineW + 20, y); ctx.lineTo(W - pad, y); ctx.stroke();
      y += 16;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 11px Inter';
      ctx.fillText('Assinatura do Recebedor', pad, y);
      ctx.fillText('Data', pad + sigLineW + 20, y);
      y += 18;
    }

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    y += 24;
    return y;
  };

  const drawPage = (pageStops: DeliveryPrintStopItem[], pageIdx: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = PAGE_H * SCALE;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SCALE, SCALE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, PAGE_H);

    let y = pad;
    if (pageIdx === 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 36px Inter';
      ctx.fillText('GESTÃO PRO', pad, y + 26);

      ctx.fillStyle = '#64748b';
      ctx.font = '700 16px Inter';
      ctx.letterSpacing = '2px';
      ctx.fillText('ROTEIRO DE ENTREGA', pad, y + 54);
      ctx.letterSpacing = '0px';

      y += 70;
      ctx.fillStyle = '#475569';
      ctx.font = '700 13px Inter';
      headerLines.forEach((line, i) => ctx.fillText(line, pad, y + i * 18));
      y += headerLines.length * 18 + 14;

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      y += 30;
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 16px Inter';
      ctx.fillText(`${data.routeLabel} (continuação)`, pad, pad + 16);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad, pad + 30); ctx.lineTo(W - pad, pad + 30); ctx.stroke();
      y = pad + CONTINUATION_HEADER_H;
    }

    ctx.textAlign = 'left';
    pageStops.forEach(stop => { y = drawStop(ctx, stop, y); });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 12px Inter';
    ctx.fillText(`Página ${pageIdx + 1} de ${pages.length}  •  Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, W / 2, PAGE_H - 25);

    return canvas;
  };

  if (previewOnly) {
    return pages.map((pageStops, idx) => drawPage(pageStops, idx).toDataURL('image/jpeg', 0.9));
  }

  if (pages.length === 1) {
    await shareImage(drawPage(pages[0], 0).toDataURL('image/jpeg', 0.9), filename);
    return true;
  }

  // Várias folhas: todas compartilhadas de uma vez só, num único share sheet nativo — em
  // vez de abrir o compartilhamento folha por folha, obrigando escolher o app e enviar de
  // novo a cada uma.
  const dataUris = pages.map((pageStops, idx) => drawPage(pageStops, idx).toDataURL('image/jpeg', 0.9));
  await shareImages(dataUris, filename);
  return true;
}
