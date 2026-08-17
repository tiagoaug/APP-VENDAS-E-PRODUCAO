import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { CompanyProfile } from '../types';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';
import { getBrandBandHeight, drawCompanyBrandingOnCanvas, drawCompanyBrandingOnPdf } from './companyBranding';

export interface CommissionExportSaleRow {
  orderNumber: string;
  customerName: string;
  date: number;
  total: number;
  commission: number;
  paid: boolean;
}

export interface CommissionExportData {
  sellerName: string;
  commissionPercent?: number;
  periodLabel: string;
  sales: CommissionExportSaleRow[];
  receivedCommission: number;
  pendingCommission: number;
  includeUnpaid: boolean;
  companyProfile?: CompanyProfile | null;
}

// Mesmo helper de nome de arquivo dos outros exports (saleExport.ts, pcpShareExport.ts) — sem
// acento/espaço, pra funcionar igual em qualquer app de compartilhamento do celular.
function buildFilename(sellerName: string, periodLabel: string) {
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  return `Comissao_${clean(sellerName)}_${clean(periodLabel)}`;
}

export const exportCommission = async (data: CommissionExportData, formatType: 'pdf' | 'jpg') => {
  const filename = buildFilename(data.sellerName, data.periodLabel);
  try {
    if (formatType === 'pdf') {
      await generatePDF(data, filename);
    } else {
      await generateJPG(data, filename);
    }
  } catch (error) {
    console.error('Commission export error:', error);
    toast.show('Erro ao gerar arquivo. Por favor, tente novamente.');
  }
};

async function generatePDF(data: CommissionExportData, filename: string) {
  const { sellerName, commissionPercent, periodLabel, sales, receivedCommission, pendingCommission, includeUnpaid, companyProfile } = data;
  const payableTotal = receivedCommission + (includeUnpaid ? pendingCommission : 0);
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
  doc.text('Relatório de Comissão', 105, topOffset + 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${sellerName} · ${periodLabel}`, 105, topOffset + 26, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Este documento não tem valor fiscal', 105, topOffset + 33, { align: 'center' });

  if (isHeaderBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 0, 210);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  const infoY = topOffset + 55;

  doc.setFont('helvetica', 'bold');
  doc.text('Vendedor:', 20, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(sellerName, 45, infoY);

  doc.setFont('helvetica', 'bold');
  doc.text('Comissão:', 130, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${commissionPercent ?? 0}%`, 155, infoY);

  const nextY = infoY + 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Período:', 20, nextY);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel, 45, nextY);

  doc.setFont('helvetica', 'bold');
  doc.text('Pedidos:', 130, nextY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(sales.length), 155, nextY);

  const tableData = sales.map(s => [
    { content: `#${s.orderNumber}\n${s.customerName}`, styles: { textColor: labelColor } },
    format(new Date(s.date), 'dd/MM/yyyy'),
    `R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    s.paid ? 'Recebido' : 'Pendente',
    `R$ ${s.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  ]);

  autoTable(doc, {
    startY: nextY + 12,
    head: [['Pedido / Cliente', 'Data', 'Venda', 'Status', 'Comissão']],
    body: tableData,
    theme: 'plain',
    headStyles: { fillColor: [248, 250, 252], textColor: labelColor, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, cellPadding: 4, textColor: textColor },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 24 },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 22 },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        hookData.cell.styles.textColor = hookData.cell.raw === 'Recebido' ? [225, 29, 72] : [148, 163, 184];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY + 10;
  const summaryX = 130;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Comissão recebida:', summaryX, tableFinalY);
  doc.text(`R$ ${receivedCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY, { align: 'right' });

  doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
  doc.text('Comissão pendente:', summaryX, tableFinalY + 7);
  doc.text(`R$ ${pendingCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY + 7, { align: 'right' });

  doc.setDrawColor(200);
  doc.line(summaryX, tableFinalY + 11, 190, tableFinalY + 11);

  doc.setTextColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total a Pagar:', summaryX, tableFinalY + 19);
  doc.text(`R$ ${payableTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY + 19, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
  doc.text(includeUnpaid ? '(inclui pedidos ainda não recebidos)' : '(só pedidos já recebidos do cliente)', summaryX, tableFinalY + 24);

  const footerTextY = isFooterBrand ? 297 - brandH - 6 : 285;
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, footerTextY, { align: 'center' });

  if (isFooterBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 297 - brandH, 210);

  await sharePDF(doc, filename);
}

async function generateJPG(data: CommissionExportData, filename: string) {
  const { sellerName, commissionPercent, periodLabel, sales, receivedCommission, pendingCommission, includeUnpaid, companyProfile } = data;
  const payableTotal = receivedCommission + (includeUnpaid ? pendingCommission : 0);
  const brandH = getBrandBandHeight(companyProfile, 'px');
  const isHeaderBrand = brandH > 0 && companyProfile?.exportPosition === 'header';
  const isFooterBrand = brandH > 0 && companyProfile?.exportPosition === 'footer';

  const W = 600;
  const S = 2;
  const pad = 24;
  const ROW_H = 52;

  const HEADER_H = 88, INFO_H = 60, TH_H = 32;
  const itemsH = sales.length * ROW_H;
  const TOTALS_H = 20 + 26 + 22 + 16 + 42 + 18;
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
  ctx.fillText('Relatório de Comissão', W / 2, y + 34);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${sellerName} · ${periodLabel}`, W / 2, y + 56);
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
  ctx.fillText('VENDEDOR', pad + 14, y + 26);
  ctx.font = 'bold 15px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(sellerName, pad + 14, y + 45);
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('COMISSÃO / PEDIDOS', W - pad - 14, y + 26);
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`${commissionPercent ?? 0}% · ${sales.length} ${sales.length === 1 ? 'pedido' : 'pedidos'}`, W - pad - 14, y + 45);
  y += INFO_H;

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(pad, y, W - pad * 2, TH_H);
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('PEDIDO / CLIENTE', pad + 12, y + TH_H / 2 + 4);
  ctx.textAlign = 'right';
  ctx.fillText('COMISSÃO', W - pad - 12, y + TH_H / 2 + 4);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y + TH_H); ctx.lineTo(W - pad, y + TH_H); ctx.stroke();
  y += TH_H;

  // Rows
  sales.forEach((s, i) => {
    if (i % 2 === 1) { ctx.fillStyle = '#fafafa'; ctx.fillRect(pad, y, W - pad * 2, ROW_H); }

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Arial'; ctx.fillStyle = '#0f172a';
    ctx.fillText(`#${s.orderNumber} · ${s.customerName}`, pad + 12, y + 21, W - pad * 2 - 150);
    ctx.font = '500 10.5px Arial'; ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${format(new Date(s.date), 'dd/MM/yyyy')} · venda R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pad + 12, y + 38);

    ctx.textAlign = 'right';
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = s.paid ? '#e11d48' : '#334155';
    ctx.fillText(`R$ ${s.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y + 22);
    ctx.font = 'bold 9px Arial';
    ctx.fillStyle = s.paid ? '#e11d48' : '#94a3b8';
    ctx.fillText(s.paid ? 'RECEBIDO' : 'PENDENTE', W - pad - 12, y + 38);

    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y + ROW_H); ctx.lineTo(W - pad, y + ROW_H); ctx.stroke();
    y += ROW_H;
  });

  // Totals
  y += 20;
  const tx = W - pad - 230;
  ctx.font = '500 13px Arial'; ctx.fillStyle = '#334155';
  ctx.textAlign = 'left'; ctx.fillText('Comissão recebida:', tx, y);
  ctx.textAlign = 'right'; ctx.fillText(`R$ ${receivedCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y);
  y += 26;
  ctx.font = '500 13px Arial'; ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left'; ctx.fillText('Comissão pendente:', tx, y);
  ctx.textAlign = 'right'; ctx.fillText(`R$ ${pendingCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y);
  y += 22;
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(tx, y + 4); ctx.lineTo(W - pad - 12, y + 4); ctx.stroke();
  y += 16;
  ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left'; ctx.fillText('Total a Pagar:', tx, y + 26);
  ctx.textAlign = 'right'; ctx.fillText(`R$ ${payableTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y + 26);
  y += 42;
  ctx.font = '500 10px Arial'; ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText(includeUnpaid ? '(inclui pedidos ainda não recebidos)' : '(só pedidos já recebidos do cliente)', tx, y);
  y += 18;

  if (isFooterBrand && companyProfile) {
    await drawCompanyBrandingOnCanvas(ctx, companyProfile, y, W);
    y += brandH;
  }

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}
