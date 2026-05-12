import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sale, Product, Person, PaymentMethod } from '../types';
import { sharePDF, shareImage } from './pdfExport';
import { toJpeg } from 'html-to-image';

interface ExportData {
  sale: Sale;
  products: Product[];
  people: Person[];
  paymentMethods: PaymentMethod[];
  additionalNote?: string;
  isDarkMode: boolean;
}

export const exportSale = async (data: ExportData, formatType: 'pdf' | 'jpg') => {
  const { sale, products, people, paymentMethods, additionalNote, isDarkMode } = data;

  const customer = people.find(p => p.id === sale.customerId);
  const seller = people.find(p => p.id === sale.sellerId);
  const dateStr = format(new Date(sale.date), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  const customerFirstName = (customer?.name || 'Cliente').split(' ')[0];
  const filename = `${sale.status === 'QUOTE' ? 'Orcamento' : 'Venda'}_${sale.orderNumber}_${customerFirstName}`;

  try {
    if (formatType === 'pdf') {
      await generatePDF(data, filename);
    } else {
      await generateJPG(data, filename);
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Erro ao gerar arquivo. Por favor, tente novamente.');
  }
};

async function generatePDF(data: ExportData, filename: string) {
  const { sale, products, people, paymentMethods, additionalNote } = data;
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const customer = people.find(p => p.id === sale.customerId);
  const seller = people.find(p => p.id === sale.sellerId);
  const paymentMethod = paymentMethods.find(pm => pm.id === sale.paymentMethodId);

  // Colors
  const headerBgColor = [15, 23, 42]; // slate-900
  const labelColor = [100, 116, 139]; // slate-500
  const textColor = [30, 41, 59]; // slate-800

  // Header Banner
  doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const title = sale.status === 'QUOTE' ? 'Relatório de Orçamento' : 'Relatório de Pedido';
  doc.text(title, 105, 18, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(sale.status === 'QUOTE' ? 'Proposta Comercial' : 'Venda Confirmada', 105, 26, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Este documento não tem valor fiscal', 105, 33, { align: 'center' });

  // Info Section
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  
  const infoY = 55;
  
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

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - App Vendas e Produção`, 105, 285, { align: 'center' });

  await sharePDF(doc, filename);
}

async function generateJPG(data: ExportData, filename: string) {
  const { sale, products, people, paymentMethods, additionalNote } = data;
  const customer = people.find(p => p.id === sale.customerId);
  const seller = people.find(p => p.id === sale.sellerId);
  const paymentMethod = paymentMethods.find(pm => pm.id === sale.paymentMethodId);

  const container = document.createElement('div');
  container.style.position = 'fixed'; // Use fixed to ensure it's on screen but hidden
  container.style.top = '0';
  container.style.left = '-2000px'; // Far off screen
  container.style.width = '600px';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '9999';
  
  container.innerHTML = `
    <div style="font-family: Arial, sans-serif; color: #1e293b;">
      <div style="background-color: #0f172a; padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">Sistema de Vendas</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em;">${sale.status === 'QUOTE' ? 'Relatório de Orçamento' : 'Relatório de Pedido'}</p>
        <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-weight: 500;">Este documento não tem valor fiscal</p>
      </div>

      <div style="padding: 30px; background-color: #f8fafc; margin: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: #64748b; font-size: 11px; letter-spacing: 0.05em;">Cliente</strong><br/>
          <span style="font-size: 20px; font-weight: 700; color: #0f172a;">${customer?.name || 'Não informado'}</span>
        </div>
        <div style="text-align: right;">
          <strong style="color: #64748b; font-size: 11px; letter-spacing: 0.05em;">Data</strong><br/>
          <span style="font-size: 20px; font-weight: 700; color: #0f172a;">${format(new Date(sale.date), 'dd/MM/yyyy')}</span>
        </div>
      </div>

      <div style="padding: 0 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="text-align: left; font-size: 11px; color: #64748b; letter-spacing: 0.05em;">
              <th style="padding: 12px; border-bottom: 2px solid #f1f5f9;">Produto / Descrição</th>
              <th style="padding: 12px; border-bottom: 2px solid #f1f5f9; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map(item => {
              const product = products.find(p => p.id === item.productId);
              const variation = product?.variations?.find(v => v.id === item.variationId);
              return `
                <tr style="font-size: 15px; border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 16px 12px; color: #64748b; font-weight: 500;">
                    ${item.quantity}x ${product?.reference || ''} ${product?.name || '---'}${variation ? ` - ${variation.colorName}` : ''}
                  </td>
                  <td style="padding: 16px 12px; text-align: right; font-weight: 700; color: #0f172a;">
                    R$ ${(item.quantity * item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin: 30px 20px; display: flex; justify-content: flex-end;">
        <div style="width: 250px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #64748b;">
            <span>Subtotal:</span>
            <span>R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          ${sale.discount ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; color: #ef4444;">
            <span>Desconto:</span>
            <span>- R$ ${sale.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 24px; font-weight: 900; color: #0f172a; border-top: 2px solid #f1f5f9; padding-top: 15px;">
            <span>Total:</span>
            <span>R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      ${additionalNote ? `
        <div style="margin: 20px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #0f172a;">
          <strong style="color: #64748b; font-size: 11px; letter-spacing: 0.05em;">Observações</strong>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #334155; white-space: pre-wrap; line-height: 1.5;">${additionalNote}</p>
        </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Robust delay for mobile rendering
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const dataUrl = await toJpeg(container, { quality: 0.95, backgroundColor: '#ffffff' });
    await shareImage(dataUrl, filename);
  } catch (error) {
    console.error('JPG Error:', error);
    alert('Erro ao gerar imagem.');
  } finally {
    document.body.removeChild(container);
  }
}
