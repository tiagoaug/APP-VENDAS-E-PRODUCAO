import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Product, Variation, ProductionLot, LabelLayout, ProductionConfigItem, ServiceOrder } from '../types';
import { sharePDF } from '../utils/pdfExport';

export const labelService = {
  getDefaultLayout(dimensions: [number, number]): LabelLayout {
    const [w, h] = dimensions;
    return {
      refX: w / 2,
      refY: 5,
      refSize: 8,
      qrX: (w - 20) / 2,
      qrY: 6,
      qrSize: 20,
      colorX: w / 2,
      colorY: h - 3,
      colorSize: 7,
      footerX: 2,
      footerY: h - 1,
      footerSize: 4,
      showSize: true,
      sizeX: w - 7,
      sizeY: 7,
      sizeSize: 11
    };
  },

  async generateQRCode(text: string): Promise<string> {
    try {
      return await QRCode.toDataURL(text, { margin: 1, width: 200 });
    } catch (err) {
      console.error('Error generating QR Code', err);
      return '';
    }
  },

  // jsPDF só possui as fontes padrão helvetica/times/courier embutidas;
  // 'arial' e 'avenir' (Century Gothic) caem em helvetica, a mais próxima visualmente.
  toPdfFont(f?: string): 'helvetica' | 'times' | 'courier' {
    return f === 'times' ? 'times' : f === 'courier' ? 'courier' : 'helvetica';
  },

  renderGradePills(doc: jsPDF, sizeGrid: string, layout: LabelLayout) {
    if (!layout.showGrade || layout.gradeX === undefined || layout.gradeY === undefined || layout.gradeW === undefined || layout.gradeH === undefined) return;
    const entries = sizeGrid.split('-').map(tok => {
      const [sz, qtyStr] = tok.split('x');
      return { sz: sz || tok, qty: qtyStr ? parseInt(qtyStr) : null };
    }).filter(e => e.sz);
    if (entries.length === 0) return;
    const hasQty  = entries.some(e => e.qty !== null);
    const totalQty = entries.reduce((s, e) => s + (e.qty || 0), 0);
    const totalWidthFactor = 1.6;
    const totalUnits = entries.length + (hasQty ? totalWidthFactor : 0);
    const gX = layout.gradeX, gY = layout.gradeY, gW = layout.gradeW, gH = layout.gradeH;
    const cellW = gW / totalUnits;
    const totalCellW = cellW * totalWidthFactor;
    const szFontSz  = Math.min(10, Math.max(3, gH * (hasQty ? 0.42 : 0.62) * 2.8346));
    const qtyFontSz = Math.min(9,  Math.max(2, szFontSz * 0.90));
    const szH = hasQty ? gH * 0.48 : gH * 0.70;
    const pad = 0.4;
    const gradeFont = this.toPdfFont(layout.gradeFontFamily);
    entries.forEach(({ sz, qty }, i) => {
      const cellX = gX + cellW * i;
      const cx = cellX + cellW / 2;
      // Numeração: fundo preto + texto branco
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(cellX + pad, gY + pad, cellW - pad * 2, szH, 0.5, 0.5, 'F');
      doc.setFont(gradeFont, 'bold');
      doc.setFontSize(szFontSz);
      doc.setTextColor(255, 255, 255);
      doc.text(sz, cx, gY + szH * 0.72, { align: 'center' });
      // Valor: texto preto simples
      if (qty !== null) {
        doc.setFont(gradeFont, 'bold');
        doc.setFontSize(qtyFontSz);
        doc.setTextColor(0, 0, 0);
        doc.text(`${qty}`, cx, gY + szH + (gH - szH) * 0.72, { align: 'center' });
      }
    });

    // Célula TOTAL: soma das quantidades, mesmas cores das demais
    if (hasQty) {
      const cellX = gX + cellW * entries.length;
      const cx = cellX + totalCellW / 2;
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(cellX + pad, gY + pad, totalCellW - pad * 2, szH, 0.5, 0.5, 'F');
      doc.setFont(gradeFont, 'bold');
      doc.setFontSize(szFontSz * 0.65);
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL', cx, gY + szH * 0.72, { align: 'center' });
      doc.setFont(gradeFont, 'bold');
      doc.setFontSize(qtyFontSz);
      doc.setTextColor(0, 0, 0);
      doc.text(`${totalQty}`, cx, gY + szH + (gH - szH) * 0.72, { align: 'center' });
    }
  },

  renderSectorNotes(doc: jsPDF, layout: LabelLayout, text: string) {
    if (layout.sectorNotesX === undefined || layout.sectorNotesY === undefined) return;
    const fs = layout.sectorNotesSize ?? 3;
    const lineH = fs * 0.353 * 1.4;
    const font = this.toPdfFont(layout.sectorNotesFontFamily);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(fs);
    if (layout.sectorNotesHasHeader) {
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        const isHeader = i % 2 === 0;
        doc.setFont(font, isHeader ? 'bold' : 'normal');
        doc.text(line, layout.sectorNotesX! + 0.5, layout.sectorNotesY! + i * lineH);
      });
    } else {
      doc.setFont(font, 'normal');
      const maxW = (layout.sectorNotesW ?? 30) - 1;
      const lines = doc.splitTextToSize(text, maxW) as string[];
      lines.slice(0, 2).forEach((line, i) => {
        doc.text(line, layout.sectorNotesX! + 0.5, layout.sectorNotesY! + i * lineH);
      });
    }
  },

  async printProductLabels(product: Product, variation?: Variation, sizes?: string[], quantities?: Record<string, number>, dimensions: [number, number] = [40, 30], layout?: LabelLayout, photoUrl?: string, sizeGrid?: string, lotId?: string, orderId?: string, itemIdx?: number) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: dimensions,
    });

    const activeLayout = layout || this.getDefaultLayout(dimensions);
    const variationsToPrint = variation ? [variation] : product.variations;
    let firstPage = true;

    for (const v of variationsToPrint) {
      const sizesToPrint = sizes ? sizes : Object.keys(v.stock).filter(s => s !== 'WHOLESALE');
      
      for (const size of sizesToPrint) {
        const qty = quantities ? (quantities[size] || 0) : 1;
        
        for (let i = 0; i < qty; i++) {
          if (!firstPage) doc.addPage(dimensions);
          firstPage = false;

          const qrData = (lotId && orderId)
            ? `PRD|${product.id}|${v.id}|${size}|${lotId}|${orderId}|${itemIdx ?? ''}`
            : `PRD|${product.id}|${v.id}|${size}`;
          const qrCode = await this.generateQRCode(qrData);

          // Reference
          doc.setFontSize(activeLayout.refSize);
          doc.setFont(this.toPdfFont(activeLayout.refFontFamily), 'bold');
          doc.text(product.reference || '---', activeLayout.refX, activeLayout.refY, { align: 'center' });

          // QR Code
          if (qrCode) {
            doc.addImage(qrCode, 'PNG', activeLayout.qrX, activeLayout.qrY, activeLayout.qrSize, activeLayout.qrSize);
          }

          // Color below QR
          doc.setFontSize(activeLayout.colorSize);
          doc.setFont(this.toPdfFont(activeLayout.colorFontFamily), 'bold');
          doc.text(v.colorName, activeLayout.colorX, activeLayout.colorY, { align: 'center' });

          // Size
          if (activeLayout.showSize) {
            doc.setFontSize(activeLayout.sizeSize);
            doc.setFont(this.toPdfFont(activeLayout.sizeFontFamily), 'bold');
            doc.text(size, activeLayout.sizeX, activeLayout.sizeY);
          }

          // Footer info
          doc.setFontSize(activeLayout.footerSize);
          doc.setFont(this.toPdfFont(activeLayout.footerFontFamily), 'normal');
          doc.text('ANTIGRAVITY SYSTEM', activeLayout.footerX, activeLayout.footerY);

          // Product photo
          if (photoUrl && activeLayout.showPhoto && activeLayout.photoW && activeLayout.photoH) {
            try {
              doc.addImage(photoUrl, 'JPEG', activeLayout.photoX ?? 0, activeLayout.photoY ?? 0, activeLayout.photoW, activeLayout.photoH);
            } catch { /* foto inválida, ignora */ }
          }

          // Grade pills
          if (sizeGrid) this.renderGradePills(doc, sizeGrid, activeLayout);

          // OS Data
          if (activeLayout.showOsData && activeLayout.osDataText && activeLayout.osDataX !== undefined && activeLayout.osDataY !== undefined) {
            doc.setFontSize(activeLayout.osDataSize ?? 4);
            doc.setFont(this.toPdfFont(activeLayout.osDataFontFamily), 'normal');
            doc.setTextColor(99, 102, 241);
            doc.text(activeLayout.osDataText, activeLayout.osDataX, activeLayout.osDataY, { align: 'center' });
            doc.setTextColor(0, 0, 0);
          }

          // Sector Notes
          if (activeLayout.showSectorNotes && activeLayout.sectorNotesText) {
            this.renderSectorNotes(doc, activeLayout, activeLayout.sectorNotesText);
          }
        }
      }
    }

    if (firstPage) return;
    await sharePDF(doc, `Etiquetas_${product.reference || product.name}.pdf`);
  },

  async printProductLabelsBatch(
    items: { product: Product; variation: Variation; sizeGrid: string; sectorNotesText?: string; photoUrl?: string; lotId?: string; orderId?: string; itemIdx?: number }[],
    dimensions: [number, number] = [40, 30],
    layout?: LabelLayout
  ) {
    if (items.length === 0) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: dimensions,
    });

    const activeLayout = layout || this.getDefaultLayout(dimensions);

    for (let idx = 0; idx < items.length; idx++) {
      const { product, variation, sizeGrid, sectorNotesText, photoUrl, lotId, orderId, itemIdx } = items[idx];
      if (idx > 0) doc.addPage(dimensions);

      const qrSuffix = (lotId && orderId) ? `|${lotId}|${orderId}|${itemIdx ?? ''}` : '';
      const qrCode = await this.generateQRCode(`PRD|${product.id}|${variation.id}|GRADE${qrSuffix}`);

      // Reference
      doc.setFontSize(activeLayout.refSize);
      doc.setFont(this.toPdfFont(activeLayout.refFontFamily), 'bold');
      doc.text(product.reference || '---', activeLayout.refX, activeLayout.refY, { align: 'center' });

      // QR Code
      if (qrCode) {
        doc.addImage(qrCode, 'PNG', activeLayout.qrX, activeLayout.qrY, activeLayout.qrSize, activeLayout.qrSize);
      }

      // Color below QR
      doc.setFontSize(activeLayout.colorSize);
      doc.setFont(this.toPdfFont(activeLayout.colorFontFamily), 'bold');
      doc.text(variation.colorName, activeLayout.colorX, activeLayout.colorY, { align: 'center' });

      // Footer info
      doc.setFontSize(activeLayout.footerSize);
      doc.setFont(this.toPdfFont(activeLayout.footerFontFamily), 'normal');
      doc.text('ANTIGRAVITY SYSTEM', activeLayout.footerX, activeLayout.footerY);

      // Product photo
      if (photoUrl && activeLayout.showPhoto && activeLayout.photoW && activeLayout.photoH) {
        try {
          doc.addImage(photoUrl, 'JPEG', activeLayout.photoX ?? 0, activeLayout.photoY ?? 0, activeLayout.photoW, activeLayout.photoH);
        } catch { /* foto inválida, ignora */ }
      }

      // Grade pills
      if (sizeGrid) this.renderGradePills(doc, sizeGrid, activeLayout);

      // OS Data
      if (activeLayout.showOsData && activeLayout.osDataText && activeLayout.osDataX !== undefined && activeLayout.osDataY !== undefined) {
        doc.setFontSize(activeLayout.osDataSize ?? 4);
        doc.setFont(this.toPdfFont(activeLayout.osDataFontFamily), 'normal');
        doc.setTextColor(99, 102, 241);
        doc.text(activeLayout.osDataText, activeLayout.osDataX, activeLayout.osDataY, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }

      // Sector Notes (specific to this item's variation)
      if (activeLayout.showSectorNotes && sectorNotesText) {
        this.renderSectorNotes(doc, activeLayout, sectorNotesText);
      }
    }

    await sharePDF(doc, `Etiquetas_Lote_${items.length}.pdf`);
  },

  async printLotLabel(lot: ProductionLot, productName: string, colorName: string) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [50, 40],
    });

    const qrCode = await this.generateQRCode(`LOT|${lot.id}`);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(lot.orderNumber, 5, 8);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(productName, 5, 13);
    doc.text(colorName, 5, 17);
    doc.text(`Qtd: ${lot.quantity} pares`, 5, 21);

    if (qrCode) {
      doc.addImage(qrCode, 'PNG', 25, 5, 20, 20);
    }

    await sharePDF(doc, `Etiqueta_Lote_${lot.orderNumber}.pdf`);
  },

  async printSoleLabels(mold: ProductionConfigItem, color: { id: string; name: string }, sizes: string[], quantities?: Record<string, number>, dimensions: [number, number] = [40, 30], layout?: LabelLayout) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: dimensions,
    });

    const activeLayout = layout || this.getDefaultLayout(dimensions);
    let firstPage = true;

    for (const size of sizes) {
      const qty = quantities ? (quantities[size] || 0) : 1;
      
      for (let i = 0; i < qty; i++) {
        if (!firstPage) doc.addPage(dimensions);
        firstPage = false;

        const qrCode = await this.generateQRCode(`SOL|${mold.id}|${color.id}|${size}`);

        doc.setFontSize(activeLayout.refSize);
        doc.setFont('helvetica', 'bold');
        doc.text(mold.metadata?.moldReference || mold.name, activeLayout.refX, activeLayout.refY, { align: 'center' });

        if (qrCode) {
          doc.addImage(qrCode, 'PNG', activeLayout.qrX, activeLayout.qrY, activeLayout.qrSize, activeLayout.qrSize);
        }
        
        doc.setFontSize(activeLayout.colorSize);
        doc.setFont('helvetica', 'bold');
        doc.text(color.name, activeLayout.colorX, activeLayout.colorY, { align: 'center' });

        if (activeLayout.showSize) {
          doc.setFontSize(activeLayout.sizeSize);
          doc.setFont('helvetica', 'bold');
          doc.text(size, activeLayout.sizeX, activeLayout.sizeY);
        }

        doc.setFontSize(activeLayout.footerSize);
        doc.setFont('helvetica', 'normal');
        doc.text('SOLADO / COMPONENTE', activeLayout.footerX, activeLayout.footerY);
      }
    }

    if (firstPage) return;
    await sharePDF(doc, `Etiquetas_Solado_${mold.metadata?.moldReference || mold.id}.pdf`);
  },

  async printWholesaleLabel(product: Product, variation: Variation, quantity: number = 1, dimensions: [number, number] = [40, 30], layout?: LabelLayout, photoUrl?: string, sizeGrid?: string) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: dimensions,
    });

    const activeLayout = layout || this.getDefaultLayout(dimensions);
    let firstPage = true;

    for (let i = 0; i < quantity; i++) {
      if (!firstPage) doc.addPage(dimensions);
      firstPage = false;

      const qrCode = await this.generateQRCode(`PRD|${product.id}|${variation.id}|WHOLESALE`);

      doc.setFontSize(activeLayout.refSize);
      doc.setFont(this.toPdfFont(activeLayout.refFontFamily), 'bold');
      doc.text(product.reference || '---', activeLayout.refX, activeLayout.refY, { align: 'center' });

      if (qrCode) {
        doc.addImage(qrCode, 'PNG', activeLayout.qrX, activeLayout.qrY, activeLayout.qrSize, activeLayout.qrSize);
      }

      doc.setFontSize(activeLayout.colorSize);
      doc.setFont(this.toPdfFont(activeLayout.colorFontFamily), 'bold');
      doc.text(variation.colorName, activeLayout.colorX, activeLayout.colorY, { align: 'center' });

      if (activeLayout.showSize) {
        doc.setFontSize(activeLayout.sizeSize);
        doc.setFont(this.toPdfFont(activeLayout.sizeFontFamily), 'bold');
        doc.text('BOX', activeLayout.sizeX, activeLayout.sizeY);
      }

      doc.setFontSize(activeLayout.footerSize);
      doc.setFont(this.toPdfFont(activeLayout.footerFontFamily), 'normal');
      doc.text('ATACADO / CAIXA', activeLayout.footerX, activeLayout.footerY);

      // Product photo
      if (photoUrl && activeLayout.showPhoto && activeLayout.photoW && activeLayout.photoH) {
        try {
          doc.addImage(photoUrl, 'JPEG', activeLayout.photoX ?? 0, activeLayout.photoY ?? 0, activeLayout.photoW, activeLayout.photoH);
        } catch { /* foto inválida, ignora */ }
      }

      // Grade pills
      if (sizeGrid) this.renderGradePills(doc, sizeGrid, activeLayout);

      // OS Data
      if (activeLayout.showOsData && activeLayout.osDataText && activeLayout.osDataX !== undefined && activeLayout.osDataY !== undefined) {
        doc.setFontSize(activeLayout.osDataSize ?? 4);
        doc.setFont(this.toPdfFont(activeLayout.osDataFontFamily), 'normal');
        doc.setTextColor(99, 102, 241);
        doc.text(activeLayout.osDataText, activeLayout.osDataX, activeLayout.osDataY, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }

      // Sector Notes
      if (activeLayout.showSectorNotes && activeLayout.sectorNotesText) {
        this.renderSectorNotes(doc, activeLayout, activeLayout.sectorNotesText);
      }
    }

    await sharePDF(doc, `Etiqueta_Caixa_${product.reference || product.name}.pdf`);
  },

  async printServiceOrder(os: ServiceOrder, nextSectorName: string = 'CONCLUÍDO', dimensions: [number, number] = [148, 210], layout?: any, photoUrl?: string, sizeGrid?: string) {
    const [W, H] = dimensions;
    const thermal = H <= 60 || W > H * 1.5;

    const docScale  = W / 148;

    const fitFont = (elemH: number, elemW: number, heightRatio = 0.5, maxPt = 72, minPt = 3): number => {
      const ptFromH = elemH * heightRatio * 2.8346;
      const ptFromW = elemW * 0.12 * 2.8346;
      return Math.min(maxPt, Math.max(minPt, Math.min(ptFromH, ptFromW)));
    };

    const doc = new jsPDF({ orientation: W > H ? 'landscape' : 'portrait', unit: 'mm', format: [W, H] });
    const qrCode = await this.generateQRCode(`OS|${os.id}`);

    type ElemData = { x: number; y: number; w: number; h: number; visible: boolean; fontSize?: number; fontSizeQty?: number; fontFamily?: string; bold?: boolean };
    const el = (key: string, defX: number, defY: number, defW: number, defH: number): ElemData => {
      const e = layout?.elems?.[key];
      if (e) return e as ElemData;
      return { x: defX, y: defY, w: defW, h: defH, visible: true };
    };
    const toPdfFont = (f?: string) => (f === 'times' ? 'times' : f === 'courier' ? 'courier' : 'helvetica');
    // Apply element typography to doc
    const applyFont = (e: ElemData, fallbackSize: number, fallbackBold = false) => {
      doc.setFont(toPdfFont(e.fontFamily), (e.bold ?? fallbackBold) ? 'bold' : 'normal');
      doc.setFontSize(e.fontSize ?? fallbackSize);
    };

    const s = docScale;
    const header      = el('header',      0,            0,       W,        thermal ? H * 0.40 : 22*s);
    const info        = el('info',         thermal ? 0 : 8*s,  thermal ? H*0.40 : 28*s,  thermal ? W*0.65 : W-16*s,  thermal ? H*0.60 : 52*s);
    const total       = el('total',        8*s,          82*s,    W-16*s,   12*s);
    const notes       = el('notes',        8*s,          96*s,    W-16*s,   10*s);
    const qr          = el('qr',           thermal ? W*0.68 : (W-60*s)/2, thermal ? H*0.05 : 110*s, thermal ? H*0.90 : 60*s, thermal ? H*0.90 : 60*s);
    const photo       = el('photo',        thermal ? W*0.68 : W-46*s,    0,    thermal ? H*0.50 : 38*s,  thermal ? H*0.50 : 38*s);
    const grade       = el('grade',        thermal ? 0 : 8*s,  thermal ? H-3.5 : 75*s,  thermal ? W*0.65 : W-16*s,  thermal ? 3.5 : 7*s);
    const instruction = el('instruction',  8*s,          173*s,   W-16*s,   14*s);
    const footer      = el('footer',       0,            H-8*s,   W,        8*s);

    // ── Header ──────────────────────────────────────────────────────────────
    if (header.visible !== false) {
      if (!thermal) {
        doc.setFillColor(0, 0, 0);
        doc.rect(header.x, header.y, header.w, header.h, 'F');
        doc.setTextColor(255, 255, 255);
        applyFont(header, fitFont(header.h, header.w, 0.30, 14), false);
        doc.text('ORDEM DE SERVIÇO', header.x + header.w / 2, header.y + header.h * 0.42, { align: 'center' });
        doc.setFontSize((header.fontSize ?? fitFont(header.h, header.w, 0.30, 14)) * 1.8);
        doc.text(os.osNumber, header.x + header.w / 2, header.y + header.h * 0.85, { align: 'center' });
      } else {
        applyFont(header, fitFont(header.h * 0.55, header.w, 0.55, 18, 4), true);
        doc.setTextColor(0, 0, 0);
        doc.text(os.osNumber, header.x + 1, header.y + header.h * 0.45, { align: 'left' });
        doc.setFont(header.fontFamily || 'helvetica', 'normal');
        doc.setFontSize((header.fontSize ?? fitFont(header.h * 0.35, header.w, 0.40, 12, 3)) * 0.8);
        doc.setTextColor(0, 0, 0);
        const prodTrunc = doc.splitTextToSize(os.productName, header.w - 2);
        doc.text(prodTrunc[0] || os.productName, header.x + 1, header.y + header.h * 0.85);
      }
    }

    doc.setTextColor(0, 0, 0);

    // ── Info grid ───────────────────────────────────────────────────────────
    if (info.visible !== false) {
      if (!thermal) {
        const col1 = info.x;
        const col2 = info.x + info.w / 2;
        const lineH = info.h / 4;
        const baseSz  = info.fontSize ?? fitFont(lineH * 0.50, info.w / 2, 0.50, 11, 4);
        const labelFontSz = baseSz * 0.75;
        const valueFontSz = baseSz;
        const ff = info.fontFamily || 'helvetica';

        const drawRow = (lbl: string, val: string, x: number, yPos: number) => {
          doc.setFont(ff, 'normal');
          doc.setFontSize(labelFontSz);
          doc.setTextColor(100, 100, 100);
          doc.text(lbl.toUpperCase(), x, yPos);
          doc.setFont(ff, 'bold');
          doc.setFontSize(valueFontSz);
          doc.setTextColor(0, 0, 0);
          const wrapped = doc.splitTextToSize(val, info.w / 2 - 2);
          doc.text(wrapped[0] || val, x, yPos + lineH * 0.45);
        };

        let iy = info.y + lineH * 0.3;
        drawRow('Produto',    os.productName,                                    col1, iy);
        drawRow('Variação',   os.variationName || '-',                           col2, iy); iy += lineH;
        drawRow('Setor',      os.sectorName,                                     col1, iy);
        drawRow('Próximo',    nextSectorName,                                     col2, iy); iy += lineH;
        drawRow('Prestador',  os.providerName,                                   col1, iy);
        drawRow('Tipo',       os.type === 'INTERNAL' ? 'Interna' : 'Terceirizada', col2, iy); iy += lineH;
        drawRow('Quantidade', `${os.quantity} pares`,                            col1, iy);
        drawRow('Vlr/par',    `R$ ${os.valuePerPair.toFixed(2)}`,                col2, iy);
      } else {
        // Thermal info: compact, 2 lines — preto
        const lineH = info.h / 2;
        const lbl1Sz = fitFont(lineH * 0.40, info.w, 0.40, 10, 3);
        const val1Sz = fitFont(lineH * 0.55, info.w, 0.55, 12, 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(lbl1Sz);
        doc.setTextColor(0, 0, 0);
        const routeText = doc.splitTextToSize(`${os.sectorName} -> ${nextSectorName}`, info.w - 1);
        doc.text(routeText[0] || '', info.x + 1, info.y + lineH * 0.50);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(val1Sz);
        doc.setTextColor(0, 0, 0);
        doc.text(`R$ ${os.totalValue.toFixed(2)}  ${os.quantity}prs`, info.x + 1, info.y + lineH * 1.15);
      }
    }

    // ── Total box (document only) ────────────────────────────────────────────
    if (!thermal && total.visible !== false) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.roundedRect(total.x, total.y, total.w, total.h, 2, 2, 'FD');
      applyFont(total, fitFont(total.h, total.w * 0.35, 0.45, 10, 4), true);
      doc.setTextColor(0, 0, 0);
      doc.text('TOTAL OS', total.x + 4, total.y + total.h * 0.65);
      doc.setFontSize((total.fontSize ?? fitFont(total.h, total.w * 0.35, 0.45, 10, 4)) * 1.4);
      doc.text(`R$ ${os.totalValue.toFixed(2)}`, total.x + total.w - 4, total.y + total.h * 0.75, { align: 'right' });
    }

    // ── Notes (document only) ────────────────────────────────────────────────
    if (!thermal && os.notes && notes.visible !== false) {
      doc.setFont(notes.fontFamily || 'helvetica', notes.bold ? 'bold' : 'italic');
      doc.setFontSize(notes.fontSize ?? fitFont(notes.h, notes.w, 0.45, 9, 4));
      doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(`Obs: ${os.notes}`, notes.w);
      doc.text(lines, notes.x, notes.y + notes.h * 0.45);
    }

    // ── QR Code ─────────────────────────────────────────────────────────────
    if (qrCode && qr.visible !== false) {
      doc.addImage(qrCode, 'PNG', qr.x, qr.y, qr.w, qr.h);
    }

    // ── Product Photo ────────────────────────────────────────────────────────
    if (photoUrl && photo.visible !== false) {
      try {
        // Convert URL to base64 via canvas (works with data URLs and same-origin URLs)
        const imgBase64 = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width  = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('no ctx')); return; }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = reject;
          img.src = photoUrl;
        });
        doc.addImage(imgBase64, 'JPEG', photo.x, photo.y, photo.w, photo.h);
      } catch {
        // If photo fails to load, draw a placeholder rectangle
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(0, 0, 0);
        doc.roundedRect(photo.x, photo.y, photo.w, photo.h, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fitFont(photo.h, photo.w, 0.30, 8, 3));
        doc.setTextColor(0, 0, 0);
        doc.text('FOTO', photo.x + photo.w / 2, photo.y + photo.h / 2, { align: 'center' });
      }
    }

    // ── Size Grade with quantities ────────────────────────────────────────────
    if (sizeGrid && grade.visible !== false) {
      const entries = sizeGrid.split('-').map(tok => {
        const [sz, qtyStr] = tok.split('x');
        return { sz: sz || tok, qty: qtyStr ? parseInt(qtyStr) : null };
      });
      const hasQty  = entries.some(e => e.qty !== null);
      const cellW   = grade.w / entries.length;
      const szFontSz  = grade.fontSize ? grade.fontSize : fitFont(hasQty ? grade.h * 0.55 : grade.h, cellW, 0.55, 10, 3);
      const qtyFontSz = grade.fontSizeQty ?? (grade.fontSize ? grade.fontSize * 0.7 : fitFont(grade.h * 0.38, cellW, 0.38, 7, 2));

      entries.forEach(({ sz, qty }, i) => {
        const cellX = grade.x + cellW * i;
        const cx    = cellX + cellW / 2;
        // Sem fundo, sem borda — texto puro em preto
        doc.setFont(grade.fontFamily || 'helvetica', 'bold');
        doc.setFontSize(szFontSz);
        doc.setTextColor(0, 0, 0);
        const szY = hasQty ? grade.y + grade.h * 0.48 : grade.y + grade.h * 0.72;
        doc.text(sz, cx, szY, { align: 'center' });
        if (qty !== null) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(qtyFontSz);
          doc.setTextColor(0, 0, 0);
          doc.text(`${qty}`, cx, grade.y + grade.h * 0.88, { align: 'center' });
        }
      });
    }

    // ── Instructions (document only) ─────────────────────────────────────────
    if (!thermal && instruction.visible !== false) {
      const cy = instruction.y + instruction.h / 2;
      applyFont(instruction, fitFont(instruction.h, instruction.w, 0.35, 10, 4), true);
      doc.setTextColor(0, 0, 0);
      doc.text('ESCANEIE PARA DAR BAIXA E AVANÇAR O LOTE', instruction.x + instruction.w / 2, cy - instruction.h * 0.15, { align: 'center' });
      doc.setFont(instruction.fontFamily || 'helvetica', 'normal');
      doc.setFontSize((instruction.fontSize ?? fitFont(instruction.h, instruction.w, 0.35, 10, 4)) * 0.8);
      doc.setTextColor(80, 80, 80);
      doc.text(`Proximo setor: ${nextSectorName}`, instruction.x + instruction.w / 2, cy + instruction.h * 0.25, { align: 'center' });
    }

    // ── Footer ──────────────────────────────────────────────────────────────
    if (footer.visible !== false) {
      applyFont(footer, fitFont(footer.h, footer.w, 0.45, 7, 2), false);
      doc.setTextColor(80, 80, 80);
      doc.text(`Emitida em: ${new Date(os.createdAt).toLocaleString('pt-BR')}`, footer.x + footer.w / 2, footer.y + footer.h / 2, { align: 'center' });
    }

    await sharePDF(doc, `OS_${os.osNumber}.pdf`);
  }
};

