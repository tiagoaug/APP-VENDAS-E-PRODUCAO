import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update PCPShareData
content = content.replace(
    "  showSectorNotes?: boolean;", 
    "  showSectorNotes?: boolean;\n  showOrderList?: boolean;"
)

# 2. Update generatePDF signature
content = content.replace(
    "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes } = data;", 
    "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList } = data;"
)

# 3. Update generateJPG signature
content = content.replace(
    "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes } = data;", 
    "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList } = data;"
)

# 4. In generatePDF, after drawing "LOTE: xxx", let's inject the order list.
# Currently it is:
#     doc.setFont('helvetica', 'normal');
#     doc.text(`LOTE:`, 14, currentY);
#     doc.setFont('helvetica', 'bold');
#     doc.text(lotNumber, 26, currentY);
#     currentY += 12;
#
# If showOrderList is true, we can draw a table with order numbers below it.
pdf_order_list = """
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`LOTE:`, 14, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(lotNumber.length > 50 ? lotNumber.substring(0, 50) + '...' : lotNumber, 26, currentY);
    currentY += 10;

    if (showOrderList !== false && lotNumber && lotNumber !== 'Vários') {
      const ordersList = lotNumber.split(',').map(s => s.trim()).filter(Boolean);
      if (ordersList.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PEDIDOS SELECIONADOS NO LOTE:', 14, currentY);
        currentY += 4;
        
        const chunkedOrders = [];
        for (let i = 0; i < ordersList.length; i += 6) {
          const chunk = ordersList.slice(i, i + 6);
          while (chunk.length < 6) chunk.push('');
          chunkedOrders.push(chunk);
        }
        
        autoTable(doc, {
          startY: currentY,
          head: [],
          body: chunkedOrders,
          theme: 'grid',
          styles: { halign: 'center', fontSize: 8, cellPadding: 2, fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }
    } else {
      currentY += 2;
    }
"""

# Find the current PDF LOT code
pdf_lot_old = """    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`LOTE:`, 14, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(lotNumber, 26, currentY);
    currentY += 12;"""

content = content.replace(pdf_lot_old, pdf_order_list.strip())

# 5. In generateJPG, update the height measurement
# Let's add 60px if showOrderList is true
content = content.replace(
    "currentY += 140; // Header and initial spacing",
    """currentY += 140; // Header and initial spacing
    if (showOrderList !== false && lotNumber && lotNumber !== 'Vários') {
      const list = lotNumber.split(',').filter(Boolean);
      currentY += 30 + (Math.ceil(list.length / 6) * 35);
    }"""
)

# 6. In generateJPG, draw the order list after drawing LOTE
# Currently it is:
#     ctx.fillStyle = '#64748b';
#     ctx.font = '700 12px Inter';
#     ctx.fillText('LOTE:', pad, y);
#     ctx.fillStyle = '#0f172a';
#     ctx.font = '900 12px Inter';
#     ctx.fillText(lotNumber, pad + 40, y);
#     y += 40;

jpg_order_list = """
    ctx.fillStyle = '#64748b';
    ctx.font = '700 12px Inter';
    ctx.fillText('LOTE:', pad, y);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 12px Inter';
    ctx.fillText(lotNumber.length > 50 ? lotNumber.substring(0, 50) + '...' : lotNumber, pad + 40, y);
    y += 30;

    if (showOrderList !== false && lotNumber && lotNumber !== 'Vários') {
      const ordersList = lotNumber.split(',').map(s => s.trim()).filter(Boolean);
      if (ordersList.length > 0) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 14px Inter';
        ctx.fillText('PEDIDOS SELECIONADOS NO LOTE:', pad, y);
        y += 15;
        
        const cols = 6;
        const boxW = (W - pad * 2) / cols;
        const boxH = 30;
        
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#f8fafc';
        
        for (let i = 0; i < ordersList.length; i++) {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const boxX = pad + col * boxW;
          const boxY = y + row * boxH;
          
          ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.strokeRect(boxX, boxY, boxW, boxH);
          
          ctx.fillStyle = '#0f172a';
          ctx.font = '900 12px Inter';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ordersList[i], boxX + boxW/2, boxY + boxH/2);
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
        y += Math.ceil(ordersList.length / cols) * boxH + 20;
      }
    }
"""

jpg_lot_old = """    ctx.fillStyle = '#64748b';
    ctx.font = '700 12px Inter';
    ctx.fillText('LOTE:', pad, y);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 12px Inter';
    ctx.fillText(lotNumber, pad + 40, y);
    y += 40;"""

content = content.replace(jpg_lot_old, jpg_order_list.strip())

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("pcpShareExport updated with showOrderList!")
