import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Product, Variation, ProductionLot, LabelLayout, ProductionConfigItem } from '../types';

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

  async printProductLabels(product: Product, variation?: Variation, sizes?: string[], quantities?: Record<string, number>, dimensions: [number, number] = [40, 30], layout?: LabelLayout) {
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

          const qrData = `PRD|${product.id}|${v.id}|${size}`;
          const qrCode = await this.generateQRCode(qrData);

          // Reference
          doc.setFontSize(activeLayout.refSize);
          doc.setFont('helvetica', 'bold');
          doc.text(product.reference || '---', activeLayout.refX, activeLayout.refY, { align: 'center' });

          // QR Code
          if (qrCode) {
            doc.addImage(qrCode, 'PNG', activeLayout.qrX, activeLayout.qrY, activeLayout.qrSize, activeLayout.qrSize);
          }
          
          // Color below QR
          doc.setFontSize(activeLayout.colorSize);
          doc.setFont('helvetica', 'bold');
          doc.text(v.colorName, activeLayout.colorX, activeLayout.colorY, { align: 'center' });

          // Size
          if (activeLayout.showSize) {
            doc.setFontSize(activeLayout.sizeSize);
            doc.setFont('helvetica', 'bold');
            doc.text(size, activeLayout.sizeX, activeLayout.sizeY);
          }

          // Footer info
          doc.setFontSize(activeLayout.footerSize);
          doc.setFont('helvetica', 'normal');
          doc.text('ANTIGRAVITY SYSTEM', activeLayout.footerX, activeLayout.footerY);
        }
      }
    }

    if (firstPage) return;
    doc.save(`Etiquetas_${product.reference || product.name}.pdf`);
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

    doc.save(`Etiqueta_Lote_${lot.orderNumber}.pdf`);
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
    doc.save(`Etiquetas_Solado_${mold.metadata?.moldReference || mold.id}.pdf`);
  },

  async printWholesaleLabel(product: Product, variation: Variation, quantity: number = 1, dimensions: [number, number] = [40, 30], layout?: LabelLayout) {
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
      doc.setFont('helvetica', 'bold');
      doc.text(product.reference || '---', activeLayout.refX, activeLayout.refY, { align: 'center' });

      if (qrCode) {
        doc.addImage(qrCode, 'PNG', activeLayout.qrX, activeLayout.qrY, activeLayout.qrSize, activeLayout.qrSize);
      }
      
      doc.setFontSize(activeLayout.colorSize);
      doc.setFont('helvetica', 'bold');
      doc.text(variation.colorName, activeLayout.colorX, activeLayout.colorY, { align: 'center' });

      if (activeLayout.showSize) {
        doc.setFontSize(activeLayout.sizeSize);
        doc.setFont('helvetica', 'bold');
        doc.text('BOX', activeLayout.sizeX, activeLayout.sizeY);
      }

      doc.setFontSize(activeLayout.footerSize);
      doc.setFont('helvetica', 'normal');
      doc.text('ATACADO / CAIXA', activeLayout.footerX, activeLayout.footerY);
    }

    doc.save(`Etiqueta_Caixa_${product.reference || product.name}.pdf`);
  }
};
