import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Sector Notes in generateJPG MEASURE PASS
jpg_measure_target = """    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      currentY += 30;
      ctx.font = '16px Inter';
      for (const sector of item.sectorNotes) {
        currentY += 30;
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `    ${note}`, W - pad * 2 - 20);
          currentY += lines.length * 24 + 5;
        }
      }
    }"""

jpg_measure_replacement = """    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {
      currentY += 30;
      ctx.font = '16px Inter';
      for (const sector of item.sectorNotes) {
        currentY += 50; // card padding and sector title
        for (const note of sector.notes) {
          const lines = wrapText(ctx, `    ${note}`, W - pad * 2 - 30);
          currentY += lines.length * 24 + 5;
        }
        currentY += 20; // extra padding after card
      }
    }"""

if jpg_measure_target in content:
    content = content.replace(jpg_measure_target, jpg_measure_replacement)
    print("SUCCESS JPG MEASURE")
else:
    print("FAIL JPG MEASURE")

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)
