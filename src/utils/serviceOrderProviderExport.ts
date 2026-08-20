import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { CompanyProfile } from '../types';
import { sharePDF, shareImage } from './pdfExport';
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

export interface ProviderOSExportData {
  providerName: string;
  periodLabel: string;
  orders: ProviderOSExportRow[];
  openBalance: number;
  companyProfile?: CompanyProfile | null;
}

function buildFilename(providerName: string, periodLabel: string) {
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  return `OS_${clean(providerName)}_${clean(periodLabel)}`;
}

export const exportProviderOS = async (data: ProviderOSExportData, formatType: 'pdf' | 'jpg') => {
  const filename = buildFilename(data.providerName, data.periodLabel);
  try {
    if (formatType === 'pdf') {
      await generatePDF(data, filename);
    } else {
      await generateJPG(data, filename);
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
  const { providerName, periodLabel, orders, openBalance, companyProfile } = data;
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

  const tableData = orders.map(o => [
    { content: `${o.osNumber}\n${productLabel(o)}`, styles: { textColor: labelColor } },
    `${o.quantity} par${o.quantity === 1 ? '' : 'es'}`,
    `R$ ${o.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  ]);

  autoTable(doc, {
    startY: nextY + 12,
    head: [['OS / Produto', 'Qtd', 'Total']],
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

  const tableFinalY = (doc as any).lastAutoTable.finalY + 12;
  const summaryX = 130;

  doc.setDrawColor(200);
  doc.line(summaryX, tableFinalY, 190, tableFinalY);

  doc.setTextColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total em Aberto:', summaryX, tableFinalY + 10);
  doc.text(`R$ ${openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY + 10, { align: 'right' });

  const footerTextY = isFooterBrand ? 297 - brandH - 6 : 285;
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, footerTextY, { align: 'center' });

  if (isFooterBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 297 - brandH, 210);

  await sharePDF(doc, filename);
}

async function generateJPG(data: ProviderOSExportData, filename: string) {
  const { providerName, periodLabel, orders, openBalance, companyProfile } = data;
  const brandH = getBrandBandHeight(companyProfile, 'px');
  const isHeaderBrand = brandH > 0 && companyProfile?.exportPosition === 'header';
  const isFooterBrand = brandH > 0 && companyProfile?.exportPosition === 'footer';

  const W = 600;
  const S = 2;
  const pad = 24;
  const ROW_H = 52;

  const HEADER_H = 88, INFO_H = 60, TH_H = 32;
  const itemsH = orders.length * ROW_H;
  const TOTALS_H = 20 + 26 + 32 + 20;
  const totalH = HEADER_H + INFO_H + TH_H + itemsH + TOTALS_H + 28 + brandH;

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
  ctx.fillText(`${providerName} · ${periodLabel}`, W / 2, y + 56);
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
  ctx.fillText('OS EM ABERTO', W - pad - 14, y + 26);
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`${orders.length}`, W - pad - 14, y + 45);
  y += INFO_H;

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(pad, y, W - pad * 2, TH_H);
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('OS / PRODUTO', pad + 12, y + TH_H / 2 + 4);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL', W - pad - 12, y + TH_H / 2 + 4);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y + TH_H); ctx.lineTo(W - pad, y + TH_H); ctx.stroke();
  y += TH_H;

  // Rows
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

  // Total — rótulo e valor em linhas separadas (não lado a lado): "Total em Aberto:" é mais
  // longo que o "Total a Pagar:" da Comissão e colidia com o valor alinhado à direita na mesma
  // linha, ficando sobreposto no JPG exportado.
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

  if (isFooterBrand && companyProfile) {
    await drawCompanyBrandingOnCanvas(ctx, companyProfile, y, W);
    y += brandH;
  }

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}
