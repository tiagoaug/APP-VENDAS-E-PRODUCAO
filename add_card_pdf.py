import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Sector Notes in generatePDF
pdf_target = """    // Sector Notes
    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(10);
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
          const lines = doc.splitTextToSize(`    ${note}`, 180);
          for (const line of lines) {
            if (currentY > 280) { doc.addPage(); currentY = 20; }
            doc.text(line, 18, currentY);
            currentY += 5;
          }
        }
        currentY += 3;
      }
      currentY += 6;
    }"""

pdf_replacement = """    // Sector Notes
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
    }"""

# Fix weird encoding issue in the target text (INSTRUÇÕES is written as INSTRUES in the file)
pdf_target_fix = pdf_target.replace('INSTRUÇÕES', 'INSTRUES')

if pdf_target_fix in content:
    content = content.replace(pdf_target_fix, pdf_replacement)
    print("SUCCESS PDF")
else:
    # Try regex
    pattern_pdf = r"\/\/\s*Sector Notes\s*if\s*\(showSectorNotes.*?currentY \+= 6;\s*\}"
    match = re.search(pattern_pdf, content, re.DOTALL)
    if match:
        content = content[:match.start()] + pdf_replacement + content[match.end():]
        print("SUCCESS PDF REGEX")
    else:
        print("FAIL PDF")

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)
