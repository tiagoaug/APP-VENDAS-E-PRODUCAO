import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { CompanyProfile } from '../types';
import { sharePDF, shareImages } from './pdfExport';
import { saveImageToGallery } from '../lib/gallerySaver';
import { toast } from './toast';
import { getBrandBandHeight, drawCompanyBrandingOnCanvas, drawCompanyBrandingOnPdf } from './companyBranding';

// Mesma estrutura de commissionExport.ts (Comissão a Vendedores), adaptada pro card "Ordens de
// Serviço a Fornecedores" — sem a divisão recebido/pendente (aqui não existe, o total exportado
// é sempre o saldo em aberto, ver FinancialView.tsx providerOSGroups) e com colunas de
// referência/cor/quantidade em vez de cliente/status de pagamento do cliente.

export interface ProviderOSExportRow {
  osNumber: string;
  reference?: string;
  productName: string;
  variationName?: string;
  quantity: number;
  total: number;
  paid: boolean; // false aqui sempre — só exporta o que está em aberto
}

// Uma linha por modelo (referência/produto) — mesma agregação de groupServiceOrdersByModelo em
// FinancialView.tsx, já resolvida em texto pronto pra tabela (colorSummary/osNumbers).
export interface ProviderOSExportGroupRow {
  reference?: string;
  productName: string;
  colorSummary: string; // "Preto: 40 · Branco: 20"
  totalQuantity: number;
  total: number;
  osNumbers: string[];
}

export interface ProviderOSExportData {
  providerName: string;
  periodLabel: string;
  orders: ProviderOSExportRow[];
  openBalance: number;
  companyProfile?: CompanyProfile | null;
  // Texto livre opcional, mostrado ao final do documento (PDF) ou da última página (JPG) — ver
  // popup de exportação em FinancialView.tsx.
  observations?: string;
  // 'modelo' = a tabela exportada usa `groupedRows` (uma linha por referência, cores/qtd somadas,
  // sem número de OS individual) em vez de `orders` (uma linha por OS). Ausente/'os' = sempre orders.
  groupBy?: 'os' | 'modelo';
  groupedRows?: ProviderOSExportGroupRow[];
}

export interface ProviderOSExportOptions {
  // Só vale pro JPG — quantas OS por imagem antes de dividir em mais de uma página/arquivo.
  // Ausente/0/≥ orders.length = tudo numa imagem só (comportamento de sempre).
  osPerPage?: number;
  // Só vale pro JPG — salva direto na galeria do aparelho em vez de abrir o compartilhamento
  // nativo (ver saveImageToGallery em lib/gallerySaver.ts).
  saveToGallery?: boolean;
}

function buildFilename(providerName: string, periodLabel: string) {
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  return `OS_${clean(providerName)}_${clean(periodLabel)}`;
}

export const exportProviderOS = async (data: ProviderOSExportData, formatType: 'pdf' | 'jpg', options?: ProviderOSExportOptions) => {
  const filename = buildFilename(data.providerName, data.periodLabel);
  try {
    if (formatType === 'pdf') {
      await generatePDF(data, filename);
    } else {
      await generateJPG(data, filename, options);
    }
  } catch (error) {
    console.error('Provider OS export error:', error);
    toast.show('Erro ao gerar arquivo. Por favor, tente novamente.');
  }
};

function productLabel(row: ProviderOSExportRow): string {
  return `${row.reference ? `${row.reference} ` : ''}${row.productName}${row.variationName ? ` (${row.variationName})` : ''}`;
}

async function generatePDF(data: ProviderOSExportData, filename: string) {
  const { providerName, periodLabel, orders, openBalance, companyProfile, observations, groupBy, groupedRows } = data;
  const isGrouped = groupBy === 'modelo' && !!groupedRows;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const brandH = getBrandBandHeight(companyProfile, 'mm');
  const isHeaderBrand = brandH > 0 && companyProfile?.exportPosition === 'header';
  const isFooterBrand = brandH > 0 && companyProfile?.exportPosition === 'footer';
  const topOffset = isHeaderBrand ? brandH : 0;

  const headerBgColor: [number, number, number] = [15, 23, 42];
  const labelColor: [number, number, number] = [100, 116, 139];
  const textColor: [number, number, number] = [30, 41, 59];

  doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.rect(0, topOffset, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Relatório de Ordens de Serviço', 105, topOffset + 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${providerName} · ${periodLabel}`, 105, topOffset + 26, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Este documento não tem valor fiscal', 105, topOffset + 33, { align: 'center' });

  if (isHeaderBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 0, 210);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  const infoY = topOffset + 55;

  doc.setFont('helvetica', 'bold');
  doc.text('Fornecedor:', 20, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(providerName, 48, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('OS em aberto:', 130, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(orders.length), 165, infoY);

  const nextY = infoY + 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Período:', 20, nextY);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel, 48, nextY);

  const tableData = isGrouped
    ? groupedRows!.map(g => [
        { content: `${g.reference ? `${g.reference} ` : ''}${g.productName}\n${g.colorSummary}\nOS: ${g.osNumbers.join(', ')}`, styles: { textColor: labelColor } },
        `${g.totalQuantity} par${g.totalQuantity === 1 ? '' : 'es'}`,
        `R$ ${g.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ])
    : orders.map(o => [
        { content: `${o.osNumber}\n${productLabel(o)}`, styles: { textColor: labelColor } },
        `${o.quantity} par${o.quantity === 1 ? '' : 'es'}`,
        `R$ ${o.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ]);

  autoTable(doc, {
    startY: nextY + 12,
    head: [[isGrouped ? 'Modelo / Cores / OS' : 'OS / Produto', 'Qtd', 'Total']],
    body: tableData,
    theme: 'plain',
    headStyles: { fillColor: [248, 250, 252], textColor: labelColor, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, cellPadding: 4, textColor: textColor },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  });

  let tableFinalY = (doc as any).lastAutoTable.finalY + 12;
  const summaryX = 130;

  doc.setDrawColor(200);
  doc.line(summaryX, tableFinalY, 190, tableFinalY);

  doc.setTextColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total em Aberto:', summaryX, tableFinalY + 10);
  doc.text(`R$ ${openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY + 10, { align: 'right' });
  tableFinalY += 10;

  if (observations && observations.trim()) {
    const obsY = tableFinalY + 14;
    doc.setDrawColor(220);
    doc.line(20, obsY - 8, 190, obsY - 8);
    doc.setTextColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OBSERVAÇÕES', 20, obsY);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const wrapped = doc.splitTextToSize(observations.trim(), 170);
    doc.text(wrapped, 20, obsY + 7);
  }

  const footerTextY = isFooterBrand ? 297 - brandH - 6 : 285;
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, footerTextY, { align: 'center' });

  if (isFooterBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 297 - brandH, 210);

  await sharePDF(doc, filename);
}

// Quebra `text` em linhas que cabem em `maxWidth` px, testando com o font já setado no ctx —
// canvas 2D não quebra texto sozinho como HTML, então cada linha precisa ser medida na mão.
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
}

interface RenderPageParams {
  providerName: string;
  periodLabel: string;
  orders: ProviderOSExportRow[];
  groupedRows?: ProviderOSExportGroupRow[]; // presente quando groupBy === 'modelo' — substitui `orders` na tabela
  openBalance: number;
  companyProfile?: CompanyProfile | null;
  observations?: string;
  showTotals: boolean; // só a última página mostra o "Total em Aberto" (geral, não da página)
  pageInfo?: { page: number; totalPages: number };
}

async function renderProviderOSPageCanvas(params: RenderPageParams): Promise<HTMLCanvasElement> {
  const { providerName, periodLabel, orders, groupedRows, openBalance, companyProfile, observations, showTotals, pageInfo } = params;
  const isGrouped = !!groupedRows;
  const brandH = getBrandBandHeight(companyProfile, 'px');
  const isHeaderBrand = brandH > 0 && companyProfile?.exportPosition === 'header';
  const isFooterBrand = brandH > 0 && companyProfile?.exportPosition === 'footer';

  const W = 600;
  const S = 2;
  const pad = 24;
  // Linha agrupada tem 3 linhas de texto (modelo, cores, OS) em vez de 2 (OS, qtd) — precisa de
  // mais altura.
  const ROW_H = isGrouped ? 68 : 52;

  const HEADER_H = 88, INFO_H = 60, TH_H = 32;
  const rowCount = isGrouped ? groupedRows!.length : orders.length;
  const itemsH = rowCount * ROW_H;
  const TOTALS_H = showTotals ? 20 + 26 + 32 + 20 : 0;

  // Observações só entram (e só medem altura) na última página — precisa de um contexto de
  // medição ANTES de criar o canvas final, já que o canvas precisa nascer com a altura certa.
  const obsLines: string[] = [];
  let obsBlockH = 0;
  const hasObs = !!observations && observations.trim().length > 0;
  if (hasObs) {
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d')!;
    measureCtx.font = '500 11px Arial';
    obsLines.push(...wrapCanvasText(measureCtx, observations!.trim(), W - pad * 2));
    obsBlockH = 20 + 16 + obsLines.length * 15 + 10;
  }

  const totalH = HEADER_H + INFO_H + TH_H + itemsH + TOTALS_H + obsBlockH + 28 + brandH;

  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = totalH * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  let y = 0;

  if (isHeaderBrand && companyProfile) {
    await drawCompanyBrandingOnCanvas(ctx, companyProfile, y, W);
    y += brandH;
  }

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, y, W, HEADER_H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Relatório de Ordens de Serviço', W / 2, y + 34);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  const subtitle = `${providerName} · ${periodLabel}${pageInfo ? ` · Página ${pageInfo.page}/${pageInfo.totalPages}` : ''}`;
  ctx.fillText(subtitle, W / 2, y + 56);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('Este documento não tem valor fiscal', W / 2, y + 74);
  y += HEADER_H;

  // Info box
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(pad, y + 10, W - pad * 2, INFO_H - 10);
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('FORNECEDOR', pad + 14, y + 26);
  ctx.font = 'bold 15px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(providerName, pad + 14, y + 45);
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(isGrouped ? 'MODELOS NESTA PÁGINA' : 'OS NESTA PÁGINA', W - pad - 14, y + 26);
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`${rowCount}`, W - pad - 14, y + 45);
  y += INFO_H;

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(pad, y, W - pad * 2, TH_H);
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText(isGrouped ? 'MODELO / CORES / OS' : 'OS / PRODUTO', pad + 12, y + TH_H / 2 + 4);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL', W - pad - 12, y + TH_H / 2 + 4);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y + TH_H); ctx.lineTo(W - pad, y + TH_H); ctx.stroke();
  y += TH_H;

  // Rows
  if (isGrouped) {
    groupedRows!.forEach((g, i) => {
      if (i % 2 === 1) { ctx.fillStyle = '#fafafa'; ctx.fillRect(pad, y, W - pad * 2, ROW_H); }

      ctx.textAlign = 'left';
      ctx.font = 'bold 13px Arial'; ctx.fillStyle = '#0f172a';
      ctx.fillText(`${g.reference ? `${g.reference} ` : ''}${g.productName}`, pad + 12, y + 21, W - pad * 2 - 150);
      ctx.font = '500 10px Arial'; ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${g.colorSummary} · Total: ${g.totalQuantity} par${g.totalQuantity === 1 ? '' : 'es'}`, pad + 12, y + 37, W - pad * 2 - 24);
      ctx.font = '500 9.5px Arial'; ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`OS: ${g.osNumbers.join(', ')}`, pad + 12, y + 53, W - pad * 2 - 24);

      ctx.textAlign = 'right';
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#334155';
      ctx.fillText(`R$ ${g.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y + 30);

      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, y + ROW_H); ctx.lineTo(W - pad, y + ROW_H); ctx.stroke();
      y += ROW_H;
    });
  } else {
    orders.forEach((o, i) => {
      if (i % 2 === 1) { ctx.fillStyle = '#fafafa'; ctx.fillRect(pad, y, W - pad * 2, ROW_H); }

      ctx.textAlign = 'left';
      ctx.font = 'bold 13px Arial'; ctx.fillStyle = '#0f172a';
      ctx.fillText(`${o.osNumber} · ${productLabel(o)}`, pad + 12, y + 21, W - pad * 2 - 150);
      ctx.font = '500 10.5px Arial'; ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${o.quantity} par${o.quantity === 1 ? '' : 'es'}`, pad + 12, y + 38);

      ctx.textAlign = 'right';
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#334155';
      ctx.fillText(`R$ ${o.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y + 30);

      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, y + ROW_H); ctx.lineTo(W - pad, y + ROW_H); ctx.stroke();
      y += ROW_H;
    });
  }

  // Total — rótulo e valor em linhas separadas (não lado a lado): "Total em Aberto:" é mais
  // longo que o "Total a Pagar:" da Comissão e colidia com o valor alinhado à direita na mesma
  // linha, ficando sobreposto no JPG exportado.
  if (showTotals) {
    y += 20;
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    y += 26;
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px Arial'; ctx.fillStyle = '#94a3b8';
    ctx.fillText('TOTAL EM ABERTO', pad, y);
    y += 32;
    ctx.font = 'bold 26px Arial'; ctx.fillStyle = '#0f172a';
    ctx.fillText(`R$ ${openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pad, y);
    y += 20;
  }

  if (hasObs) {
    y += 10;
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    y += 20;
    ctx.textAlign = 'left';
    ctx.font = 'bold 9px Arial'; ctx.fillStyle = '#94a3b8';
    ctx.fillText('OBSERVAÇÕES', pad, y);
    y += 16;
    ctx.font = '500 11px Arial'; ctx.fillStyle = '#334155';
    obsLines.forEach(line => { ctx.fillText(line, pad, y); y += 15; });
  }

  if (isFooterBrand && companyProfile) {
    await drawCompanyBrandingOnCanvas(ctx, companyProfile, y, W);
  }

  return canvas;
}

async function saveCanvasesToGallery(canvases: HTMLCanvasElement[], filenamePrefix: string) {
  let savedCount = 0;
  for (let i = 0; i < canvases.length; i++) {
    const base64 = canvases[i].toDataURL('image/jpeg', 0.95).split('base64,')[1];
    const written = await Filesystem.writeFile({ path: `${filenamePrefix}_${Date.now()}_${i}.jpg`, data: base64, directory: Directory.Cache });
    const { saved } = await saveImageToGallery(written.uri);
    if (saved) savedCount++;
  }
  toast.show(savedCount > 0 ? `${savedCount} imagem${savedCount > 1 ? 'ns' : ''} salva${savedCount > 1 ? 's' : ''} na galeria!` : 'Falha ao salvar na galeria.');
}

async function generateJPG(data: ProviderOSExportData, filename: string, options?: ProviderOSExportOptions) {
  const { providerName, periodLabel, orders, openBalance, companyProfile, observations, groupBy, groupedRows } = data;
  const isGrouped = groupBy === 'modelo' && !!groupedRows;

  // Divide em várias imagens quando osPerPage é menor que o total de linhas (OS, ou modelos no
  // modo agrupado) — cada imagem vira uma "página" própria, com cabeçalho/numeração de página;
  // só a última mostra o Total em Aberto (o saldo é sempre do fornecedor inteiro, não faz
  // sentido repetir/dividir por página) e as observações.
  const totalRows = isGrouped ? groupedRows!.length : orders.length;
  const perPage = options?.osPerPage && options.osPerPage > 0 ? options.osPerPage : totalRows;
  const orderChunks: ProviderOSExportRow[][] = [];
  const groupChunks: ProviderOSExportGroupRow[][] = [];
  if (totalRows === 0) {
    isGrouped ? groupChunks.push([]) : orderChunks.push([]);
  } else if (isGrouped) {
    for (let i = 0; i < groupedRows!.length; i += perPage) groupChunks.push(groupedRows!.slice(i, i + perPage));
  } else {
    for (let i = 0; i < orders.length; i += perPage) orderChunks.push(orders.slice(i, i + perPage));
  }
  const pageCount = isGrouped ? groupChunks.length : orderChunks.length;

  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < pageCount; i++) {
    const isLast = i === pageCount - 1;
    canvases.push(await renderProviderOSPageCanvas({
      providerName, periodLabel,
      orders: isGrouped ? [] : orderChunks[i],
      groupedRows: isGrouped ? groupChunks[i] : undefined,
      openBalance, companyProfile,
      observations: isLast ? observations : undefined,
      showTotals: isLast,
      pageInfo: pageCount > 1 ? { page: i + 1, totalPages: pageCount } : undefined,
    }));
  }

  if (options?.saveToGallery) {
    await saveCanvasesToGallery(canvases, filename);
  } else {
    await shareImages(canvases.map(c => c.toDataURL('image/jpeg', 0.95)), filename);
  }
}
