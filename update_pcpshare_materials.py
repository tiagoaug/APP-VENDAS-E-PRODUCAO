import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update PCPShareData
content = content.replace("  showTotalGrid?: boolean;", "  showTotalGrid?: boolean;\n  showMaterials?: boolean;")

# 2. Update generatePDF
content = content.replace("const { lotNumber, items, additionalNote, showTotalGrid } = data;", "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials } = data;")

pdf_materials = """
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
"""

new_pdf_materials = """
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
"""
content = content.replace(pdf_materials.strip(), new_pdf_materials.strip())

# 3. Update generateJPG arguments
content = content.replace("async function generateJPG(data: PCPShareData, filename: string) {\n  const { lotNumber, items, additionalNote, showTotalGrid } = data;", "async function generateJPG(data: PCPShareData, filename: string) {\n  const { lotNumber, items, additionalNote, showTotalGrid, showMaterials } = data;")

# 4. Update generateJPG height measurement
content = content.replace("currentY += 80; // Materiais Table", "if (showMaterials !== false) { currentY += 80; } // Materiais Table")

# 5. Update generateJPG rendering
jpg_materials = """
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
"""

new_jpg_materials = """
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
"""

content = content.replace(jpg_materials.strip(), new_jpg_materials.strip())

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("pcpShareExport updated!")
