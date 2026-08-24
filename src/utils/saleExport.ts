import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sale, Product, Person, PaymentMethod, CompanyProfile } from '../types';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';
import { getBrandBandHeight, drawCompanyBrandingOnCanvas, drawCompanyBrandingOnPdf } from './companyBranding';

interface ExportData {
  sale: Sale;
  products: Product[];
  people: Person[];
  paymentMethods: PaymentMethod[];
  additionalNote?: string;
  isDarkMode: boolean;
  /** Inclui a foto de cada produto (variação, com fallback pro produto) na linha do item —
   * só vale pro JPG (a foto some do PDF, que continua só texto). */
  showThumbnails?: boolean;
  /** Identidade da empresa (Mais > Personalizar Empresa) — nome/logo/telefone/endereço no
   * cabeçalho ou rodapé, conforme configurado. Ausente/'none' = documento sai como sempre saiu. */
  companyProfile?: CompanyProfile | null;
}

// Desenha o caminho de um retângulo com cantos arredondados — usado tanto pra recortar a foto
// (clip antes do drawImage) quanto pro placeholder cinza, pra miniatura ter cara de app moderno
// em vez de um quadrado seco.
function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadThumbImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Quando `preview` é true, gera o mesmo arquivo mas devolve a data URI em vez de
 * compartilhar/baixar — usado pelo botão "Visualizar Arquivo" do ExportNoteModal, que abre
 * essa imagem/PDF num popup de pré-visualização antes do usuário confirmar o compartilhamento. */
export const exportSale = async (data: ExportData, formatType: 'pdf' | 'jpg', preview?: boolean): Promise<string | void> => {
  const { sale, products, people, paymentMethods, additionalNote, isDarkMode } = data;

  const customer = people.find(p => p.id === sale.customerId);
  const seller = people.find(p => p.id === sale.sellerId);
  const dateStr = format(new Date(sale.date), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  const customerFirstName = (customer?.name || 'Cliente').split(' ')[0];
  const filename = `${sale.status === 'QUOTE' ? 'Orcamento' : 'Venda'}_${sale.orderNumber}_${customerFirstName}`;

  try {
    if (formatType === 'pdf') {
      return await generatePDF(data, filename, preview);
    } else {
      return await generateJPG(data, filename, preview);
    }
  } catch (error) {
    console.error('Export error:', error);
    toast.show('Erro ao gerar arquivo. Por favor, tente novamente.');
  }
};

async function generatePDF(data: ExportData, filename: string, preview?: boolean): Promise<string | void> {
  const { sale, products, people, paymentMethods, additionalNote, companyProfile } = data;
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  // Identidade da empresa (Mais > Personalizar Empresa) — 'header' empurra o resto do
  // documento pra baixo (banner escuro existente + tudo que deriva de `infoY`); 'footer' só
  // precisa abrir espaço embaixo, sem mexer no topo (ver footerY mais abaixo).
  const brandH = getBrandBandHeight(companyProfile, 'mm');
  const isHeaderBrand = brandH > 0 && companyProfile?.exportPosition === 'header';
  const isFooterBrand = brandH > 0 && companyProfile?.exportPosition === 'footer';
  const topOffset = isHeaderBrand ? brandH : 0;

  const customer = people.find(p => p.id === sale.customerId);
  const seller = people.find(p => p.id === sale.sellerId);
  const paymentMethod = paymentMethods.find(pm => pm.id === sale.paymentMethodId);

  // Colors
  const headerBgColor: [number, number, number] = [15, 23, 42]; // slate-900
  const labelColor: [number, number, number] = [100, 116, 139]; // slate-500
  const textColor: [number, number, number] = [30, 41, 59]; // slate-800

  // Header Banner
  doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.rect(0, topOffset, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const title = sale.status === 'QUOTE' ? 'Relatório de Orçamento' : 'Relatório de Pedido';
  doc.text(title, 105, topOffset + 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(sale.status === 'QUOTE' ? 'Proposta Comercial' : 'Venda Confirmada', 105, topOffset + 26, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Este documento não tem valor fiscal', 105, topOffset + 33, { align: 'center' });

  if (isHeaderBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 0, 210);

  // Info Section
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);

  const infoY = topOffset + 55;
  
  // Customer Info
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 20, infoY);
  doc.setFont('helvetica', 'normal');
  const customerName = customer?.name || 'Não informado';
  const splitCustomer = doc.splitTextToSize(customerName, 80);
  doc.text(splitCustomer, 45, infoY);
  
  // Date Info
  doc.setFont('helvetica', 'bold');
  doc.text('Data:', 130, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(sale.date), 'dd/MM/yyyy HH:mm'), 150, infoY);

  const nextY = infoY + (splitCustomer.length * 5) + 5;
  
  // Seller Info
  doc.setFont('helvetica', 'bold');
  doc.text('Vendedor:', 20, nextY);
  doc.setFont('helvetica', 'normal');
  doc.text(seller?.name || 'Não informado', 45, nextY);

  // Payment Info
  doc.setFont('helvetica', 'bold');
  doc.text('Pagamento:', 130, nextY);
  doc.setFont('helvetica', 'normal');
  doc.text(paymentMethod?.name || 'A definir', 160, nextY);

  // Products Table
  const tableData = sale.items.map(item => {
    const product = products.find(p => p.id === item.productId);
    const variation = product?.variations?.find(v => v.id === item.variationId);
    const prodName = product?.name || 'Produto não encontrado';
    const prodRef = product?.reference || '---';
    const variationInfo = variation ? ` - ${variation.colorName}` : '';
    
    return [
      {
        content: `${item.quantity}x ${prodRef} ${prodName}${variationInfo}`,
        styles: { textColor: labelColor }
      },
      `R$ ${(item.quantity * item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ];
  });

  (sale.extraItems || []).forEach(extra => {
    tableData.push([
      { content: extra.description, styles: { textColor: labelColor } },
      `R$ ${extra.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);
  });

  autoTable(doc, {
    startY: nextY + 15,
    head: [['Produto / Descrição', 'Total']],
    body: tableData,
    theme: 'plain',
    headStyles: { fillColor: [248, 250, 252], textColor: labelColor, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9, cellPadding: 4, textColor: textColor },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
    }
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY + 10;

  // Financial Summary
  const summaryX = 130;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Resumo Financeiro', summaryX, tableFinalY);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', summaryX, tableFinalY + 7);
  doc.text(`R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY + 7, { align: 'right' });
  
  doc.setTextColor(220, 38, 38);
  doc.text('Desconto:', summaryX, tableFinalY + 13);
  doc.text(`- R$ ${(sale.discount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY + 13, { align: 'right' });
  
  doc.setDrawColor(200);
  doc.line(summaryX, tableFinalY + 16, 190, tableFinalY + 16);
  
  doc.setTextColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', summaryX, tableFinalY + 23);
  doc.text(`R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, tableFinalY + 23, { align: 'right' });

  // Observations
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

  // Footer — sobe pra abrir espaço pra faixa da empresa quando ela estiver no rodapé.
  const footerTextY = isFooterBrand ? 297 - brandH - 6 : 285;
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, footerTextY, { align: 'center' });

  if (isFooterBrand && companyProfile) drawCompanyBrandingOnPdf(doc, companyProfile, 297 - brandH, 210);

  if (preview) return doc.output('datauristring');
  await sharePDF(doc, filename);
}

async function generateJPG(data: ExportData, filename: string, preview?: boolean): Promise<string | void> {
  const { sale, products, people, paymentMethods, additionalNote, showThumbnails, companyProfile } = data;
  const customer = people.find(p => p.id === sale.customerId);
  const paymentMethod = paymentMethods.find(pm => pm.id === sale.paymentMethodId);
  const brandH = getBrandBandHeight(companyProfile, 'px');
  const isHeaderBrand = brandH > 0 && companyProfile?.exportPosition === 'header';
  const isFooterBrand = brandH > 0 && companyProfile?.exportPosition === 'footer';

  const W = 600;
  const S = 2;
  const pad = 24;
  const THUMB_SIZE = 40;
  const THUMB_GAP = 12;

  // Helper: word-wrap text to fit maxWidth
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

  // Measure canvas for pre-calc
  const mc = document.createElement('canvas');
  mc.width = W * S; mc.height = 10;
  const mx = mc.getContext('2d')!;
  mx.scale(S, S);

  const thumbColW = showThumbnails ? THUMB_SIZE + THUMB_GAP : 0;
  const DESC_W = W - pad * 2 - 130 - thumbColW;
  const itemData = sale.items.map(item => {
    const product = products.find(p => p.id === item.productId);
    const variation = product?.variations?.find(v => v.id === item.variationId);
    const name = `${item.quantity}x ${[product?.reference, product?.name].filter(Boolean).join(' ') || '---'}${variation ? ` - ${variation.colorName}` : ''}`;
    const total = `R$ ${(item.quantity * item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const photoUrl = variation?.photoUrl || product?.photoUrl;
    mx.font = '500 13px Arial';
    const lines = wrapText(mx, name, DESC_W - 12);
    return { lines, total, rowH: Math.max(46, lines.length * 19 + 24, showThumbnails ? THUMB_SIZE + 16 : 0), photoUrl: showThumbnails ? photoUrl : undefined };
  });
  (sale.extraItems || []).forEach(extra => {
    const total = `R$ ${extra.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    mx.font = '500 13px Arial';
    const lines = wrapText(mx, extra.description, DESC_W - 12);
    itemData.push({ lines, total, rowH: Math.max(46, lines.length * 19 + 24), photoUrl: undefined });
  });

  // Pré-carrega as fotos (uma vez por URL) antes de desenhar — canvas precisa da imagem já
  // carregada pro drawImage síncrono funcionar; foto que falhar/não existir cai no placeholder.
  const thumbImages = new Map<string, HTMLImageElement>();
  if (showThumbnails) {
    const urls = Array.from(new Set(itemData.map(i => i.photoUrl).filter((u): u is string => !!u)));
    await Promise.all(urls.map(async (url) => {
      const img = await loadThumbImage(url);
      if (img) thumbImages.set(url, img);
    }));
  }

  const noteLines: string[] = [];
  if (additionalNote) {
    mx.font = '500 13px Arial';
    additionalNote.split('\n').forEach(l => noteLines.push(...wrapText(mx, l || ' ', W - pad * 2 - 28)));
  }

  const HEADER_H = 88, INFO_H = 76, TH_H = 38;
  const itemsH = itemData.reduce((a, i) => a + i.rowH, 0);
  const TOTALS_H = 20 + 28 + (sale.discount ? 26 : 0) + (paymentMethod ? 22 : 0) + 16 + 42;
  const NOTES_H = noteLines.length ? 20 + noteLines.length * 19 + 24 : 0;
  const totalH = HEADER_H + INFO_H + TH_H + itemsH + TOTALS_H + NOTES_H + 28 + brandH;

  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = totalH * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  let y = 0;

  // Identidade da empresa (Mais > Personalizar Empresa) no topo, antes do resto do conteúdo.
  if (isHeaderBrand && companyProfile) {
    await drawCompanyBrandingOnCanvas(ctx, companyProfile, y, W);
    y += brandH;
  }

  // ── Header ──────────────────────────────────────────────────
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, y, W, HEADER_H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Sistema de Vendas', W / 2, y + 36);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(sale.status === 'QUOTE' ? 'Relatório de Orçamento' : 'Relatório de Pedido', W / 2, y + 58);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('Este documento não tem valor fiscal', W / 2, y + 75);
  y += HEADER_H;

  // ── Info box ─────────────────────────────────────────────────
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(pad, y + 10, W - pad * 2, INFO_H - 10);
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('CLIENTE', pad + 14, y + 26);
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(customer?.name || 'Não informado', pad + 14, y + 46, (W - pad * 2) / 2 - 10);
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('PEDIDO / DATA', W - pad - 14, y + 26);
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`#${sale.orderNumber}`, W - pad - 14, y + 46);
  ctx.font = '500 12px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText(format(new Date(sale.date), 'dd/MM/yyyy'), W - pad - 14, y + 64);
  y += INFO_H;

  // ── Table header ─────────────────────────────────────────────
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(pad, y, W - pad * 2, TH_H);
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('PRODUTO / DESCRIÇÃO', pad + 12, y + TH_H / 2 + 4);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL', W - pad - 12, y + TH_H / 2 + 4);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y + TH_H); ctx.lineTo(W - pad, y + TH_H); ctx.stroke();
  y += TH_H;

  // ── Rows ─────────────────────────────────────────────────────
  itemData.forEach((item, i) => {
    if (i % 2 === 1) { ctx.fillStyle = '#fafafa'; ctx.fillRect(pad, y, W - pad * 2, item.rowH); }

    let textX = pad + 12;
    if (showThumbnails) {
      const thumbY = y + (item.rowH - THUMB_SIZE) / 2;
      const img = item.photoUrl ? thumbImages.get(item.photoUrl) : undefined;
      const THUMB_RADIUS = 10;
      if (img) {
        ctx.save();
        roundedRectPath(ctx, pad + 12, thumbY, THUMB_SIZE, THUMB_SIZE, THUMB_RADIUS);
        ctx.clip();
        ctx.drawImage(img, pad + 12, thumbY, THUMB_SIZE, THUMB_SIZE);
        ctx.restore();
      } else {
        ctx.fillStyle = '#e2e8f0';
        roundedRectPath(ctx, pad + 12, thumbY, THUMB_SIZE, THUMB_SIZE, THUMB_RADIUS);
        ctx.fill();
      }
      textX = pad + 12 + THUMB_SIZE + THUMB_GAP;
    }

    const tY = y + (item.rowH - (item.lines.length - 1) * 19) / 2;
    ctx.font = '500 13px Arial'; ctx.fillStyle = '#475569'; ctx.textAlign = 'left';
    item.lines.forEach((line, li) => ctx.fillText(line, textX, tY + li * 19));
    ctx.font = 'bold 13px Arial'; ctx.fillStyle = '#0f172a'; ctx.textAlign = 'right';
    ctx.fillText(item.total, W - pad - 12, y + item.rowH / 2 + 5);
    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y + item.rowH); ctx.lineTo(W - pad, y + item.rowH); ctx.stroke();
    y += item.rowH;
  });

  // ── Totals ───────────────────────────────────────────────────
  y += 20;
  const tx = W - pad - 230;
  ctx.font = '500 13px Arial'; ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left'; ctx.fillText('Subtotal:', tx, y);
  ctx.textAlign = 'right'; ctx.fillText(`R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y);
  y += 28;
  if (sale.discount) {
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'left'; ctx.fillText('Desconto:', tx, y);
    ctx.textAlign = 'right'; ctx.fillText(`- R$ ${sale.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y);
    y += 26;
  }
  if (paymentMethod) {
    ctx.font = '500 12px Arial'; ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left'; ctx.fillText('Pagamento:', tx, y);
    ctx.textAlign = 'right'; ctx.fillText(paymentMethod.name, W - pad - 12, y);
    y += 22;
  }
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(tx, y + 4); ctx.lineTo(W - pad - 12, y + 4); ctx.stroke();
  y += 16;
  ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left'; ctx.fillText('Total:', tx, y + 26);
  ctx.textAlign = 'right'; ctx.fillText(`R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, W - pad - 12, y + 26);
  y += 42;

  // ── Notes ────────────────────────────────────────────────────
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

  if (isFooterBrand && companyProfile) {
    await drawCompanyBrandingOnCanvas(ctx, companyProfile, y, W);
    y += brandH;
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  if (preview) return dataUrl;
  await shareImage(dataUrl, filename);
}
