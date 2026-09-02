import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { CompanyProfile } from '../types';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';
import { getBrandBandHeight, drawCompanyBrandingOnCanvas, drawCompanyBrandingOnPdf } from './companyBranding';

// Export da Folha de Pagamento inteira (todos os colaboradores do período de uma vez) — ver
// botão "Exportar Folha" em CommissionToSellersCard.tsx. Diferente de commissionExport.ts, que
// exporta o detalhe de vendas de UM vendedor só.
export interface PayrollExportRow {
  name: string;
  cargo: string;
  salary: number;
  proLabore: number;
  commission: number;
  loanDeduction: number;
  net: number;
}

export interface PayrollExportData {
  periodLabel: string;
  rows: PayrollExportRow[];
  companyProfile?: CompanyProfile | null;
}

function buildFilename(periodLabel: string) {
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  return `Folha_de_Pagamento_${clean(periodLabel)}`;
}

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const exportPayrollPeriod = async (data: PayrollExportData, formatType: 'pdf' | 'jpg') => {
  const filename = buildFilename(data.periodLabel);
  try {
    if (formatType === 'pdf') {
      await generatePDF(data, filename);
    } else {
      await generateJPG(data, filename);
    }
  } catch (error) {
    console.error('Payroll export error:', error);
    toast.show('Erro ao gerar arquivo. Por favor, tente novamente.');
  }
};

async function generatePDF(data: PayrollExportData, filename: string) {
  const { periodLabel, rows, companyProfile } = data;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const brandH = getBrandBandHeight(companyProfile, 'mm');
  const isHeaderBrand = brandH > 0 && companyProfile?.exportPosition === 'header';
  const isFooterBrand = brandH > 0 && companyProfile?.exportPosition === 'footer';
  const topOffset = isHeaderBrand ? brandH : 0;

  const headerBgColor: [number, number, number] = [15, 23, 42];
  const labelColor: [number, number, number] = [100, 116, 139];

  doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.rect(0, topOffset, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Folha de Pagamento', 105, topOffset + 16, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel, 105, topOffset + 24, { align: 'center' });

  if (isHeaderBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 0, 210);

  const totals = rows.reduce((acc, r) => ({
    salary: acc.salary + r.salary,
    proLabore: acc.proLabore + r.proLabore,
    commission: acc.commission + r.commission,
    loanDeduction: acc.loanDeduction + r.loanDeduction,
    net: acc.net + r.net,
  }), { salary: 0, proLabore: 0, commission: 0, loanDeduction: 0, net: 0 });

  const body = rows.map(r => [
    { content: `${r.name}\n${r.cargo}`, styles: { textColor: labelColor } },
    fmt(r.salary),
    fmt(r.proLabore),
    fmt(r.commission),
    r.loanDeduction > 0 ? `- ${fmt(r.loanDeduction)}` : '-',
    { content: fmt(r.net), styles: { fontStyle: 'bold' as const } },
  ]);

  autoTable(doc, {
    startY: topOffset + 40,
    head: [['Colaborador', 'Salário', 'Pró-labore', 'Comissão', 'Empréstimo', 'Líquido']],
    body,
    foot: [['TOTAL', fmt(totals.salary), fmt(totals.proLabore), fmt(totals.commission), totals.loanDeduction > 0 ? `- ${fmt(totals.loanDeduction)}` : '-', fmt(totals.net)]],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(7.5);
  doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
  doc.text('Estimativa — confirme com contabilidade/RH antes de qualquer pagamento oficial.', 105, finalY, { align: 'center' });

  const footerTextY = isFooterBrand ? 297 - brandH - 6 : 285;
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, footerTextY, { align: 'center' });

  if (isFooterBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 297 - brandH, 210);

  await sharePDF(doc, filename);
}

async function generateJPG(data: PayrollExportData, filename: string) {
  const { periodLabel, rows, companyProfile } = data;
  const brandH = getBrandBandHeight(companyProfile, 'px');
  const isHeaderBrand = brandH > 0 && companyProfile?.exportPosition === 'header';
  const isFooterBrand = brandH > 0 && companyProfile?.exportPosition === 'footer';

  const W = 650;
  const S = 2;
  const pad = 20;
  const ROW_H = 46;
  const HEADER_H = 76, TH_H = 30, TOTALS_H = 50;
  const totalH = HEADER_H + TH_H + rows.length * ROW_H + TOTALS_H + 30 + brandH;

  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = totalH * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  let y = 0;
  if (isHeaderBrand && companyProfile) { await drawCompanyBrandingOnCanvas(ctx, companyProfile, y, W); y += brandH; }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, y, W, HEADER_H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Folha de Pagamento', W / 2, y + 32);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(periodLabel, W / 2, y + 54);
  y += HEADER_H;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(pad, y, W - pad * 2, TH_H);
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('COLABORADOR', pad + 10, y + TH_H / 2 + 3);
  ctx.textAlign = 'right';
  ctx.fillText('LÍQUIDO', W - pad - 10, y + TH_H / 2 + 3);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y + TH_H); ctx.lineTo(W - pad, y + TH_H); ctx.stroke();
  y += TH_H;

  let totalNet = 0;
  rows.forEach((r, i) => {
    totalNet += r.net;
    if (i % 2 === 1) { ctx.fillStyle = '#fafafa'; ctx.fillRect(pad, y, W - pad * 2, ROW_H); }

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Arial'; ctx.fillStyle = '#0f172a';
    ctx.fillText(r.name, pad + 10, y + 19, W - pad * 2 - 160);
    ctx.font = '500 10px Arial'; ctx.fillStyle = '#94a3b8';
    const parts = [`Sal. ${fmt(r.salary)}`, r.proLabore > 0 ? `Pró-lab. ${fmt(r.proLabore)}` : '', r.commission > 0 ? `Com. ${fmt(r.commission)}` : '', r.loanDeduction > 0 ? `Empr. -${fmt(r.loanDeduction)}` : ''].filter(Boolean).join(' · ');
    ctx.fillText(parts, pad + 10, y + 35, W - pad * 2 - 160);

    ctx.textAlign = 'right';
    ctx.font = 'bold 15px Arial'; ctx.fillStyle = '#334155';
    ctx.fillText(fmt(r.net), W - pad - 10, y + 26);

    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y + ROW_H); ctx.lineTo(W - pad, y + ROW_H); ctx.stroke();
    y += ROW_H;
  });

  y += 20;
  ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  y += 26;
  ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left'; ctx.fillText('Total Líquido', pad, y);
  ctx.textAlign = 'right'; ctx.fillText(fmt(totalNet), W - pad, y);
  y += 22;
  ctx.font = '500 9px Arial'; ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center'; ctx.fillText('Estimativa — confirme com contabilidade/RH antes de qualquer pagamento oficial.', W / 2, y);
  y += 18;

  if (isFooterBrand && companyProfile) { await drawCompanyBrandingOnCanvas(ctx, companyProfile, y, W); y += brandH; }

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}
