import os

content = """import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';

export interface PCPShareItem {
  orderNumber: string;
  reference: string;
  color: string;
  totalPairs: number;
  sizeGrid: { size: string; qty: number }[];
  sectorNotes: { sectorName: string; notes: string[] }[];
}

export interface PCPShareData {
  lotNumber: string;
  items: PCPShareItem[];
  additionalNote?: string;
  isDarkMode: boolean;
}

export async function generatePCPShareExport(data: PCPShareData, formatType: 'pdf' | 'jpg') {
  try {
    const filename = `Ficha_PCP_${data.lotNumber.replace(/[^a-zA-Z0-9]/g, '')}_${format(new Date(), 'yyyyMMdd_HHmm')}`;
    
    if (formatType === 'pdf') {
      await generatePDF(data, filename);
    } else {
      await generateJPG(data, filename);
    }
    return true;
  } catch (error) {
    console.error('Error generating PCP export:', error);
    toast.show('Erro ao gerar exportação', 'error');
    return false;
  }
}

async function generatePDF(data: PCPShareData, filename: string) {
  const { lotNumber, items, additionalNote } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Fonts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('GESTÃO PRO', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('SISTEMA DE PRODUÇÃO & PCP', 14, 28);

  // Info Box
  doc.setFillColor(220, 230, 255);
  doc.rect(130, 12, 66, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text('FICHA TÉCNICA – MATERIAIS E GRADE', 163, 17.5, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`LOTE: ${lotNumber} • EMISSÃO: ${format(new Date(), 'dd/MM/yyyy')}`, 196, 26, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  let currentY = 40;

  for (const item of items) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('PEDIDO / REFERÊNCIA', 14, currentY);
    doc.text('COR / VARIAÇÃO', 90, currentY);
    doc.text('TOTAL DE PARES', 160, currentY);

    currentY += 5;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`${item.orderNumber ? `[${item.orderNumber}] ` : ''}${item.reference || '---'}`, 14, currentY);
    doc.text(item.color || '---', 90, currentY);
    doc.text(`${item.totalPairs} Pares`, 160, currentY);
    
    currentY += 8;

    // Grade
    if (item.sizeGrid && item.sizeGrid.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('GRADE DETALHADA', 14, currentY);
      
      const head = [['Tamanho', ...item.sizeGrid.map(g => g.size), 'TOTAL']];
      const body = [['Pares', ...item.sizeGrid.map(g => g.qty.toString()), item.totalPairs.toString()]];

      autoTable(doc, {
        startY: currentY + 3,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { halign: 'center' },
        margin: { left: 14, right: 14 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Sector Notes
    if (item.sectorNotes && item.sectorNotes.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('INSTRUÇÕES POR SETOR', 14, currentY);
      currentY += 6;

      for (const sector of item.sectorNotes) {
        if (currentY > 270) { doc.addPage(); currentY = 20; }
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50);
        doc.text(sector.sectorName, 14, currentY);
        currentY += 5;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        for (const note of sector.notes) {
          const lines = doc.splitTextToSize(`• ${note}`, 180);
          for (const line of lines) {
            if (currentY > 280) { doc.addPage(); currentY = 20; }
            doc.text(line, 18, currentY);
            currentY += 5;
          }
        }
        currentY += 3;
      }
    }

    currentY += 6;
    doc.setDrawColor(200);
    doc.line(14, currentY, 196, currentY);
    currentY += 8;
  }

  if (additionalNote && additionalNote.trim()) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('OBSERVAÇÕES', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(additionalNote, 180);
    doc.text(lines, 14, currentY + 6);
  }

  doc.setFontSize(8);
  doc.setTextColor(180);
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Página ${i} de ${pageCount}  •  Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 290, { align: 'center' });
  }

  await sharePDF(doc, filename);
}

async function generateJPG(data: PCPShareData, filename: string) {
  const { lotNumber, items, additionalNote } = data;
  const W = 600;
  const pad = 24;
  let currentY = pad;

  // Measure pass
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const wrapText = (c: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (c.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  };

  currentY += 30; // header space
  
  for (const item of items) {
    currentY += 40; // Identificação
    if (item.sizeGrid && item.sizeGrid.length > 0) {
      currentY += 60; // Grade base size
    }
    if (item.sectorNotes && item.sectorNotes.length > 0) {
      currentY += 20;
      ctx.font = '14px Inter';
      for (const sector of item.sectorNotes) {
        currentY += 25;
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 20);
          currentY += lines.length * 20 + 5;
        }
      }
    }
    currentY += 20;
  }

  if (additionalNote && additionalNote.trim()) {
    currentY += 30;
    ctx.font = '14px Inter';
    const lines = wrapText(ctx, additionalNote, W - pad * 2);
    currentY += lines.length * 20 + 10;
  }
  
  currentY += 40; // footer
  const H = Math.max(800, currentY);

  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Draw Header
  let y = pad;
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 24px Inter';
  ctx.fillText('GESTÃO PRO', pad, y + 20);
  
  ctx.fillStyle = '#64748b';
  ctx.font = '600 12px Inter';
  ctx.fillText('SISTEMA DE PRODUÇÃO & PCP', pad, y + 36);

  ctx.fillStyle = '#e0e7ff';
  ctx.beginPath();
  ctx.roundRect(W - pad - 220, y + 2, 220, 22, 4);
  ctx.fill();
  
  ctx.fillStyle = '#1e1b4b';
  ctx.font = '800 11px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('FICHA TÉCNICA – MATERIAIS E GRADE', W - pad - 110, y + 17);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`LOTE: ${lotNumber} • EMISSÃO: ${format(new Date(), 'dd/MM/yyyy')}`, W - pad, y + 42);

  y += 50;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  y += 20;

  // Draw Items
  ctx.textAlign = 'left';
  for (const item of items) {
    ctx.fillStyle = '#64748b';
    ctx.font = '800 10px Inter';
    ctx.fillText('PEDIDO / REFERÊNCIA', pad, y);
    ctx.fillText('COR / VARIAÇÃO', pad + 200, y);
    ctx.fillText('TOTAL DE PARES', W - pad - 120, y);

    y += 18;
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 14px Inter';
    ctx.fillText(`${item.orderNumber ? `[${item.orderNumber}] ` : ''}${item.reference || '---'}`, pad, y);
    ctx.fillText(item.color || '---', pad + 200, y);
    ctx.fillText(`${item.totalPairs} Pares`, W - pad - 120, y);
    
    y += 25;

    // Grade
    if (item.sizeGrid && item.sizeGrid.length > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 12px Inter';
      ctx.fillText('GRADE DETALHADA', pad, y);
      y += 15;

      const cols = item.sizeGrid.length + 2;
      const cellW = (W - pad * 2) / cols;
      const hBase = 24;

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(pad, y, W - pad * 2, hBase);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(pad, y, W - pad * 2, hBase);
      ctx.strokeRect(pad, y + hBase, W - pad * 2, hBase);
      
      for(let c = 1; c < cols; c++) {
        ctx.beginPath(); ctx.moveTo(pad + c * cellW, y); ctx.lineTo(pad + c * cellW, y + hBase * 2); ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 11px Inter';
      
      const head = ['Tamanho', ...item.sizeGrid.map(g => g.size), 'TOTAL'];
      head.forEach((txt, i) => ctx.fillText(txt, pad + i * cellW + cellW / 2, y + hBase / 2));
      
      const body = ['Pares', ...item.sizeGrid.map(g => g.qty.toString()), item.totalPairs.toString()];
      body.forEach((txt, i) => ctx.fillText(txt, pad + i * cellW + cellW / 2, y + hBase + hBase / 2));
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      y += hBase * 2 + 25;
    }

    // Sector Notes
    if (item.sectorNotes && item.sectorNotes.length > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 12px Inter';
      ctx.fillText('INSTRUÇÕES POR SETOR', pad, y);
      y += 20;

      for (const sector of item.sectorNotes) {
        ctx.fillStyle = '#475569';
        ctx.font = '800 11px Inter';
        ctx.fillText(sector.sectorName, pad, y);
        y += 16;

        ctx.fillStyle = '#0f172a';
        ctx.font = '500 12px Inter';
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 20);
          for (const line of lines) {
            ctx.fillText(line, pad + 10, y);
            y += 18;
          }
        }
        y += 10;
      }
    }

    y += 10;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    y += 20;
  }

  if (additionalNote && additionalNote.trim()) {
    ctx.fillStyle = '#64748b';
    ctx.font = '800 11px Inter';
    ctx.fillText('OBSERVAÇÕES', pad, y);
    y += 18;
    
    ctx.fillStyle = '#0f172a';
    ctx.font = '500 13px Inter';
    const lines = wrapText(ctx, additionalNote, W - pad * 2);
    for (const line of lines) {
      ctx.fillText(line, pad, y);
      y += 18;
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 10px Inter';
  ctx.fillText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, W / 2, H - 20);

  await shareImage(canvas, filename);
}
"""

with open("src/utils/pcpShareExport.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("pcpShareExport.ts created")
