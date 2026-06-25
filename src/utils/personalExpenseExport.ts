import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { Transaction } from '../types';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';

interface PersonalExpenseExportData {
  transaction: Transaction;
  contactName?: string;
  memberName?: string;
}

const HEADER_BG: [number, number, number] = [15, 23, 42];
const LABEL_COLOR: [number, number, number] = [100, 116, 139];
const TEXT_COLOR: [number, number, number] = [30, 41, 59];

function buildRows(t: Transaction, contactName?: string, memberName?: string): [string, string][] {
  const rows: [string, string][] = [
    ['Fornecedor', contactName || t.contactName || 'Não informado'],
    ['Data', format(new Date(t.date), 'dd/MM/yyyy')],
    ['Valor', `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
  ];
  if (t.isRecurring && t.totalInstallments) {
    rows.push(['Parcela', `${t.installmentNumber} de ${t.totalInstallments}`]);
  }
  if (memberName) rows.push(['Membro', memberName]);
  rows.push(['Status', t.status === 'COMPLETED' ? 'Quitado' : 'Pendente']);

  const totalPaid = (t.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
  if (totalPaid > 0 && t.status !== 'COMPLETED') {
    rows.push(['Pago até agora', `R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);
    rows.push(['Restante', `R$ ${Math.max(0, t.amount - totalPaid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);
  }
  return rows;
}

/** Recibo simples de uma despesa pessoal (uma parcela = um documento, ver Financeiro
 * Pessoal) — sem tabela de itens, já que aqui não existe grade de produtos como em
 * Compras. Reaproveita sharePDF/shareImage (mesmas usadas por purchaseExport.ts). */
export const exportPersonalExpense = async (data: PersonalExpenseExportData, formatType: 'pdf' | 'jpg') => {
  const { transaction } = data;
  const safeName = (transaction.description || 'Despesa').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 24);
  const filename = `Despesa_${safeName}_${transaction.id.slice(-6)}`;

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

async function generatePDF(data: PersonalExpenseExportData, filename: string) {
  const { transaction: t, contactName, memberName } = data;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Despesa Pessoal', 105, 18, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(t.description || '—', 105, 26, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Este documento não tem valor fiscal', 105, 33, { align: 'center' });

  const MARGIN = 20;
  let y = 58;
  buildRows(t, contactName, memberName).forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...LABEL_COLOR);
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_COLOR);
    doc.text(value, MARGIN + 55, y);
    y += 11;
  });

  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, 285, { align: 'center' });

  await sharePDF(doc, filename);
}

async function generateJPG(data: PersonalExpenseExportData, filename: string) {
  const { transaction: t, contactName, memberName } = data;
  const rows = buildRows(t, contactName, memberName);

  const W = 600;
  const S = 2;
  const pad = 24;
  const HEADER_H = 88;
  const ROW_H = 50;
  const totalH = HEADER_H + rows.length * ROW_H + 40;

  const canvas = document.createElement('canvas');
  canvas.width = W * S;
  canvas.height = totalH * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Despesa Pessoal', W / 2, 36);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(t.description || '—', W / 2, 58);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('Este documento não tem valor fiscal', W / 2, 75);

  let y = HEADER_H;
  rows.forEach(([label, value], i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, y, W, ROW_H);
    }
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(label.toUpperCase(), pad, y + ROW_H / 2 + 4);
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(value, W - pad, y + ROW_H / 2 + 4);
    y += ROW_H;
  });

  ctx.textAlign = 'center';
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, W / 2, y + 24);

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}
