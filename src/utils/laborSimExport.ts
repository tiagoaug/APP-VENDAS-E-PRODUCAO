import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { RescisaoItem } from './laborTermination';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';

// Export do Simulador de Rescisão (LaborTerminationSimulatorView) — mesmo padrão visual dos
// outros exports do app (ver commissionExport.ts), mas com um aviso bem visível de que isso é
// só uma ESTIMATIVA de consulta: não é o TRCT oficial nem substitui a conferência da
// contabilidade antes de qualquer pagamento de verdade.
export interface LaborSimExportData {
  title: string;
  subtitle: string;
  itens: RescisaoItem[];
  totalBrutoLabel: string;
  totalBruto: number;
  totalDescontosLabel?: string;
  totalDescontos?: number;
  totalLiquidoLabel: string;
  totalLiquido: number;
}

const DISCLAIMER = 'Documento apenas para consulta — não é o TRCT oficial nem tem valor fiscal. Confirme os dados e valores com sua contabilidade/RH antes de qualquer pagamento.';

function buildFilename(title: string) {
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  return `${clean(title)}_${format(new Date(), 'yyyy-MM-dd')}`;
}

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const exportLaborSim = async (data: LaborSimExportData, formatType: 'pdf' | 'jpg') => {
  const filename = buildFilename(data.title);
  try {
    if (formatType === 'pdf') {
      await generatePDF(data, filename);
    } else {
      await generateJPG(data, filename);
    }
  } catch (error) {
    console.error('Labor sim export error:', error);
    toast.show('Erro ao gerar arquivo. Por favor, tente novamente.');
  }
};

async function generatePDF(data: LaborSimExportData, filename: string) {
  const { title, subtitle, itens, totalBrutoLabel, totalBruto, totalDescontosLabel, totalDescontos, totalLiquidoLabel, totalLiquido } = data;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const headerBgColor: [number, number, number] = [15, 23, 42];
  const labelColor: [number, number, number] = [100, 116, 139];
  const textColor: [number, number, number] = [30, 41, 59];

  doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(title, 105, 16, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 105, 24, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(220, 180, 180);
  doc.text('Este documento não tem valor fiscal — ver aviso completo no rodapé', 105, 30, { align: 'center' });

  let y = 48;
  doc.setFontSize(10.5);
  itens.forEach(item => {
    const color = item.tipo === 'desconto' ? [225, 29, 72] : item.tipo === 'info' ? labelColor : [5, 150, 105];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(item.label, 20, y, { maxWidth: 120 });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(`${item.tipo === 'desconto' ? '- ' : ''}${fmt(item.value)}`, 190, y, { align: 'right' });
    y += 8;
  });

  y += 4;
  doc.setDrawColor(210);
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(totalBrutoLabel, 20, y);
  doc.text(fmt(totalBruto), 190, y, { align: 'right' });
  y += 8;

  if (totalDescontosLabel && typeof totalDescontos === 'number') {
    doc.setTextColor(225, 29, 72);
    doc.text(totalDescontosLabel, 20, y);
    doc.text(`- ${fmt(totalDescontos)}`, 190, y, { align: 'right' });
    y += 8;
  }

  y += 2;
  doc.setDrawColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.text(totalLiquidoLabel, 20, y);
  doc.text(fmt(totalLiquido), 190, y, { align: 'right' });

  const disclaimerY = 260;
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(15, disclaimerY, 180, 20, 3, 3, 'F');
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(15, disclaimerY, 180, 20, 3, 3, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(190, 18, 60);
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER, 170);
  doc.text(disclaimerLines, 20, disclaimerY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, 288, { align: 'center' });

  await sharePDF(doc, filename);
}

async function generateJPG(data: LaborSimExportData, filename: string) {
  const { title, subtitle, itens, totalBrutoLabel, totalBruto, totalDescontosLabel, totalDescontos, totalLiquidoLabel, totalLiquido } = data;

  const W = 600;
  const S = 2;
  const pad = 24;
  const ROW_H = 40;
  const HEADER_H = 90;
  const itemsH = itens.length * ROW_H;
  const TOTALS_H = (totalDescontosLabel ? 30 : 0) + 30 + 60;
  const DISCLAIMER_H = 78;
  const totalH = HEADER_H + itemsH + TOTALS_H + DISCLAIMER_H + 24;

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
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(subtitle, W / 2, y + 54);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#fca5a5';
  ctx.fillText('Este documento não tem valor fiscal — ver aviso completo abaixo', W / 2, y + 72);
  y += HEADER_H + 16;

  ctx.font = '600 14px Arial';
  itens.forEach(item => {
    const color = item.tipo === 'desconto' ? '#e11d48' : item.tipo === 'info' ? '#94a3b8' : '#059669';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = '500 13px Arial';
    ctx.fillText(item.label, pad, y + 20, W - pad * 2 - 150);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`${item.tipo === 'desconto' ? '- ' : ''}${fmt(item.value)}`, W - pad, y + 20);
    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y + ROW_H - 8); ctx.lineTo(W - pad, y + ROW_H - 8); ctx.stroke();
    y += ROW_H;
  });

  y += 12;
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  y += 22;

  ctx.font = '600 14px Arial'; ctx.fillStyle = '#334155';
  ctx.textAlign = 'left'; ctx.fillText(totalBrutoLabel, pad, y);
  ctx.textAlign = 'right'; ctx.fillText(fmt(totalBruto), W - pad, y);
  y += 26;

  if (totalDescontosLabel && typeof totalDescontos === 'number') {
    ctx.font = '600 14px Arial'; ctx.fillStyle = '#e11d48';
    ctx.textAlign = 'left'; ctx.fillText(totalDescontosLabel, pad, y);
    ctx.textAlign = 'right'; ctx.fillText(`- ${fmt(totalDescontos)}`, W - pad, y);
    y += 26;
  }

  ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  y += 28;

  ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left'; ctx.fillText(totalLiquidoLabel, pad, y);
  ctx.textAlign = 'right'; ctx.fillText(fmt(totalLiquido), W - pad, y);
  y += 30;

  ctx.fillStyle = '#fef2f2';
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 1.5;
  const boxH = DISCLAIMER_H - 10;
  ctx.beginPath();
  (ctx as any).roundRect ? (ctx as any).roundRect(pad, y, W - pad * 2, boxH, 8) : ctx.rect(pad, y, W - pad * 2, boxH);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 11px Arial';
  ctx.fillStyle = '#be123c';
  ctx.textAlign = 'left';
  wrapText(ctx, DISCLAIMER, pad + 14, y + 20, W - pad * 2 - 28, 15);

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, curY);
}
