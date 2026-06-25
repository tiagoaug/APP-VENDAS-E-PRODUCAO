import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { sharePDF, shareImage } from './pdfExport';
import { toast } from './toast';
import { openPrintStudio } from '../lib/printStudio';

export interface PCPShareItem {
  orderNumber: string;
  reference: string;
  color: string;
  totalPairs: number;
  sizeGrid: { size: string; qty: number }[];
  sectorNotes: { sectorName: string; notes: string[] }[];
  // Dados da Ordem de Serviço que originou este item (quando aplicável) — usados
  // pelas opções "Exibir Prestador de Serviço" e "Exibir Dados da OS".
  osNumber?: string;
  providerName?: string;
  osValue?: number;
  osDate?: number;
  osSectorName?: string;
  // Detalhes de Setor > Separação de Solas por Ficha (Montagem) — molde(s)/cor(es)
  // de solado que este pedido consome e a grade de numeração correspondente. É uma
  // lista porque, depois de agrupar por Referência, um mesmo item pode reunir
  // pedidos de cores diferentes que usam solados diferentes entre si.
  soleInfo?: {
    moldName: string;
    colorName: string;
    sizeGrid: { size: string; qty: number }[];
    totalPairs: number;
  }[];
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
  /** Quando true (só JPG), divide a imagem longa em várias imagens no estilo de página A4 */
  splitPages?: boolean;
  /** Exibe o nome do prestador de serviço da OS de origem do item */
  showProvider?: boolean;
  /** Exibe valor, data e setor da OS de origem do item */
  showOSData?: boolean;
  /** Detalhes de Setor > Exibe a grade de solado (molde/cor/numeração) necessária por pedido */
  showSoleGrid?: boolean;
}

export async function generatePCPShareExport(data: PCPShareData, formatType: 'pdf' | 'jpg', previewOnly: boolean = false): Promise<boolean | string[]> {
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

async function generatePDF(data: PCPShareData, filename: string, previewOnly: boolean = false): Promise<boolean | string[]> {
  const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, showProvider, showOSData, showSoleGrid } = data;
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

  // LOTE/EMISSÃO numa linha própria, em largura total — antes ficava à direita, na
  // mesma faixa vertical de "SISTEMA DE PRODUÇÃO & PCP", e sobrepunha esse texto quando
  // o lote reunia vários números (ex.: vários pedidos do mesmo lote agrupados).
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60);
  const loteLines = doc.splitTextToSize(`LOTE: ${lotNumber}  •  EMISSÃO: ${format(new Date(), 'dd/MM/yyyy')}`, 182);
  doc.text(loteLines, 14, 36);

  const dividerY = 36 + (loteLines.length - 1) * 4 + 4;
  doc.setLineWidth(0.8);
  doc.line(14, dividerY, 196, dividerY);

  let currentY = dividerY + 8;

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

    currentY += 8;

    if (showProvider && item.providerName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('PRESTADOR DE SERVIÇO', 14, currentY);
      currentY += 4.5;
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(item.providerName, 14, currentY);
      currentY += 5;
    }

    if (showOSData && item.osNumber) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80);
      const osLine = [
        item.osNumber,
        item.osSectorName ? `Setor: ${item.osSectorName}` : null,
        item.osValue != null ? `Valor: R$ ${item.osValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null,
        item.osDate ? `Data: ${format(new Date(item.osDate), 'dd/MM/yyyy')}` : null,
      ].filter(Boolean).join('  •  ');
      doc.text(osLine, 14, currentY);
      currentY += 5;
    }

    currentY += 4;

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
      doc.text('GRADE DETALHADA DO PEDIDO', 14, currentY);
      
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

    // Grade de Solado (Detalhes de Setor > Separação de Solas por Ficha — Montagem)
    // — um bloco por molde/cor de solado distinto (pode haver mais de um quando o
    // item reúne pedidos agrupados que usam solados diferentes).
    if (showSoleGrid && item.soleInfo && item.soleInfo.length > 0) {
      for (const sole of item.soleInfo) {
        if (sole.sizeGrid.length === 0) continue;
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        const soleTitle = `SOLADO NECESSÁRIO — ${sole.moldName}${sole.colorName ? ` (${sole.colorName})` : ''}`.toUpperCase();
        doc.text(soleTitle, 14, currentY);

        const headSole = [['NUMERAÇÃO', ...sole.sizeGrid.map(g => g.size), 'TOTAL']];
        const bodySole = [['Pares', ...sole.sizeGrid.map(g => g.qty.toString()), sole.totalPairs.toString()]];

        autoTable(doc, {
          startY: currentY + 4,
          head: headSole,
          body: bodySole,
          theme: 'grid',
          headStyles: { fillColor: [255, 237, 213], textColor: 0, fontStyle: 'bold', halign: 'left', fontSize: 8 },
          bodyStyles: { halign: 'center', fontSize: 9, fontStyle: 'bold' },
          columnStyles: { 0: { halign: 'left' }, [headSole[0].length - 1]: { fillColor: [255, 237, 213] } },
          margin: { left: 14, right: 14 },
        });
        currentY = (doc as any).lastAutoTable.finalY + 12;
      }
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

  // TOTAL GRID (All grouped) — só faz sentido com mais de um item; com um só, o
  // total seria idêntico à grade do próprio item e apareceria como duplicado.
  if (showTotalGrid && items.length > 1) {
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
    // Um único PDF já carrega todas as páginas internamente — o próprio
    // visualizador (iframe) deixa navegar entre elas, sem precisar de array aqui.
    return [doc.output('datauristring')];
  }
  await sharePDF(doc, filename);
  return true;
}

async function generateJPG(data: PCPShareData, filename: string, previewOnly: boolean = false): Promise<boolean | string[]> {
  const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, splitPages, showProvider, showOSData, showSoleGrid } = data;
  const W = 900;
  const pad = 40;
  const SCALE = 3; // 3x melhora muito a qualidade em celulares/zoom

  const measureCtx = document.createElement('canvas').getContext('2d')!;

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

  // Altura de cada item individualmente — usada pra agrupar itens inteiros por
  // página (nenhum item é cortado no meio) quando "Dividir em Páginas" está ligado.
  const measureItemHeight = (item: PCPShareItem): number => {
    let h = 40; // Identificação
    if (showProvider && item.providerName) h += 38;
    if (showOSData && item.osNumber) h += 24;
    if (showMaterials !== false) h += 80;
    if (showItemGrid !== false && item.sizeGrid && item.sizeGrid.length > 0) h += 80;
    if (showSoleGrid && item.soleInfo) h += item.soleInfo.filter(s => s.sizeGrid.length > 0).length * 80;
    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      h += 30;
      measureCtx.font = '16px Inter';
      for (const sector of item.sectorNotes) {
        h += 50;
        for (const note of sector.notes) {
          const lines = wrapText(measureCtx, `• ${note}`, W - pad * 2 - 40);
          h += lines.length * 24 + 5;
        }
        h += 25;
      }
    }
    h += 30;
    return h;
  };

  const itemHeights = items.map(measureItemHeight);

  let totalGridH = 0;
  if (showTotalGrid && items.length > 1) totalGridH = 100;

  const noteLines: string[] = [];
  if (additionalNote && additionalNote.trim()) {
    measureCtx.font = '16px Inter';
    additionalNote.split('\n').forEach(l => noteLines.push(...wrapText(measureCtx, l || ' ', W - pad * 2)));
  }
  const notesH = noteLines.length ? 40 + noteLines.length * 24 + 10 : 0;

  // Linha "LOTE: ... • EMISSÃO: ..." numa linha própria, embaixo do título (ver
  // desenho mais abaixo) — quebra em várias linhas quando o lote reúne vários números
  // (antes ficava à direita, na mesma faixa de "SISTEMA DE PRODUÇÃO & PCP", e sobrepunha
  // esse texto quando o lote ficava longo). A altura do header cresce conforme precisar.
  measureCtx.font = '700 13px Inter';
  const loteLineCount = wrapText(measureCtx, `LOTE: ${lotNumber} • EMISSÃO: ${format(new Date(), 'dd/MM/yyyy')}`, W - pad * 2).length;
  const HEADER_OVERHEAD = 120 + loteLineCount * 18; // header + linha do lote + linha divisória
  const FOOTER_H = 50;

  // Agrupa itens em páginas — só quebra ENTRE itens, nunca no meio de um.
  // Sem "Dividir em Páginas" (ou se tudo já cabe numa altura de A4), uma página só.
  const PAGE_H = Math.round(W * Math.SQRT2);
  const pages: PCPShareItem[][] = [];
  if (splitPages) {
    const budget = PAGE_H - HEADER_OVERHEAD - FOOTER_H;
    let current: PCPShareItem[] = [];
    let currentH = 0;
    items.forEach((item, idx) => {
      const ih = itemHeights[idx];
      if (current.length > 0 && currentH + ih > budget) {
        pages.push(current);
        current = [];
        currentH = 0;
      }
      current.push(item);
      currentH += ih;
    });
    if (current.length > 0 || pages.length === 0) pages.push(current);

    // Totais/observações só entram na última página; se não couberem no que resta
    // dela, ganham uma página própria em branco (sem cortar o conteúdo da grade total).
    const lastPageH = pages[pages.length - 1].reduce((acc, it) => acc + itemHeights[items.indexOf(it)], 0);
    if (lastPageH + totalGridH + notesH > budget && pages[pages.length - 1].length > 0) {
      pages.push([]);
    }
  } else {
    pages.push(items);
  }

  const drawPage = (pageItems: PCPShareItem[], isLastPage: boolean): HTMLCanvasElement => {
    const pageItemsH = pageItems.reduce((acc, it) => acc + itemHeights[items.indexOf(it)], 0);
    let logicalH = pad + HEADER_OVERHEAD + pageItemsH + FOOTER_H;
    if (isLastPage) logicalH += totalGridH + notesH;
    logicalH = Math.max(400, logicalH);

    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = logicalH * SCALE;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SCALE, SCALE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, logicalH);

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

    // LOTE/EMISSÃO numa linha própria, em largura total, abaixo do título — antes
    // ficava à direita na mesma faixa de "SISTEMA DE PRODUÇÃO & PCP" e sobrepunha esse
    // texto quando o lote reunia vários números (texto longo).
    y += 70;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '700 13px Inter';
    const pageLabel = pages.length > 1 ? ` • PÁG. ${pages.indexOf(pageItems) + 1}/${pages.length}` : '';
    const loteLines = wrapText(ctx, `LOTE: ${lotNumber} • EMISSÃO: ${format(new Date(), 'dd/MM/yyyy')}${pageLabel}`, W - pad * 2);
    loteLines.forEach((line, i) => ctx.fillText(line, pad, y + i * 18));
    y += loteLines.length * 18 + 14;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    y += 30;

    // Draw Items
    ctx.textAlign = 'left';
    for (const item of pageItems) {
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

      y += 26;

      if (showProvider && item.providerName) {
        ctx.fillStyle = '#64748b';
        ctx.font = '800 11px Inter';
        ctx.fillText('PRESTADOR DE SERVIÇO', pad, y);
        y += 18;
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 14px Inter';
        ctx.fillText(item.providerName, pad, y);
        y += 20;
      }

      if (showOSData && item.osNumber) {
        const osLine = [
          item.osNumber,
          item.osSectorName ? `Setor: ${item.osSectorName}` : null,
          item.osValue != null ? `Valor: R$ ${item.osValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null,
          item.osDate ? `Data: ${format(new Date(item.osDate), 'dd/MM/yyyy')}` : null,
        ].filter(Boolean).join('   •   ');
        ctx.fillStyle = '#475569';
        ctx.font = '600 13px Inter';
        ctx.fillText(osLine, pad, y);
        y += 24;
      }

      y += 9;

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

        ctx.beginPath(); ctx.moveTo(pad + (W - pad * 2) * 0.6, y); ctx.lineTo(pad + (W - pad * 2) * 0.6, y + 30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad + (W - pad * 2) * 0.8, y); ctx.lineTo(pad + (W - pad * 2) * 0.8, y + 30); ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = '800 12px Inter';
        ctx.textBaseline = 'middle';
        ctx.fillText('CÓDIGO / NOME DO MATERIAL', pad + 10, y + 15);
        ctx.fillText('REFERÊNCIA', pad + (W - pad * 2) * 0.6 + 10, y + 15);
        ctx.textAlign = 'center';
        ctx.fillText('CONSUMO TOTAL ESTIMADO', pad + (W - pad * 2) * 0.9, y + 15);

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
        ctx.fillText('GRADE DETALHADA DO PEDIDO', pad, y);
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

        for (let c = 1; c < cols; c++) {
          ctx.beginPath(); ctx.moveTo(pad + c * cellW, y); ctx.lineTo(pad + c * cellW, y + hBase * 2); ctx.stroke();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';

        const head = ['TAMANHO', ...item.sizeGrid.map(g => g.size), 'TOTAL'];
        ctx.font = '800 13px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('TAMANHO', pad + 10, y + hBase / 2);
        ctx.textAlign = 'center';
        for (let i = 1; i < head.length; i++) ctx.fillText(head[i], pad + i * cellW + cellW / 2, y + hBase / 2);

        const body = ['Pares', ...item.sizeGrid.map(g => g.qty.toString()), item.totalPairs.toString()];
        ctx.font = '900 14px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('Pares', pad + 10, y + hBase + hBase / 2);
        ctx.textAlign = 'center';
        for (let i = 1; i < body.length; i++) ctx.fillText(body[i], pad + i * cellW + cellW / 2, y + hBase + hBase / 2);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        y += hBase * 2 + 35;
      }

      // Grade de Solado (Detalhes de Setor > Separação de Solas por Ficha — Montagem)
      // — um bloco por molde/cor de solado distinto.
      if (showSoleGrid && item.soleInfo && item.soleInfo.length > 0) {
        for (const sole of item.soleInfo) {
          if (sole.sizeGrid.length === 0) continue;
          ctx.fillStyle = '#0f172a';
          ctx.font = '900 16px Inter';
          const soleTitle = `SOLADO NECESSÁRIO — ${sole.moldName}${sole.colorName ? ` (${sole.colorName})` : ''}`.toUpperCase();
          ctx.fillText(soleTitle, pad, y);
          y += 20;

          const soleCols = sole.sizeGrid.length + 2;
          const soleCellW = (W - pad * 2) / soleCols;
          const soleHBase = 32;

          ctx.fillStyle = '#ffedd5';
          ctx.fillRect(pad, y, W - pad * 2, soleHBase);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1;
          ctx.strokeRect(pad, y, W - pad * 2, soleHBase);
          ctx.strokeRect(pad, y + soleHBase, W - pad * 2, soleHBase);

          for (let c = 1; c < soleCols; c++) {
            ctx.beginPath(); ctx.moveTo(pad + c * soleCellW, y); ctx.lineTo(pad + c * soleCellW, y + soleHBase * 2); ctx.stroke();
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#0f172a';

          const soleHead = ['NUMERAÇÃO', ...sole.sizeGrid.map(g => g.size), 'TOTAL'];
          ctx.font = '800 13px Inter';
          ctx.textAlign = 'left';
          ctx.fillText('NUMERAÇÃO', pad + 10, y + soleHBase / 2);
          ctx.textAlign = 'center';
          for (let i = 1; i < soleHead.length; i++) ctx.fillText(soleHead[i], pad + i * soleCellW + soleCellW / 2, y + soleHBase / 2);

          const soleBody = ['Pares', ...sole.sizeGrid.map(g => g.qty.toString()), sole.totalPairs.toString()];
          ctx.font = '900 14px Inter';
          ctx.textAlign = 'left';
          ctx.fillText('Pares', pad + 10, y + soleHBase + soleHBase / 2);
          ctx.textAlign = 'center';
          for (let i = 1; i < soleBody.length; i++) ctx.fillText(soleBody[i], pad + i * soleCellW + soleCellW / 2, y + soleHBase + soleHBase / 2);

          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          y += soleHBase * 2 + 35;
        }
      }

      // Sector Notes
      if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 16px Inter';
        ctx.fillText('INSTRUÇÕES POR SETOR', pad, y);
        y += 26;

        for (const sector of item.sectorNotes) {
          let sectorHeight = 40;
          ctx.font = '500 15px Inter';
          for (const note of sector.notes) {
            const lines = wrapText(ctx, `• ${note}`, W - pad * 2 - 40);
            sectorHeight += lines.length * 24 + 5;
          }

          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(pad, y, W - pad * 2, sectorHeight, 12);
          ctx.fill();
          ctx.stroke();

          y += 25;
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
          y += 15;
        }
      }
    }

    // TOTAL GRID (All grouped) — só na última página, e só com mais de um item
    // (com um só, o total seria idêntico à grade do próprio item — duplicado)
    if (isLastPage && showTotalGrid && items.length > 1) {
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
        .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

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

        for (let c = 1; c < cols; c++) {
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
        for (let i = 1; i < head.length; i++) ctx.fillText(head[i], pad + i * cellW + cellW / 2, y + hBase / 2);

        const body = ['Pares', ...totalSizes.map(g => g.qty.toString()), overallPairs.toString()];
        ctx.font = '900 16px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('Pares', pad + 10, y + hBase + hBase / 2);
        ctx.textAlign = 'center';
        for (let i = 1; i < body.length; i++) ctx.fillText(body[i], pad + i * cellW + cellW / 2, y + hBase + hBase / 2);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        y += hBase * 2 + 45;
      }
    }

    if (isLastPage && additionalNote && additionalNote.trim()) {
      ctx.fillStyle = '#64748b';
      ctx.font = '800 14px Inter';
      ctx.fillText('OBSERVAÇÕES', pad, y);
      y += 24;

      ctx.fillStyle = '#0f172a';
      ctx.font = '500 16px Inter';
      for (const line of noteLines) {
        ctx.fillText(line, pad, y);
        y += 24;
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 12px Inter';
    ctx.fillText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, W / 2, logicalH - 25);

    return canvas;
  };

  if (previewOnly) {
    // Renderiza as mesmas páginas reais que seriam compartilhadas (já considerando
    // "Dividir em Páginas") — assim a pré-visualização mostra exatamente onde cada
    // corte cai, em vez de empilhar tudo numa imagem só e escondê-los.
    return pages.map((pageItems, idx) => drawPage(pageItems, idx === pages.length - 1).toDataURL('image/jpeg', 0.9));
  }

  if (pages.length === 1) {
    await shareImage(drawPage(pages[0], true).toDataURL('image/jpeg', 0.9), filename);
    return true;
  }

  // Várias páginas: compartilha cada uma com um pequeno intervalo entre si — sem a
  // pausa, navegadores bloqueiam downloads automáticos disparados em sequência
  // rápida, fazendo só a primeira página sair e o restante ser descartado.
  for (let p = 0; p < pages.length; p++) {
    const isLast = p === pages.length - 1;
    await shareImage(drawPage(pages[p], isLast).toDataURL('image/jpeg', 0.9), `${filename}_pagina${p + 1}de${pages.length}`);
    if (p < pages.length - 1) await new Promise(resolve => setTimeout(resolve, 600));
  }
  return true;
}

// Gera a(s) imagem(ns) da(s) ficha(s) (mesmo motor de geração do JPG) e abre o Print
// Studio já com elas carregadas — usado pelos botões "Print Studio" do PCP (ficha,
// OS e Mapa). Salva em arquivo via Filesystem antes de abrir: a ponte JS↔nativo do
// Capacitor recebe só o caminho do arquivo, nunca o base64 bruto (que pode passar de
// vários MB por ficha e deixaria a chamada lenta/instável).
export async function sendPCPItemsToPrintStudio(
  items: PCPShareItem[],
  options: {
    isDarkMode: boolean;
    showTotalGrid?: boolean;
    showMaterials?: boolean;
    showItemGrid?: boolean;
    showSectorNotes?: boolean;
    showOrderList?: boolean;
    showProvider?: boolean;
    showOSData?: boolean;
    showSoleGrid?: boolean;
  },
): Promise<void> {
  if (items.length === 0) {
    toast.show('Nada para enviar ao Print Studio.');
    return;
  }
  try {
    const lotNumber = Array.from(new Set(items.map(i => i.orderNumber).filter(Boolean))).join(', ') || 'PCP';
    const result = await generatePCPShareExport(
      {
        lotNumber,
        items,
        isDarkMode: options.isDarkMode,
        showTotalGrid: options.showTotalGrid,
        showMaterials: options.showMaterials ?? true,
        showItemGrid: options.showItemGrid ?? true,
        showSectorNotes: options.showSectorNotes,
        showOrderList: options.showOrderList,
        showProvider: options.showProvider,
        showOSData: options.showOSData,
        showSoleGrid: options.showSoleGrid,
        // Print Studio recebe sempre a imagem completa, sem cortes — a divisão em
        // páginas é feita lá dentro (manualmente, com linhas de corte + blocos),
        // nunca antes de chegar lá.
        splitPages: false,
      },
      'jpg',
      true,
    );

    if (!Array.isArray(result) || result.length === 0) {
      toast.show('Não foi possível gerar a imagem da ficha.');
      return;
    }

    const uris: string[] = [];
    for (let i = 0; i < result.length; i++) {
      const dataUri = result[i];
      const base64 = dataUri.includes('base64,') ? dataUri.split('base64,')[1] : dataUri;
      const written = await Filesystem.writeFile({
        path: `printstudio_ficha_${Date.now()}_${i}.jpg`,
        data: base64,
        directory: Directory.Cache,
      });
      uris.push(written.uri);
    }

    await openPrintStudio(uris);
  } catch (error) {
    console.error('Error sending PCP items to Print Studio:', error);
    toast.show('Erro ao enviar ficha para o Print Studio.');
  }
}
