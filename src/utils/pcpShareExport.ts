import jsPDF from 'jspdf';
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
  showTotalGrid?: boolean;
  showMaterials?: boolean;
  showItemGrid?: boolean;
  showSectorNotes?: boolean;
  showOrderList?: boolean;
}

export async function generatePCPShareExport(data: PCPShareData, formatType: 'pdf' | 'jpg', previewOnly: boolean = false): Promise<boolean | string> {
  try {
    const filename = `Ficha_PCP_${data.lotNumber.replace(/[^a-zA-Z0-9]/g, '')}_${format(new Date(), 'yyyyMMdd_HHmm')}`;
    
    if (formatType === 'pdf') {
      return await generatePDF(data, filename, previewOnly);
    } else {
      return await generateJPG(data, filename, previewOnly);
    }
  } catch (error) {
    console.error('Error generating PCP export:', error);
    toast.error('Erro ao gerar exportação');
    return false;
  }
}

async function generatePDF(data: PCPShareData, filename: string, previewOnly: boolean = false): Promise<boolean | string> {
  const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList } = data;
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
  doc.text('FICHA TÉCNICA - MATERIAIS E GRADE', 163, 17.5, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`LOTE: ${lotNumber} • EMISSÃO: ${format(new Date(), 'dd/MM/yyyy')}`, 196, 26, { align: 'right' });

  doc.setLineWidth(0.8);
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
    doc.text('REFERÊNCIA / MODELO', 14, currentY);
    doc.text('COR / VARIAÇÃO', 90, currentY);
    doc.text('TOTAL DE PARES', 160, currentY);

    currentY += 6;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`${item.reference || '---'} ${item.orderNumber ? `(${item.orderNumber})` : ''}`, 14, currentY);
    doc.text(item.color || '---', 90, currentY);
    doc.text(`${item.totalPairs} Pares`, 160, currentY);
    
    currentY += 12;

    if (showMaterials !== false) {
      // Materials Box (Empty)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('REQUISIÇÃO CONSOLIDADA DE MATERIAIS', 14, currentY);
      
      currentY += 4;
      autoTable(doc, {
        startY: currentY,
        head: [['CÓDIGO / NOME DO MATERIAL', 'REFERÊNCIA', 'CONSUMO TOTAL ESTIMADO']],
        body: [[{ content: 'Sem materiais cadastrados', colSpan: 3, styles: { halign: 'center', fontStyle: 'italic', textColor: 150 } }]],
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'left', fontSize: 8 },
        bodyStyles: { halign: 'center', fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // Grade
    if (showItemGrid !== false && item.sizeGrid && item.sizeGrid.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('GRADE DETALHADA DO MAPA', 14, currentY);
      
      const head = [['TAMANHO', ...item.sizeGrid.map(g => g.size), 'TOTAL']];
      const body = [['Pares', ...item.sizeGrid.map(g => g.qty.toString()), item.totalPairs.toString()]];

      autoTable(doc, {
        startY: currentY + 4,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'left', fontSize: 8 },
        bodyStyles: { halign: 'center', fontSize: 9, fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left' }, [head[0].length - 1]: { fillColor: [240, 240, 240] } },
        margin: { left: 14, right: 14 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

        // Sector Notes
    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('INSTRUÇÕES POR SETOR', 14, currentY);
      currentY += 4;

      for (const sector of item.sectorNotes) {
        // Measure height first to draw the capsule (card)
        let secHeight = 6;
        doc.setFontSize(9);
        const linesToDraw = [];
        for (const note of sector.notes) {
          const lines = doc.splitTextToSize(`• ${note}`, 174);
          linesToDraw.push(...lines);
        }
        secHeight += linesToDraw.length * 5 + 3;

        if (currentY + secHeight > 280) { doc.addPage(); currentY = 20; }

        // Draw card background
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(14, currentY, 182, secHeight, 2, 2, 'FD');

        currentY += 5;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50);
        doc.text(sector.sectorName.toUpperCase(), 17, currentY);
        currentY += 5;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        for (const line of linesToDraw) {
          doc.text(line, 17, currentY);
          currentY += 5;
        }
        currentY += 4; // Space between sector cards
      }
      currentY += 4;
    }

    // doc.setDrawColor(200);
    // doc.line(14, currentY, 196, currentY);
    // currentY += 8;
  }

  // TOTAL GRID (All grouped)
  if (showTotalGrid) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      
      // Compute total grid
      const totalSizeMap = new Map<string, number>();
      let overallPairs = 0;
      for (const item of items) {
          overallPairs += item.totalPairs;
          for (const g of item.sizeGrid) {
              totalSizeMap.set(g.size, (totalSizeMap.get(g.size) || 0) + g.qty);
          }
      }
      
      const totalSizes = Array.from(totalSizeMap.entries())
        .map(([size, qty]) => ({ size, qty }))
        .sort((a,b) => parseFloat(a.size) - parseFloat(b.size));

      if (totalSizes.length > 0) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0);
          doc.text('GRADE TOTAL DOS PEDIDOS AGRUPADOS', 14, currentY);
          
          const head = [['TAMANHO', ...totalSizes.map(g => g.size), 'TOTAL']];
          const body = [['Pares', ...totalSizes.map(g => g.qty.toString()), overallPairs.toString()]];

          autoTable(doc, {
            startY: currentY + 4,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'left', fontSize: 9 },
            bodyStyles: { halign: 'center', fontSize: 10, fontStyle: 'bold', fillColor: [248, 250, 252] },
            columnStyles: { 0: { halign: 'left' }, [head[0].length - 1]: { fillColor: [220, 230, 255] } },
            margin: { left: 14, right: 14 },
          });
          currentY = (doc as any).lastAutoTable.finalY + 12;
      }
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
    doc.text(`Página ${i} de ${pageCount}     Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 290, { align: 'center' });
  }

  if (previewOnly) {
    return doc.output('datauristring');
  }
  await sharePDF(doc, filename);
  return true;
}

async function generateJPG(data: PCPShareData, filename: string, previewOnly: boolean = false): Promise<boolean | string> {
  const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList } = data;
  const W = 900;
  const pad = 40;
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

  currentY += 40; // header space
  
  for (const item of items) {
    currentY += 40; // Identificação
    if (showMaterials !== false) { currentY += 80; } // Materiais Table
    if (showItemGrid !== false && item.sizeGrid && item.sizeGrid.length > 0) {
      currentY += 80; // Grade base size
    }
    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      currentY += 30;
      ctx.font = '16px Inter';
      for (const sector of item.sectorNotes) {
        currentY += 50; // card padding and sector title
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 40);
          currentY += lines.length * 24 + 5;
        }
        currentY += 25; // extra padding after card
      }
    }
    currentY += 30;
  }
  
  if (showTotalGrid) {
      currentY += 100;
  }

  if (additionalNote && additionalNote.trim()) {
    currentY += 40;
    ctx.font = '16px Inter';
    const lines = wrapText(ctx, additionalNote, W - pad * 2);
    currentY += lines.length * 24 + 10;
  }
  
  currentY += 50; // footer
  const H = Math.max(900, currentY);

  // Define escala para alta resolução (3x melhora muito a qualidade em celulares/zoom)
  const SCALE = 3;
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  
  // Applica escala no contexto
  ctx.scale(SCALE, SCALE);

  // Desativa image smoothing para melhor nitidez em fontes (opcional)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Draw Header
  let y = pad;
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 36px Inter';
  ctx.fillText('GESTÃO PRO', pad, y + 26);
  
  ctx.fillStyle = '#64748b';
  ctx.font = '700 16px Inter';
  ctx.letterSpacing = "2px";
  ctx.fillText('SISTEMA DE PRODUÇÃO & PCP', pad, y + 54);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = '#e0e7ff';
  ctx.beginPath();
  ctx.roundRect(W - pad - 320, y + 4, 320, 32, 6);
  ctx.fill();
  
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 14px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('FICHA TÉCNICA - MATERIAIS E GRADE', W - pad - 160, y + 25);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 14px Inter';
  ctx.fillText(`LOTE: ${lotNumber} • EMISSÃO: ${format(new Date(), 'dd/MM/yyyy')}`, W - pad, y + 60);

  y += 70;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
  y += 30;

  // Draw Items
  ctx.textAlign = 'left';
  for (const item of items) {
    ctx.fillStyle = '#64748b';
    ctx.font = '800 12px Inter';
    ctx.fillText('REFERÊNCIA / MODELO', pad, y);
    ctx.fillText('COR / VARIAÇÃO', pad + 350, y);
    ctx.fillText('TOTAL DE PARES', W - pad - 180, y);

    y += 24;
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 18px Inter';
    ctx.fillText(`${item.reference || '---'} ${item.orderNumber ? `(${item.orderNumber})` : ''}`, pad, y);
    ctx.fillText(item.color || '---', pad + 350, y);
    ctx.fillText(`${item.totalPairs} Pares`, W - pad - 180, y);
    
    y += 35;

    if (showMaterials !== false) {
      // Materials Empy Table
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 16px Inter';
      ctx.fillText('REQUISIÇÃO CONSOLIDADA DE MATERIAIS', pad, y);
      y += 20;

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(pad, y, W - pad * 2, 30);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(pad, y, W - pad * 2, 30);
      ctx.strokeRect(pad, y + 30, W - pad * 2, 36);
      
      // Draw columns
      ctx.beginPath(); ctx.moveTo(pad + (W - pad * 2)*0.6, y); ctx.lineTo(pad + (W - pad * 2)*0.6, y + 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad + (W - pad * 2)*0.8, y); ctx.lineTo(pad + (W - pad * 2)*0.8, y + 30); ctx.stroke();
      
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 12px Inter';
      ctx.textBaseline = 'middle';
      ctx.fillText('CÓDIGO / NOME DO MATERIAL', pad + 10, y + 15);
      ctx.fillText('REFERÊNCIA', pad + (W - pad * 2)*0.6 + 10, y + 15);
      ctx.textAlign = 'center';
      ctx.fillText('CONSUMO TOTAL ESTIMADO', pad + (W - pad * 2)*0.9, y + 15);
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 500 14px Inter';
      ctx.fillText('Sem materiais cadastrados', W / 2, y + 30 + 18);
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      y += 90;
    }

    // Grade
    if (showItemGrid !== false && item.sizeGrid && item.sizeGrid.length > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 16px Inter';
      ctx.fillText('GRADE DETALHADA DO MAPA', pad, y);
      y += 20;

      const cols = item.sizeGrid.length + 2;
      const cellW = (W - pad * 2) / cols;
      const hBase = 32;

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(pad, y, W - pad * 2, hBase);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(pad, y, W - pad * 2, hBase);
      ctx.strokeRect(pad, y + hBase, W - pad * 2, hBase);
      
      for(let c = 1; c < cols; c++) {
        ctx.beginPath(); ctx.moveTo(pad + c * cellW, y); ctx.lineTo(pad + c * cellW, y + hBase * 2); ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      
      const head = ['TAMANHO', ...item.sizeGrid.map(g => g.size), 'TOTAL'];
      ctx.font = '800 13px Inter';
      // First column text left-aligned conceptually, but let's center it for simplicity like the image? Wait, the image left-aligned TAMANHO.
      ctx.textAlign = 'left';
      ctx.fillText('TAMANHO', pad + 10, y + hBase / 2);
      ctx.textAlign = 'center';
      for(let i=1; i<head.length; i++) ctx.fillText(head[i], pad + i * cellW + cellW / 2, y + hBase / 2);
      
      const body = ['Pares', ...item.sizeGrid.map(g => g.qty.toString()), item.totalPairs.toString()];
      ctx.font = '900 14px Inter';
      ctx.textAlign = 'left';
      ctx.fillText('Pares', pad + 10, y + hBase + hBase / 2);
      ctx.textAlign = 'center';
      for(let i=1; i<body.length; i++) ctx.fillText(body[i], pad + i * cellW + cellW / 2, y + hBase + hBase / 2);
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      y += hBase * 2 + 35;
    }

    // Sector Notes
    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 16px Inter';
      ctx.fillText('INSTRUÇÕES POR SETOR', pad, y);
      y += 26;

      for (const sector of item.sectorNotes) {
        // Measure height for this sector's card
        let sectorHeight = 40; // Sector name height + padding
        ctx.font = '500 15px Inter';
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 40);
          sectorHeight += lines.length * 24 + 5;
        }
        
        // Draw card background
        ctx.fillStyle = '#f8fafc'; // light slate
        ctx.strokeStyle = '#e2e8f0'; // border
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pad, y, W - pad * 2, sectorHeight, 12);
        ctx.fill();
        ctx.stroke();

        y += 25; // Move down for sector name
        ctx.fillStyle = '#475569';
        ctx.font = '900 14px Inter';
        ctx.fillText(sector.sectorName.toUpperCase(), pad + 20, y);
        y += 20;

        ctx.fillStyle = '#0f172a';
        ctx.font = '600 15px Inter';
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 40);
          for (const line of lines) {
            ctx.fillText(line, pad + 20, y);
            y += 24;
          }
          y += 5;
        }
        y += 15; // Space after card text
      }
    }
  }

  // TOTAL GRID (All grouped)
  if (showTotalGrid) {
      const totalSizeMap = new Map<string, number>();
      let overallPairs = 0;
      for (const item of items) {
          overallPairs += item.totalPairs;
          for (const g of item.sizeGrid) {
              totalSizeMap.set(g.size, (totalSizeMap.get(g.size) || 0) + g.qty);
          }
      }
      
      const totalSizes = Array.from(totalSizeMap.entries())
        .map(([size, qty]) => ({ size, qty }))
        .sort((a,b) => parseFloat(a.size) - parseFloat(b.size));

      if (totalSizes.length > 0) {
          ctx.fillStyle = '#0f172a';
          ctx.font = '900 18px Inter';
          ctx.fillText('GRADE TOTAL DOS PEDIDOS AGRUPADOS', pad, y);
          y += 22;

          const cols = totalSizes.length + 2;
          const cellW = (W - pad * 2) / cols;
          const hBase = 36;

          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(pad, y, W - pad * 2, hBase);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1;
          ctx.strokeRect(pad, y, W - pad * 2, hBase);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(pad, y + hBase, W - pad * 2, hBase);
          ctx.strokeRect(pad, y + hBase, W - pad * 2, hBase);
          
          for(let c = 1; c < cols; c++) {
            ctx.beginPath(); ctx.moveTo(pad + c * cellW, y); ctx.lineTo(pad + c * cellW, y + hBase * 2); ctx.stroke();
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#0f172a';
          
          const head = ['TAMANHO', ...totalSizes.map(g => g.size), 'TOTAL'];
          ctx.font = '800 14px Inter';
          ctx.textAlign = 'left';
          ctx.fillText('TAMANHO', pad + 10, y + hBase / 2);
          ctx.textAlign = 'center';
          for(let i=1; i<head.length; i++) ctx.fillText(head[i], pad + i * cellW + cellW / 2, y + hBase / 2);
          
          const body = ['Pares', ...totalSizes.map(g => g.qty.toString()), overallPairs.toString()];
          ctx.font = '900 16px Inter';
          ctx.textAlign = 'left';
          ctx.fillText('Pares', pad + 10, y + hBase + hBase / 2);
          ctx.textAlign = 'center';
          for(let i=1; i<body.length; i++) ctx.fillText(body[i], pad + i * cellW + cellW / 2, y + hBase + hBase / 2);
          
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          y += hBase * 2 + 45;
      }
  }

  if (additionalNote && additionalNote.trim()) {
    ctx.fillStyle = '#64748b';
    ctx.font = '800 14px Inter';
    ctx.fillText('OBSERVAÇÕES', pad, y);
    y += 24;
    
    ctx.fillStyle = '#0f172a';
    ctx.font = '500 16px Inter';
    const lines = wrapText(ctx, additionalNote, W - pad * 2);
    for (const line of lines) {
      ctx.fillText(line, pad, y);
      y += 24;
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 12px Inter';
  ctx.fillText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, W / 2, H - 25);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  if (previewOnly) return dataUrl;
  await shareImage(dataUrl, filename);
  return true;
}
